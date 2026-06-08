'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Map URL prefixes to the most relevant doc section (first match wins)
const SMART_SECTIONS: Array<{ prefix: string; guide: 'instructor' | 'student'; section: string }> = [
  { prefix: '/instructor/partnerships/referrals', guide: 'instructor', section: 'referrals' },
  { prefix: '/instructor/partnerships',           guide: 'instructor', section: 'partnerships' },
]

export default function DocsHelpLink({
  guide,
  className,
}: {
  guide: 'student' | 'instructor'
  className?: string
}) {
  const pathname = usePathname()

  // Pick the most specific matching doc section for the current page
  const match = SMART_SECTIONS.find(s => s.guide === guide && pathname.startsWith(s.prefix))
  const section = match?.section ?? 'getting-started'

  const base = `/docs/${guide}/${section}`
  const href = pathname.startsWith('/docs') ? base : `${base}?from=${encodeURIComponent(pathname)}`
  return (
    <Link href={href} className={className}>
      Help
    </Link>
  )
}
