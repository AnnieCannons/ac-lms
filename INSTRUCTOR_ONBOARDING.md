# Instructor Onboarding Guide — AC-LMS

Welcome to the AnnieCannons Learning Management System. This guide walks you through everything you need to know to set up and manage your course, grade student work, and use the platform's tools effectively.

---

## Table of Contents

1. [Logging In](#1-logging-in)
2. [Your Course List](#2-your-course-list)
3. [Creating a New Course](#3-creating-a-new-course)
4. [Building Your Course — Modules & Days](#4-building-your-course--modules--days)
5. [Adding Resources](#5-adding-resources)
6. [Creating Assignments](#6-creating-assignments)
7. [Setting Up General Info](#7-setting-up-general-info)
8. [Grading Student Work](#8-grading-student-work)
9. [Grading Groups](#9-grading-groups)
10. [Roster & Student Details](#10-roster--student-details)
11. [Users — Managing Enrollment](#11-users--managing-enrollment)
12. [Teaching Assistants (TAs)](#12-teaching-assistants-tas)
13. [Student View — Previewing as a Student](#13-student-view--previewing-as-a-student)
14. [Global Templates](#14-global-templates)
15. [Calendar](#15-calendar)
16. [Benefits & Paid Time Off (Paid Learner Courses)](#16-benefits--paid-time-off-paid-learner-courses)
17. [Tips & Common Questions](#17-tips--common-questions)

---

## 1. Logging In

Go to the app URL and log in with your AnnieCannons instructor credentials.

After logging in you will land on the **Courses** page — a list of all your courses.

> If you see a student-facing page instead, check with your admin — your account role may need to be updated.

---

## 2. Your Course List

The Courses page shows all courses you have access to. From here you can:

- Click a course name or **Manage →** to open the **Course Editor**
- Click **+ New Course** to create a new course
- Click **Edit Dates** on any course to set or update the start and end dates using a calendar picker
- Click **Duplicate** to copy a course (with optional date-shifting for due dates)
- Click **Delete** to permanently remove a course

Courses with a matching start date and a 15-week window show a green **Current** badge so you can quickly identify the active cohort.

---

## 3. Creating a New Course

Click **+ New Course** and fill in:

| Field | Notes |
|-------|-------|
| **Course Name** | Full name, e.g. *Advanced Frontend (Jan 2026)* |
| **Course Code** | Short code, e.g. *FE-Jan-2026* |
| **Start Date / End Date** | Optional — used to calculate the current week |
| **Syllabus** | Optional plain-text overview (most content goes in General Info) |
| **Paid Learners** | Check this if students in this course receive employment benefits and PTO |

Click **Create Course**. You will be taken directly to the Course Editor.

> You can update start and end dates any time from the **Courses list** (click **Edit Dates**) or by re-opening the course settings.

---

## 4. Building Your Course — Modules & Days

The Course Editor is the main place where you structure your course content.

### Modules
A **module** represents a week or unit. Each module has:
- A **title** (e.g. *Week 1: Onboarding + Review*)
- An optional **week number**
- A **category** (Syllabus, Career Development, or Level Up Your Skills)
- A **published** toggle — unpublished modules are hidden from students

Click **+ Add Module** at the bottom to create a new one.

### Days
Each module contains **days** (e.g. Monday, Tuesday, Wednesday, Thursday, Assignments). Days hold the resources and assignments for that day.

- Drag and drop days to reorder them within a module
- Drag and drop modules to reorder them within the course

### Publishing
Content is hidden from students until published. Use the **Published / Unpublished** toggle on each module to control visibility. Individual assignments also have their own published toggle.

---

## 5. Adding Resources

Within any day, click **+ Add Resource** to attach learning materials.

| Type | Use for |
|------|---------|
| **Video** | YouTube links, Loom recordings |
| **Reading** | Articles, documentation pages |
| **Link** | Any external URL |
| **File** | Uploaded documents |

Each resource has a **title**, **URL/content**, and an optional **description**. Drag resources to reorder them within a day.

Students can **star** resources to bookmark them and **mark them complete** as they work through the material.

---

## 6. Creating Assignments

Click **+ Add Assignment** within an Assignments day, or click an existing assignment title to open the **Assignment Editor**.

### Assignment Settings

| Setting | Notes |
|---------|-------|
| **Title** | Required |
| **Published** | Toggle to show/hide from students |
| **Submission required** | Turn off for assignments where you check students off directly (no upload needed) |
| **Due date** | Optional — shown to students and used for the "Late" badge |
| **Week number** | Which module week this assignment belongs to |

### Instructions
Use the rich text editor to write the assignment description. You can format text, add lists, headings, and links.

### How to Turn This In
A separate section explaining the submission process — e.g. *"Submit your GitHub repo link below."*

### Checklist
The checklist is your grading rubric. Add items that students must complete to earn a **Complete** grade.

- Click **+ Add item** to create a new checklist criterion
- Each item has a **label** and an optional **description**
- Click **Bonus?** to mark an item as optional (bonus items are shown differently to students)
- Drag items to reorder them
- Click the **×** to remove an item

> Students can check off their own progress before submitting. Your grading responses are tracked separately and determine the final grade.

### Saving
Click **Save changes** to publish your edits. A warning will appear if you try to navigate away with unsaved changes.

---

## 7. Setting Up General Info

The **General Info** page is what students see when they click "General Info" in their sidebar. It's made up of sections you can customize for each course.

Go to your course → click **Info** in the sidebar.

Default sections include:
- **General Class Info** — free-text overview
- **Goals and Outcomes**
- **Daily Class Schedule** — auto-generated from class times
- **Instructor Contact Info**
- **Policies and Procedures** — pulls from the global template
- **Everyday Resources** — links you add per course
- **Computer and Wifi** — pulls from the global template
- **Course Outline** — weekly topic table
- **Yearly Schedule** — live calendar showing cohorts, breaks, and holidays

Click the **pencil icon** on any section to edit it. Click the **eye icon** to publish/unpublish individual sections.

### Paid Learners Toggle
At the top of the Info page there is a **Paid Learners** toggle. Turn this on to enable the Benefits and Paid Time Off pages in the student sidebar for this course.

---

## 8. Grading Student Work

### Viewing Submissions

From any assignment in the Course Editor, click **View Submissions** (or navigate to the assignment and click the submissions link). You will see a list of all enrolled students with their submission status:

| Status | Meaning |
|--------|---------|
| — | Not submitted yet |
| **Turned in** | Submitted, awaiting your review |
| **Complete ✓** | Graded complete |
| **Needs Revision** | Graded incomplete — student should resubmit |

The summary at the top shows counts for Enrolled, Turned In, Needs Grading, and Graded.

### Grading an Individual Submission

Click **Grade →** next to a student's name to open their submission.

On the grading page you will see:
1. **The student's submission** — text, link, or file
2. **Submission history** — all prior versions if they resubmitted
3. **Checklist** — check off each item the student has completed; items the student self-checked are marked with *✓ student*
4. **Grade buttons** — click **Complete** or **Needs Revision** to set the final grade
5. **Comments** — leave feedback; the student will see this and can reply

> Grading is saved immediately when you click Complete or Needs Revision.

### No-Submission Assignments

For assignments where no upload is needed (e.g. a live demo or in-class check-off), the assignment should have **Submission required** turned off. On the submissions list, you will see a **Mark complete** button next to each student's name — click it to check them off directly without navigating to a separate grading page.

### Answer Key

On the submissions list page, you can add an **Answer Key URL** (shown only to instructors) for reference while grading.

### Launch Grader

The **Launch Grader** button in the sidebar opens a modal with three speed-grading modes:

| Mode | What it does |
|------|-------------|
| **By Student** | Work through all ungraded submissions one student at a time |
| **By Assignment** | Work through all ungraded submissions one assignment at a time |
| **All Ungraded** | Grade everything in sequence — assignment by assignment, student by student |
| **Grade for My Group** | Grade only the students assigned to you in Grading Groups |

**Grade for My Group** respects per-assignment overrides: if an assignment has a specific grader set, that grader handles all students for that assignment regardless of group.

---

## 9. Grading Groups

Grading Groups let you divide students among instructors and TAs so each grader is responsible for a specific subset of students.

Go to your course → **Grading Groups** in the sidebar.

### Assigning Students

- **Auto-distribute evenly** — click once to split students as evenly as possible across all available graders
- **Drag and drop** — drag a student card from one grader's column to another, or to the **Unassigned** pile
- Grader cards show how many ungraded submissions each grader currently has

### Rotating Groups

- **Swap Groups ⇄** (2 graders) — swaps the two groups so each grader takes on the other's students
- **Rotate Groups →** (3+ graders) — shifts each grader to the next group in order (A→B→C→A)

Use Swap or Rotate weekly or bi-weekly so all graders get to know each student's code over the course of the term.

### Assignment Overrides

Below the student cards, the **Assignment Overrides** section lets you pin a specific grader to a single assignment. That person grades it for all students, regardless of their group. Leave it as **"Follow student group"** to use the normal group assignments.

---

## 10. Roster & Student Details

The **Roster** page shows all students enrolled in a course, along with any accommodations on file.

### Viewing Accommodations

Each student row displays:
- A **Camera Off** badge (red) if they have a camera-off accommodation
- A **Notes** badge (amber) if there are written accommodation notes — hover to read them

### Editing Accommodations

Click **Edit** at the end of any student row to expand an inline form:
- Toggle the **Camera Off accommodation** switch
- Enter free-text notes in the **Other accommodations / notes** field
- Click **Save** to update

### Student Detail Page

Click a student's name in the roster to open their detail page, which shows:

| Section | Contents |
|---------|---------|
| **Student info** | Name, email, role badge |
| **Last login** | Most recent sign-in date and time |
| **Accommodations** | Camera-off and notes summary |
| **Progress** | Count of complete assignments out of total published |
| **Assignment Breakdown** | Five clickable stat cards: Missing, Late, Needs Grading, Needs Revision, Complete |

Click any stat card to expand the assignment list for that category. Each assignment links directly to the grading page.

---

## 11. Users — Managing Enrollment

The **Users** page manages who is enrolled in your course.

### Current Class tab

Shows all enrolled members (students, TAs, and instructors). From here you can:
- **Remove** a member (trash icon)
- **Change role** — click the role pill to switch between student, TA, and instructor
- **Invite new members** by email (bulk paste emails in the invite box)

### All Users tab

Shows every student across all courses, plus all instructors/admins. Useful for finding students or checking which course someone is in.

### Invitations

Pending invitations (emails sent but not yet accepted) appear in a separate list. You can **Resend** or **Revoke** any pending invitation.

> **Note:** Only admins can assign the admin role. Instructors can manage students and TAs in their own courses.

---

## 12. Teaching Assistants (TAs)

A **Teaching Assistant** is a student who has been given read-only instructor access for a specific course. TAs can grade student work but cannot edit course content, manage users, or access Global Templates.

### Assigning the TA Role

1. Go to your course → **Users**
2. Find the student in the Current Class tab
3. Click their role pill and select **TA**

The student will now see the course in their instructor-style view when they log in.

### What TAs Can Do

- View the full course (modules, days, assignments, resources, quizzes)
- Grade submissions — Complete / Needs Revision
- Leave comments on submissions
- View the Roster (their course only)
- Access General Info, Syllabus, Assignments, Class Resources, Career, Level Up, and Quizzes pages
- Access both instructor and student documentation

### What TAs Cannot Do

- Create, edit, or delete modules, days, assignments, resources, or quizzes
- Manage enrollments or user roles (Users page is blocked)
- Access Global Templates or Grading Groups management
- Duplicate or delete courses

### TA Badge

TAs see a blue **TA** badge in the top navigation bar and in the Courses list, so it's always clear which role they're operating under for that course.

### Employment Section

TAs automatically see a **Benefits** and **Paid Time Off** section in their sidebar under "Employment," regardless of whether the course has Paid Learners enabled.

---

## 13. Student View — Previewing as a Student

You can preview exactly what your students see without creating a separate test account.

1. In the instructor sidebar, click **Student View**
2. You will be taken to the student view of your course with an **amber banner** at the top indicating you are in preview mode
3. You can browse all student pages, click through content, and even test submission flows
4. When you are done, click **Leave Student View** in the amber banner to return to the instructor view

> Any submissions made while in Student View will appear under your own instructor account name in the gradebook — this is fine for testing purposes.

---

## 14. Global Templates

**Global Templates** are shared pieces of content that appear across all courses. Edit them once and every course picks up the change automatically.

Access Global Templates from the top navigation or from the sidebar when viewing a course.

| Template | What it contains |
|----------|-----------------|
| **Computer and Wifi** | Tech setup instructions for students |
| **Policies and Procedures** | School policies and classroom expectations |
| **Benefits** | Healthcare, Vision, and Dental information (paid learner courses) |
| **Paid Time Off** | Holidays and school breaks (paid learner courses) |

### Editing a Template
Click the template name, then click **✎ Edit** on any section. Use the rich text editor to format content. Click **Save changes** when done.

---

## 15. Calendar

The Calendar manages the school-wide schedule that appears on students' General Info → Yearly Schedule section and on the Paid Time Off page.

Access it from **Global Templates → Calendar** in the top nav.

### Cohorts
Add named sessions (Winter, Summer, Fall) with their start and end dates. The current cohort is automatically highlighted for students.

### School Breaks
Add multi-day breaks (e.g. Thanksgiving Week, Winter/Holiday Break) with start and end dates. These appear on the student Yearly Schedule and Paid Time Off pages.

### Holidays
Add individual holidays for each year. Each holiday has:
- **Name** (e.g. *Labor Day*)
- **Display text** (e.g. *Mon, Sep 7*) — exactly as shown to students
- **Date** — used for sorting

Use **Copy to [next year] →** to duplicate the current year's holidays into the next year and then update dates as needed.

> The Calendar is global — changes apply to all courses immediately.

---

## 16. Benefits & Paid Time Off (Paid Learner Courses)

For Advanced courses where students receive employment benefits:

### Enabling for a Course
Go to the course → **Info** → toggle **Paid Learners** on. Students in this course will then see **Benefits** and **Paid Time Off** in their sidebar under an "Employment" section.

### Editing Benefits Content
Go to **Global Templates → Benefits**. Edit the three sections:
- **Healthcare** — health insurance details
- **Vision** — vision coverage
- **Dental** — dental coverage

Content is shared across all paid learner courses.

### Paid Time Off Content
The PTO page shows students:
- All holidays from the current year (from the Calendar)
- All school breaks (from the Calendar)

To update PTO content, go to **Global Templates → Paid Time Off** and edit breaks and holidays there, or go to **Calendar** directly.

---

## 17. Tips & Common Questions

**How do I hide a module while I'm still building it?**
Toggle the module to **Unpublished** using the eye icon. Students won't see it until you publish it.

**A student submitted the wrong thing — can they resubmit?**
Yes. Students can resubmit at any time. All prior versions are saved in their submission history, which you can view on the grading page.

**Can I leave feedback without giving a grade yet?**
Yes — you can add comments on the grading page without clicking Complete or Needs Revision. The student will see your comment and can reply.

**How do I add the same resource to multiple days?**
Resources are currently per-day. Add the resource to each day separately, or use the **Everyday Resources** section in General Info for content that applies to the whole course.

**What's the difference between Checklist and Grade?**
The checklist is your rubric — each item represents a requirement. You check off what the student completed. The **grade** (Complete / Needs Revision) is the final summary you assign after reviewing the checklist and submission. You set it independently by clicking the grade button.

**Can students see my checklist before submitting?**
Yes — students see the checklist items on their assignment page so they know what is expected. They can check off their own progress, but their checks don't affect your grading.

**How do I remove a student from a course?**
Student enrollment is managed by an admin. Contact your admin to add or remove students.

**Why does the Yearly Schedule show old cohort dates?**
Update the cohort dates in **Global Templates → Calendar** → Cohorts section. Changes take effect immediately across all courses.
