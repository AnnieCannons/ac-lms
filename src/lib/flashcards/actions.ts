'use server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function getAuthUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

// ----------------------------------------------------------------
// Decks
// ----------------------------------------------------------------

export async function createDeck(data: { title: string; description: string; tags: string[] }) {
  const { supabase, user } = await getAuthUser()

  const { data: deck, error } = await supabase
    .from('decks')
    .insert({
      owner_user_id: user.id,
      title: data.title,
      description: data.description || null,
      tags: data.tags,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/flashcards')
  return deck.id as string
}

export async function updateDeck(
  deckId: string,
  data: { title: string; description: string; tags: string[] }
) {
  const { supabase, user } = await getAuthUser()

  const { error } = await supabase
    .from('decks')
    .update({ title: data.title, description: data.description || null, tags: data.tags })
    .eq('id', deckId)
    .eq('owner_user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath(`/flashcards/decks/${deckId}`)
  revalidatePath('/flashcards')
}

export async function deleteDeck(deckId: string) {
  const { supabase, user } = await getAuthUser()

  const { error } = await supabase
    .from('decks')
    .delete()
    .eq('id', deckId)
    .eq('owner_user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/flashcards')
}

// ----------------------------------------------------------------
// Cards
// ----------------------------------------------------------------

export async function createCard(
  deckId: string,
  data: { card_type: string; front_content: string; back_content: string }
) {
  const { supabase } = await getAuthUser()

  // Get next order value
  const { data: last } = await supabase
    .from('cards')
    .select('order')
    .eq('deck_id', deckId)
    .order('order', { ascending: false })
    .limit(1)

  const nextOrder = last?.[0]?.order != null ? last[0].order + 1 : 1

  const { data: card, error } = await supabase
    .from('cards')
    .insert({
      deck_id: deckId,
      card_type: data.card_type,
      front_content: data.front_content,
      back_content: data.back_content,
      order: nextOrder,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/flashcards/decks/${deckId}`)
  return card.id as string
}

export async function updateCard(
  cardId: string,
  deckId: string,
  data: { card_type: string; front_content: string; back_content: string }
) {
  const { supabase } = await getAuthUser()

  const { error } = await supabase
    .from('cards')
    .update({ card_type: data.card_type, front_content: data.front_content, back_content: data.back_content })
    .eq('id', cardId)

  if (error) throw new Error(error.message)
  revalidatePath(`/flashcards/decks/${deckId}`)
}

export async function deleteCard(cardId: string, deckId: string) {
  const { supabase } = await getAuthUser()

  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', cardId)

  if (error) throw new Error(error.message)
  revalidatePath(`/flashcards/decks/${deckId}`)
}

export async function enableSharing(deckId: string): Promise<string> {
  const { supabase, user } = await getAuthUser()

  const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)

  const { error } = await supabase
    .from('decks')
    .update({ is_shared: true, share_token: token })
    .eq('id', deckId)
    .eq('owner_user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/flashcards')
  return token
}

export async function importDeck(sourceDeckId: string) {
  const { supabase, user } = await getAuthUser()

  const [{ data: sourceDeck }, { data: sourceCards }, { data: existing }] = await Promise.all([
    supabase.from('decks').select('*').eq('id', sourceDeckId).single(),
    supabase.from('cards').select('*').eq('deck_id', sourceDeckId).order('order', { ascending: true }),
    supabase.from('decks').select('id').eq('owner_user_id', user.id).eq('original_deck_id', sourceDeckId).maybeSingle(),
  ])

  if (!sourceDeck) throw new Error('Source deck not found')
  const cards = sourceCards ?? []

  if (existing) {
    // Override: replace cards with latest from source
    await supabase.from('cards').delete().eq('deck_id', existing.id)
    await supabase.from('decks').update({
      title: sourceDeck.title,
      description: sourceDeck.description,
      tags: sourceDeck.tags,
    }).eq('id', existing.id)

    if (cards.length > 0) {
      await supabase.from('cards').insert(
        cards.map(c => ({
          deck_id: existing.id,
          card_type: c.card_type,
          front_content: c.front_content,
          back_content: c.back_content,
          order: c.order,
          source_card_id: c.id,
        }))
      )
    }

    revalidatePath('/flashcards')
    return existing.id as string
  }

  // Fresh import
  const { data: newDeck, error } = await supabase
    .from('decks')
    .insert({
      owner_user_id: user.id,
      title: sourceDeck.title,
      description: sourceDeck.description,
      tags: sourceDeck.tags,
      original_deck_id: sourceDeckId,
      is_shared: false,
    })
    .select('id')
    .single()

  if (error || !newDeck) throw new Error(error?.message ?? 'Failed to create deck')

  if (cards.length > 0) {
    await supabase.from('cards').insert(
      cards.map(c => ({
        deck_id: newDeck.id,
        card_type: c.card_type,
        front_content: c.front_content,
        back_content: c.back_content,
        order: c.order,
        source_card_id: c.id,
      }))
    )
  }

  revalidatePath('/flashcards')
  return newDeck.id as string
}

// ----------------------------------------------------------------
// Study session writes — SM-2 algorithm
// ----------------------------------------------------------------

type Rating = 'Again' | 'Hard' | 'Good' | 'Easy'

function computeSM2(interval: number, ef: number, rating: Rating) {
  let newInterval = interval
  let newEF = ef

  if (rating === 'Again') {
    newInterval = 1
    // EF unchanged
  } else if (rating === 'Hard') {
    newEF = Math.max(1.3, ef - 0.15)
    newInterval = Math.max(1, Math.ceil(interval * 1.2))
  } else if (rating === 'Good') {
    if (interval === 0) newInterval = 1
    else if (interval === 1) newInterval = 6
    else newInterval = Math.round(interval * ef)
    // EF unchanged
  } else {
    // Easy
    newEF = ef + 0.15
    if (interval === 0) newInterval = 4
    else if (interval === 1) newInterval = 6
    else newInterval = Math.round(interval * ef * 1.3)
  }

  const newState: 'in_progress' | 'review' = newInterval >= 2 ? 'review' : 'in_progress'

  const due = new Date()
  due.setDate(due.getDate() + newInterval)
  const dueDate = due.toISOString().split('T')[0]

  return { newInterval, newEF, newState, dueDate }
}

export async function rateCard(cardId: string, rating: Rating) {
  const { supabase, user } = await getAuthUser()

  const { data: existing } = await supabase
    .from('card_progress')
    .select('interval, easiness_factor')
    .eq('card_id', cardId)
    .eq('user_id', user.id)
    .maybeSingle()

  const { newInterval, newEF, newState, dueDate } = computeSM2(
    existing?.interval ?? 0,
    existing?.easiness_factor ?? 2.5,
    rating
  )

  await supabase.from('card_progress').upsert(
    {
      user_id: user.id,
      card_id: cardId,
      state: newState,
      interval: newInterval,
      easiness_factor: newEF,
      due_date: dueDate,
      last_reviewed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,card_id' }
  )
}

export async function completeStudySession(
  deckId: string,
  stats: { cards_studied: number; again: number; hard: number; good: number; easy: number }
) {
  const { supabase, user } = await getAuthUser()
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  await supabase.from('study_sessions').insert({
    user_id: user.id,
    deck_id: deckId,
    started_at: now.toISOString(),
    ended_at: now.toISOString(),
    cards_studied: stats.cards_studied,
    cards_again: stats.again,
    cards_hard: stats.hard,
    cards_good: stats.good,
    cards_easy: stats.easy,
  })

  // Increment today's activity count
  const { data: existing } = await supabase
    .from('activity_log')
    .select('cards_studied_count')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle()

  await supabase.from('activity_log').upsert(
    {
      user_id: user.id,
      date: today,
      cards_studied_count: (existing?.cards_studied_count ?? 0) + stats.cards_studied,
    },
    { onConflict: 'user_id,date' }
  )

  revalidatePath('/flashcards')
}

export async function reorderCards(deckId: string, orderedCardIds: string[]) {
  const { supabase } = await getAuthUser()

  await Promise.all(
    orderedCardIds.map((cardId, index) =>
      supabase.from('cards').update({ order: index + 1 }).eq('id', cardId)
    )
  )
  // No revalidatePath — local state already reflects the new order
}
