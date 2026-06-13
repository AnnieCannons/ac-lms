'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Globe, MapPin, Mail, Phone, Link, Pencil, Plus, ChevronDown, ChevronRight,
  LayoutGrid, AlarmClock, Calendar, User as UserIcon, Trash2, Archive,
} from 'lucide-react'
import {
  logInteraction,
  deleteInteraction,
  setDepartmentStatus,
  removeDepartmentStatus,
  setDepartmentDoNotEmail,
  createReferral,
  deleteReferral,
  type PartnerDepartment,
} from '@/lib/partner-interactions-actions'
import { archiveContact, createContact, updateContact, deleteContact, setPartnerOwner, type ContactData } from '@/lib/partner-actions'
import { DEPARTMENT_LABELS, DEPARTMENT_STAGES, DEPT_COLORS, STAGE_COLORS } from '@/lib/partner-constants'
import PartnerForm from '@/components/ui/PartnerForm'
import { type StageHistoryEntry } from '@/components/ui/StageHistory'
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
  primary_departments?: string[] | null
}

interface Interaction {
  id: string
  note: string
  interaction_date: string
  department: PartnerDepartment | null
  created_at: string
  user_id: string | null
  users: { name: string } | null
  contact_id?: string | null
  partner_contacts?: { name: string; title: string | null } | null
  reminder_days?: number | null
  reminder_at?: string | null
}

interface DepartmentStatus {
  id: string
  department: PartnerDepartment
  stage: string
  updated_at: string
  users: { name: string } | null
  do_not_email?: boolean
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

type ActiveTab = 'overview' | PartnerDepartment | 'edit'

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

// ─── Constants & helpers ───────────────────────────────────────────────────────

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

const DEPT_DOT: Record<PartnerDepartment, string> = {
  student_success: 'bg-purple-500',
  career_development: 'bg-teal-500',
  resourcefull: 'bg-blue-500',
  funding_partnerships: 'bg-green-500',
  admissions: 'bg-orange-500',
}

const DEPT_CARD_TINT: Record<PartnerDepartment, string> = {
  student_success: 'bg-purple-500/5 border-purple-500/20 hover:bg-purple-500/10',
  career_development: 'bg-teal-500/5 border-teal-500/20 hover:bg-teal-500/10',
  resourcefull: 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10',
  funding_partnerships: 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10',
  admissions: 'bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10',
}

// Left-border accent colour for interaction cards in the overview timeline
const DEPT_CARD_ACCENT: Record<PartnerDepartment, string> = {
  student_success: 'border-l-purple-500',
  career_development: 'border-l-teal-500',
  resourcefull: 'border-l-blue-500',
  funding_partnerships: 'border-l-green-500',
  admissions: 'border-l-orange-500',
}

const AVATAR_PALETTE = [
  'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200',
  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
]

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function avatarClasses(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// Render a stored reminder interval (whole days) back into a friendly label.
function humanizeReminder(days: number | null | undefined): string | null {
  if (!days || days <= 0) return null
  if (days % 30 === 0) { const m = days / 30; return `${m} ${m === 1 ? 'month' : 'months'}` }
  if (days % 7 === 0) { const w = days / 7; return `${w} ${w === 1 ? 'week' : 'weeks'}` }
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10"
      onClick={onClose}
    >
      <div className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// ─── Add-department dropdown ────────────────────────────────────────────────────

function AddDepartmentDropdown({
  enrolledDepts,
  onAdd,
  label = 'Department',
  variant = 'default',
}: {
  enrolledDepts: PartnerDepartment[]
  onAdd: (dept: PartnerDepartment) => void
  label?: string
  variant?: 'default' | 'tab'
}) {
  const [open, setOpen] = useState(false)
  const unenrolled = ALL_DEPARTMENTS.filter(d => !enrolledDepts.includes(d))
  if (unenrolled.length === 0) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={
          variant === 'tab'
            ? 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-border text-muted-text hover:border-teal-primary hover:text-teal-primary transition-colors whitespace-nowrap'
            : 'text-sm text-teal-primary hover:underline whitespace-nowrap'
        }
      >
        {variant === 'tab' && <Plus className="w-3.5 h-3.5" />}
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-20 rounded-xl border border-border bg-surface shadow-lg py-1 min-w-48">
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

// ─── Log Contact form ───────────────────────────────────────────────────────────

type RemindUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months'

function LogInteractionForm({
  partnerId,
  defaultDepartment,
  availableStages = [],
  contacts,
  onLogged,
  onStageUpdated,
  onCancel,
}: {
  partnerId: string
  defaultDepartment?: PartnerDepartment
  availableStages?: string[]
  contacts: Contact[]
  onLogged: (interaction: Interaction) => void
  onStageUpdated?: (stage: string) => void
  onCancel?: () => void
}) {
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [department, setDepartment] = useState<PartnerDepartment | ''>(defaultDepartment ?? '')
  const [contactId, setContactId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReminder, setShowReminder] = useState(false)
  const [remindValue, setRemindValue] = useState(1)
  const [remindUnit, setRemindUnit] = useState<RemindUnit>('weeks')
  const [updateStatus, setUpdateStatus] = useState(false)
  const [newStage, setNewStage] = useState('')

  const selectedContact = contactId ? contacts.find(c => c.id === contactId) ?? null : null

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

    const remindInDays = showReminder ? getRemindInDays() : null
    const result = await logInteraction({
      partner_id: partnerId,
      note: note.trim(),
      interaction_date: date,
      department: department || null,
      contact_id: contactId || null,
      remind_in_days: remindInDays,
    })

    if (result.error) { setSaving(false); setError(result.error); return }

    if (updateStatus && newStage && defaultDepartment) {
      await setDepartmentStatus(partnerId, defaultDepartment, newStage)
      onStageUpdated?.(newStage)
    }

    const reminderDays = remindInDays && remindInDays > 0 ? Math.round(remindInDays) : null
    const reminderAt = remindInDays && remindInDays > 0
      ? new Date(Date.now() + remindInDays * 86400 * 1000).toISOString().slice(0, 10)
      : null

    onLogged({
      id: crypto.randomUUID(),
      note: note.trim(),
      interaction_date: date,
      department: department || null,
      created_at: new Date().toISOString(),
      user_id: null,
      users: null,
      contact_id: contactId || null,
      partner_contacts: selectedContact ? { name: selectedContact.name, title: selectedContact.title } : null,
      reminder_days: reminderDays,
      reminder_at: reminderAt,
    })
    setSaving(false)
    onCancel?.()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-lg">
      <h3 className="text-sm font-semibold text-dark-text">Log Contact</h3>

      <div>
        <label className="block text-xs text-muted-text mb-1">Contact person</label>
        <select
          value={contactId}
          onChange={e => setContactId(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
        >
          <option value="">General Note (no specific contact)</option>
          {contacts.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.title ? ` — ${c.title}` : ''}
            </option>
          ))}
        </select>
      </div>

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

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !note.trim()}
          className="px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Logging…' : 'Log Contact'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-muted-text hover:text-dark-text transition-colors">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

// ─── Activity rows (interactions + status changes) ──────────────────────────────

function InteractionRow({
  interaction,
  onDelete,
  showDepartment = false,
}: {
  interaction: Interaction
  onDelete: (id: string) => void
  showDepartment?: boolean
}) {
  const reminderLabel = humanizeReminder(interaction.reminder_days)
  const contactName = interaction.partner_contacts?.name
  return (
    <div className="group flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-text min-w-0">
          <span className="inline-flex items-center gap-1 text-dark-text text-sm font-medium">
            <UserIcon className="w-3.5 h-3.5 text-muted-text" />
            {contactName || 'General note'}
          </span>
          {showDepartment && interaction.department && (
            <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${DEPT_COLORS[interaction.department]}`}>
              {DEPARTMENT_LABELS[interaction.department]}
            </span>
          )}
          {interaction.users?.name && <span>· {interaction.users.name}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 text-xs text-muted-text">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(interaction.interaction_date)}
          </span>
          <button
            type="button"
            onClick={() => onDelete(interaction.id)}
            aria-label="Delete interaction"
            className="text-muted-text hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <p className="text-sm text-dark-text whitespace-pre-line">{interaction.note}</p>
      {interaction.reminder_at && (
        <span className="self-start inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 bg-teal-primary/10 text-teal-primary">
          <AlarmClock className="w-3.5 h-3.5" />
          Slack reminder{reminderLabel ? ` · ${reminderLabel}` : ''} ({formatDate(interaction.reminder_at)})
        </span>
      )}
    </div>
  )
}

function StatusRow({ entry }: { entry: StageHistoryEntry }) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-text">
      {entry.stage ? (
        <>
          <span className="text-dark-text">Status changed to</span>
          <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${STAGE_COLORS[entry.stage] ?? 'bg-background text-dark-text border border-border'}`}>
            {entry.stage}
          </span>
        </>
      ) : (
        <span className="text-dark-text">Added to department</span>
      )}
      <span>· {formatDate(entry.changed_at.slice(0, 10))}</span>
      {entry.users?.name && <span>· {entry.users.name}</span>}
    </div>
  )
}

function DepartmentActivity({
  interactions,
  history,
  onDelete,
}: {
  interactions: Interaction[]
  history: StageHistoryEntry[]
  onDelete: (id: string) => void
}) {
  type Item =
    | { kind: 'interaction'; ts: number; key: string; data: Interaction }
    | { kind: 'status'; ts: number; key: string; data: StageHistoryEntry }

  const items: Item[] = [
    ...interactions.map((i): Item => ({
      kind: 'interaction',
      ts: i.created_at ? Date.parse(i.created_at) : Date.parse(i.interaction_date + 'T00:00:00'),
      key: `i-${i.id}`,
      data: i,
    })),
    ...history.map((h): Item => ({
      kind: 'status',
      ts: Date.parse(h.changed_at),
      key: `s-${h.id}`,
      data: h,
    })),
  ].sort((a, b) => b.ts - a.ts)

  if (items.length === 0) {
    return <p className="text-sm text-muted-text">No activity yet.</p>
  }

  return (
    <ol className="flex flex-col">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        return (
          <li key={item.key} className="flex gap-3 pb-4 last:pb-0">
            <div className="flex flex-col items-center">
              {item.kind === 'interaction'
                ? <span className="mt-1 w-2.5 h-2.5 rounded-full bg-teal-primary shrink-0" />
                : <span className="mt-1 w-2.5 h-2.5 rounded-full border-2 border-border bg-background shrink-0" />}
              {!isLast && <span className="flex-1 w-px bg-border mt-1" />}
            </div>
            <div className="flex-1 min-w-0 -mt-0.5">
              {item.kind === 'interaction'
                ? (
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <InteractionRow interaction={item.data} onDelete={onDelete} />
                  </div>
                )
                : <StatusRow entry={item.data} />}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ─── Department overview cards ───────────────────────────────────────────────────

function DepartmentOverviewCards({
  deptStatuses,
  interactions,
  studentReferrals,
  onOpenDept,
}: {
  deptStatuses: DepartmentStatus[]
  interactions: Interaction[]
  studentReferrals: Referral[]
  onOpenDept: (dept: PartnerDepartment) => void
}) {
  const inboundCount = studentReferrals.filter(r => r.direction === 'inbound').length
  const outboundCount = studentReferrals.filter(r => r.direction === 'outbound').length

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {deptStatuses.map(ds => {
        const recent = interactions.filter(i => i.department === ds.department)[0]
        const hasStages = DEPARTMENT_STAGES[ds.department].length > 0
        return (
          <button
            key={ds.department}
            type="button"
            onClick={() => onOpenDept(ds.department)}
            className={`text-left rounded-xl border p-4 flex flex-col gap-3 transition-colors ${DEPT_CARD_TINT[ds.department]}`}
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 font-semibold text-dark-text text-sm">
                <span className={`w-2 h-2 rounded-full shrink-0 ${DEPT_DOT[ds.department]}`} />
                {DEPARTMENT_LABELS[ds.department]}
              </span>
              {hasStages && (
                ds.stage ? (
                  <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${STAGE_COLORS[ds.stage] ?? 'bg-background text-dark-text border border-border'}`}>
                    {ds.stage}
                  </span>
                ) : (
                  <span className="text-xs text-muted-text italic">No status set</span>
                )
              )}
            </div>
            {recent ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3 text-xs text-muted-text flex-wrap">
                  <span className="inline-flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 shrink-0" />{recent.partner_contacts?.name || 'General note'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />{formatDate(recent.interaction_date)}
                  </span>
                </div>
                <p className="text-sm text-muted-text line-clamp-3 leading-relaxed">{recent.note}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-text italic">No contact logged yet.</p>
            )}
            {(ds.department === 'admissions' || ds.department === 'student_success') && (
              <span className="text-xs text-muted-text">
                {ds.department === 'admissions' ? `${inboundCount} referred in` : `${outboundCount} referred out`}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Contact form ────────────────────────────────────────────────────────────────

function ContactForm({
  initialData,
  enrolledDepts,
  onSubmit,
  onCancel,
}: {
  initialData?: Partial<Contact>
  enrolledDepts: PartnerDepartment[]
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
  const [selectedDepts, setSelectedDepts] = useState<PartnerDepartment[]>(
    (initialData?.departments ?? []) as PartnerDepartment[]
  )
  const [primaryDepts, setPrimaryDepts] = useState<PartnerDepartment[]>(
    (initialData?.primary_departments ?? []) as PartnerDepartment[]
  )
  const [saving, setSaving] = useState(false)

  // A contact scoped to specific departments can only be primary for those;
  // a shared contact (no departments) can be primary for any enrolled department.
  const primaryChoices = selectedDepts.length > 0 ? selectedDepts : enrolledDepts

  function toggleDept(dept: PartnerDepartment) {
    const removing = selectedDepts.includes(dept)
    setSelectedDepts(prev => removing ? prev.filter(d => d !== dept) : [...prev, dept])
    // Drop any primary flag for a department the contact is no longer in.
    if (removing) setPrimaryDepts(prev => prev.filter(d => d !== dept))
  }

  function togglePrimary(dept: PartnerDepartment) {
    setPrimaryDepts(prev =>
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const validPrimary = primaryDepts.filter(d => primaryChoices.includes(d))
    await onSubmit({
      name: name.trim(),
      title: title.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      website_url: websiteUrl.trim() || null,
      is_primary: validPrimary.length > 0,
      departments: selectedDepts.length > 0 ? selectedDepts : null,
      primary_departments: validPrimary,
    })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-lg">
      <h3 className="text-sm font-semibold text-dark-text">{initialData?.id ? 'Edit Contact' : 'Add Contact'}</h3>
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
      {primaryChoices.length > 0 && (
        <div>
          <label className="block text-xs text-muted-text mb-1.5">Primary contact for</label>
          <div className="flex flex-wrap gap-3">
            {primaryChoices.map(dept => (
              <label key={dept} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <input type="checkbox" checked={primaryDepts.includes(dept)} onChange={() => togglePrimary(dept)}
                  className="accent-teal-primary" />
                {DEPARTMENT_LABELS[dept]}
              </label>
            ))}
          </div>
        </div>
      )}
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

// ─── Contact card + sidebar ──────────────────────────────────────────────────────

function ContactCard({
  contact,
  enrolledDepts,
  onArchive,
  onEdit,
  onDelete,
}: {
  contact: Contact
  enrolledDepts: PartnerDepartment[]
  onArchive: (id: string, archived: boolean) => void
  onEdit: (contact: Contact) => void
  onDelete: (id: string) => void
}) {
  const isArchived = !!contact.is_archived
  const isShared = !contact.departments || contact.departments.length === 0
  const memberDepts: PartnerDepartment[] = isShared
    ? enrolledDepts
    : (contact.departments as PartnerDepartment[])
  const primaryDepts = (contact.primary_departments ?? []) as PartnerDepartment[]
  const hasContactInfo = !!(contact.email || contact.phone || contact.linkedin_url || contact.website_url)

  return (
    <div className={`rounded-xl border border-border bg-surface p-3 flex flex-col gap-2 transition-opacity ${isArchived ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${avatarClasses(contact.name)}`}>
          {initials(contact.name)}
        </span>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`font-semibold text-sm truncate ${isArchived ? 'text-muted-text' : 'text-dark-text'}`}>
                {contact.name}
              </span>
              {isArchived && (
                <span className="shrink-0 text-xs bg-background text-muted-text rounded-full px-2 py-0.5 border border-border">Archived</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!isArchived && contact.id && (
                <button type="button" onClick={() => onEdit(contact)} aria-label="Edit contact"
                  className="text-muted-text hover:text-dark-text transition-colors p-1 rounded hover:bg-background">
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              {contact.id && (
                <button type="button" onClick={() => onArchive(contact.id!, !isArchived)}
                  aria-label={isArchived ? 'Unarchive contact' : 'Archive contact'}
                  title={isArchived ? 'Unarchive' : 'Archive'}
                  className="text-muted-text hover:text-dark-text transition-colors p-1 rounded hover:bg-background">
                  <Archive className="w-3 h-3" />
                </button>
              )}
              {isArchived && contact.id && (
                <button type="button" onClick={() => onDelete(contact.id!)} aria-label="Delete contact"
                  className="text-muted-text hover:text-red-500 transition-colors p-1 rounded hover:bg-background">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          {contact.title && (
            <span className={`text-xs ${isArchived ? 'text-muted-text/60' : 'text-muted-text'}`}>{contact.title}</span>
          )}
        </div>
      </div>

      {!isArchived && memberDepts.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-[52px]">
          {memberDepts.map(d => (
            <span key={d} className={`text-xs font-medium rounded-full px-2 py-0.5 ${DEPT_COLORS[d]}`}>
              {DEPARTMENT_LABELS[d]}{primaryDepts.includes(d) ? ' · Primary' : ''}
            </span>
          ))}
        </div>
      )}

      {!isArchived && hasContactInfo && (
        <div className="flex flex-col gap-1 text-xs pl-[52px]">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 text-muted-text hover:text-teal-primary transition-colors break-all">
              <Mail className="w-3.5 h-3.5 shrink-0" />{contact.email}
            </a>
          )}
          {contact.phone && (
            <span className="inline-flex items-center gap-1.5 text-muted-text">
              <Phone className="w-3.5 h-3.5 shrink-0" />{contact.phone}
            </span>
          )}
          {contact.linkedin_url && (
            <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-muted-text hover:text-teal-primary transition-colors">
              <Link className="w-3.5 h-3.5 shrink-0" />LinkedIn
            </a>
          )}
          {contact.website_url && (
            <a href={contact.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-muted-text hover:text-teal-primary transition-colors break-all">
              <Globe className="w-3.5 h-3.5 shrink-0" />Website
            </a>
          )}
        </div>
      )}
      {contact.notes && !isArchived && <p className="text-xs text-muted-text whitespace-pre-line pl-[52px]">{contact.notes}</p>}
    </div>
  )
}

function ContactsSidebar({
  contacts,
  enrolledDepts,
  onArchive,
  onEdit,
  onDelete,
}: {
  contacts: Contact[]
  enrolledDepts: PartnerDepartment[]
  onArchive: (id: string, archived: boolean) => void
  onEdit: (contact: Contact) => void
  onDelete: (id: string) => void
}) {
  const active = contacts
    .filter(c => !c.is_archived)
    .sort((a, b) => {
      const aP = (a.primary_departments?.length ?? 0) > 0
      const bP = (b.primary_departments?.length ?? 0) > 0
      return aP === bP ? 0 : aP ? -1 : 1
    })
  const archived = contacts.filter(c => c.is_archived)
  const [showArchived, setShowArchived] = useState(false)

  return (
    <section className="flex flex-col gap-3">
      {active.length === 0 ? (
        <p className="text-sm text-muted-text">No contacts yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {active.map(c => (
            <ContactCard
              key={c.id ?? c.name}
              contact={c}
              enrolledDepts={enrolledDepts}
              onArchive={onArchive}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
      {archived.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowArchived(s => !s)}
            className="self-start text-xs text-muted-text hover:text-dark-text transition-colors"
          >
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </button>
          {showArchived && archived.map(c => (
            <ContactCard
              key={c.id ?? c.name}
              contact={c}
              enrolledDepts={enrolledDepts}
              onArchive={onArchive}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Profile view (read-only, edit tab) ──────────────────────────────────────────

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

// ─── Student Referrals Section ───────────────────────────────────────────────────

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

function RatingsSummary({ ratingSummary }: { ratingSummary: PartnerRatingSummaryRow[] }) {
  if (ratingSummary.length === 0) return null
  return (
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
                        {[1, 2, 3, 4, 5].map(n => (
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
  )
}

// ─── Scrollable tab row with edge-fade hints ──────────────────────────────────

function ScrollableTabs({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true) // assume at end until user scrolls

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setAtStart(el.scrollLeft < 4)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
  }, [])

  return (
    <div className="relative flex-1 min-w-0">
      {!atStart && (
        <div className="pointer-events-none absolute left-0 inset-y-0 w-10 z-10 bg-gradient-to-r from-background to-transparent" />
      )}
      {!atEnd && (
        <div className="pointer-events-none absolute right-0 inset-y-0 w-10 z-10 bg-gradient-to-l from-background to-transparent" />
      )}
      <div
        ref={ref}
        className="flex gap-1 items-center overflow-x-auto scrollbar-none"
        onScroll={update}
      >
        {children}
      </div>
    </div>
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

  // Modals
  const [logModalDept, setLogModalDept] = useState<PartnerDepartment | null>(null)
  const [contactModal, setContactModal] = useState<{ mode: 'add' } | { mode: 'edit'; contact: Contact } | null>(null)

  // Navigation
  const defaultEnrolled = !!defaultDepartment && initialStatuses.some(s => s.department === defaultDepartment)
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    defaultEnrolled ? (defaultDepartment as PartnerDepartment) : 'overview'
  )
  const [statusEditDept, setStatusEditDept] = useState<PartnerDepartment | null>(null)
  const [activityOpen, setActivityOpen] = useState(true)
  const [editingProfile, setEditingProfile] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const types = partner.partner_type_assignments.map(t => TYPE_LABELS[t.partner_type] ?? t.partner_type)
  const enrolledDepts = deptStatuses.map(s => s.department)
  const location = partner.city
    ? `${partner.city}${partner.state ? `, ${partner.state}` : ''}${partner.multi_city ? ' + more' : ''}`
    : null

  // Contacts visible to a given department (for the Log Contact dropdown).
  function contactsForDept(dept: PartnerDepartment) {
    return contacts.filter(c =>
      !c.is_archived && (!c.departments || c.departments.length === 0 || (c.departments as string[]).includes(dept))
    )
  }

  function selectDept(dept: PartnerDepartment) {
    setActiveTab(dept)
    setStatusEditDept(null)
  }

  function updateStageInState(dept: PartnerDepartment, stage: string) {
    setDeptStatuses(prev => {
      const existing = prev.find(s => s.department === dept)
      if (existing) return prev.map(s => s.department === dept ? { ...s, stage } : s)
      return [...prev, { id: crypto.randomUUID(), department: dept, stage, updated_at: new Date().toISOString(), users: null, do_not_email: false }]
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
    setDeptStatuses(prev => [...prev, { id: crypto.randomUUID(), department: dept, stage: '', updated_at: new Date().toISOString(), users: null, do_not_email: false }])
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
    setStatusEditDept(null)
    if (remaining.length === 0) {
      setActiveTab('overview')
    } else if (activeTab === dept) {
      setActiveTab(remaining[0].department)
    }
  }

  function handleDeptDoNotEmail(dept: PartnerDepartment, value: boolean) {
    setDeptStatuses(prev => prev.map(s => s.department === dept ? { ...s, do_not_email: value } : s))
    startTransition(async () => {
      const { interaction } = await setDepartmentDoNotEmail(partner.id, dept, value)
      if (interaction) {
        setInteractions(prev => [interaction as Interaction, ...prev])
      }
    })
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

  // Mirror the server's "one primary per department" rule in local state so the
  // sidebar doesn't briefly show two primaries for the same department.
  function applyPrimaryExclusivity(list: Contact[], keepId: string | undefined, primaryDepts: string[]) {
    if (!primaryDepts || primaryDepts.length === 0) return list
    return list.map(c =>
      c.id === keepId
        ? c
        : { ...c, primary_departments: (c.primary_departments ?? []).filter(d => !primaryDepts.includes(d)) }
    )
  }

  async function handleCreateContact(data: ContactData) {
    const result = await createContact(partner.id, data)
    if (!result.error && result.contact) {
      const created = result.contact as Contact
      setContacts(prev => applyPrimaryExclusivity([...prev, created], created.id, data.primary_departments))
    }
  }

  async function handleUpdateContact(contactId: string, data: ContactData) {
    await updateContact(contactId, data)
    setContacts(prev => {
      const merged = prev.map(c => c.id === contactId ? { ...c, ...data } : c)
      return applyPrimaryExclusivity(merged, contactId, data.primary_departments)
    })
  }

  async function handleDeleteContact(contactId: string) {
    await deleteContact(contactId)
    setContacts(prev => prev.filter(c => c.id !== contactId))
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

  const tabClass = (tab: ActiveTab) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
      activeTab === tab
        ? 'bg-teal-primary/10 text-teal-primary font-semibold'
        : 'text-muted-text hover:text-dark-text hover:bg-background'
    }`

  const activePanelDept = deptStatuses.find(s => s.department === activeTab) ?? null

  return (
    <div className="flex flex-col gap-6">

      {/* Header card */}
      <header className="rounded-xl border border-border bg-surface px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar — fixed px so the 22px base font-size doesn't inflate it */}
          <span className="shrink-0 w-[44px] h-[44px] rounded-xl bg-teal-primary text-white font-bold text-sm flex items-center justify-center">
            {initials(partner.name)}
          </span>
          <div className="flex flex-col gap-0.5 min-w-0">
            <h1 className="text-base font-bold text-dark-text leading-snug">{partner.name}</h1>
            {(partner.website || location) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-text">
                {partner.website && (
                  <a href={partner.website} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-teal-primary transition-colors">
                    <Globe className="w-3 h-3 shrink-0" />{partner.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />{location}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setEditingProfile(true); setActiveTab('edit') }}
          className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-text hover:text-dark-text transition-colors"
        >
          <Pencil className="w-3 h-3" />Edit
        </button>
      </header>

      {/* Two-column layout: contacts card (left) + tab bar & content (right) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* Left: Contacts card */}
        <aside className="w-full lg:w-72 lg:shrink-0 rounded-xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-dark-text">Contacts</h2>
            <button
              type="button"
              onClick={() => setContactModal({ mode: 'add' })}
              className="inline-flex items-center gap-1 text-xs font-medium border border-teal-primary text-teal-primary px-3 py-1 rounded-lg hover:bg-teal-primary hover:[color:var(--color-background)] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />Add Contact
            </button>
          </div>
          <div className="p-3">
            <ContactsSidebar
              contacts={contacts}
              enrolledDepts={enrolledDepts}
              onArchive={handleArchiveContact}
              onEdit={(c) => setContactModal({ mode: 'edit', contact: c })}
              onDelete={handleDeleteContact}
            />
          </div>
        </aside>

        {/* Right: tab bar + content */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Tab bar */}
          {activeTab !== 'edit' && (
            <div className="flex items-center border-b border-border pb-1 gap-2">
              {/* Tabs — scrollable with fade hints when content is clipped */}
              <ScrollableTabs>
                <button type="button" onClick={() => setActiveTab('overview')} className={tabClass('overview')}>
                  <LayoutGrid className="w-4 h-4" />Overview
                </button>
                {deptStatuses.map(ds => (
                  <button
                    key={ds.department}
                    type="button"
                    onClick={() => selectDept(ds.department)}
                    className={tabClass(ds.department)}
                  >
                    <span className={`w-2 h-2 rounded-full ${activeTab === ds.department ? 'bg-teal-primary' : DEPT_DOT[ds.department]}`} />
                    {DEPARTMENT_LABELS[ds.department]}
                  </button>
                ))}
              </ScrollableTabs>
              {/* + Department — outside scroll so its dropdown isn't clipped */}
              <div className="shrink-0">
                <AddDepartmentDropdown enrolledDepts={enrolledDepts} onAdd={handleAddDepartment} variant="tab" />
              </div>
            </div>
          )}

          {/* Overview tab */}
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-6">
              {deptStatuses.length === 0 ? (
                <section className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-sm text-muted-text">Not enrolled in any department yet. Use the <strong>+ Dept</strong> button in the tab bar to add one.</p>
                </section>
              ) : (
                <section className="flex flex-col gap-3">
                  <div className="flex flex-col">
                    <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Department Overview</h2>
                    <p className="text-xs text-muted-text">Most recent contact per department</p>
                  </div>
                  <DepartmentOverviewCards
                    deptStatuses={deptStatuses}
                    interactions={interactions}
                    studentReferrals={studentReferrals}
                    onOpenDept={(dept) => selectDept(dept)}
                  />
                </section>
              )}

              <RatingsSummary ratingSummary={ratingSummary} />

              <section className="flex flex-col gap-3">
                <div className="flex flex-col">
                  <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Activity History</h2>
                  <p className="text-xs text-muted-text">All departments</p>
                </div>
                {interactions.length === 0 ? (
                  <p className="text-sm text-muted-text">No activity yet.</p>
                ) : (
                  <ol className="flex flex-col">
                    {[...interactions]
                      .sort((a, b) => {
                        const ta = a.created_at ? Date.parse(a.created_at) : Date.parse(a.interaction_date + 'T00:00:00')
                        const tb = b.created_at ? Date.parse(b.created_at) : Date.parse(b.interaction_date + 'T00:00:00')
                        return tb - ta
                      })
                      .map((i, idx, arr) => {
                        const dept = i.department
                        const dotColor = dept ? DEPT_DOT[dept] : 'bg-plum-primary'
                        const accentBorder = dept ? DEPT_CARD_ACCENT[dept] : null
                        const isLast = idx === arr.length - 1
                        return (
                          <li key={i.id} className="flex gap-3 pb-4 last:pb-0">
                            <div className="flex flex-col items-center shrink-0">
                              <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                              {!isLast && <span className="flex-1 w-px bg-border mt-1" />}
                            </div>
                            <div className="flex-1 min-w-0 -mt-0.5">
                              <div className={`rounded-xl border border-border bg-surface p-4${accentBorder ? ` border-l-4 ${accentBorder}` : ''}`}>
                                <InteractionRow interaction={i} onDelete={handleDeleteInteraction} showDepartment />
                              </div>
                            </div>
                          </li>
                        )
                      })}
                  </ol>
                )}
              </section>
            </div>
          )}

          {/* Department panel — shown when the active tab is an enrolled department */}
          {activePanelDept && (() => {
                    const ds = activePanelDept
                    const dept = ds.department
                    const hasStages = DEPARTMENT_STAGES[dept].length > 0
                    const deptInteractions = interactions.filter(i => i.department === dept)
                    const deptHistory = histories[dept] ?? []
                    const editingStatus = statusEditDept === dept
                    return (
                      <div className="flex flex-col gap-5">

                        {/* Status + actions */}
                        <section className="rounded-xl border border-border bg-surface px-4 py-3 flex flex-col gap-3">
                          {/* Row 1: status badge + Log Contact */}
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              {hasStages ? (
                                editingStatus ? (
                                  <select
                                    value={ds.stage}
                                    onChange={e => { handleStageChange(dept, e.target.value); setStatusEditDept(null) }}
                                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                                  >
                                    <option value="">— Select status —</option>
                                    {DEPARTMENT_STAGES[dept].map(stage => (
                                      <option key={stage} value={stage}>{stage}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <>
                                    {ds.stage ? (
                                      <span className={`text-sm font-medium rounded-full px-2.5 py-0.5 ${STAGE_COLORS[ds.stage] ?? 'bg-background text-dark-text border border-border'}`}>
                                        {ds.stage}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-muted-text">No status set</span>
                                    )}
                                    <button type="button" onClick={() => setStatusEditDept(dept)} className="text-xs text-teal-primary hover:underline">
                                      Update Status
                                    </button>
                                    {isPending && <span className="text-xs text-muted-text">Saving…</span>}
                                  </>
                                )
                              ) : (
                                <span className="text-sm text-muted-text">No stages tracked.</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setLogModalDept(dept)}
                              className="shrink-0 inline-flex items-center gap-1 text-xs font-medium border border-teal-primary text-teal-primary px-3 py-1 rounded-lg hover:bg-teal-primary hover:[color:var(--color-background)] transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />Log Interaction
                            </button>
                          </div>

                          {/* Row 2: owner · do-not-email · remove — all inline, no divider */}
                          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-text">
                            <div className="flex items-center gap-1.5">
                              <span>Owner</span>
                              <select
                                value={ownerId}
                                onChange={e => handleOwnerChange(e.target.value)}
                                className="rounded border border-border bg-background px-2 py-0.5 text-xs text-dark-text focus:outline-none focus:ring-1 focus:ring-teal-primary"
                              >
                                <option value="">Unassigned</option>
                                {staffUsers.map(u => (
                                  <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                              </select>
                            </div>
                            <label className={`flex items-center gap-1.5 cursor-pointer select-none ${ds.do_not_email ? 'text-red-500 dark:text-red-400' : ''}`}>
                              <input
                                type="checkbox"
                                checked={!!ds.do_not_email}
                                onChange={e => handleDeptDoNotEmail(dept, e.target.checked)}
                                className="rounded border-border accent-red-600"
                              />
                              Do not email
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveDepartment(dept)}
                              className="ml-auto text-xs text-muted-text hover:text-red-500 transition-colors"
                            >
                              Remove from {DEPARTMENT_LABELS[dept]}
                            </button>
                          </div>
                        </section>

                        {/* Unified activity history (interactions + status changes) */}
                        <section className="flex flex-col gap-3">
                          <button
                            type="button"
                            onClick={() => setActivityOpen(o => !o)}
                            className="flex items-center gap-1.5 self-start text-sm font-semibold text-dark-text uppercase tracking-wide"
                          >
                            {activityOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            Activity History ({deptInteractions.length + deptHistory.length})
                          </button>
                          {activityOpen && (
                            <DepartmentActivity
                              interactions={deptInteractions}
                              history={deptHistory}
                              onDelete={handleDeleteInteraction}
                            />
                          )}
                        </section>

                        {/* Student referrals (Admissions inbound / Student Success outbound) */}
                        {dept === 'admissions' && (
                          <StudentReferralsSection partnerId={partner.id} referrals={studentReferrals} direction="inbound" />
                        )}
                        {dept === 'student_success' && (
                          <StudentReferralsSection partnerId={partner.id} referrals={studentReferrals} direction="outbound" />
                        )}
                      </div>
                    )
                  })()}

          {/* Edit profile (reached from the header Edit button) */}
          {activeTab === 'edit' && (
            <div className="flex flex-col gap-6">
              <button
                type="button"
                onClick={() => { setEditingProfile(false); setActiveTab(deptStatuses.length > 0 ? deptStatuses[0].department : 'overview') }}
                className="self-start text-sm text-teal-primary hover:underline"
              >
                ← Back
              </button>
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
                  noRedirect
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
      </div>

      {/* Log Contact modal */}
      {logModalDept && (
        <Modal onClose={() => setLogModalDept(null)}>
          <LogInteractionForm
            partnerId={partner.id}
            defaultDepartment={logModalDept}
            availableStages={DEPARTMENT_STAGES[logModalDept]}
            contacts={contactsForDept(logModalDept)}
            onLogged={handleInteractionLogged}
            onStageUpdated={(stage) => updateStageInState(logModalDept, stage)}
            onCancel={() => setLogModalDept(null)}
          />
        </Modal>
      )}

      {/* Add / Edit contact modal */}
      {contactModal && (
        <Modal onClose={() => setContactModal(null)}>
          <ContactForm
            initialData={
              contactModal.mode === 'edit'
                ? contactModal.contact
                : { departments: enrolledDepts.length === 1 ? [enrolledDepts[0]] : [] }
            }
            enrolledDepts={enrolledDepts}
            onSubmit={async (data) => {
              if (contactModal.mode === 'edit' && contactModal.contact.id) {
                await handleUpdateContact(contactModal.contact.id, data)
              } else {
                await handleCreateContact(data)
              }
              setContactModal(null)
            }}
            onCancel={() => setContactModal(null)}
          />
        </Modal>
      )}
    </div>
  )
}
