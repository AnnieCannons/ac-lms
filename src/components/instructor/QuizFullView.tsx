"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { QuizRow, QuizQuestion, QuizChoice, CodeLanguage } from "@/data/quizzes";
import HtmlContent from "@/components/ui/HtmlContent";
import FileUpload from "@/components/ui/FileUpload";
import dynamic from "next/dynamic";

const CodeEditor = dynamic(() => import("@/components/ui/CodeEditor"), { ssr: false });
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

export default function QuizFullView({ quiz, courseId, onClose }: QuizFullViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const fromJsonOnly = isJsonOnlyQuiz(quiz.id);
  const [editing, setEditing] = useState(false);
  const [editingQuestions, setEditingQuestions] = useState(false);
  const [editTitle, setEditTitle] = useState(quiz.title);
  const [editDueDate, setEditDueDate] = useState(
    quiz.due_at ? new Date(quiz.due_at).toISOString().slice(0, 16) : ""
  );
  const [editMaxAttempts, setEditMaxAttempts] = useState<number | null>(quiz.max_attempts ?? null);
  const [editQuestions, setEditQuestions] = useState<QuizQuestion[]>([]);
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
    if (fromJsonOnly) {
      const row = {
        course_id: courseId,
        identifier: quiz.identifier,
        title: editTitle.trim() || quiz.title,
        due_at: editDueDate || quiz.due_at || null,
        module_title: quiz.module_title ?? "",
        published: true,
        questions: quiz.questions ?? [],
        max_attempts: quiz.max_attempts ?? null,
        updated_at: new Date().toISOString(),
      };
      const { error: err } = await supabase
        .from("quizzes")
        .upsert(row, { onConflict: "course_id,identifier" });
      if (err) {
        setError(err.message);
      } else {
        onClose();
        router.refresh();
      }
    } else {
      const { error: err } = await supabase
        .from("quizzes")
        .update({ published: !quiz.published, updated_at: new Date().toISOString() })
        .eq("id", quiz.id);
      if (err) {
        setError(err.message);
      } else {
        router.refresh();
      }
    }
    setSaving(false);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setError(null);
    setSaving(true);
    if (fromJsonOnly) {
      const row = {
        course_id: courseId,
        identifier: quiz.identifier,
        title: editTitle.trim(),
        due_at: editDueDate || null,
        module_title: quiz.module_title ?? "",
        published: false,
        questions: quiz.questions ?? [],
        max_attempts: editMaxAttempts,
        updated_at: new Date().toISOString(),
      };
      const { error: err } = await supabase
        .from("quizzes")
        .upsert(row, { onConflict: "course_id,identifier" });
      if (err) {
        setError(err.message);
      } else {
        onClose();
        router.refresh();
      }
    } else {
      const { error: err } = await supabase
        .from("quizzes")
        .update({
          title: editTitle.trim(),
          due_at: editDueDate || null,
          max_attempts: editMaxAttempts,
          updated_at: new Date().toISOString(),
        })
        .eq("id", quiz.id);
      if (err) {
        setError(err.message);
      } else {
        setEditing(false);
        router.refresh();
      }
    }
    setSaving(false);
  };

  const handleSaveQuestions = async () => {
    setError(null);
    setSaving(true);
    if (fromJsonOnly) {
      const row = {
        course_id: courseId,
        identifier: quiz.identifier,
        title: quiz.title,
        due_at: quiz.due_at || null,
        module_title: quiz.module_title ?? "",
        published: false,
        questions: editQuestions,
        max_attempts: quiz.max_attempts ?? null,
        updated_at: new Date().toISOString(),
      };
      const { error: err } = await supabase
        .from("quizzes")
        .upsert(row, { onConflict: "course_id,identifier" });
      if (err) {
        setError(err.message);
      } else {
        onClose();
        router.refresh();
      }
    } else {
      const { error: err } = await supabase
        .from("quizzes")
        .update({
          questions: editQuestions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", quiz.id);
      if (err) {
        setError(err.message);
      } else {
        setEditingQuestions(false);
        router.refresh();
      }
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

  const insertImageIntoChoice = (qIdx: number, cIdx: number, url: string, fileName: string) => {
    const img = `<p><img src="${url}" alt="${fileName.replace(/"/g, "&quot;")}" /></p>`;
    setEditQuestions((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[qIdx].choices) next[qIdx].choices = [];
      next[qIdx].choices[cIdx].text = (next[qIdx].choices[cIdx].text || "") + img;
      return next;
    });
  };

  const displayTitle = quiz.title.startsWith("Quiz: ") ? quiz.title.slice(6) : quiz.title;
  const quizStoragePath = `quizzes/${courseId}/${quiz.identifier || quiz.id}/`;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-sm text-muted-text hover:text-dark-text transition-colors flex items-center gap-1.5"
            type="button"
          >
            ← Back to quizzes
          </button>
          <div className="flex items-center gap-4">
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
              <input
                type="datetime-local"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="flex-1 bg-surface border border-border text-dark-text rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-primary"
              />
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
                <ul className="space-y-8">
                  {editQuestions.map((q, qIdx) => {
                    const isTrueFalse = q.question_type === "true_false";
                    const hasSnippet = !!q.code_snippet;
                    return (
                      <li
                        key={`edit-q-${qIdx}`}
                        className="border-b border-border pb-8 last:border-0"
                      >
                        {/* Question header row */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3">
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
                                    <textarea
                                      value={choice.text}
                                      onChange={(e) => updateChoice(qIdx, cIdx, e.target.value)}
                                      rows={2}
                                      className="w-full bg-background border border-border text-dark-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary font-mono"
                                    />
                                    <div className="flex items-center gap-2">
                                      <FileUpload
                                        bucket="lms-resources"
                                        path={quizStoragePath}
                                        accept="image/*"
                                        onUpload={(url, fileName) =>
                                          insertImageIntoChoice(qIdx, cIdx, url, fileName)
                                        }
                                      />
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
                      </li>
                    );
                  })}
                </ul>
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
              {(!quiz.questions || quiz.questions.length === 0) ? (
                <p className="text-sm text-muted-text">No questions in this quiz.</p>
              ) : (
                <ul className="space-y-8">
                  {(quiz.questions ?? []).map((q, i) => {
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
                          <div className="mt-1 text-sm text-dark-text [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:border [&_img]:border-border">
                            <HtmlContent html={q.question_text || ""} />
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
                                <div className="min-w-0 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:border [&_img]:border-border">
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
