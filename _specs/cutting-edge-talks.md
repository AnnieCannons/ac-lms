# Spec for cutting-edge-talks

branch: claude/feature/cutting-edge-talks

figma-component (if used): n/a

## Summary
Cutting Edge Talks are guest-speaker events that currently live as an "Upcoming Cutting Edge Talks" module copied into every course. The copies drift out of sync: for example, Maya Holikatti's talk is "TBD" in TCF but "Oct 2" in Practicum and Advanced Frontend, and the Nov 6 speaker is "[Speaker]" in two courses but "Kate Smith" in a third.

This feature replaces them with one global Cutting Edge Talks section in the left sidebar, maintained in a single place. Dawn (career development, `admin` role) manages it. Staff create events; students see the events for their class and RSVP. Each event owns two lightweight, checkbox-completion assignments:

- **Submit Your Question in Advance**: required for students who RSVP Yes.
- **Say Thank You & Build Bridges**: required after the event for students who RSVP'd Yes. It includes an "I did not make it" option.

A single report page shows RSVPs, completions and no-shows, broken down by class. Bell notifications and Slack DMs prompt students to RSVP and remind Yes RSVPs about each assignment.

The existing per-course Cutting Edge modules are left untouched. Nothing is migrated.

## Functional Requirements

### Access and navigation
- Add a "Cutting Edge Talks" item to the instructor global sidebar section, alongside Policies, Calendar, PTO and Benefits.
- Add a "Cutting Edge Talks" item to the student sidebar as a global (not course-specific) item, visible from any student course page.
- Instructors, staff and admins can create, edit and delete events and view the report. This includes Dawn, who is an `admin`.
- TAs can view events and the report but cannot create, edit or delete.
- Students can only view events whose audience includes a course they are enrolled in. They can only read and change their own RSVP and completion state.
- Every permission check happens server-side in the server actions and pages, not only in the UI, following the existing per-page and per-action role-check pattern.

### Creating and editing events (staff)
- An event has:
  - title and speaker
  - date and start time, entered and displayed in Pacific time
  - location: a text field, plus an optional link (usually the Focus Friday Zoom link). Events are never at a physical address.
  - "About" rich text
- Audience defaults to all students in currently active courses, using the same rule as the "Current" course badge (start date + 105 days).
- Staff can instead limit an event to specific courses. Example: the apprentices-only Practicum talk.
- When an event is created, its two assignments are created automatically from templates. The templates use the current wording of the existing "Submit Your Question in Advance" and "Say Thank You & Build Bridges" assignments.
- Each assignment has its own Padlet link: one for questions, one for thank-yous. Links are never shared between events (each event is a different speaker). The create form prompts for both links but allows saving without them. They can be added later. The event list and event page show a clear "Padlet link missing" indicator to staff until each link is set.
- Staff can edit each assignment's text, Padlet link and due date per event.
- Default due dates, both editable:
  - Submit Your Question: 7 days before the event.
  - Say Thank You: 7 days after the event.
- Events can be edited after publishing. Changes appear for every student immediately because there is a single source of truth.
- Events start as drafts. Staff publish an event when it's ready; only published events are visible to students. An event can be unpublished back to draft.
- Events can be deleted. Deleting is a soft delete, consistent with the rest of the app.

### Student experience
- Students see a list of upcoming events and a list of past events. Past events stay visible indefinitely. Draft events are never shown to students. Each shows date and time (Pacific), speaker, location text and link, and the "About" text.
- Students RSVP Yes or No. They can change their RSVP any time up until the event's start time.
- After the event starts, RSVPs are locked. A student who said Yes but could not attend uses the "I did not make it" option on the thank-you assignment instead.
- RSVP-ing Yes takes the student straight to that event's Submit Your Question assignment.
- The Submit Your Question assignment shows the instructions and Padlet link, plus a checkbox the student ticks once they've posted. It is required only for Yes RSVPs. Other students can still view it but are never prompted about it.
- After the event, the Say Thank You assignment becomes required for students who RSVP'd Yes. It shows the instructions and Padlet link, a completion checkbox, and an "I did not make it" checkbox. The two checkboxes are mutually exclusive.
- Checking "I did not make it" excuses the student from the thank-you. They are never shown as missing. On the report they count as "said Yes, missed."
- These event assignments never appear in course gradebooks, missing/late counts, readiness scores or course assignment lists.

### Report page (staff and TAs)
- One page covers all events, with a per-event drill-down.
- It can be filtered by class (course). Each event's numbers can be broken down by class.
- For each event it shows:
  - RSVP counts: Yes, No, and no response
  - who completed Submit Your Question
  - who completed Say Thank You
  - who RSVP'd Yes but checked "I did not make it"
  - who RSVP'd Yes but did neither after the thank-you due date
- A student enrolled in more than one active course is grouped under their current course.
- The report is read-only; staff cannot change a student's RSVP or completion.
- No export is needed.

### Notifications
Each notification is both a bell notification and a Slack DM. Slack DMs use the existing email-based Slack lookup.
- **New event published:** an RSVP prompt goes to every student in the event's audience the first time the event is published (not on later edits or re-publishing).
- **Question reminder:** goes out at 8:30am Pacific, 2 days before the question due date, only to Yes RSVPs who haven't checked off Submit Your Question.
- **Thank-you reminder:** goes out at 8:30am Pacific the morning after the event, only to Yes RSVPs who haven't completed the thank-you or checked "I did not make it."
- Anyone who has already completed the relevant item is skipped.
- Each reminder is sent at most once per student per event, even if the scheduled job runs more than once.
- If a student has no Slack match, they still get the bell notification, and the failure does not block anyone else's notifications.

### Data
- New tables hold events, event audience (course limits), event assignments, RSVPs and per-student completion state.
- Each new table follows the repo's migration conventions: written to run safely more than once, RLS enabled, a policy per operation, explicit grants to `anon`, `authenticated` and `service_role`, and staff-role policies included.
- Any query for "all students" or "all RSVPs" uses the existing pagination helper so it isn't cut off silently at 1,000 rows.

## Possible Edge Cases
- A student changes Yes to No before the event after already checking off their question. They stop being prompted. Their question completion is kept but no longer counts as required.
- A student tries to RSVP after the event start time. The server rejects it, not just the UI.
- A student enrolls in an active course after the event was posted. They should see the event and be able to RSVP, but no retroactive "new event" notification is needed.
- An event's audience is changed after RSVPs exist. Students who are no longer in the audience lose access. Their existing RSVPs stay visible on the report, marked as outside the audience.
- An event's date is moved after the reminders are scheduled. Reminders follow the new date and due dates, and already-sent reminders are not sent again.
- The question due date has already passed when the event is created, or is less than 2 days away. The reminder goes out immediately or is skipped, never sent for a past date.
- A Padlet link is still missing when a reminder goes out. The reminder links to the event page rather than a broken Padlet link.
- A student RSVPs Yes and checks both "completed" and "did not make it." This is prevented by mutual exclusivity.
- The event time crosses a daylight saving change. Times are stored as real points in time and always displayed in Pacific.
- An event is limited to a course that later stops being "current." It still shows for that course's students.
- An event is deleted after RSVPs exist. It is hidden from students and its scheduled reminders are cancelled.
- A TA tries to call a create or edit action directly. It is rejected server-side.
- A student in preview mode (an instructor viewing as a student) RSVPs or checks a box. Their actions must not create real student RSVP or completion records, or follow the existing preview-mode convention.

## Acceptance Criteria
- "Cutting Edge Talks" appears in the instructor global sidebar section and in the student sidebar on every course page.
- Dawn can create an event with title/speaker, date, Pacific time, location text and link, and About text. The two assignments are created from the existing wording, with due dates defaulting to 7 days before and 7 days after.
- Dawn can save an event as a draft (invisible to students, no notifications) and publish it later; publishing sends the RSVP prompt once.
- Dawn can save an event without Padlet links, sees a "Padlet link missing" indicator, and can add the links later.
- By default, an event is visible to students in all current courses. When limited to specific courses, only students in those courses see it.
- A student can RSVP Yes or No and change it until the event starts. After that, RSVP controls are locked and the server rejects changes.
- RSVP-ing Yes lands the student on the Submit Your Question assignment for that event.
- After the event, a Yes student sees Say Thank You as required and can check either "done" or "I did not make it," but not both.
- Event assignments do not appear in any gradebook, missing/late count, readiness score or course assignment list.
- The report shows per-event RSVP counts, question and thank-you completions, and Yes-but-missed students. It can be filtered and broken down by class.
- The report is read-only for everyone.
- TAs can see events and the report but cannot create, edit or delete. Students cannot see events outside their audience.
- New-event, question-reminder and thank-you-reminder notifications arrive as bell notifications and Slack DMs. They go only to the right students, only once, and skip anyone who has already completed the item.
- Existing per-course "Upcoming Cutting Edge Talks" modules are unchanged.

## Open Questions
- Should past events stay visible to students indefinitely, or only for events whose audience included their course?
  - **Answer:** Yes — past events stay visible indefinitely (still limited to events whose audience included the student's course).
- Should the report be exportable (for example as CSV) for Dawn's own tracking?
  - **Answer:** No.
- Should staff be able to see and edit an individual student's RSVP or completion, for example to mark someone as attended?
  - **Answer:** Yes.
  - **Update:** Overrides were removed — the report is read-only. Students' own RSVPs and checkboxes are the only source.
- What time should the "morning after" thank-you reminder go out (9am Pacific suggested), and should the question reminder go out at the same hour?
  - **Answer:** 8:30am Pacific, for both reminders.
- Should the "new event" notification be sent the moment an event is saved, or should events have a draft/published state so Dawn can prepare one before announcing it?
  - **Answer:** Yes — events have a draft/published state; the "new event" notification goes out when an event is first published.
- Are Padlet links shared across events?
  - **Answer:** No — every assignment on every event has its own Padlet link (different speaker each time).

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- Audience resolution: default "all current courses" vs. course-limited events, and which students are included.
- RSVP rules: can change before the event start, rejected after.
- Required-ness: the question is required only for Yes RSVPs; the thank-you is required only for Yes RSVPs and only after the event.
- Thank-you state: "done" and "did not make it" are mutually exclusive, and "did not make it" is never counted as missing.
- Reminder recipient selection: question and thank-you reminders skip No RSVPs and students who already completed or were excused, and don't send twice.
- Default due date calculation: 7 days before and after the event, in Pacific time, including across a daylight saving boundary.
- Report aggregation: RSVP counts, completions and Yes-but-missed, grouped by class.
- Permission checks: TAs and students are rejected from create, edit and delete actions.
- Draft events are excluded from student views and from notifications; first publish sends the RSVP prompt exactly once.
