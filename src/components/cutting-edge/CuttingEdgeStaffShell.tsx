import InstructorTopNav, { type Breadcrumb } from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import InstructorGlobalNav from '@/components/ui/InstructorGlobalNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { CuttingEdgeStaffViewer } from '@/lib/cutting-edge-access'

/** Shared chrome for the instructor-side Cutting Edge Talks pages (global, like Calendar/PTO). */
export default async function CuttingEdgeStaffShell({
  viewer,
  from,
  breadcrumbs,
  wide,
  children,
}: {
  viewer: CuttingEdgeStaffViewer
  from?: string
  breadcrumbs?: Breadcrumb[]
  wide?: boolean
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: course } = from
    ? await supabase.from('courses').select('id, name').eq('id', from).maybeSingle()
    : { data: null }

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={viewer.name} role={viewer.role} isTa={!viewer.canEdit} breadcrumbs={breadcrumbs} />
      <div className="flex">
        {course
          ? <InstructorSidebar courseId={course.id} courseName={course.name} />
          : viewer.canEdit ? <ResizableSidebar><InstructorGlobalNav /></ResizableSidebar> : null
        }
        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className={`${wide ? 'max-w-5xl' : 'max-w-3xl'} mx-auto px-4 sm:px-8 py-10 focus:outline-none`}>
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

