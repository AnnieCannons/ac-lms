'use client'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-gray-500 hover:text-red-500 font-medium transition-colors"
    >
      Log out
    </button>
  )
}