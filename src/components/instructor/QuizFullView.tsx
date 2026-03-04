"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { QuizRow, QuizQuestion, QuizChoice } from "@/data/quizzes";
import HtmlContent from "@/components/ui/HtmlContent";
import FileUpload from "@/components/ui/FileUpload";

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

/** Get the correct choice for a question */
function getCorrectChoice(question: QuizQuestion): QuizChoice | undefined {
  return question.choices?.find((c) => c.ident === question.correct_response_ident);
}

const isJsonOnlyQuiz = (id: string) => id.startsWith("json-");

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
  const [editQuestions, setEditQuestions] = useState<QuizQuestion[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditTitle(quiz.title);
    setEditDueDate(quiz.due_at ? new Date(quiz.due_at).toISOString().slice(0, 16) : "");
  }, [quiz.id, quiz.title, quiz.due_at]);

  useEffect(() => {
    setEditQuestions(JSON.parse(JSON.stringify(quiz.questions ?? [])));
  }, [quiz.id, quiz.questions]);

  const handleTogglePublished = async () => {
    setSaving(true);
    if (fromJsonOnly) {
      const { error } = await supabase.from("quizzes").insert({
        course_id: courseId,
        identifier: quiz.identifier,
        title: editTitle.trim() || quiz.title,
        due_at: editDueDate || quiz.due_at,
        module_title: quiz.module_title,
        published: true,
        questions: quiz.questions ?? [],
      });
      if (!error) {
        onClose();
        router.refresh();
      }
    } else {
      await supabase
        .from("quizzes")
        .update({ published: !quiz.published, updated_at: new Date().toISOString() })
        .eq("id", quiz.id);
      router.refresh();
    }
    setSaving(false);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    if (fromJsonOnly) {
      const { error } = await supabase.from("quizzes").insert({
        course_id: courseId,
        identifier: quiz.identifier,
        title: editTitle.trim(),
        due_at: editDueDate || null,
        module_title: quiz.module_title,
        published: false,
        questions: quiz.questions ?? [],
      });
      if (!error) {
        onClose();
        router.refresh();
      }
    } else {
      await supabase
        .from("quizzes")
        .update({
          title: editTitle.trim(),
          due_at: editDueDate || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", quiz.id);
      setEditing(false);
      router.refresh();
    }
    setSaving(false);
  };

  const handleSaveQuestions = async () => {
    setSaving(true);
    if (fromJsonOnly) {
      const { error } = await supabase.from("quizzes").insert({
        course_id: courseId,
        identifier: quiz.identifier,
        title: quiz.title,
        due_at: quiz.due_at,
        module_title: quiz.module_title,
        published: false,
        questions: editQuestions,
      });
      if (!error) {
        onClose();
        router.refresh();
      }
    } else {
      const { error } = await supabase
        .from("quizzes")
        .update({
          questions: editQuestions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", quiz.id);
      if (!error) {
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
      next[qIdx].choices = choices.filter((_, i) => i !== cIdx);
      if (next[qIdx].correct_response_ident === removedIdent) {
        next[qIdx].correct_response_ident = next[qIdx].choices[0]?.ident ?? "";
      }
      return next;
    });
  };

  const insertImageIntoQuestion = (qIdx: number, url: string, fileName: string) => {
    const img = `<p><img src="${url}" alt="${fileName.replace(/"/g, "&quot;")}" /></p>`;
    setEditQuestions((prev) => {
      const next = [...prev];
      next[qIdx] = {
        ...next[qIdx],
        question_text: (next[qIdx].question_text || "") + img,
      };
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
    <div className="fixed inset-0 z-50 bg-[#12072a] overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-sm text-[#c4a8df] hover:text-white transition-colors flex items-center gap-1.5"
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
                    : "border-[#3d2260] text-[#7a5299] hover:border-[#a888c8] hover:text-[#c4a8df]"
                }`}
                type="button"
              >
                {quiz.published ? "● Published" : "○ Unpublished"}
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              autoFocus
              className="text-2xl font-bold text-white bg-transparent border-b-2 border-teal-primary focus:outline-none pb-1 w-full"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#a888c8] shrink-0">Due:</label>
              <input
                type="datetime-local"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="flex-1 bg-[#12072a] border border-[#3d2260] text-[#ede0f5] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-primary"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setEditTitle(quiz.title);
                  setEditDueDate(quiz.due_at ? new Date(quiz.due_at).toISOString().slice(0, 16) : "");
                }}
                className="text-sm text-[#a888c8] hover:text-[#dac8ee] px-4 py-2"
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
                <h1 className="text-2xl font-bold text-white">{displayTitle}</h1>
                <p className="text-sm text-[#c4a8df] mt-1">
                  Due: {formatDueDate(quiz.due_at)}
                </p>
                {quiz.module_title && (
                  <p className="text-xs text-[#9080b0] mt-1">{quiz.module_title}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-[#9080b0] hover:text-[#dac8ee] transition-colors"
                  type="button"
                >
                  ✎ Edit title &amp; due date
                </button>
                <button
                  onClick={() => setEditingQuestions(true)}
                  className="text-sm text-[#9080b0] hover:text-[#dac8ee] transition-colors"
                  type="button"
                >
                  ✎ Edit questions &amp; answers
                </button>
              </div>
            </div>

            {/* Edit questions mode */}
            {editingQuestions ? (
              <div className="bg-[#1d0f3e] rounded-2xl border border-[#301850] p-6">
                <h2 className="text-sm font-bold text-[#a888c8] uppercase tracking-wide mb-4">
                  Edit questions &amp; answers
                </h2>
                <ul className="space-y-8">
                  {editQuestions.map((q, qIdx) => (
                    <li
                      key={`edit-q-${qIdx}`}
                      className="border-b border-[#301850] pb-8 last:border-0"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <label className="text-xs font-semibold text-[#a888c8] uppercase tracking-wide">
                          Question {qIdx + 1} (HTML)
                        </label>
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIdx)}
                          disabled={editQuestions.length <= 1}
                          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Remove question
                        </button>
                      </div>
                      <textarea
                        value={q.question_text}
                        onChange={(e) =>
                          updateQuestion(qIdx, { question_text: e.target.value })
                        }
                        rows={4}
                        className="w-full bg-[#12072a] border border-[#3d2260] text-[#ede0f5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary font-mono"
                      />
                      <div className="mt-2">
                        <span className="text-xs text-[#9080b0] mr-2">Add image to question:</span>
                        <FileUpload
                          bucket="lms-resources"
                          path={quizStoragePath}
                          accept="image/*"
                          onUpload={(url, fileName) => insertImageIntoQuestion(qIdx, url, fileName)}
                        />
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#a888c8] uppercase tracking-wide">
                            Choices (correct = ✓)
                          </span>
                          <button
                            type="button"
                            onClick={() => addChoice(qIdx)}
                            className="text-xs text-teal-primary hover:text-teal-300"
                          >
                            + Add choice
                          </button>
                        </div>
                        {(q.choices ?? []).map((choice, cIdx) => (
                          <div key={`edit-q-${qIdx}-c-${cIdx}`} className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() => setCorrectChoice(qIdx, choice.ident)}
                              className={`shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center text-xs ${
                                q.correct_response_ident === choice.ident
                                  ? "border-teal-primary bg-teal-primary text-white"
                                  : "border-[#3d2260] text-[#9080b0] hover:border-[#a888c8]"
                              }`}
                              title="Mark as correct answer"
                            >
                              {q.correct_response_ident === choice.ident ? "✓" : ""}
                            </button>
                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                              <textarea
                                value={choice.text}
                                onChange={(e) => updateChoice(qIdx, cIdx, e.target.value)}
                                rows={2}
                                className="w-full bg-[#12072a] border border-[#3d2260] text-[#ede0f5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary font-mono"
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
                            </div>
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="text-sm text-teal-primary hover:text-teal-300 font-medium"
                  >
                    + Add question
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setEditQuestions(JSON.parse(JSON.stringify(quiz.questions ?? [])))
                      }
                      className="text-sm text-[#a888c8] hover:text-[#dac8ee] px-4 py-2"
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
            <div className="bg-[#1d0f3e] rounded-2xl border border-[#301850] p-6">
              <h2 className="text-sm font-bold text-[#a888c8] uppercase tracking-wide mb-4">
                All questions &amp; answers
              </h2>
              {(!quiz.questions || quiz.questions.length === 0) ? (
                <p className="text-sm text-[#9080b0]">No questions in this quiz.</p>
              ) : (
                <ul className="space-y-8">
                  {(quiz.questions ?? []).map((q, i) => {
                    const correctChoice = getCorrectChoice(q);
                    return (
                      <li
                        key={`view-q-${i}`}
                        className="border-b border-[#301850] pb-8 last:border-0 last:pb-0 last:mb-0"
                      >
                        <div className="mb-3">
                          <span className="text-xs font-semibold text-[#a888c8] uppercase tracking-wide">
                            Question {i + 1}
                          </span>
                          <div className="mt-1 text-sm text-[#ede0f5] [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:border [&_img]:border-[#301850]">
                            <HtmlContent html={q.question_text || ""} />
                          </div>
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
                                    : "text-[#c4a8df]"
                                }`}
                              >
                                <span className="shrink-0 mt-0.5">
                                  {isCorrect ? "✓" : "○"}
                                </span>
                                <div className="min-w-0 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:border [&_img]:border-[#301850]">
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
