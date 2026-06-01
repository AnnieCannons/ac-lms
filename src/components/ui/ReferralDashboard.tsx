'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  createReferral,
  updateReferral,
  deleteReferral,
  type ReferralDirection,
  type ReferralFormData,
} from '@/lib/partner-interactions-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Partner {
  id: string
  name: string
  city: string | null
  state: string | null
  multi_city: boolean
  services_focus_area: string | null
  partner_types: string[]
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

const OUTCOME_LABELS: Record<number, string> = {
  1: 'Not helpful',
  2: 'Somewhat helpful',
  3: 'Helpful',
  4: 'Very helpful',
  5: 'Excellent',
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

// ─── Geo Search ───────────────────────────────────────────────────────────────

function GeoSearch({ partners }: { partners: Partner[] }) {
  const [query, setQuery] = useState('')

  const trimmed = query.trim()
  const results = trimmed.length >= 2
    ? partners.filter(p => {
        const q = trimmed.toLowerCase()
        return p.multi_city || p.city?.toLowerCase().includes(q) || p.state?.toLowerCase().includes(q)
      })
    : []

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <h3 className="text-xs font-semibold text-dark-text uppercase tracking-wide">Find Resources by Location</h3>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search by city or state…"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
      />
      {trimmed.length >= 2 && (
        results.length > 0 ? (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {results.map(p => (
              <div key={p.id} className="rounded-lg border border-border bg-background px-3 py-2.5 flex flex-col gap-1">
                <p className="text-sm font-medium text-dark-text">{p.name}</p>
                <p className="text-xs text-muted-text">
                  {[p.city, p.state].filter(Boolean).join(', ')}
                  {p.multi_city && <span className="italic"> · operates in multiple cities</span>}
                </p>
                {p.services_focus_area && (
                  <p className="text-xs text-muted-text mt-0.5 line-clamp-2">{p.services_focus_area}</p>
                )}
                {p.partner_types.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {p.partner_types.map(t => (
                      <span key={t} className="text-xs bg-surface border border-border rounded px-1.5 py-0.5 text-muted-text">
                        {TYPE_LABELS[t] ?? t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-text">No partners found for &ldquo;{trimmed}&rdquo;.</p>
        )
      )}
    </div>
  )
}

// ─── Log Referral Form ────────────────────────────────────────────────────────

function LogReferralForm({
  partners,
  allReferrals,
  onLogged,
}: {
  partners: Partner[]
  allReferrals: Referral[]
  onLogged: (referral: Referral) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [airtableNames, setAirtableNames] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const [studentId, setStudentId] = useState('')
  const [direction, setDirection] = useState<ReferralDirection>('outbound')
  const [partnerId, setPartnerId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [referralType, setReferralType] = useState('')
  const [city, setCity] = useState('')
  const [openToRelocation, setOpenToRelocation] = useState(false)
  const [isVeteran, setIsVeteran] = useState(false)
  const [isNeurodivergent, setIsNeurodivergent] = useState(false)
  const [outcomeRating, setOutcomeRating] = useState<number | null>(null)
  const [outcomeNotes, setOutcomeNotes] = useState('')

  useEffect(() => {
    if (!open || airtableNames.length > 0) return
    fetch('/api/partnerships/students')
      .then(r => r.json())
      .then(data => { if (data.names) setAirtableNames(data.names) })
      .catch(() => {})
  }, [open, airtableNames.length])

  const suggestions = studentId.trim().length >= 1
    ? airtableNames.filter(n => n.toLowerCase().includes(studentId.trim().toLowerCase())).slice(0, 8)
    : []

  const studentHistory = studentId.trim().length >= 2
    ? allReferrals.filter(r =>
        r.student_identifier.toLowerCase().includes(studentId.trim().toLowerCase())
      )
    : []

  function reset() {
    setStudentId(''); setDirection('outbound'); setPartnerId(''); setDate(new Date().toISOString().slice(0, 10))
    setReferralType(''); setCity(''); setOpenToRelocation(false); setIsVeteran(false)
    setIsNeurodivergent(false); setOutcomeRating(null); setOutcomeNotes('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!studentId.trim()) return
    setSaving(true); setError(null)

    const data: ReferralFormData = {
      student_identifier: studentId.trim(),
      direction,
      partner_id: partnerId || null,
      referral_date: date,
      referral_type: referralType.trim() || null,
      outcome_rating: outcomeRating,
      outcome_notes: outcomeNotes.trim() || null,
      student_city: city.trim() || null,
      open_to_relocation: openToRelocation,
      is_veteran: isVeteran,
      is_neurodivergent: isNeurodivergent,
      other_flags: [],
    }

    const result = await createReferral(data)
    setSaving(false)
    if (result.error) { setError(result.error); return }

    const partner = partners.find(p => p.id === partnerId) ?? null
    onLogged({
      id: crypto.randomUUID(),
      ...data,
      partners: partner ? { name: partner.name } : null,
      other_flags: [],
      logged_by: null,
      users: null,
    })
    reset()
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors"
      >
        + Log Referral
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dark-text">Log Referral</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-muted-text hover:text-dark-text text-lg leading-none">×</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-dark-text mb-1">Student <span className="text-red-500">*</span></label>
          <div className="relative">
            <input
              required
              type="text"
              value={studentId}
              onChange={e => { setStudentId(e.target.value); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
              placeholder="Type a preferred name…"
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-border bg-surface shadow-lg py-1 max-h-48 overflow-y-auto">
                {suggestions.map(name => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={() => { setStudentId(name); setShowSuggestions(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-dark-text hover:bg-background transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-dark-text mb-1">Direction</label>
          <div className="flex gap-2">
            {(['outbound', 'inbound'] as const).map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${
                  direction === d ? 'bg-teal-primary text-white border-teal-primary' : 'border-border text-muted-text hover:border-teal-primary'
                }`}
              >
                {d === 'outbound' ? 'Outbound (AC → Org)' : 'Inbound (Org → AC)'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-dark-text mb-1">Organization</label>
          <select
            value={partnerId}
            onChange={e => setPartnerId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
          >
            <option value="">— Unknown / Not listed —</option>
            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-dark-text mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-dark-text mb-1">Referral Type</label>
          <input
            type="text"
            value={referralType}
            onChange={e => setReferralType(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
            placeholder="e.g. housing, legal aid, mental health"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-dark-text mb-1">Student City</label>
          <input
            type="text"
            value={city}
            onChange={e => setCity(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
            placeholder="City"
          />
        </div>
      </div>

      {studentHistory.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5 flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-yellow-800">Existing referrals for this student — check for duplicates:</p>
          {studentHistory.map(r => (
            <p key={r.id} className="text-xs text-yellow-700">
              {r.direction === 'outbound' ? '→ Referred to' : '← Referred from'}{' '}
              <span className="font-medium">{r.partners?.name ?? 'Unknown org'}</span>
              {r.referral_type ? ` (${r.referral_type})` : ''} · {formatDate(r.referral_date)}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        {([
          ['open_to_relocation', 'Open to relocation', openToRelocation, setOpenToRelocation],
          ['is_veteran', 'Veteran', isVeteran, setIsVeteran],
          ['is_neurodivergent', 'Neurodivergent', isNeurodivergent, setIsNeurodivergent],
        ] as [string, string, boolean, (v: boolean) => void][]).map(([key, label, val, setter]) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={val}
              onChange={e => setter(e.target.checked)}
              className="rounded border-border text-teal-primary focus:ring-teal-primary"
            />
            {label}
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label className="block text-xs font-medium text-dark-text">Outcome Rating</label>
        <StarRating rating={outcomeRating} onChange={setOutcomeRating} />
        {outcomeRating && <p className="text-xs text-muted-text">{OUTCOME_LABELS[outcomeRating]}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-dark-text mb-1">Outcome Notes</label>
        <textarea
          value={outcomeNotes}
          onChange={e => setOutcomeNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
          placeholder="How did the referral go?"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !studentId.trim()}
          className="px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Log Referral'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-text hover:border-teal-primary transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Referral Row ─────────────────────────────────────────────────────────────

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
            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
              referral.direction === 'outbound' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
            }`}>
              {referral.direction === 'outbound' ? 'Outbound' : 'Inbound'}
            </span>
            {referral.referral_type && (
              <span className="text-xs bg-surface border border-border rounded-full px-2 py-0.5 text-muted-text">{referral.referral_type}</span>
            )}
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function ReferralDashboard({ initialReferrals, partners }: Props) {
  const [referrals, setReferrals] = useState<Referral[]>(initialReferrals)
  const [filterStudent, setFilterStudent] = useState('')
  const [filterDirection, setFilterDirection] = useState<ReferralDirection | 'all'>('all')
  const [filterPartner, setFilterPartner] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  function handleLogged(referral: Referral) {
    setReferrals(prev => [referral, ...prev])
  }

  function handleUpdated(id: string, data: Partial<ReferralFormData>) {
    setReferrals(prev => prev.map(r => r.id === id ? { ...r, ...data } : r))
  }

  function handleDeleted(id: string) {
    setReferrals(prev => prev.filter(r => r.id !== id))
  }

  const filtered = referrals.filter(r => {
    if (filterStudent.trim() && !r.student_identifier.toLowerCase().includes(filterStudent.trim().toLowerCase())) return false
    if (filterDirection !== 'all' && r.direction !== filterDirection) return false
    if (filterPartner && r.partner_id !== filterPartner) return false
    if (filterFrom && r.referral_date < filterFrom) return false
    if (filterTo && r.referral_date > filterTo) return false
    return true
  })

  // Orgs a student is already connected to (outbound referrals)
  const connectedOrgs = useMemo(() => {
    if (filterStudent.trim().length < 2) return []
    return [...new Set(
      referrals
        .filter(r =>
          r.student_identifier.toLowerCase().includes(filterStudent.trim().toLowerCase()) &&
          r.direction === 'outbound' &&
          r.partners?.name
        )
        .map(r => r.partners!.name)
    )]
  }, [referrals, filterStudent])

  // Partner quality: avg rating per partner (only those with rated referrals)
  const partnerQuality = useMemo(() => {
    const byPartner: Record<string, { name: string; count: number; total: number; rated: number }> = {}
    for (const r of referrals) {
      if (!r.partner_id || !r.partners?.name) continue
      if (!byPartner[r.partner_id]) byPartner[r.partner_id] = { name: r.partners.name, count: 0, total: 0, rated: 0 }
      byPartner[r.partner_id].count++
      if (r.outcome_rating) {
        byPartner[r.partner_id].total += r.outcome_rating
        byPartner[r.partner_id].rated++
      }
    }
    return Object.entries(byPartner)
      .filter(([, d]) => d.rated > 0)
      .map(([id, d]) => ({ id, ...d, avgRating: d.total / d.rated }))
      .sort((a, b) => b.avgRating - a.avgRating)
  }, [referrals])

  const outboundCount = referrals.filter(r => r.direction === 'outbound').length
  const inboundCount = referrals.filter(r => r.direction === 'inbound').length
  const ratedCount = referrals.filter(r => r.outcome_rating !== null).length
  const avgRating = ratedCount > 0
    ? (referrals.reduce((sum, r) => sum + (r.outcome_rating ?? 0), 0) / ratedCount).toFixed(1)
    : null

  const hasFilters = filterStudent.trim() || filterDirection !== 'all' || filterPartner || filterFrom || filterTo

  return (
    <div className="flex flex-col gap-6">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Referrals', value: referrals.length },
          { label: 'Outbound', value: outboundCount },
          { label: 'Inbound', value: inboundCount },
          { label: 'Avg Rating', value: avgRating ? `${avgRating} / 5` : '—' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-xs text-muted-text">{stat.label}</p>
            <p className="text-xl font-bold text-dark-text mt-0.5">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Geo search */}
      <GeoSearch partners={partners} />

      {/* Log + Filters */}
      <div className="flex flex-col gap-4">
        <LogReferralForm partners={partners} allReferrals={referrals} onLogged={handleLogged} />

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-text mb-1">Student</label>
            <input
              type="text"
              value={filterStudent}
              onChange={e => setFilterStudent(e.target.value)}
              placeholder="Filter by ID…"
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary w-36"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-text mb-1">Direction</label>
            <select
              value={filterDirection}
              onChange={e => setFilterDirection(e.target.value as ReferralDirection | 'all')}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
            >
              <option value="all">All</option>
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </select>
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
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setFilterStudent(''); setFilterDirection('all'); setFilterPartner(''); setFilterFrom(''); setFilterTo('') }}
              className="text-xs text-muted-text hover:text-dark-text transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Connected orgs banner */}
      {connectedOrgs.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span className="font-medium">Already referred to:</span>{' '}
          {connectedOrgs.join(', ')} — check for duplicates before adding more.
        </div>
      )}

      {/* Referral list */}
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

      {/* Partner quality */}
      {partnerQuality.length > 0 && (
        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="text-xs font-semibold text-muted-text uppercase tracking-wide">Partner Quality</h2>
          <div className="flex flex-col gap-1.5">
            {partnerQuality.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-dark-text truncate">{p.name}</span>
                  <span className="text-xs text-muted-text shrink-0">{p.count} referral{p.count !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-yellow-400">★</span>
                  <span className="text-sm font-semibold text-dark-text">{p.avgRating.toFixed(1)}</span>
                  <span className="text-xs text-muted-text">/ 5</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
