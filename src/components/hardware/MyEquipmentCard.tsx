import { KIND_LABELS, REPLACEMENT_LIMIT, formatDateOnly, supportFormUrl, type HardwareDevice } from '@/lib/hardware'
import type { MyEquipment } from '@/lib/hardware-server'
import type { MyEquipmentExtras } from '@/lib/onboarding-server'
import { RETURN_STEPS } from '@/lib/hardware-reminders'
import { CARRIER_LABELS, kindList, trackingUrl } from '@/lib/hardware-shipping'
import IGotItButton from './IGotItButton'

function describe(d: HardwareDevice, awaiting: boolean, onTheWay: boolean): { text: string; tone: 'urgent' | 'normal' } {
  if (awaiting) return { text: 'Please send this back', tone: 'urgent' }
  if (onTheWay) return { text: 'On the way', tone: 'normal' }
  if (d.status === 'owned_by_student') return { text: 'Yours to keep', tone: 'normal' }
  return { text: 'On loan from AnnieCannons', tone: 'normal' }
}

/** Whether there's anything to show a student (equipment, something coming, or Comcast NOW). */
export function hasEquipmentToShow(equipment: MyEquipment, extras?: MyEquipmentExtras | null): boolean {
  return equipment.devices.length > 0 || !!extras && (extras.pending.length > 0 || extras.inTransit.length > 0 || extras.wifi === 'comcast_now')
}

/** A student's own equipment, on their Profile page and My Equipment. */
export default function MyEquipmentCard({
  equipment,
  extras,
  email,
  readOnly = false,
}: {
  equipment: MyEquipment
  /** What's coming and what's on the way (New Student Onboarding) */
  extras?: MyEquipmentExtras | null
  email: string | null
  /** Viewing as the student: nothing can be confirmed on their behalf */
  readOnly?: boolean
}) {
  const { devices, awaitingIds, replacementsUsed } = equipment
  const left = (used: number) => (used >= REPLACEMENT_LIMIT ? 'used' : 'available')
  const inTransit = extras?.inTransit ?? []
  const onTheWay = new Set(inTransit.flatMap(s => s.device_ids))
  const byId = new Map(devices.map(d => [d.id, d]))

  return (
    <section id="equipment" aria-labelledby="equipment-heading" className="bg-surface rounded-2xl border border-border scroll-mt-24">
      <div className="px-5 py-3 border-b border-border">
        <h2 id="equipment-heading" className="text-sm font-bold text-dark-text">My equipment</h2>
      </div>
      <div className="p-5 flex flex-col gap-4">
        {inTransit.map(s => {
          const kinds = s.device_ids.map(id => byId.get(id)?.kind).filter((k): k is HardwareDevice['kind'] => !!k)
          const url = trackingUrl(s.carrier, s.tracking_number)
          return (
            <div key={s.id} className="rounded-xl border border-teal-primary/30 bg-teal-light px-4 py-3 text-sm flex flex-col gap-2">
              <p className="text-dark-text">
                <span aria-hidden="true">📦 </span><strong>Your {kindList(kinds)} {new Set(kinds).size > 1 ? 'are' : 'is'} on the way!</strong>{' '}
                Shipped {formatDateOnly(s.shipped_on)}.
              </p>
              <p className="text-dark-text">
                {CARRIER_LABELS[s.carrier]} tracking:{' '}
                {url
                  ? <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold text-teal-primary hover:underline">{s.tracking_number}<span className="sr-only"> (opens in a new tab)</span></a>
                  : <span className="font-mono font-semibold">{s.tracking_number}</span>}
              </p>
              <p className="text-muted-text">When it arrives, let us know:</p>
              <IGotItButton shipmentId={s.id} disabled={readOnly} />
            </div>
          )
        })}

        {extras && extras.pending.length > 0 && (
          <ul className="flex flex-col gap-2 text-sm">
            {extras.pending.map(p => (
              <li key={p.kind} className="rounded-xl border border-border bg-background px-4 py-3">
                <span className="font-semibold text-dark-text">{KIND_LABELS[p.kind]}: </span>
                <span className="text-dark-text">
                  {p.state === 'preparing'
                    ? `We're preparing to ship your ${KIND_LABELS[p.kind].toLowerCase()}. You'll get the tracking number here once it ships.`
                    : `Finish your Enrollment Readiness tasks and we'll start getting your ${KIND_LABELS[p.kind].toLowerCase()} ready to ship.`}
                </span>
              </li>
            ))}
          </ul>
        )}

        {extras?.wifi === 'comcast_now' && (
          <p className="text-sm text-dark-text">
            <span className="font-semibold">Internet: </span>
            {extras.hasInternetPlan ? 'Comcast NOW, paid for by AnnieCannons.' : "Comcast NOW, paid for by AnnieCannons. We're setting it up."}
          </p>
        )}

        {devices.length > 0 && (
          <ul className="flex flex-col divide-y divide-border">
            {devices.map(d => {
              const status = describe(d, awaitingIds.has(d.id), onTheWay.has(d.id))
              return (
                <li key={d.id} className="py-3 first:pt-0 last:pb-0 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold text-dark-text">{KIND_LABELS[d.kind]}</span>
                    <span className="font-mono text-xs text-muted-text">{d.asset_tag}</span>
                    <span className={`ml-auto text-xs font-semibold ${status.tone === 'urgent' ? 'text-red-600' : 'text-muted-text'}`}>{status.text}</span>
                  </div>
                  {(d.make_model || d.model_year) && (
                    <p className="text-xs text-muted-text mt-0.5">{[d.make_model, d.model_year].filter(Boolean).join(' · ')}</p>
                  )}
                  {d.kind === 'booster' && (
                    <p className="text-xs text-muted-text mt-0.5">If there&apos;s no label on your booster, write {d.asset_tag} on it so we can tell it apart.</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {awaitingIds.size > 0 && (
          <div className="badge-amber border rounded-lg px-4 py-3 text-sm">
            <h3 className="font-bold">How to send it back</h3>
            <ol className="list-decimal pl-5 mt-2 flex flex-col gap-1.5">
              {RETURN_STEPS.map(step => {
                const [lead, ...rest] = step.split('. ')
                return <li key={step}><strong>{lead}.</strong> {rest.join('. ')}</li>
              })}
            </ol>
          </div>
        )}

        {devices.length > 0 && (
          <p className="text-xs text-muted-text">
            AnnieCannons replaces a laptop and a charger once each. Laptop replacement: {left(replacementsUsed.laptop)} · Charger replacement: {left(replacementsUsed.charger)}.
          </p>
        )}

        <div>
          <a
            href={supportFormUrl(email)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20"
          >
            Report a problem with my equipment<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </section>
  )
}
