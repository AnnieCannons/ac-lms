"use client";

import { useEffect, useRef } from "react";
import { submitQuiz, type AnswerEntry } from "./actions";
import HtmlContent from "@/components/ui/HtmlContent";
import dynamic from "next/dynamic";

const CodeEditor = dynamic(() => import("@/components/ui/CodeEditor"), { ssr: false });
const HighlightedContent = dynamic(
  () => import("@/components/ui/HighlightedContent"),
  { ssr: false }
);

type Question = {
  ident: string;
  question_text: string;
  choices: Array<{ ident: string; text: string }>;
  question_type?: "multiple_choice" | "true_false";
  code_snippet?: string;
  code_language?: string;
};

function postProgress(quizId: string, answers: AnswerEntry[]) {
  fetch("/api/quiz-progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quizId, answers }),
  }).catch(() => {});
}

export default function QuizForm({
  courseId,
  quizId,
  questions,
  previousAnswers,
  savedProgress,
  lockedAnswers,
  isObserver,
}: {
  courseId: string;
  quizId: string;
  questions: Question[];
  previousAnswers: AnswerEntry[];
  savedProgress?: Record<string, string>; // index → choice_ident (restore in-progress)
  lockedAnswers?: Record<string, string>;  // index → choice_ident (already correct in retake)
  isObserver?: boolean;
}) {
  // Track answers by question index — no state, no re-renders
  const answersRef = useRef<Record<string, string>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const m: Record<string, string> = savedProgress ? { ...savedProgress } : {};
    answersRef.current = m;
    const answers: AnswerEntry[] = Object.entries(m).map(([idx, ci]) => ({
      question_index: parseInt(idx),
      choice_ident: ci,
    }));
    postProgress(quizId, answers);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  const handleChange = (idx: string, choice_ident: string) => {
    answersRef.current = { ...answersRef.current, [idx]: choice_ident };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const answers: AnswerEntry[] = Object.entries(answersRef.current).map(
        ([i, ci]) => ({ question_index: parseInt(i), choice_ident: ci })
      );
      postProgress(quizId, answers);
    }, 800);
  };

  const isRetake = lockedAnswers !== undefined;

  if (isObserver) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800">
          Quiz submissions are paused while you&apos;re on leave.
        </div>
        {questions.map((q, i) => (
          <fieldset
            key={i}
            className="bg-surface rounded-xl border border-border/50 p-5 opacity-60"
          >
            <legend className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">
              Question {i + 1}
            </legend>
            <div className="quiz-html text-sm text-dark-text mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-bold [&_em]:italic [&_pre]:my-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:bg-[#1e1e2e] [&_pre]:border [&_pre]:border-[#313244] [&_pre]:p-4 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded">
              <HtmlContent html={q.question_text || ""} />
            </div>
            {q.code_snippet && (
              <div className="mb-4">
                <CodeEditor
                  value={q.code_snippet}
                  language={(q.code_language as "javascript" | "jsx" | "html" | "css" | "sql") ?? "javascript"}
                  editable={false}
                />
              </div>
            )}
            <ul className="space-y-1.5">
              {(q.choices ?? []).map((choice) => (
                <li key={choice.ident}>
                  <div className="flex items-start gap-3 rounded-lg border border-border/30 px-4 py-2.5">
                    <div className="mt-1 shrink-0 w-3.5 h-3.5 rounded-full border-2 border-border/30" />
                    <div className="quiz-html text-sm text-muted-text [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded">
                      <HtmlContent html={choice.text || ""} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
      </div>
    );
  }

  return (
    <form action={(fd) => { void submitQuiz(fd) }} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="quizId" value={quizId} />
      <input
        type="hidden"
        name="previousAnswers"
        value={JSON.stringify(previousAnswers)}
      />
      {questions.map((q, i) => {
        const lockedChoice = lockedAnswers?.[String(i)];
        const isLocked = lockedChoice !== undefined;

        if (isLocked) {
          // Correct question — read-only display, dimmed
          return (
            <fieldset
              key={i}
              className="bg-surface rounded-xl border border-green-500/25 p-5 opacity-55"
            >
              <legend className="text-sm font-semibold text-green-500 uppercase tracking-wide mb-3">
                Question {i + 1} &nbsp;✓
              </legend>
              <div className="quiz-html text-sm text-dark-text mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-bold [&_em]:italic [&_pre]:my-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:bg-[#1e1e2e] [&_pre]:border [&_pre]:border-[#313244] [&_pre]:p-4 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded">
                <HtmlContent html={q.question_text || ""} />
              </div>
              {q.code_snippet && (
                <div className="mb-4">
                  <CodeEditor
                    value={q.code_snippet}
                    language={(q.code_language as "javascript" | "jsx" | "html" | "css" | "sql") ?? "javascript"}
                    editable={false}
                  />
                </div>
              )}
              <ul className="space-y-1.5">
                {(q.choices ?? []).map((choice) => (
                  <li key={choice.ident}>
                    <div
                      className={`flex items-start gap-3 rounded-lg border px-4 py-2.5 ${
                        choice.ident === lockedChoice
                          ? "border-green-500/40 bg-green-500/10"
                          : "border-border/30"
                      }`}
                    >
                      <div className={`mt-1 shrink-0 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                        choice.ident === lockedChoice ? "border-green-500" : "border-border/30"
                      }`}>
                        {choice.ident === lockedChoice && (
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        )}
                      </div>
                      <div className={`quiz-html text-sm [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded ${
                        choice.ident === lockedChoice ? "text-green-400" : "text-muted-text"
                      }`}>
                        <HtmlContent html={choice.text || ""} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        }

        // Active question — editable
        return (
          <fieldset
            key={i}
            className={`bg-surface rounded-xl border p-6 ${
              isRetake ? "border-orange-500/50" : "border-border"
            }`}
          >
            <legend className={`text-sm font-semibold uppercase tracking-wide mb-3 ${
              isRetake ? "text-orange-400" : "text-muted-text"
            }`}>
              Question {i + 1}
            </legend>
            <HighlightedContent
              html={q.question_text || ""}
              className="quiz-html text-sm text-dark-text mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_li_p]:inline [&_strong]:font-bold [&_em]:italic [&_pre]:my-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:bg-[#1e1e2e] [&_pre]:border [&_pre]:border-[#313244] [&_pre]:p-4 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded"
            />
            {q.code_snippet && (
              <div className="mb-4">
                <CodeEditor
                  value={q.code_snippet}
                  language={(q.code_language as "javascript" | "jsx" | "html" | "css" | "sql") ?? "javascript"}
                  editable={false}
                />
              </div>
            )}
            <ul className="space-y-2">
              {(q.choices ?? []).map((choice) => (
                <li key={choice.ident}>
                  <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border hover:border-teal-primary/50 px-4 py-3 transition-colors has-[:checked]:border-teal-primary has-[:checked]:bg-teal-light/20">
                    <input
                      type="radio"
                      name={`answer_${i}`}
                      value={choice.ident}
                      defaultChecked={savedProgress?.[String(i)] === choice.ident}
                      onChange={() => handleChange(String(i), choice.ident)}
                      required
                      className="mt-1 shrink-0"
                    />
                    <div className="quiz-html text-sm text-dark-text [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:bg-[#1e1e2e] [&_pre]:border [&_pre]:border-[#313244] [&_pre]:p-3">
                      <HtmlContent html={choice.text || ""} />
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          className="px-6 py-3 rounded-full bg-teal-primary text-white font-semibold hover:opacity-90 transition-opacity"
        >
          Submit quiz
        </button>
      </div>
    </form>
  );
}
