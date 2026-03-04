'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-dark-text">AC<span className="text-teal-primary">*</span></h1>
          <p className="text-gray-500 mt-2">Set a new password</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-8">
          {done ? (
            <div className="text-center flex flex-col gap-3">
              <p className="text-dark-text font-medium">Password updated!</p>
              <p className="text-sm text-muted-text">Redirecting you to your dashboard…</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-6">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">New Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-3 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-3 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-teal-primary hover:opacity-90 text-white font-semibold py-3 rounded-full transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Set new password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
