'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bulkAddPeopleToCourse } from '@/lib/people-actions'
import Modal from './Modal'

type InviteRole = 'student' | 'instructor' | 'admin' | 'ta'

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
    description: 'Enroll learners in a specific course',
    color: 'border-teal-primary/40 hover:border-teal-primary hover:bg-teal-light/50',
  },
  {
    role: 'ta',
    label: 'Teaching Assistants',
    description: 'Former students returning to help for a term — course-scoped access',
    color: 'border-blue-400/40 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40',
  },
  {
    role: 'instructor',
    label: 'Staff',
    description: 'Instructors and teaching staff — added globally, with access to all courses',
    color: 'border-purple-primary/40 hover:border-purple-primary hover:bg-purple-light/50',
  },
]

const ADMIN_TYPE = {
  role: 'admin' as InviteRole,
  label: 'Admin',
  description: 'Full administrative access',
  color: 'border-orange-400/40 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950',
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
  allCourses,
}: {
  courseId: string
  currentUserRole: 'instructor' | 'admin'
  allCourses: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [inviteStep, setInviteStep] = useState<'choose' | 'emails'>('choose')
  const [inviteRole, setInviteRole] = useState<InviteRole>('student')
  const [selectedCourseId, setSelectedCourseId] = useState(courseId)
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
    setSelectedCourseId(courseId)
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
    setSelectedCourseId(courseId)
    setInviteStep('emails')
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setBulkResults(null)
    const emails = parseEmails(emailsRaw)
    if (emails.length === 0) return
    const targetCourseId = (inviteRole === 'student' || inviteRole === 'ta') ? selectedCourseId : courseId
    setAdding(true)
    const results = await bulkAddPeopleToCourse(targetCourseId, emails, inviteRole)
    setAdding(false)
    setBulkResults(results)
    setEmailsRaw('')
    startTransition(() => router.refresh())
  }

  const selectedCourseName = allCourses.find(c => c.id === selectedCourseId)?.name ?? ''

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
              {inviteRole === 'student' || inviteRole === 'ta' ? (
                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                    Course
                  </label>
                  <select
                    value={selectedCourseId}
                    onChange={e => { setSelectedCourseId(e.target.value); setBulkResults(null) }}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  >
                    {allCourses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-purple-light/60 border border-purple-primary/30 rounded-xl px-4 py-3 text-sm text-dark-text">
                  <p className="font-semibold text-purple-primary mb-0.5">Global access</p>
                  <p className="text-muted-text">Staff members can see all courses. After adding, you can assign them to a specific course from the <strong>Instructors</strong> table on this page — or leave them unassigned if they don&apos;t have a dedicated class.</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                  Email Addresses
                </label>
                <textarea
                  placeholder={"Paste email addresses, one per line or comma-separated\njane@example.com\njohn@example.com"}
                  value={emailsRaw}
                  onChange={(e) => { setEmailsRaw(e.target.value); setBulkResults(null) }}
                  rows={5}
                  autoFocus={inviteRole !== 'student'}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-surface text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
                  aria-label="Email addresses"
                />
              </div>

              {bulkResults && bulkResults.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden" role="status" aria-live="polite">
                  <div className="bg-surface border-b border-border px-4 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide">
                    {bulkResults.filter(r => !r.error).length} of {bulkResults.length} added
                    {(inviteRole === 'student' || inviteRole === 'ta') && ` to ${selectedCourseName}`}
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
