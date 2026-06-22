import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { DeckWithCounts } from './seed'

export async function getDecksWithCounts(userId: string): Promise<DeckWithCounts[]> {
  const supabase = await createServerSupabaseClient()

  const { data: decks, error } = await supabase
    .from('decks')
    .select('*')
    .eq('owner_user_id', userId)
    .order('updated_at', { ascending: false })

  if (error || !decks?.length) return []

  const deckIds = decks.map((d) => d.id)

  const { data: cards } = await supabase
    .from('cards')
    .select('id, deck_id')
    .in('deck_id', deckIds)

  const allCards = cards ?? []
  const allCardIds = allCards.map((c) => c.id)

  const { data: progress } = allCardIds.length
    ? await supabase
        .from('card_progress')
        .select('card_id, state, due_date')
        .eq('user_id', userId)
        .in('card_id', allCardIds)
    : { data: [] }

  const allProgress = progress ?? []
  const progressByCardId = new Map(allProgress.map((p) => [p.card_id, p]))
  const today = new Date().toISOString().split('T')[0]

  return decks.map((deck) => {
    const deckCards = allCards.filter((c) => c.deck_id === deck.id)

    let newCount = 0
    let inProgressCount = 0
    let reviewCount = 0

    for (const card of deckCards) {
      const prog = progressByCardId.get(card.id)
      if (!prog) {
        newCount++ // no progress row = never studied, always due
      } else if (prog.due_date <= today) {
        if (prog.state === 'in_progress') inProgressCount++
        else if (prog.state === 'review') reviewCount++
        // state='new' with a row shouldn't occur but treated as new above
      }
      // due_date > today → not due, skip
    }

    return {
      ...deck,
      card_count: deckCards.length,
      new_count: newCount,
      in_progress_count: inProgressCount,
      review_count: reviewCount,
    }
  })
}

export async function getDeck(deckId: string, userId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('decks')
    .select('*')
    .eq('id', deckId)
    .eq('owner_user_id', userId)
    .single()
  return data ?? null
}

export async function getDueCardsByDeck(deckId: string, userId: string) {
  const supabase = await createServerSupabaseClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: cards } = await supabase
    .from('cards')
    .select('*')
    .eq('deck_id', deckId)
    .order('order', { ascending: true })

  if (!cards?.length) return []

  const cardIds = cards.map((c) => c.id)

  const { data: progress } = await supabase
    .from('card_progress')
    .select('card_id, due_date')
    .eq('user_id', userId)
    .in('card_id', cardIds)

  const dueByCardId = new Map((progress ?? []).map((p) => [p.card_id, p.due_date]))

  return cards.filter((card) => {
    const dueDate = dueByCardId.get(card.id)
    return !dueDate || dueDate <= today // no progress = new = due; or due_date is today/past
  })
}

export async function getCardsByDeck(deckId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('cards')
    .select('*')
    .eq('deck_id', deckId)
    .order('order', { ascending: true })
  return data ?? []
}

export async function getCard(cardId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('cards')
    .select('*')
    .eq('id', cardId)
    .single()
  return data ?? null
}

export async function getDeckByShareToken(token: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('decks')
    .select('*')
    .eq('share_token', token)
    .eq('is_shared', true)
    .single()
  return data ?? null
}

export async function checkAlreadyImported(userId: string, sourceDeckId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('decks')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('original_deck_id', sourceDeckId)
    .maybeSingle()
  return data !== null
}

export type ActivityEntry = { date: string; cards_studied_count: number }

export async function getActivityLog(userId: string): Promise<ActivityEntry[]> {
  const supabase = await createServerSupabaseClient()

  const year = new Date().getFullYear()
  const { data } = await supabase
    .from('activity_log')
    .select('date, cards_studied_count')
    .eq('user_id', userId)
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`)
    .order('date', { ascending: true })

  return data ?? []
}
