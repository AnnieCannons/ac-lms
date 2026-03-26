'use client'
import { useRouter } from 'next/navigation'

export default function StudentViewBanner({ courseId }: { courseId: string }) {
  const router = useRouter()

  function leavePreview() {
    document.cookie = 'student-view=; path=/; max-age=0'
    router.push(`/instructor/courses/${courseId}`)
  }

  return (
    <div className="sticky top-0 z-50 bg-amber-100 dark:bg-amber-950 border-b border-amber-300 dark:border-amber-800 px-4 py-2 flex items-center justify-between gap-4">
      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
        Student View — previewing as a student
      </p>
      <button
        onClick={leavePreview}
        className="text-xs font-semibold text-amber-50 bg-amber-700 hover:bg-amber-800 dark:hover:bg-amber-600 border border-amber-600 dark:border-amber-500 px-3 py-1 rounded-full transition-colors shrink-0"
      >
        Leave Student View
      </button>
    </div>
  )
}
