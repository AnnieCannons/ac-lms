"use client";

import { useState } from "react";
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
  const [selectedQuiz, setSelectedQuiz] = useState<QuizRow | null>(null);
  const list = Array.isArray(quizzes) ? quizzes : [];

  if (list.length === 0) {
    return (
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-dark-text mb-3">Quizzes</h2>
        <div className="bg-surface rounded-2xl border border-border p-6 text-center">
          <p className="text-sm text-muted-text">No quizzes for this course in the data folder.</p>
        </div>
      </section>
    );
  }

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
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-dark-text mb-3">Quizzes</h2>
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
                          <p className="text-sm font-medium text-dark-text group-hover:text-teal-primary transition-colors">
                            {displayTitle}
                          </p>
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
      </section>
    </>
  );
}
