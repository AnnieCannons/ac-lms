"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Grade = "complete" | "incomplete" | null;

export default function GradeButtons({
  submissionId,
  initialGrade,
}: {
  submissionId: string;
  initialGrade: Grade;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [grade, setGrade] = useState<Grade>(initialGrade);
  const [saving, setSaving] = useState(false);

  const mark = async (value: "complete" | "incomplete") => {
    const newGrade: Grade = grade === value ? null : value;
    setSaving(true);
    setGrade(newGrade);
    await supabase
      .from("submissions")
      .update({
        grade: newGrade,
        status: newGrade ? "graded" : "submitted",
      })
      .eq("id", submissionId);
    setSaving(false);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
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
  );
}
