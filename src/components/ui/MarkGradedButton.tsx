"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function MarkGradedButton({
  submissionId,
  isGraded,
}: {
  submissionId: string;
  isGraded: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    setSaving(true);
    await supabase
      .from("submissions")
      .update({ status: isGraded ? "submitted" : "graded" })
      .eq("id", submissionId);
    setSaving(false);
    router.refresh();
  };

  if (isGraded) {
    return (
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-purple-100 text-purple-primary">
          Graded ✓
        </span>
        <button
          onClick={toggle}
          disabled={saving}
          className="text-xs text-muted-text hover:text-dark-text transition-colors disabled:opacity-50"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className="shrink-0 bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
    >
      {saving ? "Saving…" : "Mark as Graded"}
    </button>
  );
}
