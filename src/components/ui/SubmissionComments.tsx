"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type CommentEntry = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author_name: string;
  author_role: string;
};

export default function SubmissionComments({
  submissionId,
  initialComments,
  currentUserId,
  currentUserName,
  currentUserRole,
  isObserver,
}: {
  submissionId: string;
  initialComments: CommentEntry[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  isObserver?: boolean;
}) {
  const supabase = createClient();
  const [comments, setComments] = useState<CommentEntry[]>(initialComments);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    const { data } = await supabase
      .from("submission_comments")
      .insert({
        submission_id: submissionId,
        author_id: currentUserId,
        content: text.trim(),
      })
      .select("id, created_at")
      .single();

    if (data) {
      setComments((prev) => [
        ...prev,
        {
          id: data.id,
          content: text.trim(),
          created_at: data.created_at,
          author_id: currentUserId,
          author_name: currentUserName,
          author_role: currentUserRole,
        },
      ]);
    }
    setText("");
    setSending(false);
  };

  const isInstructor = (role: string) =>
    role === "instructor" || role === "admin";

  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-4">
        Comments
      </p>

      {comments.length > 0 && (
        <div className="flex flex-col gap-4 mb-4">
          {comments.map((c) => (
            <div key={c.id} className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-xs font-semibold ${
                    isInstructor(c.author_role)
                      ? "text-teal-primary"
                      : "text-dark-text"
                  }`}
                >
                  {c.author_name}
                </span>
                {isInstructor(c.author_role) && (
                  <span className="text-xs text-teal-primary opacity-70">Staff</span>
                )}
                <span className="text-xs text-muted-text">
                  {new Date(c.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-sm text-dark-text whitespace-pre-wrap leading-relaxed">
                {c.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {!isObserver && (
        <div className={comments.length > 0 ? "border-t border-border pt-4" : ""}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
            placeholder="Add a comment… (⌘↵ to send)"
            rows={3}
            className="w-full bg-background border border-border rounded-xl p-3 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              className="text-sm font-semibold px-4 py-2 rounded-full bg-teal-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
