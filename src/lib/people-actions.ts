'use server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

type Role = 'student' | 'instructor' | 'admin' | 'observer' | 'ta'
const VALID_ROLES: Role[] = ['student', 'instructor', 'admin', 'observer', 'ta']

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

      // Sync users.role for instructor/admin so they appear in the Staff section
      if (role === 'instructor' || role === 'admin') {
        await admin.from('users').update({ role }).eq('id', existingUser.id)
      }

      return { email, added: true }
    }

    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { course_id: courseId, role },
      redirectTo: `${appUrl}/accept-invite`,
    })

    if (inviteError) return { email, error: inviteError.message }

    // Immediately enroll using the invited user's ID
    const invitedUserId = inviteData?.user?.id
    if (invitedUserId) {
      await admin.from('users').upsert(
        { id: invitedUserId, email, name: email, role: (role === 'instructor' || role === 'admin') ? role : 'student' },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      await admin.from('course_enrollments').upsert(
        { course_id: courseId, user_id: invitedUserId, role },
        { onConflict: 'course_id,user_id' }
      )
    }

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

    // Sync users.role for instructor/admin so they appear in the Staff section
    if (role === 'instructor' || role === 'admin') {
      await admin.from('users').update({ role }).eq('id', existingUser.id)
    }

    return { added: true }
  }

  // New user — send invite
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { course_id: courseId, role },
    redirectTo: `${appUrl}/accept-invite`,
  })

  if (inviteError) return { error: inviteError.message }

  // Immediately enroll using the invited user's ID so enrollment doesn't
  // depend on the user accepting first (the trigger may not have run yet,
  // so upsert the users row too).
  const invitedUserId = inviteData?.user?.id
  if (invitedUserId) {
    await admin.from('users').upsert(
      { id: invitedUserId, email, name: email, role: (role === 'instructor' || role === 'admin') ? role : 'student' },
      { onConflict: 'id', ignoreDuplicates: true }
    )
    await admin.from('course_enrollments').upsert(
      { course_id: courseId, user_id: invitedUserId, role },
      { onConflict: 'course_id,user_id' }
    )
  }

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

export async function updateUserRole(
  targetUserId: string,
  role: Role
): Promise<{ error?: string }> {
  if (!VALID_ROLES.includes(role)) return { error: 'Invalid role' }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createServiceSupabaseClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()

  // Only instructors and admins can change roles
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') return { error: 'Not authorized' }

  // Only admins can assign the admin role
  if (role === 'admin' && profile?.role !== 'admin') {
    return { error: 'Only admins can assign the admin role.' }
  }

  const { error } = await admin.from('users').update({ role }).eq('id', targetUserId)
  if (error) return { error: error.message }
  return {}
}

export async function updateEnrollmentRole(
  courseId: string,
  userId: string,
  role: Role
): Promise<{ error?: string }> {
  if (!VALID_ROLES.includes(role)) return { error: 'Invalid role' }

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

export async function deleteStaffMember(
  targetUserId: string
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createServiceSupabaseClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') return { error: 'Only admins can delete staff members.' }

  // Delete all enrollments first
  await admin.from('course_enrollments').delete().eq('user_id', targetUserId)

  // Delete from users table
  const { error } = await admin.from('users').delete().eq('id', targetUserId)
  if (error) return { error: error.message }

  return {}
}

export async function removeStudentUser(
  targetUserId: string
): Promise<{ error?: string }> {
  const auth = await getAuthedInstructorOrAdmin()
  if ('error' in auth) return { error: auth.error }

  const admin = createServiceSupabaseClient()

  // Remove all course enrollments
  await admin.from('course_enrollments').delete().eq('user_id', targetUserId)

  // Delete from users table
  await admin.from('users').delete().eq('id', targetUserId)

  // Delete from Supabase auth
  const { error } = await admin.auth.admin.deleteUser(targetUserId)
  if (error) return { error: error.message }

  return {}
}

export async function sendInviteToEnrolledUser(
  userId: string,
  courseId: string,
): Promise<{ error?: string }> {
  const auth = await getAuthedInstructorOrAdmin()
  if ('error' in auth) return { error: auth.error }

  const admin = createServiceSupabaseClient()

  const { data: userRecord } = await admin
    .from('users')
    .select('email')
    .eq('id', userId)
    .single()

  if (!userRecord?.email) return { error: 'User not found.' }

  const { data: course } = await admin
    .from('courses')
    .select('name')
    .eq('id', courseId)
    .single()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const courseMeta = { course_id: courseId, role: 'student', course_name: course?.name ?? '' }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(userRecord.email, {
    data: courseMeta,
    redirectTo: `${appUrl}/accept-invite`,
  })

  if (inviteError) {
    // Already a confirmed account — use password recovery flow instead
    const alreadyRegistered =
      inviteError.message.toLowerCase().includes('already been registered') ||
      inviteError.status === 422

    if (!alreadyRegistered) return { error: inviteError.message }

    // Stamp course metadata onto their auth user so /accept-invite can read it
    await admin.auth.admin.updateUserById(userId, { user_metadata: courseMeta })

    // Send a password-reset email that redirects to our setup page
    const { error: resetError } = await admin.auth.resetPasswordForEmail(userRecord.email, {
      redirectTo: `${appUrl}/accept-invite`,
    })
    if (resetError) return { error: resetError.message }
  }

  await admin
    .from('invitations')
    .insert({ course_id: courseId, email: userRecord.email, role: 'student', invited_by: auth.user.id })
    .select()

  return {}
}

export async function toggleInstructorCourse(
  instructorId: string,
  courseId: string,
  assign: boolean
): Promise<{ error?: string }> {
  const auth = await getAuthedInstructorOrAdmin()
  if ('error' in auth) return { error: auth.error }

  const admin = createServiceSupabaseClient()

  if (assign) {
    const { error } = await admin
      .from('course_enrollments')
      .upsert(
        { course_id: courseId, user_id: instructorId, role: 'instructor' },
        { onConflict: 'course_id,user_id' }
      )
    if (error) return { error: error.message }
  } else {
    const { error } = await admin
      .from('course_enrollments')
      .delete()
      .eq('course_id', courseId)
      .eq('user_id', instructorId)
    if (error) return { error: error.message }
  }

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

  // Use invite role if it's instructor/admin — the trigger defaults everyone to 'student'
  // so we must not let that override the actual intended role from the invite.
  const profileRole = (role === 'instructor' || role === 'admin')
    ? role
    : (existingProfile?.role ?? role)
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
