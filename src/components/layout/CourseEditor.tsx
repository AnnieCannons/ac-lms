"use client";

import { useState, useEffect, useRef, createContext, useContext } from "react";
import { createClient } from "@/lib/supabase/client";
import RichTextEditor from "@/components/ui/RichTextEditor";
import FileUpload from "@/components/ui/FileUpload";
import { RUBRIC_TEMPLATES, type RubricItem } from "@/data/rubric-templates";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AddAssignmentButton from "@/components/ui/AddAssignmentButton";
import AddResourceButton from "@/components/ui/AddResourceButton";


type Assignment = {
  id: string;
  title: string;
  due_date: string | null;
  description?: string | null;
  how_to_turn_in?: string | null;
  module_day_id: string;
  published: boolean;
  order: number;
};

const DEFAULT_HOW_TO_TURN_IN =
  "<p>Turn in the link to your assignment here. Make sure you have saved your work and granted access to your instructor(s) if necessary.</p>";

function getDefaultDueDate(): string {
  // 11:59 PM PST = 07:59 UTC next day (PST = UTC-8)
  const now = new Date();
  const target = new Date();
  target.setUTCHours(7, 59, 0, 0);
  if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
}

function ChecklistLineEditor({
  items,
  onChange,
}: {
  items: RubricItem[];
  onChange: (items: RubricItem[]) => void;
}) {
  const titleRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setField = (i: number, field: keyof RubricItem, value: string) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  };

  const insertAfter = (i: number) => {
    const next = [...items];
    next.splice(i + 1, 0, { text: "", description: "" });
    onChange(next);
    setTimeout(() => titleRefs.current[i + 1]?.focus(), 0);
  };

  const remove = (i: number) => {
    if (items.length === 1) {
      onChange([{ text: "", description: "" }]);
      setTimeout(() => titleRefs.current[0]?.focus(), 0);
      return;
    }
    const next = items.filter((_, idx) => idx !== i);
    onChange(next);
    setTimeout(() => titleRefs.current[Math.max(0, i - 1)]?.focus(), 0);
  };

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[#a888c8] text-xs shrink-0">☐</span>
            <input
              ref={(el) => { titleRefs.current[i] = el; }}
              type="text"
              value={item.text}
              onChange={(e) => setField(i, "text", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); insertAfter(i); }
                if (e.key === "Backspace" && item.text === "" && item.description === "") {
                  e.preventDefault(); remove(i);
                }
              }}
              placeholder={i === 0 ? "Item title — Enter to add more" : "Item title"}
              className="flex-1 border-0 border-b border-[#3d2260] bg-transparent py-0.5 text-xs font-medium text-[#ede0f5] focus:outline-none focus:border-teal-primary transition-colors"
            />
          </div>
          <div className="pl-5">
            <input
              type="text"
              value={item.description}
              onChange={(e) => setField(i, "description", e.target.value)}
              placeholder="Description (optional)"
              className="w-full border-0 bg-transparent py-0.5 text-xs text-[#a888c8] placeholder:text-[#3d2260] focus:outline-none"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

type ChecklistItem = {
  id: string;
  assignment_id: string;
  text: string;
  description?: string | null;
  order: number;
};

type Resource = {
  id: string;
  module_day_id: string;
  type: "video" | "reading" | "link" | "file";
  title: string;
  content: string | null;
  description: string | null;
  order: number;
};

type Day = {
  id: string;
  day_name: string;
  order: number;
  module_id: string;
  assignments?: Assignment[];
  resources?: Resource[];
};

type Module = {
  id: string;
  title: string;
  week_number: number;
  order: number;
  course_id: string;
  category: string | null;
  published: boolean;
  module_days: Day[];
};

const DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday"];

type RelocateCtx = {
  weekOptions: number[];
  relocateAssignment: (assignmentId: string, targetWeek: number, targetDay: string) => Promise<void>;
  relocateResource: (resourceId: string, targetWeek: number, targetDay: string, onRemoved: () => void) => Promise<void>;
};
const RelocateContext = createContext<RelocateCtx | null>(null);

// ─── AssignmentCard ───────────────────────────────────────────────────────────

function AssignmentCard({
  assignment,
  dayId,
  weekNumber,
  dayName,
  onOpen,
  onDelete,
  onTogglePublished,
}: {
  assignment: Assignment;
  dayId: string;
  weekNumber: number | null;
  dayName: string;
  onOpen: (assignment: Assignment, dayId: string) => void;
  onDelete: (id: string) => void;
  onTogglePublished: (id: string, current: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `assignment-${assignment.id}`,
    data: { type: "assignment", assignmentId: assignment.id, sourceDayId: dayId },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const ctx = useContext(RelocateContext);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-surface rounded-lg border border-border ${isDragging ? "opacity-50 z-50" : ""}`}
    >
      <div className="px-3 py-2 flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="text-border hover:text-muted-text cursor-grab shrink-0 focus-visible:ring-2 focus-visible:ring-teal-primary focus-visible:rounded"
          type="button"
          aria-label="Drag assignment"
        >
          ⠿
        </button>
        <button
          type="button"
          onClick={() => onOpen(assignment, dayId)}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-sm text-dark-text truncate">
            {assignment.title}
          </p>
          <p className="text-xs text-muted-text">
            Due:{" "}
            {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : "None"}
          </p>
        </button>
        {ctx && (() => {
          const isRealDay = DAY_OPTIONS.includes(dayName);
          return (
            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
              <select
                value={weekNumber ?? ""}
                onChange={e => {
                  if (isRealDay) ctx.relocateAssignment(assignment.id, Number(e.target.value), dayName);
                }}
                className="text-xs bg-background border border-border rounded px-1 py-0.5 text-muted-text focus:outline-none focus:ring-1 focus:ring-teal-primary w-14"
                title="Week"
              >
                <option value="">W?</option>
                {ctx.weekOptions.map(w => (
                  <option key={w} value={w}>W{w}</option>
                ))}
              </select>
              <select
                value={isRealDay ? dayName : ""}
                onChange={e => ctx.relocateAssignment(assignment.id, weekNumber ?? 1, e.target.value)}
                className="text-xs bg-background border border-border rounded px-1 py-0.5 text-muted-text focus:outline-none focus:ring-1 focus:ring-teal-primary w-16"
                title="Day"
              >
                {!isRealDay && <option value="">Day?</option>}
                {DAY_OPTIONS.map(d => (
                  <option key={d} value={d}>{d.slice(0, 3)}</option>
                ))}
              </select>
            </div>
          );
        })()}
        <button
          onClick={() => onTogglePublished(assignment.id, assignment.published)}
          className={`text-xs shrink-0 font-medium px-2 py-0.5 rounded-full border transition-colors ${
            assignment.published
              ? "border-teal-primary text-teal-primary hover:bg-teal-primary hover:text-white"
              : "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary"
          }`}
          type="button"
          aria-label={assignment.published ? "Published — click to unpublish" : "Draft — click to publish"}
        >
          {assignment.published ? "Published" : "Draft"}
        </button>
        <button
          onClick={() => onDelete(assignment.id)}
          className="text-muted-text hover:text-red-400 shrink-0"
          type="button"
          aria-label="Delete assignment"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─── AssignmentFullView ────────────────────────────────────────────────────────

type ActiveView =
  | { mode: "view"; assignment: Assignment; dayId: string }
  | { mode: "add"; dayId: string };

function AssignmentFullView({
  view,
  courseId,
  onClose,
  onAdd,
  onEdit,
  onDelete,
  onTogglePublished,
  defaultTemplateId,
}: {
  view: ActiveView;
  courseId: string;
  onClose: () => void;
  onAdd: (dayId: string, title: string, description: string, howToTurnIn: string, dueDate: string | null, checklistItems: RubricItem[]) => void;
  onEdit: (id: string, updates: Partial<Pick<Assignment, "title" | "description" | "how_to_turn_in" | "due_date">>) => void;
  onDelete: (id: string) => void;
  onTogglePublished: (id: string, current: boolean) => void;
  defaultTemplateId?: string;
}) {
  const supabase = createClient();
  const assignment = view.mode === "view" ? view.assignment : null;
  const assignmentId = view.mode === "view" ? view.assignment.id : null;

  // ── View/edit state ──
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(assignment?.title ?? "");
  const [editDescription, setEditDescription] = useState(assignment?.description ?? "");
  const [editHowToTurnIn, setEditHowToTurnIn] = useState(assignment?.how_to_turn_in ?? "");
  const [editDueDate, setEditDueDate] = useState(
    assignment?.due_date ? new Date(assignment.due_date).toISOString().slice(0, 16) : ""
  );

  // ── Checklist state (view mode) ──
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const checklistRef = useRef(checklistItems);
  useEffect(() => { checklistRef.current = checklistItems; }, [checklistItems]);
  const checklistInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const focusPendingId = useRef<string | null>(null);

  useEffect(() => {
    if (!assignmentId) return;
    let cancelled = false;
    supabase
      .from("checklist_items")
      .select("*")
      .eq("assignment_id", assignmentId)
      .order("order")
      .then(async ({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) { console.error("Failed to fetch checklist:", fetchError.message); return; }
        if (data && data.length > 0) {
          setChecklistItems(data);
        } else if (data && data.length === 0 && defaultTemplateId) {
          const template = RUBRIC_TEMPLATES.find((t) => t.id === defaultTemplateId);
          if (template) {
            const { data: inserted, error } = await supabase
              .from("checklist_items")
              .insert(template.items.map((item, i) => ({
                assignment_id: assignmentId,
                text: item.text,
                description: item.description || null,
                order: i,
              })))
              .select();
            if (cancelled) return;
            if (error) console.error("Failed to auto-populate checklist:", error.message);
            if (!error && inserted) setChecklistItems(inserted);
          }
        }
      });
    return () => { cancelled = true; };
  }, [assignmentId]);

  // Focus newly added checklist item after render
  useEffect(() => {
    if (focusPendingId.current) {
      const el = checklistInputRefs.current[focusPendingId.current];
      if (el) { el.focus(); focusPendingId.current = null; }
    }
  });

  const addChecklistItemAfter = async (afterIndex: number, text = "", description = "") => {
    if (!assignmentId) return;
    const { data, error } = await supabase
      .from("checklist_items")
      .insert({ assignment_id: assignmentId, text, description: description || null, order: checklistRef.current.length })
      .select()
      .single();
    if (!error && data) {
      focusPendingId.current = data.id;
      setChecklistItems((prev) => { const next = [...prev]; next.splice(afterIndex + 1, 0, data); return next; });
    }
  };

  const editChecklistItem = async (id: string, text: string, description?: string) => {
    const updates: { text: string; description?: string | null } = { text };
    if (description !== undefined) updates.description = description || null;
    await supabase.from("checklist_items").update(updates).eq("id", id);
    setChecklistItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const deleteChecklistItem = async (id: string, prevIndex: number) => {
    await supabase.from("checklist_items").delete().eq("id", id);
    setChecklistItems((prev) => {
      const next = prev.filter((c) => c.id !== id);
      const focusTarget = next[Math.max(0, prevIndex - 1)];
      if (focusTarget) setTimeout(() => checklistInputRefs.current[focusTarget.id]?.focus(), 0);
      return next;
    });
  };

  const loadRubricTemplate = async (templateId: string) => {
    if (!assignmentId) return;
    const template = RUBRIC_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    if (checklistItems.length > 0) {
      if (!window.confirm("Replace the current checklist with this template?")) return;
      await supabase.from("checklist_items").delete().eq("assignment_id", assignmentId);
    }
    const { data, error } = await supabase
      .from("checklist_items")
      .insert(template.items.map((item, i) => ({
        assignment_id: assignmentId, text: item.text, description: item.description || null, order: i,
      })))
      .select();
    if (!error && data) setChecklistItems(data);
  };

  // ── Add mode state ──
  const getDefaultChecklist = (): RubricItem[] => {
    if (defaultTemplateId) {
      const template = RUBRIC_TEMPLATES.find((t) => t.id === defaultTemplateId);
      if (template) return template.items.map((item) => ({ text: item.text, description: item.description }));
    }
    return [{ text: "", description: "" }];
  };
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newHowToTurnIn, setNewHowToTurnIn] = useState(DEFAULT_HOW_TO_TURN_IN);
  const [newDueDate, setNewDueDate] = useState(getDefaultDueDate);
  const [newChecklist, setNewChecklist] = useState<RubricItem[]>(getDefaultChecklist);
  const [editorKey] = useState(0);

  const handleSaveEdit = () => {
    if (!editTitle.trim()) return;
    onEdit(assignment!.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      how_to_turn_in: editHowToTurnIn.trim() || null,
      due_date: editDueDate || null,
    });
    setEditing(false);
  };

  const handleAdd = () => {
    if (!newTitle.trim() || view.mode !== "add") return;
    onAdd(view.dayId, newTitle.trim(), newDescription, newHowToTurnIn, newDueDate || null, newChecklist.filter((item) => item.text.trim()));
    onClose();
  };

  const handleDelete = () => {
    if (!assignment || !window.confirm("Delete this assignment?")) return;
    onDelete(assignment.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#12072a] overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-6">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-[#c4a8df] hover:text-white transition-colors"
            type="button"
          >
            ← Back to assignments
          </button>
          <div className="flex items-center gap-4">
            {view.mode === "view" && !editing && assignment && (
              <button
                onClick={() => onTogglePublished(assignment.id, assignment.published)}
                className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                  assignment.published
                    ? "border-teal-primary text-teal-primary hover:bg-teal-primary hover:text-white"
                    : "border-[#3d2260] text-[#7a5299] hover:border-[#a888c8] hover:text-[#c4a8df]"
                }`}
                type="button"
              >
                {assignment.published ? "● Published" : "○ Unpublished"}
              </button>
            )}
            {view.mode === "view" && !editing && (
              <button onClick={handleDelete} className="text-xs text-[#3d2260] hover:text-red-400 transition-colors" type="button">
                Delete assignment
              </button>
            )}
          </div>
        </div>

        {view.mode === "view" ? (
          editing ? (
            // ── Edit form ──
            <div className="flex flex-col gap-4">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
                className="text-2xl font-bold text-white bg-transparent border-b-2 border-teal-primary focus:outline-none pb-1 w-full"
              />
              <div className="bg-[#1d0f3e] rounded-2xl border border-[#301850] p-6 flex flex-col gap-4">
                <div>
                  <p className="text-xs font-bold text-[#a888c8] uppercase tracking-wide mb-2">Instructions</p>
                  <RichTextEditor content={editDescription} onChange={setEditDescription} placeholder="Instructions for the assignment" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#a888c8] uppercase tracking-wide mb-2">How to turn this in</p>
                  <RichTextEditor content={editHowToTurnIn} onChange={setEditHowToTurnIn} placeholder="Submission instructions" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#a888c8] shrink-0">Due:</label>
                  <input
                    type="datetime-local"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="flex-1 bg-[#12072a] border border-[#3d2260] text-[#ede0f5] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditTitle(assignment!.title);
                    setEditDescription(assignment!.description ?? "");
                    setEditHowToTurnIn(assignment!.how_to_turn_in ?? "");
                  }}
                  className="text-sm text-[#a888c8] hover:text-[#dac8ee] px-4 py-2 transition-colors"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90"
                  type="button"
                >
                  Save changes
                </button>
              </div>
            </div>
          ) : (
            // ── View content ──
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">{assignment!.title}</h1>
                  <p className="text-sm text-[#c4a8df] mt-1">
                    Due:{" "}
                    {assignment!.due_date
                      ? new Date(assignment!.due_date).toLocaleDateString("en-US", {
                          weekday: "long", year: "numeric", month: "long", day: "numeric",
                        })
                      : "No due date"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 mt-1">
                  <a
                    href={`/instructor/courses/${courseId}/assignments/${assignment!.id}/submissions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#a888c8] hover:text-[#dac8ee] transition-colors"
                  >
                    View Submissions →
                  </a>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-sm text-[#9080b0] hover:text-[#dac8ee] transition-colors"
                    type="button"
                  >
                    ✎ Edit
                  </button>
                </div>
              </div>

              <div className="bg-[#1d0f3e] rounded-2xl border border-[#301850] p-6">
                <p className="text-xs font-bold text-[#a888c8] uppercase tracking-wide mb-3">Instructions</p>
                {assignment!.description ? (
                  <div
                    className="tiptap text-sm text-[#ede0f5] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:font-bold [&_h2]:text-base [&_h2]:text-white [&_h3]:font-semibold [&_h3]:text-white [&_strong]:font-bold [&_strong]:text-white [&_a]:text-teal-primary"
                    dangerouslySetInnerHTML={{ __html: assignment!.description }}
                  />
                ) : (
                  <p className="text-sm text-[#7a5299] italic">No instructions.</p>
                )}
              </div>

              {assignment!.how_to_turn_in && (
                <div className="bg-[#1d0f3e] rounded-2xl border border-[#301850] p-6">
                  <p className="text-xs font-bold text-[#a888c8] uppercase tracking-wide mb-3">How to turn this in</p>
                  <div
                    className="tiptap text-sm text-[#ede0f5] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-bold [&_strong]:text-white [&_a]:text-teal-primary"
                    dangerouslySetInnerHTML={{ __html: assignment!.how_to_turn_in }}
                  />
                </div>
              )}

              <div className="bg-[#1d0f3e] rounded-2xl border border-[#301850] p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold text-[#a888c8] uppercase tracking-wide">Checklist</p>
                  <select
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) loadRubricTemplate(e.target.value); e.target.value = ""; }}
                    className="text-xs bg-[#12072a] border border-[#3d2260] rounded-lg px-2 py-1 text-[#dac8ee] focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  >
                    <option value="">Load template…</option>
                    {RUBRIC_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-3">
                  {checklistItems.map((item, i) => (
                    <div key={item.id} className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-teal-primary text-sm shrink-0">☐</span>
                        <input
                          ref={(el) => { checklistInputRefs.current[item.id] = el; }}
                          type="text"
                          defaultValue={item.text}
                          onBlur={(e) => { const val = e.target.value.trim(); if (val !== item.text) editChecklistItem(item.id, val); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (val !== item.text) editChecklistItem(item.id, val);
                              addChecklistItemAfter(i);
                            }
                            if (e.key === "Backspace" && (e.target as HTMLInputElement).value === "") {
                              e.preventDefault();
                              deleteChecklistItem(item.id, i);
                            }
                          }}
                          className="flex-1 border-0 border-b border-[#3d2260] bg-transparent py-0.5 text-sm font-medium text-[#f8f3fc] focus:outline-none focus:border-teal-primary transition-colors"
                        />
                        <button
                          onClick={() => deleteChecklistItem(item.id, i)}
                          className="text-[#3d2260] hover:text-red-400 shrink-0 transition-colors"
                          type="button"
                          aria-label="Delete item"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                        </button>
                      </div>
                      <div className="pl-6">
                        <input
                          type="text"
                          defaultValue={item.description ?? ""}
                          onBlur={(e) => { const val = e.target.value.trim(); if (val !== (item.description ?? "")) editChecklistItem(item.id, item.text, val); }}
                          placeholder="Description (optional)"
                          className="w-full border-0 bg-transparent py-0.5 text-xs text-[#9080b0] placeholder:text-[#3d2260] focus:outline-none focus:text-[#c4a8df] transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                  {checklistItems.length === 0 && (
                    <p className="text-sm text-[#3d2260] italic pb-1">No checklist items yet.</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 border-t border-[#301850] pt-3">
                    <span className="text-[#3d2260] text-sm shrink-0">☐</span>
                    <input
                      type="text"
                      placeholder="Add item — Enter for more"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) { (e.target as HTMLInputElement).value = ""; addChecklistItemAfter(checklistItems.length - 1, val); }
                        }
                      }}
                      className="flex-1 bg-transparent py-0.5 text-sm text-[#9080b0] placeholder:text-[#3d2260] focus:outline-none focus:text-[#c4a8df] transition-colors"
                    />
                  </div>
                </div>
              </div>
            </>
          )
        ) : (
          // ── Add mode ──
          <>
            <h1 className="text-2xl font-bold text-white">New Assignment</h1>
            <div className="bg-[#1d0f3e] rounded-2xl border border-[#301850] p-6 flex flex-col gap-4">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Assignment title *"
                autoFocus
                className="w-full bg-[#12072a] border border-[#3d2260] text-white rounded-lg px-3 py-2 text-sm placeholder:text-[#7a5299] focus:outline-none focus:ring-2 focus:ring-teal-primary"
              />
              <div>
                <p className="text-xs font-bold text-[#a888c8] uppercase tracking-wide mb-2">Instructions</p>
                <RichTextEditor key={`desc-${editorKey}`} content={newDescription} onChange={setNewDescription} placeholder="Instructions for the assignment" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#a888c8] uppercase tracking-wide mb-2">How to turn this in</p>
                <RichTextEditor key={`htti-${editorKey}`} content={newHowToTurnIn} onChange={setNewHowToTurnIn} placeholder="Submission instructions" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#a888c8] shrink-0">Due:</label>
                <input
                  type="datetime-local"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="flex-1 bg-[#12072a] border border-[#3d2260] text-[#ede0f5] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-primary"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-[#a888c8] uppercase tracking-wide">Checklist</p>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const template = RUBRIC_TEMPLATES.find((t) => t.id === e.target.value);
                      if (template) setNewChecklist(template.items.map((item) => ({ text: item.text, description: item.description })));
                      e.target.value = "";
                    }}
                    className="text-xs bg-[#12072a] border border-[#3d2260] rounded-lg px-2 py-1 text-[#dac8ee] focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  >
                    <option value="">Load template…</option>
                    {RUBRIC_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <ChecklistLineEditor items={newChecklist} onChange={setNewChecklist} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="text-sm text-[#a888c8] hover:text-[#dac8ee] px-4 py-2 transition-colors" type="button">
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="bg-teal-primary text-white text-sm font-semibold px-6 py-2 rounded-full hover:opacity-90"
                type="button"
              >
                Add Assignment
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── AssignmentDropZone ───────────────────────────────────────────────────────

function AssignmentDropZone({
  day,
  weekNumber,
  assignments,
  onOpenAssignment,
  onOpenAdd,
  onDeleteAssignment,
  onTogglePublished,
}: {
  day: Day;
  weekNumber: number | null;
  assignments: Assignment[];
  onOpenAssignment: (assignment: Assignment, dayId: string) => void;
  onOpenAdd: (dayId: string) => void;
  onDeleteAssignment: (assignmentId: string) => void;
  onTogglePublished: (id: string, current: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${day.id}`,
    data: { type: "day-drop", dayId: day.id },
  });

  return (
    <div className="bg-surface/60 rounded-xl p-3">
      <p className="text-sm font-bold text-muted-text uppercase tracking-wide mb-2">
        Assignments
      </p>
      {(() => {
        const sorted = [...assignments].sort((a, b) => a.order - b.order);
        return (
          <SortableContext
            items={sorted.map((a) => `assignment-${a.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div
              ref={setNodeRef}
              className={`flex flex-col gap-2 min-h-[48px] rounded-lg p-1 transition-colors ${
                isOver ? "bg-teal-light border border-dashed border-teal-primary/50" : ""
              }`}
            >
              {sorted.length === 0 ? (
                <p className="text-xs text-muted-text py-2 px-1">
                  No assignments. Drag one here or add below.
                </p>
              ) : (
                sorted.map((a) => (
                  <AssignmentCard
                    key={a.id}
                    assignment={a}
                    dayId={day.id}
                    weekNumber={weekNumber}
                    dayName={day.day_name}
                    onOpen={onOpenAssignment}
                    onDelete={onDeleteAssignment}
                    onTogglePublished={onTogglePublished}
                  />
                ))
              )}
            </div>
          </SortableContext>
        );
      })()}
      <button
        onClick={() => onOpenAdd(day.id)}
        className="mt-3 text-xs font-semibold bg-purple-primary text-white rounded-full px-3 py-1.5 hover:opacity-90 transition-opacity"
        type="button"
      >
        + Add Assignment
      </button>
    </div>
  );
}

// ─── SortableResource ─────────────────────────────────────────────────────────

const RESOURCE_TYPE_LABELS: Record<Resource["type"], string> = {
  video: "Video",
  reading: "Reading",
  link: "Link",
  file: "File",
};

function SortableResource({
  resource,
  weekNumber,
  onEdit,
  onDelete,
  onRelocated,
}: {
  resource: Resource;
  weekNumber: number | null;
  onEdit: (id: string, updates: Partial<Pick<Resource, "type" | "title" | "content" | "description">>) => void;
  onDelete: (id: string) => void;
  onRelocated: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `resource-${resource.id}`,
    data: { type: "resource" },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const ctx = useContext(RelocateContext);
  const [relocWeek, setRelocWeek] = useState<string>(weekNumber ? String(weekNumber) : "");
  const [relocDay, setRelocDay] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState<Resource["type"]>(resource.type);
  const [editTitle, setEditTitle] = useState(resource.title);
  const [editContent, setEditContent] = useState(resource.content ?? "");
  const [editDescription, setEditDescription] = useState(resource.description ?? "");

  const handleSave = () => {
    if (!editTitle.trim()) return;
    onEdit(resource.id, {
      type: editType,
      title: editTitle.trim(),
      content: editContent.trim() || null,
      description: editDescription.trim() || null,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-surface rounded-lg border border-teal-primary/30 p-3 flex flex-col gap-2"
      >
        <div className="flex gap-2">
          <select
            value={editType}
            onChange={(e) => setEditType(e.target.value as Resource["type"])}
            className="bg-background border border-border rounded px-2 py-1 text-xs text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
          >
            <option value="link">Link</option>
            <option value="video">Video</option>
            <option value="reading">Reading</option>
            <option value="file">File</option>
          </select>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Title"
            className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
          />
        </div>
        {editType === "file" ? (
          <FileUpload
            bucket="lms-resources"
            path={`module-day-${resource.module_day_id}/`}
            onUpload={(url, fileName) => {
              setEditContent(url);
              if (!editTitle.trim()) setEditTitle(fileName);
            }}
          />
        ) : (
          <input
            type="text"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="URL or content"
            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
          />
        )}
        <input
          type="text"
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-muted-text hover:text-dark-text"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="text-xs text-teal-primary font-medium hover:underline"
            type="button"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-surface rounded-lg border border-border px-3 py-2 flex items-center gap-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-border hover:text-muted-text cursor-grab shrink-0 focus-visible:ring-2 focus-visible:ring-teal-primary focus-visible:rounded"
        type="button"
        aria-label="Drag resource"
      >
        ⠿
      </button>
      <span className="text-xs bg-teal-light text-teal-primary rounded px-1.5 py-0.5 shrink-0">
        {RESOURCE_TYPE_LABELS[resource.type]}
      </span>
      <div className="flex-1 min-w-0 group">
        <button
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-dark-text truncate hover:text-teal-primary transition-colors w-full text-left flex items-center gap-1"
          type="button"
        >
          {resource.title}
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-teal-primary shrink-0">✎</span>
        </button>
        {resource.description && (
          <p className="text-xs text-muted-text truncate">{resource.description}</p>
        )}
        {resource.content && resource.type !== "reading" && (() => {
          const href = resource.content.startsWith("http") ? resource.content : `https://${resource.content}`;
          const isImg = resource.type === "file" && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(resource.content);
          return isImg ? (
            <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <img src={href} alt={resource.title} className="mt-1 h-12 w-auto rounded border border-border object-contain" />
            </a>
          ) : (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-teal-primary truncate hover:underline block"
              onClick={(e) => e.stopPropagation()}
            >
              {resource.content}
            </a>
          );
        })()}
      </div>
      {ctx && (
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <select
            value={relocWeek}
            onChange={e => {
              const w = e.target.value;
              setRelocWeek(w);
              if (w && relocDay) ctx.relocateResource(resource.id, Number(w), relocDay, onRelocated);
            }}
            className="text-xs bg-background border border-border rounded px-1 py-0.5 text-muted-text focus:outline-none focus:ring-1 focus:ring-teal-primary w-14"
            title="Week"
          >
            <option value="">W?</option>
            {ctx.weekOptions.map(w => (
              <option key={w} value={w}>W{w}</option>
            ))}
          </select>
          <select
            value={relocDay}
            onChange={e => {
              const d = e.target.value;
              setRelocDay(d);
              if (relocWeek && d) ctx.relocateResource(resource.id, Number(relocWeek), d, onRelocated);
            }}
            className="text-xs bg-background border border-border rounded px-1 py-0.5 text-muted-text focus:outline-none focus:ring-1 focus:ring-teal-primary w-16"
            title="Day"
          >
            <option value="">Day?</option>
            {DAY_OPTIONS.map(d => (
              <option key={d} value={d}>{d.slice(0, 3)}</option>
            ))}
          </select>
        </div>
      )}
      <button
        onClick={() => onDelete(resource.id)}
        className="text-muted-text hover:text-red-400 shrink-0"
        type="button"
        aria-label="Delete resource"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
      </button>
    </div>
  );
}

// ─── SortableDay ──────────────────────────────────────────────────────────────

function SortableDay({
  day,
  weekNumber,
  refreshTrigger,
  onDelete,
  onOpenAssignment,
  onOpenAdd,
  onDeleteAssignment,
  onTogglePublished,
}: {
  day: Day;
  weekNumber: number | null;
  refreshTrigger: number;
  onDelete: (id: string) => void;
  onOpenAssignment: (assignment: Assignment, dayId: string) => void;
  onOpenAdd: (dayId: string) => void;
  onDeleteAssignment: (assignmentId: string) => void;
  onTogglePublished: (id: string, current: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: `day-${day.id}`,
      data: { type: "day", moduleId: day.module_id },
    });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const [open, setOpen] = useState(false);
  const assignments = day.assignments ?? [];
  const supabase = createClient();

  const [resources, setResources] = useState<Resource[]>([]);
  const resourcesRef = useRef(resources);
  useEffect(() => {
    resourcesRef.current = resources;
  }, [resources]);

  useEffect(() => {
    supabase
      .from("resources")
      .select("*")
      .eq("module_day_id", day.id)
      .order("order")
      .then(({ data }) => {
        if (data) setResources(data);
      });
  }, [day.id, refreshTrigger]);

  const resourceSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleResourceDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const current = resourcesRef.current;
    const oldIndex = current.findIndex((r) => `resource-${r.id}` === active.id);
    const newIndex = current.findIndex((r) => `resource-${r.id}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove([...current], oldIndex, newIndex).map((r, i) => ({
      ...r,
      order: i,
    }));
    setResources(reordered);
    await Promise.all(
      reordered.map((r, i) =>
        supabase.from("resources").update({ order: i }).eq("id", r.id)
      )
    );
  };

  const addResource = async (type: Resource["type"], title: string, content: string) => {
    const { data, error } = await supabase
      .from("resources")
      .insert({
        module_day_id: day.id,
        type,
        title,
        content: content || null,
        order: resourcesRef.current.length,
      })
      .select()
      .single();
    if (error) {
      console.error("Failed to add resource:", error);
      return;
    }
    if (data) {
      setResources((prev) => [...prev, data]);
    }
  };

  const editResource = async (
    id: string,
    updates: Partial<Pick<Resource, "type" | "title" | "content" | "description">>
  ) => {
    await supabase.from("resources").update(updates).eq("id", id);
    setResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const deleteResource = async (id: string) => {
    await supabase.from("resources").delete().eq("id", id);
    setResources((prev) => prev.filter((r) => r.id !== id));
  };

  const [newResType, setNewResType] = useState<Resource["type"]>("link");
  const [newResTitle, setNewResTitle] = useState("");
  const [newResContent, setNewResContent] = useState("");
  const [fileUploadKey, setFileUploadKey] = useState(0);

  const submitNewResource = () => {
    if (!newResTitle.trim()) return;
    addResource(newResType, newResTitle.trim(), newResContent.trim());
    setNewResTitle("");
    setNewResContent("");
    setFileUploadKey((k) => k + 1);
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-background rounded-lg">
      <div className="flex items-center gap-3 px-4 py-2">
        <button
          {...attributes}
          {...listeners}
          className="text-border hover:text-muted-text cursor-grab focus-visible:ring-2 focus-visible:ring-teal-primary focus-visible:rounded"
          aria-label={`Drag day ${day.day_name}`}
          type="button"
        >
          ⠿
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm text-dark-text flex-1 text-left flex items-center gap-2"
          aria-expanded={open}
          aria-controls={`day-panel-${day.id}`}
        >
          <span>{day.day_name}</span>
          <span className="text-xs text-muted-text">
            ({assignments.length + resources.length})
          </span>
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenAdd(day.id); }}
          className="text-xs font-semibold text-purple-primary hover:opacity-70 shrink-0 px-1"
          title="Add assignment to this day"
        >
          +A
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className="text-xs font-semibold text-teal-primary hover:opacity-70 shrink-0 px-1"
          title="Add resource to this day"
        >
          +R
        </button>
        <button
          onClick={() => { if (window.confirm(`Delete "${day.day_name}" and all its resources? This cannot be undone.`)) onDelete(day.id); }}
          className="text-muted-text hover:text-red-400"
          aria-label={`Delete day ${day.day_name}`}
          type="button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>

      {open && (
        <div
          id={`day-panel-${day.id}`}
          className="px-10 pb-4 pt-2 border-t border-border flex flex-col gap-4"
        >
          {/* Resources */}
          <div className="bg-surface/60 rounded-xl p-3">
            <p className="text-sm font-bold text-muted-text uppercase tracking-wide mb-2">
              Resources
            </p>
            <DndContext
              sensors={resourceSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleResourceDragEnd}
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
            >
              <SortableContext
                items={resources.map((r) => `resource-${r.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-1.5 mb-2">
                  {resources.map((r) => (
                    <SortableResource
                      key={r.id}
                      resource={r}
                      weekNumber={weekNumber}
                      onEdit={editResource}
                      onDelete={deleteResource}
                      onRelocated={() => setResources(prev => prev.filter(res => res.id !== r.id))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <select
                  value={newResType}
                  onChange={(e) => { setNewResType(e.target.value as Resource["type"]); setNewResContent(""); }}
                  className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                >
                  <option value="link">Link</option>
                  <option value="video">Video</option>
                  <option value="reading">Reading</option>
                  <option value="file">File</option>
                </select>
                <input
                  type="text"
                  placeholder="Title"
                  value={newResTitle}
                  onChange={(e) => setNewResTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitNewResource(); }}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                />
              </div>
              <div className="flex gap-2 items-start">
                {newResType === "file" ? (
                  <FileUpload
                    key={fileUploadKey}
                    bucket="lms-resources"
                    path={`module-day-${day.id}/`}
                    onUpload={(url, fileName) => {
                      setNewResContent(url);
                      if (!newResTitle.trim()) setNewResTitle(fileName);
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    placeholder="URL or content"
                    value={newResContent}
                    onChange={(e) => setNewResContent(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitNewResource(); }}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  />
                )}
                <button
                  onClick={submitNewResource}
                  className="bg-teal-light text-teal-primary px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-teal-primary hover:text-white transition-colors"
                  type="button"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Assignments */}
          <AssignmentDropZone
            day={day}
            weekNumber={weekNumber}
            assignments={assignments}
            onOpenAssignment={onOpenAssignment}
            onOpenAdd={onOpenAdd}
            onDeleteAssignment={onDeleteAssignment}
            onTogglePublished={onTogglePublished}
          />
        </div>
      )}
    </div>
  );
}

// ─── SortableModule ───────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: '', label: 'Unassigned' },
  { value: 'syllabus', label: 'Syllabus' },
  { value: 'level_up', label: 'Level Up Your Skills' },
  { value: 'resources', label: 'Class Resources' },
  { value: 'career', label: 'Career Development' },
]

function SortableModule({
  module,
  courseId,
  expanded,
  onToggleExpand,
  onDelete,
  onAddDay,
  onDeleteDay,
  onOpenAssignment,
  onOpenAdd,
  onDeleteAssignment,
  onTogglePublished,
  onUpdateCategory,
  onToggleModulePublished,
  onUpdateTitle,
  dayRefreshTriggers,
  isDraggingOverlay = false,
}: {
  module: Module;
  courseId: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: (id: string) => void;
  onAddDay: (moduleId: string, dayName: string) => void;
  onDeleteDay: (dayId: string, moduleId: string) => void;
  onOpenAssignment: (assignment: Assignment, dayId: string) => void;
  onOpenAdd: (dayId: string) => void;
  onDeleteAssignment: (assignmentId: string) => void;
  onTogglePublished: (id: string, current: boolean) => void;
  onUpdateCategory: (moduleId: string, category: string | null) => void;
  onToggleModulePublished: (id: string, current: boolean) => void;
  onUpdateTitle: (moduleId: string, title: string) => void;
  dayRefreshTriggers: Record<string, number>;
  isDraggingOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: `module-${module.id}`,
      data: { type: "module" },
    });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const [newDayName, setNewDayName] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(module.title);

  const saveTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== module.title) onUpdateTitle(module.id, trimmed);
    else setTitleDraft(module.title);
    setEditingTitle(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-surface rounded-2xl border border-border overflow-hidden transition-opacity ${isDraggingOverlay ? 'opacity-30' : ''}`}
    >
      <div className="flex items-center gap-3 px-6 py-4">
        <button
          {...attributes}
          {...listeners}
          className="text-border hover:text-muted-text cursor-grab text-lg focus-visible:ring-2 focus-visible:ring-teal-primary focus-visible:rounded"
          aria-label={`Drag module ${module.title}`}
          type="button"
        >
          ⠿
        </button>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleDraft(module.title); setEditingTitle(false); } }}
              className="font-semibold text-dark-text bg-background border border-teal-primary rounded px-2 py-0.5 w-full focus:outline-none"
            />
          ) : (
            <h3
              className="font-semibold text-dark-text truncate cursor-pointer hover:text-teal-primary transition-colors"
              onClick={() => { setTitleDraft(module.title); setEditingTitle(true); }}
              title="Click to edit title"
            >
              {module.title}
            </h3>
          )}
          {module.week_number != null && <p className="text-xs text-muted-text">Week {module.week_number}</p>}
        </div>
        <select
          value={module.category ?? ''}
          onChange={(e) => onUpdateCategory(module.id, e.target.value || null)}
          className="text-xs bg-background border border-border rounded-md px-2 py-1 text-muted-text focus:outline-none focus:ring-1 focus:ring-teal-primary shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {CATEGORY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleModulePublished(module.id, module.published); }}
          className={`text-xs shrink-0 font-medium px-2 py-0.5 rounded-full border transition-colors ${
            module.published
              ? "border-teal-primary text-teal-primary hover:bg-teal-primary hover:text-white"
              : "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary"
          }`}
          type="button"
          aria-label={module.published ? "Published — click to unpublish" : "Draft — click to publish"}
        >
          {module.published ? "Published" : "Draft"}
        </button>
        <button
          onClick={onToggleExpand}
          className="text-muted-text hover:text-teal-primary text-sm px-3"
          aria-label={expanded ? "Collapse module" : "Expand module"}
          type="button"
        >
          {expanded ? "▲" : "▼"}
        </button>
        <button
          onClick={() => { if (window.confirm(`Delete module "${module.title}" and everything in it? This cannot be undone.`)) onDelete(module.id); }}
          className="text-muted-text hover:text-red-400"
          aria-label={`Delete module ${module.title}`}
          type="button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>

      {expanded && (
        <div className="px-6 pb-4 flex flex-col gap-2 border-t border-border pt-4">
          <SortableContext
            items={[...module.module_days]
              .sort((a, b) => a.order - b.order)
              .map((d) => `day-${d.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {[...module.module_days]
              .sort((a, b) => a.order - b.order)
              .map((day) => (
                <SortableDay
                  key={day.id}
                  day={day}
                  weekNumber={module.week_number}
                  refreshTrigger={dayRefreshTriggers[day.id] ?? 0}
                  onDelete={(id) => onDeleteDay(id, module.id)}
                  onOpenAssignment={onOpenAssignment}
                  onOpenAdd={onOpenAdd}
                  onDeleteAssignment={onDeleteAssignment}
                  onTogglePublished={onTogglePublished}
                />
              ))}
          </SortableContext>

          <div className="flex gap-3 mt-1">
            <AddAssignmentButton courseId={courseId} variant="link"
              defaultModuleId={module.id}
              defaultSection={module.category === 'career' ? 'career' : 'coding'}
            />
            <AddResourceButton courseId={courseId} variant="link"
              defaultModuleId={module.id}
              defaultSection={module.category === 'career' ? 'career' : 'coding'}
            />
          </div>

          <div className="flex gap-2 mt-2">
            <input
              type="text"
              placeholder="Add a day (e.g. Monday)"
              value={newDayName}
              onChange={(e) => setNewDayName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newDayName.trim()) {
                  onAddDay(module.id, newDayName.trim());
                  setNewDayName("");
                }
              }}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
              aria-label="New day name"
            />
            <button
              onClick={() => {
                if (newDayName.trim()) {
                  onAddDay(module.id, newDayName.trim());
                  setNewDayName("");
                }
              }}
              className="bg-teal-light text-teal-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-primary hover:text-white transition-colors"
              type="button"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CourseEditor ─────────────────────────────────────────────────────────────

export default function CourseEditor({
  course,
  initialModules,
  filterCategory,
}: {
  course: any;
  initialModules: Module[];
  filterCategory?: string;
}) {
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleWeek, setNewModuleWeek] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());

  const isModuleExpanded = (id: string) => !collapsedModules.has(id);
  const toggleModuleExpand = (id: string) => {
    setCollapsedModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const expandAllModules = () => setCollapsedModules(new Set());
  const collapseAllModules = (ids: string[]) => setCollapsedModules(new Set(ids));
  const supabase = createClient();

  const usesCodePenRubric = [course.name, course.code].some(
    (s: string | null | undefined) =>
      s?.toLowerCase().includes("front") || s?.toLowerCase().includes("itp")
  );
  const defaultTemplateId = usesCodePenRubric ? "frontend-codepen" : undefined;

  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dayRefreshTriggers, setDayRefreshTriggers] = useState<Record<string, number>>({});

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const modulesRef = useRef(modules);
  useEffect(() => {
    modulesRef.current = modules;
  }, [modules]);

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveDragId(active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Handle assignment moves (within-day reorder or cross-day)
    if (activeData?.type === "assignment") {
      const { assignmentId, sourceDayId } = activeData;

      // Within-day reorder: dropped on another assignment in the same day
      if (overData?.type === "assignment" && overData.sourceDayId === sourceDayId) {
        const currentMods = modulesRef.current;
        const sourceDay = currentMods.flatMap((m) => m.module_days).find((d) => d.id === sourceDayId);
        if (!sourceDay) return;
        const sorted = [...(sourceDay.assignments ?? [])].sort((a, b) => a.order - b.order);
        const oldIndex = sorted.findIndex((a) => a.id === assignmentId);
        const newIndex = sorted.findIndex((a) => a.id === overData.assignmentId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
        const reordered = arrayMove(sorted, oldIndex, newIndex).map((a, i) => ({ ...a, order: i }));
        setModules((prev) =>
          prev.map((m) => ({
            ...m,
            module_days: m.module_days.map((d) =>
              d.id === sourceDayId ? { ...d, assignments: reordered } : d
            ),
          }))
        );
        await Promise.all(
          reordered.map((a, i) => supabase.from("assignments").update({ order: i }).eq("id", a.id))
        );
        return;
      }

      // Determine target day for cross-day move
      let targetDayId: string | null = null;
      if (overData?.type === "day-drop") {
        targetDayId = overData.dayId;
      } else if (overData?.type === "day") {
        targetDayId = (over.id as string).replace("day-", "");
      } else if (overData?.type === "assignment" && overData.sourceDayId !== sourceDayId) {
        targetDayId = overData.sourceDayId;
      }
      if (!targetDayId || targetDayId === sourceDayId) return;

      let assignmentToMove: Assignment | undefined;
      for (const m of modulesRef.current) {
        for (const d of m.module_days) {
          if (d.id === sourceDayId) {
            assignmentToMove = d.assignments?.find((a) => a.id === assignmentId);
            break;
          }
        }
        if (assignmentToMove) break;
      }
      if (!assignmentToMove) return;

      // Compute new order = end of target day
      const targetDay = modulesRef.current.flatMap((m) => m.module_days).find((d) => d.id === targetDayId);
      const newOrder = (targetDay?.assignments ?? []).length;

      const { error: assignmentMoveError } = await supabase
        .from("assignments")
        .update({ module_day_id: targetDayId, order: newOrder })
        .eq("id", assignmentId);
      if (assignmentMoveError) console.error("Failed to move assignment:", assignmentMoveError);

      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          module_days: m.module_days.map((d) => {
            if (d.id === sourceDayId) {
              return { ...d, assignments: (d.assignments ?? []).filter((a) => a.id !== assignmentId) };
            }
            if (d.id === targetDayId) {
              return {
                ...d,
                assignments: [
                  ...(d.assignments ?? []),
                  { ...assignmentToMove!, module_day_id: targetDayId, order: newOrder },
                ],
              };
            }
            return d;
          }),
        }))
      );
      return;
    }

    if (active.id === over.id) return;

    const currentModules = modulesRef.current;
    const scopedModules = filterCategory
      ? currentModules.filter((m) => m.category === filterCategory)
      : currentModules;

    if (activeData?.type === "module") {
      // When dragging a module, `over` could be another module OR a day inside a module.
      // Resolve the target module id in either case.
      let targetModuleId: string | null = null;
      if (overData?.type === "module") {
        targetModuleId = (over.id as string).replace("module-", "");
      } else if (overData?.type === "day") {
        const parent = currentModules.find((m) =>
          m.module_days.some((d) => `day-${d.id}` === over.id)
        );
        if (parent) targetModuleId = parent.id;
      }
      if (!targetModuleId) return;

      const oldIndex = scopedModules.findIndex(
        (m) => `module-${m.id}` === active.id
      );
      const newIndex = scopedModules.findIndex((m) => m.id === targetModuleId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reorderedScoped = arrayMove([...scopedModules], oldIndex, newIndex);

      // Rebuild the full modules array with the scoped reorder applied
      const scopedIds = new Set(scopedModules.map((m) => m.id));
      let scopedIdx = 0;
      const reordered = currentModules.map((m) =>
        scopedIds.has(m.id) ? reorderedScoped[scopedIdx++] : m
      );
      setModules(reordered);

      await Promise.all(
        reordered.map((m, i) =>
          supabase.from("modules").update({ order: i }).eq("id", m.id)
        )
      );
      return;
    }

    if (activeData?.type === "day" && overData?.type === "day") {
      const moduleId = activeData.moduleId;
      const mod = modulesRef.current.find((m) => m.id === moduleId);
      if (!mod) return;

      const oldIndex = mod.module_days.findIndex(
        (d) => `day-${d.id}` === active.id
      );
      const newIndex = mod.module_days.findIndex(
        (d) => `day-${d.id}` === over.id
      );
      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedDays = arrayMove([...mod.module_days], oldIndex, newIndex).map(
        (d, i) => ({ ...d, order: i })
      );

      setTimeout(() => {
        setModules((prev) =>
          prev.map((m) =>
            m.id === moduleId ? { ...m, module_days: reorderedDays } : m
          )
        );
      }, 10);

      await Promise.all(
        reorderedDays.map((d, i) =>
          supabase.from("module_days").update({ order: i }).eq("id", d.id)
        )
      );
    }
  };

  const addModule = async () => {
    if (!newModuleTitle.trim()) return;

    const { data, error } = await supabase
      .from("modules")
      .insert({
        course_id: course.id,
        title: newModuleTitle.trim(),
        week_number: parseInt(newModuleWeek) || null,
        order: modules.length,
        category: filterCategory ?? null,
      })
      .select()
      .single();

    if (!error && data) {
      setModules((prev) => [...prev, { ...data, module_days: [] }]);
      setNewModuleTitle("");
      setNewModuleWeek("");
    }
  };

  const deleteModule = async (id: string) => {
    await supabase.from("modules").delete().eq("id", id);
    setModules((prev) => prev.filter((m) => m.id !== id));
  };

  const updateModuleCategory = async (moduleId: string, category: string | null) => {
    const { error } = await supabase.from("modules").update({ category }).eq("id", moduleId);
    if (error) { console.error("updateModuleCategory failed:", error.message, error.code); return; }
    setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, category } : m));
  };

  const updateModulePublished = async (moduleId: string, current: boolean) => {
    const { error } = await supabase.from("modules").update({ published: !current }).eq("id", moduleId);
    if (error) { console.error("updateModulePublished failed:", error.message, error.code); return; }
    setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, published: !current } : m));
  };

  const updateModuleTitle = async (moduleId: string, title: string) => {
    const { error } = await supabase.from("modules").update({ title }).eq("id", moduleId);
    if (error) { console.error("updateModuleTitle failed:", error.message); return; }
    setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, title } : m));
  };

  const relocateAssignment = async (assignmentId: string, targetWeek: number, targetDayName: string) => {
    const currentMods = modulesRef.current;
    const targetModule = currentMods.find((m) => m.week_number === targetWeek);
    if (!targetModule) { console.error(`No module for week ${targetWeek}`); return; }
    const targetDay = targetModule.module_days.find((d) => d.day_name === targetDayName);
    if (!targetDay) { console.error(`No day "${targetDayName}" in week ${targetWeek}`); return; }

    // Find assignment and its current day
    let assignmentToMove: Assignment | undefined;
    let sourceDayId: string | undefined;
    for (const m of currentMods) {
      for (const d of m.module_days) {
        const found = d.assignments?.find((a) => a.id === assignmentId);
        if (found) { assignmentToMove = found; sourceDayId = d.id; break; }
      }
      if (assignmentToMove) break;
    }
    if (!assignmentToMove || !sourceDayId || sourceDayId === targetDay.id) return;

    const newOrder = (targetDay.assignments ?? []).length;
    const { error } = await supabase
      .from("assignments")
      .update({ module_day_id: targetDay.id, order: newOrder })
      .eq("id", assignmentId);
    if (error) { console.error("relocateAssignment failed:", error.message); return; }

    setModules((prev) =>
      prev.map((m) => ({
        ...m,
        module_days: m.module_days.map((d) => {
          if (d.id === sourceDayId)
            return { ...d, assignments: (d.assignments ?? []).filter((a) => a.id !== assignmentId) };
          if (d.id === targetDay.id)
            return { ...d, assignments: [...(d.assignments ?? []), { ...assignmentToMove!, module_day_id: targetDay.id, order: newOrder }] };
          return d;
        }),
      }))
    );
  };

  const relocateResource = async (resourceId: string, targetWeek: number, targetDayName: string, onRemoved: () => void) => {
    const currentMods = modulesRef.current;
    const targetModule = currentMods.find((m) => m.week_number === targetWeek);
    if (!targetModule) { console.error(`No module for week ${targetWeek}`); return; }
    const targetDay = targetModule.module_days.find((d) => d.day_name === targetDayName);
    if (!targetDay) { console.error(`No day "${targetDayName}" in week ${targetWeek}`); return; }

    const { error } = await supabase
      .from("resources")
      .update({ module_day_id: targetDay.id })
      .eq("id", resourceId);
    if (error) { console.error("relocateResource failed:", error.message); return; }

    onRemoved();
    setDayRefreshTriggers(prev => ({ ...prev, [targetDay.id]: (prev[targetDay.id] ?? 0) + 1 }));
  };

  const addDay = async (moduleId: string, dayName: string) => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    const { data, error } = await supabase
      .from("module_days")
      .insert({
        module_id: moduleId,
        day_name: dayName,
        order: mod.module_days.length,
      })
      .select()
      .single();

    if (!error && data) {
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId
            ? { ...m, module_days: [...m.module_days, { ...data, assignments: [] }] }
            : m
        )
      );
    }
  };

  const deleteDay = async (dayId: string, moduleId: string) => {
    await supabase.from("module_days").delete().eq("id", dayId);

    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId
          ? { ...m, module_days: m.module_days.filter((d) => d.id !== dayId) }
          : m
      )
    );
  };

  const addAssignment = async (
    dayId: string,
    title: string,
    description: string,
    howToTurnIn: string,
    dueDate: string | null,
    checklistItems: RubricItem[]
  ) => {
    const existingDay = modulesRef.current.flatMap((m) => m.module_days).find((d) => d.id === dayId);
    const newOrder = (existingDay?.assignments ?? []).length;

    const { data, error } = await supabase
      .from("assignments")
      .insert({
        module_day_id: dayId,
        title,
        description: description || null,
        how_to_turn_in: howToTurnIn || null,
        due_date: dueDate || null,
        order: newOrder,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to add assignment:", error.message, error);
      return;
    }

    if (data) {
      if (checklistItems.length > 0) {
        const { error: clErr } = await supabase.from("checklist_items").insert(
          checklistItems.map((item, i) => ({
            assignment_id: data.id,
            text: item.text,
            description: item.description || null,
            order: i,
          }))
        );
        if (clErr) console.error("Failed to add checklist items:", clErr.message);
      }
      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          module_days: m.module_days.map((d) =>
            d.id === dayId
              ? { ...d, assignments: [...(d.assignments ?? []), data] }
              : d
          ),
        }))
      );
    }
  };

  const togglePublished = async (assignmentId: string, current: boolean) => {
    await supabase.from("assignments").update({ published: !current }).eq("id", assignmentId);
    setModules((prev) =>
      prev.map((m) => ({
        ...m,
        module_days: m.module_days.map((d) => ({
          ...d,
          assignments: (d.assignments ?? []).map((a) =>
            a.id === assignmentId ? { ...a, published: !current } : a
          ),
        })),
      }))
    );
  };

  const deleteAssignment = async (assignmentId: string) => {
    await supabase.from("assignments").delete().eq("id", assignmentId);
    setModules((prev) =>
      prev.map((m) => ({
        ...m,
        module_days: m.module_days.map((d) => ({
          ...d,
          assignments: (d.assignments ?? []).filter((a) => a.id !== assignmentId),
        })),
      }))
    );
  };

  const updateAssignment = async (
    assignmentId: string,
    updates: Partial<Pick<Assignment, "title" | "description" | "how_to_turn_in" | "due_date">>
  ) => {
    await supabase.from("assignments").update(updates).eq("id", assignmentId);
    setModules((prev) =>
      prev.map((m) => ({
        ...m,
        module_days: m.module_days.map((d) => ({
          ...d,
          assignments: (d.assignments ?? []).map((a) =>
            a.id === assignmentId ? { ...a, ...updates } : a
          ),
        })),
      }))
    );
  };

  const openAssignment = (assignment: Assignment, dayId: string) =>
    setActiveView({ mode: "view", assignment, dayId });

  const openAdd = (dayId: string) =>
    setActiveView({ mode: "add", dayId });

  const closeView = () => setActiveView(null);

  const visibleModules = filterCategory
    ? modules.filter((m) => m.category === filterCategory)
    : modules;

  const weekOptions = [...new Set(modules.map((m) => m.week_number).filter(Boolean))].sort((a, b) => a - b) as number[];

  return (
    <RelocateContext.Provider value={{ weekOptions, relocateAssignment, relocateResource }}>
    <>
      {activeView && (
        <AssignmentFullView
          view={activeView}
          courseId={course.id}
          onClose={closeView}
          onAdd={addAssignment}
          onEdit={updateAssignment}
          onDelete={deleteAssignment}
          onTogglePublished={togglePublished}
          defaultTemplateId={defaultTemplateId}
        />
      )}
      {isMounted && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
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
        >
          <div className="flex flex-col gap-4">
            {visibleModules.length > 0 && (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={expandAllModules}
                  className="text-xs text-muted-text hover:text-dark-text transition-colors"
                >
                  Expand all
                </button>
                <span className="text-xs text-border">·</span>
                <button
                  type="button"
                  onClick={() => collapseAllModules(visibleModules.map(m => m.id))}
                  className="text-xs text-muted-text hover:text-dark-text transition-colors"
                >
                  Collapse all
                </button>
              </div>
            )}
            <SortableContext
              items={visibleModules.map((m) => `module-${m.id}`)}
              strategy={verticalListSortingStrategy}
            >
              {visibleModules.map((module) => (
                <SortableModule
                  key={module.id}
                  module={module}
                  courseId={course.id}
                  expanded={isModuleExpanded(module.id)}
                  onToggleExpand={() => toggleModuleExpand(module.id)}
                  onDelete={deleteModule}
                  onAddDay={addDay}
                  onDeleteDay={deleteDay}
                  onOpenAssignment={openAssignment}
                  onOpenAdd={openAdd}
                  onDeleteAssignment={deleteAssignment}
                  onTogglePublished={togglePublished}
                  onUpdateCategory={updateModuleCategory}
                  onToggleModulePublished={updateModulePublished}
                  onUpdateTitle={updateModuleTitle}
                  dayRefreshTriggers={dayRefreshTriggers}
                  isDraggingOverlay={activeDragId === `module-${module.id}`}
                />
              ))}
            </SortableContext>

            <div className="bg-surface rounded-2xl border border-dashed border-border p-6">
              <h4 className="text-sm font-medium text-dark-text mb-3">
                Add Module
              </h4>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Module title (e.g. Week 1: Intro)"
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addModule();
                  }}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  aria-label="Module title"
                />
                <input
                  type="number"
                  placeholder="Week #"
                  value={newModuleWeek}
                  onChange={(e) => setNewModuleWeek(e.target.value)}
                  className="w-24 bg-background border border-border rounded-lg px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  aria-label="Week number"
                />
                <button
                  onClick={addModule}
                  className="bg-teal-primary text-white px-5 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
                  type="button"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <DragOverlay>
            {activeDragId ? (() => {
              const m = modules.find(mod => `module-${mod.id}` === activeDragId);
              if (!m) return null;
              return (
                <div className="bg-surface rounded-2xl border border-teal-primary shadow-lg px-6 py-4 opacity-95 cursor-grabbing">
                  <p className="font-semibold text-dark-text">{m.title}</p>
                  <p className="text-xs text-muted-text">Week {m.week_number}</p>
                </div>
              );
            })() : null}
          </DragOverlay>
        </DndContext>
      )}
    </>
    </RelocateContext.Provider>
  );
}
