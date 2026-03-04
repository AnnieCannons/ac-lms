"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Grade = "complete" | "incomplete" | null;

export default function GradeButtons({
  submissionId,
  initialGrade,
  initialGradedAt,
  gradedById,
}: {
  submissionId: string;
  initialGrade: Grade;
  initialGradedAt: string | null;
  gradedById: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [grade, setGrade] = useState<Grade>(initialGrade);
  const [gradedAt, setGradedAt] = useState<string | null>(initialGradedAt);
  const [saving, setSaving] = useState(false);

  const mark = async (value: "complete" | "incomplete") => {
    const newGrade: Grade = grade === value ? null : value;
    const now = newGrade ? new Date().toISOString() : null;
    setSaving(true);
    setGrade(newGrade);
    setGradedAt(now);
    const { error } = await supabase
      .from("submissions")
      .update({
        grade: newGrade,
        status: newGrade ? "graded" : "submitted",
        graded_at: now,
        graded_by: newGrade ? gradedById : null,
      })
      .eq("id", submissionId);
    if (error) {
      console.error("Failed to save grade:", error.message);
      setGrade(grade);
      setGradedAt(initialGradedAt);
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
              ? "bg-teal-primary text-white"
              : "bg-surface border border-border text-muted-text hover:border-teal-primary hover:text-teal-primary"
          }`}
        >
          Complete
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
          Incomplete
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
