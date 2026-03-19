'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(pw)) return 'Password must include at least one uppercase letter.'
  if (!/[a-z]/.test(pw)) return 'Password must include at least one lowercase letter.'
  if (!/[0-9]/.test(pw)) return 'Password must include at least one number.'
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must include at least one symbol (e.g. !, @, #, $).'
  return null
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const passwordsMatch = confirm.length > 0 && password === confirm

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSessionReady(true)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const pwError = validatePassword(password)
    if (pwError) { setError(pwError); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
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
          ) : !sessionReady ? (
            <div className="text-center flex flex-col gap-3">
              <p className="text-sm text-muted-text">Verifying your reset link…</p>
              <p className="text-xs text-muted-text">
                If this takes more than a few seconds, your link may have expired.{' '}
                <a href="/forgot-password" className="text-teal-primary hover:underline">Request a new one.</a>
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-6">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">New Password</label>
                  <p className="text-xs text-muted-text mb-1.5">Min 8 characters with uppercase, lowercase, a number, and a symbol (e.g. !, @, #, $)</p>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError('') }}
                      className="w-full bg-background border border-border rounded-lg p-3 pr-10 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text hover:text-dark-text"
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={e => { setConfirm(e.target.value); setError('') }}
                      className="w-full bg-background border border-border rounded-lg p-3 pr-10 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(p => !p)}
                      tabIndex={-1}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text hover:text-dark-text"
                    >
                      <EyeIcon open={showConfirm} />
                    </button>
                  </div>
                  {passwordsMatch && (
                    <p className="text-xs text-teal-primary mt-1">Passwords match</p>
                  )}
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
