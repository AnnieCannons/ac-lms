'use server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export async function toggleResourceStar(resourceId: string, courseId: string, isStarred: boolean): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createServiceSupabaseClient()
  if (isStarred) {
    const { error } = await admin.from('resource_stars').delete().eq('user_id', user.id).eq('resource_id', resourceId)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('resource_stars').insert({ user_id: user.id, resource_id: resourceId })
    if (error) return { error: error.message }
  }

  revalidatePath(`/student/courses/${courseId}`)
  revalidatePath(`/student/courses/${courseId}/class-resources`)
  return {}
}

export async function toggleResourceComplete(resourceId: string, courseId: string, isCompleted: boolean): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createServiceSupabaseClient()
  if (isCompleted) {
    const { error } = await admin.from('resource_completions').delete().eq('user_id', user.id).eq('resource_id', resourceId)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('resource_completions').insert({ user_id: user.id, resource_id: resourceId })
    if (error) return { error: error.message }
  }

  revalidatePath(`/student/courses/${courseId}`)
  revalidatePath(`/student/courses/${courseId}/class-resources`)
  return {}
}
