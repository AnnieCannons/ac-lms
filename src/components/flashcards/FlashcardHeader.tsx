'use client'
import { useSearchParams } from 'next/navigation'
import SmartBackLink from '@/components/ui/SmartBackLink'

export default function FlashcardHeader() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from')

  return (
    <div className="bg-surface border-b border-border px-6 py-3 flex items-center gap-3">
      <SmartBackLink
        fallbackHref={from ?? '/student/courses'}
        fallbackLabel={from ? 'Back to Course' : 'Back to Home'}
        className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1"
      />
    </div>
  )
}
