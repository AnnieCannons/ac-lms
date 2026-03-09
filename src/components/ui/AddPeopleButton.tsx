'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bulkAddPeopleToCourse } from '@/lib/people-actions'
import Modal from './Modal'

type InviteRole = 'student' | 'instructor' | 'admin'

interface BulkResult {
  email: string
  added?: boolean
  invited?: boolean
  error?: string
}

const INVITE_TYPES: { role: InviteRole; label: string; description: string; color: string }[] = [
  {
    role: 'student',
    label: 'Students',
    description: 'Learners enrolled in this course',
    color: 'border-teal-primary/40 hover:border-teal-primary hover:bg-teal-light/50',
  },
  {
    role: 'instructor',
    label: 'Staff',
    description: 'Instructors and teaching staff',
    color: 'border-purple-primary/40 hover:border-purple-primary hover:bg-purple-light/50',
  },
]

const ADMIN_TYPE = {
  role: 'admin' as InviteRole,
  label: 'Admin',
  description: 'Full administrative access',
  color: 'border-orange-400/40 hover:border-orange-400 hover:bg-orange-50',
}

function parseEmails(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.includes('@'))
}

export default function AddPeopleButton({
  courseId,
  currentUserRole,
}: {
  courseId: string
  currentUserRole: 'instructor' | 'admin'
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [inviteStep, setInviteStep] = useState<'choose' | 'emails'>('choose')
  const [inviteRole, setInviteRole] = useState<InviteRole>('student')
  const [emailsRaw, setEmailsRaw] = useState('')
  const [adding, setAdding] = useState(false)
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null)

  const inviteTypes = currentUserRole === 'admin'
    ? [...INVITE_TYPES, ADMIN_TYPE]
    : INVITE_TYPES

  const selectedType = inviteTypes.find(t => t.role === inviteRole)
  const parsedCount = parseEmails(emailsRaw).length

  function openModal() {
    setInviteStep('choose')
    setEmailsRaw('')
    setBulkResults(null)
    setModalOpen(true)
  }

  function closeModal() {
    if (adding) return
    setModalOpen(false)
  }

  function chooseType(role: InviteRole) {
    setInviteRole(role)
    setEmailsRaw('')
    setBulkResults(null)
    setInviteStep('emails')
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setBulkResults(null)
    const emails = parseEmails(emailsRaw)
    if (emails.length === 0) return
    setAdding(true)
    const results = await bulkAddPeopleToCourse(courseId, emails, inviteRole)
    setAdding(false)
    setBulkResults(results)
    setEmailsRaw('')
    startTransition(() => router.refresh())
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-1.5 bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 transition-opacity"
      >
        <span className="text-base leading-none">+</span> Add People
      </button>

      {modalOpen && (
        <Modal
          title={inviteStep === 'choose' ? 'Add People' : `Add ${selectedType?.label}`}
          onClose={closeModal}
          maxWidth="max-w-md"
        >
          {inviteStep === 'choose' ? (
            <div className="flex flex-col gap-3 pt-1">
              {inviteTypes.map(type => (
                <button
                  key={type.role}
                  type="button"
                  onClick={() => chooseType(type.role)}
                  className={`w-full text-left border-2 rounded-xl px-5 py-4 transition-colors ${type.color}`}
                >
                  <p className="font-semibold text-dark-text">{type.label}</p>
                  <p className="text-sm text-muted-text mt-0.5">{type.description}</p>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleAdd} className="flex flex-col gap-4 pt-1">
              <textarea
                placeholder={"Paste email addresses, one per line or comma-separated\njane@example.com\njohn@example.com"}
                value={emailsRaw}
                onChange={(e) => { setEmailsRaw(e.target.value); setBulkResults(null) }}
                rows={5}
                autoFocus
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-surface text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
                aria-label="Email addresses"
              />

              {bulkResults && bulkResults.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden" role="status" aria-live="polite">
                  <div className="bg-surface border-b border-border px-4 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide">
                    {bulkResults.filter(r => !r.error).length} of {bulkResults.length} succeeded
                  </div>
                  <ul className="divide-y divide-border max-h-40 overflow-y-auto">
                    {bulkResults.map((r) => (
                      <li key={r.email} className="flex items-center gap-3 px-4 py-2 text-sm bg-background">
                        <span className={`shrink-0 ${r.error ? 'text-red-500' : 'text-teal-primary'}`}>{r.error ? '✗' : '✓'}</span>
                        <span className="text-dark-text truncate">{r.email}</span>
                        <span className="ml-auto text-xs text-muted-text shrink-0">{r.error ?? (r.added ? 'Added' : 'Invite sent')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => { setInviteStep('choose'); setBulkResults(null) }}
                  disabled={adding}
                  className="text-sm text-muted-text hover:text-dark-text transition-colors disabled:opacity-50"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={adding || parsedCount === 0}
                  className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {adding ? 'Sending…' : parsedCount > 1 ? `Add ${parsedCount} people` : 'Add'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  )
}
