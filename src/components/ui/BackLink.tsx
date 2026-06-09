import Link from 'next/link'

interface Props {
  href: string
  children: React.ReactNode
}

export default function BackLink({ href, children }: Props) {
  return (
    <Link href={href} className="text-sm text-muted-text hover:text-teal-primary transition-colors">
      ← {children}
    </Link>
  )
}
