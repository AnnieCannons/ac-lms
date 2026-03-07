"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";

type Stats = {
  modules: number;
  days: number;
  assignments: number;
  resources: number;
  checklistItems: number;
  datesShifted: boolean;
};

function deriveCode(code: string | null): string {
  if (!code) return "";
  const match = code.match(/^(.*)-(\d+)$/);
  return match ? `${match[1]}-${parseInt(match[2]) + 1}` : `${code}-2`;
}

export default function DuplicateCourseButton({
  courseId,
  courseName,
  courseCode,
  courseStartDate,
}: {
  courseId: string;
  courseName: string;
  courseCode: string | null;
  courseStartDate: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sourceStart, setSourceStart] = useState("");
  const [startDate, setStartDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const handleOpen = () => {
    setName(`Copy of ${courseName}`);
    setCode(deriveCode(courseCode));
    setSourceStart(courseStartDate ?? "");
    setStartDate("");
    setError(null);
    setStats(null);
    setOpen(true);
  };

  const handleClose = () => {
    if (!submitting) setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/courses/duplicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceCourseId: courseId,
        newName: name.trim(),
        newCode: code.trim(),
        sourceStartDate: sourceStart || null,
        newStartDate: startDate || null,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }

    setStats(json.stats);
    setSubmitting(false);
    setTimeout(() => {
      router.push(`/instructor/courses/${json.newCourseId}`);
    }, 1800);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs text-muted-text hover:text-teal-primary transition-colors shrink-0"
      >
        Duplicate
      </button>

      {open && (
        <Modal title="Duplicate Course" onClose={handleClose} maxWidth="max-w-md">
          {stats ? (
            <div className="flex flex-col gap-3 text-center py-4">
              <div className="text-4xl">✓</div>
              <h3 className="text-lg font-bold text-dark-text">Course duplicated!</h3>
              <p className="text-sm text-muted-text">
                {stats.modules} modules · {stats.days} days · {stats.assignments} assignments
                <br />
                {stats.checklistItems} checklist items · {stats.resources} resources
              </p>
              {stats.datesShifted && (
                <p className="text-xs text-teal-primary font-medium">
                  Due dates shifted to match new start date.
                </p>
              )}
              <p className="text-sm text-muted-text mt-2">Redirecting to new course…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">Course Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary bg-background"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">Course Code</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary bg-background"
                />
              </div>

              <div className="flex flex-col gap-4 bg-background rounded-xl border border-border p-4">
                <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Date Shifting <span className="normal-case font-normal">(optional)</span></p>
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">
                    Original Start Date
                  </label>
                  <input
                    type="date"
                    value={sourceStart}
                    onChange={e => setSourceStart(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary bg-surface"
                  />
                  <p className="text-xs text-muted-text mt-1">When did the original course start?</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">
                    New Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary bg-surface"
                  />
                  <p className="text-xs text-muted-text mt-1">
                    Due dates will shift by the difference between the two dates.
                  </p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="text-sm text-muted-text hover:text-dark-text transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim() || !code.trim()}
                  className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {submitting ? "Duplicating…" : "Duplicate Course →"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
