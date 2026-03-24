'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Items rendered above dynamic (Everyday Resources) entries
const TOP_ITEMS = [
  { label: 'Policies and Procedures', base: '/instructor/globals/policies' },
]

// Items rendered below dynamic (Everyday Resources) entries
const BOTTOM_ITEMS = [
  { label: 'Computer and Wifi', base: '/instructor/globals/computer-wifi' },
  { label: 'Calendar', base: '/instructor/calendar' },
  { label: 'Paid Time Off', base: '/instructor/globals/pto' },
  { label: 'Benefits', base: '/instructor/globals/benefits' },
]

const STATIC_SLUGS = ['computer-wifi', 'policies', 'launch-tasks', 'benefits-healthcare', 'benefits-vision', 'benefits-dental']

export default function InstructorGlobalNav({ courseId }: { courseId?: string } = {}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem('nav_section_global_templates')
    return stored === null ? true : stored === 'true'
  })
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

  const makeItems = (list: { label: string; base: string }[]) =>
    list.map(({ label, base }) => ({
      label,
      href: courseId ? `${base}?from=${courseId}` : base,
      base,
    }))

  return (
    <nav aria-label="Global navigation" className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen(v => {
          const next = !v
          localStorage.setItem('nav_section_global_templates', String(next))
          return next
        })}
        className="flex items-center gap-1.5 w-full px-3 mb-1 group"
      >
        <span className="text-muted-text text-[8px] group-hover:text-dark-text transition-colors">{open ? '▲' : '▼'}</span>
        <p className="text-xs font-bold text-muted-text uppercase tracking-widest group-hover:text-dark-text transition-colors">Global Templates</p>
      </button>
      {open && <div className="flex flex-col gap-0.5 mt-1">
        {makeItems(TOP_ITEMS).map(({ label, href, base }) => (
          <Link key={label} href={href} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors truncate ${pathname === base || pathname.startsWith(base) ? 'bg-teal-light text-teal-primary' : 'text-muted-text hover:text-dark-text hover:bg-border/20'}`}>
            {label}
          </Link>
        ))}
        {dynamicItems.map(({ label, slug }) => {
          const base = `/instructor/globals/${slug}`
          const href = courseId ? `${base}?from=${courseId}` : base
          return (
            <Link key={slug} href={href} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors truncate ${pathname === base || pathname.startsWith(`${base}?`) ? 'bg-teal-light text-teal-primary' : 'text-muted-text hover:text-dark-text hover:bg-border/20'}`}>
              {label}
            </Link>
          )
        })}
        {makeItems(BOTTOM_ITEMS).map(({ label, href, base }) => (
          <Link key={label} href={href} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors truncate ${pathname === base || pathname.startsWith(base) ? 'bg-teal-light text-teal-primary' : 'text-muted-text hover:text-dark-text hover:bg-border/20'}`}>
            {label}
          </Link>
        ))}
      </div>}
    </nav>
  )
}
