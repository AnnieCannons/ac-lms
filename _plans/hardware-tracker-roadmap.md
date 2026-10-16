# Hardware Tracker — Phased Roadmap

## Context
Replace the scattered hardware spreadsheets and the "Student Hardware" Airtable base with one place in the LMS to track the loaner equipment AnnieCannons gives students: laptops, hotspots and wifi boosters. It should be easy to see who has what, what is owed back, when hotspot subscriptions renew, and the full history of every device. It should also prompt staff when a student leaves, so nothing slips.

The Airtable base has these tables today: Students, Hardware Replacements, Hardware Inventory, Hardware Assignments, Hardware Incidents (plus some hidden ones). **We start fresh rather than importing them:** every current student fills out the launch survey, and staff bulk-add the devices sitting in stock. The Airtable base stays only for the Equipment Support Form, because that form collects shipping addresses.

Built as a phased rollout like Confidence Tracker v2. Each phase ships and can be checked on its own.

## Decisions so far (from Catie, 2026-10-16)
- **Who:** any staff/instructor/admin can view and edit. TAs and students have no access to the tracker. Students see a read-only "My Equipment" view of their own items.
- **Where:** its own global page, `/instructor/hardware`, linked from `/instructor`. Not per course: a device follows a person across courses.
- **Laptops:** loaned at first. Once an instructor has marked the student as having completed **both** Tech Career Foundations **and** Intro to Programming (see Course completion), the student shows up on a **Ready to transfer** list. Staff click "Transfer ownership" to change the laptop from loaned to student-owned. It's never automatic. Owned laptops are still tracked and still count toward replacements.
- **Course completion (wanted anyway):** an instructor marks a student as having completed a course. A "Completed" badge then shows next to their name in that course and on `/instructor/students`. TCF and ITP are separate courses taught in the same trimester.
- **Replacements:** one laptop and one charger per student, ever. The old one should be shipped back. There's an exception for lost/stolen/damaged beyond repair, which is recorded with a reason. Chargers have no serial numbers, so a charger replacement is just an event on the student (date, note, old one returned yes/no).
- **Hotspots:** loaned, returned when the student stops or graduates, then go to the next student. Track IMEI **and** phone number/ICCID. One subscription per device, with carrier, plan, start date, end date, cost, and account/line number. Renewal alert **45 days** before end, as a bell notification to Catie plus a post in **#student-hardware**.
- **Boosters:** always on loan, returned on stop/graduation, then go to the next student. No manufacturer numbers, so the LMS gives them IDs (`BOOST-014`) to print on a label.
- **Statuses:** in stock · on loan · owned by student · awaiting return · received · **needs prep** (wipe and check before it goes out again) · needs repair · lost · retired.
- **Awaiting return:**
  - The student is reminded **48 hours** after it's marked, again **5 days** later, then **every 7 days** until it's received.
  - Each reminder goes to the student's **Slack DM, email and LMS bell**.
  - At **60 days** the item moves to "Likely lost", and staff **click to confirm** it as lost. Reminders stop on receipt or on confirmed lost.
- **Student leaves:** removing someone from a course, or changing them to observer, shows a prompt listing their loaned items with a one-click "Mark as awaiting return" and a link to their tracker page.
- **Graduation:** the LMS can't detect it reliably, so a reminder to go through and mark graduates is posted in #student-hardware at each trimester break. Break dates come from the existing `calendar_breaks` table (edited on the PTO page under General Info); the reminder posts on each break's start date.
- **Slack:** every staff-facing Slack alert (renewals, new tickets, ticket nudges, graduate review) goes to one channel, **#student-hardware**, not to DMs. The channel is **#student-hardware**, ID **`C0ABALJLBFU`** (given by Catie 2026-10-16); set `SLACK_HARDWARE_CHANNEL=C0ABALJLBFU` (Vercel + `.env.local`), posting by ID so a rename doesn't break it. If the channel is private, the LMS bot has to be invited by hand or the posts fail (same as the weekly report). Reminders to *students* are DMs.
- **Marking received:** search by **student name** and record condition notes.
- **Launch survey:** in the LMS, not Airtable. Staff choose which courses get it and can add individual people.
- **Equipment Support Form (Airtable):**
  - The address stays in Airtable. The LMS gets the issue without the address and turns it into a ticket.
  - The ticket has a status and is linked to the student/device.
  - The form gets an **Email** field so the ticket can be matched to the student.
  - An open ticket nudges #student-hardware after **48 hours**.
- **Buying new laptops:** about 20 at a time, 3 times a year, usually all the same model, year and condition (e.g. refurbished). **Bulk-add** takes the shared details once plus a pasted list of serial numbers.
- **Waitlist** for a hotspot/booster/laptop: staff-only for now.

## Data model (draft)
All new tables are prefixed `hardware_`, except `course_completions`, which isn't hardware-specific. Each follows the house shape: table → indexes → RLS (staff/instructor/admin; students `SELECT` only their own rows where noted) → grants.

| Table | Purpose |
|---|---|
| `course_completions` | Course, student, `completed_at`, `marked_by`, optional note. One row per student per course. Students can read their own rows. |
| `hardware_purchase_batches` | One row per purchase: date, vendor, make/model, **model year**, condition (new / refurbished), unit cost, warranty end, count, notes. |
| `hardware_devices` | One row per physical laptop/hotspot/booster: `kind`, `asset_tag` (LMS ID such as `LAP-031`/`HOT-007`/`BOOST-014`), `serial_number`, `imei`, `iccid`, `phone_number`, `make_model`, `model_year`, `condition`, `purchase_batch_id`, `status`, `current_holder_id` (user), `owned_by_student` (bool), `notes`. Batch fields are copied onto each device so one can be corrected later. No addresses anywhere. |
| `hardware_events` | Append-only history per device (and per student for chargers): `type` (added, shipped, received, prepped, ownership_transferred, marked_awaiting_return, reminder_sent, marked_lost, repaired, retired, replaced, note, ticket_opened…), actor, timestamp, condition/notes, related student. This is what "device history" shows. |
| `hardware_subscriptions` | Hotspot plans: device, carrier, plan, start, end, cost, account number, line number, `renewal_alerted_at`. A new row at each renewal keeps the old ones as history. |
| `hardware_replacements` | Student, `kind` (laptop / charger), date, old device (null for a charger), new device, `old_returned` / `write_off_reason`. Allows one of each per student; going over needs an override note. |
| `hardware_return_requests` | One open request per loaned device being chased: device, student, `requested_at`, `next_reminder_at`, `reminder_count`, `closed_at` / `closed_reason` (received, lost). Drives the 48h → 5d → weekly schedule. |
| `hardware_tickets` | From the Airtable form: email as submitted, student (matched), device (if known), equipment type, issue, extra info, Airtable record ID/URL (where the address lives), status (open → in progress → replacement shipped → resolved), `last_activity_at`. |
| `hardware_waitlist` | Student, kind needed, added by, added at, fulfilled at. |
| `hardware_surveys` / `hardware_survey_recipients` / `hardware_survey_responses` | Launch survey campaigns, who it was sent to, and answers (laptop serial, hotspot IMEI/phone, has booster). |

## Phases

### Phase 1 — Device registry and history
**Status (2026-10-16): built on `claude/feat/hardware-tracker-phase1`, not merged.** Migration `20261016000001_hardware_tracker.sql` (purchases, devices with auto asset tags, events). Pages under `/instructor/hardware`: Devices / Students / Needs attention tabs, add one device, add a purchase (paste serials → review → add), purchase page, device page (edit, status, notes, history), student page, printable labels. Unit tests in `tests/hardware*.test.ts`. Replacement counts move to Phase 3 with the replacements table. Migration applied 2026-10-16; checked in the browser by Catie (a test purchase of 3 laptops with model `test`). Hardware is a standalone area reached from the `/instructor` dashboard card, with no Global Templates sidebar. Purchases require everything except warranty and notes.

Cleanup for the test devices (run before real data goes in): delete `hardware_devices` where `make_model = 'test'` (events cascade), delete their now-empty purchases, then `setval(..., 1, false)` each tag sequence that has no devices left so real tags start at 001.

- `/instructor/hardware` with tabs: **Devices**, **Students**, and **Needs attention** (empty for now).
- Add a device by hand, or **bulk-add a purchase batch**: fill in model, year, condition, vendor, date, cost and warranty once, then paste the serial numbers (one per line). The page shows a preview that flags duplicates and serials that already exist, and creates them all with asset tags plus a printable label sheet (also used for booster IDs).
- Device page: details, current holder, full history timeline, add a note.
- Student page (`/instructor/hardware/students/[userId]`): everything they have or had, plus replacements used (laptop 0/1, charger 0/1).
- Search everywhere by student name, serial, IMEI, phone number or asset tag.

### Phase 2 — Course completion
**Status (2026-10-16): built on `claude/feat/course-completion`; migration `20261016000002_course_completions.sql` applied and in use with real data.** If the table can't be read, the Users, Roster and Students pages still load (no badges). A "Completed" checkbox column (saves instantly, unchecking asks to confirm) lives on the course Users page only (instructors, staff and admins; TAs can't open that page), for students only. The badge shows on Users, Roster and `/instructor/students`. Action tests in `tests/course-completion-actions.test.ts`.

- A "Mark completed" action for each student on the course's Users/Roster pages, with an undo. Instructors/staff/admin only.
- A "Completed" badge next to the student's name in that course's lists and on `/instructor/students` (naming which course).
- Useful outside hardware too, so it ships as its own small piece.

### Phase 3 — Loans, returns and ownership
Split into two PRs (decided 2026-10-16):
- **3a — loans and returns. Committed on `claude/feat/hardware-loans` (no PR yet: Catie wants one bigger PR for 3a + 3b to save CI/compute).** Migration `20261016000003_hardware_return_requests.sql` (applied 2026-10-16) (one open request per device; first reminder time set 48 hours out for the later reminder cron). Device page: loan an in-stock device to a student (name search), mark awaiting return, "no longer needed back", mark lost, mark received. Student page: mark everything on loan awaiting return in one click, and the receive form. New **Mark received** page (`/instructor/hardware/receive`): find the student, tick what came back (all ticked by default), condition notes, next status (needs prep / in stock / needs repair). Needs attention: Likely lost (60+ days, confirm), Awaiting return (days waiting), Needs prep ("Wiped and checked"), Needs repair.
- Device page redesign (2026-10-16): header card with model · year · condition and a **Status dropdown** that only offers valid next steps (`statusChoices`), each opening a small form; Details read-only with Edit in the card header; History card with Add note.
- UX pass (2026-10-16, same branch): every hardware page has a section bar (Devices · Students · Needs attention · Waitlist · Mark received); Needs attention has count tiles and only shows non-empty sections; Mark received is a two-step page whose confirmation lives in the URL; student page has "Loan a device"; in-stock devices explain "change the status to On loan". **Labels** print on the standard 1" × 2-5/8", 30-per-sheet grid (Avery 5160 laser / 8160 inkjet / Amazon Basics equivalent), with "start at label N" for partly used sheets and buying/printing tips on the page; the Devices list has checkboxes, "Print labels for N selected" (up to 150) and "Print labels for all shown" (uses the filters).
- **3b — ownership, replacements and waitlist. Committed on the same branch (2026-10-16); one PR planned for 3a + 3b + 4.** Migration applied. Migration `20261016000004_hardware_ownership_replacements_waitlist.sql` (`hardware_replacements`, `hardware_waitlist`). **TCF/ITP is read from the course name** (`laptopTrackFromName`: the name must *start* with "Tech Career Foundations" or "Intro to Programming", so "Winter Break ITP Exercises" doesn't count). A per-course setting was built first and dropped on 2026-10-16 after checking that every cohort is named that way; the migration now drops the unused `courses.laptop_track` column. Needs attention → **Ready to transfer** (loaned laptop + completed a TCF and an ITP course) with Transfer ownership; the status dropdown also offers "Owned by student" for any loaned laptop. Student page (now cards): Has now (Mark all awaiting return / Mark received in the header), **Replacements** (laptop 0 of 1, charger 0 of 1; laptop replacement sends an in-stock laptop, owned if the old one was owned, and the old one is chased back or written off as lost / damaged beyond repair; a second one needs an override note), Had before, History. **Waitlist** tab: add a student per device type, first come first served; loaning that type removes them automatically, and an in-stock device's loan form suggests who's waiting.

- Assign a device to a student and mark it shipped. Assigning from the **waitlist** fills that waitlist entry.
- **Mark received**: type a student name, pick the item(s), add condition notes, and choose the next status (needs prep / in stock / needs repair). One screen, a few clicks.
- **Needs prep** list → "Wiped and checked" → in stock.
- **Awaiting return** list showing days waiting. At 60 days items move to "Likely lost" for a one-click confirm.
- **Ready to transfer** list: students with a loaned laptop who have completed both TCF and ITP → "Transfer ownership" (writes an event and sets `owned_by_student`).
- **Replacements**: "Replace laptop" or "Replace charger" on the student page, with "old one coming back" or a write-off reason. Warns if the student has already used their one.

### Phase 4 — Drop prompt
**Status (2026-10-16): committed on `claude/feat/hardware-loans`; PR opened for 3a + 3b + 4.** On the course Users page, removing a student (or an observer) or changing a student to observer calls `getHardwareDropPrompt` afterwards; if they have anything **on loan**, a dialog lists it (all ticked) with "Mark awaiting return" (history note: "Removed from <course>" / "Changed to observer in <course>"), "Open their hardware page" and "Not now". If they're still a student in another current course (e.g. TCF → ITP) it says they probably still need it. The change itself is never blocked. **All Users → delete student** permanently deletes the account, so it now **refuses** while they hold loaned equipment or have an open return (an owned laptop doesn't block it).

- Hook into `removePersonFromCourse`, `updateEnrollmentRole` (→ observer) and `removeStudentUser` in `src/lib/people-actions.ts`. After a successful change, the action returns the student's loaned items, and the users/roster UI shows "Laura has Laptop LAP-031 and Hotspot HOT-007 on loan. [Mark awaiting return] [Open in tracker]".
- Skip the prompt for items the student owns, and when the student is still enrolled as a student in another current course.

### Phase 5 — Student "My Equipment"
**Status (2026-10-16): committed on `claude/feat/hardware-my-equipment`; one PR planned for 5 + 6.** (Phases 3a–4 merged as #206.) "My equipment" card on the student's Profile page (`/account#equipment`): each device with "On loan from AnnieCannons" / "Yours to keep" / "Please send this back", model and year, booster tag hint, replacements available/used, and **Report a problem with my equipment** → the Airtable form with `prefill_Student Email` (needs checking that Airtable interface forms honor the prefill). Amber banner on My Courses when anything is awaiting return, linking to the card. Also a **My Equipment** link in the student course sidebar (under Cutting Edge Talks) → `/student/courses/[id]/equipment`, the same card for the viewed student (nothing in preview), with an orange **Send back** badge while anything is awaiting return (`getMyHardwareReturnCount`, own rows only). Return contact is just "Catie" (students reach her on Slack). Loaded with the service client filtered to the signed-in user's own id, so no new RLS policies were needed. Return instructions (from Catie, 2026-10-16) show when something is awaiting return: use the box it came in (lost box → contact Catie), pack it carefully (student's responsibility), prepaid label from Catie or reimbursement with a receipt. Contact name is `RETURN_CONTACT` in `MyEquipmentCard.tsx`; reuse the same wording in the Phase 7 reminders.

- Read-only card on the student's account page: what they have, loaned vs. owned, and replacements left. If anything is awaiting return, it says what to send back.
- A **Report a problem** button that opens the Airtable Equipment Support Form with their email already filled in (Airtable URL prefill; they can still change it).

### Phase 6 — Launch survey
- Staff create a survey, pick courses, and add extra people. Students get a bell notification and a short form: laptop serial (with "where to find it" help for Mac/Windows/Chromebook), whether they have a hotspot and its IMEI/phone number, whether they have a booster, and **whether their laptop or charger has ever been replaced** (since there's no import, this is how already-used replacements get recorded).
- Alumni who still have a loaned hotspot or booster aren't in a current course, so add them as individual recipients.
- Answers land in a **review queue**. Staff confirm each one, which creates or links the device and sets the holder. Clashes are flagged, such as the same serial claimed twice or a serial already linked to someone else.
- Shows who hasn't answered, with a "nudge" button.

### Phase 7 — Hotspot subscriptions and reminders
- Subscription fields on hotspot pages, and a **Renewals** view sorted by end date.
- Daily cron (`/api/cron/hardware-reminders`, `CRON_SECRET`, same as other crons):
  - Renewal 45 days out → bell to Catie + post in #student-hardware (once per subscription).
  - Return reminders to students due today: Slack DM + email + bell, then schedule the next one (48h → +5 days → every 7 days). Flag requests at 60 days as likely lost (staff confirm).
  - Open tickets with no activity for 48 hours → nudge in #student-hardware (repeats every 48 hours while still untouched).
  - Trimester-break graduate review → post in #student-hardware on the start date of each `calendar_breaks` row.
- Return reminders and ticket nudges can ship earlier, with Phases 3 and 8, if wanted; this phase is just where the shared cron lives.

### Phase 8 — Equipment Support Form tickets
- **Airtable side (Catie):**
  - ~~Add a required **Email** field to the form.~~ **Done 2026-10-16:** field is named **Student Email**, required, with helper text asking for the same email the LMS uses. The form is an Interface form whose source is the **Hardware Replacements** table, so the field is created on that table first and then turned on in the form.
  - Add an automation: "when a record is created → run script". The script (written for you to paste in) sends **only** the email, name, equipment type, issue, other info and record URL.
  - The address never leaves Airtable, so it never reaches the LMS.
- **LMS side:** a new route `/api/webhooks/hardware-ticket` with a shared-secret header checked in constant time (same as the existing `airtable-form-webhook`).
  - The ticket is matched to the student by email. If that email doesn't match an LMS user (e.g. a personal address), the name is tried. If that's unsure, it goes to a "Match this ticket" queue.
  - The form's equipment type (Laptop / Laptop Charger / Wifi Unit / Other) picks the student's matching device when there's only one. "Wifi Unit" covers both hotspots and boosters.
- New ticket → bell to Catie + post in #student-hardware with a direct link to the ticket. The ticket page shows the student, the device and its history, plus a link to the Airtable record for the address.
- Ticket statuses. Resolving a ticket can record a replacement (Phase 3) in the same step.

### No import from Airtable
Decided 2026-10-16: start fresh. The launch survey (Phase 6) covers current students and asks about past replacements; staff bulk-add the devices in stock (Phase 1).

## Open questions
1. **Which breaks count?** `calendar_breaks` has Winter, Spring and Fall Break plus "Holiday Break Week 1/2" rows that overlap Winter Break. Plan: fire once per break period (rows starting within a few weeks of each other count as one), so Winter Break gets one reminder, not three.
