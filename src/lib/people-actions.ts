'use server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

type Role = 'student' | 'instructor' | 'admin'

async function getAuthedInstructorOrAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
    return { error: 'Unauthorized' as const }
  }

  return { user, supabase }
}

export async function bulkAddPeopleToCourse(
  courseId: string,
  emails: string[],
  role: Role
): Promise<{ email: string; added?: boolean; invited?: boolean; error?: string }[]> {
  const auth = await getAuthedInstructorOrAdmin()
  if ('error' in auth) return emails.map(email => ({ email, error: auth.error }))

  const admin = createServiceSupabaseClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const results = await Promise.all(emails.map(async (email) => {
    const { data: existingUser } = await admin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      const { data: existing } = await admin
        .from('course_enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('user_id', existingUser.id)
        .maybeSingle()

      if (existing) return { email, error: 'Already enrolled' }

      const { error } = await admin
        .from('course_enrollments')
        .insert({ course_id: courseId, user_id: existingUser.id, role })

      if (error) return { email, error: error.message }
      return { email, added: true }
    }

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { course_id: courseId, role },
      redirectTo: `${appUrl}/accept-invite`,
    })

    if (inviteError) return { email, error: inviteError.message }

    const { error: insertError } = await admin
      .from('invitations')
      .insert({ course_id: courseId, email, role, invited_by: auth.user.id })

    if (insertError) return { email, error: insertError.message }
    return { email, invited: true }
  }))

  return results
}

export async function addPersonToCourse(
  courseId: string,
  email: string,
  role: Role
): Promise<{ added?: boolean; invited?: boolean; error?: string }> {
  const auth = await getAuthedInstructorOrAdmin()
  if ('error' in auth) return { error: auth.error }

  const admin = createServiceSupabaseClient()

  // Check if user already exists
  const { data: existingUser } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingUser) {
    // Check if already enrolled
    const { data: existing } = await admin
      .from('course_enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', existingUser.id)
      .maybeSingle()

    if (existing) return { error: 'This person is already enrolled in the course.' }

    const { error } = await admin
      .from('course_enrollments')
      .insert({ course_id: courseId, user_id: existingUser.id, role })

    if (error) return { error: error.message }
    return { added: true }
  }

  // New user — send invite
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { course_id: courseId, role },
    redirectTo: `${appUrl}/accept-invite`,
  })

  if (inviteError) return { error: inviteError.message }

  const { error: insertError } = await admin
    .from('invitations')
    .insert({ course_id: courseId, email, role, invited_by: auth.user.id })

  if (insertError) return { error: insertError.message }

  return { invited: true }
}

export async function resendInvite(
  invitationId: string
): Promise<{ error?: string }> {
  const auth = await getAuthedInstructorOrAdmin()
  if ('error' in auth) return { error: auth.error }

  const admin = createServiceSupabaseClient()

  const { data: invitation, error: fetchError } = await admin
    .from('invitations')
    .select('email, course_id, role')
    .eq('id', invitationId)
    .single()

  if (fetchError || !invitation) return { error: 'Invitation not found.' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(invitation.email, {
    data: { course_id: invitation.course_id, role: invitation.role },
    redirectTo: `${appUrl}/accept-invite`,
  })

  if (inviteError) return { error: inviteError.message }

  const { error: updateError } = await admin
    .from('invitations')
    .update({ resent_at: new Date().toISOString() })
    .eq('id', invitationId)

  if (updateError) return { error: updateError.message }

  return {}
}

export async function revokeInvite(
  invitationId: string
): Promise<{ error?: string }> {
  const auth = await getAuthedInstructorOrAdmin()
  if ('error' in auth) return { error: auth.error }

  const admin = createServiceSupabaseClient()
  const { error } = await admin
    .from('invitations')
    .delete()
    .eq('id', invitationId)

  if (error) return { error: error.message }
  return {}
}

export async function updateEnrollmentRole(
  courseId: string,
  userId: string,
  role: Role
): Promise<{ error?: string }> {
  const auth = await getAuthedInstructorOrAdmin()
  if ('error' in auth) return { error: auth.error }

  const admin = createServiceSupabaseClient()
  const { error } = await admin
    .from('course_enrollments')
    .update({ role })
    .eq('course_id', courseId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  return {}
}

export async function removePersonFromCourse(
  courseId: string,
  userId: string
): Promise<{ error?: string }> {
  const auth = await getAuthedInstructorOrAdmin()
  if ('error' in auth) return { error: auth.error }

  const admin = createServiceSupabaseClient()
  const { error } = await admin
    .from('course_enrollments')
    .delete()
    .eq('course_id', courseId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  return {}
}

export async function acceptInvite(
  name: string,
  password: string
): Promise<{ courseId?: string; role?: string; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Session not found. Please try clicking the invite link again.' }

  const admin = createServiceSupabaseClient()

  // Set password
  const { error: pwError } = await admin.auth.admin.updateUserById(user.id, { password })
  if (pwError) return { error: pwError.message }

  const role: Role = (user.user_metadata?.role as Role) ?? 'student'
  const courseId: string = user.user_metadata?.course_id

  // Upsert profile: always write name (user just entered it), preserve existing role if present
  const { data: existingProfile } = await admin
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  const profileRole = existingProfile?.role ?? role
  const { error: profileError } = await admin
    .from('users')
    .upsert({ id: user.id, email: user.email!, name, role: profileRole }, { onConflict: 'id' })
  if (profileError) return { error: profileError.message }

  // Enroll in course
  if (courseId) {
    const { error: enrollError } = await admin
      .from('course_enrollments')
      .insert({ course_id: courseId, user_id: user.id, role })

    // Ignore conflict if already enrolled
    if (enrollError && !enrollError.message.includes('duplicate')) {
      return { error: enrollError.message }
    }

    // Mark invitation as accepted
    await admin
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('email', user.email!)
      .eq('course_id', courseId)
  }

  return { courseId, role }
}
