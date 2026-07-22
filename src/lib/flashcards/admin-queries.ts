'use server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'

export type StudentActivityRow = {
  userId: string
  name: string
  cardsStudied: number
  daysActive: number
  mostStudiedDecks: string[]
}

export async function getStudentActivity(
  courseId: string,
  fromDate: string,
  toDate: string
): Promise<StudentActivityRow[]> {
  const service = createServiceSupabaseClient()

  // Get all students enrolled in this course
  const { data: enrollments } = await service
    .from('course_enrollments')
    .select('user_id')
    .eq('course_id', courseId)
    .eq('role', 'student')

  if (!enrollments?.length) return []

  const studentIds = enrollments.map(e => e.user_id)

  // Get user names
  const { data: users } = await service
    .from('users')
    .select('id, name')
    .in('id', studentIds)

  const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u.name ?? 'Unknown']))

  // Get cards studied + deck breakdown from study_sessions in date range
  const { data: sessions } = await service
    .from('study_sessions')
    .select('user_id, deck_id, cards_studied, started_at')
    .in('user_id', studentIds)
    .gte('started_at', `${fromDate}T00:00:00`)
    .lte('started_at', `${toDate}T23:59:59`)

  // Get days active from activity_log in date range
  const { data: activityRows } = await service
    .from('activity_log')
    .select('user_id, date')
    .in('user_id', studentIds)
    .gte('date', fromDate)
    .lte('date', toDate)

  // Get deck titles for most-studied calculation
  const deckIds = [...new Set((sessions ?? []).map(s => s.deck_id))]
  const { data: decks } = deckIds.length > 0
    ? await service.from('decks').select('id, title').in('id', deckIds)
    : { data: [] }
  const deckTitleMap = Object.fromEntries((decks ?? []).map(d => [d.id, d.title]))

  // Aggregate per student
  return studentIds.map(userId => {
    const userSessions = (sessions ?? []).filter(s => s.user_id === userId)
    const cardsStudied = userSessions.reduce((sum, s) => sum + (s.cards_studied ?? 0), 0)

    const daysActive = new Set(
      (activityRows ?? []).filter(a => a.user_id === userId).map(a => a.date)
    ).size

    // Sum cards_studied per deck, find max
    const deckTotals: Record<string, number> = {}
    for (const s of userSessions) {
      deckTotals[s.deck_id] = (deckTotals[s.deck_id] ?? 0) + (s.cards_studied ?? 0)
    }
    const maxCards = Math.max(0, ...Object.values(deckTotals))
    const mostStudiedDecks = maxCards > 0
      ? Object.entries(deckTotals)
          .filter(([, count]) => count === maxCards)
          .map(([deckId]) => deckTitleMap[deckId] ?? 'Unknown deck')
      : []

    return {
      userId,
      name: userMap[userId] ?? 'Unknown',
      cardsStudied,
      daysActive,
      mostStudiedDecks,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
}

export type Importer = {
  userId: string
  name: string
  courseIds: string[]
}

export type ImportActivity = {
  totalCount: number
  lastPushDate: string | null
  importers: Importer[]
}

export async function getImportActivity(deckId: string): Promise<ImportActivity> {
  const service = createServiceSupabaseClient()

  // Get all imported decks (other users who imported this deck)
  const { data: importedDecks } = await service
    .from('decks')
    .select('owner_user_id')
    .eq('original_deck_id', deckId)

  if (!importedDecks?.length) return { totalCount: 0, lastPushDate: null, importers: [] }

  const importerIds = [...new Set(importedDecks.map(d => d.owner_user_id))]

  // Get importer names
  const { data: users } = await service
    .from('users')
    .select('id, name')
    .in('id', importerIds)

  // Get course enrollments for importers
  const { data: enrollments } = await service
    .from('course_enrollments')
    .select('user_id, course_id')
    .in('user_id', importerIds)
    .eq('role', 'student')

  const coursesByUser: Record<string, string[]> = {}
  for (const e of (enrollments ?? [])) {
    if (!coursesByUser[e.user_id]) coursesByUser[e.user_id] = []
    coursesByUser[e.user_id].push(e.course_id)
  }

  const importers: Importer[] = (users ?? []).map(u => ({
    userId: u.id,
    name: u.name ?? 'Unknown',
    courseIds: coursesByUser[u.id] ?? [],
  })).sort((a, b) => a.name.localeCompare(b.name))

  // Last push date: most recent deck_updated notification sent to importers of this deck
  // notifications.deck_id = the importer's copy, so we look up all imported deck ids first
  const { data: allImportedDecks } = await service
    .from('decks')
    .select('id')
    .eq('original_deck_id', deckId)

  const importedDeckIds = (allImportedDecks ?? []).map(d => d.id)

  let lastPushDate: string | null = null
  if (importedDeckIds.length > 0) {
    const { data: notifications } = await service
      .from('notifications')
      .select('created_at')
      .eq('type', 'deck_updated')
      .in('deck_id', importedDeckIds)
      .order('created_at', { ascending: false })
      .limit(1)
    lastPushDate = notifications?.[0]?.created_at ?? null
  }

  return { totalCount: importerIds.length, lastPushDate, importers }
}

export type MostStudiedDeck = {
  deckId: string
  title: string
  tags: string[]
  totalReviews: number
}

export async function getMostStudiedDecks(
  courseId: string,
  fromDate: string,
  toDate: string,
  limit: number = 5
): Promise<MostStudiedDeck[]> {
  const service = createServiceSupabaseClient()

  // Get all students enrolled in this course
  const { data: enrollments } = await service
    .from('course_enrollments')
    .select('user_id')
    .eq('course_id', courseId)
    .eq('role', 'student')

  if (!enrollments?.length) return []

  const studentIds = enrollments.map(e => e.user_id)

  // Get all study sessions for these students in the date range
  const { data: sessions } = await service
    .from('study_sessions')
    .select('deck_id, cards_studied')
    .in('user_id', studentIds)
    .gte('started_at', `${fromDate}T00:00:00`)
    .lte('started_at', `${toDate}T23:59:59`)

  if (!sessions?.length) return []

  // Sum reviews per deck
  const deckTotals: Record<string, number> = {}
  for (const s of sessions) {
    deckTotals[s.deck_id] = (deckTotals[s.deck_id] ?? 0) + (s.cards_studied ?? 0)
  }

  // Sort by total reviews descending, take top N
  const topDeckIds = Object.entries(deckTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([id]) => id)

  if (!topDeckIds.length) return []

  // Fetch deck titles — skip deleted decks (null result)
  const { data: decks } = await service
    .from('decks')
    .select('id, title, tags')
    .in('id', topDeckIds)

  const deckMap = Object.fromEntries((decks ?? []).map(d => [d.id, d]))

  return topDeckIds
    .filter(id => deckMap[id]) // skip deleted decks
    .map(id => ({
      deckId: id,
      title: deckMap[id].title,
      tags: deckMap[id].tags ?? [],
      totalReviews: deckTotals[id],
    }))
}
