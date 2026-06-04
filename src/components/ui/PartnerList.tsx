'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { DEPARTMENT_LABELS, DEPT_COLORS, type PartnerDepartment } from '@/lib/partner-constants'
import { SERVICE_CATEGORIES } from '@/lib/service-categories'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PartnerContact { is_primary: boolean; name: string }
interface PartnerTypeAssignment { partner_type: string }
interface DeptStatus { department: PartnerDepartment; stage: string }
interface StudentReferral { student_identifier: string; direction: string }
interface Interaction {
  note: string
  interaction_date: string
  department: PartnerDepartment | null
  users: { name: string } | null
}

interface Partner {
  id: string
  name: string
  city: string | null
  state: string | null
  status: string
  last_interaction_date: string | null
  service_categories: string[] | null
  partner_contacts: PartnerContact[]
  partner_type_assignments: PartnerTypeAssignment[]
  partner_department_status: DeptStatus[]
  student_referrals: StudentReferral[]
  latest_interaction: Interaction | null
  combined_student_rating?: { avg: number; count: number } | null
}

export type SortOption = 'name' | 'referrals_in' | 'referrals_out' | 'last_interaction'

interface Props {
  partners: Partner[]
  department?: PartnerDepartment
  /** Which sort options to show. Defaults to ['name'] */
  sortOptions?: SortOption[]
  /** Show service category filter bar */
  showCategoryFilter?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  prospect:     'bg-yellow-100 text-yellow-800 border border-yellow-200',
  active:       'bg-green-100 text-green-800 border border-green-200',
  inactive:     'bg-gray-100 text-gray-600 border border-gray-200',
  in_onboarding:'bg-blue-100 text-blue-800 border border-blue-200',
}

const STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect', active: 'Active', inactive: 'Inactive', in_onboarding: 'In Onboarding',
}

const SORT_LABELS: Record<SortOption, string> = {
  name:             'Name',
  referrals_in:     'Most referred in',
  referrals_out:    'Most referred out',
  last_interaction: 'Recent activity',
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ─── Sort bar (reusable) ──────────────────────────────────────────────────────

export function PartnerSortBar({
  options,
  value,
  onChange,
}: {
  options: SortOption[]
  value: SortOption
  onChange: (s: SortOption) => void
}) {
  if (options.length <= 1) return null
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-text shrink-0">Sort:</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              value === opt
                ? 'bg-teal-primary text-white border-teal-primary'
                : 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary'
            }`}
          >
            {SORT_LABELS[opt]}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Category filter bar (reusable) ──────────────────────────────────────────

export function PartnerCategoryFilter({
  available,
  selected,
  onChange,
}: {
  available: string[]
  selected: Set<string>
  onChange: (cats: Set<string>) => void
}) {
  if (available.length === 0) return null

  function toggle(cat: string) {
    const next = new Set(selected)
    next.has(cat) ? next.delete(cat) : next.add(cat)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-text uppercase tracking-wide">Filter by service</span>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="text-xs text-muted-text hover:text-dark-text transition-colors"
          >
            Clear ({selected.size})
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {available.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => toggle(cat)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              selected.has(cat)
                ? 'bg-teal-primary text-white border-teal-primary'
                : 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PartnerList({ partners, department, sortOptions = ['name'], showCategoryFilter = false }: Props) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>(sortOptions[0] ?? 'name')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())

  // Only show categories that at least one partner in this list has
  const availableCategories = useMemo(() => {
    const present = new Set<string>()
    for (const p of partners) {
      for (const c of p.service_categories ?? []) present.add(c)
    }
    return SERVICE_CATEGORIES.filter(c => present.has(c))
  }, [partners])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const base = partners.filter(p => {
      if (q && !(
        p.name.toLowerCase().includes(q) ||
        p.state?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.partner_contacts.some(c => c.name.toLowerCase().includes(q))
      )) return false
      if (selectedCategories.size > 0) {
        const partnerCats = new Set(p.service_categories ?? [])
        if (![...selectedCategories].every(c => partnerCats.has(c))) return false
      }
      return true
    })

    return base.sort((a, b) => {
      switch (sort) {
        case 'referrals_in':
          return b.student_referrals.filter(r => r.direction === 'inbound').length
               - a.student_referrals.filter(r => r.direction === 'inbound').length
        case 'referrals_out':
          return b.student_referrals.filter(r => r.direction === 'outbound').length
               - a.student_referrals.filter(r => r.direction === 'outbound').length
        case 'last_interaction':
          return (b.last_interaction_date ?? '').localeCompare(a.last_interaction_date ?? '')
        case 'name':
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [partners, search, sort])

  return (
    <div className="flex flex-col gap-4">
      {/* Search + Sort + Filter */}
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, state, or contact…"
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
        />
        <PartnerSortBar options={sortOptions} value={sort} onChange={setSort} />
        {showCategoryFilter && availableCategories.length > 0 && (
          <PartnerCategoryFilter
            available={availableCategories}
            selected={selectedCategories}
            onChange={setSelectedCategories}
          />
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-text py-8 text-center">
          {partners.length === 0
            ? `No partners in ${department ? DEPARTMENT_LABELS[department] : 'this view'} yet.`
            : `No partners match "${search}".`}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {(search.trim() || selectedCategories.size > 0) && (
            <p className="text-xs text-muted-text">{filtered.length} of {partners.length} partners</p>
          )}
          {filtered.map(partner => {
            const primaryContact = partner.partner_contacts.find(c => c.is_primary) ?? partner.partner_contacts[0]
            const inboundStudents = partner.student_referrals
              .filter(r => r.direction === 'inbound')
              .map(r => r.student_identifier)
            const outboundStudents = partner.student_referrals
              .filter(r => r.direction === 'outbound')
              .map(r => r.student_identifier)
            const showDepts = !department
            const showStatus = !department

            const isNationwide = partner.state === 'Nationwide'
            const stateDisplay = isNationwide ? 'Nationwide' : (partner.state?.split(',')[0].trim() ?? null)

            return (
              <Link
                key={partner.id}
                href={`/instructor/partnerships/${partner.id}${department ? `?dept=${department}` : ''}`}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-5 py-4 hover:border-teal-primary hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="font-semibold text-dark-text group-hover:text-teal-primary transition-colors truncate">
                      {partner.name}
                    </p>
                    {primaryContact && (
                      <p className="text-xs text-muted-text">{primaryContact.name}</p>
                    )}
                    {partner.combined_student_rating && (
                      <p className="text-xs">
                        <span className="text-yellow-500 font-semibold">
                          {partner.combined_student_rating.avg.toFixed(1)} ★
                        </span>
                        <span className="text-muted-text ml-1">
                          combined reviews ({partner.combined_student_rating.count})
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {stateDisplay && (
                      <span className={`text-xs font-medium rounded-full px-2.5 py-1 border ${
                        isNationwide
                          ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40'
                          : 'bg-background border-border text-muted-text'
                      }`}>
                        {stateDisplay}
                      </span>
                    )}
                    {showStatus && (
                      <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${STATUS_COLORS[partner.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[partner.status] ?? partner.status}
                      </span>
                    )}
                  </div>
                </div>

                {showDepts && partner.partner_department_status.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {partner.partner_department_status.map(s => (
                      <span key={s.department} className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${DEPT_COLORS[s.department as PartnerDepartment]}`}>
                        {DEPARTMENT_LABELS[s.department as PartnerDepartment] ?? s.department}
                      </span>
                    ))}
                  </div>
                )}

                {(partner.service_categories ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(partner.service_categories ?? []).map(cat => (
                      <span key={cat} className="text-xs bg-background border border-border rounded px-1.5 py-0.5 text-muted-text">
                        {cat}
                      </span>
                    ))}
                  </div>
                )}

                {(inboundStudents.length > 0 || outboundStudents.length > 0) && (
                  <div className="flex flex-col gap-1">
                    {inboundStudents.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-muted-text shrink-0">{inboundStudents.length} referred in:</span>
                        {inboundStudents.map(name => (
                          <span key={name} className="bg-background border border-border rounded-full px-2 py-0.5 text-muted-text">{name}</span>
                        ))}
                      </div>
                    )}
                    {outboundStudents.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-muted-text shrink-0">{outboundStudents.length} referred out:</span>
                        {outboundStudents.map(name => (
                          <span key={name} className="bg-background border border-border rounded-full px-2 py-0.5 text-muted-text">{name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {partner.latest_interaction ? (
                  <div className="flex items-start gap-2 text-xs text-muted-text border-t border-border pt-2.5">
                    <span className="shrink-0 font-medium text-dark-text/70">{formatDate(partner.latest_interaction.interaction_date)}</span>
                    {partner.latest_interaction.users?.name && (
                      <span className="shrink-0">by {partner.latest_interaction.users.name}</span>
                    )}
                    <span className="truncate text-muted-text/80">{partner.latest_interaction.note}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-text/60 border-t border-border pt-2.5">No interactions logged</p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
