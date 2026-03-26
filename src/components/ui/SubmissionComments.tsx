"use client";

import { useState } from "react";
import { addSubmissionComment, editSubmissionComment, deleteSubmissionComment } from "@/lib/grade-actions";
import RichTextEditor from "@/components/ui/RichTextEditor";
import MarkdownContent from "@/components/ui/MarkdownContent";

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
  isTa,
  courseId,
  text: externalText,
  onTextChange,
}: {
  submissionId: string | null;
  initialComments: CommentEntry[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  isObserver?: boolean;
  isTa?: boolean;
  courseId?: string;
  text?: string;
  onTextChange?: (t: string) => void;
}) {
  const [comments, setComments] = useState<CommentEntry[]>(initialComments);
  const [localText, setLocalText] = useState('');
  const text = externalText !== undefined ? externalText : localText;
  const setText = (t: string) => { onTextChange ? onTextChange(t) : setLocalText(t); };
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  const isStudent = currentUserRole === 'student' && !isTa;

  const send = async () => {
    if (!text.trim() || !submissionId) return;
    setSending(true);
    setSendError(null);
    const result = await addSubmissionComment(submissionId, text.trim(), courseId);
    if ('error' in result) {
      setSendError(result.error);
    } else {
      setComments((prev) => [
        ...prev,
        {
          id: result.id,
          content: text.trim(),
          created_at: result.created_at,
          author_id: currentUserId,
          author_name: currentUserName,
          author_role: currentUserRole,
        },
      ]);
      setText("");
      if (!isStudent) setEditorKey(k => k + 1);
    }
    setSending(false);
  };

  const startEdit = (c: CommentEntry) => {
    setEditingId(c.id);
    setEditText(c.content);
    setEditError(null);
  };

  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    setEditSaving(true);
    setEditError(null);
    const result = await editSubmissionComment(id, editText.trim());
    if ('error' in result) {
      setEditError(result.error ?? 'Failed to save');
    } else {
      setComments(prev => prev.map(c => c.id === id ? { ...c, content: editText.trim() } : c));
      setEditingId(null);
    }
    setEditSaving(false);
  };

  const confirmDelete = async (id: string) => {
    setDeleteError(null);
    const result = await deleteSubmissionComment(id);
    if ('error' in result) {
      setDeleteError(result.error ?? 'Failed to delete');
      setDeletingId(null);
    } else {
      setComments(prev => prev.filter(c => c.id !== id));
      setDeletingId(null);
    }
  };

  const isInstructor = (role: string) =>
    role === "instructor" || role === "admin";

  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <h3 className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-4">
        Comments
      </h3>

      {comments.length > 0 && (
        <ul role="list" className="flex flex-col gap-4 mb-4">
          {comments.map((c) => {
            const canEdit = c.author_id === currentUserId;
            const canDelete = c.author_id === currentUserId || isInstructor(currentUserRole);
            const isEditing = editingId === c.id;
            const isConfirmingDelete = deletingId === c.id;

            return (
              <li key={c.id} role="listitem" className="flex flex-col gap-1 group">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className={`text-xs font-semibold ${
                        isInstructor(c.author_role) ? "text-teal-primary" : "text-dark-text"
                      }`}
                    >
                      {c.author_name}
                      {isInstructor(c.author_role) && (
                        <span className="sr-only"> (Staff)</span>
                      )}
                    </span>
                    {isInstructor(c.author_role) && (
                      <span aria-hidden="true" className="text-xs text-teal-primary opacity-70">Staff</span>
                    )}
                    <time dateTime={c.created_at} className="text-xs text-muted-text">
                      {new Date(c.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  {(canEdit || canDelete) && !isEditing && (
                    <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      {canEdit && (
                        <button
                          onClick={() => startEdit(c)}
                          className="text-xs text-muted-text hover:text-dark-text transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      {canDelete && !isConfirmingDelete && (
                        <button
                          onClick={() => setDeletingId(c.id)}
                          className="text-xs text-muted-text hover:text-red-500 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                      {isConfirmingDelete && (
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-text">Delete?</span>
                          <button
                            onClick={() => confirmDelete(c.id)}
                            className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="text-xs text-muted-text hover:text-dark-text transition-colors"
                          >
                            Cancel
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="flex flex-col gap-2 mt-1">
                    {isStudent ? (
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(c.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        rows={3}
                        aria-label="Edit comment"
                        className="w-full bg-background border border-teal-primary rounded-xl p-3 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
                      />
                    ) : (
                      <RichTextEditor
                        key={editingId}
                        content={editText}
                        onChange={setEditText}
                        placeholder="Edit comment…"
                        minHeight={120}
                      />
                    )}
                    {editError && <p role="alert" className="text-xs text-red-500">{editError}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveEdit(c.id)}
                        disabled={editSaving || !editText.trim()}
                        aria-busy={editSaving}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-teal-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {editSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-muted-text hover:text-dark-text transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <MarkdownContent content={c.content} />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {deleteError && <p role="alert" className="text-xs text-red-500 mb-2">{deleteError}</p>}

      {!isObserver && (
        <div className={comments.length > 0 ? "border-t border-border pt-4" : ""}>
          {isStudent ? (
            <>
              <label htmlFor="submission-comment-input" className="sr-only">
                Add a comment for your instructor
              </label>
              <textarea
                id="submission-comment-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
                }}
                placeholder="Add a comment for your instructor…"
                rows={3}
                className="w-full bg-background border border-border rounded-xl p-3 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
              />
            </>
          ) : (
            <RichTextEditor
              key={editorKey}
              content=""
              onChange={setText}
              placeholder="Leave a comment for the student…"
              minHeight={120}
            />
          )}
          {sendError && <p role="alert" className="text-xs text-red-500 mt-1">{sendError}</p>}
          <div className="flex items-center justify-between mt-2 gap-3">
            {!submissionId && text.trim() ? (
              <p className="text-xs text-amber-700">Submit your assignment first — your comment will be ready to send after.</p>
            ) : !submissionId ? (
              <p className="text-xs text-muted-text">Submit your assignment to enable comments.</p>
            ) : null}
            <button
              onClick={send}
              disabled={sending || !text.trim() || !submissionId}
              aria-busy={sending}
              className="text-sm font-semibold px-4 py-2 rounded-full bg-teal-primary text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ml-auto"
            >
              {sending ? "Saving…" : "Save Comment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
