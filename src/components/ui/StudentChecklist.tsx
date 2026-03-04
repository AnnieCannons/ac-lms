"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type ChecklistItem = {
  id: string;
  text: string;
  description: string | null;
};

export default function StudentChecklist({
  assignmentId,
  studentId,
  items,
}: {
  assignmentId: string;
  studentId: string;
  items: ChecklistItem[];
}) {
  const supabase = createClient();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const itemIds = items.map(i => i.id);
    if (!itemIds.length) { setLoading(false); return; }

    supabase
      .from("student_checklist_progress")
      .select("checklist_item_id, checked")
      .eq("student_id", studentId)
      .in("checklist_item_id", itemIds)
      .then(({ data }) => {
        const initial: Record<string, boolean> = {};
        items.forEach(i => { initial[i.id] = false; });
        data?.forEach(row => { initial[row.checklist_item_id] = row.checked; });
        setChecked(initial);
        setLoading(false);
      });
  }, [studentId, assignmentId]);

  const toggle = async (id: string) => {
    const next = !checked[id];
    setChecked(prev => ({ ...prev, [id]: next }));

    await supabase
      .from("student_checklist_progress")
      .upsert(
        { student_id: studentId, checklist_item_id: id, checked: next, updated_at: new Date().toISOString() },
        { onConflict: "student_id,checklist_item_id" }
      );
  };

  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Checklist</p>
        {!loading && (
          <span className="text-xs text-muted-text">{checkedCount}/{items.length} checked</span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-text">Loading…</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map(item => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className="flex items-start gap-3 w-full text-left group"
              >
                <span className={`w-4 h-4 mt-0.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                  checked[item.id]
                    ? "bg-teal-primary border-teal-primary"
                    : "border-border group-hover:border-teal-primary"
                }`}>
                  {checked[item.id] && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <div>
                  <p className={`text-sm transition-colors ${checked[item.id] ? "text-muted-text line-through" : "text-dark-text"}`}>
                    {item.text}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-text mt-0.5">{item.description}</p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-text mt-4">
        Check off items as you complete them — your instructor will confirm each when grading.
      </p>
    </div>
  );
}
