import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Every /instructor page (and courses/new, see src/app/instructor/courses/new/page.tsx)
// independently re-checks the caller's role server-side via createServerSupabaseClient,
// so middleware only needs to know whether *someone* is logged in -- it doesn't need to
// re-derive their role. Keeping middleware to a single lightweight auth check (rather than
// the role + TA-enrollment DB queries this used to run on every request) avoids stacking
// several un-timed network calls on the highest-traffic code path in the app: a slow
// Supabase response here previously meant the whole middleware invocation could hang until
// Vercel's Edge function timeout killed it (MIDDLEWARE_INVOCATION_TIMEOUT).
const AUTH_CHECK_TIMEOUT_MS = 4000

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // If Supabase is slow to respond, fail open (pass the request through as-is)
  // rather than hang until the platform kills the whole invocation -- every
  // protected page re-verifies auth on its own anyway, so this is safe.
  let user: { id: string } | null = null
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('auth check timed out')), AUTH_CHECK_TIMEOUT_MS)),
    ])
    user = result.data.user
  } catch {
    return supabaseResponse
  }

  // Protect flashcard routes -- just confirms someone is logged in; each page
  // enforces its own specific checks.
  if (request.nextUrl.pathname.startsWith('/flashcards') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Protect instructor-only routes -- just confirms someone is logged in; each
  // page enforces its own specific role/TA requirement.
  if (request.nextUrl.pathname.startsWith('/instructor') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect logged-in users away from auth pages
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/cron).*)'],
}