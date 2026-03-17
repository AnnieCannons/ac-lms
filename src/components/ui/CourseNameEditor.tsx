"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

export default function CourseNameEditor({
  courseId,
  initialName,
  initialCode,
  currentWeek,
}: {
  courseId: string;
  initialName: string;
  initialCode: string | null;
  currentWeek?: number | null;
}) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode ?? "");
  const [saving, setSaving] = useState(false);
  useUnsavedChanges(editing && (name !== initialName || code !== (initialCode ?? '')));

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await supabase
      .from("courses")
      .update({ name: name.trim(), code: code.trim() || null })
      .eq("id", courseId);
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setName(initialName);
    setCode(initialCode ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2 mb-8">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          className="text-2xl font-bold text-dark-text bg-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-primary w-full max-w-md"
        />
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="Course code (e.g. AC-FE)"
          className="text-sm text-muted-text bg-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-primary w-full max-w-xs"
        />
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="bg-teal-primary text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={handleCancel}
            className="text-sm text-muted-text hover:text-dark-text transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-8 group">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl sm:text-2xl font-bold text-dark-text">{name}</h2>
          {currentWeek && (
            <a href={`#week-${currentWeek}`} className="text-sm font-semibold bg-purple-light text-purple-primary px-3 py-1 rounded-full hover:opacity-80 transition-opacity">
              Week {currentWeek} this week
            </a>
          )}
        </div>
        {code && <p className="text-muted-text text-sm mt-0.5">{code}</p>}
      </div>
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-muted-text hover:text-teal-primary transition-colors mt-1.5 opacity-0 group-hover:opacity-100"
      >
        ✎ Edit
      </button>
    </div>
  );
}
