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

  const [deck, cards] = await Promise.all([
    getDeck(deckId, user.id),
    getCardsByDeck(deckId),
  ])

  if (!deck) notFound()

  let pendingDiff: PendingDiff | null = null

  if (notificationId) {
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
    }
  }

  return (
    <DeckPageClient
      deckId={deckId}
      deck={deck}
      initialCards={cards}
      userId={user.id}
      pendingDiff={pendingDiff}
    />
  )
}
