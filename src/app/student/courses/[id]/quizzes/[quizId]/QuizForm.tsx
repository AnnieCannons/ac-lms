import { submitQuiz } from "./actions";
import HtmlContent from "@/components/ui/HtmlContent";

type Question = {
  ident: string;
  question_text: string;
  choices: Array<{ ident: string; text: string }>;
};

export default function QuizForm({
  courseId,
  quizId,
  questions,
}: {
  courseId: string;
  quizId: string;
  questions: Question[];
}) {
  return (
    <form action={submitQuiz} className="space-y-8">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="quizId" value={quizId} />
      {questions.map((q, i) => (
        <fieldset
          key={q.ident}
          className="bg-surface rounded-xl border border-border p-6"
        >
          <legend className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">
            Question {i + 1}
          </legend>
          <div className="text-sm text-dark-text mb-4 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded">
            <HtmlContent html={q.question_text || ""} />
          </div>
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
