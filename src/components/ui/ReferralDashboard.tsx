'use client'

import { useState, useMemo } from 'react'
import {
  createReferral,
  updateReferral,
  deleteReferral,
  type ReferralDirection,
  type ReferralFormData,
} from '@/lib/partner-interactions-actions'
import { SERVICE_CATEGORIES } from '@/lib/service-categories'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Partner {
  id: string
  name: string
  city: string | null
  state: string | null
  multi_city: boolean
  services_focus_area: string | null
  service_categories?: string[]
  partner_types: string[]
}

interface Student {
  id: string
  name: string
  email: string
}

interface Referral {
  id: string
  student_identifier: string
  direction: ReferralDirection
  referral_date: string
  referral_type: string | null
  outcome_rating: number | null
  outcome_notes: string | null
  student_city: string | null
  open_to_relocation: boolean
  is_veteran: boolean
  is_neurodivergent: boolean
  other_flags: string[]
  partner_id: string | null
  partners: { name: string } | null
  logged_by: string | null
  users: { name: string } | null
}

interface Props {
  initialReferrals: Referral[]
  partners: Partner[]
  students?: Student[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function StarRating({ rating, onChange }: { rating: number | null; onChange?: (r: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type={onChange ? 'button' : undefined}
          onClick={onChange ? () => onChange(n) : undefined}
          className={`text-lg leading-none ${n <= (rating ?? 0) ? 'text-yellow-400' : 'text-border'} ${onChange ? 'hover:text-yellow-300 cursor-pointer' : 'cursor-default'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

const OUTCOME_LABELS: Record<number, string> = {
  1: 'Not helpful',
  2: 'Somewhat helpful',
  3: 'Helpful',
  4: 'Very helpful',
  5: 'Excellent',
}

// ─── Student Selector ─────────────────────────────────────────────────────────

function StudentSelector({
  students,
  selected,
  onSelect,
}: {
  students: Student[]
  selected: Student | null
  onSelect: (s: Student | null) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = query.trim().length >= 1
    ? students
        .filter(s =>
          s.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          s.email.toLowerCase().includes(query.trim().toLowerCase())
        )
        .slice(0, 8)
    : []

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-teal-primary bg-teal-primary/10 px-4 py-2.5">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-dark-text">{selected.name}</span>
          <span className="text-xs text-muted-text ml-2">{selected.email}</span>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-xs text-muted-text hover:text-dark-text transition-colors shrink-0"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search student by name or email…"
        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-border bg-surface shadow-lg py-1 max-h-56 overflow-y-auto">
          {filtered.map(s => (
            <button
              key={s.id}
              type="button"
              onMouseDown={() => { onSelect(s); setQuery(''); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 hover:bg-background transition-colors"
            >
              <span className="text-sm font-medium text-dark-text">{s.name}</span>
              <span className="text-xs text-muted-text ml-2">{s.email}</span>
            </button>
          ))}
        </div>
      )}
      {open && query.trim().length >= 1 && filtered.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-border bg-surface shadow py-3 px-3">
          <p className="text-sm text-muted-text">No students found for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  )
}

// ─── Org Card ─────────────────────────────────────────────────────────────────

function OrgCard({
  partner,
  selected,
  alreadyReferred,
  onToggle,
}: {
  partner: Partner
  selected: boolean
  alreadyReferred: boolean
  onToggle: () => void
}) {
  const isNationwide = partner.state === 'Nationwide'
  const location = isNationwide ? null : [partner.city, partner.state].filter(Boolean).join(', ')

  return (
    <div
      className={`rounded-xl border bg-surface px-4 py-3 flex gap-3 cursor-pointer transition-colors ${
        selected
          ? 'border-teal-primary bg-teal-primary/5'
          : 'border-border hover:border-teal-primary/50'
      }`}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <div className="mt-0.5 shrink-0">
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            selected ? 'bg-teal-primary border-teal-primary' : 'border-border'
          }`}
        >
          {selected && <span className="text-white text-xs leading-none">✓</span>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-dark-text">{partner.name}</p>
          <div className="flex items-center gap-2 shrink-0">
            {alreadyReferred && (
              <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-full px-2 py-0.5 font-medium">
                Previously referred
              </span>
            )}
            <a
              href={`/instructor/partnerships/${partner.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs text-teal-primary hover:underline"
            >
              Details →
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-1 items-center">
          {isNationwide ? (
            <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full px-2 py-0.5 font-medium">
              Nationwide
            </span>
          ) : location ? (
            <span className="text-xs text-muted-text">{location}</span>
          ) : null}
          {partner.multi_city && !isNationwide && (
            <span className="text-xs text-muted-text italic">· multiple cities</span>
          )}
        </div>

        {(partner.service_categories ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(partner.service_categories ?? []).map(cat => (
              <span
                key={cat}
                className="text-xs bg-background border border-border rounded px-1.5 py-0.5 text-muted-text"
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        {partner.services_focus_area && (
          <p className="text-xs text-muted-text mt-1.5 line-clamp-2">{partner.services_focus_area}</p>
        )}
      </div>
    </div>
  )
}

// ─── Referral Row (history) ───────────────────────────────────────────────────

function ReferralRow({
  referral,
  partners,
  onUpdated,
  onDeleted,
}: {
  referral: Referral
  partners: Partner[]
  onUpdated: (id: string, data: Partial<ReferralFormData>) => void
  onDeleted: (id: string) => void
}) {
  const [editingRating, setEditingRating] = useState(false)
  const [savingRating, setSavingRating] = useState(false)

  async function handleRatingChange(rating: number) {
    setSavingRating(true)
    await updateReferral(referral.id, { outcome_rating: rating })
    onUpdated(referral.id, { outcome_rating: rating })
    setSavingRating(false)
    setEditingRating(false)
  }

  async function handleDelete() {
    await deleteReferral(referral.id)
    onDeleted(referral.id)
  }

  const flags = [
    referral.is_veteran && 'Veteran',
    referral.is_neurodivergent && 'Neurodivergent',
    referral.open_to_relocation && 'Open to relocation',
    ...(referral.other_flags ?? []),
  ].filter(Boolean) as string[]

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-dark-text">{referral.student_identifier}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-text">
            <span>{formatDate(referral.referral_date)}</span>
            {referral.partners?.name && <span>→ {referral.partners.name}</span>}
            {referral.student_city && <span>· {referral.student_city}</span>}
            {referral.users?.name && <span>· logged by {referral.users.name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editingRating ? (
            <div className="flex items-center gap-1">
              <StarRating rating={referral.outcome_rating} onChange={handleRatingChange} />
              {savingRating && <span className="text-xs text-muted-text">Saving…</span>}
              <button type="button" onClick={() => setEditingRating(false)} className="text-xs text-muted-text hover:text-dark-text ml-1">cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditingRating(true)} className="flex items-center gap-1 group">
              <StarRating rating={referral.outcome_rating} />
              <span className="text-xs text-muted-text group-hover:text-teal-primary hidden sm:inline">
                {referral.outcome_rating ? OUTCOME_LABELS[referral.outcome_rating] : 'Rate'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            className="text-xs text-muted-text hover:text-red-500 transition-colors ml-1"
          >
            Remove
          </button>
        </div>
      </div>

      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {flags.map(f => (
            <span key={f} className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-full px-2 py-0.5">{f}</span>
          ))}
        </div>
      )}

      {referral.outcome_notes && (
        <p className="text-xs text-muted-text italic">{referral.outcome_notes}</p>
      )}
    </div>
  )
}

// ─── Location Autocomplete ────────────────────────────────────────────────────

function LocationAutocomplete({
  partners,
  value,
  onChange,
}: {
  partners: Partner[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)

  // Build sorted unique list of states + cities from partner data
  const locationOptions = useMemo(() => {
    const states = new Set<string>()
    const cities = new Set<string>()
    for (const p of partners) {
      if (p.state && p.state !== 'Nationwide') states.add(p.state)
      if (p.city) cities.add(p.city)
    }
    return [
      ...Array.from(states).sort().map(s => ({ label: s, type: 'State' as const })),
      ...Array.from(cities).sort().map(c => ({ label: c, type: 'City' as const })),
    ]
  }, [partners])

  const filtered = value.trim().length >= 1
    ? locationOptions.filter(l => l.label.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 10)
    : locationOptions.slice(0, 12)

  return (
    <div className="relative w-full max-w-xs">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="City or state…"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-text hover:text-dark-text text-sm"
        >
          ×
        </button>
      )}
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-border bg-surface shadow-lg py-1 max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-text">No locations found.</p>
          ) : (
            filtered.map(l => (
              <button
                key={`${l.type}-${l.label}`}
                type="button"
                onMouseDown={() => { onChange(l.label); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-background transition-colors flex items-center justify-between gap-2"
              >
                <span className="text-dark-text">{l.label}</span>
                <span className="text-xs text-muted-text shrink-0">{l.type}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function ReferralDashboard({ initialReferrals, partners, students = [] }: Props) {
  // ── Find & Refer state ──
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [locationQuery, setLocationQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set())
  const [referralDate, setReferralDate] = useState(new Date().toISOString().slice(0, 10))
  const [referralServiceCategory, setReferralServiceCategory] = useState('')
  const [referralNotes, setReferralNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [justReferred, setJustReferred] = useState<{ student: string; orgs: string[] } | null>(null)

  // ── History state ──
  const [referrals, setReferrals] = useState<Referral[]>(initialReferrals)
  const [filterStudent, setFilterStudent] = useState('')
  const [filterPartner, setFilterPartner] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  // ── Filtered org list ──
  const filteredOrgs = useMemo(() => {
    return partners.filter(p => {
      if (locationQuery.trim().length >= 2) {
        const q = locationQuery.trim().toLowerCase()
        const locMatch =
          p.multi_city ||
          p.state === 'Nationwide' ||
          p.city?.toLowerCase().includes(q) ||
          p.state?.toLowerCase().includes(q)
        if (!locMatch) return false
      }
      if (selectedCategories.length > 0) {
        const orgCats = p.service_categories ?? []
        if (!selectedCategories.some(c => orgCats.includes(c))) return false
      }
      return true
    })
  }, [partners, locationQuery, selectedCategories])

  // ── Orgs this student has already been referred to ──
  const alreadyReferredOrgIds = useMemo(() => {
    if (!selectedStudent) return new Set<string>()
    return new Set(
      referrals
        .filter(r =>
          r.student_identifier.toLowerCase() === selectedStudent.name.toLowerCase() &&
          r.partner_id
        )
        .map(r => r.partner_id!)
    )
  }, [referrals, selectedStudent])

  function toggleCategory(cat: string) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  function toggleOrg(id: string) {
    setSelectedOrgIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedOrgs = filteredOrgs.filter(p => selectedOrgIds.has(p.id))

  async function handleMakeReferral() {
    if (!selectedStudent || selectedOrgs.length === 0) return
    setSubmitting(true)
    setSubmitError(null)

    const errors: string[] = []
    const succeeded: string[] = []

    for (const org of selectedOrgs) {
      const result = await createReferral({
        student_identifier: selectedStudent.name,
        student_user_id: selectedStudent.id,
        direction: 'outbound',
        partner_id: org.id,
        referral_date: referralDate,
        referral_type: null,
        service_category: referralServiceCategory || selectedCategories[0] || null,
        outcome_rating: null,
        outcome_notes: referralNotes.trim() || null,
        student_city: null,
        open_to_relocation: false,
        is_veteran: false,
        is_neurodivergent: false,
        other_flags: [],
        outcome_success: null,
        staff_notes: null,
      })

      if (result.error) {
        errors.push(`${org.name}: ${result.error}`)
      } else {
        succeeded.push(org.name)
        setReferrals(prev => [{
          id: crypto.randomUUID(),
          student_identifier: selectedStudent.name,
          direction: 'outbound',
          referral_date: referralDate,
          referral_type: null,
          outcome_rating: null,
          outcome_notes: referralNotes.trim() || null,
          student_city: null,
          open_to_relocation: false,
          is_veteran: false,
          is_neurodivergent: false,
          other_flags: [],
          partner_id: org.id,
          partners: { name: org.name },
          logged_by: null,
          users: null,
        }, ...prev])
      }
    }

    setSubmitting(false)

    if (errors.length > 0) setSubmitError(errors.join('; '))

    if (succeeded.length > 0) {
      setJustReferred({ student: selectedStudent.name, orgs: succeeded })
      setSelectedOrgIds(new Set())
      setReferralNotes('')
    }
  }

  // ── History filters ──
  const filtered = referrals.filter(r => {
    if (filterStudent.trim() && !r.student_identifier.toLowerCase().includes(filterStudent.trim().toLowerCase())) return false
    if (filterPartner && r.partner_id !== filterPartner) return false
    if (filterFrom && r.referral_date < filterFrom) return false
    if (filterTo && r.referral_date > filterTo) return false
    return true
  })

  function handleUpdated(id: string, data: Partial<ReferralFormData>) {
    setReferrals(prev => prev.map(r => r.id === id ? { ...r, ...data } : r))
  }

  function handleDeleted(id: string) {
    setReferrals(prev => prev.filter(r => r.id !== id))
  }

  const hasHistoryFilters = filterStudent.trim() || filterPartner || filterFrom || filterTo
  const activeFilters = locationQuery.trim().length >= 2 || selectedCategories.length > 0

  return (
    <div className="flex flex-col gap-10">

      {/* ══ FIND & REFER ══ */}
      <div className="flex flex-col gap-7">

        {/* Step 1: Student */}
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-muted-text uppercase tracking-wide">Step 1 — Select student</h2>
          {students.length === 0 ? (
            <p className="text-sm text-muted-text">No LMS students found.</p>
          ) : (
            <StudentSelector
              students={students}
              selected={selectedStudent}
              onSelect={s => { setSelectedStudent(s); setJustReferred(null) }}
            />
          )}
        </div>

        {/* Step 2: Location + Categories */}
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-muted-text uppercase tracking-wide">Step 2 — Filter by location &amp; services</h2>
          <LocationAutocomplete partners={partners} value={locationQuery} onChange={setLocationQuery} />
          <div className="flex flex-wrap gap-2">
            {SERVICE_CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  selectedCategories.includes(cat)
                    ? 'bg-teal-primary text-white border-teal-primary'
                    : 'bg-surface border-border text-muted-text hover:border-teal-primary hover:text-dark-text'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {(locationQuery.trim() || selectedCategories.length > 0) && (
            <button
              type="button"
              onClick={() => { setLocationQuery(''); setSelectedCategories([]) }}
              className="text-xs text-muted-text hover:text-dark-text transition-colors self-start"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Step 3: Org List */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-text uppercase tracking-wide">
              Step 3 — Select orgs to refer to
            </h2>
            <span className="text-xs text-muted-text">
              {filteredOrgs.length} org{filteredOrgs.length !== 1 ? 's' : ''}{activeFilters ? ' match' : ' available'}
              {selectedOrgIds.size > 0 && (
                <>
                  {' · '}
                  <span className="text-teal-primary font-medium">{selectedOrgIds.size} selected</span>
                  {' · '}
                  <button
                    type="button"
                    onClick={() => setSelectedOrgIds(new Set())}
                    className="text-muted-text hover:text-dark-text transition-colors"
                  >
                    Clear
                  </button>
                </>
              )}
            </span>
          </div>

          {filteredOrgs.length === 0 ? (
            <p className="text-sm text-muted-text py-6 text-center">No orgs match your filters.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredOrgs.map(p => (
                <OrgCard
                  key={p.id}
                  partner={p}
                  selected={selectedOrgIds.has(p.id)}
                  alreadyReferred={alreadyReferredOrgIds.has(p.id)}
                  onToggle={() => toggleOrg(p.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Make Referral panel */}
        {selectedOrgIds.size > 0 && (
          <div className="rounded-xl border border-teal-primary bg-teal-primary/5 p-5 flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-dark-text">Make Referral</h3>
              {selectedStudent ? (
                <p className="text-xs text-muted-text mt-0.5">
                  Referring{' '}
                  <span className="font-medium text-dark-text">{selectedStudent.name}</span> to{' '}
                  <span className="font-medium text-dark-text">{selectedOrgs.map(o => o.name).join(', ')}</span>
                </p>
              ) : (
                <p className="text-xs text-amber-600 mt-0.5">← Select a student in Step 1 before making a referral.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-dark-text mb-1">Date</label>
                <input
                  type="date"
                  value={referralDate}
                  onChange={e => setReferralDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-text mb-1">Service needed</label>
                <select
                  value={referralServiceCategory || selectedCategories[0] || ''}
                  onChange={e => setReferralServiceCategory(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
                >
                  <option value="">— None / Unknown —</option>
                  {SERVICE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-dark-text mb-1">
                Notes <span className="text-muted-text font-normal">(optional)</span>
              </label>
              <textarea
                value={referralNotes}
                onChange={e => setReferralNotes(e.target.value)}
                rows={2}
                placeholder="Any context for this referral…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
              />
            </div>

            {submitError && <p className="text-xs text-red-600">{submitError}</p>}

            <div>
              <button
                type="button"
                onClick={handleMakeReferral}
                disabled={submitting || !selectedStudent}
                className="px-5 py-2.5 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? 'Saving…'
                  : `Make Referral${selectedOrgIds.size > 1 ? ` (${selectedOrgIds.size} orgs)` : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* Success banner */}
        {justReferred && (
          <div className="rounded-xl border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700 px-4 py-3 flex items-start gap-3">
            <span className="text-green-600 text-lg leading-none mt-0.5">✓</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">Referral logged!</p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                {justReferred.student} referred to {justReferred.orgs.join(', ')}.
                {' '}They&apos;ll receive a follow-up request in 60 days.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setJustReferred(null)}
              className="text-green-600 hover:text-green-800 text-lg leading-none"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* ══ REFERRAL HISTORY ══ */}
      <section className="border-t border-border pt-8 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-dark-text">Referral History</h2>
          <span className="text-xs text-muted-text">{referrals.length} total</span>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-text mb-1">Student</label>
            <input
              type="text"
              value={filterStudent}
              onChange={e => setFilterStudent(e.target.value)}
              placeholder="Filter by name…"
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary w-36"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-text mb-1">Organization</label>
            <select
              value={filterPartner}
              onChange={e => setFilterPartner(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
            >
              <option value="">All</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-text mb-1">From</label>
            <input
              type="date"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-text mb-1">To</label>
            <input
              type="date"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
            />
          </div>
          {hasHistoryFilters && (
            <button
              type="button"
              onClick={() => { setFilterStudent(''); setFilterPartner(''); setFilterFrom(''); setFilterTo('') }}
              className="text-xs text-muted-text hover:text-dark-text transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-text py-8 text-center">
            {referrals.length === 0 ? 'No referrals logged yet.' : 'No referrals match the current filters.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(r => (
              <ReferralRow
                key={r.id}
                referral={r}
                partners={partners}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
