# AC-LMS Database Schema

## Overview

This document describes the database schema for the AnnieCannons Learning Management System (LMS), built on Supabase (PostgreSQL).

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
Stores all user accounts in the system.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `email` | text | Unique, required |
| `role` | user_role | Default: `learner` |
| `name` | text | |
| `created_at` | timestamptz | Default: now() |

---

### courses
Represents a course offered on the platform. Can be marked as a template for reuse.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `name` | text | Required |
| `code` | text | Unique course code |
| `syllabus_content` | text | |
| `start_date` | date | |
| `end_date` | date | |
| `created_at` | timestamptz | Default: now() |
| `is_template` | boolean | Default: false |

---

### course_enrollments
Links users to courses with a specific role (e.g. learner or instructor).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `course_id` | uuid | FK → courses |
| `user_id` | uuid | FK → users |
| `role` | user_role | Default: `learner` |

Unique constraint on `(course_id, user_id)`.

---

### modules
A module represents a week or unit within a course.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `course_id` | uuid | FK → courses |
| `title` | text | Required |
| `week_number` | int | |
| `order` | int | Display order |

---

### module_days
A specific day within a module (e.g. Monday, Tuesday).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `module_id` | uuid | FK → modules |
| `day_name` | text | Required |
| `order` | int | Display order |

---

### resources
Learning materials attached to a module day (videos, readings, links, files).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `module_day_id` | uuid | FK → module_days |
| `type` | resource_type | Required |
| `title` | text | Required |
| `content` | text | URL or content body |
| `order` | int | Display order |

---

### assignments
An assignment attached to a module day with an optional due date.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `module_day_id` | uuid | FK → module_days |
| `title` | text | Required |
| `description` | text | |
| `due_date` | timestamptz | |
| `published` | boolean | Default: true |

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
| `module_title` | text | e.g. "Week 1: Intro" |
| `published` | boolean | Default: false |
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

Unique on `(quiz_id, student_id)`.

---

### checklist_items
Individual checklist criteria that make up an assignment's grading rubric.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `assignment_id` | uuid | FK → assignments |
| `text` | text | Required |
| `order` | int | Display order |

---

### submissions
A learner's submission for an assignment.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `assignment_id` | uuid | FK → assignments |
| `student_id` | uuid | FK → users |
| `submission_type` | submission_type | Required |
| `content` | text | |
| `submitted_at` | timestamptz | Default: now() |
| `status` | submission_status | Default: `draft` |
| `graded_at` | timestamptz | |

---

### checklist_responses
Instructor's graded responses to each checklist item on a submission.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `submission_id` | uuid | FK → submissions |
| `checklist_item_id` | uuid | FK → checklist_items |
| `checked` | boolean | Default: false |
| `comment` | text | |
| `graded_by` | uuid | FK → users |

---

## Relationships Diagram

```
courses
  └── course_enrollments (users ↔ courses)
  └── modules
        └── module_days
              ├── resources
              └── assignments
                    ├── checklist_items
                    └── submissions
                          └── checklist_responses (checklist_items ↔ submissions)
  └── quizzes
        └── quiz_submissions
```

---

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