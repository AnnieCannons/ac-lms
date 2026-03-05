'use server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function toggleResourceStar(resourceId: string, courseId: string, isStarred: boolean) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  if (isStarred) {
    await supabase.from('resource_stars').delete().eq('user_id', user.id).eq('resource_id', resourceId)
  } else {
    await supabase.from('resource_stars').insert({ user_id: user.id, resource_id: resourceId })
  }

  revalidatePath(`/student/courses/${courseId}`)
  revalidatePath(`/student/courses/${courseId}/class-resources`)
}

export async function toggleResourceComplete(resourceId: string, courseId: string, isCompleted: boolean) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  if (isCompleted) {
    await supabase.from('resource_completions').delete().eq('user_id', user.id).eq('resource_id', resourceId)
  } else {
    await supabase.from('resource_completions').insert({ user_id: user.id, resource_id: resourceId })
  }

  revalidatePath(`/student/courses/${courseId}`)
  revalidatePath(`/student/courses/${courseId}/class-resources`)
}
