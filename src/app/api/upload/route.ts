import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { getCourseIdForModule, getCourseIdForModuleDay } from '@/lib/course-access'

const ALLOWED_BUCKETS = ['lms-submissions', 'lms-resources', 'avatars']
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/']
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
])

// Student submissions take raster images only: an SVG can carry script. Keep in sync
// with lms-submissions' allowed_mime_types (migration 20261015000000).
const SUBMISSION_IMAGE_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/avif',
])

function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_PREFIXES.some(p => mimeType.startsWith(p)) || ALLOWED_MIME_EXACT.has(mimeType)
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isStaff = profile?.role === 'instructor' || profile?.role === 'staff' || profile?.role === 'admin'

  // The file itself never passes through this route: Vercel rejects function
  // request bodies over 4.5 MB before our code runs. The client sends only the
  // file's metadata, we authorize it, and hand back a signed URL the browser
  // uploads to directly. Bucket-level file_size_limit / allowed_mime_types
  // (see migration 20260922000000) enforce the real size and type at storage.
  let body: { bucket?: unknown; path?: unknown; size?: unknown; type?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const bucket = typeof body.bucket === 'string' ? body.bucket : null
  const path = typeof body.path === 'string' ? body.path : null
  const size = typeof body.size === 'number' ? body.size : null
  const mimeType = typeof body.type === 'string' ? body.type : ''

  if (!bucket || !path || size === null) {
    return NextResponse.json({ error: 'Missing bucket, path, or size' }, { status: 400 })
  }

  // Reject unknown buckets for everyone
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Reject path traversal for everyone (raw and percent-encoded, either slash direction)
  if (path.includes('..') || path.includes('\\') || path.startsWith('/') || /%2e|%2f|%5c/i.test(path)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  // Enforce file size limit
  if (size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 20 MB limit' }, { status: 413 })
  }

  // Validate MIME type
  if (!isAllowedMimeType(mimeType)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 415 })
  }
  if (bucket === 'lms-submissions' && mimeType.startsWith('image/') && !SUBMISSION_IMAGE_TYPES.has(mimeType)) {
    return NextResponse.json({ error: 'Images must be PNG, JPG, GIF, WebP or HEIC.' }, { status: 415 })
  }

  // Anyone may upload their own avatar, under their own user ID
  if (bucket === 'avatars') {
    const segments = path.split('/')
    // Expected path format: userId/filename
    if (segments[0] !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (!isStaff && bucket === 'lms-resources') {
    // A TA may attach course files, but only for a course they TA. The course is
    // worked out from the path, never taken from the client as a separate field.
    const admin = createServiceSupabaseClient()
    const courseId = await courseIdForResourcePath(admin, path)
    if (!courseId || !(await isTaOf(admin, user.id, courseId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (!isStaff) {
    // Students may only upload to lms-submissions, and only under their own user ID
    if (bucket !== 'lms-submissions') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const segments = path.split('/')
    // Expected path format: assignmentId/userId/filename
    if (segments[1] !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (bucket !== 'lms-resources') {
    // Staff may only upload to lms-resources (or avatars, handled above)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Submission and resource files each get their own random folder and are never
  // overwritten: with upsert, a student could re-upload a same-named file after the
  // deadline (or after grading) and silently replace what was graded. The folder keeps
  // the file name itself unchanged, since the UI shows the URL's last segment.
  // Avatars keep their fixed, already-unique paths.
  const storagePath = bucket === 'avatars' ? path : uniqueUploadPath(path)

  const admin = createServiceSupabaseClient()
  const { data: signed, error } = await admin.storage
    .from(bucket)
    .createSignedUploadUrl(storagePath, { upsert: bucket === 'avatars' })

  if (error || !signed) {
    return NextResponse.json({ error: error?.message ?? 'Could not prepare upload' }, { status: 500 })
  }

  const { data } = admin.storage.from(bucket).getPublicUrl(storagePath)
  return NextResponse.json({ path: signed.path, token: signed.token, url: data.publicUrl })
}

/** `a/b/file.pdf` → `a/b/<random>/file.pdf` */
function uniqueUploadPath(path: string): string {
  const slash = path.lastIndexOf('/')
  const dir = slash === -1 ? '' : path.slice(0, slash + 1)
  return `${dir}${randomUUID().slice(0, 8)}/${path.slice(slash + 1)}`
}

type Admin = ReturnType<typeof createServiceSupabaseClient>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The course an lms-resources upload belongs to, from the path the Course Editor builds:
 * `module-day-<dayId>/…`, `module-<moduleId>/…`, `course-<courseId>/…` or
 * `quizzes/<courseId>/…`. Anything else (including `module-new/`) has no course.
 */
async function courseIdForResourcePath(admin: Admin, path: string): Promise<string | null> {
  const [first, second] = path.split('/')
  let m: RegExpMatchArray | null
  if ((m = first.match(/^module-day-(.+)$/)) && UUID.test(m[1])) return getCourseIdForModuleDay(admin, m[1])
  if ((m = first.match(/^module-(.+)$/)) && UUID.test(m[1])) return getCourseIdForModule(admin, m[1])
  if ((m = first.match(/^course-(.+)$/)) && UUID.test(m[1])) return m[1]
  if (first === 'quizzes' && second && UUID.test(second)) return second
  return null
}

async function isTaOf(admin: Admin, userId: string, courseId: string): Promise<boolean> {
  const { data } = await admin
    .from('course_enrollments')
    .select('role')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('role', 'ta')
    .maybeSingle()
  return !!data
}
