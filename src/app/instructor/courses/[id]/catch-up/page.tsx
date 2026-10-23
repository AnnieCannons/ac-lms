import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getInstructorOrTaAccess } from '@/lib/instructor-access'
import { formatEventWhen } from '@/lib/cutting-edge'
import { FIELD_LABELS } from '@/lib/class-catch-up'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import FollowedUpToggle from '@/components/catch-up/FollowedUpToggle'
import LinkifiedText from '@/components/catch-up/LinkifiedText'

export const dynamic = 'force-dynamic'

type FormRow = {
  id: string
  student_id: string
  missed_blocks: string
  lectures_missed: string
  lecture_links: string
  assignments_missed: string
  makeup_plan: string
  notes: string | null
  submitted_at: string
  followed_up_at: string | null
  followed_up_by: string | null
}

/** Class Catch Up Forms students in this course have sent, newest first, with a "Followed up" tick. */
export default async function InstructorCatchUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ show?: string }>
}) {
  const { id } = await params
  const { show } = await searchParams
  const { profile, isTa } = await getInstructorOrTaAccess(id, `/student/courses/${id}`)
  // Staff and this course's TAs only; the service-role client is used after that check.

  const admin = createServiceSupabaseClient()
  const { data: course } = await admin.from('courses').select('id, name').eq('id', id).single()
  if (!course) redirect('/instructor/courses')

  const { data } = await admin
    .from('class_catch_up_forms')
    .select('id, student_id, missed_blocks, lectures_missed, lecture_links, assignments_missed, makeup_plan, notes, submitted_at, followed_up_at, followed_up_by')
    .eq('course_id', id)
    .order('submitted_at', { ascending: false })
    .limit(500)
  const all = (data ?? []) as FormRow[]
  const showAll = show === 'all'
  const forms = showAll ? all : all.filter(f => !f.followed_up_at)
  const waiting = all.filter(f => !f.followed_up_at).length

  const userIds = [...new Set(all.flatMap(f => [f.student_id, f.followed_up_by].filter((x): x is string => !!x)))]
  const { data: users } = userIds.length
    ? await admin.from('users').select('id, name, email').in('id', userIds)
    : { data: [] as { id: string; name: string | null; email: string | null }[] }
  const nameOf = new Map((users ?? []).map(u => [u.id, u.name || u.email || 'Unknown']))

  const details: { key: keyof FormRow; label: string }[] = [
    { key: 'lectures_missed', label: FIELD_LABELS.lecturesMissed },
    { key: 'lecture_links', label: FIELD_LABELS.lectureLinks },
    { key: 'assignments_missed', label: FIELD_LABELS.assignmentsMissed },
    { key: 'makeup_plan', label: FIELD_LABELS.makeupPlan },
    { key: 'notes', label: FIELD_LABELS.notes },
  ]

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav
        name={profile?.name}
        role={profile?.role}
        isTa={isTa}
        breadcrumbs={[
          { label: 'Courses', href: '/instructor/courses' },
          { label: course.name, href: `/instructor/courses/${id}` },
          { label: 'Catch Up Forms' },
        ]}
      />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-6 sm:px-8 sm:py-10 focus:outline-none">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-dark-text mb-1">Catch Up Forms</h1>
              <p className="text-sm text-muted-text">{course.name}</p>
              <p className="mt-1 text-sm text-muted-text">
                Students marked Absent in Airtable get a Slack DM at 5am Pacific asking them to fill this out.
                The course&apos;s instructors get a Slack DM when one is sent. Tick &ldquo;Followed up&rdquo; once you&apos;ve checked in with the student.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
              <span className="text-dark-text font-semibold">{waiting} waiting for follow-up</span>
              <span aria-hidden="true" className="text-muted-text">·</span>
              {showAll ? (
                <Link href={`/instructor/courses/${id}/catch-up`} className="text-teal-primary font-semibold underline">Show only waiting</Link>
              ) : (
                <Link href={`/instructor/courses/${id}/catch-up?show=all`} className="text-teal-primary font-semibold underline">Show all ({all.length})</Link>
              )}
            </div>

            {forms.length === 0 ? (
              <p className="text-sm text-muted-text bg-surface border border-border rounded-2xl p-5">
                {showAll ? 'No catch-up forms yet.' : 'Nothing waiting. Every catch-up form has been followed up.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {forms.map(f => {
                  const student = nameOf.get(f.student_id) ?? 'Unknown'
                  return (
                    <li key={f.id} className="bg-surface rounded-2xl border border-border p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link href={`/instructor/courses/${id}/roster/${f.student_id}`} className="text-base font-bold text-dark-text hover:underline">
                            {student}
                          </Link>
                          <p className="text-sm text-dark-text mt-0.5">{f.missed_blocks}</p>
                          <p className="text-xs text-muted-text mt-0.5">Sent {formatEventWhen(f.submitted_at)}</p>
                          {f.followed_up_at && (
                            <p className="text-xs text-teal-primary font-semibold mt-0.5">
                              Followed up {formatEventWhen(f.followed_up_at)}
                              {f.followed_up_by ? ` by ${nameOf.get(f.followed_up_by) ?? 'staff'}` : ''}
                            </p>
                          )}
                        </div>
                        <FollowedUpToggle formId={f.id} studentName={student} initial={!!f.followed_up_at} />
                      </div>
                      <dl className="mt-4 flex flex-col gap-3 text-sm">
                        {details.map(({ key, label }) => {
                          const value = f[key] as string | null
                          if (!value) return null
                          return (
                            <div key={key}>
                              <dt className="font-semibold text-dark-text">{label}</dt>
                              <dd className="text-muted-text whitespace-pre-line break-words"><LinkifiedText text={value} /></dd>
                            </div>
                          )
                        })}
                      </dl>
                    </li>
                  )
                })}
              </ul>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
