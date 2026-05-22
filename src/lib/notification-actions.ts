'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export type Notification = {
  id: string
  type: string
  course_id: string | null
  assignment_id: string | null
  extension_request_id: string | null
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
    .select('id, type, course_id, assignment_id, extension_request_id, message, read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  return (data ?? []) as Notification[]
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
    .select('id, type, course_id, assignment_id, extension_request_id, message, read, created_at')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
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
    .eq('read', false)

  return count ?? 0
}
