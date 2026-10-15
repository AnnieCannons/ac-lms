'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { getReadinessChain } from '@/lib/readiness-chain'

// Dated notes staff leave on a student's Weekly Readiness card. Staff-only unless the note
// is marked visible_to_student, in which case the student sees it (read-only) on their own
// readiness page. The table has no RLS policies, so everything goes through the service
// client after the role check (or own-id scoping) below.

export type ReadinessNote = {
  id: string
  noteDate: string
  body: string
  visibleToStudent: boolean
  authorName: string | null
  createdAt: string
  updatedAt: string
  /** The viewer wrote it (edit + delete), or is an admin (delete only). */
  canEdit: boolean
  canDelete: boolean
}

type NoteRow = {
  id: string
  note_date: string
  body: string
  visible_to_student: boolean
  author_id: string | null
  created_at: string
  updated_at: string
}

const MAX_BODY = 5000
const STAFF_ROLES = ['instructor', 'staff', 'admin']
const READINESS_NOTE_SHARED_TYPE = 'readiness_note_shared'

type AdminClient = ReturnType<typeof createServiceSupabaseClient>

/** Bell-only (not in the digest email): tells the student a note was shared with them. Sent when
 * a note is saved as shared or switched from staff-only to shared, never on other edits. Linked
 * to the note, so it goes away when the note is unshared or deleted. A failure here never fails
 * the save. */
async function notifyNoteShared(
  admin: AdminClient,
  noteId: string,
  studentId: string,
  courseId: string,
  authorId: string,
) {
  const { data: author } = await admin.from('users').select('name').eq('id', authorId).maybeSingle()
  const who = (author as { name: string | null } | null)?.name?.trim() || 'Your instructor'
  const { error } = await admin.from('notifications').insert({
    user_id: studentId,
    type: READINESS_NOTE_SHARED_TYPE,
    course_id: courseId,
    readiness_note_id: noteId,
    message: `${who} shared a note with you on your Weekly Readiness page.`,
  })
  if (error) console.error('readiness-notes: failed to insert bell notification', error)
}

/** Takes a note's bell notification away once the student can no longer see the note. */
async function removeNoteNotification(admin: AdminClient, noteId: string) {
  const { error } = await admin.from('notifications').delete().eq('readiness_note_id', noteId)
  if (error) console.error('readiness-notes: failed to remove bell notification', error)
}

async function requireStaff(): Promise<{ userId: string; role: string } | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!profile || !STAFF_ROLES.includes(profile.role)) return null
  return { userId: user.id, role: profile.role }
}

function validate(noteDate: string, body: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate) || Number.isNaN(Date.parse(`${noteDate}T00:00:00Z`))) {
    return 'Please pick a date.'
  }
  const trimmed = body.trim()
  if (!trimmed) return 'Note can’t be empty.'
  if (trimmed.length > MAX_BODY) return `Note is too long (max ${MAX_BODY} characters).`
  return null
}

async function fetchNotes(
  studentId: string,
  courseId: string,
  viewer: { userId: string; role: string } | null,
  sharedOnly: boolean,
): Promise<ReadinessNote[]> {
  const admin = createServiceSupabaseClient()
  const chain = await getReadinessChain(admin, courseId)
  let query = admin
    .from('readiness_notes')
    .select('id, note_date, body, visible_to_student, author_id, created_at, updated_at')
    .eq('student_id', studentId)
    .in('course_id', chain)
  if (sharedOnly) query = query.eq('visible_to_student', true)
  const { data } = await query
    .order('note_date', { ascending: false })
    .order('created_at', { ascending: false })

  const rows = (data as NoteRow[]) ?? []
  const authorIds = [...new Set(rows.map(r => r.author_id).filter((id): id is string => !!id))]
  const names = new Map<string, string>()
  if (authorIds.length > 0) {
    const { data: authors } = await admin.from('users').select('id, name').in('id', authorIds)
    for (const a of (authors as { id: string; name: string | null }[]) ?? []) {
      if (a.name) names.set(a.id, a.name)
    }
  }

  return rows.map(r => {
    const mine = !!viewer && r.author_id === viewer.userId
    return {
      id: r.id,
      noteDate: r.note_date,
      body: r.body,
      visibleToStudent: r.visible_to_student,
      authorName: r.author_id ? names.get(r.author_id) ?? null : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      canEdit: mine,
      canDelete: mine || viewer?.role === 'admin',
    }
  })
}

/** Notes for a student across the readiness chain (so TCF notes carry into ITP), newest date first. */
export async function getReadinessNotes(studentId: string, courseId: string): Promise<ReadinessNote[]> {
  const me = await requireStaff()
  if (!me) throw new Error('Forbidden')
  return fetchNotes(studentId, courseId, me, false)
}

/** The signed-in student's own notes that staff chose to share with them. */
export async function getMyReadinessNotes(courseId: string): Promise<ReadinessNote[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  return fetchNotes(user.id, courseId, null, true)
}

export async function addReadinessNote(input: {
  studentId: string
  courseId: string
  noteDate: string
  body: string
  visibleToStudent: boolean
}): Promise<{ error?: string }> {
  const me = await requireStaff()
  if (!me) return { error: 'You don’t have permission to add notes.' }

  const invalid = validate(input.noteDate, input.body)
  if (invalid) return { error: invalid }

  const admin = createServiceSupabaseClient()
  const { data, error } = await admin.from('readiness_notes').insert({
    student_id: input.studentId,
    course_id: input.courseId,
    note_date: input.noteDate,
    body: input.body.trim(),
    visible_to_student: input.visibleToStudent === true,
    author_id: me.userId,
  }).select('id').single()
  if (error || !data) return { error: 'Couldn’t save the note. Please try again.' }
  if (input.visibleToStudent === true) {
    await notifyNoteShared(admin, (data as { id: string }).id, input.studentId, input.courseId, me.userId)
  }
  return {}
}

export async function updateReadinessNote(input: {
  id: string
  noteDate: string
  body: string
  visibleToStudent: boolean
}): Promise<{ error?: string }> {
  const me = await requireStaff()
  if (!me) return { error: 'You don’t have permission to edit notes.' }

  const invalid = validate(input.noteDate, input.body)
  if (invalid) return { error: invalid }

  const admin = createServiceSupabaseClient()
  const { data: before } = await admin
    .from('readiness_notes')
    .select('student_id, course_id, visible_to_student')
    .eq('id', input.id)
    .eq('author_id', me.userId)
    .maybeSingle()
  const { data, error } = await admin
    .from('readiness_notes')
    .update({ note_date: input.noteDate, body: input.body.trim(), visible_to_student: input.visibleToStudent === true, updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('author_id', me.userId)
    .select('id')
  if (error) return { error: 'Couldn’t save the note. Please try again.' }
  if (!data || data.length === 0) return { error: 'Only the person who wrote a note can edit it.' }
  const prev = before as { student_id: string; course_id: string; visible_to_student: boolean } | null
  if (prev && !prev.visible_to_student && input.visibleToStudent === true) {
    await notifyNoteShared(admin, input.id, prev.student_id, prev.course_id, me.userId)
  } else if (prev?.visible_to_student && input.visibleToStudent !== true) {
    await removeNoteNotification(admin, input.id)
  }
  return {}
}

export async function deleteReadinessNote(id: string): Promise<{ error?: string }> {
  const me = await requireStaff()
  if (!me) return { error: 'You don’t have permission to delete notes.' }

  const admin = createServiceSupabaseClient()
  let query = admin.from('readiness_notes').delete().eq('id', id)
  if (me.role !== 'admin') query = query.eq('author_id', me.userId)
  const { data, error } = await query.select('id')
  if (error) return { error: 'Couldn’t delete the note. Please try again.' }
  if (!data || data.length === 0) return { error: 'Only the person who wrote a note (or an admin) can delete it.' }
  return {}
}
