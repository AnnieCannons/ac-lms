'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DEPARTMENT_LABELS, DEPT_COLORS, type PartnerDepartment } from '@/lib/partner-constants'

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
  partner_contacts: PartnerContact[]
  partner_type_assignments: PartnerTypeAssignment[]
  partner_department_status: DeptStatus[]
  student_referrals: StudentReferral[]
  latest_interaction: Interaction | null
}

interface Props {
  partners: Partner[]
  department?: PartnerDepartment
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  service_provider:   'Service Provider',
  corporate:          'Corporate',
  funder:             'Funder',
  advisory:           'Advisory',
  mentorship:         'Mentorship',
  apprenticeship:     'Apprenticeship',
  media:              'Media',
  admissions_referral:'Admissions Referral',
}

const STATUS_COLORS: Record<string, string> = {
  prospect:     'bg-yellow-100 text-yellow-800 border border-yellow-200',
  active:       'bg-green-100 text-green-800 border border-green-200',
  inactive:     'bg-gray-100 text-gray-600 border border-gray-200',
  in_onboarding:'bg-blue-100 text-blue-800 border border-blue-200',
}

const STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect', active: 'Active', inactive: 'Inactive', in_onboarding: 'In Onboarding',
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PartnerList({ partners, department }: Props) {
  const [search, setSearch] = useState('')

  const filtered = partners.filter(p => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.state?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.partner_contacts.some(c => c.name.toLowerCase().includes(q))
    )
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, state, or contact…"
        className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-text py-8 text-center">
          {partners.length === 0
            ? `No partners in ${department ? DEPARTMENT_LABELS[department] : 'this view'} yet.`
            : `No partners match "${search}".`}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {search.trim() && (
            <p className="text-xs text-muted-text">{filtered.length} of {partners.length} partners</p>
          )}
          {filtered.map(partner => {
            const primaryContact = partner.partner_contacts.find(c => c.is_primary) ?? partner.partner_contacts[0]
            const deptStatus = department
              ? partner.partner_department_status.find(s => s.department === department)
              : null
            const inboundStudents = partner.student_referrals
              .filter(r => r.direction === 'inbound')
              .map(r => r.student_identifier)
            const showTypes = !department
            const showStatus = !department

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
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-text">
                      {(partner.city || partner.state) && (
                        <span>{[partner.city, partner.state].filter(Boolean).join(', ')}</span>
                      )}
                      {primaryContact && (
                        <><span className="text-muted-text/50">·</span><span>{primaryContact.name}</span></>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {deptStatus?.stage && (
                      <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${DEPT_COLORS[department!]}`}>
                        {deptStatus.stage}
                      </span>
                    )}
                    {showStatus && (
                      <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${STATUS_COLORS[partner.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[partner.status] ?? partner.status}
                      </span>
                    )}
                  </div>
                </div>

                {showTypes && partner.partner_type_assignments.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {partner.partner_type_assignments.map(t => (
                      <span key={t.partner_type} className="text-xs bg-background border border-border rounded px-1.5 py-0.5 text-muted-text">
                        {TYPE_LABELS[t.partner_type] ?? t.partner_type}
                      </span>
                    ))}
                  </div>
                )}

                {inboundStudents.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted-text shrink-0">{inboundStudents.length} referred:</span>
                    {inboundStudents.map(name => (
                      <span key={name} className="bg-background border border-border rounded-full px-2 py-0.5 text-muted-text">{name}</span>
                    ))}
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
