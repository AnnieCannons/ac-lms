import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareViewer } from '@/lib/hardware-access'
import { loadCheckinDetail } from '@/lib/hardware-checkin-server'
import { formatPacific } from '@/lib/hardware'
import HardwareShell from '@/components/hardware/HardwareShell'
import Card from '@/components/hardware/Card'
import { AddPeople, CloseToggle, NudgeButton, ReopenButton, ReviewCard } from '@/components/hardware/CheckinReview'

const UUID = /^[0-9a-f-]{36}$/i

export default async function CheckinDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ surveyId: string }>
  searchParams: Promise<{ sent?: string }>
}) {
  const viewer = await getHardwareViewer({ manage: true })
  const { surveyId } = await params
  const { sent } = await searchParams
  if (!UUID.test(surveyId)) notFound()
  const detail = await loadCheckinDetail(createServiceSupabaseClient(), surveyId)
  if (!detail) notFound()
  const { survey, toReview, reviewed, notAnswered } = detail
  const total = toReview.length + reviewed.length + notAnswered.length

  const tiles = [
    { label: 'Sent to', value: total },
    { label: 'Answered', value: toReview.length + reviewed.length },
    { label: 'To review', value: toReview.length, strong: toReview.length > 0 },
    { label: 'Not answered', value: notAnswered.length },
  ]

  return (
    <HardwareShell viewer={viewer} active="checkin" breadcrumbs={[{ label: 'Hardware', href: '/instructor/hardware' }, { label: 'Check-in', href: '/instructor/hardware/check-in' }, { label: survey.title }]}>
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        {sent && (
          <p role="status" className="bg-surface rounded-2xl border border-teal-primary px-5 py-3 text-sm text-dark-text">
            <span aria-hidden="true">✓ </span>Sent to {sent} {sent === '1' ? 'student' : 'students'} by Slack message and bell notification.
          </p>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-dark-text">{survey.title}</h1>
            <p className="text-sm text-muted-text mt-1">
              Sent {formatPacific(survey.created_at)}{survey.closed_at ? ` · Closed ${formatPacific(survey.closed_at)}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!survey.closed_at && <AddPeople surveyId={survey.id} />}
            <CloseToggle surveyId={survey.id} closed={!!survey.closed_at} />
          </div>
        </div>

        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tiles.map(t => (
            <li key={t.label} className="rounded-xl border border-border bg-surface px-4 py-3">
              <span className={`block text-2xl font-bold ${t.strong ? 'text-dark-text' : t.value === 0 ? 'text-muted-text' : 'text-dark-text'}`}>{t.value}</span>
              <span className="block text-xs font-semibold text-muted-text mt-0.5">{t.label}</span>
            </li>
          ))}
        </ul>

        <Card title={`To review · ${toReview.length}`}>
          {toReview.length === 0 ? (
            <p className="text-sm text-muted-text">Nothing to review. New answers show up here.</p>
          ) : (
            <>
              <p className="text-xs text-muted-text mb-4">Approving adds or links the devices that are ticked. Anything flagged in red needs a look first.</p>
              <ul className="flex flex-col divide-y divide-border">
                {toReview.map(item => <ReviewCard key={item.response.id} {...item} />)}
              </ul>
            </>
          )}
        </Card>

        <Card
          title={`Not answered · ${notAnswered.length}`}
          action={notAnswered.length > 0 && !survey.closed_at ? <NudgeButton surveyId={survey.id} label={`Remind all ${notAnswered.length}`} /> : undefined}
        >
          {notAnswered.length === 0 ? <p className="text-sm text-muted-text">Everyone has answered.</p> : (
            <ul className="flex flex-col divide-y divide-border">
              {notAnswered.map(({ student, lastNudgedAt, courseName }) => (
                <li key={student.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0 text-sm">
                  <Link href={`/instructor/hardware/students/${student.id}`} className="font-medium text-dark-text hover:text-teal-primary">{student.name ?? student.email}</Link>
                  <span className="text-xs text-muted-text">{courseName ?? 'Added by name'}{lastNudgedAt ? ` · reminded ${formatPacific(lastNudgedAt)}` : ''}</span>
                  {!survey.closed_at && <span className="ml-auto"><NudgeButton surveyId={survey.id} userIds={[student.id]} label="Remind" /></span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {reviewed.length > 0 && (
          <Card title={`Reviewed · ${reviewed.length}`}>
            <ul className="flex flex-col divide-y divide-border">
              {reviewed.map(({ response, student }) => (
                <li key={response.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0 text-sm">
                  <Link href={`/instructor/hardware/students/${student.id}`} className="font-medium text-dark-text hover:text-teal-primary">{student.name ?? student.email}</Link>
                  <span className="text-xs text-muted-text">
                    {response.review_status === 'approved' ? 'Approved' : 'Dismissed'}{response.review_note ? `: ${response.review_note}` : ''}
                  </span>
                  <span className="ml-auto"><ReopenButton responseId={response.id} /></span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </HardwareShell>
  )
}
