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
