"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveGrade } from "@/lib/grade-actions";

type Grade = "complete" | "incomplete" | null;

export default function GradeButtons({
  submissionId,
  initialGrade,
  initialGradedAt,
  gradedById,
  nextUrl,
  courseId,
}: {
  submissionId: string;
  initialGrade: Grade;
  initialGradedAt: string | null;
  gradedById: string;
  /** When set, navigates here after the first grade is saved (null→complete or null→incomplete). */
  nextUrl?: string | null;
  courseId?: string;
}) {
  const router = useRouter();
  const [grade, setGrade] = useState<Grade>(initialGrade);
  const [gradedAt, setGradedAt] = useState<string | null>(initialGradedAt);
  const [saving, setSaving] = useState(false);

  const mark = async (value: "complete" | "incomplete") => {
    const newGrade: Grade = grade === value ? null : value;
    const now = newGrade ? new Date().toISOString() : null;
    const wasUngraded = grade === null;
    setSaving(true);
    setGrade(newGrade);
    setGradedAt(now);
    const result = await saveGrade(submissionId, newGrade, gradedById, courseId);
    if (result.error) {
      console.error("Failed to save grade:", result.error);
      setGrade(grade);
      setGradedAt(initialGradedAt);
      setSaving(false);
      return;
    }
    setSaving(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col items-end gap-2 shrink-0">
      <div className="flex items-center gap-2">
        <button
          onClick={() => mark("complete")}
          disabled={saving}
          className={`text-sm font-semibold px-4 py-2 rounded-full transition-all disabled:opacity-50 ${
            grade === "complete"
              ? "bg-green-600 text-white"
              : "bg-surface border border-border text-muted-text hover:border-green-600 hover:text-green-700"
          }`}
        >
          {saving && grade === null ? "Saving…" : "Complete"}
        </button>
        <button
          onClick={() => mark("incomplete")}
          disabled={saving}
          className={`text-sm font-semibold px-4 py-2 rounded-full transition-all disabled:opacity-50 ${
            grade === "incomplete"
              ? "bg-red-500 text-white"
              : "bg-surface border border-border text-muted-text hover:border-red-400 hover:text-red-500"
          }`}
        >
          {saving && grade === null ? "…" : "Incomplete"}
        </button>
      </div>
      {grade && gradedAt && (
        <p className="text-xs text-muted-text">
          Graded{" "}
          {new Date(gradedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
