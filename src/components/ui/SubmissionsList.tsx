"use client";

import { useState } from "react";
import Link from "next/link";

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
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-light text-teal-primary shrink-0">Complete</span>
  );
  if (grade === "incomplete") return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-500 shrink-0">Incomplete</span>
  );
  if (status === "submitted") return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-light text-teal-primary shrink-0">Turned in</span>
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
}: {
  students: StudentRow[];
  courseId: string;
  assignmentId: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("name-asc");

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

      {/* List */}
      {sorted.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-10 text-center">
          <p className="text-muted-text text-sm">No students match this filter.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border border border-border rounded-2xl overflow-hidden">
          {sorted.map(student => {
            const sub = student.submission;
            const canGrade = sub?.status === "submitted" || sub?.status === "graded";

            return (
              <div key={student.id} className="bg-surface px-6 py-4 flex items-center gap-4">
                {/* Student info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-semibold text-dark-text">{student.name}</span>
                    <StatusBadge status={sub?.status ?? null} grade={sub?.grade} />
                    {student.historyCount > 1 && (
                      <span className="text-xs text-muted-text">{student.historyCount} submissions</span>
                    )}
                  </div>
                  {sub ? (
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
                  ) : (
                    <p className="text-xs text-muted-text italic">No submission yet.</p>
                  )}
                </div>

                {/* Grade link */}
                {canGrade && (
                  <Link
                    href={`/instructor/courses/${courseId}/assignments/${assignmentId}/submissions/${student.id}`}
                    className="shrink-0 text-xs font-semibold text-teal-primary hover:underline"
                  >
                    {sub?.status === "graded" ? "Review →" : "Grade →"}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
