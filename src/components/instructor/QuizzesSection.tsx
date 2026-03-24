"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { QuizRow } from "@/data/quizzes";
import { createQuizWithQuestions, toggleQuizPublished, upsertQuizFromJson, updateQuizMeta } from "@/lib/quiz-actions";
import QuizFullView from "./QuizFullView";
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

type QuizzesSectionProps = {
  courseId: string;
  quizzes: QuizRow[];
  initialOpenQuizId?: string;
  moduleTitles?: string[];
};

function sortByWeekNumber(a: string, b: string): number {
  const weekA = a.match(/^Week\s+(\d+)/i)?.[1];
  const weekB = b.match(/^Week\s+(\d+)/i)?.[1];
  if (weekA && weekB) return parseInt(weekA, 10) - parseInt(weekB, 10);
  if (weekA) return -1;
  if (weekB) return 1;
  return a.localeCompare(b);
}

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

function SortableModuleGroup({
  id,
  title,
  isCollapsed,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-surface rounded-2xl border border-border overflow-hidden ${isDragging ? "opacity-50 shadow-lg z-10" : ""}`}
    >
      <div className="px-4 py-3 border-b border-border flex items-center gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab text-border hover:text-muted-text transition-colors shrink-0 p-1 -ml-1 touch-none"
          aria-label="Drag to reorder module"
        >
          ⠿
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center justify-between gap-2 text-left"
        >
          <h3 className="text-sm font-semibold text-dark-text">{title}</h3>
          <span className="text-xs text-muted-text pr-1">{isCollapsed ? "▶" : "▾"}</span>
        </button>
      </div>
      {!isCollapsed && children}
    </div>
  );
}

function SortableQuizRow({
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
      className={`px-6 py-4 flex items-center gap-3 ${isDragging ? "opacity-50 bg-background" : ""}`}
    >
      {children({ ...attributes, ...listeners })}
    </li>
  );
}

export default function QuizzesSection({ courseId, quizzes = [], initialOpenQuizId, moduleTitles = [] }: QuizzesSectionProps) {
  const router = useRouter();
  const [localQuizzes, setLocalQuizzes] = useState<QuizRow[]>(Array.isArray(quizzes) ? quizzes : []);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizRow | null>(() => {
    if (initialOpenQuizId) {
      return (quizzes || []).find((q) => q.id === initialOpenQuizId) ?? null;
    }
    return null;
  });

  // When initialOpenQuizId changes (e.g. after server action remounts component),
  // sync selectedQuiz from the updated localQuizzes
  useEffect(() => {
    if (initialOpenQuizId) {
      const quiz = localQuizzes.find(q => q.id === initialOpenQuizId);
      if (quiz) setSelectedQuiz(quiz);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpenQuizId]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [importTitle, setImportTitle] = useState("");
  const [importModuleTitle, setImportModuleTitle] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [moduleOrder, setModuleOrder] = useState<string[]>(() => {
    const present = new Set((quizzes || []).map((q) => q.module_title || "Other"));
    // Use moduleTitles canonical order, then append any extras not in that list
    const ordered = (moduleTitles || []).filter((m) => present.has(m));
    const extras = Array.from(present).filter((m) => !moduleTitles?.includes(m)).sort(sortByWeekNumber);
    return [...ordered, ...extras];
  });

  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(() => {
    const mods = new Set<string>();
    (quizzes || []).forEach((q) => mods.add(q.module_title || "Other"));
    return mods;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const byModule = useMemo(
    () =>
      localQuizzes.reduce<Record<string, QuizRow[]>>((acc, q) => {
        const key = q.module_title || "Other";
        if (!acc[key]) acc[key] = [];
        acc[key].push(q);
        return acc;
      }, {}),
    [localQuizzes]
  );

  // Keep moduleOrder in sync when quizzes are added/removed, always using moduleTitles canonical order
  useEffect(() => {
    const currentModules = new Set(localQuizzes.map((q) => q.module_title || "Other"));
    const ordered = (moduleTitles || []).filter((m) => currentModules.has(m));
    const extras = Array.from(currentModules).filter((m) => !moduleTitles?.includes(m)).sort(sortByWeekNumber);
    const next = [...ordered, ...extras];
    setModuleOrder((prev) =>
      next.length === prev.length && next.every((m, i) => m === prev[i]) ? prev : next
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQuizzes]);

  const allCollapsed = moduleOrder.length > 0 && moduleOrder.every((m) => collapsedModules.has(m));

  const toggleCollapseAll = () => {
    setCollapsedModules(allCollapsed ? new Set() : new Set(moduleOrder));
  };

  const toggleCollapse = (moduleTitle: string) => {
    setCollapsedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleTitle)) next.delete(moduleTitle);
      else next.add(moduleTitle);
      return next;
    });
  };

  const handleModuleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setModuleOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleQuizDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalQuizzes((prev) => {
      const oldIdx = prev.findIndex((q) => q.id === active.id);
      const newIdx = prev.findIndex((q) => q.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };


  const handleTogglePublished = async (quiz: QuizRow) => {
    const newPublished = !quiz.published;
    setLocalQuizzes((prev) => prev.map((q) => (q.id === quiz.id ? { ...q, published: newPublished } : q)));
    try {
      if (quiz.id.startsWith("json-")) {
        const saved = await upsertQuizFromJson(courseId, quiz.identifier, {
          title: quiz.title,
          due_at: quiz.due_at || null,
          module_title: quiz.module_title ?? "",
          published: true,
          questions: quiz.questions ?? [],
          max_attempts: quiz.max_attempts ?? null,
        });
        if (saved) {
          setLocalQuizzes((prev) => prev.map((q) => (q.id === quiz.id ? (saved as QuizRow) : q)));
        }
      } else {
        await toggleQuizPublished(quiz.id, courseId, newPublished);
      }
    } catch {
      setLocalQuizzes((prev) => prev.map((q) => (q.id === quiz.id ? quiz : q)));
    }
  };

const [navigating, setNavigating] = useState(false);

  // ── Move popup ──────────────────────────────────────────────────────────
  const [movePopupQuiz, setMovePopupQuiz] = useState<QuizRow | null>(null);
  const [movePopupPos, setMovePopupPos] = useState<{ top: number; right: number } | null>(null);
  const [moveToModule, setMoveToModule] = useState("");
  const [moveToDay, setMoveToDay] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const movePopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!movePopupQuiz) return;
    const handler = (e: MouseEvent) => {
      if (movePopupRef.current && !movePopupRef.current.contains(e.target as Node)) {
        setMovePopupQuiz(null);
        setMovePopupPos(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [movePopupQuiz]);

  const handleMoveQuiz = async () => {
    if (!movePopupQuiz) return;
    const quiz = movePopupQuiz;
    setMoving(true);
    try {
      await updateQuizMeta(quiz.id, courseId, { module_title: moveToModule, day_title: moveToDay });
      setLocalQuizzes((prev) =>
        prev.map((q) => q.id === quiz.id ? { ...q, module_title: moveToModule, day_title: moveToDay } : q)
      );
      setMovePopupQuiz(null);
      setMovePopupPos(null);
    } catch {
      // keep popup open on error
    } finally {
      setMoving(false);
    }
  };

  const handleCreate = async () => {
    const title = importTitle.trim() || "New Quiz";
    const moduleTitle = importModuleTitle.trim();
    setImporting(true);
    setImportError(null);
    try {
      const data = await createQuizWithQuestions(courseId, title, [], moduleTitle);
      if (data) {
        setLocalQuizzes((prev) => [...prev, data as QuizRow]);
        setShowImport(false);
        setImportTitle("");
        setImportModuleTitle("");
        // Navigate to ?open= so the editor opens reliably even if the server
        // action causes Next.js to remount this component
        setNavigating(true);
        router.replace(`?open=${data.id}`);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to create quiz");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      {navigating && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <p className="text-muted-text text-sm">Opening quiz editor…</p>
        </div>
      )}
      {selectedQuiz && (
        <QuizFullView
          quiz={selectedQuiz}
          courseId={courseId}
          moduleTitles={moduleTitles}
          onClose={() => setSelectedQuiz(null)}
          onSaved={(updatedQuiz) => {
            setSelectedQuiz(updatedQuiz);
            setLocalQuizzes((prev) =>
              prev.some((q) => q.id === updatedQuiz.id)
                ? prev.map((q) => (q.id === updatedQuiz.id ? updatedQuiz : q))
                : prev.map((q) => (q.id === selectedQuiz?.id ? updatedQuiz : q))
            );
          }}
          onDeleted={(deletedId) => {
            setLocalQuizzes((prev) => prev.filter((q) => q.id !== deletedId));
            setSelectedQuiz(null);
          }}
        />
      )}
      {/* Fixed move popup — rendered outside overflow containers */}
      {movePopupQuiz && movePopupPos && (
        <div
          ref={movePopupRef}
          style={{ position: "fixed", top: movePopupPos.top, right: movePopupPos.right, zIndex: 200 }}
          className="bg-surface border border-border rounded-xl shadow-xl p-4 w-64"
        >
          <p className="text-xs font-bold text-muted-text uppercase tracking-wide mb-3">Move To</p>
          <select
            value={moveToModule}
            onChange={(e) => setMoveToModule(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-dark-text focus:outline-none focus:ring-1 focus:ring-teal-primary mb-3"
          >
            {moduleTitles.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setMoveToDay(day)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  moveToDay === day
                    ? "bg-teal-primary text-white border-teal-primary"
                    : "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary"
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleMoveQuiz}
            disabled={moving}
            className="w-full text-xs font-semibold py-2 rounded-lg bg-teal-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {moving ? "Moving…" : "Move"}
          </button>
        </div>
      )}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-dark-text">Quizzes</h2>
          <div className="flex items-center gap-2">
            {moduleOrder.length > 0 && (
              <button
                type="button"
                onClick={toggleCollapseAll}
                className="text-xs text-muted-text hover:text-dark-text transition-colors"
              >
                {allCollapsed ? "Expand all" : "Collapse all"}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setShowImport((v) => !v); setImportError(null); }}
              className="text-sm font-semibold px-4 py-2 rounded-full bg-teal-primary text-white hover:opacity-90 transition-opacity"
            >
              + New Quiz
            </button>
          </div>
        </div>

        {/* ── Import panel ─────────────────────────────────────────────── */}
        {showImport && (
          <div className="mb-4 bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-dark-text">New Quiz</p>
              <button
                type="button"
                onClick={() => { setShowImport(false); setImportError(null); }}
                className="text-muted-text hover:text-dark-text text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <input
              type="text"
              value={importTitle}
              onChange={(e) => setImportTitle(e.target.value)}
              placeholder="Quiz title"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
            />
            {moduleTitles.length > 0 && (
              <select
                value={importModuleTitle}
                onChange={(e) => setImportModuleTitle(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
              >
                <option value="">— Week (optional) —</option>
                {moduleTitles.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}

            <p className="text-xs text-muted-text">You&apos;ll be able to bulk-import questions after creating.</p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowImport(false); setImportError(null); }}
                className="text-sm px-4 py-2 rounded-full border border-border text-muted-text hover:text-dark-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={importing}
                className="text-sm font-semibold px-4 py-2 rounded-full bg-teal-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {importing ? "Creating…" : "Create Quiz →"}
              </button>
            </div>

            {importError && (
              <p className="text-sm text-red-400">{importError}</p>
            )}
          </div>
        )}

        {createError && (
          <div className="mb-3 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {createError}
          </div>
        )}

        {localQuizzes.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-6 text-center">
            <p className="text-sm text-muted-text">No quizzes for this course yet.</p>
            <p className="text-xs text-muted-text mt-1">Click &ldquo;+ New Quiz&rdquo; to create one, or paste in questions to import.</p>
          </div>
        ) : (
          <>
            {localQuizzes.some((q) => q.id.startsWith("json-")) && (
              <p className="text-xs text-muted-text mb-3">
                Loaded from course data. To save edits and control visibility, run the{" "}
                <code className="bg-background px-1 rounded">quizzes</code> table migration in Supabase.
              </p>
            )}
            <div className="flex flex-col gap-4">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
                <SortableContext items={moduleOrder} strategy={verticalListSortingStrategy}>
                  {moduleOrder.map((moduleTitle) => (
                    <SortableModuleGroup
                      key={moduleTitle}
                      id={moduleTitle}
                      title={moduleTitle}
                      isCollapsed={collapsedModules.has(moduleTitle)}
                      onToggle={() => toggleCollapse(moduleTitle)}
                    >
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleQuizDragEnd}>
                        <SortableContext
                          items={(byModule[moduleTitle] ?? []).map((q) => q.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <ul className="divide-y divide-border">
                            {(byModule[moduleTitle] ?? []).map((quiz) => {
                              const displayTitle =
                                quiz.title.startsWith("Quiz: ") ? quiz.title.slice(6) : quiz.title;
                              const hasSnippet = (quiz.questions ?? []).some((q) => q.code_snippet);
                              return (
                                <SortableQuizRow key={quiz.id} id={quiz.id}>
                                  {(dragHandleProps) => (
                                    <>
                                      <button
                                        type="button"
                                        {...(dragHandleProps as React.HTMLAttributes<HTMLButtonElement>)}
                                        className="cursor-grab text-border hover:text-muted-text transition-colors shrink-0 touch-none"
                                        aria-label="Drag to reorder quiz"
                                      >
                                        ⠿
                                      </button>
                                      {/* Main clickable area */}
                                      <button
                                        type="button"
                                        onClick={() => setSelectedQuiz(quiz)}
                                        className="flex-1 min-w-0 text-left flex items-center gap-3 group"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-medium text-dark-text group-hover:text-teal-primary transition-colors">
                                              {displayTitle}
                                            </p>
                                            {quiz.max_attempts && (
                                              <span className="text-xs bg-border/40 text-muted-text px-1.5 py-0.5 rounded-full">
                                                Up to {quiz.max_attempts} attempts
                                              </span>
                                            )}
                                            {hasSnippet && (
                                              <span className="text-xs bg-border/40 text-muted-text px-1.5 py-0.5 rounded-full">
                                                code
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-xs text-muted-text mt-0.5">
                                            Due: {formatDueDate(quiz.due_at)} · {quiz.questions?.length ?? 0}{" "}
                                            question{(quiz.questions?.length ?? 0) !== 1 ? "s" : ""}
                                          </p>
                                        </div>
                                        <span className="text-xs text-muted-text opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                          View / Edit →
                                        </span>
                                      </button>

                                      {/* Publish / unpublish pill */}
                                      <button
                                        type="button"
                                        onClick={() => handleTogglePublished(quiz)}
                                        className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border transition-colors ${
                                          quiz.published
                                            ? "border-teal-primary text-teal-primary hover:bg-teal-primary hover:text-white"
                                            : "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary"
                                        }`}
                                        aria-label={quiz.published ? "Published — click to unpublish" : "Draft — click to publish"}
                                      >
                                        {quiz.published ? "Published" : "Draft"}
                                      </button>

                                      {!quiz.id.startsWith("json-") && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (movePopupQuiz?.id === quiz.id) {
                                              setMovePopupQuiz(null);
                                              setMovePopupPos(null);
                                            } else {
                                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                              setMovePopupPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                                              setMoveToModule(quiz.module_title || moduleTitles[0] || "");
                                              setMoveToDay(quiz.day_title ?? null);
                                              setMovePopupQuiz(quiz);
                                            }
                                          }}
                                          className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full border transition-colors ${
                                            movePopupQuiz?.id === quiz.id
                                              ? "border-teal-primary text-teal-primary"
                                              : "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary"
                                          }`}
                                          aria-label="Move quiz"
                                          title="Move to…"
                                        >
                                          ⇄
                                        </button>
                                      )}

                                      {!quiz.id.startsWith("json-") && quiz.published && (
                                        <>
                                          <Link
                                            href={`/instructor/courses/${courseId}/quizzes/${quiz.id}/conduct`}
                                            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border border-border text-muted-text hover:border-teal-primary hover:text-teal-primary transition-colors"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              try { localStorage.setItem(`conductingQuiz_${courseId}`, `/instructor/courses/${courseId}/quizzes/${quiz.id}/conduct`) } catch {}
                                            }}
                                          >
                                            ▶ Moderate
                                          </Link>
                                          <Link
                                            href={`/instructor/courses/${courseId}/quizzes/${quiz.id}/conduct`}
                                            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border border-border text-muted-text hover:border-border/60 hover:text-dark-text transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            Results
                                          </Link>
                                        </>
                                      )}
                                    </>
                                  )}
                                </SortableQuizRow>
                              );
                            })}
                          </ul>
                        </SortableContext>
                      </DndContext>
                    </SortableModuleGroup>
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </>
        )}
      </section>
    </>
  );
}
