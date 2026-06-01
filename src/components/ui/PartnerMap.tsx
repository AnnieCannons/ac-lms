'use client'

import { useState, useMemo } from 'react'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ComposableMap, Geographies, Geography } = require('react-simple-maps')
import Link from 'next/link'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Partner {
  id: string
  name: string
  state: string | null
  city: string | null
  multi_city: boolean
  status: string
  last_interaction_date: string | null
  partner_contacts: { name: string; is_primary: boolean }[]
  partner_department_status: { department: string; stage: string }[]
  partner_type_assignments: { partner_type: string }[]
  student_referrals: { student_identifier: string; direction: string }[]
  latest_interaction: {
    note: string
    interaction_date: string
    users: { name: string } | null
  } | null
}

interface Props {
  partners: Partner[]
  department?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function PartnerCard({ p, department }: { p: Partner; department?: string }) {
  const primaryContact = p.partner_contacts.find(c => c.is_primary) ?? p.partner_contacts[0]
  const inbound = p.student_referrals.filter(r => r.direction === 'inbound')
  const outbound = p.student_referrals.filter(r => r.direction === 'outbound')

  return (
    <Link
      href={`/instructor/partnerships/${p.id}${department ? `?dept=${department}` : ''}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3 hover:border-teal-primary hover:shadow-sm transition-all group"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="font-semibold text-sm text-dark-text group-hover:text-teal-primary transition-colors truncate">
          {p.name}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-text">
          {(p.city || p.state) && (
            <span>{[p.city, p.state].filter(Boolean).join(', ')}</span>
          )}
          {primaryContact && (
            <><span className="text-muted-text/40">·</span><span>{primaryContact.name}</span></>
          )}
        </div>
      </div>

      {(inbound.length > 0 || outbound.length > 0) && (
        <div className="flex flex-col gap-0.5">
          {inbound.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span className="text-muted-text shrink-0">{inbound.length} referred in:</span>
              {inbound.map(r => (
                <span key={r.student_identifier} className="bg-background border border-border rounded-full px-1.5 py-0.5 text-muted-text">
                  {r.student_identifier}
                </span>
              ))}
            </div>
          )}
          {outbound.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span className="text-muted-text shrink-0">{outbound.length} referred out:</span>
              {outbound.map(r => (
                <span key={r.student_identifier} className="bg-background border border-border rounded-full px-1.5 py-0.5 text-muted-text">
                  {r.student_identifier}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {p.latest_interaction ? (
        <div className="flex items-start gap-1.5 text-xs text-muted-text border-t border-border pt-2">
          <span className="shrink-0 font-medium text-dark-text/70">{formatDate(p.latest_interaction.interaction_date)}</span>
          <span className="truncate">{p.latest_interaction.note}</span>
        </div>
      ) : (
        <p className="text-xs text-muted-text/50 border-t border-border pt-2">No interactions logged</p>
      )}
    </Link>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PartnerMap({ partners, department }: Props) {
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set())
  const [tooltip, setTooltip] = useState<{ name: string; count: number } | null>(null)
  const [search, setSearch] = useState('')
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false)
  const [stateSearch, setStateSearch] = useState('')

  // state name → partners[]
  const partnersByState = useMemo(() => {
    const map: Record<string, Partner[]> = {}
    for (const p of partners) {
      if (!p.state) continue
      for (const s of p.state.split(',').map(s => s.trim()).filter(Boolean)) {
        if (!map[s]) map[s] = []
        map[s].push(p)
      }
    }
    return map
  }, [partners])

  const maxCount = Math.max(...Object.values(partnersByState).map(a => a.length), 1)
  const statesRepresented = Object.keys(partnersByState).length
  const noStateCount = partners.filter(p => !p.state).length

  // Alphabetical list of states that have partners, filtered by dropdown search
  const allStatesWithPartners = useMemo(() =>
    Object.entries(partnersByState)
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([name]) =>
        !stateSearch.trim() || name.toLowerCase().includes(stateSearch.toLowerCase())
      ),
    [partnersByState, stateSearch]
  )

  // Partners to show in left list — filtered by selected states, then search
  const listPartners = useMemo(() => {
    const base = selectedStates.size === 0
      ? [...partners]
      : Array.from(
          new Map(
            [...selectedStates].flatMap(s => partnersByState[s] ?? []).map(p => [p.id, p])
          ).values()
        )

    const sorted = base.sort((a, b) => a.name.localeCompare(b.name))

    if (!search.trim()) return sorted
    const q = search.toLowerCase()
    return sorted.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.state?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.partner_contacts.some(c => c.name.toLowerCase().includes(q))
    )
  }, [partners, partnersByState, selectedStates, search])

  function toggleState(stateName: string) {
    setSelectedStates(prev => {
      const next = new Set(prev)
      next.has(stateName) ? next.delete(stateName) : next.add(stateName)
      return next
    })
  }

  function getFill(stateName: string) {
    const count = partnersByState[stateName]?.length ?? 0
    if (selectedStates.has(stateName)) return '#0f766e'
    if (count === 0) return '#94a3b8'   // slate-400 — visible on both light and dark backgrounds
    return `rgba(13,148,136,${(0.15 + (count / maxCount) * 0.70).toFixed(2)})`
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

      {/* ── Left: partner list ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">

        {/* List header */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
            {selectedStates.size > 0
              ? `${[...selectedStates].join(', ')} · ${listPartners.length} partner${listPartners.length !== 1 ? 's' : ''}`
              : `${listPartners.length} partner${listPartners.length !== 1 ? 's' : ''}`
            }
          </p>
          {selectedStates.size > 0 && (
            <button
              onClick={() => setSelectedStates(new Set())}
              className="text-xs text-muted-text hover:text-dark-text transition-colors"
            >
              Show all
            </button>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, state, or contact…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
        />

        {/* Cards */}
        {listPartners.length === 0 ? (
          <p className="text-sm text-muted-text py-8 text-center">No partners match.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {listPartners.map(p => (
              <PartnerCard key={p.id} p={p} department={department} />
            ))}
          </div>
        )}
      </div>

      {/* ── Right: sticky map ──────────────────────────────────────────── */}
      <div className="sticky top-6 flex flex-col gap-3">

        {/* Map */}
        <div className="relative rounded-xl border border-border bg-white dark:bg-gray-950 overflow-hidden">

          {/* Hover tooltip */}
          {tooltip && (
            <div className="absolute top-3 left-3 z-10 rounded-lg bg-gray-900/95 text-white text-xs px-3 py-1.5 pointer-events-none shadow-md">
              <span className="font-semibold">{tooltip.name}</span>
              {' · '}
              <span>{tooltip.count} partner{tooltip.count !== 1 ? 's' : ''}</span>
            </div>
          )}

          <ComposableMap
            projection="geoAlbersUsa"
            style={{ width: '100%', height: 'auto' }}
            projectionConfig={{ scale: 828 }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: unknown[] }) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (geographies as any[]).map((geo: any) => {
                  const stateName: string = geo.properties.name
                  const count = partnersByState[stateName]?.length ?? 0

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={() => count > 0 ? toggleState(stateName) : undefined}
                      onMouseEnter={() => setTooltip({ name: stateName, count })}
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        default: {
                          fill: getFill(stateName),
                          stroke: '#1e293b',
                          strokeWidth: 0.7,
                          outline: 'none',
                          cursor: count > 0 ? 'pointer' : 'default',
                        },
                        hover: {
                          fill: count > 0 ? '#0d9488' : '#7c8fa6',
                          stroke: '#1e293b',
                          strokeWidth: 0.7,
                          outline: 'none',
                          cursor: count > 0 ? 'pointer' : 'default',
                        },
                        pressed: { fill: '#0f766e', outline: 'none' },
                      }}
                    />
                  )
                })
              }
            </Geographies>
          </ComposableMap>

          {/* Legend */}
          <div className="flex items-center gap-3 px-3 pb-2.5 text-xs text-muted-text flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: '#94a3b8' }} />
              None
            </div>
            <div className="flex items-center gap-0.5">
              {[0.15, 0.35, 0.55, 0.75, 0.85].map((o, i) => (
                <span key={i} className="w-4 h-2.5 rounded-sm inline-block" style={{ background: `rgba(13,148,136,${o})` }} />
              ))}
              <span className="ml-1">More →</span>
            </div>
          </div>
        </div>

        {/* State multi-select dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setStateDropdownOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text hover:border-teal-primary transition-colors focus:outline-none focus:ring-2 focus:ring-teal-primary"
          >
            <span className={selectedStates.size === 0 ? 'text-muted-text' : ''}>
              {selectedStates.size === 0
                ? 'Filter by state…'
                : selectedStates.size === 1
                  ? [...selectedStates][0]
                  : `${selectedStates.size} states selected`
              }
            </span>
            <svg className={`w-4 h-4 text-muted-text shrink-0 transition-transform ${stateDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {stateDropdownOpen && (
            <>
              {/* Click-away overlay */}
              <div className="fixed inset-0 z-20" onClick={() => setStateDropdownOpen(false)} />
              <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border border-border bg-surface shadow-xl overflow-hidden">
                {/* Search within dropdown */}
                <div className="p-2 border-b border-border">
                  <input
                    autoFocus
                    type="text"
                    value={stateSearch}
                    onChange={e => setStateSearch(e.target.value)}
                    placeholder="Search states…"
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  />
                </div>
                {/* Clear selection row */}
                {selectedStates.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedStates(new Set())}
                    className="w-full text-left px-4 py-2 text-xs text-muted-text hover:text-red-500 transition-colors border-b border-border"
                  >
                    Clear all ({selectedStates.size} selected)
                  </button>
                )}
                {/* State list */}
                <div className="max-h-56 overflow-y-auto">
                  {allStatesWithPartners.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-text">No states match.</p>
                  ) : (
                    allStatesWithPartners.map(([stateName, ps]) => {
                      const checked = selectedStates.has(stateName)
                      return (
                        <button
                          key={stateName}
                          type="button"
                          onClick={() => toggleState(stateName)}
                          className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-sm transition-colors hover:bg-background ${checked ? 'text-dark-text' : 'text-dark-text'}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${checked ? 'bg-teal-primary border-teal-primary' : 'border-border'}`}>
                              {checked && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span>{stateName}</span>
                          </div>
                          <span className="text-xs text-muted-text shrink-0">{ps.length}</span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Selected state chips */}
        {selectedStates.size > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...selectedStates].sort().map(s => (
              <button
                key={s}
                onClick={() => toggleState(s)}
                className="flex items-center gap-1 rounded-full bg-teal-primary text-white text-xs font-medium px-2.5 py-1 hover:bg-teal-primary/90 transition-colors"
              >
                {s} <span className="opacity-70">×</span>
              </button>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-text">
          <span><span className="font-semibold text-dark-text">{statesRepresented}</span> states</span>
          {noStateCount > 0 && (
            <span><span className="font-semibold text-dark-text">{noStateCount}</span> no state on file</span>
          )}
          {selectedStates.size === 0 && (
            <span className="italic text-muted-text/60">Click to filter · multi-select supported</span>
          )}
        </div>
      </div>
    </div>
  )
}
