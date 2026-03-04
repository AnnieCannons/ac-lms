"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FileUpload from "@/components/ui/FileUpload";

type SubmissionType = "text" | "link" | "file";
type SubmissionStatus = "draft" | "submitted" | "graded";
type Mode = "view" | "confirm-resubmit" | "edit";

type Submission = {
  id: string;
  submission_type: SubmissionType;
  content: string | null;
  status: SubmissionStatus;
  grade: 'complete' | 'incomplete' | null;
  submitted_at: string;
};

type HistoryEntry = {
  id: string;
  submission_type: SubmissionType;
  content: string | null;
  submitted_at: string;
};

export default function SubmissionForm({
  assignmentId,
  studentId,
  existingSubmission,
  initialHistory,
}: {
  assignmentId: string;
  studentId: string;
  existingSubmission: Submission | null;
  initialHistory: HistoryEntry[];
}) {
  const supabase = createClient();

  const [saved, setSaved] = useState<Submission | null>(existingSubmission);
  const [mode, setMode] = useState<Mode>(existingSubmission ? "view" : "edit");
  const [history, setHistory] = useState<HistoryEntry[]>(initialHistory);

  // Form fields (only relevant in edit mode)
  const [tab, setTab] = useState<SubmissionType>(existingSubmission?.submission_type ?? "link");
  const [linkContent, setLinkContent] = useState("");
  const [textContent, setTextContent] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getContent = () => {
    if (tab === "link") return linkContent.trim();
    if (tab === "text") return textContent.trim();
    return fileUrl;
  };

  const clearForm = () => {
    setLinkContent("");
    setTextContent("");
    setFileUrl("");
    setError(null);
  };

  const doSave = async (status: "draft" | "submitted", content: string, type: SubmissionType) => {
    if (!content) {
      setError("Please enter your submission before saving.");
      return false;
    }
    if (type === "link" && !content.startsWith("http")) {
      setError("Please enter a valid URL starting with http:// or https://");
      return false;
    }

    setError(null);
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      submission_type: type,
      content,
      status,
      submitted_at: new Date().toISOString(),
      ...(status === "submitted" ? { grade: null, graded_at: null, graded_by: null } : {}),
    };

    let result;
    if (saved) {
      const { data, error: err } = await supabase
        .from("submissions")
        .update(payload)
        .eq("id", saved.id)
        .select()
        .single();
      result = { data, error: err };
    } else {
      const { data, error: err } = await supabase
        .from("submissions")
        .insert({ ...payload, assignment_id: assignmentId, student_id: studentId })
        .select()
        .single();
      result = { data, error: err };
    }

    setSubmitting(false);

    if (result.error) {
      setError(`Failed to save: ${result.error.message}`);
      return false;
    }

    const newSaved = result.data as Submission;
    setSaved(newSaved);

    if (status === "submitted") {
      const { data: histEntry } = await supabase
        .from("submission_history")
        .insert({
          submission_id: newSaved.id,
          assignment_id: assignmentId,
          student_id: studentId,
          submission_type: type,
          content,
        })
        .select("id, submission_type, content, submitted_at")
        .single();
      if (histEntry) {
        setHistory(prev => [histEntry as HistoryEntry, ...prev]);
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    const content = getContent();
    const ok = await doSave("submitted", content, tab);
    if (ok) {
      clearForm();
      setMode("view");
    }
  };

  const handleDraft = async () => {
    const content = getContent();
    const ok = await doSave("draft", content, tab);
    if (ok) {
      clearForm();
      setMode("view");
    }
  };

  const handleResubmitSame = async () => {
    if (!saved?.content || !saved?.submission_type) return;
    const ok = await doSave("submitted", saved.content, saved.submission_type);
    if (ok) setMode("view");
  };

  const handleResubmitNew = () => {
    setTab(saved?.submission_type ?? "link");
    clearForm();
    setMode("edit");
  };

  const isGraded = saved?.status === "graded";
  const canResubmit = !isGraded || saved?.grade === "incomplete";

  return (
    <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Turn In</p>
        {saved && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            saved.grade === "complete"   ? "bg-teal-light text-teal-primary" :
            saved.grade === "incomplete" ? "bg-red-50 text-red-500" : // needs revision
            saved.status === "submitted" ? "bg-teal-light text-teal-primary" :
            saved.status === "graded"    ? "bg-purple-100 text-purple-primary" :
                                           "bg-yellow-50 text-yellow-600"
          }`}>
            {saved.grade === "complete"   ? "Complete ✓" :
             saved.grade === "incomplete" ? "Needs Revision" :
             saved.status === "submitted" ? "Turned in" :
             saved.status === "graded"    ? "Graded" : "Draft saved"}
          </span>
        )}
      </div>

      {/* ── VIEW MODE: show submitted content ── */}
      {mode === "view" && saved && (
        <>
          <div className="bg-background rounded-xl border border-border p-4 flex flex-col gap-2">
            <p className="text-xs text-muted-text">
              {saved.status === "graded" ? "Graded" : saved.status === "submitted" ? "Submitted" : "Draft saved"}
              {" · "}
              {new Date(saved.submitted_at).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
                hour: "numeric", minute: "2-digit",
              })}
            </p>
            {saved.submission_type === "file" || saved.submission_type === "link" ? (
              <a
                href={saved.content ?? ""}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-teal-primary underline break-all"
              >
                {saved.content}
              </a>
            ) : (
              <p className="text-sm text-dark-text whitespace-pre-wrap break-words">{saved.content}</p>
            )}
          </div>

          {saved?.grade === "incomplete" && (
            <p className="text-xs text-red-500 font-medium">
              Your instructor has requested revisions. Review their feedback and resubmit when ready.
            </p>
          )}
          {canResubmit && (
            <button
              type="button"
              onClick={() => setMode("confirm-resubmit")}
              className="text-sm text-muted-text hover:text-dark-text transition-colors w-fit"
            >
              Resubmit →
            </button>
          )}
          {isGraded && saved?.grade === "complete" && (
            <p className="text-xs text-muted-text">This submission has been marked complete.</p>
          )}

          {/* Submission history */}
          {history.length > 1 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
                Submission History ({history.length})
              </p>
              {history.map((entry, i) => (
                <div key={entry.id} className="flex items-start gap-3 text-xs">
                  <span className="text-muted-text shrink-0 mt-0.5 w-32">
                    {new Date(entry.submitted_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric",
                      hour: "numeric", minute: "2-digit",
                    })}
                  </span>
                  {entry.submission_type === "file" || entry.submission_type === "link" ? (
                    <a
                      href={entry.content ?? ""}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-primary underline break-all flex-1"
                    >
                      {entry.content}
                    </a>
                  ) : (
                    <p className="text-dark-text line-clamp-2 flex-1">{entry.content}</p>
                  )}
                  {i === 0 && (
                    <span className="text-muted-text shrink-0">(latest)</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── CONFIRM RESUBMIT MODE ── */}
      {mode === "confirm-resubmit" && saved && (
        <div className="bg-background rounded-xl border border-border p-4 flex flex-col gap-4">
          <p className="text-sm font-medium text-dark-text">
            Is your {saved.submission_type === "link" ? "link" : saved.submission_type === "file" ? "file" : "response"} the same as before?
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleResubmitSame}
              disabled={submitting}
              className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting ? "Submitting…" : "Yes, resubmit same"}
            </button>
            <button
              type="button"
              onClick={handleResubmitNew}
              disabled={submitting}
              className="text-sm text-muted-text hover:text-dark-text border border-border px-4 py-2 rounded-full transition-colors disabled:opacity-50"
            >
              No, I'll enter a new one
            </button>
            <button
              type="button"
              onClick={() => setMode("view")}
              className="text-sm text-muted-text hover:text-dark-text transition-colors"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {/* ── EDIT MODE: submission form ── */}
      {mode === "edit" && (
        <>
          {/* Tab selector */}
          <div className="flex gap-1 bg-background rounded-lg p-1 border border-border w-fit">
            {(["link", "text", "file"] as SubmissionType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(null); }}
                className={`text-xs font-medium px-3 py-1.5 rounded-md capitalize transition-colors ${
                  tab === t
                    ? "bg-teal-primary text-white"
                    : "text-muted-text hover:text-dark-text"
                }`}
              >
                {t === "link" ? "Link (URL)" : t === "text" ? "Text" : "File upload"}
              </button>
            ))}
          </div>

          {tab === "link" && (
            <input
              type="url"
              placeholder="https://github.com/your-username/your-repo"
              value={linkContent}
              onChange={e => setLinkContent(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
            />
          )}

          {tab === "text" && (
            <textarea
              placeholder="Write your response here…"
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              rows={6}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-y"
            />
          )}

          {tab === "file" && (
            <FileUpload
              bucket="lms-submissions"
              path={`${assignmentId}/${studentId}/`}
              onUpload={(url) => setFileUrl(url)}
              onError={setError}
            />
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
            <button
              type="button"
              onClick={handleDraft}
              disabled={submitting}
              className="text-sm text-muted-text hover:text-dark-text disabled:opacity-50 transition-colors"
            >
              Save draft
            </button>
            {saved && (
              <button
                type="button"
                onClick={() => { clearForm(); setMode("view"); }}
                className="text-sm text-muted-text hover:text-dark-text transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
