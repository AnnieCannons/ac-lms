"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getConductSubmissions } from "@/lib/quiz-actions";

type Student = { id: string; name: string; email?: string | null };

type AttemptRecord = {
  attempt: number;
  started_at: string | null;
  submitted_at: string;
  score_percent: number | null;
};

type Submission = {
  student_id: string;
  score_percent: number | null;
  attempt_count: number | null;
  submitted_at: string | null;
  started_at: string | null;
  attempt_history: AttemptRecord[] | null;
};

type ProgressEntry = {
  student_id: string;
  answers_count: number;
  started_at: string;
  updated_at: string;
};

type Props = {
  quizId: string;
  courseId: string;
  students: Student[];
  initialSubmissions: Submission[];
  initialProgress: ProgressEntry[];
  totalQuestions: number;
};

function formatElapsed(startedAt: string | null | undefined, endedAt?: string | null, now?: Date): string {
  if (!startedAt) return "—"
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : (now ?? new Date()).getTime()
  const totalSec = Math.max(0, Math.floor((end - start) / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`
}

export default function ConductView({ quizId, courseId, students, initialSubmissions, initialProgress, totalQuestions }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions);
  const [progress, setProgress] = useState<ProgressEntry[]>(initialProgress);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const data = await getConductSubmissions(quizId, courseId);
      setSubmissions(data.submissions as Submission[]);
      setProgress(data.progress);
      setLastRefreshed(new Date());
    } catch {
      // silently fail — keep showing existing data
    }
    setRefreshing(false);
  };

  useEffect(() => {
    // Remember this conduct page so the nav can link back to it
    try { localStorage.setItem(`conductingQuiz_${courseId}`, `/instructor/courses/${courseId}/quizzes/${quizId}/conduct`) } catch {}
    intervalRef.current = setInterval(refresh, 5000);
    clockRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (clockRef.current) clearInterval(clockRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  const handleStopModerating = () => {
    try { localStorage.removeItem(`conductingQuiz_${courseId}`) } catch {}
  }

  const submissionMap = new Map(submissions.map((s) => [s.student_id, s]));
  const progressMap = new Map(progress.map((p) => [p.student_id, p]));

  const submittedCount = students.filter((s) => submissionMap.has(s.id)).length;
  const inProgressCount = students.filter((s) => !submissionMap.has(s.id) && progressMap.has(s.id)).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-dark-text">Live</span>
          </div>
          <span className="text-sm text-muted-text">
            {submittedCount} submitted · {inProgressCount} in progress · {students.length - submittedCount - inProgressCount} not started
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-text">
            Updated {lastRefreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="text-xs text-teal-primary hover:opacity-80 disabled:opacity-40"
          >
            {refreshing ? "Refreshing…" : "Refresh now"}
          </button>
          <button
            type="button"
            onClick={handleStopModerating}
            className="text-xs font-medium text-muted-text hover:text-dark-text border border-border px-2.5 py-1 rounded-lg hover:bg-border/20 transition-colors"
            title="Remove the active indicator from the sidebar — you can return to this page anytime"
          >
            Stop Moderating
          </button>
          <Link
            href={`/instructor/courses/${courseId}/quizzes`}
            className="text-xs font-medium text-muted-text hover:text-dark-text border border-border px-2.5 py-1 rounded-lg hover:bg-border/20 transition-colors"
          >
            ← Back to Quizzes
          </Link>
        </div>
      </div>

      {/* Progress bar (submitted only) */}
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-primary rounded-full transition-all duration-500"
          style={{ width: students.length > 0 ? `${(submittedCount / students.length) * 100}%` : "0%" }}
        />
      </div>

      {/* Student table */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-6 py-3 text-xs font-semibold text-muted-text uppercase tracking-wide">Student</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-muted-text uppercase tracking-wide">Status</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-muted-text uppercase tracking-wide">Score</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-muted-text uppercase tracking-wide">Attempts</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-muted-text uppercase tracking-wide">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {students.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-muted-text">
                  No students enrolled.
                </td>
              </tr>
            )}
            {students.map((student) => {
              const sub = submissionMap.get(student.id);
              const prog = progressMap.get(student.id);
              const submitted = !!sub;
              const inProgress = !submitted && !!prog;
              const pct = totalQuestions > 0 && prog ? Math.round((prog.answers_count / totalQuestions) * 100) : 0;

              // Build attempt history display
              const history: AttemptRecord[] = Array.isArray(sub?.attempt_history) ? (sub.attempt_history as AttemptRecord[]) : [];
              // Current attempt is the last one; previous attempts are everything before
              const prevAttempts = history.slice(0, -1);

              return (
                <tr key={student.id} className={submitted || inProgress ? "" : "opacity-50"}>
                  <td className="px-6 py-4">
                    <p className="font-medium text-dark-text">{student.name}</p>
                    {student.email && <p className="text-xs text-muted-text">{student.email}</p>}
                  </td>
                  <td className="px-6 py-4">
                    {submitted ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                        Submitted
                      </span>
                    ) : inProgress ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                          In progress
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-text">{prog!.answers_count}/{totalQuestions}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-text">
                        <span className="w-1.5 h-1.5 rounded-full bg-border shrink-0" />
                        Not started
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-dark-text">
                    {sub?.score_percent != null ? `${Math.round(sub.score_percent)}%` : ""}
                  </td>
                  <td className="px-6 py-4 text-muted-text">
                    {sub?.attempt_count ?? ""}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {submitted ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-dark-text font-medium tabular-nums">
                          Attempt {sub!.attempt_count}: {formatElapsed(sub!.started_at, sub!.submitted_at)}
                        </span>
                        {prevAttempts.map((a) => (
                          <span key={a.attempt} className="text-muted-text tabular-nums">
                            Attempt {a.attempt}: {formatElapsed(a.started_at, a.submitted_at)}
                          </span>
                        ))}
                      </div>
                    ) : inProgress ? (
                      <span className="text-amber-500 font-medium tabular-nums">
                        {formatElapsed(prog!.started_at, null, now)}
                      </span>
                    ) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-text text-right">Auto-refreshes every 5 seconds</p>
    </div>
  );
}
