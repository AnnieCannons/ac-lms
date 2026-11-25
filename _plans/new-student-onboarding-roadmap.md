# New Student Onboarding — Phased Roadmap

## Context
Accepted students are added to an **Enrollment Readiness** course (three a year, e.g. *Enrollment Readiness (2027)*, made by duplicating the last one). Once they finish everything in it, staff ship them a laptop (and a wifi device if they need one) and later add them all to the next Tech Career Foundations course, which usually doesn't exist yet while Enrollment Readiness is running. Until now this was tracked by hand.

This feature gives Enrollment Readiness courses their own trimmed student sidebar, works out when a student has finished, shows staff one **New Student Onboarding** page (progress, what to mark complete, wifi choice, shipping, the move to TCF), and adds shipping, tracking numbers, wifi choices and Comcast NOW plans to the Hardware Tracker.

Built as a phased rollout like the Hardware Tracker: each phase committed on `claude/feat/new-student-onboarding`, one PR at the end.

## Decisions (from Catie, 2026-11-25)
- **No new role.** Enrollment Readiness students are ordinary `student`s. A course checkbox, **Enrollment Readiness course** (`courses.is_enrollment_readiness`), changes how that course behaves. Duplicating a course copies every setting, so the next cohort's course keeps it.
- **Student sidebar in an Enrollment Readiness course:** My Equipment, Course Outline, Grades, Profile. Hidden: General Info, Cutting Edge Talks, Class Resources, Career Development, Level Up Your Skills and Quizzes (ER has none). The hidden pages redirect to the Course Outline.
- **Finished = every counted assignment marked Complete** (by staff). Submitted isn't enough. Excused assignments don't count against them. Optional and bonus assignments never count.
- **"Counts toward finishing"** is a per-assignment setting shown only in Enrollment Readiness courses, on by default. *Receiving Your Laptop* (its checklist is done after the laptop arrives) is set to not count.
- The DocuSign assignment is **Equipment Use & Responsibility Agreement**. Students check the list and submit "Finished"; staff check DocuSign and mark it Complete like any other assignment.
- **Laptop:** every student gets one (Catie, 2026-11-25), so there's no laptop choice in the UI; the row shows where it is (ships once they finish / ready to ship / shipped / arrived). `hardware_student_needs.laptop` stays at its default `needs`.
- **Wifi:** staff pick it after meeting with the student: **None** (default), **Comcast NOW**, **Booster** or **Hotspot**.
- When a student finishes, they go on the Hardware Tracker **waitlist** for a laptop (unless they have their own) and for a hotspot/booster if that's their wifi, and **#student-hardware** gets a post.
- **Comcast NOW:** AnnieCannons pays monthly and submits a receipt each month, so the plan is tracked (start date, account, monthly cost) and a monthly reminder posts in #student-hardware. Students don't need instructions.
- **Shipping:** labels are bought and printed on Pirate Ship (USPS or UPS) and staff box everything. A **Ship** step picks the device(s), carrier and tracking number, loans them, and tells the student (bell, Slack DM, email). Before it, the student sees "We're preparing to ship". Every loan can be shipped this way, so replacements get tracking numbers too.
- **I got it:** students confirm arrival on My Equipment. This does **not** check off *Receiving Your Laptop*, which has its own checklist.
- **Moving to TCF:** each Enrollment Readiness course has a **Next course**. Staff pick it once the TCF course exists and add every finished student with one button. Students are never added later, so there's no automatic adding. Students stay in the Enrollment Readiness course afterwards.
- **Who sees it:** the New Student Onboarding card and page are for instructors, staff and admins, not TAs.
- **Nothing else reaches Enrollment Readiness students:** their course is left out of Cutting Edge Talk audiences (invites, Slack DMs, reminders, tasks) and out of the equipment check-in course list. Weekly readiness scoring is already opt-in per course.
- The August 2026 *Enrollment Readiness* course is left unchecked (that cohort has moved on). *Backend (Readiness Test)* was only for testing.

## Data model
| Table / column | Purpose |
|---|---|
| `courses.is_enrollment_readiness` | boolean, default false. The checkbox. Copied on duplicate. |
| `courses.onboarding_next_course_id` | uuid → courses, nullable. Where finishers go next. Per cohort, so reset to null on duplicate. |
| `assignments.counts_toward_onboarding` | boolean, default true. Copied on duplicate. |
| `course_completions` (existing) | A row is written (marked_by = whoever marked the last assignment complete) when a student first finishes, so the Users page shows them Completed and the onboarding page can show when they finished. |
| `hardware_alerts_sent` (existing) | `onboarding-finished:<course>:<student>` so the waitlist add and #student-hardware post happen once. `internet:<plan>:<date>` for monthly Comcast NOW reminders. |
| `hardware_student_needs` | One row per student: `laptop` (`needs`/`own`), `wifi` (`none`/`comcast_now`/`booster`/`hotspot`), `updated_by`, `updated_at`. No row = needs a laptop, wifi None. |
| `hardware_shipments` | `student_id`, `device_ids` uuid[], `carrier` (`usps`/`ups`/`fedex`/`other`), `tracking_number`, `shipped_on`, `received_at`/`received_by` (I got it, or staff), `notes`, `created_by`. No addresses. |
| `hardware_internet_plans` | Comcast NOW plans: `student_id`, `provider`, `account_number`, `monthly_cost`, `starts_on`, `ends_on`, `notes`. Monthly reminder on the start day of the month. |

All new tables: RLS on with staff-only SELECT; every write goes through role-checked server actions with the service client (students' own rows are read the same way, filtered to their own id).

## Phases

### Phase 1 — Enrollment Readiness courses and finishing
**Status (2026-11-25): committed on `claude/feat/new-student-onboarding`.** Migration not applied yet.
- Migration (whole feature) `20261125000000_new_student_onboarding.sql`, which also checks the box on *Enrollment Readiness (2027)* and turns off "counts" on its *Receiving Your Laptop*.
- Checkbox on New Course and on the instructor General Info page (next to Paid Learners).
- Student sidebar trimmed and hidden pages redirected. Syllabus button hidden.
- "Counts toward finishing" toggle in the assignment editor (ER courses only).
- Pure rules in `src/lib/onboarding.ts` (tested): per-assignment status, progress, finished.
- Finishing check after `saveGrade`, `markCompleteNoSubmission` and `undoNeedsRevision`, and again whenever the onboarding page loads (catches excused work).
- Student Course Outline: progress bar ("6 of 8 complete"), then a congratulations card with the three Codecademy links (Learn HTML / CSS / JavaScript) and the note that class starts HTML in week 3.
- Cutting Edge audiences and the check-in course list skip ER courses.

### Phase 2 — New Student Onboarding page
**Status (2026-11-25): committed.**
- Dashboard card → `/instructor/onboarding` (instructor/staff/admin).
- Cohort picker (ER courses, current first). Filters: Invited / In progress / Done / Moved on. "Needs you" strip: work to mark complete, finished but not shipped, Comcast NOW to set up.
- One row per student: progress, to mark complete, laptop and wifi choices, equipment status, next course.
- Student checklist page `/instructor/onboarding/[courseId]/students/[userId]`: every assignment with status and due date (not yet due included), **Mark complete** for turned-in and check-off work, links to the grader.

### Phase 3 — Hardware: needs, shipping, Comcast NOW
**Status (2026-11-25): committed.** Also on Hardware → Needs attention: "Comcast NOW billing soon" (next 3 days) and "Shipped, not confirmed" (7+ days).
- Laptop and Wifi choices on the onboarding page and the Hardware student page. Changing them after a student has finished updates their waitlist entries.
- **Ship** form (onboarding row and Hardware student page): in-stock device(s) or ones already loaned, carrier, tracking number, date → loans, shipment, history events, student bell + Slack DM + email.
- Tracking links: USPS, UPS, FedEx. Staff can also mark a shipment arrived.
- Comcast NOW plan card (set up, edit, end) and a monthly reminder in #student-hardware from the daily hardware job.
- My Equipment: "Finish your Enrollment Readiness tasks…", "We're preparing to ship your laptop", shipped with tracking link and **I got it**, and the wifi choice.

### Phase 4 — Moving on to TCF
**Status (2026-11-25): committed.** One PR for all four phases.
- Next course picker on the onboarding page (TCF courses first). **Add N finished students** enrolls those not already in it.
- Rows show "In Tech Career Foundations (…)" once they're there.

## Not doing (for now)
- No automatic enrollment into TCF.
- The student top-nav **Tools** menu (Weekly Readiness, Attendance Portal) still shows for Enrollment Readiness students.
- The weekly instructor Slack report isn't changed (staff-facing).
