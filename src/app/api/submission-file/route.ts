import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { getAssignmentCourseId } from '@/lib/course-scope'
import { SUBMISSIONS_BUCKET, isSafeStoragePath, parseFileUrls, submissionFilePath } from '@/lib/submission-files'

// Long enough for a big file to start downloading; every page view asks again.
const SIGNED_URL_TTL_SECONDS = 5 * 60

const NO_STORE = { 'Cache-Control': 'private, no-store' }

function notFound() {
  // Same answer for "doesn't exist" and "not yours", so the route can't be used
  // to probe which files exist.
  return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })
}

/**
 * Serves a file from the private lms-submissions bucket. Allowed callers:
 * the student who submitted it, global staff (instructor/staff/admin), or a TA
 * enrolled in the assignment's course. On success, redirects to a short-lived
 * signed URL, so a copied link stops working for anyone else.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE })

  const path = request.nextUrl.searchParams.get('path') ?? ''
  if (!isSafeStoragePath(path)) return notFound()
  // Paths are "assignmentId/studentId/fileName" (enforced by /api/upload)
  const [assignmentId, ownerId] = path.split('/')
  if (!assignmentId || !ownerId) return notFound()

  const admin = createServiceSupabaseClient()
  if (!(await canViewSubmissionFile(admin, user.id, path, assignmentId, ownerId))) return notFound()

  const { data, error } = await admin.storage.from(SUBMISSIONS_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) return notFound()

  return NextResponse.redirect(data.signedUrl, { status: 302, headers: NO_STORE })
}

async function canViewSubmissionFile(
  admin: ReturnType<typeof createServiceSupabaseClient>,
  userId: string,
  path: string,
  assignmentId: string,
  ownerId: string,
): Promise<boolean> {
  // The student who uploaded it (upload route only lets students write under their own id)
  if (ownerId === userId) return true

  const { data: profile } = await admin.from('users').select('role').eq('id', userId).maybeSingle()
  if (['instructor', 'staff', 'admin'].includes(profile?.role ?? '')) return true

  // TA — only for the course this assignment actually belongs to
  const courseId = await getAssignmentCourseId(admin, assignmentId)
  if (courseId) {
    const { data: enrollment } = await admin
      .from('course_enrollments')
      .select('role')
      .eq('course_id', courseId)
      .eq('user_id', userId)
      .maybeSingle()
    if (enrollment?.role === 'ta') return true
  }

  // A handful of older rows reference a file stored under a different student's
  // folder. The student whose submission it's attached to may still see it.
  const [{ data: subs }, { data: history }] = await Promise.all([
    admin.from('submissions').select('content').eq('assignment_id', assignmentId).eq('student_id', userId).eq('submission_type', 'file'),
    admin.from('submission_history').select('content').eq('assignment_id', assignmentId).eq('student_id', userId).eq('submission_type', 'file'),
  ])
  return [...(subs ?? []), ...(history ?? [])].some(row =>
    parseFileUrls(row.content as string | null).some(entry => submissionFilePath(entry) === path),
  )
}
