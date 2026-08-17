'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import UserAvatar from '@/components/ui/UserAvatar'

// Fetches its own avatar client-side (RLS-scoped to the signed-in user) so the
// top nav can show a photo without every page that renders it having to select
// avatar_url and thread it through as a prop.
export default function CurrentUserAvatar({
  name,
  size = 'sm',
}: {
  name?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('users')
        .select('avatar_url')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (!cancelled) setAvatarUrl(data?.avatar_url ?? null)
        })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return <UserAvatar name={name} avatarUrl={avatarUrl} size={size} />
}
