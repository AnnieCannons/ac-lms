'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  cancelHardwareReturn,
  confirmHardwareLost,
  loanHardwareDevice,
  markHardwareAwaitingReturn,
  markHardwarePrepped,
  setHardwareDeviceStatus,
  transferHardwareOwnership,
} from '@/lib/hardware-actions'
import {
  STATUS_CHOICE_LABELS,
  STATUS_LABELS,
  statusChoices,
  type DeviceStatus,
  type HardwareDevice,
  type StatusChoice,
} from '@/lib/hardware'
import type { Person } from '@/lib/hardware-server'
import StudentPicker from './StudentPicker'
import ReceiveForm from './ReceiveForm'
import { inputCls, labelCls } from './DeviceForm'

const HINTS: Partial<Record<StatusChoice, string>> = {
  awaiting_return: "For example, the student dropped or graduated. They'll be reminded to send it back.",
  back_on_loan: 'It goes back to on loan and the reminders stop. For example, the student came back.',
  lost_while_out: 'The device is marked lost and the reminders stop.',
  transfer: 'The laptop becomes the student\'s. It still counts toward their one laptop replacement.',
}

/**
 * The device's status as a dropdown that only offers changes that make sense from here.
 * Picking one opens the small form that change needs; Cancel leaves the status as it was.
 */
/** What TAs (day-to-day access) may pick: loan it out, receive it, needs prep, wiped and checked. */
const TA_CHOICES: StatusChoice[] = ['loan', 'receive', 'needs_prep', 'prepped']

export default function StatusControl({ device, waitlist = [], canManage = true }: { device: HardwareDevice; waitlist?: Person[]; canManage?: boolean }) {
  const router = useRouter()
  const selectId = useId()
  const [choice, setChoice] = useState<StatusChoice | ''>('')
  const [student, setStudent] = useState<Person | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const choices = statusChoices(device.status, device.kind).filter(c => canManage || TA_CHOICES.includes(c))

  const reset = () => { setChoice(''); setStudent(null); setNote(''); setError(null) }

  async function save() {
    if (!choice) return
    setBusy(true)
    setError(null)
    const res: { ok: boolean; error?: string } = await (() => {
      switch (choice) {
        case 'loan': return loanHardwareDevice(device.id, student!.id, note)
        case 'awaiting_return': return markHardwareAwaitingReturn([device.id], note)
        case 'back_on_loan': return cancelHardwareReturn(device.id, note)
        case 'lost_while_out': return confirmHardwareLost(device.id, note)
        case 'prepped': return markHardwarePrepped(device.id)
        case 'transfer': return transferHardwareOwnership(device.id, note)
        case 'receive': return Promise.resolve({ ok: true })
        default: return setHardwareDeviceStatus(device.id, choice as DeviceStatus, note)
      }
    })()
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'Something went wrong.'); return }
    reset()
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={selectId} className="text-sm font-semibold text-muted-text">Status</label>
        {choices.length === 0 ? (
          <span className="text-sm font-semibold text-dark-text">{STATUS_LABELS[device.status]}</span>
        ) : (
          <select
            id={selectId}
            value={choice}
            onChange={e => { reset(); setChoice(e.target.value as StatusChoice) }}
            aria-describedby={!choice && choices.includes('loan') ? `${selectId}-hint` : undefined}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-dark-text text-sm font-semibold focus:outline-none focus:border-teal-primary"
          >
            <option value="">{STATUS_LABELS[device.status]}</option>
            <optgroup label="Change to">
              {choices.map(c => <option key={c} value={c}>{STATUS_CHOICE_LABELS[c]}</option>)}
            </optgroup>
          </select>
        )}
      </div>
      {!choice && choices.includes('loan') && (
        <p id={`${selectId}-hint`} className="text-sm text-muted-text">
          To give this {device.kind === 'booster' ? 'booster' : device.kind} to a student, change the status to{' '}
          <strong className="text-dark-text">On loan</strong> and choose who it goes to.
        </p>
      )}

      {choice === 'receive' && (
        <div className="max-w-xl">
          <ReceiveForm devices={[device]} onDone={reset} onCancel={reset} />
        </div>
      )}

      {choice && choice !== 'receive' && (
        <form
          className="max-w-xl bg-background rounded-xl border border-border p-4 flex flex-col gap-3"
          onSubmit={e => { e.preventDefault(); save() }}
        >
          {HINTS[choice] && <p className="text-sm text-muted-text">{HINTS[choice]}</p>}
          {choice === 'loan' && !student && waitlist.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-text mb-1">Waiting for one (first come, first served)</p>
              <div className="flex flex-wrap gap-2">
                {waitlist.map(p => (
                  <button key={p.id} type="button" onClick={() => setStudent(p)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-dark-text hover:bg-border/20">
                    {p.name ?? p.email}
                  </button>
                ))}
              </div>
            </div>
          )}
          {choice === 'loan' && <StudentPicker value={student} onChange={setStudent} />}
          {choice !== 'prepped' && (
            <label className={labelCls}>
              Note (optional)
              <input
                className={`${inputCls} mt-1`}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={choice === 'loan' ? 'e.g. tracking number' : choice === 'awaiting_return' ? 'e.g. dropped 10/16' : ''}
              />
            </label>
          )}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || (choice === 'loan' && !student)}
              className="bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={reset} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
