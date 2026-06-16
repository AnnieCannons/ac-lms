import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'

const COMMON_DOMAINS = new Set(['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'])

function checkApiKey(req: NextRequest) {
  const key = req.headers.get('x-addon-api-key')
  return !!(process.env.ADDON_API_KEY && key === process.env.ADDON_API_KEY)
}

type PartnerSnippet = { id: string; name: string; status: string; city: string | null; state: string | null } | null

function formatContact(c: { id: string; name: string; email: string; primary_departments: string[] | null; partners: unknown }) {
  const partner = c.partners as PartnerSnippet
  return {
    ...partner,
    matched_contact: {
      id: c.id,
      name: c.name,
      email: c.email,
      primary_departments: c.primary_departments ?? [],
    },
  }
}

export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = req.nextUrl.searchParams.get('email')
  const q = req.nextUrl.searchParams.get('q')
  const supabase = createServiceSupabaseClient()

  if (email) {
    // Exact contact email match
    const { data: exact } = await supabase
      .from('partner_contacts')
      .select('id, name, email, primary_departments, partners(id, name, status, city, state)')
      .ilike('email', email)
      .neq('is_archived', true)
      .limit(3)

    if (exact?.length) {
      return NextResponse.json({ partners: exact.map(formatContact) })
    }

    // Domain fallback — skip generic providers
    const domain = email.split('@')[1]
    if (domain && !COMMON_DOMAINS.has(domain)) {
      const { data: byDomain } = await supabase
        .from('partner_contacts')
        .select('id, name, email, primary_departments, partners(id, name, status, city, state)')
        .ilike('email', `%@${domain}`)
        .neq('is_archived', true)
        .limit(5)

      if (byDomain?.length) {
        const seen = new Set<string>()
        const partners = byDomain
          .filter(c => {
            const p = c.partners as unknown as PartnerSnippet
            return p && !seen.has(p.id) && !!seen.add(p.id)
          })
          .map(formatContact)
        return NextResponse.json({ partners })
      }
    }

    return NextResponse.json({ partners: [] })
  }

  if (q && q.length >= 2) {
    const { data } = await supabase
      .from('partners')
      .select('id, name, status, city, state')
      .ilike('name', `%${q}%`)
      .order('name')
      .limit(10)
    return NextResponse.json({ partners: data ?? [] })
  }

  return NextResponse.json({ partners: [] })
}
