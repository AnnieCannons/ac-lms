'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PartnerFormData, PartnerContact, PartnerStatus, PartnerType, PartnerDepartment } from '@/lib/partner-actions'
import { DEPARTMENT_LABELS } from '@/lib/partner-constants'
import { SERVICE_CATEGORIES } from '@/lib/service-categories'
import { findSimilarPartners } from '@/lib/partner-interactions-actions'

const ALL_DEPARTMENTS = Object.entries(DEPARTMENT_LABELS) as [PartnerDepartment, string][]

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

export default function PartnerForm({ initialData, staffUsers, onSubmit, submitLabel, partnerId, defaultDepartment, redirectTo }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<{ id: string; name: string; city: string | null; state: string | null }[]>([])
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [name, setName] = useState(initialData?.name ?? '')
  const [city, setCity] = useState(initialData?.city ?? '')
  const [state, setState] = useState(initialData?.state ?? '')
  const [multiCity, setMultiCity] = useState(initialData?.multi_city ?? false)
  const [nationwide, setNationwide] = useState(initialData?.state === 'Nationwide')
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
  const [departments, setDepartments] = useState<PartnerDepartment[]>(
    initialData?.departments ?? (defaultDepartment ? [defaultDepartment] : [])
  )
  const [serviceCategories, setServiceCategories] = useState<string[]>(
    initialData?.service_categories ?? []
  )

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
    setPartnerTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
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

    const result = await onSubmit({
      name: name.trim(),
      city: nationwide ? null : (city.trim() || null),
      state: nationwide ? 'Nationwide' : (state.trim() || null),
      multi_city: nationwide ? true : multiCity,
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
            onChange={e => {
              setNationwide(e.target.checked)
              if (e.target.checked) { setCity(''); setState(''); setMultiCity(false) }
            }}
            className="rounded border-border text-teal-primary focus:ring-teal-primary"
          />
          Nationwide (operates across the US)
        </label>

        {!nationwide && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  placeholder="City"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={e => setState(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  placeholder="State"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-dark-text cursor-pointer">
              <input
                type="checkbox"
                checked={multiCity}
                onChange={e => setMultiCity(e.target.checked)}
                className="rounded border-border text-teal-primary focus:ring-teal-primary"
              />
              Operates in multiple cities / states
            </label>
          </>
        )}

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
