'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const inputCls = 'w-full border border-border rounded-xl px-4 py-2.5 text-sm text-dark-text bg-background focus:outline-none focus:ring-2 focus:ring-teal-primary placeholder:text-muted-text'
const labelCls = 'block text-sm font-medium text-dark-text mb-1.5'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <h2 className="text-base font-semibold text-dark-text mb-5">{title}</h2>
      {children}
    </div>
  )
}

function StatusMsg({ msg }: { msg: { text: string; ok: boolean } | null }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={`text-sm mt-3 font-medium min-h-[1.25rem] ${msg?.ok ? 'text-teal-primary' : 'text-red-500'}`}
    >
      {msg ? (msg.ok ? '✓ ' : '') + msg.text : ''}
    </p>
  )
}

export default function AccountForm({
  initialName,
  initialEmail,
}: {
  initialName: string
  initialEmail: string
}) {
  const supabase = createClient()
  const router = useRouter()

  // --- Name ---
  const [name, setName] = useState(initialName)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMsg, setNameMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setNameSaving(true)
    setNameMsg(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setNameMsg({ text: 'Not authenticated.', ok: false }); setNameSaving(false); return }
    const { error } = await supabase.from('users').update({ name: name.trim() }).eq('id', user.id)
    if (error) {
      setNameMsg({ text: error.message, ok: false })
    } else {
      setNameMsg({ text: 'Name updated.', ok: true })
      router.refresh()
    }
    setNameSaving(false)
  }

  // --- Email ---
  const [email, setEmail] = useState(initialEmail)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || email.trim() === initialEmail) return
    setEmailSaving(true)
    setEmailMsg(null)
    const { error } = await supabase.auth.updateUser({ email: email.trim() })
    if (error) {
      setEmailMsg({ text: error.message, ok: false })
    } else {
      setEmailMsg({ text: 'Confirmation sent to your new email address. Check your inbox to complete the change.', ok: true })
    }
    setEmailSaving(false)
  }

  // --- Password ---
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPw || !newPw || !confirmPw) return
    if (newPw !== confirmPw) { setPwMsg({ text: 'New passwords do not match.', ok: false }); return }
    if (newPw.length < 8) { setPwMsg({ text: 'Password must be at least 8 characters.', ok: false }); return }
    setPwSaving(true)
    setPwMsg(null)

    // Verify current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: initialEmail,
      password: currentPw,
    })
    if (signInError) {
      setPwMsg({ text: 'Current password is incorrect.', ok: false })
      setPwSaving(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) {
      setPwMsg({ text: error.message, ok: false })
    } else {
      setPwMsg({ text: 'Password updated successfully.', ok: true })
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    }
    setPwSaving(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Name */}
      <Section title="Name">
        <form onSubmit={saveName}>
          <label htmlFor="name" className={labelCls}>Display name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={inputCls}
            required
          />
          <div className="flex items-center gap-4 mt-4">
            <button
              type="submit"
              disabled={nameSaving || !name.trim() || name.trim() === initialName}
              className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {nameSaving ? 'Saving…' : 'Save name'}
            </button>
          </div>
          <StatusMsg msg={nameMsg} />
        </form>
      </Section>

      {/* Email */}
      <Section title="Email Address">
        <form onSubmit={saveEmail}>
          <label htmlFor="email" className={labelCls}>Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputCls}
            required
          />
          <p className="text-xs text-muted-text mt-2">
            You will receive a confirmation link at your new address. Your email won&apos;t change until you click it.
          </p>
          <div className="mt-4">
            <button
              type="submit"
              disabled={emailSaving || !email.trim() || email.trim() === initialEmail}
              className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {emailSaving ? 'Saving…' : 'Update email'}
            </button>
          </div>
          <StatusMsg msg={emailMsg} />
        </form>
      </Section>

      {/* Password */}
      <Section title="Change Password">
        <form onSubmit={savePassword} className="flex flex-col gap-4">
          <div>
            <label htmlFor="current-pw" className={labelCls}>Current password</label>
            <input
              id="current-pw"
              type="password"
              value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              className={inputCls}
              required
            />
          </div>
          <div>
            <label htmlFor="new-pw" className={labelCls}>New password</label>
            <input
              id="new-pw"
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              autoComplete="new-password"
              className={inputCls}
              required
              minLength={8}
            />
          </div>
          <div>
            <label htmlFor="confirm-pw" className={labelCls}>Confirm new password</label>
            <input
              id="confirm-pw"
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              className={inputCls}
              required
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={pwSaving || !currentPw || !newPw || !confirmPw}
              className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {pwSaving ? 'Updating…' : 'Change password'}
            </button>
          </div>
          <StatusMsg msg={pwMsg} />
        </form>
      </Section>
    </div>
  )
}
