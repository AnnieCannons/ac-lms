import { submitQuiz } from "./actions";
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

type AnswerInput = { question_ident: string; choice_ident: string };

export default function QuizForm({
  courseId,
  quizId,
  questions,
  previousAnswers,
}: {
  courseId: string;
  quizId: string;
  questions: Question[];
  previousAnswers: AnswerInput[];
}) {
  return (
    <form action={submitQuiz} className="space-y-8">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="quizId" value={quizId} />
      <input
        type="hidden"
        name="previousAnswers"
        value={JSON.stringify(previousAnswers)}
      />
      {questions.map((q, i) => (
        <fieldset
          key={q.ident}
          className="bg-surface rounded-xl border border-border p-6"
        >
          <legend className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">
            Question {i + 1}
          </legend>
          <HighlightedContent
            html={q.question_text || ""}
            className="text-sm text-dark-text mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_li_p]:inline [&_strong]:font-bold [&_em]:italic [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:bg-border/30 [&_code:not(pre_code)]:px-1 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:text-xs [&_pre]:my-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded"
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
                    name={`answer_${q.ident}`}
                    value={choice.ident}
                    required
                    className="mt-1 shrink-0"
                  />
                  <span className="text-sm text-dark-text [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded">
                    <HtmlContent html={choice.text || ""} />
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
      <div className="flex justify-end">
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
