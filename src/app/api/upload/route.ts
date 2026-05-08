import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isStaff = profile?.role === 'instructor' || profile?.role === 'admin'

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const bucket = formData.get('bucket') as string | null
  const path = formData.get('path') as string | null

  if (!file || !bucket || !path) {
    return NextResponse.json({ error: 'Missing file, bucket, or path' }, { status: 400 })
  }

  // Students may only upload to lms-submissions, and only under their own user ID
  if (!isStaff) {
    if (bucket !== 'lms-submissions') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const segments = path.split('/')
    // Expected path format: assignmentId/userId/filename
    if (segments[1] !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const admin = createServiceSupabaseClient()
  const { error } = await admin.storage.from(bucket).upload(path, file, { upsert: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data } = admin.storage.from(bucket).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
