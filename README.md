# AC-LMS — AnnieCannons Learning Management System

A custom LMS built for [AnnieCannons](https://anniecannons.org), supporting instructor course management, student learning, assignment submission and grading, and employment benefits for paid learner programs.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database / Auth | Supabase (PostgreSQL + @supabase/ssr) |
| Drag & Drop | @dnd-kit |
| Rich Text | Tiptap (via RichTextEditor component) |
| HTML Sanitization | isomorphic-dompurify |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project with the schema from `SCHEMA.md` applied

### Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> `SUPABASE_SERVICE_ROLE_KEY` is required for server-side cross-user queries (grading, admin operations). Without it, some instructor features will be unavailable.

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## User Roles

| Role | Access |
|------|--------|
| `admin` | Full access — same as instructor plus user management |
| `instructor` | Course management, grading, global template editing |
| `student` | Enrolled courses only — view content, submit assignments |

Role is stored on the `users` table and checked server-side on every protected route.

---

## Project Structure

```
src/
├── app/
│   ├── instructor/               # Instructor-facing pages
│   │   ├── courses/              # Course list, editor, assignment editor
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Main course editor (modules, days, drag-and-drop)
│   │   │       ├── info/         # General Info sections editor
│   │   │       ├── users/        # Users page (enroll/invite/remove members)
│   │   │       │   └── all/      # All users across all courses
│   │   │       ├── roster/       # Accommodation roster (camera-off, notes)
│   │   │       │   └── [userId]/ # Student detail: progress, last login, assignment breakdown
│   │   │       └── assignments/[assignmentId]/
│   │   │           ├── page.tsx          # Assignment editor
│   │   │           └── submissions/      # Submissions list + per-student grading
│   │   ├── globals/              # Global template editors
│   │   │   ├── computer-wifi/
│   │   │   ├── policies/
│   │   │   ├── benefits/         # Healthcare, Vision, Dental (paid courses)
│   │   │   └── pto/              # Paid Time Off — holidays & breaks
│   │   └── calendar/             # Cohorts, breaks, holidays
│   │
│   └── student/
│       └── courses/[id]/
│           ├── page.tsx          # Syllabus / course outline
│           ├── info/             # General Info (read-only sections)
│           ├── assignments/      # All assignments list
│           ├── class-resources/  # Class resources by module
│           ├── career/           # Career Development resources
│           ├── level-up/         # Level Up Your Skills resources
│           ├── benefits/         # Benefits (paid learner courses only)
│           ├── pto/              # Paid Time Off (paid learner courses only)
│           └── days/[dayId]/     # Individual day detail with assignments + resources
│
├── components/ui/                # All reusable components
│   ├── AssignmentEditor.tsx      # Full assignment editor (checklist, rich text, settings)
│   ├── CalendarEditor.tsx        # Manage cohorts, breaks, holidays
│   ├── CourseEditor.tsx          # Main course drag-and-drop module/day editor
│   ├── GeneralInfoEditor.tsx     # Instructor-side section editor
│   ├── GeneralInfoSections.tsx   # Student-facing accordion section viewer
│   ├── GlobalContentEditor.tsx   # Single rich-text global content block editor
│   ├── InstructorChecklist.tsx   # Instructor grading checklist (toggleable)
│   ├── InstructorCourseNav.tsx   # Instructor sidebar navigation
│   ├── InstructorGlobalNav.tsx   # Global Templates sidebar
│   ├── InstructorSidebar.tsx     # Wraps InstructorCourseNav in ResizableSidebar
│   ├── NavMobileMenu.tsx         # Hamburger menu for top nav on mobile
│   ├── PaidLearnersToggle.tsx    # Toggle paid_learners flag on a course
│   ├── PTOEditor.tsx             # Manage breaks + holidays for PTO page
│   ├── ResizableSidebar.tsx      # Collapsible sidebar (auto-collapses on mobile)
│   ├── RosterView.tsx            # Accommodation roster table with inline edit
│   ├── StudentChecklist.tsx      # Student self-check progress
│   ├── StudentCourseNav.tsx      # Student sidebar navigation
│   ├── StudentDetailView.tsx     # Student progress breakdown (missing/late/complete cards)
│   ├── StudentViewBanner.tsx     # Amber banner shown in instructor preview mode
│   ├── StudentViewButton.tsx     # "Student View" button in instructor sidebar
│   ├── SubmissionComments.tsx    # Threaded comments on a submission
│   ├── SubmissionForm.tsx        # Student assignment submission form
│   ├── SubmissionsList.tsx       # Instructor submissions list with quick actions
│   └── YearlyScheduleSection.tsx # Calendar display (cohorts, holidays, breaks)
│
├── hooks/
│   └── useUnsavedChanges.ts      # Warn on navigation with unsaved changes
│
└── lib/
    ├── supabase/
    │   ├── client.ts             # Browser Supabase client
    │   └── server.ts             # Server Supabase client + service role client
    ├── checklist-actions.ts      # Server action: toggle student checklist progress
    ├── grade-actions.ts          # Server actions: save grade, mark complete
    └── student-preview.ts        # Cookie-based instructor preview mode check
```

---

## Key Features

### Course Management
Instructors build courses with a drag-and-drop editor:
- **Modules** represent weeks or units
- **Module Days** (Monday–Thursday + Assignments day) contain resources and assignments
- Resources can be videos, readings, links, or files
- Assignments support rich-text instructions, checklists, and a "how to turn in" section
- Modules and days can be published/unpublished independently

### Assignment Grading
- Students submit text, links, or files
- Instructors grade via a checklist (each item checked = complete)
- Overall grade: `complete` or `incomplete` (needs revision)
- Submission history tracks all prior submissions
- Threaded comments on each submission
- **No-submission assignments**: instructor checks off students directly from the submissions list without requiring a student upload

### Checklist System
- Each assignment can have a grading checklist
- Items can be marked as **bonus** (optional)
- Students track their own progress (saved to `student_checklist_progress`)
- Instructor responses are saved to `checklist_responses` and shown read-only to students

### Roster & Student Detail
The Roster page (`/instructor/courses/[id]/roster`) shows all enrolled students with accommodation badges:
- **Camera Off** accommodation (red badge)
- **Notes** (amber badge with tooltip)
- Inline edit to set/update accommodations per student
- Click any student name to open the **Student Detail** page showing: last login, accommodation summary, and a breakdown of assignments by category (Missing, Late, Needs Grading, Needs Revision, Complete)
- Clicking a category card expands the assignment list with direct links to grading

### Users Page
The Users page (`/instructor/courses/[id]/users`) manages course enrollment:
- Add students and instructors by email invitation
- Remove members from the course
- Change member roles
- View all users across all courses (All Users tab)

### Mobile & Responsive Layout
The app is fully responsive from 375px phones to desktop:
- **Top nav**: hamburger menu on mobile (`NavMobileMenu`) for quick access to Attendance Portal, Profile, and logout
- **Sidebar**: auto-collapses on mobile (< 768px) on first visit; toggle button hidden on mobile
- **Course editor**: drag handles and category selectors hidden on mobile for a minimal view
- Breakpoint strategy: default = mobile, `sm:` = 640px+, `md:` = 768px+

### Student View (Instructor Preview Mode)
Instructors can preview exactly what students see without a separate test account:
1. Click **Student View** in the instructor sidebar
2. A cookie (`student-view=<courseId>`) is set — role redirects and enrollment checks are bypassed
3. An amber banner at the top indicates preview mode
4. Click **Leave Student View** to return to the instructor view and clear the cookie

### Global Templates
Shared content edited once and embedded in every course's General Info:
- **Computer and Wifi** — tech setup instructions
- **Policies and Procedures** — school policies
- **Benefits** (Healthcare, Vision, Dental) — for paid learner courses
- **Paid Time Off** — holidays + breaks from the global calendar

### Paid Learner Courses
Courses can be marked as **paid learner courses** (e.g. Advanced Backend, Advanced Frontend):
- Toggle on the course Info page (`/instructor/courses/[id]/info`)
- Also set during course creation
- Enables **Benefits** and **Paid Time Off** in the student sidebar under an "Employment" section

### Calendar
Managed at `/instructor/calendar`:
- **Cohorts** — named sessions (Winter, Summer, Fall) with start/end dates
- **School Breaks** — multi-day breaks (Thanksgiving week, Winter break, etc.)
- **Holidays** — single-day holidays per year, with copy-to-next-year feature
- Calendar data is shared globally across all courses

### General Info Sections
Instructors compose the General Info page from typed sections:
- `text` — rich HTML content
- `daily_schedule` — auto-generated from class times
- `course_outline` — weekly topic table
- `yearly_schedule` — live-rendered cohort + holiday calendar
- `computer_wifi` / `policies_procedures` — pulls from global templates

---

## Database

See [`SCHEMA.md`](./SCHEMA.md) for full table definitions and relationships.

Key tables:

| Table | Purpose |
|-------|---------|
| `users` | All accounts (admin, instructor, student) |
| `courses` | Courses with metadata and `paid_learners` flag |
| `course_enrollments` | Links users to courses with a role |
| `modules` | Weeks/units within a course |
| `module_days` | Days within a module |
| `resources` | Learning materials per day |
| `assignments` | Assignments per day with checklist and settings |
| `checklist_items` | Grading criteria for assignments |
| `submissions` | Student assignment submissions |
| `checklist_responses` | Instructor's graded checklist per submission |
| `submission_history` | Prior submissions (resubmission support) |
| `submission_comments` | Threaded comments on submissions |
| `student_checklist_progress` | Student's self-tracked checklist state |
| `course_sections` | Typed sections for the General Info page |
| `global_content` | Shared rich-text content (computer-wifi, policies, benefits-*) |
| `calendar_cohorts` | Named cohort sessions with dates |
| `calendar_breaks` | Multi-day school breaks |
| `calendar_holidays` | Single-day holidays by year |
| `accommodations` | Per-student camera-off flag and notes (one row per student, global) |
| `resource_stars` | Students starring/bookmarking resources |
| `resource_completions` | Students marking resources complete |

---

## Importing a Course

Use the import script to load a JSON course file into Supabase:

```bash
source .env.local && npx ts-node --esm scripts/import-course.ts <path-to-file>
```

After importing, clean up any orphaned modules:
```sql
DELETE FROM modules WHERE title IS NULL OR title = '';
```

Course JSON files are organized in `src/data/` by program:
- `backend/` — Advanced Backend
- `frontend/` — Advanced Frontend
- `itp/` — Intro to Programming
- `tcf/` — The Coding Foundation

---

## Security

Several server-side authorization checks are enforced beyond RLS:

- **HTML sanitization** — all user-generated rich HTML is passed through `isomorphic-dompurify` before `dangerouslySetInnerHTML` (prevents XSS)
- **Grade actions** — `saveGrade()` and `markCompleteNoSubmission()` verify the caller is an instructor or admin before writing to the database
- **Student preview cookie** — `isStudentPreview()` verifies the caller is an instructor/admin before returning `true`; students cannot spoof the preview cookie to bypass enrollment checks
- **Course duplication** — non-admin instructors can only duplicate courses they are enrolled in
- **Role promotion** — `updateUserRole()` requires instructor/admin role; only admins can assign the admin role

---

## Row-Level Security (RLS)

Supabase RLS policies are enforced for most tables. Some instructor operations (cross-user queries for grading, viewing all students' submissions) require the **service role key** and are performed server-side only via `createServiceSupabaseClient()`.

Students can only read their own submissions, progress, and checklist data. Instructors can read and write all records for courses they manage.

---

## Deployment

The app is deployed on [Vercel](https://vercel.com). Set the three environment variables in the Vercel project settings. Supabase handles all database and authentication.
