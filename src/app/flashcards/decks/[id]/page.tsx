import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getDeck, getCardsByDeck } from '@/lib/flashcards/queries'
import DeckPageClient from '@/components/flashcards/DeckPageClient'
import type { Card } from '@/lib/flashcards/seed'

export type SnapshotCard = {
  source_card_id: string
  front_content: string
  back_content: string
  card_type: string
}

export type DiffEntry =
  | { kind: 'new'; snapshot: SnapshotCard }
  | { kind: 'modified'; snapshot: SnapshotCard; importerCard: Card }
  | { kind: 'conflict'; snapshot: SnapshotCard; importerCard: Card }

export type PendingDiff = {
  notificationId: string
  entries: DiffEntry[]
}

function computeDiff(
  snapshots: SnapshotCard[],
  importerCards: Card[],
  deckCreatedAt: string,
): DiffEntry[] {
  const importerBySourceId = new Map(
    importerCards
      .filter(c => c.source_card_id)
      .map(c => [c.source_card_id!, c])
  )

  const entries: DiffEntry[] = []

  for (const snapshot of snapshots) {
    const importerCard = importerBySourceId.get(snapshot.source_card_id)

    if (!importerCard) {
      // Card added to original after import
      entries.push({ kind: 'new', snapshot })
      continue
    }

    const contentSame =
      importerCard.front_content === snapshot.front_content &&
      importerCard.back_content === snapshot.back_content

    if (contentSame) continue // already in sync, nothing to apply

    const importerModified = new Date(importerCard.updated_at) > new Date(deckCreatedAt)
    entries.push({
      kind: importerModified ? 'conflict' : 'modified',
      snapshot,
      importerCard,
    })
  }

  return entries
}

export default async function DeckPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ notification?: string }>
}) {
  const { id: deckId } = await params
  const { notification: notificationId } = await searchParams

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = ['instructor', 'staff', 'admin'].includes(profile?.role ?? '')

  const [deck, cards] = await Promise.all([
    getDeck(deckId, user.id),
    getCardsByDeck(deckId),
  ])

  if (!deck) notFound()

  // Detect unpushed changes for shared decks the user owns
  let hasUnpushedChanges = false
  if (deck.owner_user_id === user.id && deck.is_shared) {
    const serviceClient = createServiceSupabaseClient()

    const { data: importedDecks } = await serviceClient
      .from('decks')
      .select('id')
      .eq('original_deck_id', deckId)
      .neq('owner_user_id', user.id)

    if (importedDecks && importedDecks.length > 0) {
      const importedIds = importedDecks.map(d => d.id)
      const { data: lastNotif } = await serviceClient
        .from('notifications')
        .select('created_at')
        .eq('type', 'deck_updated')
        .in('deck_id', importedIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const lastPushDate = lastNotif?.created_at ?? null
      if (!lastPushDate) {
        hasUnpushedChanges = true
      } else {
        const maxCardUpdatedAt = cards.length > 0
          ? Math.max(...cards.map(c => new Date(c.updated_at).getTime()))
          : 0
        const deckUpdatedAt = new Date(deck.updated_at).getTime()
        const lastPushTime = new Date(lastPushDate).getTime()
        hasUnpushedChanges = maxCardUpdatedAt > lastPushTime || deckUpdatedAt > lastPushTime
      }
    }
  }

  let pendingDiff: PendingDiff | null = null

  if (notificationId) {
    // Find the most recent deck_updated notification for this deck
    const { data: latestNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'deck_updated')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (latestNotif && latestNotif.id !== notificationId) {
      // Clicked an older notification — redirect to the latest
      redirect(`/flashcards/decks/${deckId}?notification=${latestNotif.id}`)
    }

    const serviceClient = createServiceSupabaseClient()
    const { data: snapshots } = await serviceClient
      .from('deck_update_snapshots')
      .select('source_card_id, front_content, back_content, card_type')
      .eq('notification_id', notificationId)

    if (snapshots && snapshots.length > 0) {
      const entries = computeDiff(
        snapshots as SnapshotCard[],
        cards as Card[],
        deck.created_at,
      )
      pendingDiff = { notificationId, entries }
    } else {
      // Notification exists but no snapshots (or latest with everything already applied)
      pendingDiff = { notificationId, entries: [] }
    }
  }

  return (
    <DeckPageClient
      deckId={deckId}
      deck={deck}
      initialCards={cards}
      userId={user.id}
      pendingDiff={pendingDiff}
      isAdmin={isAdmin}
      hasUnpushedChanges={hasUnpushedChanges}
    />
  )
}
