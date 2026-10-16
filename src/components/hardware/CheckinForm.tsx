'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitMyHardwareCheckin } from '@/lib/hardware-checkin-actions'
import { validateCheckinInput, type CheckinInput } from '@/lib/hardware-checkin'
import { inputCls, labelCls } from './DeviceForm'

function YesNo({ name, legend, value, onChange }: { name: string; legend: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-dark-text">{legend}</legend>
      <div className="flex gap-5 mt-2">
        <label className="flex items-center gap-2 text-sm text-dark-text">
          <input type="radio" name={name} checked={value} onChange={() => onChange(true)} /> Yes
        </label>
        <label className="flex items-center gap-2 text-sm text-dark-text">
          <input type="radio" name={name} checked={!value} onChange={() => onChange(false)} /> No
        </label>
      </div>
    </fieldset>
  )
}

function Help({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="text-sm text-muted-text">
      <summary className="cursor-pointer font-semibold text-teal-primary">{summary}</summary>
      <div className="mt-2 flex flex-col gap-1.5">{children}</div>
    </details>
  )
}

/** The student's equipment check-in: which AnnieCannons equipment they have, with its numbers. */
export default function CheckinForm({ surveyId, initial, alreadyAnswered }: { surveyId: string; initial: CheckinInput; alreadyAnswered: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState<CheckinInput>(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const set = <K extends keyof CheckinInput>(k: K, v: CheckinInput[K]) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const invalid = validateCheckinInput(form)
    if (invalid) { setError(invalid); return }
    setBusy(true)
    setError(null)
    const res = await submitMyHardwareCheckin(surveyId, form)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    setSaved(true)
    router.refresh()
  }

  if (saved) {
    return (
      <div role="status" className="bg-surface rounded-2xl border border-teal-primary p-6 flex flex-col gap-3">
        <p className="text-base font-bold text-dark-text"><span aria-hidden="true">✓ </span>Thank you! Your check-in is saved.</p>
        <p className="text-sm text-muted-text">You can come back and change your answers until we&apos;ve reviewed them.</p>
        <div>
          <button type="button" onClick={() => setSaved(false)} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
            Change my answers
          </button>
        </div>
      </div>
    )
  }

  const card = 'bg-surface rounded-2xl border border-border p-5 flex flex-col gap-3'

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {alreadyAnswered && (
        <p className="text-sm badge-amber border rounded-lg px-3 py-2">You already sent this. You can still change your answers until we&apos;ve reviewed them.</p>
      )}

      <section className={card}>
        <YesNo name="laptop" legend="Do you have a MacBook from AnnieCannons?" value={form.hasLaptop} onChange={v => set('hasLaptop', v)} />
        {form.hasLaptop && (
          <>
            <label className={labelCls}>
              MacBook serial number
              <input className={`${inputCls} mt-1 font-mono`} value={form.laptopSerial} onChange={e => set('laptopSerial', e.target.value)} autoComplete="off" required />
            </label>
            <Help summary="Where do I find it?">
              <ol className="list-decimal pl-5 flex flex-col gap-1">
                <li>Click the <strong className="text-dark-text">Apple menu</strong> (the apple in the top-left corner of the screen).</li>
                <li>Choose <strong className="text-dark-text">About This Mac</strong>.</li>
                <li>Copy the <strong className="text-dark-text">Serial number</strong> from the window that opens and paste it above.</li>
              </ol>
              <p>Can&apos;t open it? The serial number is also printed in small text on the bottom of the MacBook, and on the label on the box it came in.</p>
            </Help>
          </>
        )}
      </section>

      <section className={card}>
        <YesNo name="hotspot" legend="Do you have a hotspot from AnnieCannons? (a Franklin hotspot from Mission Telecom)" value={form.hasHotspot} onChange={v => set('hasHotspot', v)} />
        {form.hasHotspot && (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className={labelCls}>
                IMEI
                <input className={`${inputCls} mt-1 font-mono`} value={form.hotspotImei} onChange={e => set('hotspotImei', e.target.value)} inputMode="numeric" autoComplete="off" />
              </label>
              <label className={labelCls}>
                Hotspot phone number
                <input className={`${inputCls} mt-1`} value={form.hotspotPhone} onChange={e => set('hotspotPhone', e.target.value)} type="tel" autoComplete="off" />
              </label>
            </div>
            <p className="text-xs text-muted-text -mt-1">Either one is fine. Both is best.</p>
            <Help summary="Where do I find them?">
              <p className="font-semibold text-dark-text">Both numbers are on the hotspot&apos;s settings page:</p>
              <ol className="list-decimal pl-5 flex flex-col gap-1">
                <li>Connect your laptop to the hotspot&apos;s Wi-Fi.</li>
                <li>In a web browser, go to <strong className="text-dark-text">mobile.hotspot</strong> (or <strong className="text-dark-text">192.168.0.1</strong>).</li>
                <li>Log in with the hotspot&apos;s admin password. If it&apos;s never been changed, try <strong className="text-dark-text">admin</strong>. If that doesn&apos;t work, use the label below instead.</li>
                <li>Click <strong className="text-dark-text">About</strong> at the top. The <strong className="text-dark-text">Mobile Number</strong> and <strong className="text-dark-text">IMEI</strong> are listed there.</li>
              </ol>
              <p>No laptop handy, or can&apos;t log in? The IMEI (a 15-digit number) is on the label under the battery (turn the hotspot off and take off the back cover), and on the box it came in.</p>
              <p>If you can&apos;t find either one, reach out to Catie.</p>
            </Help>
          </>
        )}
      </section>

      <section className={card}>
        <YesNo name="booster" legend="Do you have a wifi booster from AnnieCannons?" value={form.hasBooster} onChange={v => set('hasBooster', v)} />
      </section>

      <section className={card}>
        <p className="text-sm font-semibold text-dark-text">Has AnnieCannons ever replaced any of these for you?</p>
        <label className="flex items-center gap-2 text-sm text-dark-text">
          <input type="checkbox" className="h-4 w-4 accent-teal-primary" checked={form.laptopReplaced} onChange={e => set('laptopReplaced', e.target.checked)} />
          My MacBook was replaced
        </label>
        <label className="flex items-center gap-2 text-sm text-dark-text">
          <input type="checkbox" className="h-4 w-4 accent-teal-primary" checked={form.chargerReplaced} onChange={e => set('chargerReplaced', e.target.checked)} />
          My MacBook charger was replaced
        </label>
      </section>

      <section className={card}>
        <label className={labelCls}>
          Anything else we should know? (optional)
          <textarea className={`${inputCls} mt-1`} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </label>
      </section>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div>
        <button type="submit" disabled={busy} className="bg-teal-primary text-white text-sm font-semibold px-6 py-2.5 rounded-full hover:opacity-90 disabled:opacity-60">
          {busy ? 'Sending…' : alreadyAnswered ? 'Save changes' : 'Send my check-in'}
        </button>
      </div>
    </form>
  )
}
