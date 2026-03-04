'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-dark-text">AC<span className="text-teal-primary">*</span></h1>
          <p className="text-gray-500 mt-2">Reset your password</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-8">
          {submitted ? (
            <div className="text-center flex flex-col gap-4">
              <p className="text-dark-text font-medium">Check your email</p>
              <p className="text-sm text-muted-text">
                We sent a password reset link to <strong>{email}</strong>. Check your inbox and click the link to set a new password.
              </p>
              <Link href="/login" className="text-sm text-teal-primary hover:underline">
                Back to login
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-6">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-3 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-teal-primary hover:opacity-90 text-white font-semibold py-3 rounded-full transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <p className="text-center text-sm text-muted-text mt-6">
                <Link href="/login" className="text-teal-primary hover:underline">Back to login</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
