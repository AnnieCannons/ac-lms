'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); return }
    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-dark-text">AC<span className="text-teal-primary">*</span></h1>
          <p className="text-gray-500 mt-2">Sign in to your account</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-8">
          {error && (
            <div role="alert" className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-6">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-dark-text mb-1">Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-background border border-border rounded-lg p-3 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="login-password" className="block text-sm font-medium text-dark-text">Password</label>
                <Link href="/forgot-password" className="text-xs text-teal-primary hover:underline">Forgot password?</Link>
              </div>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-lg p-3 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                required
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="bg-teal-primary hover:opacity-90 text-white font-semibold py-3 rounded-full transition-opacity"
            >
              Log In
            </button>
          </form>
          <p className="text-center text-sm text-muted-text mt-6">
            Access is by invitation only.
          </p>
        </div>
      </div>
    </div>
  )
}