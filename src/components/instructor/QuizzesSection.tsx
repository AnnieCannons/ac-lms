"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { QuizRow } from "@/data/quizzes";
import QuizFullView from "./QuizFullView";

type QuizzesSectionProps = {
  courseId: string;
  quizzes: QuizRow[];
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

export default function QuizzesSection({ courseId, quizzes = [] }: QuizzesSectionProps) {
  const router = useRouter();
  const supabase = createClient();
  const [selectedQuiz, setSelectedQuiz] = useState<QuizRow | null>(null);
  const [creating, setCreating] = useState(false);
  const list = Array.isArray(quizzes) ? quizzes : [];

  const handleNewQuiz = async () => {
    setCreating(true);
    const identifier = `new-quiz-${Date.now()}`;
    const { data, error } = await supabase
      .from("quizzes")
      .insert({
        course_id: courseId,
        identifier,
        title: "New Quiz",
        due_at: null,
        module_title: "",
        published: false,
        questions: [],
        max_attempts: null,
      })
      .select("*")
      .single();
    setCreating(false);
    if (!error && data) {
      setSelectedQuiz(data as QuizRow);
      router.refresh();
    }
  };

  const byModule = list.reduce<Record<string, QuizRow[]>>((acc, q) => {
    const key = q.module_title || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {});

  const moduleTitles = Object.keys(byModule).sort();

  return (
    <>
      {selectedQuiz && (
        <QuizFullView
          quiz={selectedQuiz}
          courseId={courseId}
          onClose={() => setSelectedQuiz(null)}
        />
      )}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-dark-text">Quizzes</h2>
          <button
            type="button"
            onClick={handleNewQuiz}
            disabled={creating}
            className="text-sm font-semibold px-4 py-2 rounded-full bg-teal-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {creating ? "Creating…" : "+ New Quiz"}
          </button>
        </div>

        {list.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-6 text-center">
            <p className="text-sm text-muted-text">No quizzes for this course yet.</p>
            <p className="text-xs text-muted-text mt-1">Click &ldquo;+ New Quiz&rdquo; to create one.</p>
          </div>
        ) : (
          <>
            {list.some((q) => q.id.startsWith("json-")) && (
              <p className="text-xs text-muted-text mb-3">
                Loaded from course data. To save edits and control visibility, run the{" "}
                <code className="bg-background px-1 rounded">quizzes</code> table migration in Supabase.
              </p>
            )}
            <div className="flex flex-col gap-4">
              {moduleTitles.map((moduleTitle) => (
                <div
                  key={moduleTitle}
                  className="bg-surface rounded-2xl border border-border overflow-hidden"
                >
                  <div className="px-6 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-dark-text">{moduleTitle}</h3>
                  </div>
                  <ul className="divide-y divide-border">
                    {byModule[moduleTitle]?.map((quiz) => {
                      const displayTitle =
                        quiz.title.startsWith("Quiz: ") ? quiz.title.slice(6) : quiz.title;
                      const hasSnippet = (quiz.questions ?? []).some((q) => q.code_snippet);
                      return (
                        <li key={quiz.id} className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedQuiz(quiz)}
                            className="w-full text-left flex items-center gap-3 group"
                          >
                            <span
                              className={`text-xs shrink-0 font-medium ${
                                quiz.published
                                  ? "text-teal-primary"
                                  : "text-muted-text"
                              }`}
                              title={quiz.published ? "Published" : "Unpublished"}
                            >
                              {quiz.published ? "●" : "○"}
                            </span>
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
                            <span className="text-xs text-teal-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              View / Edit →
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
