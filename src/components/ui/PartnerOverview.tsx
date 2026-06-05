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
import { DEPARTMENT_LABELS, DEPARTMENT_STAGES, DEPT_COLORS } from '@/lib/partner-constants'
import PartnerForm from '@/components/ui/PartnerForm'
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
  website: string | null
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
  staffUsers: StaffUser[]
  defaultDepartment?: PartnerDepartment | null
  onUpdatePartner: (data: PartnerFormData) => Promise<{ error: string | null }>
  onDeletePartner: () => Promise<{ error: string | null }>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-600',
  in_onboarding: 'bg-blue-100 text-blue-800',
}

const STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  active: 'Active',
  inactive: 'Inactive',
  in_onboarding: 'In Onboarding',
}

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

function IncompleteProfileBanner({ partner }: { partner: Partner }) {
  const missing: string[] = []
  if (!partner.city) missing.push('city')
  if (!partner.partner_contacts.length) missing.push('at least one contact')
  if (!partner.partner_type_assignments.length) missing.push('partner type')
  if (!partner.internal_owner_id) missing.push('internal owner')
  if (!missing.length) return null

  return (
    <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 flex items-start gap-2">
      <span className="shrink-0 mt-0.5">⚠</span>
      <span>Incomplete profile — missing: {missing.join(', ')}.</span>
    </div>
  )
}

function StageSelector({
  department,
  currentStage,
  onStageChange,
  onRemove,
}: {
  department: PartnerDepartment
  currentStage: string
  onStageChange: (dept: PartnerDepartment, stage: string) => void
  onRemove: (dept: PartnerDepartment) => void
}) {
  const stages = DEPARTMENT_STAGES[department]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {stages.map(stage => (
          <button
            key={stage}
            type="button"
            onClick={() => onStageChange(department, stage)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              currentStage === stage
                ? 'bg-teal-primary text-white border-teal-primary'
                : 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary'
            }`}
          >
            {stage}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onRemove(department)}
        className="self-start text-xs text-muted-text hover:text-red-500 transition-colors"
      >
        Remove from {DEPARTMENT_LABELS[department]}
      </button>
    </div>
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

function LogInteractionForm({
  partnerId,
  defaultDepartment,
  onLogged,
}: {
  partnerId: string
  defaultDepartment?: PartnerDepartment
  onLogged: (interaction: Interaction) => void
}) {
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [department, setDepartment] = useState<PartnerDepartment | ''>(defaultDepartment ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    })

    setSaving(false)
    if (result.error) { setError(result.error); return }

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

  // Fetch Airtable student names once on first focus
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

      {/* Add referral form */}
      <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h3 className="text-xs font-semibold text-dark-text uppercase tracking-wide">Log a Referral</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
          {/* Autocomplete name input */}
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
          {/* Date */}
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

      {/* Existing referrals */}
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
  staffUsers,
  defaultDepartment,
  onUpdatePartner,
  onDeletePartner,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [interactions, setInteractions] = useState<Interaction[]>(initialInteractions)
  const [deptStatuses, setDeptStatuses] = useState<DepartmentStatus[]>(initialStatuses)

  const initialTab: ActiveTab =
    defaultDepartment && initialStatuses.some(s => s.department === defaultDepartment)
      ? defaultDepartment
      : 'overview'
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const types = partner.partner_type_assignments.map(t => TYPE_LABELS[t.partner_type] ?? t.partner_type)
  const primaryContact = partner.partner_contacts.find(c => c.is_primary) ?? partner.partner_contacts[0]
  const daysAgo = daysSince(partner.last_interaction_date)
  const followUpNeeded = daysAgo !== null && daysAgo >= 30

  function getStageFor(dept: PartnerDepartment) {
    return deptStatuses.find(s => s.department === dept)?.stage ?? ''
  }

  function handleStageChange(dept: PartnerDepartment, stage: string) {
    startTransition(async () => {
      await setDepartmentStatus(partner.id, dept, stage)
    })
    setDeptStatuses(prev => {
      const existing = prev.find(s => s.department === dept)
      if (existing) return prev.map(s => s.department === dept ? { ...s, stage } : s)
      return [...prev, { id: crypto.randomUUID(), department: dept, stage, updated_at: new Date().toISOString(), users: null }]
    })
  }

  function handleAddDepartment(dept: PartnerDepartment) {
    startTransition(async () => {
      await setDepartmentStatus(partner.id, dept, '')
    })
    setDeptStatuses(prev => [...prev, { id: crypto.randomUUID(), department: dept, stage: '', updated_at: new Date().toISOString(), users: null }])
    setActiveTab(dept)
  }

  function handleRemoveDepartment(dept: PartnerDepartment) {
    startTransition(async () => {
      await removeDepartmentStatus(partner.id, dept)
    })
    setDeptStatuses(prev => prev.filter(s => s.department !== dept))
    setActiveTab('overview')
  }

  function handleInteractionLogged(interaction: Interaction) {
    setInteractions(prev => [interaction, ...prev])
  }

  async function handleDeleteInteraction(id: string) {
    await deleteInteraction(id, partner.id)
    setInteractions(prev => prev.filter(i => i.id !== id))
  }

  async function handleDelete() {
    setDeleting(true)
    const result = await onDeletePartner()
    if (result.error) { setDeleting(false); return }
    router.push('/instructor/partnerships')
  }

  // Build locations list: prefer partner_locations rows, fall back to legacy city/state
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
  }

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...deptStatuses.map(ds => ({ id: ds.department as ActiveTab, label: DEPARTMENT_LABELS[ds.department] })),
    { id: 'edit', label: 'Edit Profile' },
  ]

  return (
    <div className="flex flex-col gap-6">

      {/* Header — global org info only, no status badge */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold text-dark-text">{partner.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-text">
            {partner.city && (
              <span>{partner.city}{partner.state ? `, ${partner.state}` : ''}{partner.multi_city ? ' + more' : ''}</span>
            )}
            {primaryContact && (
              <>
                <span className="text-muted-text/50">·</span>
                <span>{primaryContact.name}{primaryContact.title ? `, ${primaryContact.title}` : ''}</span>
              </>
            )}
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
          {partner.last_interaction_date ? (
            <span className="text-muted-text">
              Last contact: <span className="text-dark-text font-medium">{formatDate(partner.last_interaction_date)}</span>
              {daysAgo !== null && ` (${daysAgo}d ago)`}
            </span>
          ) : (
            <span className="text-muted-text">No interactions logged yet</span>
          )}
          {followUpNeeded && (
            <span className="text-xs font-medium rounded-full px-2.5 py-0.5 bg-red-100 text-red-700">Follow-up needed</span>
          )}
        </div>
      </div>

      <IncompleteProfileBanner partner={partner} />

      {/* Tabs: Overview | [one per enrolled dept] | Edit Profile */}
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

      {/* Overview tab — global fields + dept summary + all interactions */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-8">

          {deptStatuses.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Departments</h2>
              <div className="flex flex-wrap gap-2">
                {deptStatuses.map(ds => (
                  <button
                    key={ds.department}
                    type="button"
                    onClick={() => setActiveTab(ds.department)}
                    className={`text-xs font-medium rounded-full px-3 py-1 hover:opacity-80 transition-opacity ${DEPT_COLORS[ds.department]}`}
                  >
                    {DEPARTMENT_LABELS[ds.department]}{ds.stage ? `: ${ds.stage}` : ''}
                  </button>
                ))}
              </div>
              <AddDepartmentDropdown
                enrolledDepts={deptStatuses.map(s => s.department)}
                onAdd={handleAddDepartment}
              />
            </section>
          )}

          {deptStatuses.length === 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Departments</h2>
              <p className="text-sm text-muted-text">This partner isn't associated with any department yet.</p>
              <AddDepartmentDropdown
                enrolledDepts={[]}
                onAdd={handleAddDepartment}
              />
            </section>
          )}

          {/* Ratings summary */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Ratings</h2>
            {ratingSummary.length === 0 ? (
              <p className="text-sm text-muted-text">No ratings submitted yet.</p>
            ) : (
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
            )}
          </section>

          {partner.partner_contacts.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Contacts</h2>
              <div className="flex flex-col gap-2">
                {partner.partner_contacts.map(contact => (
                  <div key={contact.id ?? contact.name} className="rounded-xl border border-border bg-surface px-4 py-3 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-dark-text">{contact.name}</span>
                      {contact.is_primary && (
                        <span className="text-xs bg-teal-100 text-teal-800 rounded-full px-2 py-0.5">Primary</span>
                      )}
                      {contact.title && <span className="text-xs text-muted-text">{contact.title}</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-text">
                      {contact.email && <a href={`mailto:${contact.email}`} className="hover:text-teal-primary transition-colors">{contact.email}</a>}
                      {contact.phone && <span>{contact.phone}</span>}
                      {contact.linkedin_url && (
                        <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:text-teal-primary transition-colors">LinkedIn</a>
                      )}
                      {contact.website_url && (
                        <a href={contact.website_url} target="_blank" rel="noopener noreferrer" className="hover:text-teal-primary transition-colors">Website</a>
                      )}
                    </div>
                    {contact.notes && <p className="text-xs text-muted-text mt-1">{contact.notes}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Details</h2>
            <dl className="flex flex-col gap-2">
              <div className="flex gap-2 text-sm">
                <dt className="text-muted-text shrink-0 w-36">Status</dt>
                <dd>
                  <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${STATUS_COLORS[partner.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[partner.status] ?? partner.status}
                  </span>
                </dd>
              </div>
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

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">All Interactions</h2>
            <LogInteractionForm partnerId={partner.id} onLogged={handleInteractionLogged} />
            <InteractionList interactions={interactions} onDelete={handleDeleteInteraction} />
          </section>

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
        </div>
      )}

      {/* Department tabs — stage selector + dept-scoped interaction log */}
      {deptStatuses.map(ds => activeTab === ds.department && (
        <div key={ds.department} className="flex flex-col gap-8">

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Journey Stage</h2>
            <StageSelector
              department={ds.department}
              currentStage={getStageFor(ds.department)}
              onStageChange={handleStageChange}
              onRemove={handleRemoveDepartment}
            />
            {isPending && <p className="text-xs text-muted-text">Saving…</p>}
          </section>

          {/* Student referrals — inbound for Admissions, outbound for Student Success */}
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

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">
              {DEPARTMENT_LABELS[ds.department]} Interactions
            </h2>
            <LogInteractionForm
              partnerId={partner.id}
              defaultDepartment={ds.department}
              onLogged={handleInteractionLogged}
            />
            <InteractionList
              interactions={interactions.filter(i => i.department === ds.department)}
              onDelete={handleDeleteInteraction}
            />
          </section>
        </div>
      ))}

      {/* Edit Profile tab */}
      {activeTab === 'edit' && (
        <PartnerForm
          initialData={initialFormData}
          staffUsers={staffUsers}
          onSubmit={async (data) => {
            const result = await onUpdatePartner(data)
            if (!result.error) setActiveTab('overview')
            return result
          }}
          submitLabel="Save Changes"
          partnerId={partner.id}
          redirectTo={defaultDepartment
            ? `/instructor/partnerships/all?dept=${defaultDepartment}`
            : '/instructor/partnerships'
          }
        />
      )}
    </div>
  )
}
