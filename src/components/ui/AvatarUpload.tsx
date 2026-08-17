'use client'
import { useRef, useState } from 'react'
import UserAvatar from '@/components/ui/UserAvatar'

const MAX_SIZE_MB = 5
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export default function AvatarUpload({
  userId,
  name,
  avatarUrl,
  onSave,
}: {
  userId: string
  name: string
  avatarUrl?: string | null
  onSave: (url: string) => Promise<{ error?: string }>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null | undefined>(avatarUrl)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (inputRef.current) inputRef.current.value = ''

    setMsg(null)
    if (!ALLOWED_TYPES.includes(file.type)) {
      setMsg({ text: 'Please choose a JPG, PNG, or WebP image.', ok: false })
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setMsg({ text: `Image exceeds ${MAX_SIZE_MB}MB limit.`, ok: false })
      return
    }

    setUploading(true)
    const ext = EXT_BY_TYPE[file.type]
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', 'avatars')
    formData.append('path', `${userId}/avatar-${Date.now()}.${ext}`)

    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const json = await res.json()

    if (!res.ok || json.error) {
      setMsg({ text: `Upload failed: ${json.error ?? res.statusText}`, ok: false })
      setUploading(false)
      return
    }

    const { error } = await onSave(json.url)
    if (error) {
      setMsg({ text: error, ok: false })
    } else {
      setPreview(json.url)
      setMsg({ text: 'Photo updated.', ok: true })
    }
    setUploading(false)
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar name={name} avatarUrl={preview} size="xl" />
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="bg-background border border-border rounded-full px-4 py-1.5 text-sm font-medium text-dark-text hover:border-teal-primary hover:text-teal-primary transition-colors disabled:opacity-50 w-fit"
        >
          {uploading ? 'Uploading…' : 'Change photo'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleChange}
          className="hidden"
        />
        <p
          role="status"
          aria-live="polite"
          className={`text-xs font-medium min-h-[1rem] ${msg?.ok ? 'text-teal-primary' : 'text-red-500'}`}
        >
          {msg ? (msg.ok ? '✓ ' : '') + msg.text : 'JPG, PNG, or WebP. Max 5MB.'}
        </p>
      </div>
    </div>
  )
}
