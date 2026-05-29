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
| `ta` *(course-scoped)* | Read-only instructor view for a specific course; can grade but not edit content |

`admin`, `instructor`, and `student` are stored on `users.role` and checked server-side on every protected route. The `ta` role is stored in `course_enrollments.role` (plain text, per-course) and is not an enum value.

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
│   │   │       ├── gradebook/    # Full assignment × student grade grid
│   │   │       ├── grading-groups/ # Assign students to graders; weekly rotation
│   │   │       ├── quizzes/      # Quiz builder (true/false, code snippets, max attempts)
│   │   │       ├── quiz-submissions/ # Quiz attempt table with scores per student
│   │   │       ├── extension-requests/ # Review/approve/deny student extension requests
│   │   │       ├── confidence/   # View all students' confidence tracker scores
│   │   │       └── assignments/[assignmentId]/
│   │   │           ├── page.tsx          # Assignment editor
│   │   │           └── submissions/      # Submissions list + per-student grading
│   │   ├── globals/              # Global template editors
│   │   │   ├── computer-wifi/
│   │   │   ├── policies/
│   │   │   ├── benefits/         # Healthcare, Vision, Dental (paid courses)
│   │   │   └── pto/              # Paid Time Off — holidays & breaks
│   │   ├── calendar/             # Cohorts, breaks, holidays
│   │   └── attendance/           # Attendance portal (Airtable-backed)
│   │
│   └── student/
│       ├── courses/[id]/
│       │   ├── page.tsx          # Syllabus / course outline
│       │   ├── info/             # General Info (read-only sections)
│       │   ├── assignments/      # All assignments list + individual assignment page
│       │   ├── class-resources/  # Class resources by module
│       │   ├── career/           # Career Development resources
│       │   ├── level-up/         # Level Up Your Skills resources
│       │   ├── quizzes/          # Quiz list + individual quiz-taking page
│       │   ├── work/             # My Work — all assignments with status, due dates, grades
│       │   ├── benefits/         # Benefits (paid learner courses only)
│       │   ├── pto/              # Paid Time Off (paid learner courses only)
│       │   └── days/[dayId]/     # Individual day detail with assignments + resources
│       ├── attendance/           # Student attendance view
│       └── confidence/           # Confidence Tracker — self-rate skills over time
│
├── components/ui/                # All reusable components
│   ├── AssignmentEditor.tsx      # Full assignment editor (checklist, rich text, settings)
│   ├── CalendarEditor.tsx        # Manage cohorts, breaks, holidays
│   ├── CodeEditor.tsx            # CodeMirror wrapper (editable + read-only, used in quizzes)
│   ├── CourseEditor.tsx          # Main course drag-and-drop module/day editor
│   ├── ExtensionRequestForm.tsx  # Student extension request form (reason, date, plan)
│   ├── GeneralInfoEditor.tsx     # Instructor-side section editor
│   ├── GeneralInfoSections.tsx   # Student-facing accordion section viewer
│   ├── GlobalContentEditor.tsx   # Single rich-text global content block editor
│   ├── GradebookGrid.tsx         # Full assignment × student grade spreadsheet view
│   ├── InstructorChecklist.tsx   # Instructor grading checklist (toggleable)
│   ├── InstructorConfidenceView.tsx # View all students' confidence tracker data
│   ├── InstructorCourseNav.tsx   # Instructor sidebar navigation
│   ├── InstructorGlobalNav.tsx   # Global Templates sidebar
│   ├── InstructorSidebar.tsx     # Wraps InstructorCourseNav in ResizableSidebar
│   ├── NavMobileMenu.tsx         # Hamburger menu for top nav on mobile
│   ├── NotificationBell.tsx      # In-app notification bell (badge count + dropdown)
│   ├── PaidLearnersToggle.tsx    # Toggle paid_learners flag on a course
│   ├── PTOEditor.tsx             # Manage breaks + holidays for PTO page
│   ├── QuizFullView.tsx          # Instructor quiz builder (questions, code snippets, settings)
│   ├── QuizzesSection.tsx        # Instructor quiz list with publish toggles and day pinning
│   ├── ResizableSidebar.tsx      # Collapsible sidebar (auto-collapses on mobile)
│   ├── RosterView.tsx            # Accommodation roster table with inline edit
│   ├── StudentChecklist.tsx      # Student self-check progress
│   ├── StudentConfidenceTracker.tsx # Student skill confidence rating and chart
│   ├── StudentCourseNav.tsx      # Student sidebar navigation
│   ├── StudentDetailView.tsx     # Student progress breakdown (missing/late/complete cards)
│   ├── StudentViewBanner.tsx     # Amber banner shown in instructor preview mode
│   ├── StudentViewButton.tsx     # "Student View" button in instructor sidebar
│   ├── StudentWorkList.tsx       # "My Work" view — all assignments with status/grade
│   ├── SubmissionComments.tsx    # Threaded comments on a submission
│   ├── SubmissionForm.tsx        # Student assignment submission form (+ optional note)
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
- Students submit text, links, or files, with an optional note for the instructor
- Instructors grade via a checklist (each item checked = complete)
- Overall grade: `complete` or `incomplete` (needs revision)
- Submission history tracks all prior submissions
- Threaded comments on each submission
- **No-submission assignments**: instructor checks off students directly from the submissions list without requiring a student upload
- **Note from student**: if a student adds a note when submitting, it appears highlighted on the grading page

### Checklist System
- Each assignment can have a grading checklist
- Items can be marked as **bonus** (optional)
- Students track their own progress (saved to `student_checklist_progress`)
- Instructor responses are saved to `checklist_responses` and shown read-only to students

### Quizzes
Instructors build quizzes from the **Quizzes** page in the sidebar:
- Question types: true/false, multiple choice; code snippet support (CodeMirror)
- Set a **max attempts** limit; null = unlimited retakes
- Pin a quiz to a specific module day (Mon/Tue/Wed/Thu) so it appears in the Course Editor and student day page
- **Publish toggle** controls student visibility
- Students take quizzes at `/student/courses/[id]/quizzes/[quizId]`; wrong-answer retakes show only missed questions
- Instructors view all attempts in the **Quiz Submissions** table

### Career Dev Cross-Post
Resources, assignments, and quizzes created in a **Career Development** module can be cross-posted to appear on a specific coding-week day:
- Check "Also show in Course Outline?" when creating the item and select the target week + day
- The item's `linked_day_id` FK stores the target day
- Cross-posted items appear in the instructor Course Editor and student day page with a purple **Career Dev** badge
- OR query on `module_day_id = day.id OR linked_day_id = day.id` fetches both native and cross-posted items

### Gradebook
The **Gradebook** page (`/instructor/courses/[id]/gradebook`) is a scrollable assignment × student grid:
- All published syllabus assignments appear as columns; enrolled students as rows
- Each cell shows the submission status (not submitted / turned in / complete / needs revision)
- Click any cell to jump directly to the grading page for that student + assignment
- Grader column identifies which grading-group grader is responsible

### Extension Requests
Students can request a due date extension from the assignment page:
- Student selects a reason, proposed new date, and action plan
- Instructor sees pending requests at `/instructor/courses/[id]/extension-requests` with a badge count in the sidebar
- Instructor can **Approve** (grants extension), **Deny** (with an optional note), or review the request details
- Both parties receive in-app notifications when the request status changes

### In-App Notifications
A notification bell in the top nav shows a badge count of unread notifications:
- **Students** receive notifications when an instructor grades their work or leaves a comment
- **Instructors** receive notifications when a student submits an extension request and when it is responded to
- Clicking a notification marks it read and navigates to the relevant page

### Daily Email Digest
A Vercel cron job runs at 3 pm PST every day and sends one digest email per student:
- Lists any new grade results (complete / needs revision) and instructor comments received since the last digest
- Powered by **Resend** + **React Email** with a branded AnnieCannons template
- `notifications.emailed_at` is set after sending to prevent re-sending in the next digest

### Confidence Tracker
Students track their self-rated confidence (1–10) for any skill they add:
- Add a skill, log a score at any point in time, optionally record effort/goal points
- Chart shows confidence progression over the course
- Instructors can view a class-wide summary at `/instructor/courses/[id]/confidence`

### My Work
The **My Work** page (`/student/courses/[id]/work`) gives students a consolidated view of all assignments across all weeks:
- Filterable by status (not started, turned in, complete, needs revision)
- Shows due dates with late indicators
- Direct link to each assignment page

### Roster & Student Detail
The Roster page (`/instructor/courses/[id]/roster`) shows all enrolled students with accommodation badges:
- **Camera Off** accommodation (red badge)
- **Notes** (amber badge with tooltip)
- Inline edit to set/update accommodations per student
- Click any student name to open the **Student Detail** page showing: last login, accommodation summary, and a breakdown of assignments by category (Missing, Late, Needs Grading, Needs Revision, Complete)
- Clicking a category card expands the assignment list with direct links to grading

### Teaching Assistants (TAs)
A student can be promoted to **TA** for a specific course via the Users page:
- TAs get a read-only instructor view: they can grade and comment but cannot edit course content
- `course_enrollments.role = 'ta'` (course-scoped text column — not an enum)
- TAs are blocked from the Users page and Grading Groups management; all other instructor pages are accessible
- TA badge appears in the top nav and on the course list so the TA always knows which role they are operating under

### Users Page
The Users page (`/instructor/courses/[id]/users`) manages course enrollment:
- Add students, TAs, and instructors by email invitation
- Remove members from the course
- Change member roles (student ↔ TA ↔ instructor)
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
| `course_enrollments` | Links users to courses with a role (`student`, `instructor`, `ta`, `observer`) |
| `invitations` | Pending email invitations to join a course |
| `modules` | Weeks/units within a course (soft-deletable via `deleted_at`) |
| `module_days` | Days within a module (soft-deletable) |
| `resources` | Learning materials per day (supports `published`, `instructor_only`, `linked_day_id`, soft-delete) |
| `assignments` | Assignments per day with checklist and settings (soft-deletable) |
| `checklist_items` | Grading criteria for assignments |
| `submissions` | Student assignment submissions (includes `student_comment`) |
| `checklist_responses` | Instructor's graded checklist per submission |
| `submission_history` | Prior submissions (resubmission support) |
| `submission_comments` | Threaded comments on submissions |
| `student_checklist_progress` | Student's self-tracked checklist state |
| `grade_history` | Log of every grade change per submission |
| `quizzes` | Quiz definitions (soft-deletable, pinnable to a day, cross-postable) |
| `quiz_submissions` | Student quiz attempts with score, attempt count, and attempt history |
| `grading_groups` | Maps students to graders per course (and optionally per module for weekly rotation) |
| `rubric_templates` | Saved reusable checklist templates |
| `extension_requests` | Student due-date extension requests with reason, plan, and status |
| `assignment_overrides` | Per-student due date or excusal overrides for a specific assignment |
| `notifications` | In-app notifications; `emailed_at` tracks digest delivery |
| `confidence_skills` | Skills a student is tracking in the Confidence Tracker |
| `confidence_entries` | Per-skill confidence score log (1–10 self-rating + optional goal points) |
| `course_sections` | Typed sections for the General Info page |
| `global_content` | Shared rich-text content (computer-wifi, policies, benefits-*) |
| `calendar_cohorts` | Named cohort sessions with dates |
| `calendar_breaks` | Multi-day school breaks |
| `calendar_holidays` | Single-day holidays by year |
| `accommodations` | Per-student camera-off flag and notes (one row per student, global) |
| `resource_stars` | Students starring/bookmarking resources |
| `resource_completions` | Students marking resources complete |
| `partners` | Partner organizations (employers, funders, advisors, etc.) |
| `partner_contacts` | Contacts associated with a partner organization |

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
- **Grade actions** — `saveGrade()` and `markCompleteNoSubmission()` verify the caller is an instructor, admin, or TA before writing to the database
- **Student preview cookie** — `isStudentPreview()` verifies the caller is an instructor/admin before returning `true`; students cannot spoof the preview cookie to bypass enrollment checks
- **Course duplication** — non-admin instructors can only duplicate courses they are enrolled in
- **Role promotion** — `updateUserRole()` requires instructor/admin role; only admins can assign the admin role
- **Extension requests** — `getExtensionRequestForStudent()` enforces that the caller is either the student who owns the request or a staff member; students cannot read other students' requests
- **TA scope** — `getInstructorOrTaAccess()` is used by all 12+ instructor course pages; TAs are redirected away from the Users page and Grading Groups management
- **Instructor-only resources** — resources flagged `instructor_only = true` are filtered out server-side on all student-facing pages; the flag is enforced in the API, not just CSS
- **Upload route** — accepts only `lms-submissions` and `lms-resources` buckets; path traversal is blocked; 20 MB size limit enforced
- **Cron digest** — `/api/cron/digest` is protected by a `CRON_SECRET` bearer token checked against Vercel's `Authorization` header; requests without the token receive a 401

---

## Row-Level Security (RLS)

Supabase RLS policies are enforced for most tables. Some instructor operations (cross-user queries for grading, viewing all students' submissions) require the **service role key** and are performed server-side only via `createServiceSupabaseClient()`.

Students can only read their own submissions, progress, and checklist data. Instructors can read and write all records for courses they manage.

---

## Deployment

The app is deployed on [Vercel](https://vercel.com). Set the three environment variables in the Vercel project settings. Supabase handles all database and authentication.
