# AC-LMS Database Schema

Built on Supabase (PostgreSQL). All IDs are UUIDs. Timestamps are `timestamptz`.

---

## Enums

| Enum | Values |
|------|--------|
| `user_role` | `admin`, `instructor`, `student` |
| `resource_type` | `video`, `reading`, `link`, `file` |
| `submission_type` | `text`, `file`, `link` |
| `submission_status` | `draft`, `submitted`, `graded` |

---

## Tables

### users
All user accounts in the system.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `email` | text | Unique, required |
| `role` | user_role | `admin`, `instructor`, or `student` |
| `name` | text | Display name |
| `created_at` | timestamptz | Default: now() |

---

### courses
A course offered on the platform.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `name` | text | Required |
| `code` | text | Short course code (e.g. `FE-Jan-2026`) |
| `syllabus_content` | text | Legacy plain-text syllabus |
| `start_date` | date | |
| `end_date` | date | |
| `is_template` | boolean | Default: false |
| `paid_learners` | boolean | Default: false — enables Benefits & PTO sidebar |
| `created_at` | timestamptz | Default: now() |

---

### course_enrollments
Links users to courses with a role.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `course_id` | uuid | FK → courses |
| `user_id` | uuid | FK → users |
| `role` | user_role | `student` or `instructor` |

Unique constraint on `(course_id, user_id)`.

---

### modules
A module represents a week or unit within a course.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `course_id` | uuid | FK → courses |
| `title` | text | Required |
| `week_number` | int | Optional week label |
| `order` | int | Display order within the course |
| `category` | text | `syllabus`, `career`, `level_up`, etc. |
| `published` | boolean | Default: true |
| `skill_tags` | text[] | Default: `{}` — skill tags for Level Up modules (e.g. `['HTML','CSS']`) |

---

### module_days
A specific day within a module (e.g. Monday, Assignments).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `module_id` | uuid | FK → modules |
| `day_name` | text | e.g. `Monday`, `Assignments` |
| `order` | int | Display order within the module |

---

### resources
Learning materials attached to a module day.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `module_day_id` | uuid | FK → module_days |
| `linked_day_id` | uuid | FK → module_days, nullable — cross-posts this resource to a coding day card |
| `type` | resource_type | `video`, `reading`, `link`, `file` |
| `title` | text | Required |
| `content` | text | URL or content body |
| `description` | text | Optional subtitle/description |
| `order` | int | Display order within the day |

---

### assignments
An assignment attached to a module day.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `module_day_id` | uuid | FK → module_days |
| `linked_day_id` | uuid | FK → module_days, nullable — cross-posts this assignment to a coding day card |
| `title` | text | Required |
| `description` | text | Rich HTML instructions |
| `how_to_turn_in` | text | Rich HTML — how to submit |
| `due_date` | timestamptz | |
| `published` | boolean | Default: true — controls student visibility |
| `submission_required` | boolean | Default: true — false = instructor check-off only |
| `answer_key_url` | text | Instructor-only answer key link |
| `order` | int | Display order within the day |
| `skill_tags` | text[] | Default: `{}` — skill tags shown to students (e.g. `['HTML','React']`) |
| `is_bonus` | boolean | Default: false — bonus assignments appear only in Level Up, not in the main Assignments list or grades unless completed |

---

### quizzes
Quizzes for a course (synced from data folder). Students see only published quizzes.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `course_id` | uuid | FK → courses |
| `identifier` | text | Unique per course (from JSON) |
| `title` | text | Required |
| `due_at` | timestamptz | |
| `module_title` | text | e.g. "Week 1: Intro" — used to match to a module in the Course Editor |
| `day_title` | text | e.g. `Monday` — pins the quiz to a specific day within its module |
| `linked_day_id` | uuid | FK → module_days, nullable — cross-posts this quiz to a coding day card |
| `published` | boolean | Default: false |
| `max_attempts` | int | Nullable — maximum retake attempts allowed (null = unlimited) |
| `questions` | jsonb | Array of question objects with choices and correct_response_ident |
| `created_at` | timestamptz | Default: now() |
| `updated_at` | timestamptz | Default: now() |

Unique on `(course_id, identifier)`.

---

### quiz_submissions
A student's submitted quiz attempt (one per student per quiz).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `quiz_id` | uuid | FK → quizzes |
| `student_id` | uuid | FK → users |
| `submitted_at` | timestamptz | Default: now() |
| `answers` | jsonb | Array of `{ question_ident, choice_ident }` |
| `score_percent` | numeric(5,2) | Optional 0–100 |
| `attempt_count` | int | Default: 1 — tracks how many times the student has submitted |

Unique on `(quiz_id, student_id)`.

---

### checklist_items
Grading criteria for an assignment. Instructors check these off when grading.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `assignment_id` | uuid | FK → assignments |
| `text` | text | Required — the criterion label |
| `description` | text | Optional explanation |
| `order` | int | Display order |
| `required` | boolean | Default: true — false = bonus item |

---

### submissions
A student's submission for an assignment.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `assignment_id` | uuid | FK → assignments |
| `student_id` | uuid | FK → users |
| `submission_type` | submission_type | `text`, `file`, `link` |
| `content` | text | Submission body or URL |
| `submitted_at` | timestamptz | Default: now() |
| `status` | submission_status | `draft`, `submitted`, `graded` |
| `grade` | text | `complete` or `incomplete` |
| `graded_at` | timestamptz | |
| `graded_by` | uuid | FK → users (instructor who graded) |

---

### submission_history
Stores prior versions when a student resubmits.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `assignment_id` | uuid | FK → assignments |
| `student_id` | uuid | FK → users |
| `submission_type` | submission_type | |
| `content` | text | |
| `submitted_at` | timestamptz | |

---

### submission_comments
Threaded comments on a submission between student and instructor.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `submission_id` | uuid | FK → submissions |
| `author_id` | uuid | FK → users |
| `content` | text | Comment body |
| `created_at` | timestamptz | Default: now() |

---

### checklist_responses
Instructor's graded responses to each checklist item on a submission.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `submission_id` | uuid | FK → submissions |
| `checklist_item_id` | uuid | FK → checklist_items |
| `checked` | boolean | Default: false |
| `graded_by` | uuid | FK → users (instructor) |

Unique constraint on `(submission_id, checklist_item_id)`.

---

### student_checklist_progress
Student's own self-tracked checklist progress (separate from instructor grading).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `student_id` | uuid | FK → users |
| `checklist_item_id` | uuid | FK → checklist_items |
| `checked` | boolean | Default: false |

Unique constraint on `(student_id, checklist_item_id)`.

---

### course_sections
Typed content sections that make up a course's General Info page.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `course_id` | uuid | FK → courses |
| `title` | text | Section heading |
| `type` | text | See section types below |
| `content` | text | JSON or HTML depending on type |
| `order` | int | Display order |
| `published` | boolean | Default: true |

**Section types:**

| type | Rendered as |
|------|-------------|
| `text` | Rich HTML content |
| `daily_schedule` | Auto-generated daily schedule |
| `course_outline` | Weekly topic table (JSON: `{ rows: [{week, topics, description}] }`) |
| `yearly_schedule` | Live cohort + holiday calendar (pulled from calendar tables) |
| `computer_wifi` | Global computer & wifi content |
| `policies_procedures` | Global policies content |
| `global:<slug>` | Any other global_content by slug |

---

### global_content
Shared rich-text content reused across courses. Edited once at `/instructor/globals/`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `slug` | text | Unique identifier (e.g. `computer-wifi`, `benefits-healthcare`) |
| `title` | text | Display name |
| `content` | text | Rich HTML |
| `updated_at` | timestamptz | |

**Known slugs:**

| Slug | Used by |
|------|---------|
| `computer-wifi` | General Info → Computer and Wifi section |
| `policies` | General Info → Policies and Procedures section |
| `launch-tasks` | Launch Setup modal |
| `benefits-healthcare` | Student Benefits page |
| `benefits-vision` | Student Benefits page |
| `benefits-dental` | Student Benefits page |

---

### calendar_cohorts
Named cohort sessions with date ranges, shown in the yearly schedule.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `name` | text | `Winter`, `Summer`, or `Fall` |
| `start_date` | date | |
| `end_date` | date | |
| `order` | int | Display order |

---

### calendar_breaks
Multi-day school breaks (Thanksgiving week, Winter break, etc.).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `label` | text | e.g. `Thanksgiving Week`, `Winter/Holiday Break` |
| `start_date` | date | |
| `end_date` | date | |

---

### calendar_holidays
Holidays per year. Single-day or multi-day (e.g. Thanksgiving Week).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `label` | text | e.g. `Labor Day` |
| `date_display` | text | Human-friendly string e.g. `Mon, Sep 7` |
| `date` | date | Start date (used for sorting and calendar highlight) |
| `end_date` | date | Optional end date — enables range highlight on calendar |
| `year` | int | Scoped per year — supports copy-to-next-year |

---

### accommodations
Per-student accommodations tracked per user (global, not per-course).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → users, unique |
| `camera_off` | boolean | Default: false — student has camera-off accommodation |
| `notes` | text | Free-text accommodation notes |

Unique constraint on `user_id`.

---

### resource_stars
Students bookmarking/starring resources.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → users |
| `resource_id` | uuid | FK → resources |

Unique constraint on `(user_id, resource_id)`.

---

### resource_completions
Students marking resources as complete.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → users |
| `resource_id` | uuid | FK → resources |

Unique constraint on `(user_id, resource_id)`.

---

## Relationships Diagram

```
courses
  ├── course_enrollments (users ↔ courses)
  ├── course_sections
  └── modules
        └── module_days
              ├── resources
              │     ├── resource_stars (users ↔ resources)
              │     └── resource_completions (users ↔ resources)
              └── assignments
                    ├── checklist_items
                    │     └── student_checklist_progress (users ↔ checklist_items)
                    ├── submissions
                    │     ├── checklist_responses (checklist_items ↔ submissions)
                    │     ├── submission_comments (users ↔ submissions)
                    │     └── submission_history
                    └── ...
  └── quizzes
        └── quiz_submissions

accommodations (users → one row per student)

global_content (shared across all courses)

calendar_cohorts
calendar_breaks
calendar_holidays
```

### invitations
Pending email invitations to join a course.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `course_id` | uuid | FK → courses(id), CASCADE DELETE |
| `email` | text | Invitee email |
| `role` | user_role | `student` or `instructor` |
| `invited_by` | uuid | FK → users(id) |
| `invited_at` | timestamptz | Default: now() |
| `resent_at` | timestamptz | Nullable, set on resend |
| `status` | text | `pending` or `accepted` |

RLS: Instructors/admins can manage invitations for their own courses.

## Indexes

| Table | Indexed Column | Reason |
|-------|---------------|--------|
| `course_enrollments` | `course_id`, `user_id` | Fast lookup by course or user |
| `modules` | `course_id` | All modules in a course |
| `module_days` | `module_id` | All days in a module |
| `resources` | `module_day_id` | All resources for a day |
| `assignments` | `module_day_id` | All assignments for a day |
| `checklist_items` | `assignment_id` | All checklist items for an assignment |
| `submissions` | `assignment_id`, `student_id`, `submitted_at` | Query submissions by assignment, student, or date |
| `checklist_responses` | `submission_id` | All responses for a submission |
| `quizzes` | `course_id`, `(course_id, published)` | Quizzes per course; student list by published |
| `quiz_submissions` | `quiz_id`, `student_id` | Lookup by quiz or by student |
