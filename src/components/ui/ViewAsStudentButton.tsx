'use client'
import { useRouter } from 'next/navigation'
import { IMPERSONATE_COOKIE } from '@/lib/impersonate-cookie'

export default function ViewAsStudentButton({
  studentId,
  studentName,
  courseId,
}: {
  studentId: string
  studentName: string
  courseId: string
}) {
  const router = useRouter()

  function handleClick() {
    const val = encodeURIComponent(JSON.stringify({ userId: studentId, studentName }))
    document.cookie = `${IMPERSONATE_COOKIE}=${val}; path=/; max-age=7200`
    router.push(`/student/courses/${courseId}/assignments`)
  }

  return (
    <button
      onClick={handleClick}
      className="text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-300 px-3 py-1.5 rounded-full transition-colors"
    >
      View as Student
    </button>
  )
}
