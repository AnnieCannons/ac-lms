# AC-LMS Project Memory

## Project Stack
- Next.js 14 App Router, TypeScript, Tailwind CSS
- Supabase (PostgreSQL + auth + RLS)
- @dnd-kit/core + @dnd-kit/sortable for drag-and-drop
- Deployed to: GitHub `main` branch (AnnieCannons/ac-lms)

## Key Files
- `src/components/layout/CourseEditor.tsx` — All instructor UI (modules/days/resources/assignments/checklist)
- `src/app/instructor/courses/[id]/page.tsx` — SSR page, fetches course + modules (assignments nested)
- `src/app/instructor/courses/page.tsx` — Course list page
- `scripts/import-course.ts` — Import Canvas JSON → Supabase
- `src/data/` — Course JSON files (backend/, frontend/, itp/, tcf/)
- `SCHEMA.md` — Full database schema reference

## Architecture Patterns

### DnD Context Nesting (3 levels)
1. **Outer DndContext** (CourseEditor): handles module reorder, day reorder, cross-day assignment moves
2. **Day-level DndContext** (SortableDay): handles resource reorder within a day
3. **Assignment-level DndContext** (AssignmentCard): handles checklist item reorder within an assignment

### State Management
- `modules` state lives in `CourseEditor` — needed for cross-day assignment drag
- Resources fetched **client-side** in `SortableDay` via `useEffect` (SSR RLS issue with resources table)
- Checklist items fetched **client-side** in `AssignmentCard` via `useEffect` (lazy, only when expanded)
- Assignment CRUD callbacks threaded: CourseEditor → SortableModule → SortableDay → AssignmentDropZone → AssignmentCard

### Cross-Day Assignment Drag
- Assignments use `useDraggable` (not `useSortable`) with data `{ type: "assignment", assignmentId, sourceDayId }`
- Drop zones use `useDroppable` with data `{ type: "day-drop", dayId }`
- `handleDragEnd` in CourseEditor catches `activeData.type === "assignment"` first

## Component Hierarchy
```
CourseEditor
  └── SortableModule (per module)
        └── SortableDay (per day)
              ├── SortableResource (per resource) — within day DndContext
              └── AssignmentDropZone
                    └── AssignmentCard (per assignment)
                          └── SortableChecklistItem (per item) — within assignment DndContext
```

## Supabase RLS Policies Needed
All instructor/admin actions require: `auth.uid()` matches a user with role = 'instructor' or 'admin'

Tables with RLS policies added: resources, assignments
**Still needed**: checklist_items (SELECT, INSERT, UPDATE, DELETE for instructors)

SQL template:
```sql
CREATE POLICY "instructors can SELECT checklist_items" ON checklist_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('instructor','admin'))
  );
-- repeat for INSERT, UPDATE, DELETE
```

## Running Import Script
```bash
source .env.local
npx ts-node --project tsconfig.json -e "$(cat scripts/import-course.ts)" src/data/backend/advanced-backend-assignments.json
# or use ts-node directly:
npx ts-node scripts/import-course.ts src/data/backend/advanced-backend-assignments.json
```

## Courses in DB
- Backend (15 weeks, some assignments with null module_title — add manually via UI)
- Frontend
- ITP (Intro to Programming)
- TCF (title manually changed in JSON to avoid duplicate code)

## Known Issues / Debt
- ~51 backend + ~13 TCF assignments with empty module_title need to be manually placed via UI
- Assignment descriptions from Canvas are raw HTML — shown with dangerouslySetInnerHTML (teacher-only, acceptable for MVP)
- No sanitization on imported HTML descriptions
