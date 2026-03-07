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
9. [Student View — Previewing as a Student](#9-student-view--previewing-as-a-student)
10. [Global Templates](#10-global-templates)
11. [Calendar](#11-calendar)
12. [Benefits & Paid Time Off (Paid Learner Courses)](#12-benefits--paid-time-off-paid-learner-courses)
13. [Tips & Common Questions](#13-tips--common-questions)

---

## 1. Logging In

Go to the app URL and log in with your AnnieCannons instructor credentials.

After logging in you will land on the **Courses** page — a list of all your courses.

> If you see a student-facing page instead, check with your admin — your account role may need to be updated.

---

## 2. Your Course List

The Courses page shows all courses you have access to. From here you can:

- Click a course name to open the **Course Editor**
- Click **+ New Course** to create a new course

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

> You can change all of these settings later on the **Info** page of the course.

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

---

## 9. Student View — Previewing as a Student

You can preview exactly what your students see without creating a separate test account.

1. In the instructor sidebar, click **Student View**
2. You will be taken to the student view of your course with an **amber banner** at the top indicating you are in preview mode
3. You can browse all student pages, click through content, and even test submission flows
4. When you are done, click **Leave Student View** in the amber banner to return to the instructor view

> Any submissions made while in Student View will appear under your own instructor account name in the gradebook — this is fine for testing purposes.

---

## 10. Global Templates

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

## 11. Calendar

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

## 12. Benefits & Paid Time Off (Paid Learner Courses)

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

## 13. Tips & Common Questions

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
