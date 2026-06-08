'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PartnerFormData, PartnerContact, PartnerLocation, PartnerStatus, PartnerType, PartnerDepartment } from '@/lib/partner-actions'
import { DEPARTMENT_LABELS } from '@/lib/partner-constants'
import { SERVICE_CATEGORIES } from '@/lib/service-categories'
import { findSimilarPartners } from '@/lib/partner-interactions-actions'

const ALL_DEPARTMENTS = Object.entries(DEPARTMENT_LABELS) as [PartnerDepartment, string][]

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming', 'Washington, DC',
]

const PARTNER_TYPES: { value: PartnerType; label: string }[] = [
  { value: 'service_provider', label: 'Service Provider' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'funder', label: 'Funder' },
  { value: 'advisory', label: 'Advisory' },
  { value: 'mentorship', label: 'Mentorship' },
  { value: 'apprenticeship', label: 'Apprenticeship' },
  { value: 'media', label: 'Media' },
  { value: 'admissions_referral', label: 'Admissions Referral' },
]

const STATUSES: { value: PartnerStatus; label: string }[] = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'in_onboarding', label: 'In Onboarding' },
]

interface StaffUser {
  id: string
  name: string
}

interface Props {
  initialData?: Partial<PartnerFormData>
  staffUsers: StaffUser[]
  onSubmit: (data: PartnerFormData) => Promise<{ error: string | null; id?: string }>
  submitLabel: string
  partnerId?: string
  defaultDepartment?: PartnerDepartment
  redirectTo?: string
}

function emptyContact(): PartnerContact {
  return { name: '', title: null, email: null, phone: null, is_primary: false, notes: null, linkedin_url: null, website_url: null }
}

function StateCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [input, setInput] = useState(value)
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = input.trim()
    ? US_STATES.filter(s => s.toLowerCase().includes(input.toLowerCase()))
    : US_STATES

  function select(s: string) {
    onChange(s)
    setInput(s)
    setOpen(false)
  }

  function openDropdown() {
    // Calculate fixed position so dropdown escapes any overflow:hidden parent
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      })
    }
    setOpen(true)
  }

  function handleBlur(e: React.FocusEvent) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      if (!US_STATES.includes(input)) setInput(value)
      setOpen(false)
    }
  }

  // Keep input in sync if parent value changes externally
  useEffect(() => { setInput(value) }, [value])

  return (
    <div ref={containerRef} onBlur={handleBlur}>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => { setInput(e.target.value); openDropdown() }}
        onFocus={openDropdown}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
        placeholder="Type to search states…"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul style={dropdownStyle} className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
          {filtered.map(s => (
            <li
              key={s}
              onMouseDown={() => select(s)}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-border/30 ${s === value ? 'text-teal-primary font-medium' : 'text-dark-text'}`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function PartnerForm({ initialData, staffUsers, onSubmit, submitLabel, partnerId, defaultDepartment, redirectTo }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<{ id: string; name: string; city: string | null; state: string | null }[]>([])
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [name, setName] = useState(initialData?.name ?? '')
  const [website, setWebsite] = useState(initialData?.website ?? '')
  const [nationwide, setNationwide] = useState(initialData?.state === 'Nationwide')
  const [locations, setLocations] = useState<PartnerLocation[]>(
    initialData?.locations?.length ? initialData.locations : [{ city: null, state: null }]
  )
  const [howWeMet, setHowWeMet] = useState(initialData?.how_we_met ?? '')
  const [servicesFocus, setServicesFocus] = useState(initialData?.services_focus_area ?? '')
  const [status, setStatus] = useState<PartnerStatus>(initialData?.status ?? 'prospect')
  const [lastInteraction, setLastInteraction] = useState(initialData?.last_interaction_date ?? '')
  const [meetingNotes, setMeetingNotes] = useState(initialData?.meeting_notes ?? '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? [])
  const [internalOwner, setInternalOwner] = useState(initialData?.internal_owner_id ?? '')
  const [referredBy, setReferredBy] = useState(initialData?.referred_by ?? '')
  const [partnerTypes, setPartnerTypes] = useState<PartnerType[]>(initialData?.partner_types ?? [])
  const [contacts, setContacts] = useState<PartnerContact[]>(
    initialData?.contacts?.length ? initialData.contacts : [emptyContact()]
  )
  const [departments, setDepartments] = useState<PartnerDepartment[]>(() => {
    const base: PartnerDepartment[] = initialData?.departments ?? (defaultDepartment ? [defaultDepartment] : [])
    const hasAdmissionsReferral = (initialData?.partner_types ?? []).includes('admissions_referral')
    if (hasAdmissionsReferral && !base.includes('admissions')) return [...base, 'admissions']
    return base
  })
  const [serviceCategories, setServiceCategories] = useState<string[]>(
    initialData?.service_categories ?? []
  )
  const [customCatInput, setCustomCatInput] = useState('')

  function toggleDepartment(dept: PartnerDepartment) {
    setDepartments(prev =>
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    )
  }

  function toggleServiceCategory(cat: string) {
    setServiceCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  function handleNameChange(value: string) {
    setName(value)
    if (dupTimerRef.current) clearTimeout(dupTimerRef.current)
    if (value.trim().length < 3) { setDuplicates([]); return }
    dupTimerRef.current = setTimeout(async () => {
      const { matches } = await findSimilarPartners(value.trim(), partnerId)
      setDuplicates(matches)
    }, 400)
  }

  function toggleType(type: PartnerType) {
    const adding = !partnerTypes.includes(type)
    setPartnerTypes(prev => adding ? [...prev, type] : prev.filter(t => t !== type))
    if (type === 'admissions_referral' && adding) {
      setDepartments(prev => prev.includes('admissions') ? prev : [...prev, 'admissions'])
    }
  }

  function addTag() {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags(prev => prev.filter(t => t !== tag))
  }

  function updateContact(index: number, field: keyof PartnerContact, value: string | boolean | null) {
    setContacts(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  function setPrimary(index: number) {
    setContacts(prev => prev.map((c, i) => ({ ...c, is_primary: i === index })))
  }

  function addContact() {
    setContacts(prev => [...prev, emptyContact()])
  }

  function removeContact(index: number) {
    setContacts(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setServerError(null)

    const cleanLocations = nationwide ? [] : locations.filter(l => l.city?.trim() || l.state?.trim())
    const primaryLoc = cleanLocations[0] ?? null

    const result = await onSubmit({
      name: name.trim(),
      city: nationwide ? null : (primaryLoc?.city ?? null),
      state: nationwide ? 'Nationwide' : (primaryLoc?.state ?? null),
      multi_city: nationwide ? true : cleanLocations.length > 1,
      locations: cleanLocations,
      website: website.trim() || null,
      how_we_met: howWeMet.trim() || null,
      services_focus_area: servicesFocus.trim() || null,
      status,
      last_interaction_date: lastInteraction || null,
      meeting_notes: meetingNotes.trim() || null,
      tags,
      internal_owner_id: internalOwner || null,
      referred_by: referredBy.trim() || null,
      partner_types: partnerTypes,
      contacts: contacts.filter(c => c.name.trim()),
      departments,
      service_categories: serviceCategories,
    })

    setSaving(false)
    if (result.error) {
      setServerError(result.error)
      return
    }
    router.push(redirectTo ?? '/instructor/partnerships')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 max-w-2xl">

      {/* Basic info */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Organization</h2>

        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            required
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
            placeholder="Organization name"
          />
          {duplicates.length > 0 && (
            <div className="mt-1.5 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 flex flex-col gap-1">
              <span className="font-medium">Similar organizations already exist:</span>
              {duplicates.map(d => (
                <Link key={d.id} href={`/instructor/partnerships/${d.id}`} className="hover:underline">
                  {d.name}{d.city ? ` — ${d.city}${d.state ? `, ${d.state}` : ''}` : ''}
                </Link>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-dark-text cursor-pointer">
          <input
            type="checkbox"
            checked={nationwide}
            onChange={e => setNationwide(e.target.checked)}
            className="rounded border-border text-teal-primary focus:ring-teal-primary"
          />
          Nationwide (operates across the US)
        </label>

        {!nationwide && (
          <div className="flex flex-col gap-2">
            {locations.map((loc, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 items-end">
                <div>
                  {i === 0 && <label className="block text-sm font-medium text-dark-text mb-1">City</label>}
                  <input
                    type="text"
                    value={loc.city ?? ''}
                    onChange={e => setLocations(prev => prev.map((l, j) => j === i ? { ...l, city: e.target.value || null } : l))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                    placeholder="City"
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    {i === 0 && <label className="block text-sm font-medium text-dark-text mb-1">State</label>}
                    <StateCombobox value={loc.state ?? ''} onChange={v => setLocations(prev => prev.map((l, j) => j === i ? { ...l, state: v || null } : l))} />
                  </div>
                  {locations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLocations(prev => prev.filter((_, j) => j !== i))}
                      className="pb-2 text-muted-text hover:text-red-500 transition-colors text-lg leading-none"
                      title="Remove location"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLocations(prev => [...prev, { city: null, state: null }])}
              className="self-start text-sm text-teal-primary hover:underline"
            >
              + Add location
            </button>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">Website</label>
          <input
            type="url"
            value={website}
            onChange={e => setWebsite(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
            placeholder="https://example.org"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as PartnerStatus)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
          >
            {STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Partner types */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Partner Type(s)</h2>
        <div className="flex flex-wrap gap-2">
          {PARTNER_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => toggleType(t.value)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                partnerTypes.includes(t.value)
                  ? 'bg-teal-primary text-white border-teal-primary'
                  : 'bg-background text-muted-text border-border hover:border-teal-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* Departments */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Departments</h2>
        <p className="text-xs text-muted-text -mt-1">Which teams will work with this partner?</p>
        <div className="flex flex-wrap gap-2">
          {ALL_DEPARTMENTS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleDepartment(value)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                departments.includes(value)
                  ? 'bg-teal-primary text-white border-teal-primary'
                  : 'bg-background text-muted-text border-border hover:border-teal-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Service Categories */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Services Provided</h2>
        <p className="text-xs text-muted-text -mt-1">What types of support does this org offer?</p>
        <div className="flex flex-wrap gap-2">
          {SERVICE_CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleServiceCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                serviceCategories.includes(cat)
                  ? 'bg-teal-primary text-white border-teal-primary'
                  : 'bg-background text-muted-text border-border hover:border-teal-primary'
              }`}
            >
              {cat}
            </button>
          ))}
          {/* Custom categories (not in predefined list) shown as removable pills */}
          {serviceCategories.filter(c => !(SERVICE_CATEGORIES as readonly string[]).includes(c)).map(cat => (
            <span key={cat} className="flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-full text-sm border bg-teal-primary text-white border-teal-primary">
              {cat}
              <button
                type="button"
                onClick={() => setServiceCategories(prev => prev.filter(c => c !== cat))}
                className="hover:opacity-70 leading-none text-base"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={customCatInput}
            onChange={e => setCustomCatInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const t = customCatInput.trim()
                if (t && !serviceCategories.includes(t)) setServiceCategories(prev => [...prev, t])
                setCustomCatInput('')
              }
            }}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
            placeholder="Add a custom category…"
          />
          <button
            type="button"
            onClick={() => {
              const t = customCatInput.trim()
              if (t && !serviceCategories.includes(t)) setServiceCategories(prev => [...prev, t])
              setCustomCatInput('')
            }}
            className="px-3 py-2 rounded-lg border border-border text-sm text-muted-text hover:border-teal-primary hover:text-teal-primary transition-colors"
          >
            +
          </button>
        </div>
      </section>

      {/* Contacts */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Contacts</h2>
        {contacts.map((contact, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-text">Contact {i + 1}</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted-text cursor-pointer">
                  <input
                    type="radio"
                    name="primary-contact"
                    checked={contact.is_primary}
                    onChange={() => setPrimary(i)}
                    className="text-teal-primary focus:ring-teal-primary"
                  />
                  Primary
                </label>
                {contacts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeContact(i)}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-dark-text mb-1">Name</label>
                <input
                  type="text"
                  value={contact.name}
                  onChange={e => updateContact(i, 'name', e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-text mb-1">Title</label>
                <input
                  type="text"
                  value={contact.title ?? ''}
                  onChange={e => updateContact(i, 'title', e.target.value || null)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  placeholder="Job title"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-text mb-1">Email</label>
                <input
                  type="email"
                  value={contact.email ?? ''}
                  onChange={e => updateContact(i, 'email', e.target.value || null)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-text mb-1">Phone</label>
                <input
                  type="tel"
                  value={contact.phone ?? ''}
                  onChange={e => updateContact(i, 'phone', e.target.value || null)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  placeholder="Phone number"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-dark-text mb-1">LinkedIn URL</label>
                <input
                  type="url"
                  value={contact.linkedin_url ?? ''}
                  onChange={e => updateContact(i, 'linkedin_url' as keyof PartnerContact, e.target.value || null)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-text mb-1">Website</label>
                <input
                  type="url"
                  value={contact.website_url ?? ''}
                  onChange={e => updateContact(i, 'website_url' as keyof PartnerContact, e.target.value || null)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  placeholder="https://..."
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-dark-text mb-1">Notes</label>
              <input
                type="text"
                value={contact.notes ?? ''}
                onChange={e => updateContact(i, 'notes', e.target.value || null)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                placeholder="Anything to remember about this contact"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addContact}
          className="self-start text-sm text-teal-primary hover:underline"
        >
          + Add contact
        </button>
      </section>

      {/* Relationship */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Relationship</h2>

        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">Internal Owner</label>
          <select
            value={internalOwner}
            onChange={e => setInternalOwner(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
          >
            <option value="">Unassigned</option>
            {staffUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">How We Met</label>
          <input
            type="text"
            value={howWeMet}
            onChange={e => setHowWeMet(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
            placeholder="e.g. referral from X, cold outreach, event"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">Referred By</label>
          <input
            type="text"
            value={referredBy}
            onChange={e => setReferredBy(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
            placeholder="Person or org that referred them"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">Last Interaction Date</label>
          <input
            type="date"
            value={lastInteraction}
            onChange={e => setLastInteraction(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
          />
        </div>
      </section>

      {/* Details */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wide">Details</h2>

        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">Services / Focus Area</label>
          <textarea
            value={servicesFocus}
            onChange={e => setServicesFocus(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
            placeholder="What this org does; eligibility criteria"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">Meeting Notes</label>
          <textarea
            value={meetingNotes}
            onChange={e => setMeetingNotes(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
            placeholder="Timestamped notes, unique things to remember"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 text-xs bg-surface border border-border rounded-full px-2.5 py-1 text-dark-text">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="text-muted-text hover:text-red-500 leading-none">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
              placeholder="e.g. veteran-serving, remote-friendly"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-3 py-2 rounded-lg border border-border text-sm text-muted-text hover:border-teal-primary hover:text-teal-primary transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </section>

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{serverError}</p>
      )}

      <div className="flex items-center gap-3 pb-10">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="px-5 py-2.5 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-lg border border-border text-sm text-muted-text hover:border-teal-primary hover:text-teal-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
