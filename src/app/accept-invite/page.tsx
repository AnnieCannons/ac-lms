'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { acceptInvite } from '@/lib/people-actions'

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

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function establishSession() {
      // Try token_hash flow (email OTP)
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      if (tokenHash && type === 'invite') {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' })
        if (error) {
          setSessionError(error.message)
          return
        }
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
          setSessionReady(true)
          return
        }
        setSessionError('Could not establish session from invite link.')
        return
      }

      // Check if already in a session (e.g. page reload after OTP)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
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

    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters.')
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
                Password <span className="text-muted-text font-normal">(min 8 characters)</span>
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
              />
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-dark-text mb-1">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
              />
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
