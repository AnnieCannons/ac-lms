"use client";

import { useState, useEffect, useRef, createContext, useContext } from "react";
import { localDate, formatDueDate } from "@/lib/date-utils";
import InlineDueDatePicker from "@/components/ui/InlineDueDatePicker";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import RichTextEditor from "@/components/ui/RichTextEditor";
import DatePickerField from "@/components/ui/DatePickerField";
import FileUpload from "@/components/ui/FileUpload";
import { RUBRIC_TEMPLATES, type RubricItem, type RubricTemplate } from "@/data/rubric-templates";
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
import Link from "next/link";
import { toggleQuizPublished } from "@/lib/quiz-actions";
import { trashAssignment, trashResource, trashModule, trashDay } from "@/lib/trash-actions";
import HtmlContent from "@/components/ui/HtmlContent";
import CreateButton from "@/components/ui/CreateButton";
import { DuplicateAssignmentPopup, DuplicateModulePopup, DuplicateResourcePopup, DuplicateQuizPopup, DuplicateIcon, type DuplicatedAssignment, type DuplicatedModule, type DuplicatedResource, type DuplicatedQuiz } from "@/components/ui/DuplicatePopup";
import WikiBlock from "@/components/ui/WikiBlock";
import { createWiki } from "@/lib/wiki-actions";


type Assignment = {
  id: string;
  title: string;
  due_date: string | null;
  description?: string | null;
  how_to_turn_in?: string | null;
  module_day_id: string;
  published: boolean;
  is_bonus: boolean;
  order: number;
};

const DEFAULT_HOW_TO_TURN_IN =
  "<p>Turn in the link to your assignment here. Make sure you have saved your work and granted access to your instructor(s) if necessary.</p>";

function decodeHtml(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

function getDefaultDueDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59`;
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
            <span className="text-muted-text text-xs shrink-0">☐</span>
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
              className="flex-1 border-0 border-b border-border bg-transparent py-0.5 text-xs font-medium text-dark-text focus:outline-none focus:border-teal-primary transition-colors"
            />
          </div>
          <div className="pl-5">
            <input
              type="text"
              value={item.description}
              onChange={(e) => setField(i, "description", e.target.value)}
              placeholder="Description (optional)"
              className="w-full border-0 bg-transparent py-0.5 text-xs text-muted-text placeholder:text-muted-text/50 focus:outline-none"
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
  linked_day_id?: string | null;
  type: "video" | "reading" | "link" | "file";
  title: string;
  content: string | null;
  description: string | null;
  order: number;
  published: boolean;
};

type QuizEntry = {
  id: string;
  title: string;
  questions: unknown[];
  published: boolean;
  module_title: string;
  day_title: string | null;
  linked_day_id?: string | null;
};

type Wiki = {
  id: string;
  title: string;
  content: string;
  published: boolean;
  order: number;
  module_id: string | null;
  module_day_id: string | null;
};

type Day = {
  id: string;
  day_name: string;
  order: number;
  module_id: string;
  assignments?: Assignment[];
  resources?: Resource[];
  wikis?: Wiki[];
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
  wikis?: Wiki[];
};

const DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

type RelocateCtx = {
  weekOptions: number[];
  weekModules: { id: string; week: number | null; title: string | null; days: string[] }[];
  relocateAssignment: (assignmentId: string, targetWeek: number, targetDay: string) => Promise<void>;
  relocateAssignmentToModule: (assignmentId: string, targetModuleId: string, targetDay: string) => Promise<void>;
  relocateResource: (resourceId: string, targetWeek: number, targetDay: string, onRemoved: () => void) => Promise<void>;
  relocateResourceToModule: (resourceId: string, targetModuleId: string, targetDay: string, onMoved?: () => void) => Promise<void>;
};
const RelocateContext = createContext<RelocateCtx | null>(null);
const ReadOnlyContext = createContext(false);

// ─── AssignmentCard ───────────────────────────────────────────────────────────

function AssignmentCard({
  assignment,
  dayId,
  moduleId,
  weekNumber,
  dayName,
  courseId,
  onOpen,
  onDelete,
  onTogglePublished,
  onDuplicated,
}: {
  assignment: Assignment;
  dayId: string;
  moduleId: string;
  weekNumber: number | null;
  dayName: string;
  courseId: string;
  onOpen: (assignment: Assignment, dayId: string) => void;
  onDelete: (id: string, title: string) => void;
  onTogglePublished: (id: string, current: boolean) => void;
  onDuplicated: (assignment: DuplicatedAssignment, targetDayId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `assignment-${assignment.id}`,
    data: { type: "assignment", assignmentId: assignment.id, sourceDayId: dayId },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const ctx = useContext(RelocateContext);
  const readOnly = useContext(ReadOnlyContext);
  const [relocOpen, setRelocOpen] = useState(false);
  const [relocModule, setRelocModule] = useState(moduleId);
  const [relocDay, setRelocDay] = useState(DAY_OPTIONS.includes(dayName) ? dayName : "");
  const relocBtnRef = useRef<HTMLButtonElement>(null);
  const relocPopupRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

  const [copyOpen, setCopyOpen] = useState(false);
  const copyBtnRef = useRef<HTMLButtonElement>(null);
  const copyPopupRef = useRef<HTMLDivElement>(null);
  const [copyPopupPos, setCopyPopupPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!relocOpen) return;
    function onDown(e: MouseEvent) {
      if (!relocPopupRef.current?.contains(e.target as Node) && !relocBtnRef.current?.contains(e.target as Node))
        setRelocOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [relocOpen]);

  useEffect(() => {
    if (!copyOpen) return;
    function onDown(e: MouseEvent) {
      if (!copyPopupRef.current?.contains(e.target as Node) && !copyBtnRef.current?.contains(e.target as Node))
        setCopyOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [copyOpen]);

  function openReloc() {
    if (relocOpen) { setRelocOpen(false); return; }
    if (relocBtnRef.current) {
      const r = relocBtnRef.current.getBoundingClientRect();
      const popH = 280;
      const popW = 280;
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow < popH ? Math.max(8, r.top - popH - 4) : r.bottom + 4;
      setPopupPos({ top, left: Math.min(r.left, window.innerWidth - popW - 8) });
    }
    setRelocModule(moduleId);
    setRelocDay(DAY_OPTIONS.includes(dayName) ? dayName : "");
    setRelocOpen(true);
  }

  function applyReloc() {
    if (!ctx || !relocModule) return;
    const modDays = ctx.weekModules.find(m => m.id === relocModule)?.days ?? [];
    const targetDay = relocDay || (modDays.length === 1 ? modDays[0] : "");
    if (!targetDay) return;
    ctx.relocateAssignmentToModule(assignment.id, relocModule, targetDay);
    setRelocOpen(false);
  }

  function openCopy() {
    if (copyOpen) { setCopyOpen(false); return; }
    if (copyBtnRef.current) {
      const r = copyBtnRef.current.getBoundingClientRect();
      const popH = 300;
      const popW = 300;
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow < popH ? Math.max(8, r.top - popH - 4) : r.bottom + 4;
      setCopyPopupPos({ top, left: Math.min(r.left, window.innerWidth - popW - 8) });
    }
    setCopyOpen(true);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-surface rounded-lg border border-border ${isDragging ? "opacity-50 z-50" : ""}`}
    >
      <div className="px-3 py-2 flex items-center gap-2">
        {!readOnly && (
          <button
            {...attributes}
            {...listeners}
            className="text-border hover:text-muted-text cursor-grab shrink-0 focus-visible:ring-2 focus-visible:ring-teal-primary focus-visible:rounded"
            type="button"
            aria-label="Drag assignment"
          >
            ⠿
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpen(assignment, dayId)}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-sm text-dark-text truncate">
            {decodeHtml(assignment.title)}
          </p>
          <p className="text-xs text-muted-text">
            Due:{" "}
            {assignment.due_date ? localDate(assignment.due_date).toLocaleDateString() : "None"}
          </p>
        </button>
        {!readOnly && ctx && (
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              ref={relocBtnRef}
              type="button"
              onClick={openReloc}
              className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${relocOpen ? "border-teal-primary text-teal-primary" : "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary"}`}
              title="Move to module/day"
            >
              ⇄
            </button>
            {relocOpen && (
              <div
                ref={relocPopupRef}
                className="fixed z-50 bg-surface border border-border rounded-xl shadow-lg p-3 flex flex-col gap-2"
                style={{ top: popupPos.top, left: popupPos.left, width: 280, maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}
              >
                <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Move to</p>
                <select
                  value={relocModule}
                  onChange={e => { setRelocModule(e.target.value); setRelocDay(""); }}
                  className="text-xs bg-background border border-border rounded px-2 py-1 text-dark-text focus:outline-none focus:ring-1 focus:ring-teal-primary w-full"
                >
                  {ctx.weekModules.map(({ id, week, title }) => (
                    <option key={id} value={id}>{title ?? (week != null ? `Week ${week}` : "Unassigned")}</option>
                  ))}
                </select>
                {(() => {
                  const modDays = ctx.weekModules.find(m => m.id === relocModule)?.days ?? [];
                  // Show all DAY_OPTIONS (Mon–Fri) plus any extra existing days; new days shown dashed
                  const extraDays = modDays.filter(d => !DAY_OPTIONS.includes(d));
                  const uniqueDays = [...new Set([...extraDays, ...DAY_OPTIONS])];
                  if (modDays.length === 0 && uniqueDays.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1">
                      {uniqueDays.map(d => {
                        const exists = modDays.includes(d);
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setRelocDay(d)}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${relocDay === d ? "bg-teal-primary border-teal-primary text-white" : exists ? "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary" : "border-dashed border-border text-muted-text/60 hover:border-teal-primary hover:text-teal-primary"}`}
                            title={exists ? d : `Create "${d}" day`}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
                <button
                  type="button"
                  onClick={applyReloc}
                  disabled={!relocModule || !relocDay}
                  className="text-xs bg-teal-primary text-white rounded-lg py-1.5 font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  Move
                </button>
              </div>
            )}
          </div>
        )}
        {!readOnly && ctx && (
          <div className="shrink-0" onClick={e => e.stopPropagation()}>
            <button
              ref={copyBtnRef}
              type="button"
              onClick={openCopy}
              className={`shrink-0 transition-colors ${copyOpen ? "text-purple-primary" : "text-muted-text hover:text-purple-primary"}`}
              title="Copy assignment"
            >
              <DuplicateIcon />
            </button>
            {copyOpen && (
              <DuplicateAssignmentPopup
                assignment={{ ...assignment, description: assignment.description ?? null, how_to_turn_in: assignment.how_to_turn_in ?? null }}
                currentCourseId={courseId}
                currentModuleId={moduleId}
                weekModules={ctx.weekModules}
                popupPos={copyPopupPos}
                popupRef={copyPopupRef}
                onClose={() => setCopyOpen(false)}
                onDuplicatedInCourse={onDuplicated}
              />
            )}
          </div>
        )}
        {!readOnly && (
          <>
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
              onClick={() => onDelete(assignment.id, assignment.title)}
              className="text-muted-text hover:text-red-400 shrink-0"
              type="button"
              aria-label="Delete assignment"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── AssignmentFullView ────────────────────────────────────────────────────────

type ActiveView =
  | { mode: "view"; assignment: Assignment; dayId: string; moduleId: string | null; weekNumber: number | null; dayName: string }
  | { mode: "add"; dayId: string };

function AssignmentFullView({
  view,
  courseId,
  onClose,
  onAdd,
  onEdit,
  onDelete,
  onTogglePublished,
  onToggleBonus,
  defaultTemplateId,
}: {
  view: ActiveView;
  courseId: string;
  onClose: () => void;
  onAdd: (dayId: string, title: string, description: string, howToTurnIn: string, dueDate: string | null, checklistItems: RubricItem[]) => Promise<void>;
  onEdit: (id: string, updates: Partial<Pick<Assignment, "title" | "description" | "how_to_turn_in" | "due_date">>) => void;
  onDelete: (id: string, title: string) => void;
  onTogglePublished: (id: string, current: boolean) => void;
  onToggleBonus: (id: string, current: boolean) => void;
  defaultTemplateId?: string;
}) {
  const supabase = createClient();
  const ctx = useContext(RelocateContext);
  const assignment = view.mode === "view" ? view.assignment : null;
  const assignmentId = view.mode === "view" ? view.assignment.id : null;

  // ── View/edit state ──
  const persistKey = `active-assignment-${courseId}`;
  const [editing, setEditing] = useState(() => {
    if (view.mode !== "view" || typeof window === "undefined") return false;
    try {
      const saved = localStorage.getItem(`active-assignment-${courseId}`);
      if (saved) { const p = JSON.parse(saved); return p.assignmentId === view.assignment.id && p.editing === true; }
    } catch { /* ignore */ }
    return false;
  });
  const [editTitle, setEditTitle] = useState(decodeHtml(assignment?.title ?? ""));
  const [editDescription, setEditDescription] = useState(assignment?.description ?? "");
  const [editHowToTurnIn, setEditHowToTurnIn] = useState(assignment?.how_to_turn_in ?? "");
  const [editDueDate, setEditDueDate] = useState(
    assignment?.due_date ? new Date(assignment.due_date).toISOString().slice(0, 16) : ""
  );
  const [viewDueDate, setViewDueDate] = useState(assignment?.due_date ?? null);

  // ── Checklist state ──
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [editChecklistItems, setEditChecklistItems] = useState<RubricItem[]>([]);

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
          if (editing) setEditChecklistItems(data.map(c => ({ text: c.text, description: c.description ?? "" })));
        } else if (data && data.length === 0) {
          if (editing) setEditChecklistItems([]);
          if (defaultTemplateId) {
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
              if (!error && inserted) {
                setChecklistItems(inserted);
                if (editing) setEditChecklistItems(inserted.map(c => ({ text: c.text, description: c.description ?? "" })));
              }
            }
          }
        }
      });
    return () => { cancelled = true; };
  // editing intentionally excluded — only re-run when assignmentId changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  const customTemplates: RubricTemplate[] = (() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("rubric-templates-custom") ?? "[]"); } catch { return []; }
  })();
  const allTemplates = [...RUBRIC_TEMPLATES, ...customTemplates];

  const saveAsCustomTemplate = (items: RubricItem[]) => {
    if (items.filter(i => i.text.trim()).length === 0) return;
    const name = window.prompt("Template name:");
    if (!name?.trim()) return;
    const newTemplate: RubricTemplate = { id: `custom-${Date.now()}`, name: name.trim(), items };
    try {
      const existing: RubricTemplate[] = JSON.parse(localStorage.getItem("rubric-templates-custom") ?? "[]");
      localStorage.setItem("rubric-templates-custom", JSON.stringify([...existing, newTemplate]));
    } catch { /* ignore */ }
  };

  const loadEditTemplate = (templateId: string) => {
    if (templateId === "__none__") { setEditChecklistItems([]); return; }
    if (templateId === "__blank__") { setEditChecklistItems([{ text: "", description: "" }]); return; }
    const template = allTemplates.find(t => t.id === templateId);
    if (template) setEditChecklistItems(template.items.map(i => ({ text: i.text, description: i.description })));
  };

  // ── Dirty / unsaved-changes tracking ──
  const isDirty = editing && (
    editTitle !== decodeHtml(assignment?.title ?? "") ||
    editDescription !== (assignment?.description ?? "") ||
    editHowToTurnIn !== (assignment?.how_to_turn_in ?? "") ||
    editDueDate !== (assignment?.due_date ? new Date(assignment.due_date).toISOString().slice(0, 16) : "")
  );

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const updatePersistEditing = (isEditing: boolean) => {
    try {
      const saved = localStorage.getItem(persistKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (isEditing) localStorage.setItem(persistKey, JSON.stringify({ ...parsed, editing: true }));
        else { const { editing: _, ...rest } = parsed; localStorage.setItem(persistKey, JSON.stringify(rest)); }
      }
    } catch { /* ignore */ }
  };


  const handleBack = () => {
    if (isDirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    onClose();
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
  const [addingSaving, setAddingSaving] = useState(false);

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !assignmentId) return;
    onEdit(assignment!.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      how_to_turn_in: editHowToTurnIn.trim() || null,
      due_date: editDueDate || null,
    });
    // Save checklist to DB
    await supabase.from("checklist_items").delete().eq("assignment_id", assignmentId);
    const toInsert = editChecklistItems.filter(i => i.text.trim());
    if (toInsert.length > 0) {
      const { data } = await supabase.from("checklist_items")
        .insert(toInsert.map((item, idx) => ({
          assignment_id: assignmentId,
          text: item.text.trim(),
          description: item.description?.trim() || null,
          order: idx,
        })))
        .select();
      if (data) setChecklistItems(data);
    } else {
      setChecklistItems([]);
    }
    updatePersistEditing(false);
    setEditing(false);
  };

  const handleAdd = async () => {
    if (!newTitle.trim() || view.mode !== "add" || addingSaving) return;
    setAddingSaving(true);
    await onAdd(view.dayId, newTitle.trim(), newDescription, newHowToTurnIn, newDueDate || null, newChecklist.filter((item) => item.text.trim()));
    setAddingSaving(false);
    onClose();
  };

  const handleDelete = () => {
    if (!assignment) return;
    onDelete(assignment.id, assignment.title);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-muted-text hover:text-dark-text transition-colors"
            type="button"
          >
            ← Back to Module
          </button>
          <div className="flex items-center gap-3">
            {view.mode === "view" && !editing && assignment && (
              <>
                <button
                  onClick={() => onToggleBonus(assignment.id, assignment.is_bonus)}
                  className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                    assignment.is_bonus
                      ? "border-purple-primary text-purple-primary bg-purple-light/20 hover:bg-purple-primary hover:text-white"
                      : "border-border text-muted-text hover:border-purple-primary hover:text-dark-text"
                  }`}
                  type="button"
                >
                  {assignment.is_bonus ? "★ Bonus" : "Bonus?"}
                </button>
                <button
                  onClick={() => onTogglePublished(assignment.id, assignment.published)}
                  className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                    assignment.published
                      ? "border-teal-primary text-teal-primary hover:bg-teal-primary hover:text-white"
                      : "border-border text-muted-text hover:border-muted-text hover:text-dark-text"
                  }`}
                  type="button"
                >
                  {assignment.published ? "● Published" : "○ Draft"}
                </button>
              </>
            )}
            {view.mode === "view" && !editing && assignment && (
              <Link
                href={`/instructor/courses/${courseId}/assignments/${assignment.id}?edit=1`}
                className="text-xs font-semibold px-3 py-1 rounded-full border border-teal-primary text-teal-primary hover:bg-teal-primary hover:text-white transition-colors"
              >
                Edit →
              </Link>
            )}
            {view.mode === "view" && !editing && (
              <button onClick={handleDelete} className="text-xs text-muted-text hover:text-red-500 transition-colors" type="button">
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
                className="text-2xl font-bold text-dark-text bg-transparent border-b-2 border-teal-primary focus:outline-none pb-1 w-full"
              />
              <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col gap-4">
                <div>
                  <p className="text-xs font-bold text-muted-text uppercase tracking-wide mb-2">Instructions</p>
                  <RichTextEditor content={editDescription} onChange={setEditDescription} placeholder="Instructions for the assignment" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-text uppercase tracking-wide mb-2">How to turn this in</p>
                  <RichTextEditor content={editHowToTurnIn} onChange={setEditHowToTurnIn} placeholder="Submission instructions" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-text shrink-0">Due:</label>
                  <div className="flex-1">
                    <DatePickerField withTime value={editDueDate} onChange={setEditDueDate} />
                  </div>
                </div>
                {/* Checklist editor */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-muted-text uppercase tracking-wide">Checklist</p>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {editChecklistItems.some(i => i.text.trim()) && (
                        <button type="button" onClick={() => saveAsCustomTemplate(editChecklistItems)} className="text-xs px-2 py-0.5 rounded border border-border text-muted-text hover:border-muted-text hover:bg-background transition-colors">Save as template</button>
                      )}
                      <button type="button" onClick={() => loadEditTemplate("__blank__")} className="text-xs px-2 py-0.5 rounded border border-border text-muted-text hover:border-muted-text hover:bg-background transition-colors">Blank</button>
                      <button type="button" onClick={() => loadEditTemplate("__none__")} className="text-xs px-2 py-0.5 rounded border border-border text-muted-text hover:border-red-500 hover:text-red-500 transition-colors">None</button>
                      <select value="" onChange={e => { if (e.target.value) loadEditTemplate(e.target.value); }} className="text-xs bg-background border border-border rounded-lg px-2 py-1 text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary">
                        <option value="">Load template…</option>
                        {allTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <ChecklistLineEditor items={editChecklistItems} onChange={setEditChecklistItems} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    if (isDirty && !window.confirm("Discard changes?")) return;
                    setEditing(false);
                    setEditTitle(decodeHtml(assignment!.title));
                    setEditDescription(assignment!.description ?? "");
                    setEditHowToTurnIn(assignment!.how_to_turn_in ?? "");
                    setEditDueDate(assignment!.due_date ? new Date(assignment!.due_date).toISOString().slice(0, 16) : "");
                    updatePersistEditing(false);
                  }}
                  className="text-sm text-muted-text hover:text-dark-text px-4 py-2 transition-colors"
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
                  <h1 className="text-2xl font-bold text-dark-text">{decodeHtml(assignment!.title)}</h1>
                  <div className="mt-1">
                    <InlineDueDatePicker
                      assignmentId={assignment!.id}
                      dueDate={viewDueDate}
                      onSaved={(d) => {
                        setViewDueDate(d)
                        onEdit(assignment!.id, { due_date: d })
                      }}
                    />
                  </div>
                  {ctx && view.mode === "view" && (
                    <div className="flex items-center gap-2 mt-2">
                      <select
                        value={view.moduleId ?? ""}
                        onChange={e => {
                          if (e.target.value)
                            ctx.relocateAssignmentToModule(assignment!.id, e.target.value, view.dayName);
                        }}
                        className="text-xs bg-surface border border-border rounded px-2 py-1 text-muted-text focus:outline-none focus:ring-1 focus:ring-teal-primary max-w-[240px]"
                        title="Module"
                      >
                        {ctx.weekModules.map(({ id, week, title }) => (
                          <option key={id} value={id}>{title ?? (week != null ? `Week ${week}` : "Unassigned")}</option>
                        ))}
                      </select>
                      <select
                        value={DAY_OPTIONS.includes(view.dayName) ? view.dayName : ""}
                        onChange={e => { if (view.moduleId) ctx.relocateAssignmentToModule(assignment!.id, view.moduleId, e.target.value); }}
                        className="text-xs bg-surface border border-border rounded px-2 py-1 text-muted-text focus:outline-none focus:ring-1 focus:ring-teal-primary"
                        title="Day"
                      >
                        <option value="">Day?</option>
                        {DAY_OPTIONS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 mt-1">
                  <a
                    href={`/instructor/courses/${courseId}/assignments/${assignment!.id}/submissions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-text hover:text-dark-text transition-colors"
                  >
                    View Submissions →
                  </a>
                </div>
              </div>

              <div className="bg-surface rounded-2xl border border-border p-6">
                <p className="text-xs font-bold text-muted-text uppercase tracking-wide mb-3">Instructions</p>
                {assignment!.description ? (
                  <HtmlContent
                    html={assignment!.description}
                    className="tiptap text-sm text-dark-text leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:font-bold [&_h2]:text-base [&_h3]:font-semibold [&_strong]:font-bold [&_a]:text-teal-primary"
                  />
                ) : (
                  <p className="text-sm text-muted-text italic">No instructions.</p>
                )}
              </div>

              {assignment!.how_to_turn_in && (
                <div className="bg-surface rounded-2xl border border-border p-6">
                  <p className="text-xs font-bold text-muted-text uppercase tracking-wide mb-3">How to turn this in</p>
                  <HtmlContent
                    html={assignment!.how_to_turn_in}
                    className="tiptap text-sm text-dark-text leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-bold [&_a]:text-teal-primary"
                  />
                </div>
              )}

              <div className="bg-surface rounded-2xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold text-muted-text uppercase tracking-wide">Checklist</p>
                  <Link href={`/instructor/courses/${courseId}/assignments/${assignment!.id}?edit=1`} className="text-xs text-muted-text hover:text-dark-text transition-colors">✎ Edit checklist</Link>
                </div>
                {checklistItems.length === 0 ? (
                  <p className="text-sm text-muted-text italic">No checklist for this assignment.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {checklistItems.map(item => (
                      <div key={item.id}>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-text shrink-0 text-sm">☐</span>
                          <p className="text-sm font-medium text-dark-text">{item.text}</p>
                        </div>
                        {item.description && <p className="pl-5 text-xs text-muted-text mt-0.5">{item.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )
        ) : (
          // ── Add mode ──
          <>
            <h1 className="text-2xl font-bold text-dark-text">New Assignment</h1>
            <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col gap-4">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Assignment title *"
                autoFocus
                className="w-full bg-background border border-border text-dark-text rounded-lg px-3 py-2 text-sm placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
              />
              <div>
                <p className="text-xs font-bold text-muted-text uppercase tracking-wide mb-2">Instructions</p>
                <RichTextEditor key={`desc-${editorKey}`} content={newDescription} onChange={setNewDescription} placeholder="Instructions for the assignment" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-text uppercase tracking-wide mb-2">How to turn this in</p>
                <RichTextEditor key={`htti-${editorKey}`} content={newHowToTurnIn} onChange={setNewHowToTurnIn} placeholder="Submission instructions" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-text shrink-0">Due:</label>
                <div className="flex-1">
                  <DatePickerField withTime value={newDueDate} onChange={setNewDueDate} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-muted-text uppercase tracking-wide">Checklist</p>
                  <div className="flex items-center gap-2">
                    {newChecklist.some(i => i.text.trim()) && (
                      <button type="button" onClick={() => saveAsCustomTemplate(newChecklist)} className="text-xs px-2 py-0.5 rounded border border-border text-muted-text hover:border-muted-text hover:bg-surface transition-colors">Save as template</button>
                    )}
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      e.target.value = "";
                      if (val === "__none__") { setNewChecklist([]); return; }
                      if (val === "__blank__") { setNewChecklist([{ text: "", description: "" }]); return; }
                      const template = allTemplates.find((t) => t.id === val);
                      if (template) setNewChecklist(template.items.map((item) => ({ text: item.text, description: item.description })));
                    }}
                    className="text-xs bg-background border border-border rounded-lg px-2 py-1 text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  >
                    <option value="">Load template…</option>
                    <option value="__blank__">Blank</option>
                    <option value="__none__">None (no checklist)</option>
                    {allTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  </div>
                </div>
                <ChecklistLineEditor items={newChecklist} onChange={setNewChecklist} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="text-sm text-muted-text hover:text-dark-text px-4 py-2 transition-colors" type="button">
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={addingSaving}
                className="bg-teal-primary text-white text-sm font-semibold px-6 py-2 rounded-full hover:opacity-90 disabled:opacity-50"
                type="button"
              >
                {addingSaving ? "Adding…" : "Add Assignment"}
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
  courseId,
  onDuplicatedAssignment,
}: {
  day: Day;
  weekNumber: number | null;
  assignments: Assignment[];
  onOpenAssignment: (assignment: Assignment, dayId: string) => void;
  onOpenAdd: (dayId: string) => void;
  onDeleteAssignment: (assignmentId: string, title: string) => void;
  onTogglePublished: (id: string, current: boolean) => void;
  courseId: string;
  onDuplicatedAssignment: (assignment: DuplicatedAssignment, targetDayId: string) => void;
}) {
  const readOnly = useContext(ReadOnlyContext);
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${day.id}`,
    data: { type: "day-drop", dayId: day.id },
  });

  const sorted = [...assignments].sort((a, b) => a.order - b.order);
  const showBlock = sorted.length > 0 || isOver;

  return (
    <div className={showBlock ? "bg-surface/60 rounded-xl p-3" : ""}>
      {showBlock && (
        <p className="text-sm font-bold text-muted-text uppercase tracking-wide mb-2">
          Assignments
        </p>
      )}
      <SortableContext
        items={sorted.map((a) => `assignment-${a.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={`flex flex-col gap-2 rounded-lg p-1 transition-colors ${
            showBlock ? "min-h-[48px]" : "min-h-0"
          } ${isOver ? "bg-teal-light border border-dashed border-teal-primary/50" : ""}`}
        >
          {isOver && sorted.length === 0 && (
            <p className="text-xs text-muted-text py-2 px-1">Drop here</p>
          )}
          {sorted.map((a) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              dayId={day.id}
              moduleId={day.module_id}
              weekNumber={weekNumber}
              dayName={day.day_name}
              courseId={courseId}
              onOpen={onOpenAssignment}
              onDelete={onDeleteAssignment}
              onTogglePublished={onTogglePublished}
              onDuplicated={onDuplicatedAssignment}
            />
          ))}
        </div>
      </SortableContext>
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
  moduleId,
  courseId,
  dayId,
  onEdit,
  onDelete,
  onRelocated,
  onTogglePublished,
}: {
  resource: Resource;
  weekNumber: number | null;
  moduleId: string;
  courseId: string;
  dayId: string;
  onEdit: (id: string, updates: Partial<Pick<Resource, "type" | "title" | "content" | "description">>) => void;
  onDelete: (id: string, title: string) => void;
  onRelocated: () => void;
  onTogglePublished: (id: string, current: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `resource-${resource.id}`,
    data: { type: "resource", resourceId: resource.id, sourceDayId: dayId },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const ctx = useContext(RelocateContext);
  const readOnly = useContext(ReadOnlyContext);
  const [relocOpen, setRelocOpen] = useState(false);
  const [relocModule, setRelocModule] = useState(moduleId);
  const [relocDay, setRelocDay] = useState("");
  const relocBtnRef = useRef<HTMLButtonElement>(null);
  const relocPopupRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!relocOpen) return;
    function onDown(e: MouseEvent) {
      if (!relocPopupRef.current?.contains(e.target as Node) && !relocBtnRef.current?.contains(e.target as Node))
        setRelocOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [relocOpen]);

  function openReloc() {
    if (relocOpen) { setRelocOpen(false); return; }
    if (relocBtnRef.current) {
      const r = relocBtnRef.current.getBoundingClientRect();
      const popH = 280; const popW = 280;
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow < popH ? Math.max(8, r.top - popH - 4) : r.bottom + 4;
      setPopupPos({ top, left: Math.min(r.left, window.innerWidth - popW - 8) });
    }
    setRelocModule(moduleId);
    setRelocDay("");
    setRelocOpen(true);
  }

  function applyReloc() {
    if (!ctx || !relocModule || !relocDay) return;
    ctx.relocateResourceToModule(resource.id, relocModule, relocDay, onRelocated);
    setRelocOpen(false);
  }

  const [resCopyOpen, setResCopyOpen] = useState(false);
  const resCopyBtnRef = useRef<HTMLButtonElement>(null);
  const resCopyPopupRef = useRef<HTMLDivElement>(null);
  const [resCopyPopupPos, setResCopyPopupPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!resCopyOpen) return;
    function onDown(e: MouseEvent) {
      if (!resCopyPopupRef.current?.contains(e.target as Node) && !resCopyBtnRef.current?.contains(e.target as Node))
        setResCopyOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [resCopyOpen]);

  function openResCopy() {
    if (resCopyOpen) { setResCopyOpen(false); return; }
    if (resCopyBtnRef.current) {
      const r = resCopyBtnRef.current.getBoundingClientRect();
      const popH = 300; const popW = 300;
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow < popH ? Math.max(8, r.top - popH - 4) : r.bottom + 4;
      setResCopyPopupPos({ top, left: Math.min(r.left, window.innerWidth - popW - 8) });
    }
    setResCopyOpen(true);
  }

  const [editing, setEditing] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
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
        ) : editType === "reading" ? (
          <RichTextEditor content={editContent} onChange={setEditContent} placeholder="Reading content" />
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
      className={`bg-surface rounded-lg border border-border px-3 py-2 flex gap-2 ${readingOpen ? 'items-start' : 'items-center'}`}
    >
      {!readOnly && (
        <button
          {...attributes}
          {...listeners}
          className="text-border hover:text-muted-text cursor-grab shrink-0 focus-visible:ring-2 focus-visible:ring-teal-primary focus-visible:rounded"
          type="button"
          aria-label="Drag resource"
        >
          ⠿
        </button>
      )}
      <span className={`text-xs bg-teal-light text-teal-primary rounded px-1.5 py-0.5 shrink-0${readingOpen ? ' mt-0.5' : ''}`}>
        {RESOURCE_TYPE_LABELS[resource.type]}
      </span>
      <div className="flex-1 min-w-0 group">
        {readOnly ? (
          resource.type === 'link' && resource.content ? (
            <a
              href={resource.content.startsWith("http") ? resource.content : `https://${resource.content}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-dark-text truncate hover:text-teal-primary transition-colors block"
              onClick={(e) => e.stopPropagation()}
            >
              {resource.title}
            </a>
          ) : resource.type === 'reading' && resource.content ? (
            <button
              type="button"
              onClick={() => setReadingOpen(v => !v)}
              className="text-xs font-medium text-dark-text hover:text-teal-primary transition-colors w-full text-left flex items-center justify-between gap-2"
            >
              <span className="truncate">{resource.title}</span>
              <span className="text-muted-text shrink-0 text-[10px]">{readingOpen ? '▲' : '▼'}</span>
            </button>
          ) : (
            <p className="text-xs font-medium text-dark-text truncate">{resource.title}</p>
          )
        ) : resource.type === 'link' && resource.content ? (
          <div className="flex items-center gap-1">
            <a
              href={resource.content.startsWith("http") ? resource.content : `https://${resource.content}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-dark-text truncate hover:text-teal-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {resource.title}
            </a>
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-teal-primary shrink-0 text-xs"
              type="button"
            >
              ✎
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-dark-text truncate hover:text-teal-primary transition-colors w-full text-left flex items-center gap-1"
            type="button"
          >
            {resource.title}
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-teal-primary shrink-0">✎</span>
          </button>
        )}
        {resource.description && (
          <p className="text-xs text-muted-text truncate">{resource.description}</p>
        )}
        {readOnly && resource.type === 'reading' && resource.content && readingOpen && (
          <div className="mt-2 p-4 bg-background rounded-lg border border-border prose prose-sm max-w-none text-dark-text">
            <HtmlContent html={resource.content} />
          </div>
        )}
        {resource.content && resource.type !== "reading" && resource.type !== "link" && (() => {
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
      {!readOnly && ctx && (
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            ref={relocBtnRef}
            type="button"
            onClick={openReloc}
            className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${relocOpen ? "border-teal-primary text-teal-primary" : "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary"}`}
            title="Move to module/day"
          >
            ⇄
          </button>
          {relocOpen && (
            <div
              ref={relocPopupRef}
              className="fixed z-50 bg-surface border border-border rounded-xl shadow-lg p-3 flex flex-col gap-2"
              style={{ top: popupPos.top, left: popupPos.left, width: 280, maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}
            >
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Move to</p>
              <select
                value={relocModule}
                onChange={e => { setRelocModule(e.target.value); setRelocDay(""); }}
                className="text-xs bg-background border border-border rounded px-2 py-1 text-dark-text focus:outline-none focus:ring-1 focus:ring-teal-primary w-full"
              >
                {ctx.weekModules.map(({ id, week, title }) => (
                  <option key={id} value={id}>{title ?? (week != null ? `Week ${week}` : "Unassigned")}</option>
                ))}
              </select>
              {(() => {
                const modDays = ctx.weekModules.find(m => m.id === relocModule)?.days ?? [];
                const extraDays = modDays.filter(d => !DAY_OPTIONS.includes(d));
                const uniqueDays = [...new Set([...extraDays, ...DAY_OPTIONS])];
                return (
                  <div className="flex flex-wrap gap-1">
                    {uniqueDays.map(d => {
                      const exists = modDays.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setRelocDay(d)}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${relocDay === d ? "bg-teal-primary border-teal-primary text-white" : exists ? "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary" : "border-dashed border-border text-muted-text/60 hover:border-teal-primary hover:text-teal-primary"}`}
                          title={exists ? d : `Create "${d}" day`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
              <button
                type="button"
                onClick={applyReloc}
                disabled={!relocModule || !relocDay}
                className="text-xs bg-teal-primary text-white rounded-lg py-1.5 font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Move
              </button>
            </div>
          )}
        </div>
      )}
      {!readOnly && ctx && (
        <div className="shrink-0" onClick={e => e.stopPropagation()}>
          <button
            ref={resCopyBtnRef}
            type="button"
            onClick={openResCopy}
            className={`shrink-0 transition-colors ${resCopyOpen ? "text-purple-primary" : "text-muted-text hover:text-purple-primary"}`}
            title="Copy resource"
          >
            <DuplicateIcon />
          </button>
          {resCopyOpen && (
            <DuplicateResourcePopup
              resource={resource}
              currentCourseId={courseId}
              currentModuleId={moduleId}
              weekModules={ctx.weekModules}
              popupPos={resCopyPopupPos}
              popupRef={resCopyPopupRef}
              onClose={() => setResCopyOpen(false)}
              onDuplicatedInCourse={() => setResCopyOpen(false)}
            />
          )}
        </div>
      )}
      {!readOnly && (
        <button
          onClick={() => onTogglePublished(resource.id, resource.published)}
          className={`text-xs shrink-0 font-medium px-2 py-0.5 rounded-full border transition-colors ${
            resource.published
              ? "border-teal-primary text-teal-primary hover:bg-teal-primary hover:text-white"
              : "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary"
          }`}
          type="button"
          aria-label={resource.published ? "Published — click to unpublish" : "Draft — click to publish"}
        >
          {resource.published ? "Published" : "Draft"}
        </button>
      )}
      {!readOnly && (
        <button
          onClick={() => onDelete(resource.id, resource.title)}
          className="text-muted-text hover:text-red-400 shrink-0"
          type="button"
          aria-label="Delete resource"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      )}
    </div>
  );
}

// ─── AddDropdown ──────────────────────────────────────────────────────────────

function AddDropdown({ onAddAssignment, onAddResource, onAddWiki, onAddQuiz }: {
  onAddAssignment: () => void
  onAddResource: () => void
  onAddWiki: () => void
  onAddQuiz: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs font-semibold text-teal-primary hover:opacity-80 transition-opacity"
      >
        + Add <span aria-hidden="true" className="text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-50 min-w-[130px] py-1">
          {[
            { label: 'Assignment', action: onAddAssignment },
            { label: 'Resource',   action: onAddResource   },
            { label: 'Quiz',       action: onAddQuiz       },
            { label: 'Wiki',       action: onAddWiki       },
          ].map(({ label, action }) => (
            <button
              key={label}
              type="button"
              onClick={() => { setOpen(false); action() }}
              className="w-full text-left px-3 py-2 text-xs text-dark-text hover:bg-border/20 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── DraggableQuizCard ────────────────────────────────────────────────────────

function DraggableQuizCard({
  quiz,
  dayId,
  moduleTitle,
  courseId,
  onPublishToggled,
  onDuplicated,
}: {
  quiz: QuizEntry;
  dayId: string;
  moduleTitle: string;
  courseId: string;
  onPublishToggled: (quizId: string, newPublished: boolean) => void;
  onDuplicated: (newQuiz: DuplicatedQuiz) => void;
}) {
  const readOnly = useContext(ReadOnlyContext);
  const ctx = useContext(RelocateContext);

  const displayTitle = quiz.title.startsWith("Quiz: ") ? quiz.title.slice(6) : quiz.title;
  const questionCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
  const isCrossPosted = !!quiz.linked_day_id && quiz.linked_day_id === dayId;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `quiz-${quiz.id}`,
    data: { type: "quiz", quizId: quiz.id, sourceDayId: dayId, sourceModuleTitle: moduleTitle },
    disabled: readOnly || isCrossPosted,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)`, opacity: isDragging ? 0.4 : 1 }
    : undefined;

  const [copyOpen, setCopyOpen] = useState(false);
  const [copyPos, setCopyPos] = useState({ top: 0, left: 0 });
  const copyPopupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!copyOpen) return;
    function onDown(e: MouseEvent) {
      if (!copyPopupRef.current?.contains(e.target as Node)) setCopyOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [copyOpen]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-surface rounded-lg border px-3 py-2 flex items-center gap-2 ${isCrossPosted ? "border-purple-primary/30" : "border-border"}`}
    >
      {!readOnly && !isCrossPosted && (
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="text-border hover:text-muted-text cursor-grab shrink-0 focus-visible:ring-2 focus-visible:ring-teal-primary focus-visible:rounded"
          aria-label="Drag quiz"
        >
          ⠿
        </button>
      )}
      <Link href={`/instructor/courses/${courseId}/quizzes?open=${quiz.id}`} className="flex-1 min-w-0">
        <p className="text-sm text-dark-text truncate hover:text-teal-primary transition-colors">{displayTitle}</p>
        <p className="text-xs text-muted-text">
          {questionCount} question{questionCount !== 1 ? "s" : ""}
        </p>
      </Link>
      {isCrossPosted && (
        <span className="text-xs font-medium bg-purple-light text-purple-primary rounded px-1.5 py-0.5 shrink-0">
          Career Dev
        </span>
      )}
      {!readOnly && ctx && (
        <button
          type="button"
          title="Copy quiz"
          onClick={(e) => {
            if (copyOpen) { setCopyOpen(false); return; }
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const popH = 300; const popW = 300;
            const spaceBelow = window.innerHeight - r.bottom;
            const top = spaceBelow < popH ? Math.max(8, r.top - popH - 4) : r.bottom + 4;
            setCopyPos({ top, left: Math.min(r.left, window.innerWidth - popW - 8) });
            setCopyOpen(true);
          }}
          className={`shrink-0 transition-colors ${copyOpen ? "text-purple-primary" : "text-muted-text hover:text-purple-primary"}`}
        >
          <DuplicateIcon />
        </button>
      )}
      {copyOpen && ctx && (
        <DuplicateQuizPopup
          quiz={quiz}
          currentCourseId={courseId}
          weekModules={ctx.weekModules}
          popupPos={copyPos}
          popupRef={copyPopupRef}
          onClose={() => setCopyOpen(false)}
          onDuplicatedInCourse={(newQ) => {
            onDuplicated(newQ);
            setCopyOpen(false);
          }}
        />
      )}
      {!readOnly && (
        <button
          type="button"
          onClick={async () => {
            const newPublished = !quiz.published;
            onPublishToggled(quiz.id, newPublished);
            try {
              await toggleQuizPublished(quiz.id, courseId, newPublished);
            } catch {
              onPublishToggled(quiz.id, quiz.published);
            }
          }}
          className={`text-xs shrink-0 font-medium px-2 py-0.5 rounded-full border transition-colors ${
            quiz.published
              ? "border-teal-primary text-teal-primary hover:bg-teal-primary hover:text-white"
              : "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary"
          }`}
        >
          {quiz.published ? "Published" : "Draft"}
        </button>
      )}
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
  onDuplicatedAssignment,
  courseId,
  quizzesForDay,
  forceOpen,
  onWikiCreated,
  onWikiUpdated,
  onWikiPublishToggled,
  onWikiDeleted,
  moduleTitle,
  onRegisterResources,
}: {
  day: Day;
  weekNumber: number | null;
  refreshTrigger: number;
  onDelete: (id: string, name: string) => void;
  onOpenAssignment: (assignment: Assignment, dayId: string) => void;
  onOpenAdd: (dayId: string) => void;
  onDeleteAssignment: (assignmentId: string, title: string) => void;
  onTogglePublished: (id: string, current: boolean) => void;
  onDuplicatedAssignment: (assignment: DuplicatedAssignment, targetDayId: string) => void;
  courseId: string;
  quizzesForDay: QuizEntry[];
  forceOpen?: number;
  onWikiCreated: (wiki: Wiki) => void;
  onWikiUpdated: (wikiId: string, title: string, content: string) => void;
  onWikiPublishToggled: (wikiId: string, published: boolean) => void;
  onWikiDeleted: (wikiId: string) => void;
  moduleTitle: string;
  onRegisterResources: (dayId: string, getResources: () => Resource[], setResources: React.Dispatch<React.SetStateAction<Resource[]>>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: `day-${day.id}`,
      data: { type: "day", moduleId: day.module_id },
    });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const readOnly = useContext(ReadOnlyContext);
  const ctx = useContext(RelocateContext);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);
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
      .or(`module_day_id.eq.${day.id},linked_day_id.eq.${day.id}`)
      .is("deleted_at", null)
      .order("order")
      .then(({ data }) => {
        if (data) setResources(data);
      });
  }, [day.id, refreshTrigger]);

  const [dayNameDraft, setDayNameDraft] = useState(day.day_name);
  const [editingDayName, setEditingDayName] = useState(false);

  const saveDayName = async () => {
    setEditingDayName(false);
    const trimmed = dayNameDraft.trim();
    if (!trimmed || trimmed === day.day_name) {
      setDayNameDraft(day.day_name);
      return;
    }
    setDayNameDraft(trimmed);
    await supabase.from("module_days").update({ day_name: trimmed }).eq("id", day.id);
  };

  const [crossPostedAssignments, setCrossPostedAssignments] = useState<Array<Assignment & { crossPosted: true }>>([]);
  useEffect(() => {
    supabase
      .from("assignments")
      .select("*")
      .eq("linked_day_id", day.id)
      .then(({ data }) => {
        if (data) setCrossPostedAssignments(data.map(a => ({ ...a, crossPosted: true as const })));
      });
  }, [day.id, refreshTrigger]);

  const [quizzes, setQuizzes] = useState<QuizEntry[]>(quizzesForDay);
  const quizzesKey = quizzesForDay.map(q => `${q.id}:${q.published}`).join(',');
  useEffect(() => {
    setQuizzes(quizzesForDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizzesKey]);


  // Register resource state with outer DndContext for cross-day moves
  useEffect(() => {
    onRegisterResources(day.id, () => resourcesRef.current, setResources);
  }, [day.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const deleteResource = async (id: string, title: string) => {
    if (!window.confirm(`Move "${title}" to trash?`)) return;
    const { error } = await trashResource(id, courseId);
    if (error) { alert(error); return; }
    setResources((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleResourcePublished = async (id: string, current: boolean) => {
    const next = !current;
    setResources((prev) => prev.map((r) => (r.id === id ? { ...r, published: next } : r)));
    await supabase.from("resources").update({ published: next }).eq("id", id);
  };

  const [newResType, setNewResType] = useState<Resource["type"]>("link");
  const [newResTitle, setNewResTitle] = useState("");
  const [newResContent, setNewResContent] = useState("");
  const [fileUploadKey, setFileUploadKey] = useState(0);
  const [showAddResource, setShowAddResource] = useState(false);
  const assignmentTriggerRef = useRef<HTMLDivElement>(null);
  const quizTriggerRef = useRef<HTMLDivElement>(null);

  const handleAddWiki = async () => {
    const result = await createWiki({ moduleDayId: day.id, title: 'New Wiki' })
    if (result.error) { alert(`Failed to create wiki: ${result.error}`); return }
    if (result.data) onWikiCreated(result.data)
  };

  const submitNewResource = () => {
    if (!newResTitle.trim()) return;
    addResource(newResType, newResTitle.trim(), newResType === "reading" ? newResContent : newResContent.trim());
    setNewResTitle("");
    setNewResContent("");
    setFileUploadKey((k) => k + 1);
    setShowAddResource(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-background rounded-lg">
      <div
        className="flex items-center gap-2 sm:gap-3 px-4 py-2 cursor-pointer"
        onClick={() => !editingDayName && setOpen((v) => !v)}
      >
        {!readOnly && (
          <button
            {...attributes}
            {...listeners}
            className="hidden sm:block text-border hover:text-muted-text cursor-grab focus-visible:ring-2 focus-visible:ring-teal-primary focus-visible:rounded"
            aria-label={`Drag day ${day.day_name}`}
            type="button"
            onClick={(e) => e.stopPropagation()}
          >
            ⠿
          </button>
        )}

        <div className="flex-1 flex items-center gap-2 min-w-0">
          {!readOnly && editingDayName ? (
            <input
              autoFocus
              value={dayNameDraft}
              onChange={(e) => setDayNameDraft(e.target.value)}
              onBlur={saveDayName}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); saveDayName(); }
                if (e.key === "Escape") { setDayNameDraft(day.day_name); setEditingDayName(false); }
              }}
              className="text-sm text-dark-text bg-background border border-teal-primary rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-teal-primary w-40"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="text-sm text-dark-text text-left flex items-center gap-2"
              aria-expanded={open}
            >
              <span
                onDoubleClick={!readOnly ? (e) => { e.stopPropagation(); setEditingDayName(true); } : undefined}
                title={!readOnly ? "Double-click to rename" : undefined}
              >
                {dayNameDraft}
              </span>
              <span className="text-xs text-muted-text">
                ({assignments.length + crossPostedAssignments.length + resources.length + quizzes.length})
              </span>
            </div>
          )}
        </div>

        {!readOnly && (
          <AddDropdown
            onAddAssignment={() => assignmentTriggerRef.current?.querySelector('button')?.click()}
            onAddResource={() => setShowAddResource(true)}
            onAddWiki={handleAddWiki}
            onAddQuiz={() => quizTriggerRef.current?.querySelector('button')?.click()}
          />
        )}
        {!readOnly && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(day.id, day.day_name); }}
            className="text-muted-text hover:text-red-400"
            aria-label={`Delete day ${dayNameDraft}`}
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        )}
      </div>
      {/* Hidden assignment create trigger */}
      {!readOnly && (
        <div ref={assignmentTriggerRef} className="hidden">
          <CreateButton courseId={courseId} compact defaultType="assignment" defaultModuleId={day.module_id} defaultDayId={day.id} />
        </div>
      )}
      {/* Hidden quiz create trigger */}
      {!readOnly && (
        <div ref={quizTriggerRef} className="hidden">
          <CreateButton courseId={courseId} compact defaultType="quiz" defaultModuleId={day.module_id} defaultDayId={day.id} />
        </div>
      )}

      {open && (
        <div
          id={`day-panel-${day.id}`}
          className="px-4 sm:px-10 pb-4 pt-2 border-t border-border flex flex-col gap-4"
        >
          {/* Day Wikis */}
          {(day.wikis ?? []).length > 0 && (
            <div className="flex flex-col gap-2">
              {(day.wikis ?? []).map(wiki => (
                <WikiBlock
                  key={wiki.id}
                  wiki={wiki}
                  onUpdate={onWikiUpdated}
                  onTogglePublished={onWikiPublishToggled}
                  onDelete={onWikiDeleted}
                />
              ))}
            </div>
          )}

          {/* Resources — only show if there are resources, or this is a resource-focused day */}
          {(() => {
              const nativeResources = resources.filter(r => r.module_day_id === day.id);
              const crossPostedResources = resources.filter(r => r.linked_day_id === day.id);
              const isResourceDay = ['Resources', 'Wiki'].includes(day.day_name ?? '');
              if (!isResourceDay && nativeResources.length === 0 && crossPostedResources.length === 0 && !showAddResource) return null;
              return (
          <div className="bg-surface/60 rounded-xl p-3">
            <p className="text-sm font-bold text-muted-text uppercase tracking-wide mb-2">
              Resources
            </p>
            {(() => {
              return (
                <>
                  <SortableContext
                    items={nativeResources.map((r) => `resource-${r.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-1.5 mb-2">
                      {nativeResources.map((r) => (
                        <SortableResource
                          key={r.id}
                          resource={r}
                          weekNumber={weekNumber}
                          moduleId={day.module_id}
                          courseId={courseId}
                          dayId={day.id}
                          onEdit={editResource}
                          onDelete={deleteResource}
                          onRelocated={() => setResources(prev => prev.filter(res => res.id !== r.id))}
                          onTogglePublished={toggleResourcePublished}
                        />
                      ))}
                    </div>
                  </SortableContext>
                  {crossPostedResources.length > 0 && (
                    <div className="flex flex-col gap-1.5 mb-2">
                      {crossPostedResources.map(r => (
                        <div key={r.id} className="bg-surface rounded-lg border border-purple-primary/30 px-3 py-2 flex items-center gap-2">
                          <span className="flex-1 min-w-0 text-sm text-dark-text truncate">{r.title}</span>
                          <span className="text-xs font-medium bg-purple-light text-purple-primary rounded px-1.5 py-0.5 shrink-0">Career Dev</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            {!readOnly && (
              showAddResource ? (
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
                      autoFocus
                      type="text"
                      placeholder="Title"
                      value={newResTitle}
                      onChange={(e) => setNewResTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") submitNewResource(); }}
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                    />
                    <button
                      onClick={() => { setShowAddResource(false); setNewResTitle(""); setNewResContent(""); }}
                      className="text-muted-text hover:text-dark-text text-xs px-1"
                      type="button"
                      aria-label="Cancel"
                    >✕</button>
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
                    ) : newResType === "reading" ? (
                      <div className="flex-1">
                        <RichTextEditor key={fileUploadKey} content={newResContent} onChange={setNewResContent} placeholder="Reading content…" />
                      </div>
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
              ) : null
            )}
          </div>
              );
          })()}

          {/* Assignments — hidden for resource-only days */}
          {!/resource/i.test(day.day_name) && day.day_name !== "Wiki" && (
            <AssignmentDropZone
              day={day}
              weekNumber={weekNumber}
              assignments={assignments}
              onOpenAssignment={onOpenAssignment}
              onOpenAdd={onOpenAdd}
              onDeleteAssignment={onDeleteAssignment}
              onTogglePublished={onTogglePublished}
              courseId={courseId}
              onDuplicatedAssignment={onDuplicatedAssignment}
            />
          )}

          {/* Cross-posted assignments from Career Dev */}
          {crossPostedAssignments.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {crossPostedAssignments.map(a => (
                <div key={a.id} className="bg-surface rounded-lg border border-purple-primary/30 px-3 py-2 flex items-center gap-2">
                  <Link
                    href={`/instructor/courses/${courseId}/assignments/${a.id}`}
                    className="flex-1 min-w-0 text-sm text-dark-text truncate hover:text-teal-primary transition-colors"
                  >
                    {decodeHtml(a.title)}
                  </Link>
                  <span className="text-xs font-medium bg-purple-light text-purple-primary rounded px-1.5 py-0.5 shrink-0">Career Dev</span>
                </div>
              ))}
            </div>
          )}

          {/* Quizzes */}
          {quizzes.length > 0 && (
            <div className="bg-surface/60 rounded-xl p-3">
              <p className="text-sm font-bold text-muted-text uppercase tracking-wide mb-2">
                Quizzes
              </p>
              <div className="flex flex-col gap-1.5">
                {quizzes.map(quiz => (
                  <DraggableQuizCard
                    key={quiz.id}
                    quiz={quiz}
                    dayId={day.id}
                    moduleTitle={moduleTitle}
                    courseId={courseId}
                    onPublishToggled={(quizId, newPublished) =>
                      setQuizzes(prev => prev.map(q => q.id === quizId ? { ...q, published: newPublished } : q))
                    }
                    onDuplicated={(newQ) =>
                      setQuizzes(prev => [...prev, { ...newQ, linked_day_id: null }])
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SortableModule ───────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: '', label: 'Unassigned' },
  { value: 'syllabus', label: 'Course Outline' },
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
  onUpdateWeekNumber,
  onDuplicatedAssignment,
  onDuplicatedModule,
  dayRefreshTriggers,
  isDraggingOverlay = false,
  allQuizzes,
  expandDays,
  onWikiCreated,
  onWikiUpdated,
  onWikiPublishToggled,
  onWikiDeleted,
  onRegisterResources,
}: {
  module: Module;
  courseId: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: (id: string, title: string) => void;
  onAddDay: (moduleId: string, dayName: string) => void;
  onDeleteDay: (dayId: string, moduleId: string, name: string) => void;
  onOpenAssignment: (assignment: Assignment, dayId: string) => void;
  onOpenAdd: (dayId: string) => void;
  onDeleteAssignment: (assignmentId: string, title: string) => void;
  onTogglePublished: (id: string, current: boolean) => void;
  onUpdateCategory: (moduleId: string, category: string | null) => void;
  onToggleModulePublished: (id: string, current: boolean) => void;
  onUpdateTitle: (moduleId: string, title: string) => void;
  onUpdateWeekNumber: (moduleId: string, weekNumber: number) => void;
  onDuplicatedAssignment: (assignment: DuplicatedAssignment, targetDayId: string) => void;
  onDuplicatedModule: (newModule: DuplicatedModule) => void;
  dayRefreshTriggers: Record<string, number>;
  isDraggingOverlay?: boolean;
  allQuizzes: QuizEntry[];
  expandDays?: number;
  onWikiCreated: (wiki: Wiki) => void;
  onWikiUpdated: (wikiId: string, title: string, content: string) => void;
  onWikiPublishToggled: (wikiId: string, published: boolean) => void;
  onWikiDeleted: (wikiId: string) => void;
  onRegisterResources: (dayId: string, getResources: () => Resource[], setResources: React.Dispatch<React.SetStateAction<Resource[]>>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: `module-${module.id}`,
      data: { type: "module" },
    });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const readOnly = useContext(ReadOnlyContext);
  const [newDayName, setNewDayName] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(module.title);
  const [editingWeek, setEditingWeek] = useState(false);
  const [weekDraft, setWeekDraft] = useState(String(module.week_number ?? ''));

  const [modCopyOpen, setModCopyOpen] = useState(false);
  const modCopyBtnRef = useRef<HTMLButtonElement>(null);
  const modCopyPopupRef = useRef<HTMLDivElement>(null);
  const [modCopyPopupPos, setModCopyPopupPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!modCopyOpen) return;
    function onDown(e: MouseEvent) {
      if (!modCopyPopupRef.current?.contains(e.target as Node) && !modCopyBtnRef.current?.contains(e.target as Node))
        setModCopyOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [modCopyOpen]);

  function openModCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (modCopyOpen) { setModCopyOpen(false); return; }
    if (modCopyBtnRef.current) {
      const r = modCopyBtnRef.current.getBoundingClientRect();
      const popH = 200;
      const popW = 280;
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow < popH ? Math.max(8, r.top - popH - 4) : r.bottom + 4;
      setModCopyPopupPos({ top, left: Math.min(r.left, window.innerWidth - popW - 8) });
    }
    setModCopyOpen(true);
  }

  const saveTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== module.title) onUpdateTitle(module.id, trimmed);
    else setTitleDraft(module.title);
    setEditingTitle(false);
  };

  const saveWeek = () => {
    const n = parseInt(weekDraft, 10);
    if (!isNaN(n) && n > 0 && n !== module.week_number) onUpdateWeekNumber(module.id, n);
    else setWeekDraft(String(module.week_number ?? ''));
    setEditingWeek(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={module.week_number ? `week-${module.week_number}` : undefined}
      className={`bg-surface rounded-2xl border border-border overflow-hidden transition-opacity ${isDraggingOverlay ? 'opacity-30' : ''}`}
    >
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 cursor-pointer select-none" onClick={onToggleExpand}>
        {!readOnly && (
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="hidden sm:block text-border hover:text-muted-text cursor-grab text-lg focus-visible:ring-2 focus-visible:ring-teal-primary focus-visible:rounded"
            aria-label={`Drag module ${module.title}`}
            type="button"
          >
            ⠿
          </button>
        )}
        <div className="flex-1 min-w-0">
          {!readOnly && editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleDraft(module.title); setEditingTitle(false); } }}
              className="font-semibold text-dark-text bg-background border border-teal-primary rounded px-2 py-0.5 w-full focus:outline-none"
            />
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <h3
                className="font-semibold text-dark-text truncate"
              >
                {module.title}
              </h3>
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setTitleDraft(module.title); setEditingTitle(true); }}
                  className="shrink-0 text-border hover:text-muted-text transition-colors"
                  aria-label="Edit module title"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              )}
            </div>
          )}
        </div>
        {!readOnly && (
          <select
            value={module.category ?? ''}
            onChange={(e) => onUpdateCategory(module.id, e.target.value || null)}
            className="hidden sm:block text-xs bg-background border border-border rounded-md px-2 py-1 text-muted-text focus:outline-none focus:ring-1 focus:ring-teal-primary shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {CATEGORY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
        {!readOnly && (
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
        )}
        {!readOnly && (
          <span onClick={e => e.stopPropagation()}>
            <CreateButton courseId={courseId} compact defaultModuleId={module.id} />
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          className="text-muted-text hover:text-teal-primary text-sm px-3"
          aria-label={expanded ? "Collapse module" : "Expand module"}
          type="button"
        >
          {expanded ? "▲" : "▼"}
        </button>
        {!readOnly && (
          <div className="relative shrink-0">
            <button
              ref={modCopyBtnRef}
              type="button"
              onClick={openModCopy}
              className={`shrink-0 transition-colors ${modCopyOpen ? "text-purple-primary" : "text-muted-text hover:text-purple-primary"}`}
              title="Copy module"
            >
              <DuplicateIcon className="w-4 h-4" />
            </button>
            {modCopyOpen && (
              <DuplicateModulePopup
                module={module as any}
                currentCourseId={courseId}
                currentModuleCount={0}
                popupPos={modCopyPopupPos}
                popupRef={modCopyPopupRef}
                onClose={() => setModCopyOpen(false)}
                onDuplicatedInCourse={onDuplicatedModule}
              />
            )}
          </div>
        )}
        {!readOnly && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(module.id, module.title); }}
            className="text-muted-text hover:text-red-400"
            aria-label={`Delete module ${module.title}`}
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-6 pb-4 flex flex-col gap-2 border-t border-border pt-4">
          {/* Module-level wikis */}
          {((module.wikis ?? []).length > 0 || !readOnly) && (
            <div className="flex flex-col gap-2 mb-2">
              {(module.wikis ?? []).map(wiki => (
                <WikiBlock
                  key={wiki.id}
                  wiki={wiki}
                  onUpdate={onWikiUpdated}
                  onTogglePublished={onWikiPublishToggled}
                  onDelete={onWikiDeleted}
                />
              ))}
              {!readOnly && (
                <button
                  type="button"
                  onClick={async () => {
                    const result = await createWiki({ moduleId: module.id, title: 'New Wiki' })
                    if (result.error) { alert(`Failed to create wiki: ${result.error}`); return }
                    if (result.data) onWikiCreated(result.data)
                  }}
                  className="text-xs text-teal-primary hover:underline text-left"
                >
                  + Add Wiki
                </button>
              )}
            </div>
          )}

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
                  onDelete={(id, name) => onDeleteDay(id, module.id, name)}
                  onOpenAssignment={onOpenAssignment}
                  onOpenAdd={onOpenAdd}
                  onDeleteAssignment={onDeleteAssignment}
                  onTogglePublished={onTogglePublished}
                  onDuplicatedAssignment={onDuplicatedAssignment}
                  courseId={courseId}
                  forceOpen={expandDays}
                  onWikiCreated={onWikiCreated}
                  onWikiUpdated={onWikiUpdated}
                  onWikiPublishToggled={onWikiPublishToggled}
                  onWikiDeleted={onWikiDeleted}
                  quizzesForDay={allQuizzes.filter(q => {
                    if (q.linked_day_id === day.id) return true;
                    if (q.day_title?.trim() !== day.day_name?.trim()) return false;
                    if (q.module_title?.trim() === module.title?.trim()) return true;
                    const quizWeek = q.module_title?.match(/^Week\s+(\d+)/i)?.[1];
                    return !!(quizWeek && module.week_number === parseInt(quizWeek, 10));
                  })}
                  moduleTitle={module.title}
                  onRegisterResources={onRegisterResources}
                />
              ))}
          </SortableContext>

          {!readOnly && (
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
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared search popup helpers ─────────────────────────────────────────────

function MovePopup({
  anchorRef,
  popupRef,
  weekModules,
  currentModuleId,
  onMove,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  popupRef: React.RefObject<HTMLDivElement | null>;
  weekModules: { id: string; week: number | null; title: string | null; days: string[] }[];
  currentModuleId: string;
  onMove: (modId: string, day: string) => void;
  onClose: () => void;
}) {
  const [modId, setModId] = useState("");
  const [day, setDay] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      const popH = 200; const popW = 280;
      const top = window.innerHeight - r.bottom < popH ? Math.max(8, r.top - popH - 4) : r.bottom + 4;
      setPos({ top, left: Math.min(r.left, window.innerWidth - popW - 8) });
    }
    function onDown(e: MouseEvent) {
      if (!popupRef.current?.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node))
        onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modDays = weekModules.find(m => m.id === modId)?.days ?? [];
  const canMove = !!modId && (modDays.length === 1 || !!day);

  return (
    <div ref={popupRef} className="fixed z-50 bg-surface border border-border rounded-xl shadow-lg p-3 flex flex-col gap-2" style={{ top: pos.top, left: pos.left, width: 280 }}>
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Move to</p>
      <select value={modId} onChange={e => { setModId(e.target.value); setDay(""); }}
        className="text-xs bg-background border border-border rounded px-2 py-1 text-dark-text focus:outline-none focus:ring-1 focus:ring-teal-primary w-full">
        <option value="">Select module…</option>
        {weekModules.map(({ id, week, title }) => (
          <option key={id} value={id}>{title ?? (week != null ? `Week ${week}` : "Unassigned")}</option>
        ))}
      </select>
      {modId && modDays.length > 0 && (
        modDays.length === 1
          ? <p className="text-xs text-muted-text">Day: <span className="text-dark-text">{modDays[0]}</span></p>
          : <div className="flex flex-wrap gap-1">
              {modDays.map(d => (
                <button key={d} type="button" onClick={() => setDay(d)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${day === d ? "bg-teal-primary border-teal-primary text-white" : "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary"}`}>
                  {d}
                </button>
              ))}
            </div>
      )}
      <button type="button" onClick={() => canMove && onMove(modId, modDays.length === 1 ? modDays[0] : day)}
        disabled={!canMove}
        className="text-xs bg-teal-primary text-white rounded-lg py-1.5 font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">
        Move
      </button>
    </div>
  );
}

// ─── SearchAssignmentRow ──────────────────────────────────────────────────────

function SearchAssignmentRow({
  result,
  weekModules,
  onOpen,
}: {
  result: { assignment: Assignment; moduleTitle: string | null; dayName: string; moduleId: string; dayId: string; weekNumber: number | null };
  weekModules: { id: string; week: number | null; title: string | null; days: string[] }[];
  onOpen: () => void;
}) {
  const ctx = useContext(RelocateContext);
  const [popup, setPopup] = useState<"move" | null>(null);
  const moveBtnRef = useRef<HTMLButtonElement>(null);
  const movePopupRef = useRef<HTMLDivElement>(null);

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 hover:bg-border/20 border-b border-border/50 last:border-0">
      <span className="text-xs bg-purple-light text-purple-primary rounded px-1.5 py-0.5 shrink-0">Assignment</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dark-text truncate">{decodeHtml(result.assignment.title)}</p>
        <p className="text-xs text-muted-text truncate">{result.moduleTitle ?? "Unassigned"} · {result.dayName}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button type="button" onClick={onOpen} className="text-xs text-teal-primary hover:underline">Open →</button>
        {ctx && (
          <div className="relative">
            <button ref={moveBtnRef} type="button" onClick={() => setPopup(p => p === "move" ? null : "move")}
              className={`text-xs px-2 py-1 rounded border transition-colors ${popup === "move" ? "border-teal-primary text-teal-primary" : "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary"}`}>
              Move ⇄
            </button>
            {popup === "move" && (
              <MovePopup
                anchorRef={moveBtnRef}
                popupRef={movePopupRef}
                weekModules={weekModules}
                currentModuleId={result.moduleId}
                onMove={(modId, day) => { ctx.relocateAssignmentToModule(result.assignment.id, modId, day); setPopup(null); }}
                onClose={() => setPopup(null)}
              />
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// ─── SearchResourceRow ────────────────────────────────────────────────────────

function SearchResourceRow({
  resource,
  weekModules,
  onMoved,
  onEdited,
}: {
  resource: { id: string; title: string; type: string; url: string | null; moduleTitle: string | null; dayName: string; moduleId: string };
  weekModules: { id: string; week: number | null; title: string | null; days: string[] }[];
  onMoved: () => void;
  onEdited: (id: string, title: string, url: string | null) => void;
}) {
  const ctx = useContext(RelocateContext);
  const supabase = createClient();
  const [popup, setPopup] = useState<"move" | "edit" | null>(null);
  const moveBtnRef = useRef<HTMLButtonElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const movePopupRef = useRef<HTMLDivElement>(null);
  const editPopupRef = useRef<HTMLDivElement>(null);
  const [editTitle, setEditTitle] = useState(resource.title);
  const [editUrl, setEditUrl] = useState(resource.url ?? "");
  const [saving, setSaving] = useState(false);

  async function saveEdit() {
    setSaving(true);
    const updates: { title: string; url?: string | null } = { title: editTitle.trim() || resource.title };
    if (resource.type !== "reading") updates.url = editUrl.trim() || null;
    await supabase.from("resources").update(updates).eq("id", resource.id);
    onEdited(resource.id, updates.title, updates.url ?? null);
    setSaving(false);
    setPopup(null);
  }

  const [editPos, setEditPos] = useState({ top: 0, left: 0 });
  function openEdit() {
    if (popup === "edit") { setPopup(null); return; }
    if (editBtnRef.current) {
      const r = editBtnRef.current.getBoundingClientRect();
      const popH = resource.type === "reading" ? 120 : 180; const popW = 300;
      const top = window.innerHeight - r.bottom < popH ? Math.max(8, r.top - popH - 4) : r.bottom + 4;
      setEditPos({ top, left: Math.min(r.left, window.innerWidth - popW - 8) });
    }
    setEditTitle(resource.title);
    setEditUrl(resource.url ?? "");
    setPopup("edit");
  }

  useEffect(() => {
    if (popup !== "edit") return;
    function onDown(e: MouseEvent) {
      if (!editPopupRef.current?.contains(e.target as Node) && !editBtnRef.current?.contains(e.target as Node))
        setPopup(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [popup]);

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 hover:bg-border/20 border-b border-border/50 last:border-0">
      <span className="text-xs bg-teal-light text-teal-primary rounded px-1.5 py-0.5 shrink-0">{resource.type.charAt(0).toUpperCase() + resource.type.slice(1)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dark-text truncate">{resource.title}</p>
        <p className="text-xs text-muted-text truncate">{resource.moduleTitle ?? "Unassigned"}{resource.dayName ? ` · ${resource.dayName}` : ""}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Edit button */}
        <div className="relative">
          <button ref={editBtnRef} type="button" onClick={openEdit}
            className={`text-xs px-2 py-1 rounded border transition-colors ${popup === "edit" ? "border-teal-primary text-teal-primary" : "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary"}`}>
            Edit
          </button>
          {popup === "edit" && (
            <div ref={editPopupRef} className="fixed z-50 bg-surface border border-border rounded-xl shadow-lg p-3 flex flex-col gap-2" style={{ top: editPos.top, left: editPos.left, width: 300 }}>
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Edit resource</p>
              <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                placeholder="Title"
                className="text-xs border border-border rounded px-2 py-1.5 bg-background text-dark-text focus:outline-none focus:ring-1 focus:ring-teal-primary w-full" />
              {resource.type === "reading" ? (
                <p className="text-xs text-muted-text italic">To edit reading content, open it in the module view.</p>
              ) : (
                <input type="url" value={editUrl} onChange={e => setEditUrl(e.target.value)}
                  placeholder="URL"
                  className="text-xs border border-border rounded px-2 py-1.5 bg-background text-dark-text focus:outline-none focus:ring-1 focus:ring-teal-primary w-full" />
              )}
              <div className="flex gap-2">
                <button type="button" onClick={saveEdit} disabled={saving}
                  className="flex-1 text-xs bg-teal-primary text-white rounded-lg py-1.5 font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">
                  {saving ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => setPopup(null)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-text hover:text-dark-text transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Move button */}
        {ctx && (
          <div className="relative">
            <button ref={moveBtnRef} type="button" onClick={() => setPopup(p => p === "move" ? null : "move")}
              className={`text-xs px-2 py-1 rounded border transition-colors ${popup === "move" ? "border-teal-primary text-teal-primary" : "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary"}`}>
              Move ⇄
            </button>
            {popup === "move" && (
              <MovePopup
                anchorRef={moveBtnRef}
                popupRef={movePopupRef}
                weekModules={weekModules}
                currentModuleId={resource.moduleId}
                onMove={(modId, day) => { ctx.relocateResourceToModule(resource.id, modId, day, onMoved); setPopup(null); }}
                onClose={() => setPopup(null)}
              />
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// ─── CourseEditor ─────────────────────────────────────────────────────────────

export default function CourseEditor({
  course,
  initialModules,
  filterCategory,
  courseQuizzes = [],
  readOnly = false,
}: {
  course: any;
  initialModules: Module[];
  filterCategory?: string;
  courseQuizzes?: QuizEntry[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleWeek, setNewModuleWeek] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(() => new Set(initialModules.map(m => m.id)));
  const [expandDaysTriggers, setExpandDaysTriggers] = useState<Record<string, number>>({});
  const [allQuizzes, setAllQuizzes] = useState<QuizEntry[]>(courseQuizzes);
  // Registry for resource state in each SortableDay, used by outer DnD for cross-day moves
  const resourceRegistryRef = useRef<Map<string, { getResources: () => Resource[]; setResources: React.Dispatch<React.SetStateAction<Resource[]>> }>>(new Map());
  const handleRegisterResources = (dayId: string, getResources: () => Resource[], setResources: React.Dispatch<React.SetStateAction<Resource[]>>) => {
    resourceRegistryRef.current.set(dayId, { getResources, setResources });
  };

  const isModuleExpanded = (id: string) => !collapsedModules.has(id);
  const toggleModuleExpand = (id: string) => {
    setCollapsedModules(prev => {
      const next = new Set(prev);
      const wasCollapsed = next.has(id);
      if (wasCollapsed) {
        next.delete(id);
        // expanding: also expand all days in this module
        setExpandDaysTriggers(t => ({ ...t, [id]: (t[id] ?? 0) + 1 }));
      } else {
        next.add(id);
      }
      return next;
    });
  };
  const expandAllModules = () => {
    setCollapsedModules(new Set());
    // expand all days in all modules
    setExpandDaysTriggers(prev => {
      const next = { ...prev };
      modules.forEach(m => { next[m.id] = (next[m.id] ?? 0) + 1; });
      return next;
    });
  };
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

    // Handle resource moves (within-day reorder or cross-day)
    if (activeData?.type === "resource") {
      const { resourceId, sourceDayId } = activeData;
      const sourceEntry = resourceRegistryRef.current.get(sourceDayId);
      if (!sourceEntry) return;

      // Within-day reorder: dropped on another resource in the same day
      if (overData?.type === "resource" && overData.sourceDayId === sourceDayId) {
        const current = sourceEntry.getResources();
        const oldIndex = current.findIndex((r) => r.id === resourceId);
        const newIndex = current.findIndex((r) => r.id === overData.resourceId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
        const reordered = arrayMove([...current], oldIndex, newIndex).map((r, i) => ({ ...r, order: i }));
        sourceEntry.setResources(reordered);
        await Promise.all(reordered.map((r, i) => supabase.from("resources").update({ order: i }).eq("id", r.id)));
        return;
      }

      // Determine target day for cross-day move
      let resourceTargetDayId: string | null = null;
      if (overData?.type === "day-drop") {
        resourceTargetDayId = overData.dayId;
      } else if (overData?.type === "day") {
        resourceTargetDayId = (over.id as string).replace("day-", "");
      } else if (overData?.type === "resource" && overData.sourceDayId !== sourceDayId) {
        resourceTargetDayId = overData.sourceDayId;
      } else if (overData?.type === "assignment") {
        resourceTargetDayId = overData.sourceDayId;
      }
      if (!resourceTargetDayId || resourceTargetDayId === sourceDayId) return;

      const targetEntry = resourceRegistryRef.current.get(resourceTargetDayId);
      const resource = sourceEntry.getResources().find((r) => r.id === resourceId);
      if (!resource) return;
      const newOrder = targetEntry ? targetEntry.getResources().length : 0;

      const { error: resMoveError } = await supabase.from("resources").update({ module_day_id: resourceTargetDayId, order: newOrder }).eq("id", resourceId);
      if (resMoveError) { console.error("Failed to move resource:", resMoveError); return; }

      sourceEntry.setResources((prev) => prev.filter((r) => r.id !== resourceId));
      targetEntry?.setResources((prev) => [...prev, { ...resource, module_day_id: resourceTargetDayId!, order: newOrder }]);
      return;
    }

    // Handle quiz cross-day moves
    if (activeData?.type === "quiz") {
      const { quizId, sourceDayId } = activeData;

      let quizTargetDayId: string | null = null;
      if (overData?.type === "day-drop") {
        quizTargetDayId = overData.dayId;
      } else if (overData?.type === "day") {
        quizTargetDayId = (over.id as string).replace("day-", "");
      } else if ((overData?.type === "assignment" || overData?.type === "resource" || overData?.type === "quiz") && overData.sourceDayId !== sourceDayId) {
        quizTargetDayId = overData.sourceDayId;
      }
      if (!quizTargetDayId || quizTargetDayId === sourceDayId) return;

      const allDays = modulesRef.current.flatMap((m) => m.module_days.map((d) => ({ ...d, moduleTitle: m.title })));
      const targetDay = allDays.find((d) => d.id === quizTargetDayId);
      if (!targetDay) return;

      const { error: quizMoveError } = await supabase.from("quizzes").update({ module_title: targetDay.moduleTitle, day_title: targetDay.day_name }).eq("id", quizId);
      if (quizMoveError) { console.error("Failed to move quiz:", quizMoveError); return; }

      setAllQuizzes((prev) => prev.map((q) => q.id === quizId ? { ...q, module_title: targetDay.moduleTitle, day_title: targetDay.day_name } : q));
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

  const deleteModule = async (id: string, title: string) => {
    if (!window.confirm(`Move "${title}" and all its days to trash?`)) return;
    const { error } = await trashModule(id, course.id);
    if (error) { alert(error); return; }
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

  const updateModuleWeekNumber = async (moduleId: string, weekNumber: number) => {
    const { error } = await supabase.from("modules").update({ week_number: weekNumber }).eq("id", moduleId);
    if (error) { console.error("updateModuleWeekNumber failed:", error.message); return; }
    setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, week_number: weekNumber } : m));
  };

  const relocateAssignment = async (assignmentId: string, targetWeek: number, targetDayName: string) => {
    const currentMods = modulesRef.current;

    // Find assignment and its current day/module first
    let assignmentToMove: Assignment | undefined;
    let sourceDayId: string | undefined;
    let sourceModule: typeof currentMods[0] | undefined;
    for (const m of currentMods) {
      for (const d of m.module_days) {
        const found = d.assignments?.find((a) => a.id === assignmentId);
        if (found) { assignmentToMove = found; sourceDayId = d.id; sourceModule = m; break; }
      }
      if (assignmentToMove) break;
    }
    if (!assignmentToMove || !sourceDayId || !sourceModule) return;

    // Find target module: when week matches source, stay in source module to avoid
    // accidentally picking a duplicate-week-number orphan module. Otherwise prefer
    // modules with a non-empty title.
    const targetModule = sourceModule.week_number === targetWeek
      ? sourceModule
      : (currentMods.find((m) => m.week_number === targetWeek && m.title?.trim())
          ?? currentMods.find((m) => m.week_number === targetWeek));
    if (!targetModule) { console.error(`No module for week ${targetWeek}`); return; }
    const targetDay = targetModule.module_days.find((d) => d.day_name === targetDayName);
    if (!targetDay) { console.error(`No day "${targetDayName}" in week ${targetWeek}`); return; }
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
    // Keep activeView in sync if this assignment is currently open
    setActiveView((prev) =>
      prev?.mode === "view" && prev.assignment.id === assignmentId
        ? { ...prev, dayId: targetDay.id, moduleId: targetModule.id, weekNumber: targetModule.week_number, dayName: targetDayName }
        : prev
    );
  };

  const relocateAssignmentToModule = async (assignmentId: string, targetModuleId: string, targetDayName: string) => {
    const currentMods = modulesRef.current;
    let assignmentToMove: Assignment | undefined;
    let sourceDayId: string | undefined;
    for (const m of currentMods) {
      for (const d of m.module_days) {
        const found = d.assignments?.find((a) => a.id === assignmentId);
        if (found) { assignmentToMove = found; sourceDayId = d.id; break; }
      }
      if (assignmentToMove) break;
    }
    if (!assignmentToMove || !sourceDayId) return;
    const targetModule = currentMods.find((m) => m.id === targetModuleId);
    if (!targetModule) return;
    let targetDay = targetModule.module_days.find((d) => d.day_name === targetDayName);
    if (sourceDayId === targetDay?.id) return;
    // Create the day if it doesn't exist yet
    if (!targetDay) {
      const { data: newDay, error: dayErr } = await supabase
        .from("module_days")
        .insert({ module_id: targetModuleId, day_name: targetDayName, order: targetModule.module_days.length })
        .select()
        .single();
      if (dayErr || !newDay) { console.error("Failed to create day:", dayErr?.message); return; }
      const createdDay: Day = { ...newDay, assignments: [] };
      targetDay = createdDay;
      setModules((prev) =>
        prev.map((m) =>
          m.id === targetModuleId
            ? { ...m, module_days: [...m.module_days, createdDay] }
            : m
        )
      );
    }
    const resolvedDay = targetDay;
    const newOrder = (resolvedDay.assignments ?? []).length;
    const { error } = await supabase.from("assignments").update({ module_day_id: resolvedDay.id, order: newOrder }).eq("id", assignmentId);
    if (error) { console.error("relocateAssignmentToModule failed:", error.message); return; }
    setModules((prev) =>
      prev.map((m) => ({
        ...m,
        module_days: m.module_days.map((d) => {
          if (d.id === sourceDayId) return { ...d, assignments: (d.assignments ?? []).filter((a) => a.id !== assignmentId) };
          if (d.id === resolvedDay.id) return { ...d, assignments: [...(d.assignments ?? []), { ...assignmentToMove!, module_day_id: resolvedDay.id, order: newOrder }] };
          return d;
        }),
      }))
    );
    setActiveView((prev) =>
      prev?.mode === "view" && prev.assignment.id === assignmentId
        ? { ...prev, dayId: resolvedDay.id, moduleId: targetModule.id, weekNumber: targetModule.week_number, dayName: targetDayName }
        : prev
    );
  };

  const relocateResource = async (resourceId: string, targetWeek: number, targetDayName: string, onRemoved: () => void) => {
    const currentMods = modulesRef.current;
    // Prefer modules with non-empty titles to avoid orphan/duplicate-week-number modules
    const targetModule = currentMods.find((m) => m.week_number === targetWeek && m.title?.trim())
      ?? currentMods.find((m) => m.week_number === targetWeek);
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

  const relocateResourceToModule = async (resourceId: string, targetModuleId: string, targetDayName: string, onMoved?: () => void) => {
    const targetModule = modulesRef.current.find((m) => m.id === targetModuleId);
    if (!targetModule) return;
    let targetDay = targetModule.module_days.find((d) => d.day_name === targetDayName);
    if (!targetDay) {
      const { data: newDay, error: dayErr } = await supabase
        .from("module_days")
        .insert({ module_id: targetModuleId, day_name: targetDayName, order: targetModule.module_days.length })
        .select()
        .single();
      if (dayErr || !newDay) { console.error("Failed to create day:", dayErr?.message); return; }
      const createdDay: Day = { ...newDay, assignments: [] };
      targetDay = createdDay;
      setModules((prev) =>
        prev.map((m) =>
          m.id === targetModuleId ? { ...m, module_days: [...m.module_days, createdDay] } : m
        )
      );
    }
    const resolvedResourceDay = targetDay;
    const { error } = await supabase.from("resources").update({ module_day_id: resolvedResourceDay.id }).eq("id", resourceId);
    if (error) { console.error("relocateResourceToModule failed:", error.message); return; }
    setDayRefreshTriggers(prev => ({ ...prev, [resolvedResourceDay.id]: (prev[resolvedResourceDay.id] ?? 0) + 1 }));
    onMoved?.();
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

  const deleteDay = async (dayId: string, moduleId: string, dayName: string) => {
    if (!window.confirm(`Move "${dayName}" and all its content to trash?`)) return;
    const { error } = await trashDay(dayId, course.id);
    if (error) { alert(error); return; }

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
    setActiveView((prev) =>
      prev?.mode === "view" && prev.assignment.id === assignmentId
        ? { ...prev, assignment: { ...prev.assignment, published: !current } }
        : prev
    );
  };

  const toggleBonus = async (assignmentId: string, current: boolean) => {
    await supabase.from("assignments").update({ is_bonus: !current }).eq("id", assignmentId);
    setModules((prev) =>
      prev.map((m) => ({
        ...m,
        module_days: m.module_days.map((d) => ({
          ...d,
          assignments: (d.assignments ?? []).map((a) =>
            a.id === assignmentId ? { ...a, is_bonus: !current } : a
          ),
        })),
      }))
    );
    setActiveView((prev) =>
      prev?.mode === "view" && prev.assignment.id === assignmentId
        ? { ...prev, assignment: { ...prev.assignment, is_bonus: !current } }
        : prev
    );
  };

  const deleteAssignment = async (assignmentId: string, title: string) => {
    if (!window.confirm(`Move "${title}" to trash?`)) return;
    const { error } = await trashAssignment(assignmentId, course.id);
    if (error) { alert(error); return; }
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

  const handleDuplicatedAssignment = (assignment: DuplicatedAssignment, targetDayId: string, newDay?: { id: string; day_name: string; module_id: string; order: number }) => {
    setModules((prev) =>
      prev.map((m) => {
        // If a new day was created and belongs to this module, add it first
        const days = newDay && newDay.module_id === m.id && !m.module_days.some(d => d.id === newDay.id)
          ? [...m.module_days, { ...newDay, assignments: [] }]
          : m.module_days;
        return {
          ...m,
          module_days: days.map((d) => {
            if (d.id !== targetDayId) return d;
            const existing = d.assignments ?? [];
            return { ...d, assignments: [...existing, { ...assignment, is_bonus: assignment.is_bonus ?? false, order: existing.length }] };
          }),
        };
      })
    );
  };

  const handleDuplicatedModule = (newModule: DuplicatedModule) => {
    setModules((prev) => [...prev, newModule as unknown as Module]);
  };

  // ── Wiki state management ──────────────────────────────────────────────────

  const handleWikiCreated = (wiki: Wiki) => {
    setModules(prev => prev.map(m => {
      // Module-level wiki
      if (wiki.module_id === m.id) {
        return { ...m, wikis: [...(m.wikis ?? []), wiki] };
      }
      // Day-level wiki
      const updatedDays = m.module_days.map(d => {
        if (wiki.module_day_id === d.id) {
          return { ...d, wikis: [...(d.wikis ?? []), wiki] };
        }
        return d;
      });
      return { ...m, module_days: updatedDays };
    }));
  };

  const handleWikiUpdated = (wikiId: string, title: string, content: string) => {
    setModules(prev => prev.map(m => ({
      ...m,
      wikis: (m.wikis ?? []).map(w => w.id === wikiId ? { ...w, title, content } : w),
      module_days: m.module_days.map(d => ({
        ...d,
        wikis: (d.wikis ?? []).map(w => w.id === wikiId ? { ...w, title, content } : w),
      })),
    })));
  };

  const handleWikiPublishToggled = (wikiId: string, published: boolean) => {
    setModules(prev => prev.map(m => ({
      ...m,
      wikis: (m.wikis ?? []).map(w => w.id === wikiId ? { ...w, published } : w),
      module_days: m.module_days.map(d => ({
        ...d,
        wikis: (d.wikis ?? []).map(w => w.id === wikiId ? { ...w, published } : w),
      })),
    })));
  };

  const handleWikiDeleted = (wikiId: string) => {
    setModules(prev => prev.map(m => ({
      ...m,
      wikis: (m.wikis ?? []).filter(w => w.id !== wikiId),
      module_days: m.module_days.map(d => ({
        ...d,
        wikis: (d.wikis ?? []).filter(w => w.id !== wikiId),
      })),
    })));
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
    setActiveView((prev) =>
      prev?.mode === "view" && prev.assignment.id === assignmentId
        ? { ...prev, assignment: { ...prev.assignment, ...updates } }
        : prev
    );
  };

  const PERSIST_KEY = `active-assignment-${course.id}`;

  const openAssignment = (assignment: Assignment, dayId: string) => {
    localStorage.setItem(PERSIST_KEY, JSON.stringify({ assignmentId: assignment.id, dayId }));
    const mod = modules.find((m) => m.module_days.some((d) => d.id === dayId));
    const day = mod?.module_days.find((d) => d.id === dayId);
    setActiveView({
      mode: "view",
      assignment,
      dayId,
      moduleId: mod?.id ?? null,
      weekNumber: mod?.week_number ?? null,
      dayName: day?.day_name ?? "",
    });
  };

  const openAdd = (dayId: string) =>
    setActiveView({ mode: "add", dayId });

  const closeView = () => { localStorage.removeItem(PERSIST_KEY); setActiveView(null); };

  const visibleModules = filterCategory
    ? modules.filter((m) => m.category === filterCategory)
    : modules;

  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const [resourceResults, setResourceResults] = useState<{ id: string; title: string; type: string; url: string | null; module_day_id: string; moduleTitle: string | null; dayName: string; moduleId: string; weekNumber: number | null }[]>([]);

  useEffect(() => {
    const q = search.trim();
    if (!q) { setResourceResults([]); return; }
    let cancelled = false;
    supabase
      .from("resources")
      .select("id, title, type, url, module_day_id")
      .ilike("title", `%${q}%`)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const enriched = data.map((r: { id: string; title: string; type: string; url: string | null; module_day_id: string }) => {
          for (const m of modules) {
            const d = m.module_days.find(d => d.id === r.module_day_id);
            if (d) return { ...r, moduleTitle: m.title, dayName: d.day_name, moduleId: m.id, weekNumber: m.week_number };
          }
          return { ...r, moduleTitle: null, dayName: "", moduleId: "", weekNumber: null };
        });
        setResourceResults(enriched);
      });
    return () => { cancelled = true; };
  }, [search]);

  const assignmentResults = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const results: { assignment: Assignment; moduleTitle: string | null; dayName: string; moduleId: string; dayId: string; weekNumber: number | null }[] = [];
    for (const m of modules) {
      for (const d of m.module_days) {
        for (const a of d.assignments ?? []) {
          if (decodeHtml(a.title).toLowerCase().includes(q))
            results.push({ assignment: a, moduleTitle: m.title, dayName: d.day_name, moduleId: m.id, dayId: d.id, weekNumber: m.week_number });
        }
      }
    }
    return results;
  })();

  const weekOptions = [...new Set(modules.map((m) => m.week_number).filter(Boolean))].sort((a, b) => a - b) as number[];
  const weekModules = modules.map(m => ({
    id: m.id,
    week: m.week_number ?? null,
    title: m.title ?? null,
    days: m.module_days.map(d => d.day_name),
  }));

  return (
    <ReadOnlyContext.Provider value={readOnly}>
    <RelocateContext.Provider value={{ weekOptions, weekModules, relocateAssignment, relocateAssignmentToModule, relocateResource, relocateResourceToModule }}>
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
          onToggleBonus={toggleBonus}
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
            {!readOnly && (
              <div ref={searchRef} className="relative">
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search assignments and resources…"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                />
                {search && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-lg z-30 max-h-96 overflow-y-auto">
                    {assignmentResults.length === 0 && resourceResults.length === 0 ? (
                      <p className="text-sm text-muted-text px-4 py-3">No results found.</p>
                    ) : (
                      <ul>
                        {assignmentResults.map((r) => (
                          <SearchAssignmentRow
                            key={r.assignment.id}
                            result={r}
                            weekModules={weekModules}
                            onOpen={() => { openAssignment(r.assignment, r.dayId); setSearch(""); }}
                          />
                        ))}
                        {resourceResults.map((r) => (
                          <SearchResourceRow
                            key={r.id}
                            resource={r}
                            weekModules={weekModules}
                            onMoved={() => setResourceResults(prev => prev.filter(x => x.id !== r.id))}
                            onEdited={(id, title, url) => setResourceResults(prev => prev.map(x => x.id === id ? { ...x, title, url } : x))}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
            {visibleModules.length > 0 && (
              <div className="sticky top-0 z-20 bg-background py-1 flex justify-end gap-2">
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
                  onUpdateWeekNumber={updateModuleWeekNumber}
                  onDuplicatedAssignment={handleDuplicatedAssignment}
                  onDuplicatedModule={handleDuplicatedModule}
                  dayRefreshTriggers={dayRefreshTriggers}
                  isDraggingOverlay={activeDragId === `module-${module.id}`}
                  allQuizzes={allQuizzes}
                  expandDays={expandDaysTriggers[module.id]}
                  onRegisterResources={handleRegisterResources}
                  onWikiCreated={handleWikiCreated}
                  onWikiUpdated={handleWikiUpdated}
                  onWikiPublishToggled={handleWikiPublishToggled}
                  onWikiDeleted={handleWikiDeleted}
                />
              ))}
            </SortableContext>

            {!readOnly && (
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
            )}
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
    </ReadOnlyContext.Provider>
  );
}
