'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setMyCuttingEdgeQuestionDone, setMyCuttingEdgeThanks } from '@/lib/cutting-edge-actions'
import { CUTTING_EDGE_TASKS_CHANGED } from '@/lib/cutting-edge'

type Props =
  | { kind: 'question'; courseId: string; eventId: string; done: boolean; canAct: boolean }
  | { kind: 'thanks'; courseId: string; eventId: string; state: 'done' | 'missed' | null; canAct: boolean; open: boolean }

/** The checkbox completion for an event's two assignments. */
export default function StudentCheckoff(props: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setError(null)
    const res = await fn()
    setBusy(false)
    if (!res.ok) setError(('error' in res && res.error) || 'Something went wrong.')
    window.dispatchEvent(new Event(CUTTING_EDGE_TASKS_CHANGED))
    router.refresh()
  }

  const boxCls = 'flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-dark-text'
  const disabledNote = !props.canAct && <p className="text-xs text-muted-text mt-2">Checkboxes are off while previewing.</p>

  if (props.kind === 'question') {
    return (
      <div>
        <label className={boxCls}>
          <input type="checkbox" className="mt-0.5" checked={props.done} disabled={busy || !props.canAct}
            onChange={e => run(() => setMyCuttingEdgeQuestionDone(props.courseId, props.eventId, e.target.checked))} />
          <span>I submitted my question on the Padlet</span>
        </label>
        {disabledNote}
        {error && <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>}
      </div>
    )
  }

  if (!props.open) {
    return <p className="text-sm text-muted-text">This opens after the talk.</p>
  }

  const set = (next: 'done' | 'missed' | null) => run(() => setMyCuttingEdgeThanks(props.courseId, props.eventId, next))
  return (
    <div className="flex flex-col gap-2">
      <label className={boxCls}>
        <input type="checkbox" className="mt-0.5" checked={props.state === 'done'} disabled={busy || !props.canAct}
          onChange={e => set(e.target.checked ? 'done' : null)} />
        <span>I added my thank-you to the Padlet</span>
      </label>
      <label className={boxCls}>
        <input type="checkbox" className="mt-0.5" checked={props.state === 'missed'} disabled={busy || !props.canAct}
          onChange={e => set(e.target.checked ? 'missed' : null)} />
        <span>I did not make it to the talk</span>
      </label>
      {disabledNote}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
