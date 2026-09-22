import { createClient } from '@/lib/supabase/client'

export type UploadResult = { ok: true; url: string } | { ok: false; error: string }

/**
 * Upload a file to Supabase Storage directly from the browser.
 *
 * /api/upload authorizes the bucket/path/size/type and returns a signed upload
 * token; the file bytes then go straight to Supabase, bypassing Vercel's 4.5 MB
 * function body limit (which used to surface as a misleading "network error").
 */
export async function uploadFile(file: File, bucket: string, path: string): Promise<UploadResult> {
  let res: Response
  try {
    res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket, path, size: file.size, type: file.type }),
    })
  } catch {
    return { ok: false, error: 'network error. Please check your connection and try again.' }
  }

  // Non-JSON responses (e.g. a platform error page) shouldn't read as a network failure
  const json = await res.json().catch(() => null) as { error?: string; path?: string; token?: string; url?: string } | null
  if (!res.ok || !json || json.error || !json.token || !json.path || !json.url) {
    return { ok: false, error: json?.error ?? `upload failed (${res.status} ${res.statusText})` }
  }

  try {
    const { error } = await createClient()
      .storage.from(bucket)
      .uploadToSignedUrl(json.path, json.token, file, { contentType: file.type })
    if (error) {
      const msg = /exceed|too large|size/i.test(error.message) ? 'file is too large.' : error.message
      return { ok: false, error: msg }
    }
  } catch {
    return { ok: false, error: 'network error. Please check your connection and try again.' }
  }

  return { ok: true, url: json.url }
}
