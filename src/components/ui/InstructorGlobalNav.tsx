'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const BASE_ITEMS = [
  { label: 'Calendar', base: '/instructor/calendar' },
  { label: 'Computer and Wifi', base: '/instructor/globals/computer-wifi' },
  { label: 'Policies and Procedures', base: '/instructor/globals/policies' },
]

const STATIC_SLUGS = ['computer-wifi', 'policies', 'launch-tasks']

export default function InstructorGlobalNav({ courseId }: { courseId?: string } = {}) {
  const pathname = usePathname()
  const [dynamicItems, setDynamicItems] = useState<{ label: string; slug: string }[]>([])

  useEffect(() => {
    const fetchItems = () => {
      createClient()
        .from('global_content')
        .select('slug, title')
        .not('slug', 'in', `(${STATIC_SLUGS.join(',')})`)
        .then(({ data }) => {
          setDynamicItems((data ?? []).map(row => ({ label: row.title, slug: row.slug })))
        })
    }
    fetchItems()
    window.addEventListener('global-content-changed', fetchItems)
    return () => window.removeEventListener('global-content-changed', fetchItems)
  }, [])

  const items = BASE_ITEMS.map(({ label, base }) => ({
    label,
    href: courseId ? `${base}?from=${courseId}` : base,
    base,
  }))

  return (
    <nav aria-label="Global navigation" className="flex flex-col">
      <p className="text-xs font-bold text-muted-text uppercase tracking-widest mb-4 px-3">
        Global Templates
      </p>
      <div className="flex flex-col gap-0.5">
        {items.map(({ label, href, base }) => (
          <Link
            key={label}
            href={href}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === base || pathname.startsWith(base)
                ? 'bg-teal-light text-teal-primary'
                : 'text-muted-text hover:text-dark-text hover:bg-border/20'
            }`}
          >
            {label}
          </Link>
        ))}
        {dynamicItems.map(({ label, slug }) => {
          const base = `/instructor/globals/${slug}`
          const href = courseId ? `${base}?from=${courseId}` : base
          return (
            <Link
              key={slug}
              href={href}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === base || pathname.startsWith(`${base}?`)
                  ? 'bg-teal-light text-teal-primary'
                  : 'text-muted-text hover:text-dark-text hover:bg-border/20'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
