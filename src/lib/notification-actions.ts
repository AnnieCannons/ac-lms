'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export type Notification = {
  id: string
  type: string
  course_id: string | null
  assignment_id: string | null
  extension_request_id: string | null
  deck_id: string | null
  cutting_edge_event_id?: string | null
  readiness_note_id?: string | null
  /** For a student's reply on a readiness note: whose page the staff bell links to. */
  readiness_note_student_id?: string | null
  message: string
  read: boolean
  created_at: string
}

export async function getMyNotifications(): Promise<Notification[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createServiceSupabaseClient()
  const { data } = await admin
    .from('notifications')
    .select('id, type, course_id, assignment_id, extension_request_id, deck_id, cutting_edge_event_id, readiness_note_id, message, read, created_at')
    .eq('user_id', user.id)
    .is('cleared_at', null)
    .order('created_at', { ascending: false })
    .limit(30)

  const rows = (data ?? []) as Notification[]

  // A student's reply links staff to that student's page, so look up whose note it was.
  const replyNoteIds = [...new Set(rows
    .filter(n => n.type === 'readiness_note_student_reply' && n.readiness_note_id)
    .map(n => n.readiness_note_id as string))]
  if (replyNoteIds.length === 0) return rows
  const { data: notes } = await admin.from('readiness_notes').select('id, student_id').in('id', replyNoteIds)
  const studentByNote = new Map(((notes ?? []) as { id: string; student_id: string }[]).map(r => [r.id, r.student_id]))
  return rows.map(n => n.readiness_note_id && studentByNote.has(n.readiness_note_id)
    ? { ...n, readiness_note_student_id: studentByNote.get(n.readiness_note_id) }
    : n)
}

// "Clear" hides a notification from the bell without deleting it, so anything that reads
// notifications elsewhere (the digest email, for one) is unaffected.
export async function clearNotification(notificationId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ cleared_at: new Date().toISOString(), read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id)
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id)
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false)
}

export async function getInstructorNotifications(courseId: string): Promise<Notification[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createServiceSupabaseClient()
  const { data } = await admin
    .from('notifications')
    .select('id, type, course_id, assignment_id, extension_request_id, deck_id, cutting_edge_event_id, message, read, created_at')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .is('cleared_at', null)
    .order('created_at', { ascending: false })
    .limit(30)

  return (data ?? []) as Notification[]
}

export async function getInstructorUnreadCount(courseId: string): Promise<number> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const admin = createServiceSupabaseClient()
  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .is('cleared_at', null)
    .eq('read', false)

  return count ?? 0
}
