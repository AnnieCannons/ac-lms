import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { isStudentPreview } from '@/lib/student-preview'
import { getImpersonation, type ImpersonationData } from '@/lib/impersonate'

export type StudentCourseViewer = {
  /** RLS-scoped client for the logged-in user — fine for course content */
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
  /**
   * Client for reading the viewed student's own rows (submissions, stars, quiz
   * attempts…). The service client while an admin is viewing as a student, since RLS
   * would otherwise scope those reads to the admin; the RLS client otherwise.
   */
  studentDb: Awaited<ReturnType<typeof createServerSupabaseClient>> | ReturnType<typeof createServiceSupabaseClient>
  /** The logged-in user (the admin, while viewing as a student) */
  userId: string
  profile: { name: string | null; role: string | null } | null
  /** Whose data the page shows: the impersonated student, or the logged-in user */
  viewerId: string
  /** Name and role to show in the top nav */
  viewerName: string | null
  viewerRole: string | null
  /** An instructor previewing their own course as a student (no real student data) */
  preview: boolean
  /** An admin viewing a real student's pages ("View as Student") */
  impersonation: ImpersonationData | null
  /** Nothing on the page may act on anyone's behalf (true while viewing as a student) */
  readOnly: boolean
  /** The viewed student's enrollment role in this course, or null in preview */
  enrollmentRole: string | null
}

/**
 * The shared access check for every /student/courses/[id]/* page: requires a login,
 * sends staff to the instructor view unless they're previewing the course or an admin
 * is viewing as a student, and requires the viewed student to be enrolled.
 *
 * `allowStaffTa`: instructors/admins who are also a TA in this course may see the page
 * as themselves (Benefits, PTO).
 */
export async function getStudentCourseViewer(
  courseId: string,
  { allowStaffTa = false }: { allowStaffTa?: boolean } = {},
): Promise<StudentCourseViewer> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  // getImpersonation itself verifies the caller is an admin
  const impersonation = await getImpersonation()
  const preview = !impersonation && await isStudentPreview(courseId)
  const isStaff = profile?.role === 'instructor' || profile?.role === 'admin'

  const viewerId = impersonation?.userId ?? user.id
  const studentDb = impersonation ? createServiceSupabaseClient() : supabase

  const { data: enrollment } = preview
    ? { data: null }
    : await studentDb
        .from('course_enrollments')
        .select('role')
        .eq('user_id', viewerId)
        .eq('course_id', courseId)
        .in('role', ['student', 'observer', 'ta'])
        .maybeSingle()

  if (isStaff && !preview && !impersonation && !(allowStaffTa && enrollment?.role === 'ta')) {
    redirect(`/instructor/courses/${courseId}`)
  }
  if (!preview && !enrollment) {
    // A "view as" cookie left over from a different course lands back on this course's instructor view
    redirect(impersonation ? `/instructor/courses/${courseId}` : '/student/courses')
  }

  return {
    supabase,
    studentDb,
    userId: user.id,
    profile,
    viewerId,
    viewerName: impersonation?.studentName ?? profile?.name ?? null,
    viewerRole: impersonation ? (enrollment?.role ?? 'student') : profile?.role ?? null,
    preview,
    impersonation,
    readOnly: !!impersonation,
    enrollmentRole: enrollment?.role ?? null,
  }
}
