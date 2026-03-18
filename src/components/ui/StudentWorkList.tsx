"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDueDate } from "@/lib/date-utils";

type SubmissionStatus = "draft" | "submitted" | "graded";
type Grade = "complete" | "incomplete" | null;
type Filter = "all" | "complete" | "needs-revision" | "turned-in" | "not-started";

export type WorkAssignment = {
  id: string;
  title: string;
  due_date: string | null;
  status: SubmissionStatus | null;
  grade: Grade;
  isLate: boolean;
  moduleTitle: string;
  weekNumber: number | null;
  isCurrentWeek: boolean;
  courseId: string;
};

function StatusBadge({ status, grade, isLate }: { status: SubmissionStatus | null; grade: Grade; isLate: boolean }) {
  if (grade === "complete") return <span className="status-complete-btn text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0">Complete ✓</span>;
  if (grade === "incomplete") return <span className="status-revision-btn text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0">Needs Revision</span>;
  if (status === "submitted") return (
    <span className="flex items-center gap-1.5 shrink-0">
      {isLate && <span className="status-late-badge text-xs font-semibold px-2.5 py-1 rounded-full border">Late</span>}
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-light text-teal-primary border border-teal-primary">Turned in</span>
    </span>
  );
  if (status === "draft") return <span className="status-draft-badge text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">Draft</span>;
  if (isLate) return <span className="status-late-badge text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0">Late</span>;
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-background border border-border text-muted-text shrink-0">Not started</span>;
}

function getFilterMatch(a: WorkAssignment, filter: Filter): boolean {
  if (filter === "complete") return a.grade === "complete";
  if (filter === "needs-revision") return a.grade === "incomplete" || (a.isLate && !a.status && !a.grade);
  if (filter === "turned-in") return a.status === "submitted";
  if (filter === "not-started") return !a.status && !a.grade && !a.isLate;
  return true;
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs-revision", label: "Needs Revision" },
  { key: "not-started", label: "Not Started" },
  { key: "turned-in", label: "Turned In" },
  { key: "complete", label: "Complete" },
];

export default function StudentWorkList({
  assignments,
  currentWeek,
}: {
  assignments: WorkAssignment[];
  currentWeek: number | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.key, f.key === "all" ? assignments.length : assignments.filter((a) => getFilterMatch(a, f.key)).length])
  ) as Record<Filter, number>;

  const filtered = assignments.filter((a) => getFilterMatch(a, filter));

  // For "all": group by module. For others: flat list sorted by due date.
  const AssignmentRow = ({ a }: { a: WorkAssignment }) => (
    <Link
      href={`/student/courses/${a.courseId}/assignments/${a.id}`}
      className="flex items-center justify-between bg-surface rounded-xl border border-border px-5 py-4 hover:border-teal-primary transition-colors gap-4"
    >
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-base truncate ${a.isLate && !a.status && !a.grade ? "text-amber-700" : "text-dark-text"}`}>
          {a.title}
        </p>
        {filter === "all" ? (
          a.due_date && (
            <p className={`text-xs mt-0.5 ${a.isLate && !a.status && !a.grade ? "text-amber-600" : "text-muted-text"}`}>
              Due {formatDueDate(a.due_date, { month: "short", day: "numeric" })}
            </p>
          )
        ) : (
          <p className="text-xs mt-0.5 text-muted-text">
            {a.moduleTitle}{a.weekNumber ? ` · Week ${a.weekNumber}` : ""}
            {a.due_date && ` · Due ${formatDueDate(a.due_date, { month: "short", day: "numeric" })}`}
          </p>
        )}
      </div>
      <StatusBadge status={a.status} grade={a.grade} isLate={a.isLate} />
    </Link>
  );

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 border border-border mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              filter === f.key
                ? f.key === "complete"        ? "bg-green-600 text-white border-green-600"
                : f.key === "needs-revision"  ? "bg-red-500 text-white border-red-500"
                : f.key === "turned-in"       ? "bg-teal-primary text-white border-teal-primary"
                : "bg-dark-text text-white border-dark-text"
                : f.key === "complete"        ? "bg-green-50 text-green-700 border-green-600"
                : f.key === "needs-revision"  ? "bg-red-50 text-red-500 border-red-500"
                : f.key === "turned-in"       ? "bg-teal-light text-teal-primary border-teal-primary"
                : "bg-background text-muted-text border-border"
            }`}
          >
            {f.label}
            <span className={`ml-1.5 ${filter === f.key ? "text-white/70" : "text-muted-text"}`}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center">
          <p className="text-muted-text text-sm">No assignments match this filter.</p>
        </div>
      ) : filter === "all" ? (
        // Grouped by module
        <div className="flex flex-col gap-8">
          {Array.from(
            filtered.reduce((map, a) => {
              const key = a.moduleTitle;
              if (!map.has(key)) map.set(key, { weekNumber: a.weekNumber, isCurrentWeek: a.isCurrentWeek, items: [] });
              map.get(key)!.items.push(a);
              return map;
            }, new Map<string, { weekNumber: number | null; isCurrentWeek: boolean; items: WorkAssignment[] }>())
          ).map(([title, { weekNumber, isCurrentWeek, items }]) => (
            <div key={title}>
              <div className={`flex items-center gap-3 mb-3 pb-2 border-b ${isCurrentWeek ? "border-teal-primary" : "border-border"}`}>
                <h3 className="font-semibold text-dark-text">{title}</h3>
                {weekNumber && <span className="text-xs text-muted-text">Week {weekNumber}</span>}
                {isCurrentWeek && (
                  <span className="bg-teal-light text-teal-primary text-xs font-semibold px-2 py-0.5 rounded-full">Current Week</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {items.map((a) => <AssignmentRow key={a.id} a={a} />)}
              </div>
            </div>
          ))}
        </div>
      ) : filter === "needs-revision" ? (
        // Two-section view: Needs Revision (grade incomplete) then Past Due (late + not started)
        <div className="flex flex-col gap-8">
          {(() => {
            const sortByDue = (arr: WorkAssignment[]) =>
              arr.slice().sort((a, b) => {
                if (!a.due_date && !b.due_date) return 0;
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;
                return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
              });
            const revision = sortByDue(filtered.filter(a => a.grade === "incomplete"));
            const pastDue = sortByDue(filtered.filter(a => a.isLate && !a.status && !a.grade));
            return (
              <>
                {revision.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-dark-text mb-3 pb-2 border-b border-border">Needs Revision</h3>
                    <div className="flex flex-col gap-2">
                      {revision.map((a) => <AssignmentRow key={a.id} a={a} />)}
                    </div>
                  </div>
                )}
                {pastDue.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-amber-700 mb-3 pb-2 border-b border-amber-500/30">Past Due</h3>
                    <div className="flex flex-col gap-2">
                      {pastDue.map((a) => <AssignmentRow key={a.id} a={a} />)}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        // Flat list: by due date
        <div className="flex flex-col gap-2">
          {filtered
            .slice()
            .sort((a, b) => {
              if (!a.due_date && !b.due_date) return 0;
              if (!a.due_date) return 1;
              if (!b.due_date) return -1;
              return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
            })
            .map((a) => <AssignmentRow key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );
}
