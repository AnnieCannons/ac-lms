/**
 * Quiz data from course JSON exports. Used to show quizzes in the instructor view.
 */

export type QuizChoice = {
  ident: string;
  text: string;
};

export type CodeLanguage = 'javascript' | 'jsx' | 'html' | 'css' | 'sql';

export type QuizQuestion = {
  ident: string;
  question_text: string;
  choices: QuizChoice[];
  correct_response_ident: string;
  question_type?: 'multiple_choice' | 'true_false';
  code_snippet?: string;
  code_language?: CodeLanguage;
};

export type QuizAssessment = {
  identifier: string;
  type: string;
  title: string;
  due_at: string;
  quiz_type: string;
  module_title: string;
  manifest_title: string;
  questions: QuizQuestion[];
};

export type QuizCourseData = {
  course: { title: string; source?: string };
  assessments: QuizAssessment[];
};

/** Quiz row as stored in DB (quizzes table) */
export type QuizRow = {
  id: string;
  course_id: string;
  identifier: string;
  title: string;
  due_at: string | null;
  module_title: string;
  published: boolean;
  questions: QuizQuestion[];
  max_attempts: number | null;
  day_title?: string | null;
  created_at?: string;
  updated_at?: string;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Strip HTML tags from quiz question text for display */
export function getQuizQuestionPreview(question: QuizQuestion, maxLength = 80): string {
  const text = stripHtml(question.question_text);
  return text.length > maxLength ? text.slice(0, maxLength) + "…" : text;
}

/** Get quiz data for a course by matching name/code to known data files */
export function getQuizzesForCourse(course: { name?: string | null; code?: string | null }): QuizAssessment[] {
  const name = (course.name ?? "").toLowerCase();
  const code = (course.code ?? "").toLowerCase();
  const combined = ` ${name} ${code} `;

  let data: QuizCourseData | null = null;

  // Match TCF (e.g. "TCF", "TCF (Jan 2026)")
  if (combined.includes("tcf")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    data = require("./tcf/tcf-quizzes.json") as QuizCourseData;
  } else if (
    combined.includes("frontend") ||
    combined.includes("front end") ||
    combined.includes("front-end")
  ) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    data = require("./frontend/advanced-frontend-quizzes.json") as QuizCourseData;
  } else if (combined.includes("backend") || combined.includes("back end") || combined.includes("back-end")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    data = require("./backend/advanced-backend-quizzes.json") as QuizCourseData;
  }

  if (!data?.assessments) return [];
  return data.assessments.filter((a) => a.type === "quiz");
}
