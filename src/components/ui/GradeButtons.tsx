"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  /** When set, shows a "Next →" link after grading. No longer auto-navigates. */
  nextUrl?: string | null;
  courseId?: string;
}) {
  const router = useRouter();
  const [grade, setGrade] = useState<Grade>(initialGrade);
  const [gradedAt, setGradedAt] = useState<string | null>(initialGradedAt);
  const [saving, setSaving] = useState(false);
  const [justGraded, setJustGraded] = useState(false);
  const savingRef = useRef(false);

  const mark = async (value: "complete" | "incomplete") => {
    if (savingRef.current) return;
    const newGrade: Grade = grade === value ? null : value;
    const now = newGrade ? new Date().toISOString() : null;
    savingRef.current = true;
    setSaving(true);
    setGrade(newGrade);
    setGradedAt(now);
    const result = await saveGrade(submissionId, newGrade, gradedById, courseId);
    if (result.error) {
      console.error("Failed to save grade:", result.error);
      setGrade(grade);
      setGradedAt(initialGradedAt);
      savingRef.current = false;
      setSaving(false);
      return;
    }
    savingRef.current = false;
    setSaving(false);
    if (newGrade) {
      setJustGraded(true);
    } else {
      setJustGraded(false);
    }
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
        {justGraded && nextUrl && (
          <Link
            href={nextUrl}
            className="text-sm font-semibold px-4 py-2 rounded-full bg-teal-primary text-white hover:bg-teal-primary/90 transition-colors"
          >
            Next →
          </Link>
        )}
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
