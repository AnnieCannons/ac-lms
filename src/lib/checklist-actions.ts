'use server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export async function toggleStudentChecklistItem(
  checklistItemId: string,
  studentId: string,
  checked: boolean
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== studentId) return { error: 'Not authorized' }

  const admin = createServiceSupabaseClient()
  const { error } = await admin
    .from('student_checklist_progress')
    .upsert(
      { student_id: studentId, checklist_item_id: checklistItemId, checked, updated_at: new Date().toISOString() },
      { onConflict: 'student_id,checklist_item_id' }
    )

  if (error) return { error: error.message }
  return {}
}
