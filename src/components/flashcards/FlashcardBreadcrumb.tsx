'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function FlashcardBreadcrumb() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from')

  return (
    <div className="max-w-5xl mx-auto px-6 pt-6">
      <Link
        href={from ?? '/student/courses'}
        className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit"
      >
        {from ? '← Back to Course' : '← Back to Home'}
      </Link>
    </div>
  )
}
