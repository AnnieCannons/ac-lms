'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function DocsHelpLink({
  guide,
  className,
}: {
  guide: 'student' | 'instructor'
  className?: string
}) {
  const pathname = usePathname()
  const base = `/docs/${guide}/getting-started`
  const href = pathname.startsWith('/docs') ? base : `${base}?from=${encodeURIComponent(pathname)}`
  return (
    <Link href={href} className={className}>
      Help
    </Link>
  )
}
