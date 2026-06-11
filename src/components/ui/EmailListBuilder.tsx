'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DEPARTMENT_LABELS, type PartnerDepartment } from '@/lib/partner-constants'
import { saveEmailList, type EmailListRecipient } from '@/lib/email-list-actions'

const ALL_DEPARTMENTS = Object.keys(DEPARTMENT_LABELS) as PartnerDepartment[]

const PARTNER_TYPE_LABELS: Record<string, string> = {
  service_provider: 'Service Provider',
  corporate: 'Corporate',
  funder: 'Funder',
  advisory: 'Advisory',
  mentorship: 'Mentorship',
  apprenticeship: 'Apprenticeship',
  media: 'Media',
  admissions_referral: 'Admissions Referral',
}

const ALL_PARTNER_TYPES = Object.keys(PARTNER_TYPE_LABELS)

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  prospect: 'Prospect',
  in_onboarding: 'In Onboarding',
  inactive: 'Inactive',
}

const DEPT_BADGE: Record<PartnerDepartment, string> = {
  student_success: 'filter-btn-student-success',
  career_development: 'filter-btn-career-dev',
  resourcefull: 'filter-btn-resourcefull',
  funding_partnerships: 'filter-btn-funding',
  admissions: 'filter-btn-admissions',
}

interface Partner {
  id: string
  name: string
  city: string | null
  state: string | null
  status: string
  do_not_email?: boolean
  do_not_email_notes?: string | null
  partner_type_assignments: { partner_type: string }[]
  partner_contacts: { id: string; name: string; email: string | null; is_primary: boolean; website_url?: string | null }[]
  partner_department_status: { department: string }[]
}

interface ContactEntry {
  key: string
  partnerId: string
  partnerName: string
  contactId: string
  contactName: string
  email: string | null
  websiteUrl: string | null
  isPrimary: boolean
}

interface Filters {
  partnerTypes: string[]
  states: string[]
  statuses: string[]
  departments: PartnerDepartment[]
  referredIn: boolean
  referredTo: boolean
}

function buildAutoName(filters: Filters, count: number): string {
  const parts: string[] = []
  if (filters.referredIn) parts.push('Referred In')
  if (filters.referredTo) parts.push('Referred To (Student Success)')
  if (filters.departments.length === 1) parts.push(DEPARTMENT_LABELS[filters.departments[0]])
  if (filters.statuses.length === 1) parts.push(STATUS_LABELS[filters.statuses[0]] ?? filters.statuses[0])
  if (filters.states.length === 1) parts.push(filters.states[0])
  if (filters.partnerTypes.length === 1) parts.push(PARTNER_TYPE_LABELS[filters.partnerTypes[0]] ?? filters.partnerTypes[0])
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (parts.length === 0) parts.push(`All Partners (${count})`)
  parts.push(date)
  return parts.join(' · ')
}

interface Props {
  partners: Partner[]
}

export default function EmailListBuilder({ partners }: Props) {
  const router = useRouter()
  const [filters, setFilters] = useState<Filters>({
    partnerTypes: [],
    states: [],
    statuses: [],
    departments: [],
    referredIn: false,
    referredTo: false,
  })
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [managingMultiples, setManagingMultiples] = useState(false)
  const [saveModal, setSaveModal] = useState<{ open: boolean; name: string; subject: string; notes: string; department: PartnerDepartment | ''; logInteractions: boolean }>({
    open: false,
    name: '',
    subject: '',
    notes: '',
    department: '',
    logInteractions: true,
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [dneModal, setDneModal] = useState<{ partnerName: string; notes: string; contactKey: string } | null>(null)

  // Unique states from partner data
  const availableStates = useMemo(() => {
    const s = new Set<string>()
    for (const p of partners) { if (p.state) s.add(p.state) }
    return [...s].sort()
  }, [partners])

  // Filter partners
  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      if (filters.referredIn) {
        const hasType = p.partner_type_assignments.some(t => t.partner_type === 'admissions_referral')
        if (!hasType) return false
      }
      if (filters.referredTo) {
        const hasDept = p.partner_department_status.some(d => d.department === 'student_success')
        if (!hasDept) return false
      }
      if (filters.partnerTypes.length > 0) {
        const hasType = filters.partnerTypes.some(ft =>
          p.partner_type_assignments.some(t => t.partner_type === ft)
        )
        if (!hasType) return false
      }
      if (filters.states.length > 0) {
        if (!p.state || !filters.states.includes(p.state)) return false
      }
      if (filters.statuses.length > 0) {
        if (!filters.statuses.includes(p.status)) return false
      }
      if (filters.departments.length > 0) {
        const hasDept = filters.departments.some(fd =>
          p.partner_department_status.some(d => d.department === fd)
        )
        if (!hasDept) return false
      }
      return true
    })
  }, [partners, filters])

  // Build contact entries from filtered partners (include form-URL-only contacts too)
  const allContacts = useMemo<ContactEntry[]>(() => {
    const entries: ContactEntry[] = []
    for (const p of filteredPartners) {
      const relevant = p.partner_contacts.filter(c => c.email?.trim() || c.website_url?.trim())
      for (const c of relevant) {
        entries.push({
          key: `${p.id}:${c.id}`,
          partnerId: p.id,
          partnerName: p.name,
          contactId: c.id,
          contactName: c.name,
          email: c.email?.trim() || null,
          websiteUrl: c.website_url?.trim() || null,
          isPrimary: c.is_primary,
        })
      }
    }
    return entries
  }, [filteredPartners])

  // Quick lookup for do_not_email flags
  const partnersById = useMemo(() => {
    const map: Record<string, Partner> = {}
    for (const p of partners) map[p.id] = p
    return map
  }, [partners])

  // Only contacts with emails can be included in the list
  const emailableContacts = useMemo(() => allContacts.filter(c => c.email), [allContacts])

  const includedContacts = useMemo(
    () => emailableContacts.filter(c => !excluded.has(c.key)),
    [emailableContacts, excluded]
  )

  const emailListString = includedContacts.map(c => c.email).join(', ')

  // Partners with multiple emailable contacts (for manage popup)
  const partnersWithMultiples = useMemo(() => {
    const grouped = new Map<string, ContactEntry[]>()
    for (const c of emailableContacts) {
      if (!grouped.has(c.partnerId)) grouped.set(c.partnerId, [])
      grouped.get(c.partnerId)!.push(c)
    }
    return [...grouped.entries()]
      .filter(([, contacts]) => contacts.length > 1)
      .map(([, contacts]) => contacts)
  }, [emailableContacts])

  const toggleFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K] extends boolean ? never : string) => {
    setFilters(prev => {
      const arr = prev[key] as string[]
      const next = arr.includes(value as string)
        ? arr.filter(v => v !== value)
        : [...arr, value as string]
      return { ...prev, [key]: next }
    })
  }, [])

  const toggleContact = (key: string) => {
    setExcluded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAllForPartner = (contacts: ContactEntry[], selectAll: boolean) => {
    setExcluded(prev => {
      const next = new Set(prev)
      for (const c of contacts) {
        if (selectAll) next.delete(c.key)
        else next.add(c.key)
      }
      return next
    })
  }

  const handleCopy = async () => {
    if (!emailListString) return
    await navigator.clipboard.writeText(emailListString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openSaveModal = () => {
    setSaveError(null)
    setSaveModal({
      open: true,
      name: buildAutoName(filters, includedContacts.length),
      subject: '',
      notes: '',
      department: '',
      logInteractions: true,
    })
  }

  const handleSave = async () => {
    if (!saveModal.department || !saveModal.subject.trim()) return
    setSaving(true)
    setSaveError(null)

    const recipients: EmailListRecipient[] = includedContacts.map(c => ({
      partnerId: c.partnerId,
      contactId: c.contactId,
      email: c.email!,
      partnerName: c.partnerName,
      contactName: c.contactName,
      isPrimary: c.isPrimary,
    }))

    const { error } = await saveEmailList({
      name: saveModal.name,
      subject: saveModal.subject.trim(),
      department: saveModal.department as PartnerDepartment,
      filtersUsed: filters as unknown as Record<string, unknown>,
      recipients,
      logInteractions: saveModal.logInteractions,
      notes: saveModal.notes.trim() || undefined,
    })

    setSaving(false)

    if (error) {
      setSaveError(error)
    } else {
      setSaveModal(s => ({ ...s, open: false }))
      router.push('/instructor/partnerships/email-lists')
    }
  }

  return (
    <div className="flex flex-col gap-8">

      {/* Filters */}
      <section className="rounded-xl border border-border bg-surface p-6 flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-dark-text">Filter Partners</h2>

        {/* Quick filters */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setFilters(f => ({ ...f, referredIn: !f.referredIn }))}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filters.referredIn
                ? 'filter-btn-admissions'
                : 'bg-background text-muted-text border-border hover:border-teal-primary'
            }`}
          >
            Referred In (Admissions)
          </button>
          <button
            onClick={() => setFilters(f => ({ ...f, referredTo: !f.referredTo }))}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filters.referredTo
                ? 'filter-btn-student-success'
                : 'bg-background text-muted-text border-border hover:border-teal-primary'
            }`}
          >
            Referred To (Student Success)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Status */}
          <div>
            <p className="text-xs font-medium text-muted-text mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => toggleFilter('statuses', value)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    filters.statuses.includes(value)
                      ? 'bg-teal-light text-teal-primary border-teal-primary'
                      : 'bg-background text-muted-text border-border hover:border-teal-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Department */}
          <div>
            <p className="text-xs font-medium text-muted-text mb-2">Department</p>
            <div className="flex flex-wrap gap-2">
              {ALL_DEPARTMENTS.map(dept => (
                <button
                  key={dept}
                  onClick={() => toggleFilter('departments', dept)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    filters.departments.includes(dept)
                      ? DEPT_BADGE[dept]
                      : 'bg-background text-muted-text border-border hover:border-teal-primary'
                  }`}
                >
                  {DEPARTMENT_LABELS[dept]}
                </button>
              ))}
            </div>
          </div>

          {/* Partner Type */}
          <div>
            <p className="text-xs font-medium text-muted-text mb-2">Partner Type</p>
            <div className="flex flex-wrap gap-2">
              {ALL_PARTNER_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => toggleFilter('partnerTypes', type)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    filters.partnerTypes.includes(type)
                      ? 'bg-teal-light text-teal-primary border-teal-primary'
                      : 'bg-background text-muted-text border-border hover:border-teal-primary'
                  }`}
                >
                  {PARTNER_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* State */}
          <div>
            <p className="text-xs font-medium text-muted-text mb-2">State</p>
            <div className="flex flex-wrap gap-2">
              {availableStates.map(state => (
                <button
                  key={state}
                  onClick={() => toggleFilter('states', state)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    filters.states.includes(state)
                      ? 'bg-teal-light text-teal-primary border-teal-primary'
                      : 'bg-background text-muted-text border-border hover:border-teal-primary'
                  }`}
                >
                  {state}
                </button>
              ))}
              {availableStates.length === 0 && (
                <span className="text-xs text-muted-text">No state data available</span>
              )}
            </div>
          </div>
        </div>

        {/* Clear filters */}
        {(filters.partnerTypes.length > 0 || filters.states.length > 0 || filters.statuses.length > 0 || filters.departments.length > 0 || filters.referredIn || filters.referredTo) && (
          <button
            onClick={() => setFilters({ partnerTypes: [], states: [], statuses: [], departments: [], referredIn: false, referredTo: false })}
            className="text-xs text-muted-text hover:text-dark-text underline self-start"
          >
            Clear all filters
          </button>
        )}
      </section>

      {/* Results header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm font-medium text-dark-text">
            {includedContacts.length} emailable contact{includedContacts.length !== 1 ? 's' : ''} from {filteredPartners.length} partner{filteredPartners.length !== 1 ? 's' : ''}
          </p>
          {allContacts.length > emailableContacts.length && (
            <span className="text-xs text-muted-text">
              + {allContacts.length - emailableContacts.length} form-only
            </span>
          )}
          {emailableContacts.length > includedContacts.length && (
            <span className="text-xs text-muted-text">
              ({emailableContacts.length - includedContacts.length} removed)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {partnersWithMultiples.length > 0 && (
            <button
              onClick={() => setManagingMultiples(true)}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-text hover:text-dark-text hover:border-teal-primary transition-colors"
            >
              Manage multiples ({partnersWithMultiples.length})
            </button>
          )}
        </div>
      </div>

      {/* Contact list */}
      {allContacts.length === 0 ? (
        <div className="text-center py-12 text-muted-text border border-dashed border-border rounded-xl">
          <p className="text-sm">No contacts match the selected filters.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {allContacts.map(c => {
            const isFormOnly = !c.email && c.websiteUrl
            const isRemoved = excluded.has(c.key)
            const partner = partnersById[c.partnerId]
            const isDne = !!partner?.do_not_email
            return (
              <div
                key={c.key}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-colors ${
                  isDne && !isRemoved
                    ? 'border-red-300 bg-red-50/30'
                    : isFormOnly
                      ? 'border-border bg-background'
                      : isRemoved
                        ? 'border-border bg-background opacity-40'
                        : 'border-border bg-surface'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.email ? (
                      <span className="text-sm text-dark-text font-medium truncate">{c.email}</span>
                    ) : (
                      <span className="text-sm text-muted-text italic">No email</span>
                    )}
                    {c.isPrimary && !isFormOnly && (
                      <span className="text-xs bg-teal-light text-teal-primary rounded px-1.5 py-0.5 shrink-0">Primary</span>
                    )}
                    {isFormOnly && (
                      <span className="text-xs bg-background border border-border text-muted-text rounded px-1.5 py-0.5 shrink-0">Form only</span>
                    )}
                    {isDne && !isRemoved && (
                      <button
                        type="button"
                        onClick={() => setDneModal({ partnerName: c.partnerName, notes: partner?.do_not_email_notes ?? '', contactKey: c.key })}
                        className="text-xs font-medium bg-red-100 text-red-700 rounded px-1.5 py-0.5 shrink-0 hover:bg-red-200 transition-colors"
                      >
                        ⊘ Do not email
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-text truncate">{c.partnerName} · {c.contactName}</p>
                  {c.websiteUrl && (
                    <a
                      href={c.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-teal-primary hover:underline truncate block mt-0.5"
                    >
                      {c.websiteUrl}
                    </a>
                  )}
                </div>
                {!isFormOnly && (
                  <button
                    onClick={() => toggleContact(c.key)}
                    className={`shrink-0 text-xs px-2 py-1 rounded border transition-colors ${
                      isRemoved
                        ? 'border-teal-primary text-teal-primary hover:bg-teal-light'
                        : 'contact-remove-btn'
                    }`}
                  >
                    {isRemoved ? 'Add back' : 'Remove'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Email list output */}
      {includedContacts.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-dark-text">Email List</h2>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-background border border-border hover:border-teal-primary text-dark-text transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button
                onClick={openSaveModal}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-primary text-white hover:bg-teal-primary/90 transition-colors"
              >
                Save & Log Email
              </button>
            </div>
          </div>
          <textarea
            readOnly
            value={emailListString}
            rows={4}
            className="w-full text-xs font-mono bg-background border border-border rounded-lg px-3 py-2 text-dark-text resize-none focus:outline-none"
          />
        </section>
      )}

      {/* Manage Multiples Modal */}
      {managingMultiples && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-surface rounded-xl border border-border w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-dark-text">Partners with Multiple Contacts</h3>
              <button
                onClick={() => setManagingMultiples(false)}
                className="text-muted-text hover:text-dark-text text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-5">
              {partnersWithMultiples.map(contacts => {
                const allIncluded = contacts.every(c => !excluded.has(c.key))
                const allExcluded = contacts.every(c => excluded.has(c.key))
                return (
                  <div key={contacts[0].partnerId} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-dark-text">{contacts[0].partnerName}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleAllForPartner(contacts, true)}
                          disabled={allIncluded}
                          className="text-xs text-teal-primary hover:underline disabled:opacity-40"
                        >
                          Select All
                        </button>
                        <span className="text-muted-text text-xs">/</span>
                        <button
                          onClick={() => toggleAllForPartner(contacts, false)}
                          disabled={allExcluded}
                          className="text-xs text-red-500 hover:underline disabled:opacity-40"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>
                    {contacts.map(c => (
                      <label
                        key={c.key}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-background cursor-pointer hover:border-teal-primary transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!excluded.has(c.key)}
                          onChange={() => toggleContact(c.key)}
                          className="accent-teal-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-dark-text font-medium truncate">{c.email}</p>
                          <p className="text-xs text-muted-text">{c.contactName}{c.isPrimary ? ' · Primary' : ''}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-4 border-t border-border">
              <button
                onClick={() => setManagingMultiples(false)}
                className="w-full px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {saveModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-surface rounded-xl border border-border w-full max-w-md shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h3 className="text-base font-semibold text-dark-text">Save Email List</h3>
              <button
                onClick={() => setSaveModal(s => ({ ...s, open: false }))}
                className="text-muted-text hover:text-dark-text text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-5 flex flex-col gap-4 overflow-y-auto">

              {/* Name */}
              <div>
                <label className="text-xs font-medium text-muted-text mb-1.5 block">List Name</label>
                <input
                  type="text"
                  value={saveModal.name}
                  onChange={e => setSaveModal(s => ({ ...s, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-dark-text focus:outline-none focus:border-teal-primary"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="text-xs font-medium text-muted-text mb-1.5 block">
                  Email Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={saveModal.subject}
                  onChange={e => setSaveModal(s => ({ ...s, subject: e.target.value }))}
                  placeholder="e.g. AC Partnership Opportunities – Spring 2026"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-dark-text focus:outline-none focus:border-teal-primary"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-muted-text mb-1.5 block">Notes</label>
                <textarea
                  value={saveModal.notes}
                  onChange={e => setSaveModal(s => ({ ...s, notes: e.target.value }))}
                  placeholder="Summary of email content, follow-up actions, responses…"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-dark-text focus:outline-none focus:border-teal-primary resize-none"
                />
              </div>

              {/* Department */}
              <div>
                <label className="text-xs font-medium text-muted-text mb-1.5 block">
                  Log Interaction Under Department <span className="text-red-500">*</span>
                </label>
                <select
                  value={saveModal.department}
                  onChange={e => setSaveModal(s => ({ ...s, department: e.target.value as PartnerDepartment | '' }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-dark-text focus:outline-none focus:border-teal-primary"
                >
                  <option value="">Select department…</option>
                  {ALL_DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
                  ))}
                </select>
              </div>

              {/* Log interaction toggle */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveModal.logInteractions}
                  onChange={e => setSaveModal(s => ({ ...s, logInteractions: e.target.checked }))}
                  className="mt-0.5 accent-teal-primary"
                />
                <div>
                  <p className="text-sm text-dark-text font-medium">Log email sent to partners</p>
                  <p className="text-xs text-muted-text mt-0.5">
                    Adds an interaction note to each partner's history: "Included in email list: {saveModal.name || '…'}"
                  </p>
                </div>
              </label>

              <p className="text-xs text-muted-text">
                Saving will record {includedContacts.length} recipient{includedContacts.length !== 1 ? 's' : ''} from {filteredPartners.length} partner{filteredPartners.length !== 1 ? 's' : ''}.
              </p>

              {saveError && (
                <p className="alert-error text-xs px-3 py-2">
                  Error: {saveError}
                </p>
              )}
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-border shrink-0">
              <button
                onClick={() => setSaveModal(s => ({ ...s, open: false }))}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted-text hover:text-dark-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !saveModal.department || !saveModal.name.trim() || !saveModal.subject.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Do-not-email modal */}
      {dneModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setDneModal(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-2xl border border-border shadow-xl w-full max-w-md flex flex-col gap-4 p-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-dark-text">⊘ Do not email</h2>
                  <p className="text-sm text-muted-text mt-0.5">{dneModal.partnerName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDneModal(null)}
                  className="text-muted-text hover:text-dark-text text-xl leading-none"
                >
                  ×
                </button>
              </div>
              {dneModal.notes ? (
                <p className="text-sm text-dark-text whitespace-pre-line bg-background rounded-lg px-4 py-3 border border-border">
                  {dneModal.notes}
                </p>
              ) : (
                <p className="text-sm text-muted-text italic">No notes provided.</p>
              )}
              <p className="text-xs text-muted-text">This org has been marked as do-not-email. You can still include them in this list if appropriate.</p>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDneModal(null)}
                  className="px-4 py-2 rounded-lg bg-surface border border-border text-sm text-dark-text hover:border-teal-primary transition-colors"
                >
                  Keep in list
                </button>
                <button
                  type="button"
                  onClick={() => { toggleContact(dneModal.contactKey); setDneModal(null) }}
                  className="px-4 py-2 rounded-lg bg-background border border-border text-sm text-muted-text hover:border-red-400 hover:text-red-600 transition-colors"
                >
                  Remove from list
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
