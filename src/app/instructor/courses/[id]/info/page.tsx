import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorCourseNav from '@/components/ui/InstructorCourseNav'
import GeneralInfoEditor from '@/components/ui/GeneralInfoEditor'

const DEFAULT_SECTIONS = [
  { title: 'General Class Info',    type: 'text',             content: null,                                                         order: 0 },
  { title: 'Goals and Outcomes',    type: 'text',             content: null,                                                         order: 1 },
  { title: 'Daily Class Schedule',  type: 'daily_schedule',   content: null,                                                         order: 2 },
  { title: 'Instructor Contact Info', type: 'text',           content: null,                                                         order: 3 },
  { title: 'Policies and Procedures', type: 'text',           content: null,                                                         order: 4 },
  { title: 'Everyday Resources',    type: 'text',             content: null,                                                         order: 5 },
  { title: 'Computer and Wifi',     type: 'text',             content: null,                                                         order: 6 },
  {
    title: 'Course Outline',
    type: 'course_outline',
    content: JSON.stringify({ rows: Array.from({ length: 15 }, (_, i) => ({ week: i + 1, topics: '', description: '' })) }),
    order: 7,
  },
  {
    title: 'Yearly Schedule',
    type: 'yearly_schedule',
    content: JSON.stringify({
      cohorts: [
        { name: 'Winter/Spring', start: '', end: '' },
        { name: 'Summer',        start: '', end: '' },
        { name: 'Fall',          start: '', end: '' },
      ],
      breaks: [
        { label: 'Spring Break', start: '', end: '' },
        { label: 'Summer Break', start: '', end: '' },
        { label: 'Winter Break', start: '', end: '' },
      ],
    }),
    order: 8,
  },
]

export default async function InstructorGeneralInfoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
    redirect('/unauthorized')
  }

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code')
    .eq('id', id)
    .single()

  if (!course) redirect('/instructor/courses')

  let { data: sections } = await supabase
    .from('course_sections')
    .select('id, title, content, order, type')
    .eq('course_id', id)
    .order('order', { ascending: true })

  // Auto-init default sections if none exist
  if (!sections || sections.length === 0) {
    let service: ReturnType<typeof createServiceSupabaseClient> | null = null
    try { service = createServiceSupabaseClient() } catch { /* no service role */ }

    const client = service ?? supabase
    const inserts = DEFAULT_SECTIONS.map(s => ({ ...s, course_id: id }))
    const { data: created } = await client
      .from('course_sections')
      .insert(inserts)
      .select('id, title, content, order, type')
    sections = created
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <Link href="/instructor/courses" className="text-xl font-extrabold text-dark-text">
          AC<span className="text-teal-primary">*</span>
        </Link>
      </nav>

      <div className="flex">
        <aside className="w-56 shrink-0 border-r border-border min-h-[calc(100vh-65px)] py-8 px-3">
          <InstructorCourseNav courseId={id} courseName={course.name} />
        </aside>

        <div className="flex-1 min-w-0">
          <main className="max-w-3xl mx-auto px-8 py-10">
            <div className="flex items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-bold text-dark-text">General Info</h1>
                <p className="text-sm text-muted-text mt-1">{course.name}</p>
              </div>
              <Link href="/instructor/courses" className="text-sm text-muted-text hover:text-teal-primary">
                ← Courses
              </Link>
            </div>

            <GeneralInfoEditor courseId={id} initialSections={sections ?? []} />
          </main>
        </div>
      </div>
    </div>
  )
}
