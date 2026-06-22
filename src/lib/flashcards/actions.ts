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

export async function reorderCards(deckId: string, orderedCardIds: string[]) {
  const { supabase } = await getAuthUser()

  await Promise.all(
    orderedCardIds.map((cardId, index) =>
      supabase.from('cards').update({ order: index + 1 }).eq('id', cardId)
    )
  )
  // No revalidatePath — local state already reflects the new order
}
