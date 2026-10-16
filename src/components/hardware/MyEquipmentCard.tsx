import { KIND_LABELS, REPLACEMENT_LIMIT, supportFormUrl, type HardwareDevice } from '@/lib/hardware'
import type { MyEquipment } from '@/lib/hardware-server'

/** Who students contact about returns (shipping labels, lost boxes, reimbursement). */
const RETURN_CONTACT = 'Catie'

function describe(d: HardwareDevice, awaiting: boolean): { text: string; tone: 'urgent' | 'normal' } {
  if (awaiting) return { text: 'Please send this back', tone: 'urgent' }
  if (d.status === 'owned_by_student') return { text: 'Yours to keep', tone: 'normal' }
  return { text: 'On loan from AnnieCannons', tone: 'normal' }
}

/** A student's own equipment, read-only, on their Profile page. */
export default function MyEquipmentCard({ equipment, email }: { equipment: MyEquipment; email: string | null }) {
  const { devices, awaitingIds, replacementsUsed } = equipment
  const left = (used: number) => (used >= REPLACEMENT_LIMIT ? 'used' : 'available')

  return (
    <section id="equipment" aria-labelledby="equipment-heading" className="bg-surface rounded-2xl border border-border scroll-mt-24">
      <div className="px-5 py-3 border-b border-border">
        <h2 id="equipment-heading" className="text-sm font-bold text-dark-text">My equipment</h2>
      </div>
      <div className="p-5 flex flex-col gap-4">
        <ul className="flex flex-col divide-y divide-border">
          {devices.map(d => {
            const status = describe(d, awaitingIds.has(d.id))
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

        {awaitingIds.size > 0 && (
          <div className="badge-amber border rounded-lg px-4 py-3 text-sm">
            <h3 className="font-bold">How to send it back</h3>
            <ol className="list-decimal pl-5 mt-2 flex flex-col gap-1.5">
              <li><strong>Use the box it came in.</strong> If you no longer have the box, reach out to {RETURN_CONTACT} before you ship.</li>
              <li><strong>Pack it carefully.</strong> You&apos;re responsible for packing it so it arrives safely. Wrap it with padding so nothing can move or break in transit.</li>
              <li><strong>Shipping is covered.</strong> {RETURN_CONTACT} can send you a prepaid shipping label. Or, if you ship it yourself, keep your receipt and send it to {RETURN_CONTACT} to be reimbursed.</li>
            </ol>
          </div>
        )}

        <p className="text-xs text-muted-text">
          AnnieCannons replaces a laptop and a charger once each. Laptop replacement: {left(replacementsUsed.laptop)} · Charger replacement: {left(replacementsUsed.charger)}.
        </p>

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
