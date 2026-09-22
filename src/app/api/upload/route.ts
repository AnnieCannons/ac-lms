import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

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

  // Anyone may upload their own avatar, under their own user ID
  if (bucket === 'avatars') {
    const segments = path.split('/')
    // Expected path format: userId/filename
    if (segments[0] !== user.id) {
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

  const admin = createServiceSupabaseClient()
  const { data: signed, error } = await admin.storage.from(bucket).createSignedUploadUrl(path, { upsert: true })

  if (error || !signed) {
    return NextResponse.json({ error: error?.message ?? 'Could not prepare upload' }, { status: 500 })
  }

  const { data } = admin.storage.from(bucket).getPublicUrl(path)
  return NextResponse.json({ path: signed.path, token: signed.token, url: data.publicUrl })
}
