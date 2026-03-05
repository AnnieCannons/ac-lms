"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Item = {
  id: string;
  text: string;
  description: string | null;
};

type Response = {
  checklist_item_id: string;
  checked: boolean;
};

export default function InstructorChecklist({
  items,
  initialResponses,
  submissionId,
  gradedById,
  studentCheckedIds,
}: {
  items: Item[];
  initialResponses: Response[];
  submissionId: string;
  gradedById: string;
  studentCheckedIds: Set<string>;
}) {
  const supabase = createClient();
  const [responseMap, setResponseMap] = useState<Map<string, boolean>>(
    new Map(initialResponses.map((r) => [r.checklist_item_id, r.checked]))
  );
  const [saving, setSaving] = useState<string | null>(null);

  const toggle = async (itemId: string) => {
    const newValue = !(responseMap.get(itemId) ?? false);
    setSaving(itemId);
    setResponseMap((prev) => new Map(prev).set(itemId, newValue));

    await supabase.from("checklist_responses").upsert(
      {
        submission_id: submissionId,
        checklist_item_id: itemId,
        checked: newValue,
        graded_by: gradedById,
      },
      { onConflict: "submission_id,checklist_item_id" }
    );

    setSaving(null);
  };

  const checkedCount = [...responseMap.values()].filter(Boolean).length;

  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
          Checklist
        </p>
        <span className="text-xs text-muted-text">
          {checkedCount}/{items.length} checked
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const checked = responseMap.get(item.id) ?? false;
          const studentChecked = studentCheckedIds.has(item.id);
          return (
            <li key={item.id}>
              <button
                onClick={() => toggle(item.id)}
                disabled={saving === item.id}
                className="flex items-start gap-3 w-full text-left disabled:opacity-60 group"
              >
                <span
                  className={`w-4 h-4 mt-0.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                    checked
                      ? "bg-teal-primary border-teal-primary"
                      : "border-gray-400 group-hover:border-teal-primary"
                  }`}
                >
                  {checked && (
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      viewBox="0 0 10 8"
                      fill="none"
                    >
                      <path
                        d="M1 4l3 3 5-6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm ${
                        checked ? "text-muted-text line-through" : "text-dark-text"
                      }`}
                    >
                      {item.text}
                    </p>
                    {studentChecked && (
                      <span className="text-xs text-teal-primary shrink-0">
                        ✓ student
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-text mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
