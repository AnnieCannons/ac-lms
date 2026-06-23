'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function FlashcardHeader() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from')

  return (
    <div className="bg-surface border-b border-border px-6 py-3 flex items-center gap-3">
      <Link
        href={from ?? '/student/courses'}
        className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1"
      >
        {from ? '← Back to Course' : '← Back to Home'}
      </Link>
    </div>
  )
}
