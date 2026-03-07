"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { QuizRow } from "@/data/quizzes";
import { createQuiz, toggleQuizPublished, upsertQuizFromJson } from "@/lib/quiz-actions";
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

export default function QuizzesSection({ courseId, quizzes = [], initialOpenQuizId }: QuizzesSectionProps) {
  const router = useRouter();
  const [localQuizzes, setLocalQuizzes] = useState<QuizRow[]>(Array.isArray(quizzes) ? quizzes : []);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizRow | null>(() => {
    if (initialOpenQuizId) {
      return (quizzes || []).find((q) => q.id === initialOpenQuizId) ?? null;
    }
    return null;
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [moduleOrder, setModuleOrder] = useState<string[]>(() => {
    const modules = new Set<string>();
    (quizzes || []).forEach((q) => modules.add(q.module_title || "Other"));
    return Array.from(modules).sort();
  });

  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());

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

  // Keep moduleOrder in sync when quizzes are added/removed
  useEffect(() => {
    const currentModules = new Set(localQuizzes.map((q) => q.module_title || "Other"));
    setModuleOrder((prev) => {
      const filtered = prev.filter((m) => currentModules.has(m));
      for (const m of currentModules) {
        if (!filtered.includes(m)) filtered.push(m);
      }
      return filtered.length === prev.length && filtered.every((m, i) => m === prev[i])
        ? prev
        : filtered;
    });
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

  const handleNewQuiz = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const data = await createQuiz(courseId);
      if (data) {
        setSelectedQuiz(data as QuizRow);
        router.refresh();
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create quiz");
    } finally {
      setCreating(false);
    }
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
        await toggleQuizPublished(quiz.id, newPublished);
      }
    } catch {
      setLocalQuizzes((prev) => prev.map((q) => (q.id === quiz.id ? quiz : q)));
    }
  };

  return (
    <>
      {selectedQuiz && (
        <QuizFullView
          quiz={selectedQuiz}
          courseId={courseId}
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
              onClick={handleNewQuiz}
              disabled={creating}
              className="text-sm font-semibold px-4 py-2 rounded-full bg-teal-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {creating ? "Creating…" : "+ New Quiz"}
            </button>
          </div>
        </div>
        {createError && (
          <div className="mb-3 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {createError}
          </div>
        )}

        {localQuizzes.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-6 text-center">
            <p className="text-sm text-muted-text">No quizzes for this course yet.</p>
            <p className="text-xs text-muted-text mt-1">Click &ldquo;+ New Quiz&rdquo; to create one.</p>
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
                                        aria-label={quiz.published ? "Published — click to unpublish" : "Unpublished — click to publish"}
                                      >
                                        {quiz.published ? "Published" : "Unpublished"}
                                      </button>

                                      {!quiz.id.startsWith("json-") && (
                                        <Link
                                          href={`/instructor/courses/${courseId}/quizzes/${quiz.id}/conduct`}
                                          className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border border-border text-muted-text hover:border-teal-primary hover:text-teal-primary transition-colors"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          ▶ Conduct
                                        </Link>
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
