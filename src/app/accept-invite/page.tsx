'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { acceptInvite } from '@/lib/people-actions'

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

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-text">Loading…</p>
      </div>
    }>
      <AcceptInviteForm />
    </Suspense>
  )
}

function AcceptInviteForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const [courseName, setCourseName] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const passwordsMatch = confirm.length > 0 && password === confirm

  useEffect(() => {
    const supabase = createClient()

    async function establishSession() {
      // Try token_hash flow (email OTP)
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      async function readCourseName() {
        const { data: { user } } = await supabase.auth.getUser()
        const cn = user?.user_metadata?.course_name as string | undefined
        if (cn) setCourseName(cn)
      }

      if (tokenHash && (type === 'invite' || type === 'recovery')) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'invite' | 'recovery',
        })
        if (error) {
          setSessionError(error.message)
          return
        }
        await readCourseName()
        setSessionReady(true)
        return
      }

      // Try hash fragment flow (#access_token=...&refresh_token=...)
      const hash = window.location.hash.substring(1)
      if (hash.includes('access_token')) {
        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          if (error) {
            setSessionError(error.message)
            return
          }
          await readCourseName()
          setSessionReady(true)
          return
        }
        setSessionError('Could not establish session from invite link.')
        return
      }

      // Check if already in a session (e.g. page reload after OTP)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await readCourseName()
        setSessionReady(true)
        return
      }

      setSessionError('Invalid or expired invite link. Please ask your instructor to resend the invitation.')
    }

    establishSession()
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const pwError = validatePassword(password)
    if (pwError) {
      setSubmitError(pwError)
      return
    }
    if (password !== confirm) {
      setSubmitError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const result = await acceptInvite(name.trim(), password)
    setSubmitting(false)

    if (result.error) {
      setSubmitError(result.error)
      return
    }

    if (result.courseId) {
      const base = result.role === 'instructor' ? '/instructor' : '/student'
      router.push(`${base}/courses/${result.courseId}`)
    } else {
      router.push('/student/courses')
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-dark-text">
            AC<span className="text-teal-primary">*</span>
          </h1>
          <p className="mt-2 text-lg font-semibold text-dark-text">Welcome! Set up your account</p>
          {courseName && (
            <p className="mt-1 text-sm text-muted-text">
              You&apos;re joining <span className="font-semibold text-dark-text">{courseName}</span>
            </p>
          )}
        </div>

        {sessionError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 text-center">
            {sessionError}
          </div>
        )}

        {!sessionReady && !sessionError && (
          <p className="text-center text-sm text-muted-text">Verifying your invite link…</p>
        )}

        {sessionReady && (
          <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-8 space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-dark-text mb-1">
                First name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-dark-text mb-1">
                Password
              </label>
              <p className="text-xs text-muted-text mb-1.5">Min 8 characters with uppercase, lowercase, a number, and a symbol (e.g. !, @, #, $)</p>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setSubmitError(null) }}
                  className="w-full border border-border rounded-lg px-3 py-2 pr-10 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text hover:text-dark-text"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-dark-text mb-1">
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setSubmitError(null) }}
                  className="w-full border border-border rounded-lg px-3 py-2 pr-10 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text hover:text-dark-text"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
              {passwordsMatch && (
                <p className="text-xs text-teal-primary mt-1">Passwords match</p>
              )}
            </div>

            {submitError && (
              <p role="alert" className="text-sm text-red-600">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-teal-primary text-white py-2 rounded-lg text-sm font-semibold hover:bg-teal-primary/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Setting up account…' : 'Create account & join course'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
