'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { getReadinessChain } from '@/lib/readiness-chain'

// Dated notes staff leave on a student's Weekly Readiness card. Staff-only unless the note
// is marked visible_to_student, in which case the student sees it on their own readiness
// page and can reply; staff can reply back in the same thread while the note stays shared.
// The tables have no RLS policies, so everything goes through the service client after the
// role check (or own-id scoping) below.

export type ReadinessNoteReply = {
  id: string
  body: string
  authorName: string | null
  /** Written by the student the note is about (rather than by staff). */
  fromStudent: boolean
  /** Written by the viewer. */
  mine: boolean
  createdAt: string
  updatedAt: string
  /** The viewer wrote it (edit + delete), or is an admin (delete only). */
  canEdit: boolean
  canDelete: boolean
}

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
  /** Oldest first. */
  replies: ReadinessNoteReply[]
  /** Replies are open only while the note is shared with the student. */
  canReply: boolean
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
/** Sent to the note's author when the student replies. */
const READINESS_NOTE_STUDENT_REPLY_TYPE = 'readiness_note_student_reply'
/** Sent to the student when staff reply on a note shared with them. */
const READINESS_NOTE_STAFF_REPLY_TYPE = 'readiness_note_staff_reply'

type Viewer = { userId: string; role: string }

type ReplyRow = {
  id: string
  note_id: string
  author_id: string | null
  body: string
  created_at: string
  updated_at: string
}

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

/** Takes the student's bell notifications for a note (shared, and staff replies) away once
 * they can no longer see the note. Staff's notifications about the student's replies stay. */
async function removeNoteNotification(admin: AdminClient, noteId: string, studentId: string) {
  const { error } = await admin.from('notifications').delete().eq('readiness_note_id', noteId).eq('user_id', studentId)
  if (error) console.error('readiness-notes: failed to remove bell notification', error)
}

/** Bell-only: a reply from the student goes to the note's author; a reply from staff goes to
 * the student. Linked to both the note and the reply, so it goes away with either. A failure
 * here never fails the save. */
async function notifyReply(
  admin: AdminClient,
  note: { id: string; student_id: string; course_id: string; author_id: string | null },
  replyId: string,
  me: Viewer,
) {
  const fromStudent = me.userId === note.student_id
  const recipient = fromStudent ? note.author_id : note.student_id
  if (!recipient || recipient === me.userId) return
  const { data: author } = await admin.from('users').select('name').eq('id', me.userId).maybeSingle()
  const name = (author as { name: string | null } | null)?.name?.trim()
  const { error } = await admin.from('notifications').insert({
    user_id: recipient,
    type: fromStudent ? READINESS_NOTE_STUDENT_REPLY_TYPE : READINESS_NOTE_STAFF_REPLY_TYPE,
    course_id: note.course_id,
    readiness_note_id: note.id,
    readiness_note_reply_id: replyId,
    message: fromStudent
      ? `${name || 'A student'} replied to your note on their Weekly Readiness.`
      : `${name || 'Your instructor'} replied to a note on your Weekly Readiness page.`,
  })
  if (error) console.error('readiness-notes: failed to insert reply notification', error)
}

async function getViewer(): Promise<Viewer | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!profile) return null
  return { userId: user.id, role: profile.role }
}

async function requireStaff(): Promise<Viewer | null> {
  const me = await getViewer()
  if (!me || !STAFF_ROLES.includes(me.role)) return null
  return me
}

function validateBody(body: string, label: string): string | null {
  const trimmed = body.trim()
  if (!trimmed) return `${label} can’t be empty.`
  if (trimmed.length > MAX_BODY) return `${label} is too long (max ${MAX_BODY} characters).`
  return null
}

function validate(noteDate: string, body: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate) || Number.isNaN(Date.parse(`${noteDate}T00:00:00Z`))) {
    return 'Please pick a date.'
  }
  return validateBody(body, 'Note')
}

async function fetchNotes(
  studentId: string,
  courseId: string,
  viewer: Viewer,
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

  const repliesByNote = new Map<string, ReplyRow[]>()
  if (rows.length > 0) {
    const { data: replyData } = await admin
      .from('readiness_note_replies')
      .select('id, note_id, author_id, body, created_at, updated_at')
      .in('note_id', rows.map(r => r.id))
      .order('created_at', { ascending: true })
    for (const reply of (replyData as ReplyRow[]) ?? []) {
      const list = repliesByNote.get(reply.note_id) ?? []
      list.push(reply)
      repliesByNote.set(reply.note_id, list)
    }
  }

  const authorIds = [...new Set(
    [...rows.map(r => r.author_id), ...[...repliesByNote.values()].flat().map(r => r.author_id)]
      .filter((id): id is string => !!id),
  )]
  const names = new Map<string, string>()
  if (authorIds.length > 0) {
    const { data: authors } = await admin.from('users').select('id, name').in('id', authorIds)
    for (const a of (authors as { id: string; name: string | null }[]) ?? []) {
      if (a.name) names.set(a.id, a.name)
    }
  }

  const isAdmin = viewer.role === 'admin'
  const toReply = (r: ReplyRow): ReadinessNoteReply => {
    const mine = r.author_id === viewer.userId
    return {
      id: r.id,
      body: r.body,
      authorName: r.author_id ? names.get(r.author_id) ?? null : null,
      fromStudent: r.author_id === studentId,
      mine,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      canEdit: mine,
      canDelete: mine || isAdmin,
    }
  }

  return rows.map(r => {
    const mine = r.author_id === viewer.userId
    return {
      id: r.id,
      noteDate: r.note_date,
      body: r.body,
      visibleToStudent: r.visible_to_student,
      authorName: r.author_id ? names.get(r.author_id) ?? null : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      canEdit: mine,
      canDelete: mine || isAdmin,
      replies: (repliesByNote.get(r.id) ?? []).map(toReply),
      canReply: r.visible_to_student,
    }
  })
}

/** Notes for a student across the readiness chain (so TCF notes carry into ITP), newest date first. */
export async function getReadinessNotes(studentId: string, courseId: string): Promise<ReadinessNote[]> {
  const me = await requireStaff()
  if (!me) throw new Error('Forbidden')
  return fetchNotes(studentId, courseId, me, false)
}

/** The signed-in student's own notes that staff chose to share with them, with their replies. */
export async function getMyReadinessNotes(courseId: string): Promise<ReadinessNote[]> {
  const me = await getViewer()
  if (!me) return []
  // Only the student's own role matters here: an admin's delete-any right is for the staff view.
  return fetchNotes(me.userId, courseId, { userId: me.userId, role: 'student' }, true)
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
    await removeNoteNotification(admin, input.id, prev.student_id)
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

type ReplyNote = { id: string; student_id: string; course_id: string; author_id: string | null; visible_to_student: boolean }

/** Staff, or the student the note is about, may reply -- only while the note is shared. */
function canReplyTo(me: Viewer, note: ReplyNote): boolean {
  return note.visible_to_student && (STAFF_ROLES.includes(me.role) || note.student_id === me.userId)
}

export async function addReadinessNoteReply(input: { noteId: string; body: string }): Promise<{ error?: string }> {
  const me = await getViewer()
  if (!me) return { error: 'Please sign in again.' }

  const invalid = validateBody(input.body, 'Reply')
  if (invalid) return { error: invalid }

  const admin = createServiceSupabaseClient()
  const { data: noteData } = await admin
    .from('readiness_notes')
    .select('id, student_id, course_id, author_id, visible_to_student')
    .eq('id', input.noteId)
    .maybeSingle()
  const note = noteData as ReplyNote | null
  if (!note || !canReplyTo(me, note)) return { error: 'You can’t reply to this note.' }

  const { data, error } = await admin.from('readiness_note_replies').insert({
    note_id: note.id,
    author_id: me.userId,
    body: input.body.trim(),
  }).select('id').single()
  if (error || !data) return { error: 'Couldn’t save the reply. Please try again.' }
  await notifyReply(admin, note, (data as { id: string }).id, me)
  return {}
}

export async function updateReadinessNoteReply(input: { id: string; body: string }): Promise<{ error?: string }> {
  const me = await getViewer()
  if (!me) return { error: 'Please sign in again.' }

  const invalid = validateBody(input.body, 'Reply')
  if (invalid) return { error: invalid }

  const admin = createServiceSupabaseClient()
  const { data: existing } = await admin
    .from('readiness_note_replies')
    .select('id, readiness_notes(id, student_id, course_id, author_id, visible_to_student)')
    .eq('id', input.id)
    .eq('author_id', me.userId)
    .maybeSingle()
  const note = (existing as { readiness_notes: ReplyNote | null } | null)?.readiness_notes ?? null
  if (!existing) return { error: 'Only the person who wrote a reply can edit it.' }
  if (!note || !canReplyTo(me, note)) return { error: 'This note isn’t shared anymore, so replies are closed.' }

  const { data, error } = await admin
    .from('readiness_note_replies')
    .update({ body: input.body.trim(), updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('author_id', me.userId)
    .select('id')
  if (error) return { error: 'Couldn’t save the reply. Please try again.' }
  if (!data || data.length === 0) return { error: 'Only the person who wrote a reply can edit it.' }
  return {}
}

export async function deleteReadinessNoteReply(id: string): Promise<{ error?: string }> {
  const me = await getViewer()
  if (!me) return { error: 'Please sign in again.' }

  const admin = createServiceSupabaseClient()
  let query = admin.from('readiness_note_replies').delete().eq('id', id)
  if (me.role !== 'admin') query = query.eq('author_id', me.userId)
  const { data, error } = await query.select('id')
  if (error) return { error: 'Couldn’t delete the reply. Please try again.' }
  if (!data || data.length === 0) return { error: 'Only the person who wrote a reply (or an admin) can delete it.' }
  return {}
}
