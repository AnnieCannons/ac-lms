# AC-LMS — Claude Code Context

## What This Project Is
A custom Learning Management System for AnnieCannons, a nonprofit coding school. Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + Auth), and Tiptap for rich text editing. Deployed on Vercel.

---

## Active Development: Flashcard App

A spaced repetition flashcard app is being built as a new section of this LMS. It lives at `/flashcards` and links from the Level Up Your Skills section of the student sidebar.

**PRD location:** Ask the developer for the PRD document — it covers full scope, data model, and V2 roadmap.

**Key decisions already made:**
- Same Supabase project — no separate auth, no new login
- All flashcard data in new tables referencing `users.id` as foreign key
- No modifications to any existing LMS tables
- Reuse the existing `RichTextEditor` (Tiptap) component for card content
- Reuse the existing `notifications` table for deck update notifications (new `type` values)
- Accessibility settings inherit from LMS via same `localStorage` keys (`dyslexia-font`, `high-contrast`, `dark-mode`)
- SM-2 spaced repetition algorithm
- PWA/offline support (to be added)

**Flashcard role mapping:**
- `student` role → standard user access
- `ta` (course-scoped in `course_enrollments`) → standard user access
- `instructor`, `staff`, `admin` roles → admin access
- Note: Catie is merging `staff` and `instructor` into one role — schema update coming Monday. When that happens, update any role checks that reference both separately.

**Card types (stored as strings in `cards.card_type`):**
- `basic` — front and back, user flips and self-rates
- `basic_reverse` — auto-generates two cards: front→back and back→front
- `type_in` — user types answer, compared case-insensitively to correct answer
- `cloze` — fill-in-the-blank, each blank becomes its own card
- `image_occlusion` — user hides parts of an image, each hidden area is a card

**Predefined deck tags (stored as `text[]` in `decks.tags`):**
HTML, CSS, JavaScript, React, SQL, Node.js, Express.js, APIs, Git, Command Line, Accessibility, Career Development, Other
Multiple tags can be applied to a single deck.

**New tables to be created (see PRD for full column definitions):**
- `decks`
- `cards`
- `card_progress`
- `study_sessions`
- `badges`
- `user_badges`
- `activity_log`

---

## Project Structure

```
src/
├── app/
│   ├── instructor/     # Instructor-facing pages
│   └── student/        # Student-facing pages
├── components/ui/      # All reusable components
├── hooks/              # Custom React hooks
└── lib/
    ├── supabase/
    │   ├── client.ts   # Browser Supabase client
    │   └── server.ts   # Server client + service role client
    └── ...             # Server actions
```

New flashcard pages will follow this pattern:
```
src/app/flashcards/          # Flashcard home (deck grid + activity grid)
src/app/flashcards/decks/    # Deck management
src/app/flashcards/study/    # Study session
src/app/flashcards/stats/    # Stats page
src/app/flashcards/help/     # How it works / onboarding
```

---

## Conventions to Follow

### Supabase
- Browser client: `createClient()` from `@/lib/supabase/client`
- Server client: `createServerSupabaseClient()` from `@/lib/supabase/server`
- Service role (cross-user queries): `createServiceSupabaseClient()` — server-side only
- Always use the server client in Server Components and Route Handlers
- RLS is enforced — student data is isolated by `user_id`

### Auth & Role Checks
- Get current user: `supabase.auth.getUser()`
- Get role: query `users` table by `user.id`, check `role` column
- TA check: query `course_enrollments` where `user_id = user.id AND role = 'ta'`
- Middleware pattern is in `src/middleware.ts` — follow the same pattern for flashcard route protection

### Components
- All reusable UI components live in `src/components/ui/`
- Use the existing `RichTextEditor` component for any rich text editing — do not introduce a new editor
- Follow existing ARIA patterns from `ACCESSIBILITY.md` — this project targets WCAG AA
- Use `focus-visible:ring-2 focus-visible:ring-teal-primary` for focus rings
- Use `aria-live="polite"` for save confirmations, `role="alert" aria-live="assertive"` for errors

### Styling
- Tailwind CSS only — no inline styles, no CSS modules
- Color tokens: `teal-primary` is the brand color
- Dark mode, high contrast, and dyslexia font are applied via CSS classes on `<html>`: `theme-dark`, `high-contrast`, `dyslexic`
- Responsive: default = mobile, `sm:` = 640px+, `md:` = 768px+

### Pages
- Every `<main>` element needs `id="main-content"` and `tabIndex={-1}` and `className="... focus:outline-none"` for screen reader focus management
- Server Components by default; add `'use client'` only when needed (event handlers, hooks, browser APIs)

### Forms & Mutations
- Use server actions (in `src/lib/`) for data mutations where possible
- Validate role server-side before any write — never trust client-side role checks alone
- HTML from rich text editors must be sanitized with `isomorphic-dompurify` before `dangerouslySetInnerHTML`

### Notifications
- Insert into `notifications` table with appropriate `type`, `user_id`, `message`, and optional FK fields
- New flashcard notification types: `deck_updated`

---

## Key Files to Know
- `SCHEMA.md` — full database schema with all tables and columns
- `ACCESSIBILITY.md` — full accessibility implementation guide
- `src/middleware.ts` — auth and role-based route protection
- `src/lib/supabase/server.ts` — server Supabase clients
- `src/components/ui/RichTextEditor.tsx` — Tiptap rich text editor (reuse for flashcards)
- `src/app/layout.tsx` — root layout with accessibility settings restore script

---

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # Required for cross-user/admin queries
```

---

## Build Order

Work through these sections in order. Check off each one when complete before moving to the next.

- [ ] 1. Flashcard home page — `/flashcards`, deck grid + activity grid placeholder
- [ ] 2. Deck management — create, edit (title, description, tags), and delete a deck
- [ ] 3. Card management — add, edit, delete, and reorder cards within a deck; card editor with rich text editor and card type selection
- [ ] 4. Study session — flip cards, rate them, SM-2 algorithm
- [ ] 5. Sharing & importing — share link generation, import a deck
- [ ] 6. Stats & activity grid — GitHub-style grid, stats page
- [ ] 7. Badges — award system
- [ ] 8. Help page & tooltips
- [ ] 9. Database migrations — create all flashcard tables in Supabase
- [ ] 10. Swap fake data for real Supabase queries throughout
- [ ] 11. Nav wiring — add flashcard link to StudentCourseNav in Level Up Your Skills
- [ ] 12. Middleware — add `/flashcards` route protection
- [ ] 13. PWA / offline support
- [ ] 14. Accessibility pass

**Note:** Sections 1–8 use fake/seed data so we can build without being blocked on database access. The seed data should match the exact shape of the real database schema so swapping it out later is a clean find-and-replace.

---

## Working Agreement
- Build section by section, one piece at a time — do not build multiple features in a single step
- Test each piece works before moving on to the next
- All commits go to the `flashcard-app` branch
- Do NOT create a pull request unless explicitly asked to
- Do NOT push to `main` under any circumstances

## Files We Can Touch
All flashcard work lives in new files only, with two exceptions:
- `src/middleware.ts` — add `/flashcards` route protection (small addition only)
- `src/components/ui/StudentCourseNav.tsx` — add flashcard link in the Level Up Your Skills section

Do not edit any other existing files. If something in the flashcard app requires a change to an existing file not listed above, flag it for Catie rather than editing it directly.

---

## Things to Avoid
- Do not modify any existing LMS tables (`users`, `courses`, `modules`, etc.)
- Do not introduce a second Supabase project or auth system
- Do not introduce a new rich text editor — reuse `RichTextEditor`
- Do not skip RLS — all flashcard tables need row-level security policies
- Do not edit existing files outside of the two listed in "Files We Can Touch"
