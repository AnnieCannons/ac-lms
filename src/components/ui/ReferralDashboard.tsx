'use client'

import { useState } from 'react'
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
  department?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Log Referral Form ────────────────────────────────────────────────────────

function LogReferralForm({
  partners,
  onLogged,
}: {
  partners: Partner[]
  onLogged: (referral: Referral) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          <label className="block text-xs font-medium text-dark-text mb-1">Student Identifier <span className="text-red-500">*</span></label>
          <input
            required
            type="text"
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
            placeholder="Anonymized ID or initials"
          />
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
    if (filterDirection !== 'all' && r.direction !== filterDirection) return false
    if (filterPartner && r.partner_id !== filterPartner) return false
    if (filterFrom && r.referral_date < filterFrom) return false
    if (filterTo && r.referral_date > filterTo) return false
    return true
  })

  const outboundCount = referrals.filter(r => r.direction === 'outbound').length
  const inboundCount = referrals.filter(r => r.direction === 'inbound').length
  const ratedCount = referrals.filter(r => r.outcome_rating !== null).length
  const avgRating = ratedCount > 0
    ? (referrals.reduce((sum, r) => sum + (r.outcome_rating ?? 0), 0) / ratedCount).toFixed(1)
    : null

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

      {/* Log + Filters */}
      <div className="flex flex-col gap-4">
        <LogReferralForm partners={partners} onLogged={handleLogged} />

        <div className="flex flex-wrap gap-3 items-end">
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
          {(filterDirection !== 'all' || filterPartner || filterFrom || filterTo) && (
            <button
              type="button"
              onClick={() => { setFilterDirection('all'); setFilterPartner(''); setFilterFrom(''); setFilterTo('') }}
              className="text-xs text-muted-text hover:text-dark-text transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

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
    </div>
  )
}
