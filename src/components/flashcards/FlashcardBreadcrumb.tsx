'use client'
import { useSearchParams } from 'next/navigation'
import SmartBackLink from '@/components/ui/SmartBackLink'

export default function FlashcardBreadcrumb() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from')

  return (
    <div className="max-w-5xl mx-auto px-6 pt-6">
      <SmartBackLink
        fallbackHref={from ?? '/student/courses'}
        fallbackLabel={from ? 'Back to Course' : 'Back to Home'}
        className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit"
      />
    </div>
  )
}
