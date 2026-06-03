'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireStaffOrAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const, supabase: null, user: null }

  const { data: profile } = await supabase
    .from('users')
    .select('role, name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'staff' && profile?.role !== 'admin') {
    return { error: 'Not authorized' as const, supabase: null, user: null }
  }

  return { error: null, supabase, user: { ...user, name: profile.name as string } }
}

// ─── Students ────────────────────────────────────────────────────────────────

export async function getStudentCurrentCourse(studentUserId: string): Promise<string | null> {
  const supabase = createServiceSupabaseClient()

  const { data } = await supabase
    .from('course_enrollments')
    .select('courses(title, start_date)')
    .eq('user_id', studentUserId)
    .eq('role', 'student')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  const course = Array.isArray(data.courses) ? data.courses[0] : data.courses
  return (course as { title: string } | null)?.title ?? null
}

export async function listStudents() {
  // Use service role client to bypass RLS — the calling page already enforces staff/admin auth
  const supabase = createServiceSupabaseClient()

  const { data, error: dbError } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('role', 'student')
    .order('name')

  if (dbError) return { error: dbError.message, students: [] as { id: string; name: string; email: string }[] }
  return {
    error: null,
    students: (data ?? []) as { id: string; name: string; email: string }[],
  }
}

// ─── Ratings ─────────────────────────────────────────────────────────────────

export interface RatingFormData {
  partner_id: string
  referral_id?: string | null
  service_category: string
  score: number
  notes?: string | null
  reviewer_type: 'student' | 'staff'
}

export async function createRating(data: RatingFormData) {
  const supabaseClient = await createServerSupabaseClient()
  const { data: { user } } = await supabaseClient.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Staff ratings require staff/admin role; student ratings require student role
  const { data: profile } = await supabaseClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'User not found' }

  if (data.reviewer_type === 'staff' && profile.role !== 'staff' && profile.role !== 'admin') {
    return { error: 'Not authorized' }
  }
  if (data.reviewer_type === 'student' && profile.role !== 'student') {
    return { error: 'Not authorized' }
  }

  if (data.score < 1 || data.score > 5) return { error: 'Score must be between 1 and 5' }

  const { error: dbError } = await supabaseClient.from('partner_ratings').insert({
    partner_id: data.partner_id,
    referral_id: data.referral_id ?? null,
    service_category: data.service_category,
    score: data.score,
    notes: data.notes ?? null,
    reviewer_id: user.id,
    reviewer_type: data.reviewer_type,
  })

  if (dbError) return { error: dbError.message }

  revalidatePath('/instructor/partnerships/referrals')
  revalidatePath('/instructor/partnerships/referrals/submissions')
  revalidatePath(`/instructor/partnerships/${data.partner_id}`)
  return { error: null }
}

// ─── Get ratings for a partner ────────────────────────────────────────────────

export interface PartnerRatingGroup {
  service_category: string
  avg: number
  count: number
}

export async function getPartnerRatings(partnerId: string) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error, ratings: [] as PartnerRatingGroup[] }

  const { data, error: dbError } = await supabase
    .from('partner_ratings')
    .select('service_category, score')
    .eq('partner_id', partnerId)

  if (dbError) return { error: dbError.message, ratings: [] as PartnerRatingGroup[] }

  const rows = data ?? []

  // Group by service_category
  const groups: Record<string, number[]> = {}
  for (const row of rows) {
    const cat = row.service_category ?? 'General'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(row.score)
  }

  const ratings: PartnerRatingGroup[] = Object.entries(groups).map(([service_category, scores]) => ({
    service_category,
    avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    count: scores.length,
  }))

  return { error: null, ratings }
}

// ─── Get ratings for a referral ───────────────────────────────────────────────

export async function getRatingsForReferral(referralId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', ratings: [] }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  // Staff/admin can see all; students can only see their own referral's ratings
  let query = supabase
    .from('partner_ratings')
    .select(`
      id, service_category, score, notes, reviewer_type, created_at,
      reviewer_id,
      users!partner_ratings_reviewer_id_fkey (name)
    `)
    .eq('referral_id', referralId)
    .order('created_at', { ascending: false })

  if (profile?.role === 'student') {
    // Verify the referral belongs to this student
    const { data: referral } = await supabase
      .from('student_referrals')
      .select('id, student_user_id')
      .eq('id', referralId)
      .single()

    if (!referral || referral.student_user_id !== user.id) {
      return { error: 'Not authorized', ratings: [] }
    }
  } else if (profile?.role !== 'staff' && profile?.role !== 'admin') {
    return { error: 'Not authorized', ratings: [] }
  }

  const { data, error: dbError } = await query
  if (dbError) return { error: dbError.message, ratings: [] }
  return { error: null, ratings: data ?? [] }
}

// ─── Mark rating request sent ─────────────────────────────────────────────────

export async function markRatingRequestSent(referralId: string) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase
    .from('student_referrals')
    .update({ rating_request_sent_at: new Date().toISOString() })
    .eq('id', referralId)

  if (dbError) return { error: dbError.message }

  revalidatePath('/instructor/partnerships/referrals')
  return { error: null }
}

// ─── List all ratings (for submissions page) ──────────────────────────────────

export interface RatingSubmission {
  id: string
  service_category: string
  score: number
  notes: string | null
  reviewer_type: 'student' | 'staff'
  created_at: string
  partner_id: string
  referral_id: string | null
  partners: { name: string } | null
  reviewer: { name: string } | null
}

export async function listAllRatings() {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error, ratings: [] as RatingSubmission[] }

  const { data, error: dbError } = await supabase
    .from('partner_ratings')
    .select(`
      id, service_category, score, notes, reviewer_type, created_at,
      partner_id, referral_id,
      partners (name),
      users!partner_ratings_reviewer_id_fkey (name)
    `)
    .order('created_at', { ascending: false })

  if (dbError) return { error: dbError.message, ratings: [] as RatingSubmission[] }

  const ratings = (data ?? []).map(row => ({
    id: row.id,
    service_category: row.service_category,
    score: row.score,
    notes: row.notes,
    reviewer_type: row.reviewer_type as 'student' | 'staff',
    created_at: row.created_at,
    partner_id: row.partner_id,
    referral_id: row.referral_id,
    partners: Array.isArray(row.partners) ? (row.partners[0] ?? null) : row.partners,
    reviewer: Array.isArray((row as Record<string, unknown>)['users'])
      ? (((row as Record<string, unknown>)['users'] as { name: string }[])[0] ?? null)
      : ((row as Record<string, unknown>)['users'] as { name: string } | null),
  }))

  return { error: null, ratings }
}
