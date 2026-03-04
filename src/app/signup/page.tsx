'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); return }
    if (data.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        name: firstName.trim(),
        role: 'student',
      }, { onConflict: 'id' })
    }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-dark-text">AC<span className="text-teal-primary">*</span></h1>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-8">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-6">
              {error}
            </div>
          )}
          <form onSubmit={handleSignup} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">First Name</label>
              <input
                type="text"
                placeholder="Your first name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg p-3 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                required
              />
            </div>
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
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-lg p-3 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                required
              />
            </div>
            <button
              type="submit"
              className="bg-teal-primary hover:opacity-90 text-white font-semibold py-3 rounded-full transition-opacity"
            >
              Create Account
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-teal-primary font-medium hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}