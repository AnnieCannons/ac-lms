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
import HtmlContent from "@/components/ui/HtmlContent";
import dynamic from "next/dynamic";
import {
  updateQuizMeta,
  updateQuizQuestions,
  toggleQuizPublished,
  upsertQuizFromJson,
  deleteQuiz,
} from "@/lib/quiz-actions";

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

export default function QuizFullView({ quiz, courseId, onClose, onSaved, onDeleted }: QuizFullViewProps) {
  const router = useRouter();
  const fromJsonOnly = isJsonOnlyQuiz(quiz.id);
  const [editing, setEditing] = useState(false);
  const [editingQuestions, setEditingQuestions] = useState(false);
  const [editTitle, setEditTitle] = useState(quiz.title);
  const [editDueDate, setEditDueDate] = useState(
    quiz.due_at ? new Date(quiz.due_at).toISOString().slice(0, 16) : ""
  );
  const [editMaxAttempts, setEditMaxAttempts] = useState<number | null>(quiz.max_attempts ?? null);
  const [editQuestions, setEditQuestions] = useState<QuizQuestion[]>([]);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditTitle(quiz.title);
    setEditDueDate(quiz.due_at ? new Date(quiz.due_at).toISOString().slice(0, 16) : "");
    setEditMaxAttempts(quiz.max_attempts ?? null);
  }, [quiz.id, quiz.title, quiz.due_at, quiz.max_attempts]);

  useEffect(() => {
    setEditQuestions(JSON.parse(JSON.stringify(quiz.questions ?? [])));
  }, [quiz.id, quiz.questions]);

  const handleTogglePublished = async () => {
    setError(null);
    setSaving(true);
    try {
      if (fromJsonOnly) {
        const saved = await upsertQuizFromJson(courseId, quiz.identifier, {
          title: editTitle.trim() || quiz.title,
          due_at: editDueDate || quiz.due_at || null,
          module_title: quiz.module_title ?? "",
          published: true,
          questions: quiz.questions ?? [],
          max_attempts: quiz.max_attempts ?? null,
        });
        if (saved) onSaved?.(saved as QuizRow);
      } else {
        await toggleQuizPublished(quiz.id, !quiz.published);
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
        await deleteQuiz(quiz.id);
      }
      onDeleted?.(quiz.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
    setSaving(false);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setError(null);
    setSaving(true);
    try {
      if (fromJsonOnly) {
        const saved = await upsertQuizFromJson(courseId, quiz.identifier, {
          title: editTitle.trim(),
          due_at: editDueDate || null,
          module_title: quiz.module_title ?? "",
          published: false,
          questions: quiz.questions ?? [],
          max_attempts: editMaxAttempts,
        });
        if (saved) onSaved?.(saved as QuizRow);
        setEditing(false);
      } else {
        await updateQuizMeta(quiz.id, {
          title: editTitle.trim(),
          due_at: editDueDate || null,
          max_attempts: editMaxAttempts,
        });
        onSaved?.({ ...quiz, title: editTitle.trim(), due_at: editDueDate || null, max_attempts: editMaxAttempts });
        setEditing(false);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
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
        await updateQuizQuestions(quiz.id, editQuestions);
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
                if (editing) {
                  setEditing(false);
                } else if (editingQuestions) {
                  if (!confirm("You have unsaved changes. Leave without saving?")) return;
                  setEditingQuestions(false);
                } else {
                  onClose();
                }
              }}
              className="text-sm text-muted-text hover:text-dark-text transition-colors flex items-center gap-1.5"
              type="button"
            >
              {editing || editingQuestions ? "← Back to quiz" : "← Back to quizzes"}
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
            {!editing && !quiz.id.startsWith("json-") && quiz.published && (
              <a
                href={`/instructor/courses/${courseId}/quizzes/${quiz.id}/conduct`}
                className="text-xs font-medium px-3 py-1 rounded-full border border-border text-muted-text hover:border-teal-primary/50 hover:text-dark-text transition-colors"
              >
                ▶ Conduct quiz
              </a>
            )}
            {!editing && (
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
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </div>
        )}

        {editing ? (
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              autoFocus
              className="text-2xl font-bold text-dark-text bg-transparent border-b-2 border-teal-primary focus:outline-none pb-1 w-full"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-text shrink-0">Due:</label>
              <div className="relative flex-1">
                <input
                  ref={dueDateRef}
                  type="datetime-local"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full bg-surface border border-border text-dark-text rounded-lg pl-3 pr-9 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-primary"
                />
                <button
                  type="button"
                  onClick={() => dueDateRef.current?.showPicker()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-text hover:text-teal-primary transition-colors"
                  aria-label="Open date picker"
                  tabIndex={-1}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </button>
              </div>
            </div>
            {/* Max attempts */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-text uppercase tracking-wide">
                Max Attempts
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-dark-text cursor-pointer">
                  <input
                    type="radio"
                    name="max_attempts_mode"
                    checked={editMaxAttempts === null}
                    onChange={() => setEditMaxAttempts(null)}
                  />
                  Unlimited
                </label>
                <label className="flex items-center gap-2 text-sm text-dark-text cursor-pointer">
                  <input
                    type="radio"
                    name="max_attempts_mode"
                    checked={editMaxAttempts !== null}
                    onChange={() => setEditMaxAttempts(editMaxAttempts ?? 3)}
                  />
                  Limited
                </label>
                {editMaxAttempts !== null && (
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={editMaxAttempts}
                    onChange={(e) => setEditMaxAttempts(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 bg-surface border border-border text-dark-text rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  />
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setEditTitle(quiz.title);
                  setEditDueDate(quiz.due_at ? new Date(quiz.due_at).toISOString().slice(0, 16) : "");
                  setEditMaxAttempts(quiz.max_attempts ?? null);
                }}
                className="text-sm text-muted-text hover:text-dark-text px-4 py-2"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-50"
                type="button"
              >
                Save changes
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-dark-text">{displayTitle}</h1>
                <p className="text-sm text-muted-text mt-1">
                  Due: {formatDueDate(quiz.due_at)}
                </p>
                {quiz.module_title && (
                  <p className="text-xs text-muted-text mt-1">{quiz.module_title}</p>
                )}
                <p className="text-xs text-muted-text mt-1">
                  Attempts: {quiz.max_attempts ? `Up to ${quiz.max_attempts}` : "Unlimited"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-muted-text hover:text-dark-text transition-colors"
                  type="button"
                >
                  ✎ Edit title &amp; due date
                </button>
                <button
                  onClick={() => setEditingQuestions(true)}
                  className="text-sm text-muted-text hover:text-dark-text transition-colors"
                  type="button"
                >
                  ✎ Edit questions &amp; answers
                </button>
              </div>
            </div>

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
                <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="text-sm text-teal-primary hover:opacity-90 font-medium"
                  >
                    + Add question
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setEditQuestions(JSON.parse(JSON.stringify(quiz.questions ?? [])))
                      }
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
                          <div className="quiz-html mt-1 text-sm text-dark-text [&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:bg-[#1e1e2e] [&_pre]:border [&_pre]:border-[#313244] [&_pre]:p-4 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:border [&_img]:border-border">
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
                                <div className="quiz-html min-w-0 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:border [&_img]:border-border [&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:bg-[#1e1e2e] [&_pre]:border [&_pre]:border-[#313244] [&_pre]:p-3">
                                  <HtmlContent html={choice.text || ""} />
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
        )}
      </div>
    </div>
  );
}
