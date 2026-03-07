# Accessibility (A11y) Guide

This document covers every accessibility feature implemented in AC-LMS, why it exists, and how it works.

---

## Table of Contents

1. [Skip Link](#1-skip-link)
2. [Focus Management on Route Changes](#2-focus-management-on-route-changes)
3. [Focus Trap in Modals and Dialogs](#3-focus-trap-in-modals-and-dialogs)
4. [Semantic HTML Landmarks](#4-semantic-html-landmarks)
5. [Navigation Labels](#5-navigation-labels)
6. [Keyboard Navigation](#6-keyboard-navigation)
7. [Drag-and-Drop Keyboard Support](#7-drag-and-drop-keyboard-support)
8. [Rich Text Editor Toolbar](#8-rich-text-editor-toolbar)
9. [ARIA Live Regions](#9-aria-live-regions)
10. [Dialog / Modal ARIA](#10-dialog--modal-aria)
11. [Form Accessibility](#11-form-accessibility)
12. [Button and Icon Labels](#12-button-and-icon-labels)
13. [Accordion / Expandable Sections](#13-accordion--expandable-sections)
14. [Status Badges](#14-status-badges)
15. [Reduced Motion](#15-reduced-motion)
16. [Unsaved Changes Warning](#16-unsaved-changes-warning)
17. [Focus Ring Styles](#17-focus-ring-styles)
18. [User Accessibility Settings](#18-user-accessibility-settings)

---

## 1. Skip Link

**File:** `src/app/layout.tsx`

A visually hidden link at the very top of every page that becomes visible when focused. Allows keyboard users to jump past the navigation directly into main content.

```html
<a href="#main-content" class="sr-only focus:not-sr-only ...">
  Skip to main content
</a>
```

The link targets `id="main-content"` on the `<main>` element of every page. Without this, keyboard users must Tab through the entire nav on every page load and route change.

---

## 2. Focus Management on Route Changes

**Files:** `src/components/ui/FocusResetter.tsx`, `src/app/layout.tsx`, all page files

In a single-page app, navigating between routes doesn't reload the page, so focus stays wherever it was — often on a nav link deep in the sidebar. Screen reader users would have no indication that the page content changed.

**FocusResetter** is a client component mounted in the root layout that watches `usePathname()` and moves focus to `#main-content` whenever the route changes:

```tsx
useEffect(() => {
  document.getElementById('main-content')?.focus()
}, [pathname])
```

For this to work, every `<main>` element needs:
- `id="main-content"` — the target
- `tabIndex={-1}` — allows programmatic focus without adding it to the tab order
- `focus:outline-none` — suppresses the browser's default focus ring (the user didn't manually tab here)

All ~28 page files have this pattern:
```tsx
<main id="main-content" tabIndex={-1} className="... focus:outline-none">
```

---

## 3. Focus Trap in Modals and Dialogs

**Files:** `src/hooks/useFocusTrap.ts`, `src/components/ui/Modal.tsx`, `src/components/ui/CalendarPopover.tsx`

When a modal or popover opens, keyboard focus must stay inside it. Without a focus trap, pressing Tab would move focus to elements behind the overlay, which is confusing and inaccessible.

`useFocusTrap` queries all focusable elements inside the container and intercepts Tab/Shift+Tab to cycle within that set. It also saves the previously focused element and restores focus to it when the modal closes.

Focusable elements targeted:
```
button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])
```

The CalendarPopover implements the same pattern inline, also handling Escape to close.

---

## 4. Semantic HTML Landmarks

**Files:** All page files

Screen readers use HTML landmark elements to let users jump between sections of a page without reading everything.

| Element | Role | Usage |
|---------|------|-------|
| `<nav>` | Navigation | Top navs, sidebar navs |
| `<main>` | Main | Primary page content |
| `<aside>` | Complementary | Resizable sidebar |
| `<header>` | Banner | Page headers where applicable |
| `<section>` | Region | Day resources, assignments sections |

Every page has exactly one `<main id="main-content">` element.

---

## 5. Navigation Labels

**Files:** `src/components/ui/StudentTopNav.tsx`, `src/components/ui/InstructorTopNav.tsx`, `src/components/ui/StudentCourseNav.tsx`, `src/components/ui/InstructorCourseNav.tsx`, `src/components/ui/InstructorGlobalNav.tsx`

When multiple `<nav>` elements exist on a page (e.g. top nav + sidebar nav), screen readers need labels to distinguish them. All nav elements have `aria-label`:

```tsx
<nav aria-label="Primary navigation">...</nav>
<nav aria-label="Course navigation">...</nav>
<nav aria-label="Global navigation">...</nav>
```

---

## 6. Keyboard Navigation

**Files:** `src/components/ui/AssignmentEditor.tsx`, `src/components/ui/CalendarPopover.tsx`, `src/components/ui/AddResourceButton.tsx`, `src/components/ui/AddAssignmentButton.tsx`, `src/components/ui/AnswerKeyField.tsx`, `src/components/layout/CourseEditor.tsx`

Interactive elements beyond buttons and links are keyboard-accessible via `onKeyDown` handlers:

- **Enter** — submits forms, adds checklist items, saves inline edits, creates modules/resources
- **Escape** — cancels inline edits, closes modals/popovers, cancels drag operations
- **Tab / Shift+Tab** — cycles focus within modals and dialogs

---

## 7. Drag-and-Drop Keyboard Support

**File:** `src/components/layout/CourseEditor.tsx`

The course editor uses [dnd-kit](https://dndkit.com/) for drag-and-drop reordering of modules, days, assignments, and resources. Keyboard users can fully operate this without a mouse.

**Keyboard controls:**
- **Space / Enter** — pick up or drop the item
- **Arrow keys** — move the item to a new position
- **Escape** — cancel the drag and return the item to its original position

This works because both `DndContext` instances use `KeyboardSensor` with `sortableKeyboardCoordinates`:

```tsx
const sensors = useSensors(
  useSensor(MouseSensor, ...),
  useSensor(TouchSensor, ...),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
)
```

**Screen reader announcements** are configured on both DndContexts:

```tsx
accessibility={{
  screenReaderInstructions: {
    draggable: 'Press Space or Enter to start dragging. Use arrow keys to move. Press Space or Enter to drop, or Escape to cancel.',
  },
  announcements: {
    onDragStart: ({ active }) => `Picked up: ${active.id}.`,
    onDragOver: ({ over }) => over ? `Moving over ${over.id}.` : 'Not over a drop target.',
    onDragEnd: ({ active, over }) => over ? `${active.id} dropped at ${over.id}.` : `${active.id} returned to original position.`,
    onDragCancel: () => 'Drag cancelled.',
  },
}}
```

**Drag handle buttons** have `aria-label` and visible focus rings:

```tsx
<button
  aria-label="Drag module Week 1"
  className="... focus-visible:ring-2 focus-visible:ring-teal-primary focus-visible:rounded"
  {...attributes}
  {...listeners}
>
```

---

## 8. Rich Text Editor Toolbar

**File:** `src/components/ui/RichTextEditor.tsx`

The Tiptap toolbar uses proper ARIA roles so screen readers understand it as a toolbar with toggle buttons.

```tsx
<div role="toolbar" aria-label="Text formatting">
  <button aria-label="Bold" aria-pressed={isBold}>B</button>
  <button aria-label="Italic" aria-pressed={isItalic}>I</button>
  <div role="separator" aria-orientation="vertical" />
  <button aria-label="Heading 2" aria-pressed={editor.isActive('heading', { level: 2 })}>H2</button>
  ...
</div>
```

- `role="toolbar"` — tells screen readers this is a toolbar widget
- `aria-label` — gives each button a meaningful name (replaces `title`)
- `aria-pressed` — announces the current toggle state ("Bold, pressed" vs "Bold, not pressed")
- `role="separator"` — marks the divider lines between button groups

---

## 9. ARIA Live Regions

**Files:** `src/components/ui/AssignmentEditor.tsx`, `src/components/ui/SubmissionForm.tsx`, `src/components/ui/GlobalContentEditor.tsx`, `src/components/ui/PaidLearnersToggle.tsx`, `src/components/ui/AccountForm.tsx`

Dynamic status messages (saves, errors, confirmations) are announced to screen readers via live regions — no user action required to hear them.

| Pattern | Use case | Urgency |
|---------|----------|---------|
| `aria-live="polite"` | Save confirmations, success messages | Waits for user to finish speaking |
| `role="alert" aria-live="assertive"` | Errors, validation failures | Interrupts immediately |
| `role="status" aria-live="polite"` | General status updates | Waits for user to finish speaking |

Examples:
```tsx
// AssignmentEditor — save confirmation
<span aria-live="polite">{saved ? 'Saved ✓' : ''}</span>

// SubmissionForm — error
<p role="alert" aria-live="assertive">{error ?? ''}</p>

// AccountForm — status
<p role="status" aria-live="polite">{msg.text}</p>
```

---

## 10. Dialog / Modal ARIA

**Files:** `src/components/ui/Modal.tsx`, `src/components/ui/CalendarPopover.tsx`

Modals and popovers are marked as dialogs so screen readers announce them correctly and understand their boundaries.

```tsx
// Modal.tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
>

// CalendarPopover.tsx
<div
  role="dialog"
  aria-modal="true"
  aria-label="calendar"
>
```

The trigger button for the calendar also communicates its state:
```tsx
<button
  aria-label="View assignment on calendar"
  aria-expanded={open}
  aria-haspopup="dialog"
>
```

---

## 11. Form Accessibility

**File:** `src/components/ui/AccountForm.tsx`, `src/components/layout/CourseEditor.tsx`, and others

All form fields have visible, programmatically associated labels:

```tsx
<label htmlFor="name">Display name</label>
<input id="name" type="text" ... />
```

Input types are semantic:
- `type="email"` for email fields
- `type="password"` with `autoComplete="current-password"` / `autoComplete="new-password"`
- `minLength={8}` enforced on password fields

All inputs have focus ring styles:
```tsx
className="focus:outline-none focus:ring-2 focus:ring-teal-primary"
```

Disabled buttons communicate state visually:
```tsx
className="disabled:opacity-50 disabled:cursor-not-allowed"
```

---

## 12. Button and Icon Labels

**Files:** Various components

Icon-only buttons and buttons with ambiguous visual labels all have `aria-label` so screen readers can announce them:

| Button | aria-label |
|--------|-----------|
| Modal close (×) | `"Close"` |
| Delete assignment | `"Delete assignment"` |
| Delete checklist item | `"Delete item"` |
| Delete resource | `"Delete resource"` |
| Delete day / module | `"Delete day [name]"` / `"Delete module [title]"` |
| Remove cohort / break / holiday | `"Remove cohort"`, `"Remove break"`, `"Remove holiday"` |
| Delete task | `"Delete task"` |
| Resource star | `"Star this resource"` / `"Remove star"` |
| Resource read toggle | `"Mark as read"` / `"Mark as unread"` |
| Sidebar toggle | `"Collapse sidebar"` / `"Expand sidebar"` |
| Drag handles | `"Drag module [title]"`, `"Drag day [name]"`, etc. |
| Mobile menu (hamburger) | `"Open menu"` with `aria-expanded` toggled |

Delete and remove actions use a trash can SVG icon rather than ×. Close and dismiss actions (modals, popovers) keep the × character. This visual distinction reduces the risk of accidentally deleting instead of closing.

The sidebar toggle also uses `aria-expanded` to communicate its state:
```tsx
<button aria-label="Collapse sidebar" aria-expanded={!collapsed}>
```

Decorative icons (chevrons, etc.) are hidden from screen readers:
```tsx
<ChevronIcon aria-hidden="true" />
```

---

## 13. Accordion / Expandable Sections

**File:** `src/components/ui/GeneralInfoSections.tsx`

Section toggle buttons communicate expanded/collapsed state and which element they control:

```tsx
<button
  aria-expanded={!collapsed.has(section.id)}
  aria-controls={`section-body-${section.id}`}
>
  {section.title}
  <ChevronIcon aria-hidden="true" />
</button>
<div id={`section-body-${section.id}`}>...</div>
```

---

## 14. Status Badges

**Files:** `src/components/ui/ResourceOutline.tsx`, `src/components/ui/SubmissionForm.tsx`

Submission and resource statuses are never communicated by color alone — each badge includes a visible text label:

- "Complete ✓" (green)
- "Needs Revision" (red)
- "Turned In" (teal)
- "Late" (amber)
- "Not Started" (gray)

This ensures users who cannot perceive color differences still understand the status.

---

## 15. Reduced Motion

**File:** `src/app/globals.css`

Users who set their OS to reduce motion (for vestibular disorders, epilepsy, etc.) get all transitions and animations disabled:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 16. Unsaved Changes Warning

**File:** `src/hooks/useUnsavedChanges.ts`

When a user navigates away from a page with unsaved changes, a browser confirmation dialog appears. This prevents accidental data loss, which is especially important for users who may accidentally trigger navigation.

---

## 17. Focus Ring Styles

**Files:** All interactive components

Every interactive element shows a visible focus ring when focused via keyboard. The project uses Tailwind's `focus-visible:` variant so rings only appear during keyboard navigation (not on mouse click):

```tsx
className="focus-visible:ring-2 focus-visible:ring-teal-primary focus-visible:rounded"
```

`focus-visible` (vs `focus`) means mouse users won't see the ring, but keyboard users always will. This follows the WCAG 2.4.7 (Focus Visible) success criterion.

---

## 18. User Accessibility Settings

**Files:** `src/components/ui/AccessibilitySettings.tsx`, `src/app/account/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`

Users can customize three display settings from the **My Account** page, under the Accessibility panel. All settings persist across sessions via `localStorage` and are restored instantly on every page load with no flash of unstyled content.

### Dyslexia-Friendly Font

Switches the entire site to [OpenDyslexic](https://opendyslexic.org/), a typeface designed to improve readability for people with dyslexia. The font is loaded via CDN `@font-face` and applied with `!important` to override all other font rules.

Toggling adds/removes the `dyslexic` class on `<html>`:

```css
html.dyslexic,
html.dyslexic body,
html.dyslexic * {
  font-family: 'OpenDyslexic', sans-serif !important;
}
```

### Dark Mode

Switches to a dark color scheme to reduce eye strain in low-light environments. Implemented by directly setting CSS custom properties on `document.documentElement` via JavaScript, which guarantees overrides work regardless of stylesheet specificity:

```ts
root.style.setProperty('--color-background', '#120d1e')
root.style.setProperty('--color-surface', '#1e1530')
// ... all theme variables
document.body.style.setProperty('background-color', '#120d1e', 'important')
document.body.style.setProperty('color', '#f0eaf8', 'important')
```

The `theme-dark` class is also added to `<html>` for CSS rules that need to target it (button text colors, component-specific overrides). Dark mode and high contrast are mutually exclusive — the high contrast toggle is disabled when dark mode is active.

### High Contrast

Maximizes contrast throughout the site by overriding CSS custom properties to use near-black text on white backgrounds and deeper accent colors:

```css
html.high-contrast {
  --color-dark-text: #000000;
  --color-muted-text: #111111;
  --color-background: #ffffff;
  --color-teal-primary: #4a0040;
  /* ... */
}
```

### Flash-Free Restore

An inline `<script>` in `src/app/layout.tsx` runs synchronously before React hydration, restoring all three settings on every page load before the browser paints:

```html
<script>
  try {
    var r = document.documentElement, b = document.body;
    if (localStorage.getItem('dyslexic-font') === 'true') r.classList.add('dyslexic');
    if (localStorage.getItem('high-contrast') === 'true') r.classList.add('high-contrast');
    if (localStorage.getItem('dark-mode') === 'true') {
      r.classList.add('theme-dark');
      // apply all CSS variable overrides...
    }
  } catch(e) {}
</script>
```

`suppressHydrationWarning` on `<html>` prevents React from stripping the classes added by this script during hydration.

---

## Relevant WCAG Success Criteria Covered

| Criterion | Level | Feature |
|-----------|-------|---------|
| 1.3.1 Info and Relationships | A | Semantic HTML, labels, roles |
| 1.3.3 Sensory Characteristics | A | Status badges use text, not color only |
| 1.4.3 Contrast (Minimum) | AA | Teal/dark-text color palette |
| 2.1.1 Keyboard | A | All interactions keyboard-operable |
| 2.1.2 No Keyboard Trap | A | Focus trap cycles within modals, never locks |
| 2.4.1 Bypass Blocks | A | Skip link |
| 2.4.3 Focus Order | A | Logical tab order, focus management on route changes |
| 2.4.7 Focus Visible | AA | Focus rings on all interactive elements |
| 3.2.1 On Focus | A | No unexpected context changes on focus |
| 3.3.1 Error Identification | A | `role="alert"` for errors |
| 3.3.2 Labels or Instructions | A | All form fields labeled |
| 4.1.2 Name, Role, Value | A | `aria-label`, `aria-pressed`, `aria-expanded`, `aria-live` |
| 4.1.3 Status Messages | AA | `aria-live` regions for dynamic status |
| 1.4.4 Resize Text | AA | User-selectable dyslexia-friendly font, 22px base font size |
| 1.4.6 Contrast (Enhanced) | AAA | High contrast mode for near-black on white |
| 1.4.12 Text Spacing | AA | OpenDyslexic improves letter/word spacing for affected users |
