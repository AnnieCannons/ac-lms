'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  logInteraction,
  deleteInteraction,
  setDepartmentStatus,
  removeDepartmentStatus,
  createReferral,
  deleteReferral,
  type PartnerDepartment,
} from '@/lib/partner-interactions-actions'
import { archiveContact, createContact, updateContact, deleteContact, setPartnerOwner, setDoNotEmail, type ContactData } from '@/lib/partner-actions'
import { DEPARTMENT_LABELS, DEPARTMENT_STAGES, DEPT_COLORS } from '@/lib/partner-constants'
import PartnerForm from '@/components/ui/PartnerForm'
import StageHistory, { type StageHistoryEntry } from '@/components/ui/StageHistory'
import type { PartnerFormData, PartnerType } from '@/lib/partner-actions'
import type { PartnerRatingSummaryRow } from '@/lib/partner-ratings-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id?: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
  notes: string | null
  linkedin_url?: string | null
  website_url?: string | null
  is_archived?: boolean
  departments?: string[] | null
}

interface Interaction {
  id: string
  note: string
  interaction_date: string
  department: PartnerDepartment | null
  created_at: string
  user_id: string | null
  users: { name: string } | null
}

interface DepartmentStatus {
  id: string
  department: PartnerDepartment
  stage: string
  updated_at: string
  users: { name: string } | null
}

interface Partner {
  id: string
  name: string
  city: string | null
  state: string | null
  multi_city: boolean
  status: string
  last_interaction_date: string | null
  internal_owner_id: string | null
  internal_owner_name?: string | null
  website: string | null
  service_categories?: string[]
  service_categories_other?: string | null
  do_not_email?: boolean
  do_not_email_notes?: string | null
  do_not_email_set_at?: string | null
  how_we_met: string | null
  services_focus_area: string | null
  meeting_notes: string | null
  tags: string[]
  referred_by: string | null
  partner_type_assignments: { partner_type: PartnerType }[]
  partner_contacts: Contact[]
  partner_locations?: { id: string; city: string | null; state: string | null; sort_order: number }[]
}

interface Referral {
  id: string
  student_identifier: string
  direction: string
  referral_date: string
  referral_type: string | null
}

interface StaffUser {
  id: string
  name: string
}

type ActiveTab = PartnerDepartment | 'edit'

interface Props {
  partner: Partner
  interactions: Interaction[]
  departmentStatuses: DepartmentStatus[]
  studentReferrals: Referral[]
  ratingSummary?: PartnerRatingSummaryRow[]
  stageHistories?: Record<string, StageHistoryEntry[]>
  staffUsers: StaffUser[]
  defaultDepartment?: PartnerDepartment | null
  onUpdatePartner: (data: PartnerFormData) => Promise<{ error: string | null }>
  onDeletePartner: () => Promise<{ error: string | null }>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  service_provider: 'Service Provider',
  corporate: 'Corporate',
  funder: 'Funder',
  advisory: 'Advisory',
  mentorship: 'Mentorship',
  apprenticeship: 'Apprenticeship',
  media: 'Media',
  admissions_referral: 'Admissions Referral',
}

const ALL_DEPARTMENTS: PartnerDepartment[] = [
  'student_success',
  'career_development',
  'resourcefull',
  'funding_partnerships',
  'admissions',
]

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function daysSince(dateStr: string | null) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DeptOverviewTable({
  deptStatuses,
  studentReferrals,
  onTabClick,
  onAddDept,
}: {
  deptStatuses: DepartmentStatus[]
  studentReferrals: Referral[]
  onTabClick: (dept: PartnerDepartment) => void
  onAddDept: (dept: PartnerDepartment) => void
}) {
  const inboundCount = studentReferrals.filter(r => r.direction === 'inbound').length
  const outboundCount = studentReferrals.filter(r => r.direction === 'outbound').length

  if (deptStatuses.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
        <p className="text-sm text-muted-text">Not enrolled in any department yet.</p>
        <AddDepartmentDropdown enrolledDepts={[]} onAdd={onAddDept} />
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border">
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide w-48">Department</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {deptStatuses.map((ds, i) => (
              <tr
                key={ds.department}
                onClick={() => onTabClick(ds.department)}
                className={`cursor-pointer hover:bg-background transition-colors ${i < deptStatuses.length - 1 ? 'border-b border-border' : ''}`}
              >
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${DEPT_COLORS[ds.department]}`}>
                    {DEPARTMENT_LABELS[ds.department]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {DEPARTMENT_STAGES[ds.department].length > 0
                      ? <span className="text-dark-text">{ds.stage || <span className="text-muted-text">—</span>}</span>
                      : null
                    }
                    {ds.department === 'admissions' && (
                      <span className="text-xs text-muted-text">· {inboundCount} referred in</span>
                    )}
                    {ds.department === 'student_success' && (
                      <span className="text-xs text-muted-text">· {outboundCount} referred out</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AddDepartmentDropdown
        enrolledDepts={deptStatuses.map(s => s.department)}
        onAdd={onAddDept}
      />
    </section>
  )
}

function AddDepartmentDropdown({
  enrolledDepts,
  onAdd,
}: {
  enrolledDepts: PartnerDepartment[]
  onAdd: (dept: PartnerDepartment) => void
}) {
  const [open, setOpen] = useState(false)
  const unenrolled = ALL_DEPARTMENTS.filter(d => !enrolledDepts.includes(d))
  if (unenrolled.length === 0) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-sm text-teal-primary hover:underline"
      >
        + Add to department
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-7 z-20 rounded-xl border border-border bg-surface shadow-lg py-1 min-w-48">
            {unenrolled.map(dept => (
              <button
                key={dept}
                type="button"
                onClick={() => { onAdd(dept); setOpen(false) }}
                className="w-full text-left px-4 py-2 text-sm text-dark-text hover:bg-background transition-colors"
              >
                {DEPARTMENT_LABELS[dept]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

type RemindUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months'

function LogInteractionForm({
  partnerId,
  defaultDepartment,
  availableStages = [],
  onLogged,
  onStageUpdated,
}: {
  partnerId: string
  defaultDepartment?: PartnerDepartment
  availableStages?: string[]
  onLogged: (interaction: Interaction) => void
  onStageUpdated?: (stage: string) => void
}) {
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [department, setDepartment] = useState<PartnerDepartment | ''>(defaultDepartment ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReminder, setShowReminder] = useState(false)
  const [remindValue, setRemindValue] = useState(1)
  const [remindUnit, setRemindUnit] = useState<RemindUnit>('weeks')
  const [reminderConfirmed, setReminderConfirmed] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState(false)
  const [newStage, setNewStage] = useState('')

  function getRemindInDays() {
    switch (remindUnit) {
      case 'minutes': return remindValue / (24 * 60)
      case 'hours': return remindValue / 24
      case 'days': return remindValue
      case 'weeks': return remindValue * 7
      case 'months': return remindValue * 30
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    setSaving(true)
    setError(null)

    const result = await logInteraction({
      partner_id: partnerId,
      note: note.trim(),
      interaction_date: date,
      department: department || null,
      remind_in_days: showReminder ? getRemindInDays() : null,
    })

    if (result.error) { setSaving(false); setError(result.error); return }

    if (updateStatus && newStage && defaultDepartment) {
      await setDepartmentStatus(partnerId, defaultDepartment, newStage)
      onStageUpdated?.(newStage)
    }

    onLogged({
      id: crypto.randomUUID(),
      note: note.trim(),
      interaction_date: date,
      department: department || null,
      created_at: new Date().toISOString(),
      user_id: null,
      users: null,
    })
    setNote('')
    if (showReminder) {
      const unitLabel = remindValue === 1 ? remindUnit.replace(/s$/, '') : remindUnit
      setReminderConfirmed(`${remindValue} ${unitLabel}`)
      setShowReminder(false)
    }
    setUpdateStatus(false)
    setNewStage('')
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <h3 className="text-xs font-semibold text-dark-text uppercase tracking-wide">Log Interaction</h3>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
        placeholder="What happened? Who was involved, what was discussed or decided…"
      />
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-xs text-muted-text mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
          />
        </div>
        {!defaultDepartment && (
          <div>
            <label className="block text-xs text-muted-text mb-1">Department (optional)</label>
            <select
              value={department}
              onChange={e => setDepartment(e.target.value as PartnerDepartment | '')}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
            >
              <option value="">All / General</option>
              {ALL_DEPARTMENTS.map(d => (
                <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        {/* Also update status */}
        {availableStages.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={updateStatus}
                onChange={e => setUpdateStatus(e.target.checked)}
                className="rounded border-border accent-teal-primary"
              />
              <span className="text-xs text-muted-text">Also update status</span>
            </label>
            {updateStatus && (
              <div className="pl-5">
                <select
                  value={newStage}
                  onChange={e => setNewStage(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                >
                  <option value="">— Select new status —</option>
                  {availableStages.map(stage => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Slack reminder */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showReminder}
            onChange={e => setShowReminder(e.target.checked)}
            className="rounded border-border accent-teal-primary"
          />
          <span className="text-xs text-muted-text">Send me a Slack follow-up reminder</span>
        </label>
        {showReminder && (
          <div className="flex items-center gap-2 pl-5">
            <input
              type="number"
              min={1}
              value={remindValue}
              onChange={e => setRemindValue(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
            />
            <select
              value={remindUnit}
              onChange={e => setRemindUnit(e.target.value as RemindUnit)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
              <option value="weeks">weeks</option>
              <option value="months">months</option>
            </select>
          </div>
        )}
      </div>

      {reminderConfirmed && (
        <p className="text-xs text-teal-primary">✓ Slack reminder set for {reminderConfirmed}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving || !note.trim()}
        className="self-start px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors disabled:opacity-50"
      >
        {saving ? 'Logging…' : 'Log'}
      </button>
    </form>
  )
}

function InteractionList({
  interactions,
  onDelete,
}: {
  interactions: Interaction[]
  onDelete: (id: string) => void
}) {
  if (interactions.length === 0) {
    return <p className="text-sm text-muted-text">No interactions logged yet.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {interactions.map(interaction => (
        <div key={interaction.id} className="rounded-xl border border-border bg-surface px-4 py-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-text">
              <span className="font-medium text-dark-text text-sm">{formatDate(interaction.interaction_date)}</span>
              {interaction.users?.name && <span>by {interaction.users.name}</span>}
              {interaction.department && (
                <span className={`rounded-full px-2 py-0.5 ${DEPT_COLORS[interaction.department]}`}>
                  {DEPARTMENT_LABELS[interaction.department]}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDelete(interaction.id)}
              className="text-xs text-muted-text hover:text-red-500 transition-colors"
            >
              Remove
            </button>
          </div>
          <p className="text-sm text-dark-text whitespace-pre-line">{interaction.note}</p>
        </div>
      ))}
    </div>
  )
}

function ContactForm({
  initialData,
  enrolledDepts,
  currentDept,
  onSubmit,
  onCancel,
}: {
  initialData?: Partial<Contact>
  enrolledDepts: PartnerDepartment[]
  currentDept: PartnerDepartment
  onSubmit: (data: ContactData) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initialData?.name ?? '')
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [email, setEmail] = useState(initialData?.email ?? '')
  const [phone, setPhone] = useState(initialData?.phone ?? '')
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(initialData?.linkedin_url ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(initialData?.website_url ?? '')
  const [isPrimary, setIsPrimary] = useState(initialData?.is_primary ?? false)
  const [selectedDepts, setSelectedDepts] = useState<PartnerDepartment[]>(
    (initialData?.departments ?? []) as PartnerDepartment[]
  )
  const [saving, setSaving] = useState(false)

  function toggleDept(dept: PartnerDepartment) {
    setSelectedDepts(prev =>
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSubmit({
      name: name.trim(),
      title: title.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      website_url: websiteUrl.trim() || null,
      is_primary: isPrimary,
      departments: selectedDepts.length > 0 ? selectedDepts : null,
    })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-text mb-1">Name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary" />
        </div>
        <div>
          <label className="block text-xs text-muted-text mb-1">Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary" />
        </div>
        <div>
          <label className="block text-xs text-muted-text mb-1">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary" />
        </div>
        <div>
          <label className="block text-xs text-muted-text mb-1">Phone</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary" />
        </div>
        <div>
          <label className="block text-xs text-muted-text mb-1">LinkedIn URL</label>
          <input type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary" />
        </div>
        <div>
          <label className="block text-xs text-muted-text mb-1">Website URL</label>
          <input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted-text mb-1">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none" />
      </div>
      {enrolledDepts.length > 1 && (
        <div>
          <label className="block text-xs text-muted-text mb-1.5">Visible in</label>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input type="checkbox" checked={selectedDepts.length === 0} onChange={() => setSelectedDepts([])}
                className="accent-teal-primary" />
              All departments (shared)
            </label>
            {enrolledDepts.map(dept => (
              <label key={dept} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <input type="checkbox" checked={selectedDepts.includes(dept)} onChange={() => toggleDept(dept)}
                  className="accent-teal-primary" />
                {DEPARTMENT_LABELS[dept]}
              </label>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
        <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)}
          className="accent-teal-primary" />
        Primary contact
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving || !name.trim()}
          className="px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-muted-text hover:text-dark-text transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

function ContactCard({
  contact,
  currentDept,
  enrolledDepts,
  onArchive,
  onUpdate,
  onDelete,
}: {
  contact: Contact
  currentDept: PartnerDepartment
  enrolledDepts: PartnerDepartment[]
  onArchive: (id: string, archived: boolean) => void
  onUpdate: (id: string, data: ContactData) => Promise<void>
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const isArchived = !!contact.is_archived
  const isShared = !contact.departments || contact.departments.length === 0
  const otherDepts = (contact.departments as PartnerDepartment[] ?? []).filter(d => d !== currentDept)

  if (editing && contact.id) {
    return (
      <ContactForm
        initialData={contact}
        enrolledDepts={enrolledDepts}
        currentDept={currentDept}
        onSubmit={async (data) => { await onUpdate(contact.id!, data); setEditing(false) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className={`rounded-xl border border-border bg-surface px-4 py-3 flex flex-col gap-1.5 transition-opacity ${isArchived ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium text-sm ${isArchived ? 'text-muted-text' : 'text-dark-text'}`}>
            {contact.name}
          </span>
          {contact.is_primary && !isArchived && (
            <span className="text-xs bg-teal-100 text-teal-800 rounded-full px-2 py-0.5">Primary</span>
          )}
          {isArchived && (
            <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Archived</span>
          )}
          {isShared && !isArchived && (
            <span className="text-xs bg-gray-100 text-gray-500 rounded px-2 py-0.5">Shared</span>
          )}
          {!isShared && otherDepts.map(d => (
            <span key={d} className={`text-xs rounded px-2 py-0.5 ${DEPT_COLORS[d]}`}>
              Also in {DEPARTMENT_LABELS[d]}
            </span>
          ))}
          {contact.title && (
            <span className={`text-xs ${isArchived ? 'text-muted-text/60' : 'text-muted-text'}`}>{contact.title}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isArchived && contact.id && (
            <button type="button" onClick={() => setEditing(true)}
              className="text-xs text-muted-text hover:text-dark-text transition-colors">
              Edit
            </button>
          )}
          {contact.id && (
            <button type="button" onClick={() => onArchive(contact.id!, !isArchived)}
              className="text-xs text-muted-text hover:text-dark-text transition-colors">
              {isArchived ? 'Unarchive' : 'Archive'}
            </button>
          )}
          {isArchived && contact.id && (
            <button type="button" onClick={() => onDelete(contact.id!)}
              className="text-xs text-muted-text hover:text-red-500 transition-colors">
              Delete
            </button>
          )}
        </div>
      </div>
      {!isArchived && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-text">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="hover:text-teal-primary transition-colors">{contact.email}</a>
          )}
          {contact.phone && <span>{contact.phone}</span>}
          {contact.linkedin_url && (
            <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:text-teal-primary transition-colors">LinkedIn</a>
          )}
          {contact.website_url && (
            <a href={contact.website_url} target="_blank" rel="noopener noreferrer" className="hover:text-teal-primary transition-colors">Website</a>
          )}
        </div>
      )}
      {contact.notes && !isArchived && <p className="text-xs text-muted-text">{contact.notes}</p>}
    </div>
  )
}

function ContactsSection({
  contacts,
  currentDept,
  enrolledDepts,
  onArchive,
  onUpdate,
  onDelete,
  onCreate,
}: {
  contacts: Contact[]
  currentDept: PartnerDepartment
  enrolledDepts: PartnerDepartment[]
  onArchive: (id: string, archived: boolean) => void
  onUpdate: (id: string, data: ContactData) => Promise<void>
  onDelete: (id: string) => void
  onCreate: (data: ContactData) => Promise<void>
}) {
  const [adding, setAdding] = useState(false)

  const visible = contacts.filter(c =>
    !c.departments || c.departments.length === 0 || (c.departments as string[]).includes(currentDept)
  )

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Contacts</h2>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)}
            className="text-xs text-teal-primary hover:underline">
            + Add contact
          </button>
        )}
      </div>
      {adding && (
        <ContactForm
          initialData={{ departments: [currentDept] }}
          enrolledDepts={enrolledDepts}
          currentDept={currentDept}
          onSubmit={async (data) => { await onCreate(data); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      )}
      {visible.length === 0 && !adding ? (
        <p className="text-sm text-muted-text">No contacts for this department yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map(c => (
            <ContactCard
              key={c.id ?? c.name}
              contact={c}
              currentDept={currentDept}
              enrolledDepts={enrolledDepts}
              onArchive={onArchive}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ProfileView({
  partner,
  types,
  deptStatuses,
  onEdit,
}: {
  partner: Partner
  types: string[]
  deptStatuses: DepartmentStatus[]
  onEdit: () => void
}) {
  const location = [partner.city, partner.state].filter(Boolean).join(', ')
    + (partner.multi_city ? ' + more' : '')
  const serviceCategories = partner.service_categories ?? []

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onEdit}
          className="text-sm text-teal-primary hover:underline"
        >
          Edit
        </button>
      </div>

      <dl className="flex flex-col gap-3">
        <div className="flex gap-3 text-sm">
          <dt className="text-muted-text shrink-0 w-36">Name</dt>
          <dd className="text-dark-text font-medium">{partner.name}</dd>
        </div>

        <div className="flex gap-3 text-sm">
          <dt className="text-muted-text shrink-0 w-36">Location</dt>
          <dd className={location ? 'text-dark-text' : 'text-muted-text'}>
            {location || '—'}
          </dd>
        </div>

        <div className="flex gap-3 text-sm">
          <dt className="text-muted-text shrink-0 w-36">Website</dt>
          <dd>
            {partner.website
              ? <a href={partner.website} target="_blank" rel="noopener noreferrer"
                  className="text-teal-primary hover:underline break-all">{partner.website}</a>
              : <span className="text-muted-text">—</span>}
          </dd>
        </div>

        <div className="flex gap-3 text-sm">
          <dt className="text-muted-text shrink-0 w-36">Departments</dt>
          <dd>
            {deptStatuses.length > 0
              ? <div className="flex flex-wrap gap-1">
                  {deptStatuses.map(ds => (
                    <span key={ds.department} className={`text-xs font-medium rounded-full px-2.5 py-1 ${DEPT_COLORS[ds.department]}`}>
                      {DEPARTMENT_LABELS[ds.department]}
                    </span>
                  ))}
                </div>
              : <span className="text-muted-text">—</span>}
          </dd>
        </div>

        <div className="flex gap-3 text-sm">
          <dt className="text-muted-text shrink-0 w-36">Partner Type</dt>
          <dd>
            {types.length > 0
              ? <div className="flex flex-wrap gap-1">
                  {types.map(t => (
                    <span key={t} className="text-xs bg-surface border border-border rounded px-2 py-0.5">{t}</span>
                  ))}
                </div>
              : <span className="text-muted-text">—</span>}
          </dd>
        </div>

        <div className="flex gap-3 text-sm">
          <dt className="text-muted-text shrink-0 w-36">Services Provided</dt>
          <dd>
            {serviceCategories.length > 0
              ? <div className="flex flex-wrap gap-1">
                  {serviceCategories.map(cat => (
                    <span key={cat} className="text-xs bg-surface border border-border rounded px-2 py-0.5">
                      {cat === 'Other' && partner.service_categories_other
                        ? `Other: ${partner.service_categories_other}`
                        : cat}
                    </span>
                  ))}
                </div>
              : <span className="text-muted-text">—</span>}
          </dd>
        </div>

        <div className="flex gap-3 text-sm">
          <dt className="text-muted-text shrink-0 w-36">Notes</dt>
          <dd className={partner.services_focus_area ? 'text-dark-text whitespace-pre-line' : 'text-muted-text'}>
            {partner.services_focus_area || '—'}
          </dd>
        </div>

        <div className="flex gap-3 text-sm">
          <dt className="text-muted-text shrink-0 w-36">Tags</dt>
          <dd>
            {partner.tags?.length > 0
              ? <div className="flex flex-wrap gap-1">
                  {partner.tags.map(tag => (
                    <span key={tag} className="text-xs bg-surface border border-border rounded-full px-2 py-0.5">{tag}</span>
                  ))}
                </div>
              : <span className="text-muted-text">—</span>}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function DetailsSection({ partner }: { partner: Partner }) {
  const hasDetails = partner.website || partner.how_we_met || partner.referred_by ||
    partner.services_focus_area || (partner.tags?.length > 0) || partner.meeting_notes

  if (!hasDetails) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Details</h2>
      <dl className="flex flex-col gap-2">
        {partner.website && (
          <div className="flex gap-2 text-sm">
            <dt className="text-muted-text shrink-0 w-36">Website</dt>
            <dd>
              <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-teal-primary hover:underline break-all">
                {partner.website}
              </a>
            </dd>
          </div>
        )}
        {partner.how_we_met && (
          <div className="flex gap-2 text-sm">
            <dt className="text-muted-text shrink-0 w-36">How we met</dt>
            <dd className="text-dark-text">{partner.how_we_met}</dd>
          </div>
        )}
        {partner.referred_by && (
          <div className="flex gap-2 text-sm">
            <dt className="text-muted-text shrink-0 w-36">Referred by</dt>
            <dd className="text-dark-text">{partner.referred_by}</dd>
          </div>
        )}
        {partner.services_focus_area && (
          <div className="flex gap-2 text-sm">
            <dt className="text-muted-text shrink-0 w-36">Services / focus</dt>
            <dd className="text-dark-text whitespace-pre-line">{partner.services_focus_area}</dd>
          </div>
        )}
        {partner.tags?.length > 0 && (
          <div className="flex gap-2 text-sm">
            <dt className="text-muted-text shrink-0 w-36">Tags</dt>
            <dd className="flex flex-wrap gap-1">
              {partner.tags.map(tag => (
                <span key={tag} className="text-xs bg-surface border border-border rounded-full px-2 py-0.5">{tag}</span>
              ))}
            </dd>
          </div>
        )}
        {partner.meeting_notes && (
          <div className="flex gap-2 text-sm">
            <dt className="text-muted-text shrink-0 w-36">Meeting notes</dt>
            <dd className="text-dark-text whitespace-pre-line">{partner.meeting_notes}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}

// ─── Student Referrals Section ───────────────────────────────────────────────

function StudentReferralsSection({
  partnerId,
  referrals: initialReferrals,
  direction,
}: {
  partnerId: string
  referrals: Referral[]
  direction: 'inbound' | 'outbound'
}) {
  const [referrals, setReferrals] = useState<Referral[]>(initialReferrals.filter(r => r.direction === direction))
  const [studentName, setStudentName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allNames, setAllNames] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  const namesFetched = useState(false)
  async function fetchNames() {
    if (namesFetched[0]) return
    namesFetched[1](true)
    try {
      const res = await fetch('/api/partnerships/students')
      if (res.ok) {
        const data = await res.json()
        setAllNames(data.names ?? [])
      }
    } catch { /* silent */ }
  }

  const filtered = studentName.length >= 2
    ? allNames.filter(n => n.toLowerCase().includes(studentName.toLowerCase())).slice(0, 8)
    : []

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!studentName.trim()) return
    setSaving(true)
    setError(null)
    const result = await createReferral({
      student_identifier: studentName.trim(),
      direction,
      partner_id: partnerId,
      referral_date: date,
      referral_type: null,
      outcome_rating: null,
      outcome_notes: null,
      student_city: null,
      open_to_relocation: false,
      is_veteran: false,
      is_neurodivergent: false,
      other_flags: [],
    })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setReferrals(prev => [{
      id: crypto.randomUUID(),
      student_identifier: studentName.trim(),
      direction,
      referral_date: date,
      referral_type: null,
    }, ...prev])
    setStudentName('')
    setDate(new Date().toISOString().slice(0, 10))
  }

  async function handleRemove(id: string) {
    await deleteReferral(id)
    setReferrals(prev => prev.filter(r => r.id !== id))
  }

  const label = direction === 'inbound' ? 'referred to AnnieCannons' : 'referred by AnnieCannons'
  const placeholder = direction === 'inbound'
    ? 'Student name (referred to us)'
    : 'Student name (we referred out)'

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">
        Student Referrals
      </h2>

      <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h3 className="text-xs font-semibold text-dark-text uppercase tracking-wide">Log a Referral</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
          <div className="relative flex-1">
            <label className="block text-xs text-muted-text mb-1">Student name</label>
            <input
              type="text"
              value={studentName}
              onFocus={() => { fetchNames(); setShowDropdown(true) }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              onChange={e => { setStudentName(e.target.value); setShowDropdown(true) }}
              placeholder={placeholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
            />
            {showDropdown && filtered.length > 0 && (
              <div className="absolute left-0 top-full mt-1 z-30 w-full rounded-xl border border-border bg-surface shadow-lg max-h-48 overflow-y-auto">
                {filtered.map(name => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={() => { setStudentName(name); setShowDropdown(false) }}
                    className="w-full text-left px-4 py-2 text-sm text-dark-text hover:bg-background transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-muted-text mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !studentName.trim()}
            className="px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors disabled:opacity-50 shrink-0"
          >
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>

      {referrals.length === 0 ? (
        <p className="text-sm text-muted-text">No students {label} yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {referrals.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-dark-text">{r.student_identifier}</span>
                <span className="text-xs text-muted-text">{formatDate(r.referral_date)}{r.referral_type ? ` · ${r.referral_type}` : ''}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(r.id)}
                className="text-xs text-muted-text hover:text-red-500 transition-colors shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PartnerOverview({
  partner,
  interactions: initialInteractions,
  departmentStatuses: initialStatuses,
  studentReferrals,
  ratingSummary = [],
  stageHistories: initialHistories = {},
  staffUsers,
  defaultDepartment,
  onUpdatePartner,
  onDeletePartner,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [interactions, setInteractions] = useState<Interaction[]>(initialInteractions)
  const [deptStatuses, setDeptStatuses] = useState<DepartmentStatus[]>(initialStatuses)
  const [contacts, setContacts] = useState<Contact[]>(partner.partner_contacts)
  const [histories, setHistories] = useState<Record<string, StageHistoryEntry[]>>(initialHistories)
  const [ownerId, setOwnerId] = useState(partner.internal_owner_id ?? '')
  const [doNotEmail, setDoNotEmailState] = useState(partner.do_not_email ?? false)
  const [doNotEmailNotes, setDoNotEmailNotes] = useState(partner.do_not_email_notes ?? '')
  const [showDneForm, setShowDneForm] = useState(false)

  const initialTab: ActiveTab =
    (defaultDepartment && initialStatuses.some(s => s.department === defaultDepartment))
      ? defaultDepartment
      : initialStatuses.length > 0
        ? initialStatuses[0].department
        : 'edit'

  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab)
  const [editingProfile, setEditingProfile] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const types = partner.partner_type_assignments.map(t => TYPE_LABELS[t.partner_type] ?? t.partner_type)
  const primaryContact = partner.partner_contacts.find(c => c.is_primary) ?? partner.partner_contacts[0]
  const lastInteractionDate = interactions.length > 0
    ? interactions.reduce((latest, i) => (i.interaction_date > latest ? i.interaction_date : latest), interactions[0].interaction_date)
    : null
  const daysAgo = daysSince(lastInteractionDate)
  const followUpNeeded = daysAgo !== null && daysAgo >= 30

  function getStageFor(dept: PartnerDepartment) {
    return deptStatuses.find(s => s.department === dept)?.stage ?? ''
  }

  function updateStageInState(dept: PartnerDepartment, stage: string) {
    setDeptStatuses(prev => {
      const existing = prev.find(s => s.department === dept)
      if (existing) return prev.map(s => s.department === dept ? { ...s, stage } : s)
      return [...prev, { id: crypto.randomUUID(), department: dept, stage, updated_at: new Date().toISOString(), users: null }]
    })
    setHistories(prev => ({
      ...prev,
      [dept]: [...(prev[dept] ?? []), { id: crypto.randomUUID(), stage, changed_at: new Date().toISOString(), users: null }],
    }))
  }

  function handleStageChange(dept: PartnerDepartment, stage: string) {
    startTransition(async () => {
      await setDepartmentStatus(partner.id, dept, stage)
    })
    updateStageInState(dept, stage)
  }

  function handleAddDepartment(dept: PartnerDepartment) {
    startTransition(async () => {
      await setDepartmentStatus(partner.id, dept, '')
    })
    setDeptStatuses(prev => [...prev, { id: crypto.randomUUID(), department: dept, stage: '', updated_at: new Date().toISOString(), users: null }])
    setHistories(prev => ({
      ...prev,
      [dept]: [{ id: crypto.randomUUID(), stage: '', changed_at: new Date().toISOString(), users: null }],
    }))
    setActiveTab(dept)
  }

  function handleRemoveDepartment(dept: PartnerDepartment) {
    startTransition(async () => {
      await removeDepartmentStatus(partner.id, dept)
    })
    const remaining = deptStatuses.filter(s => s.department !== dept)
    setDeptStatuses(remaining)
    setHistories(prev => { const next = { ...prev }; delete next[dept]; return next })
    setActiveTab(remaining.length > 0 ? remaining[0].department : 'edit')
  }

  function handleInteractionLogged(interaction: Interaction) {
    setInteractions(prev => [interaction, ...prev])
  }

  async function handleDeleteInteraction(id: string) {
    await deleteInteraction(id, partner.id)
    setInteractions(prev => prev.filter(i => i.id !== id))
  }

  async function handleArchiveContact(contactId: string, archived: boolean) {
    await archiveContact(contactId, archived)
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, is_archived: archived } : c))
  }

  async function handleCreateContact(data: ContactData) {
    const result = await createContact(partner.id, data)
    if (!result.error && result.contact) {
      setContacts(prev => [...prev, result.contact as Contact])
    }
  }

  async function handleUpdateContact(contactId: string, data: ContactData) {
    await updateContact(contactId, data)
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, ...data } : c))
  }

  async function handleDeleteContact(contactId: string) {
    await deleteContact(contactId)
    setContacts(prev => prev.filter(c => c.id !== contactId))
  }

  function handleSetDoNotEmail(value: boolean, notes: string) {
    setDoNotEmailState(value)
    setDoNotEmailNotes(value ? notes : '')
    setShowDneForm(false)
    startTransition(async () => {
      await setDoNotEmail(partner.id, value, notes)
    })
  }

  function handleOwnerChange(newOwnerId: string) {
    setOwnerId(newOwnerId)
    startTransition(async () => {
      await setPartnerOwner(partner.id, newOwnerId || null)
    })
  }

  async function handleDelete() {
    setDeleting(true)
    const result = await onDeletePartner()
    if (result.error) { setDeleting(false); return }
    router.push('/instructor/partnerships')
  }

  const savedLocations = (partner.partner_locations ?? [])
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
    .map((l: { city: string | null; state: string | null }) => ({ city: l.city, state: l.state }))
  const legacyLocation = (partner.city || partner.state)
    ? [{ city: partner.city ?? null, state: partner.state ?? null }]
    : []
  const initialLocations = savedLocations.length > 0 ? savedLocations : legacyLocation

  const initialFormData: Partial<PartnerFormData> = {
    name: partner.name,
    city: partner.city,
    state: partner.state,
    multi_city: partner.multi_city,
    locations: initialLocations,
    website: partner.website,
    how_we_met: partner.how_we_met,
    services_focus_area: partner.services_focus_area,
    status: partner.status as PartnerFormData['status'],
    last_interaction_date: partner.last_interaction_date,
    meeting_notes: partner.meeting_notes,
    tags: partner.tags ?? [],
    internal_owner_id: partner.internal_owner_id,
    referred_by: partner.referred_by,
    partner_types: partner.partner_type_assignments.map(t => t.partner_type),
    contacts: partner.partner_contacts,
    departments: initialStatuses.map(s => s.department),
    service_categories: partner.service_categories ?? [],
    service_categories_other: partner.service_categories_other ?? null,
  }

  const tabs: { id: ActiveTab; label: string }[] = [
    ...deptStatuses.map(ds => ({ id: ds.department as ActiveTab, label: DEPARTMENT_LABELS[ds.department] })),
    { id: 'edit', label: 'Profile' },
  ]

  return (
    <div className="flex flex-col gap-6">

      {/* Header + department overview side by side */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold text-dark-text">{partner.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-text">
            {[
              partner.city ? `${partner.city}${partner.state ? `, ${partner.state}` : ''}${partner.multi_city ? ' + more' : ''}` : null,
              primaryContact ? `${primaryContact.name}${primaryContact.title ? `, ${primaryContact.title}` : ''}` : null,
            ].filter(Boolean).map((part, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted-text/50">·</span>}
                <span>{part}</span>
              </span>
            ))}
          </div>
        </div>

        {types.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {types.map(t => (
              <span key={t} className="text-xs bg-surface border border-border rounded px-2 py-0.5 text-muted-text">{t}</span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-sm">
          {lastInteractionDate ? (
            <span className="text-muted-text">
              Last contact: <span className="text-dark-text font-medium">{formatDate(lastInteractionDate)}</span>
              {daysAgo !== null && ` (${daysAgo}d ago)`}
            </span>
          ) : (
            <span className="text-muted-text">No interactions logged yet</span>
          )}
          {followUpNeeded && (
            <span className="text-xs font-medium rounded-full px-2.5 py-0.5 bg-red-100 text-red-700">Follow-up needed</span>
          )}
          {doNotEmail && (
            <span className="text-xs font-medium rounded-full px-2.5 py-0.5 bg-red-600 text-white">⊘ Do not email</span>
          )}
        </div>
      </div>

      {/* Department overview table */}
      <div className="lg:w-[26rem] lg:shrink-0">
        <DeptOverviewTable
          deptStatuses={deptStatuses}
          studentReferrals={studentReferrals}
          onTabClick={(dept) => setActiveTab(dept)}
          onAddDept={handleAddDepartment}
        />
      </div>
      </div>

      {/* Ratings summary (global, shown above tabs if any exist) */}
      {ratingSummary.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Ratings</h2>
          <div className="flex flex-col gap-2">
            {ratingSummary.map(row => (
              <div key={row.service_category} className="rounded-xl border border-border bg-surface px-4 py-3 flex flex-col gap-2">
                <p className="text-sm font-semibold text-dark-text">{row.service_category}</p>
                <div className="flex flex-col gap-1">
                  {[
                    { label: 'Students', data: row.student },
                    { label: 'Staff', data: row.staff },
                  ].map(({ label, data }) => (
                    <div key={label} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-text w-16 shrink-0">{label}</span>
                      {data ? (
                        <>
                          <span className="flex gap-0.5">
                            {[1,2,3,4,5].map(n => (
                              <span key={n} style={{ color: n <= Math.round(data.avg) ? '#FACC15' : '#9CA3AF' }}>★</span>
                            ))}
                          </span>
                          <span className="font-semibold text-dark-text">{data.avg.toFixed(1)}</span>
                          <span className="text-muted-text">({data.count} {data.count === 1 ? 'rating' : 'ratings'})</span>
                        </>
                      ) : (
                        <span className="text-muted-text">—</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tabs: one per enrolled dept + Edit Profile */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-teal-primary text-teal-primary'
                : 'border-transparent text-muted-text hover:text-dark-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Department tabs */}
      {deptStatuses.map(ds => {
        if (activeTab !== ds.department) return null
        const deptHist = histories[ds.department] ?? []
        const currentEntry = deptHist[deptHist.length - 1]
        const pastEntries = deptHist.slice(0, -1)
        return (
        <div key={ds.department} className="flex flex-col gap-6">

          {/* Remove button — top of tab content */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-text shrink-0">Owner</label>
              <select
                value={ownerId}
                onChange={e => handleOwnerChange(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
              >
                <option value="">Unassigned</option>
                {staffUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => handleRemoveDepartment(ds.department)}
              className="text-xs border border-border rounded-lg px-3 py-1.5 text-muted-text hover:border-red-400 hover:text-red-500 transition-colors shrink-0"
            >
              Remove from {DEPARTMENT_LABELS[ds.department]}
            </button>
          </div>

          {/* 2-col: Log Interaction | Status + Stage History */}
          <div className={DEPARTMENT_STAGES[ds.department].length > 0 ? 'grid md:grid-cols-2 gap-6 items-start' : ''}>
            <LogInteractionForm
              partnerId={partner.id}
              defaultDepartment={ds.department}
              availableStages={DEPARTMENT_STAGES[ds.department]}
              onLogged={handleInteractionLogged}
              onStageUpdated={(stage) => updateStageInState(ds.department, stage)}
            />
            {DEPARTMENT_STAGES[ds.department].length > 0 && (
              <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
                {/* Current status */}
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-semibold text-dark-text uppercase tracking-wide">Current Status</h3>
                  <div className="flex items-center gap-2">
                    <select
                      value={getStageFor(ds.department)}
                      onChange={e => handleStageChange(ds.department, e.target.value)}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                    >
                      <option value="">— Select status —</option>
                      {DEPARTMENT_STAGES[ds.department].map(stage => (
                        <option key={stage} value={stage}>{stage}</option>
                      ))}
                    </select>
                    {isPending && <span className="text-xs text-muted-text shrink-0">Saving…</span>}
                  </div>
                  {currentEntry?.stage && (
                    <span className="text-xs text-muted-text">
                      Updated {new Date(currentEntry.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {currentEntry.users?.name && ` · ${currentEntry.users.name}`}
                    </span>
                  )}
                </div>

                {/* Stage history (past stages only) */}
                {pastEntries.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-border pt-4">
                    <h4 className="text-xs font-semibold text-muted-text uppercase tracking-wide">Stage History</h4>
                    <StageHistory history={pastEntries} />
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Do not email */}
          <div className="flex flex-col gap-2">
            {doNotEmail ? (
              <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-red-700">⊘ Do not email</span>
                  <button
                    type="button"
                    onClick={() => handleSetDoNotEmail(false, '')}
                    className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-md bg-red-700 text-white hover:bg-red-900 transition-colors"
                  >
                    Remove flag
                  </button>
                </div>
                {doNotEmailNotes && (
                  <p className="text-sm text-red-800 whitespace-pre-line">{doNotEmailNotes}</p>
                )}
              </div>
            ) : showDneForm ? (
              <div className="rounded-lg border border-border bg-surface p-4 flex flex-col gap-3">
                <p className="text-xs font-semibold text-dark-text uppercase tracking-wide">Mark as do not email</p>
                <textarea
                  value={doNotEmailNotes}
                  onChange={e => setDoNotEmailNotes(e.target.value)}
                  rows={3}
                  placeholder="Why should this org not be emailed? (e.g. 3 unanswered emails since March)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSetDoNotEmail(true, doNotEmailNotes)}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDneForm(false); setDoNotEmailNotes('') }}
                    className="text-xs text-muted-text hover:text-dark-text transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDneForm(true)}
                className="self-start text-xs text-muted-text hover:text-red-500 transition-colors"
              >
                Mark as do not email…
              </button>
            )}
          </div>

          {/* Past interactions */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">
              {DEPARTMENT_LABELS[ds.department]} Interactions
            </h2>
            <InteractionList
              interactions={interactions.filter(i => i.department === ds.department)}
              onDelete={handleDeleteInteraction}
            />
          </section>

          {/* Contacts */}
          <ContactsSection
            contacts={contacts}
            currentDept={ds.department}
            enrolledDepts={deptStatuses.map(s => s.department)}
            onArchive={handleArchiveContact}
            onUpdate={handleUpdateContact}
            onDelete={handleDeleteContact}
            onCreate={handleCreateContact}
          />

          {/* Student referrals */}
          {ds.department === 'admissions' && (
            <StudentReferralsSection
              partnerId={partner.id}
              referrals={studentReferrals}
              direction="inbound"
            />
          )}
          {ds.department === 'student_success' && (
            <StudentReferralsSection
              partnerId={partner.id}
              referrals={studentReferrals}
              direction="outbound"
            />
          )}

          {/* Details */}
          <DetailsSection partner={partner} />

        </div>
        )
      })}

      {/* Profile tab */}
      {activeTab === 'edit' && (
        <div className="flex flex-col gap-8">
          {!editingProfile ? (
            <>
              <ProfileView
                partner={partner}
                types={types}
                deptStatuses={deptStatuses}
                onEdit={() => setEditingProfile(true)}
              />
              <section className="flex flex-col gap-3 border-t border-border pt-6">
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="self-start text-sm text-red-500 hover:text-red-700 transition-colors"
                  >
                    Delete this partner…
                  </button>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-sm text-dark-text">Delete <strong>{partner.name}</strong> and all related data? This cannot be undone.</p>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {deleting ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(false)} className="text-sm text-muted-text hover:text-dark-text transition-colors">
                      Cancel
                    </button>
                  </div>
                )}
              </section>
            </>
          ) : (
            <PartnerForm
              initialData={initialFormData}
              staffUsers={staffUsers}
              hideRelational
              onSubmit={async (data) => {
                const result = await onUpdatePartner(data)
                if (!result.error) setEditingProfile(false)
                return result
              }}
              onCancel={() => setEditingProfile(false)}
              submitLabel="Save Changes"
              partnerId={partner.id}
            />
          )}
        </div>
      )}
    </div>
  )
}
