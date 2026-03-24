"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { QuizRow, QuizQuestion, QuizChoice, CodeLanguage } from "@/data/quizzes";
import DatePickerField from "@/components/ui/DatePickerField";
import dynamic from "next/dynamic";
import {
  updateQuizMeta,
  updateQuizQuestions,
  toggleQuizPublished,
  upsertQuizFromJson,
  deleteQuiz,
  updateQuizDay,
} from "@/lib/quiz-actions";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { parseQuizText } from "@/lib/quiz-parser";

const CodeEditor = dynamic(() => import("@/components/ui/CodeEditor"), { ssr: false });
const HighlightedContent = dynamic(() => import("@/components/ui/HighlightedContent"), { ssr: false });
const ChoiceEditor = dynamic(() => import("@/components/ui/ChoiceEditor"), { ssr: false });
const QuizQuestionEditor = dynamic(
  () => import("@/components/ui/QuizQuestionEditor"),
  { ssr: false }
);

function newIdent(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type QuizFullViewProps = {
  quiz: QuizRow;
  courseId: string;
  moduleTitles?: string[];
  onClose: () => void;
  onSaved?: (updatedQuiz: QuizRow) => void;
  onDeleted?: (quizId: string) => void;
};

function formatDueDate(dueAt: string | null): string {
  if (!dueAt || !dueAt.trim()) return "No due date";
  try {
    return new Date(dueAt).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dueAt;
  }
}

function getCorrectChoice(question: QuizQuestion): QuizChoice | undefined {
  return question.choices?.find((c) => c.ident === question.correct_response_ident);
}

const isJsonOnlyQuiz = (id: string) => id.startsWith("json-");

function SortableQuestion({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: object) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border-b border-border pb-8 last:border-0 ${isDragging ? "opacity-40" : ""}`}
    >
      {children({ ...attributes, ...listeners })}
    </li>
  );
}

const TRUE_FALSE_CHOICES = (trueIdent: string, falseIdent: string) => [
  { ident: trueIdent, text: "True" },
  { ident: falseIdent, text: "False" },
];

const LANG_LABELS: Record<CodeLanguage, string> = {
  javascript: "JavaScript",
  jsx: "React (JSX)",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
};

export default function QuizFullView({ quiz, courseId, moduleTitles = [], onClose, onSaved, onDeleted }: QuizFullViewProps) {
  const router = useRouter();
  const fromJsonOnly = isJsonOnlyQuiz(quiz.id);
  const [editingQuestions, setEditingQuestions] = useState(false);

  // Inline-editable metadata fields
  const [titleDraft, setTitleDraft] = useState(quiz.title);
  const [dueDateDraft, setDueDateDraft] = useState(
    quiz.due_at ? new Date(quiz.due_at).toISOString().slice(0, 16) : ""
  );
  const [maxAttemptsDraft, setMaxAttemptsDraft] = useState<number | null>(quiz.max_attempts ?? null);
  const [moduleTitleDraft, setModuleTitleDraft] = useState(quiz.module_title ?? "");
  const [dayTitleDraft, setDayTitleDraft] = useState(quiz.day_title ?? "");

  // Attempts popover
  const [showAttemptsPopover, setShowAttemptsPopover] = useState(false);
  const [attemptsInput, setAttemptsInput] = useState(String(quiz.max_attempts ?? 3));
  const attemptsContainerRef = useRef<HTMLDivElement>(null);

  const [editQuestions, setEditQuestions] = useState<QuizQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  useUnsavedChanges(editingQuestions);

  // Sync draft fields when quiz prop changes
  useEffect(() => {
    setTitleDraft(quiz.title);
    setDueDateDraft(quiz.due_at ? new Date(quiz.due_at).toISOString().slice(0, 16) : "");
    setMaxAttemptsDraft(quiz.max_attempts ?? null);
    setModuleTitleDraft(quiz.module_title ?? "");
    setDayTitleDraft(quiz.day_title ?? "");
  }, [quiz.id, quiz.title, quiz.due_at, quiz.max_attempts, quiz.module_title, quiz.day_title]);

  // Close attempts popover on outside click
  useEffect(() => {
    if (!showAttemptsPopover) return;
    const handler = (e: MouseEvent) => {
      if (attemptsContainerRef.current && !attemptsContainerRef.current.contains(e.target as Node)) {
        setShowAttemptsPopover(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAttemptsPopover]);

  useEffect(() => {
    setEditQuestions(JSON.parse(JSON.stringify(quiz.questions ?? [])));
  }, [quiz.id, quiz.questions]);

  // Auto-save a subset of metadata fields
  const autoSave = async (updates: {
    title?: string;
    due_at?: string | null;
    max_attempts?: number | null;
    module_title?: string;
    day_title?: string | null;
  }) => {
    setError(null);
    setSaving(true);
    try {
      if (fromJsonOnly) {
        const saved = await upsertQuizFromJson(courseId, quiz.identifier, {
          title: (updates.title ?? titleDraft.trim()) || quiz.title,
          due_at: updates.due_at !== undefined ? updates.due_at : (dueDateDraft || null),
          module_title: updates.module_title ?? moduleTitleDraft,
          published: quiz.published,
          questions: quiz.questions ?? [],
          max_attempts: updates.max_attempts !== undefined ? updates.max_attempts : maxAttemptsDraft,
        });
        if (saved) {
          onSaved?.(saved as QuizRow);
          // day_title not in upsertQuizFromJson — save separately after we have a real id
          if ("day_title" in updates) {
            await updateQuizDay((saved as QuizRow).id, courseId, updates.day_title ?? null);
          }
        }
      } else {
        const { day_title, ...metaUpdates } = updates;
        if (Object.keys(metaUpdates).length > 0) {
          await updateQuizMeta(quiz.id, courseId, metaUpdates);
        }
        if ("day_title" in updates) {
          await updateQuizDay(quiz.id, courseId, day_title ?? null);
        }
        onSaved?.({ ...quiz, ...updates, day_title: "day_title" in updates ? (updates.day_title ?? null) : (quiz.day_title ?? null) } as QuizRow);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
    setSaving(false);
  };

  const confirmAttempts = () => {
    const n = Math.max(1, parseInt(attemptsInput) || 1);
    setMaxAttemptsDraft(n);
    setAttemptsInput(String(n));
    setShowAttemptsPopover(false);
    void autoSave({ max_attempts: n });
  };

  const handleTogglePublished = async () => {
    setError(null);
    setSaving(true);
    try {
      if (fromJsonOnly) {
        const saved = await upsertQuizFromJson(courseId, quiz.identifier, {
          title: titleDraft.trim() || quiz.title,
          due_at: dueDateDraft || null,
          module_title: moduleTitleDraft,
          published: true,
          questions: quiz.questions ?? [],
          max_attempts: maxAttemptsDraft,
        });
        if (saved) onSaved?.(saved as QuizRow);
      } else {
        await toggleQuizPublished(quiz.id, courseId, !quiz.published);
        onSaved?.({ ...quiz, published: !quiz.published });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    const title = quiz.title.startsWith("Quiz: ") ? quiz.title.slice(6) : quiz.title;
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setError(null);
    setSaving(true);
    try {
      if (!fromJsonOnly) {
        await deleteQuiz(quiz.id, courseId);
      }
      onDeleted?.(quiz.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
    setSaving(false);
  };


  const handleSaveQuestions = async () => {
    setError(null);
    setSaving(true);
    try {
      if (fromJsonOnly) {
        const saved = await upsertQuizFromJson(courseId, quiz.identifier, {
          title: quiz.title,
          due_at: quiz.due_at || null,
          module_title: quiz.module_title ?? "",
          published: false,
          questions: editQuestions,
          max_attempts: quiz.max_attempts ?? null,
        });
        if (saved) onSaved?.(saved as QuizRow);
        setEditingQuestions(false);
      } else {
        await updateQuizQuestions(quiz.id, courseId, editQuestions);
        onSaved?.({ ...quiz, questions: editQuestions });
        setEditingQuestions(false);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
    setSaving(false);
  };

  const updateQuestion = (index: number, upd: Partial<QuizQuestion>) => {
    setEditQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...upd };
      return next;
    });
  };

  const setQuestionType = (qIdx: number, type: "multiple_choice" | "true_false") => {
    setEditQuestions((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const q = next[qIdx];
      q.question_type = type;
      if (type === "true_false") {
        const trueIdent = newIdent("tf-t");
        const falseIdent = newIdent("tf-f");
        q.choices = TRUE_FALSE_CHOICES(trueIdent, falseIdent);
        q.correct_response_ident = trueIdent;
      } else if (!q.choices || q.choices.length < 2) {
        const c1 = newIdent("c");
        const c2 = newIdent("c");
        q.choices = [
          { ident: c1, text: "" },
          { ident: c2, text: "" },
        ];
        q.correct_response_ident = c1;
      }
      return next;
    });
  };

  const updateChoice = (qIndex: number, cIndex: number, text: string) => {
    setEditQuestions((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[qIndex].choices) next[qIndex].choices = [];
      next[qIndex].choices[cIndex] = { ...next[qIndex].choices[cIndex], text };
      return next;
    });
  };

  const setCorrectChoice = (qIndex: number, choiceIdent: string) => {
    setEditQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], correct_response_ident: choiceIdent };
      return next;
    });
  };

  const addQuestion = () => {
    const choice1Ident = newIdent("c");
    const choice2Ident = newIdent("c");
    const newQ: QuizQuestion = {
      ident: newIdent("q"),
      question_text: "",
      question_type: "multiple_choice",
      choices: [
        { ident: choice1Ident, text: "" },
        { ident: choice2Ident, text: "" },
      ],
      correct_response_ident: choice1Ident,
    };
    setEditQuestions((prev) => [...prev, newQ]);
  };

  const removeQuestion = (qIdx: number) => {
    if (editQuestions.length <= 1) return;
    if (!confirm("Remove this question?")) return;
    setEditQuestions((prev) => prev.filter((_, i) => i !== qIdx));
  };

  const addChoice = (qIdx: number) => {
    const ident = newIdent("c");
    setEditQuestions((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[qIdx].choices) next[qIdx].choices = [];
      next[qIdx].choices.push({ ident, text: "" });
      return next;
    });
  };

  const removeChoice = (qIdx: number, cIdx: number) => {
    setEditQuestions((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const choices = next[qIdx].choices ?? [];
      if (choices.length <= 2) return prev;
      const removedIdent = choices[cIdx].ident;
      next[qIdx].choices = choices.filter((_: QuizChoice, i: number) => i !== cIdx);
      if (next[qIdx].correct_response_ident === removedIdent) {
        next[qIdx].correct_response_ident = next[qIdx].choices[0]?.ident ?? "";
      }
      return next;
    });
  };

  const setCodeSnippet = (qIdx: number, snippet: string) => {
    updateQuestion(qIdx, { code_snippet: snippet });
  };

  const setCodeLanguage = (qIdx: number, lang: CodeLanguage) => {
    updateQuestion(qIdx, { code_language: lang });
  };

  const removeCodeSnippet = (qIdx: number) => {
    setEditQuestions((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      delete next[qIdx].code_snippet;
      delete next[qIdx].code_language;
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleQuestionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setEditQuestions((prev) =>
      arrayMove(prev, parseInt(active.id as string), parseInt(over.id as string))
    );
  };

  const displayTitle = quiz.title.startsWith("Quiz: ") ? quiz.title.slice(6) : quiz.title;
  const quizStoragePath = `quizzes/${courseId}/${quiz.identifier || quiz.id}/`;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (editingQuestions) {
                  if (!confirm("You have unsaved changes. Leave without saving?")) return;
                  setEditingQuestions(false);
                } else {
                  onClose();
                }
              }}
              className="text-sm text-muted-text hover:text-dark-text transition-colors flex items-center gap-1.5"
              type="button"
            >
              {editingQuestions ? "← Back to quiz" : "← Back to quizzes"}
            </button>
            {!fromJsonOnly && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="text-xs text-red-500 hover:text-red-400 disabled:opacity-40 transition-colors"
              >
                Delete quiz
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!quiz.id.startsWith("json-") && quiz.published && (
              <a
                href={`/instructor/courses/${courseId}/quizzes/${quiz.id}/conduct`}
                className="text-xs font-medium px-3 py-1 rounded-full border border-border text-muted-text hover:border-teal-primary/50 hover:text-dark-text transition-colors"
              >
                ▶ Moderate quiz
              </a>
            )}
            <button
                onClick={handleTogglePublished}
                disabled={saving}
                className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                  quiz.published
                    ? "border-teal-primary text-teal-primary hover:bg-teal-primary hover:text-white"
                    : "border-border text-muted-text hover:border-teal-primary/50 hover:text-dark-text"
                }`}
                type="button"
              >
                {quiz.published ? "● Published" : "○ Unpublished"}
              </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </div>
        )}

        <>
            {/* Inline-editable metadata */}
            {!editingQuestions && (
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2.5 flex-1 min-w-0">

                  {/* Title — click to edit, auto-save on blur */}
                  <input
                    type="text"
                    value={titleDraft.startsWith("Quiz: ") ? titleDraft.slice(6) : titleDraft}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setTitleDraft(quiz.title.startsWith("Quiz: ") ? `Quiz: ${raw}` : raw);
                    }}
                    onBlur={() => {
                      const trimmed = titleDraft.trim();
                      if (trimmed && trimmed !== quiz.title) void autoSave({ title: trimmed });
                    }}
                    className="text-2xl font-bold text-dark-text bg-transparent border-b-2 border-transparent hover:border-border focus:border-teal-primary focus:outline-none pb-0.5 w-full transition-colors"
                    placeholder="Quiz title"
                  />

                  {/* Due date */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-text shrink-0">Due:</span>
                    {dueDateDraft ? (
                      <>
                        <DatePickerField
                          withTime
                          value={dueDateDraft}
                          onChange={(val) => {
                            setDueDateDraft(val);
                            void autoSave({ due_at: val || null });
                          }}
                        />
                        <span className="text-xs text-muted-text shrink-0">
                          {Intl.DateTimeFormat().resolvedOptions().timeZone}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setDueDateDraft("");
                            void autoSave({ due_at: null });
                          }}
                          className="text-xs text-muted-text hover:text-red-500 transition-colors shrink-0"
                          title="Remove due date"
                        >
                          × No due date
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setHours(23, 59, 0, 0);
                          const val = d.toISOString().slice(0, 16);
                          setDueDateDraft(val);
                          void autoSave({ due_at: val });
                        }}
                        className="text-xs text-muted-text hover:text-teal-primary transition-colors border border-dashed border-border rounded-lg px-3 py-1.5"
                      >
                        + Add due date
                      </button>
                    )}
                  </div>

                  {/* Week + Day */}
                  <div className="flex items-center gap-4 flex-wrap">
                    {moduleTitles.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-text shrink-0">Week:</span>
                        <select
                          value={moduleTitleDraft}
                          onChange={(e) => {
                            setModuleTitleDraft(e.target.value);
                            void autoSave({ module_title: e.target.value });
                          }}
                          className="bg-surface border border-border text-dark-text rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-primary"
                        >
                          <option value="">— Unassigned —</option>
                          {moduleTitles.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-text shrink-0">Day:</span>
                      <select
                        value={dayTitleDraft}
                        onChange={(e) => {
                          setDayTitleDraft(e.target.value);
                          void autoSave({ day_title: e.target.value || null });
                        }}
                        className="bg-surface border border-border text-dark-text rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-primary"
                      >
                        <option value="">— Unassigned —</option>
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Attempts */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-text shrink-0">Attempts:</span>
                    <div className="flex items-center gap-1 bg-background rounded-lg border border-border p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (maxAttemptsDraft !== null) {
                            setMaxAttemptsDraft(null);
                            setShowAttemptsPopover(false);
                            void autoSave({ max_attempts: null });
                          }
                        }}
                        className={`text-xs px-3 py-1 rounded-md transition-colors ${
                          maxAttemptsDraft === null
                            ? "bg-teal-primary text-white"
                            : "text-muted-text hover:text-dark-text"
                        }`}
                      >
                        Unlimited
                      </button>
                      <div ref={attemptsContainerRef} className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            if (showAttemptsPopover) {
                              setShowAttemptsPopover(false);
                            } else {
                              setAttemptsInput(String(maxAttemptsDraft ?? 3));
                              setShowAttemptsPopover(true);
                            }
                          }}
                          className={`text-xs px-3 py-1 rounded-md transition-colors ${
                            maxAttemptsDraft !== null
                              ? "bg-teal-primary text-white"
                              : "text-muted-text hover:text-dark-text"
                          }`}
                        >
                          {maxAttemptsDraft !== null ? `Limited · ${maxAttemptsDraft}` : "Limited"}
                        </button>
                        {showAttemptsPopover && (
                          <div className="absolute top-full left-0 mt-1 z-20 bg-surface border border-border rounded-xl shadow-lg p-3 flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={attemptsInput}
                              onChange={(e) => setAttemptsInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") confirmAttempts();
                                if (e.key === "Escape") setShowAttemptsPopover(false);
                              }}
                              autoFocus
                              className="w-14 bg-background border border-border text-dark-text rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-primary"
                            />
                            <span className="text-xs text-muted-text">attempts</span>
                            <button
                              type="button"
                              onClick={confirmAttempts}
                              className="text-xs bg-teal-primary text-white px-2.5 py-1 rounded-lg hover:opacity-90"
                            >
                              Set
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {saving && <p className="text-xs text-muted-text animate-pulse">Saving…</p>}
                  {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                </div>

                <button
                  onClick={() => setEditingQuestions(true)}
                  className="text-sm text-muted-text hover:text-dark-text transition-colors shrink-0"
                  type="button"
                >
                  ✎ Edit questions &amp; answers
                </button>
              </div>
            )}

            {/* Edit questions mode */}
            {editingQuestions ? (
              <div className="bg-surface rounded-2xl border border-border p-6">
                <h2 className="text-sm font-bold text-muted-text uppercase tracking-wide mb-4">
                  Edit questions &amp; answers
                </h2>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleQuestionDragEnd}>
                  <SortableContext items={editQuestions.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
                <ul className="space-y-8">
                  {editQuestions.map((q, qIdx) => {
                    const isTrueFalse = q.question_type === "true_false";
                    const hasSnippet = !!q.code_snippet;
                    return (
                      <SortableQuestion key={`edit-q-${qIdx}`} id={String(qIdx)}>
                        {(dragHandleProps) => (
                        <>
                        {/* Question header row */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              {...(dragHandleProps as React.HTMLAttributes<HTMLButtonElement>)}
                              className="cursor-grab text-border hover:text-muted-text transition-colors shrink-0 touch-none"
                              aria-label="Drag to reorder question"
                            >
                              ⠿
                            </button>
                            <label className="text-xs font-semibold text-muted-text uppercase tracking-wide">
                              Question {qIdx + 1}
                            </label>
                            {/* Question type selector */}
                            <div className="flex items-center gap-1 bg-background rounded-lg border border-border p-0.5">
                              <button
                                type="button"
                                onClick={() => setQuestionType(qIdx, "multiple_choice")}
                                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                                  !isTrueFalse
                                    ? "bg-teal-primary text-white"
                                    : "text-muted-text hover:text-dark-text"
                                }`}
                              >
                                Multiple choice
                              </button>
                              <button
                                type="button"
                                onClick={() => setQuestionType(qIdx, "true_false")}
                                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                                  isTrueFalse
                                    ? "bg-teal-primary text-white"
                                    : "text-muted-text hover:text-dark-text"
                                }`}
                              >
                                True / False
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeQuestion(qIdx)}
                            disabled={editQuestions.length <= 1}
                            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Remove question
                          </button>
                        </div>

                        {/* Question text — rich text editor */}
                        <QuizQuestionEditor
                          key={q.ident}
                          initialContent={q.question_text || ""}
                          onChange={(html) => updateQuestion(qIdx, { question_text: html })}
                          storagePath={quizStoragePath}
                        />

                        {/* Code snippet */}
                        <div className="mt-3">
                          {!hasSnippet ? (
                            <button
                              type="button"
                              onClick={() =>
                                updateQuestion(qIdx, {
                                  code_snippet: "",
                                  code_language: "javascript",
                                })
                              }
                              className="text-xs text-teal-primary hover:opacity-90"
                            >
                              + Add code snippet
                            </button>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-muted-text uppercase tracking-wide">
                                  Code snippet
                                </label>
                                <div className="flex items-center gap-3">
                                  <select
                                    value={q.code_language ?? "javascript"}
                                    onChange={(e) =>
                                      setCodeLanguage(qIdx, e.target.value as CodeLanguage)
                                    }
                                    className="text-xs bg-background border border-border text-dark-text rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-primary"
                                  >
                                    {(Object.entries(LANG_LABELS) as [CodeLanguage, string][]).map(
                                      ([val, label]) => (
                                        <option key={val} value={val}>
                                          {label}
                                        </option>
                                      )
                                    )}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => removeCodeSnippet(qIdx)}
                                    className="text-xs text-red-400 hover:text-red-300"
                                  >
                                    Remove snippet
                                  </button>
                                </div>
                              </div>
                              <CodeEditor
                                value={q.code_snippet ?? ""}
                                onChange={(val) => setCodeSnippet(qIdx, val)}
                                language={q.code_language ?? "javascript"}
                                editable={true}
                              />
                            </div>
                          )}
                        </div>

                        {/* Choices */}
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide">
                              Choices (correct = ✓)
                            </span>
                            {!isTrueFalse && (
                              <button
                                type="button"
                                onClick={() => addChoice(qIdx)}
                                className="text-xs text-teal-primary hover:opacity-90"
                              >
                                + Add choice
                              </button>
                            )}
                          </div>
                          {(q.choices ?? []).map((choice, cIdx) => (
                            <div key={`edit-q-${qIdx}-c-${cIdx}`} className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={() => setCorrectChoice(qIdx, choice.ident)}
                                className={`shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center text-xs ${
                                  q.correct_response_ident === choice.ident
                                    ? "border-teal-primary bg-teal-primary text-white"
                                    : "border-border text-muted-text hover:border-teal-primary/50"
                                }`}
                                title="Mark as correct answer"
                              >
                                {q.correct_response_ident === choice.ident ? "✓" : ""}
                              </button>
                              <div className="flex-1 min-w-0 flex flex-col gap-1">
                                {isTrueFalse ? (
                                  <span className="text-sm text-dark-text px-3 py-2 bg-background border border-border rounded-lg">
                                    {choice.text}
                                  </span>
                                ) : (
                                  <>
                                    <ChoiceEditor
                                      key={choice.ident}
                                      initialContent={choice.text || ""}
                                      onChange={(html) => updateChoice(qIdx, cIdx, html)}
                                      storagePath={quizStoragePath}
                                    />
                                    <div className="flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => removeChoice(qIdx, cIdx)}
                                        disabled={(q.choices ?? []).length <= 2}
                                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        Remove choice
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        </>
                        )}
                      </SortableQuestion>
                    );
                  })}
                </ul>
                  </SortableContext>
                </DndContext>
                {/* Bulk import */}
                {showBulkImport && (
                  <div className="mt-4 border border-border rounded-xl p-4 flex flex-col gap-3 bg-background">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Bulk import questions</p>
                      <button type="button" onClick={() => { setShowBulkImport(false); setBulkImportText(""); }} className="text-muted-text hover:text-dark-text text-lg leading-none">×</button>
                    </div>
                    <textarea
                      value={bulkImportText}
                      onChange={e => setBulkImportText(e.target.value)}
                      rows={12}
                      placeholder={`Blank lines separate questions. First answer is always correct.\n\nWhat is typeof null?\n"object"\n"null"\n"undefined"\n\nIs JS single-threaded?\nTrue\nFalse`}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary/50 font-mono resize-y"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-text">
                        {bulkImportText.trim()
                          ? <span className="text-teal-primary font-medium">{parseQuizText(bulkImportText).length} question(s) detected — will be appended</span>
                          : "Paste questions above"}
                      </p>
                      <button
                        type="button"
                        disabled={!bulkImportText.trim()}
                        onClick={() => {
                          const parsed = parseQuizText(bulkImportText);
                          if (parsed.length > 0) {
                            setEditQuestions(prev => [...prev, ...parsed]);
                            setShowBulkImport(false);
                            setBulkImportText("");
                          }
                        }}
                        className="text-sm font-semibold px-4 py-2 rounded-full bg-teal-primary text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Import {bulkImportText.trim() ? `(${parseQuizText(bulkImportText).length}q)` : ""}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="text-sm text-teal-primary hover:opacity-90 font-medium"
                    >
                      + Add question
                    </button>
                    {!showBulkImport && (
                      <button
                        type="button"
                        onClick={() => setShowBulkImport(true)}
                        className="text-sm text-muted-text hover:text-teal-primary transition-colors font-medium"
                      >
                        + Bulk import
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditQuestions(JSON.parse(JSON.stringify(quiz.questions ?? [])));
                        setShowBulkImport(false);
                        setBulkImportText("");
                      }}
                      className="text-sm text-muted-text hover:text-dark-text px-4 py-2"
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveQuestions}
                      disabled={saving}
                      className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-50"
                      type="button"
                    >
                      Save questions
                    </button>
                  </div>
                </div>
              </div>
            ) : (
            /* All questions and multiple choice answers (with HTML/images) */
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h2 className="text-sm font-bold text-muted-text uppercase tracking-wide mb-4">
                All questions &amp; answers
              </h2>
              {editQuestions.length === 0 ? (
                <p className="text-sm text-muted-text">No questions in this quiz.</p>
              ) : (
                <ul className="space-y-8">
                  {editQuestions.map((q, i) => {
                    const correctChoice = getCorrectChoice(q);
                    return (
                      <li
                        key={`view-q-${i}`}
                        className="border-b border-border pb-8 last:border-0 last:pb-0 last:mb-0"
                      >
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide">
                              Question {i + 1}
                            </span>
                            {q.question_type === "true_false" && (
                              <span className="text-xs bg-border/30 text-muted-text px-1.5 py-0.5 rounded">
                                True / False
                              </span>
                            )}
                          </div>
                          <div className="quiz-html mt-1 text-sm text-dark-text [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:border [&_img]:border-border">
                            <HighlightedContent html={q.question_text || ""} />
                          </div>
                          {q.code_snippet && (
                            <div className="mt-3">
                              <CodeEditor
                                value={q.code_snippet}
                                language={q.code_language ?? "javascript"}
                                editable={false}
                              />
                            </div>
                          )}
                        </div>
                        <ul className="space-y-2 pl-2">
                          {(q.choices ?? []).map((choice, cIdx) => {
                            const isCorrect = correctChoice?.ident === choice.ident;
                            return (
                              <li
                                key={`view-q-${i}-c-${cIdx}`}
                                className={`flex items-start gap-2 text-sm ${
                                  isCorrect
                                    ? "text-teal-primary font-medium"
                                    : "text-dark-text"
                                }`}
                              >
                                <span className="shrink-0 mt-0.5">
                                  {isCorrect ? "✓" : "○"}
                                </span>
                                <div className="quiz-html min-w-0 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:border [&_img]:border-border">
                                  <HighlightedContent html={choice.text || ""} />
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            )}
          </>
      </div>
    </div>
  );
}
