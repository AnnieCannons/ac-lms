"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SubmissionComment({
  submissionId,
  initialComment,
}: {
  submissionId: string;
  initialComment: string | null;
}) {
  const supabase = createClient();
  const [comment, setComment] = useState(initialComment ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await supabase
      .from("submissions")
      .update({ comment })
      .eq("id", submissionId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-3">
        Instructor Comment
      </p>
      <textarea
        value={comment}
        onChange={(e) => { setComment(e.target.value); setSaved(false); }}
        placeholder="Leave feedback for the student…"
        rows={4}
        className="w-full bg-background border border-border rounded-xl p-3 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
      />
      <div className="flex items-center justify-end gap-3 mt-2">
        {saved && (
          <span className="text-xs text-teal-primary">Saved</span>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="text-sm font-semibold px-4 py-2 rounded-full bg-teal-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
