"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function DeleteCourseButton({ courseId, courseName }: { courseId: string; courseName: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!window.confirm(`Delete "${courseName}"? This will permanently remove all modules, days, and assignments.`)) return;
    setDeleting(true);
    const { error } = await supabase.from("courses").delete().eq("id", courseId);
    if (error) {
      alert(`Failed to delete: ${error.message}`);
      setDeleting(false);
      return;
    }
    router.refresh();
  };

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs text-muted-text hover:text-red-500 transition-colors disabled:opacity-50 shrink-0"
      type="button"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
