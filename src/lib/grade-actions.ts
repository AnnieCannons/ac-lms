'use server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export async function saveGrade(
  submissionId: string,
  grade: 'complete' | 'incomplete' | null,
  gradedById: string
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createServiceSupabaseClient()
  const now = grade ? new Date().toISOString() : null
  const { error } = await admin
    .from('submissions')
    .update({
      grade,
      status: grade ? 'graded' : 'submitted',
      graded_at: now,
      graded_by: grade ? gradedById : null,
    })
    .eq('id', submissionId)

  if (error) return { error: error.message }
  return {}
}
