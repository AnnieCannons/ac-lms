"use client";

import { useState } from "react";
import { toggleStudentChecklistItem } from "@/lib/checklist-actions";

type ChecklistItem = {
  id: string;
  text: string;
  description: string | null;
};

export default function StudentChecklist({
  assignmentId,
  studentId,
  items,
  initialChecked,
}: {
  assignmentId: string;
  studentId: string;
  items: ChecklistItem[];
  initialChecked: Record<string, boolean>;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>(initialChecked);

  const toggle = async (id: string) => {
    const next = !checked[id];
    setChecked(prev => ({ ...prev, [id]: next }));
    const result = await toggleStudentChecklistItem(id, studentId, next);
    if (result?.error) {
      setChecked(prev => ({ ...prev, [id]: !next }));
      console.error('Failed to save checklist item:', result.error);
    }
  };

  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Checklist</p>
        <span className="text-xs text-muted-text">{checkedCount}/{items.length} checked</span>
      </div>

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
                  : "border-gray-400 group-hover:border-teal-primary"
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

      <p className="text-xs text-muted-text mt-4">
        Check off items as you complete them — your instructor will confirm each when grading.
      </p>
    </div>
  );
}
