"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markCompleteNoSubmission } from "@/lib/grade-actions";

type SubmissionStatus = "draft" | "submitted" | "graded";
type SubmissionType = "text" | "link" | "file";

export type StudentRow = {
  id: string;
  name: string;
  submission: {
    id: string;
    status: SubmissionStatus;
    grade: "complete" | "incomplete" | null;
    submission_type: SubmissionType;
    content: string | null;
    submitted_at: string;
  } | null;
  historyCount: number;
  latestSubmittedAt: string | null;
};

type Filter = "all" | "needs-grading" | "graded" | "not-submitted";
type Sort = "name-asc" | "name-desc" | "date-newest" | "date-oldest";

function StatusBadge({ status, grade }: { status: SubmissionStatus | null; grade?: "complete" | "incomplete" | null }) {
  if (grade === "complete") return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-600 shrink-0">Complete</span>
  );
  if (grade === "incomplete") return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-500 border border-red-500 shrink-0">Incomplete</span>
  );
  if (status === "submitted") return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-light text-teal-primary border border-teal-primary shrink-0">Turned in</span>
  );
  if (status === "graded") return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-primary shrink-0">Graded</span>
  );
  if (status === "draft") return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-600 shrink-0">Draft</span>
  );
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-background border border-border text-muted-text shrink-0">Not submitted</span>
  );
}

function SubmissionPreview({ type, content }: { type: SubmissionType; content: string | null }) {
  if (!content) return <span className="text-muted-text italic">No content</span>;
  if (type === "link" || type === "file") return (
    <a href={content} target="_blank" rel="noopener noreferrer" className="text-teal-primary underline break-all line-clamp-1">
      {content}
    </a>
  );
  return <span className="text-dark-text line-clamp-1">{content}</span>;
}

export default function SubmissionsList({
  students,
  courseId,
  assignmentId,
  submissionRequired = true,
  currentUserId,
  initialFilter,
  firstUngradedStudentId,
}: {
  students: StudentRow[];
  courseId: string;
  assignmentId: string;
  submissionRequired?: boolean;
  currentUserId?: string;
  initialFilter?: Filter;
  firstUngradedStudentId?: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(initialFilter ?? "all");
  const [sort, setSort] = useState<Sort>("name-asc");
  // Optimistic grade overrides: studentId -> 'complete' | null
  const [gradeOverrides, setGradeOverrides] = useState<Record<string, 'complete' | null>>({});
  const [pending, startTransition] = useTransition();

  const counts = {
    all: students.length,
    "needs-grading": students.filter(s => s.submission?.status === "submitted").length,
    graded: students.filter(s => s.submission?.status === "graded").length,
    "not-submitted": students.filter(s => !s.submission || s.submission.status === "draft").length,
  };

  const filtered = students.filter(s => {
    if (filter === "needs-grading") return s.submission?.status === "submitted";
    if (filter === "graded") return s.submission?.status === "graded";
    if (filter === "not-submitted") return !s.submission || s.submission.status === "draft";
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name-asc") return a.name.localeCompare(b.name);
    if (sort === "name-desc") return b.name.localeCompare(a.name);
    if (sort === "date-newest") {
      if (!a.latestSubmittedAt && !b.latestSubmittedAt) return 0;
      if (!a.latestSubmittedAt) return 1;
      if (!b.latestSubmittedAt) return -1;
      return new Date(b.latestSubmittedAt).getTime() - new Date(a.latestSubmittedAt).getTime();
    }
    if (sort === "date-oldest") {
      if (!a.latestSubmittedAt && !b.latestSubmittedAt) return 0;
      if (!a.latestSubmittedAt) return 1;
      if (!b.latestSubmittedAt) return -1;
      return new Date(a.latestSubmittedAt).getTime() - new Date(b.latestSubmittedAt).getTime();
    }
    return 0;
  });

  const toggleComplete = (studentId: string, currentGrade: string | null | undefined) => {
    if (!currentUserId) return;
    const newGrade: 'complete' | null = currentGrade === 'complete' ? null : 'complete';
    setGradeOverrides(prev => ({ ...prev, [studentId]: newGrade }));
    startTransition(async () => {
      const result = await markCompleteNoSubmission(assignmentId, studentId, newGrade, currentUserId);
      if (result.error) {
        setGradeOverrides(prev => ({ ...prev, [studentId]: currentGrade === 'complete' ? 'complete' : null }));
      } else {
        router.refresh();
      }
    });
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "needs-grading", label: "Needs Grading" },
    { key: "graded", label: "Graded" },
    { key: "not-submitted", label: "Not Submitted" },
  ];

  return (
    <div>
      {/* Filter + Sort bar */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex gap-1 bg-surface rounded-lg p-1 border border-border">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                filter === f.key
                  ? "bg-teal-primary text-white"
                  : "text-muted-text hover:text-dark-text"
              }`}
            >
              {f.label}
              <span className={`ml-1.5 ${filter === f.key ? "text-white/70" : "text-muted-text"}`}>
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {firstUngradedStudentId && submissionRequired && counts["needs-grading"] > 0 && (
            <Link
              href={`/instructor/courses/${courseId}/assignments/${assignmentId}/submissions/${firstUngradedStudentId}`}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-300 hover:bg-yellow-100 transition-colors shrink-0"
            >
              Grade all ungraded →
            </Link>
          )}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as Sort)}
            className="text-xs bg-surface border border-border rounded-lg px-3 py-1.5 text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary cursor-pointer"
          >
            <option value="name-asc">Name A → Z</option>
            <option value="name-desc">Name Z → A</option>
            <option value="date-newest">Date: Newest first</option>
            <option value="date-oldest">Date: Oldest first</option>
          </select>
        </div>
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-10 text-center">
          <p className="text-muted-text text-sm">No students match this filter.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border border border-border rounded-2xl overflow-hidden">
          {sorted.map(student => {
            const sub = student.submission;
            const canGrade = !submissionRequired || sub?.status === "submitted" || sub?.status === "graded";
            const effectiveGrade = gradeOverrides.hasOwnProperty(student.id)
              ? gradeOverrides[student.id]
              : sub?.grade;
            const isComplete = effectiveGrade === 'complete';

            return (
              <div key={student.id} className="bg-surface px-6 py-4 flex items-center gap-4">
                {/* Student info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-semibold text-dark-text">{student.name}</span>
                    <StatusBadge status={sub?.status ?? null} grade={effectiveGrade ?? sub?.grade} />
                    {student.historyCount > 1 && (
                      <span className="text-xs text-muted-text">{student.historyCount} submissions</span>
                    )}
                  </div>
                  {sub && submissionRequired ? (
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-text shrink-0">
                        {new Date(sub.submitted_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                          hour: "numeric", minute: "2-digit",
                        })}
                      </span>
                      <div className="flex-1 min-w-0">
                        <SubmissionPreview type={sub.submission_type} content={sub.content} />
                      </div>
                    </div>
                  ) : !submissionRequired ? null : (
                    <p className="text-xs text-muted-text italic">No submission yet.</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 shrink-0">
                  {!submissionRequired && currentUserId && (
                    <button
                      onClick={() => toggleComplete(student.id, effectiveGrade)}
                      disabled={pending}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                        isComplete
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-surface text-muted-text border-border hover:border-green-600 hover:text-green-700'
                      }`}
                    >
                      {isComplete ? '✓ Complete' : 'Mark complete'}
                    </button>
                  )}
                  {canGrade && submissionRequired && (
                    <Link
                      href={`/instructor/courses/${courseId}/assignments/${assignmentId}/submissions/${student.id}`}
                      className="text-xs font-semibold text-teal-primary hover:underline"
                    >
                      {sub?.status === "graded" ? "Review →" : "Grade →"}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
