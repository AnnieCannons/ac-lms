'use client'
import { useRouter } from 'next/navigation'
import { IMPERSONATE_COOKIE } from '@/lib/impersonate'

export default function ImpersonateBanner({
  studentName,
  returnPath,
}: {
  studentName: string
  returnPath: string
}) {
  const router = useRouter()

  function exit() {
    document.cookie = `${IMPERSONATE_COOKIE}=; path=/; max-age=0`
    router.push(returnPath)
  }

  return (
    <div className="sticky top-0 z-50 bg-purple-100 border-b border-purple-300 px-4 py-2 flex items-center justify-between gap-4">
      <p className="text-sm font-medium text-purple-800">
        Viewing as <strong>{studentName}</strong>
      </p>
      <button
        onClick={exit}
        className="text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 border border-purple-600 px-3 py-1 rounded-full transition-colors shrink-0"
      >
        Exit Student View
      </button>
    </div>
  )
}
