"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FileUpload from "@/components/ui/FileUpload";
import { revalidateAssignmentsPage } from "@/lib/revalidate-actions";
import { toggleStudentChecklistItem } from "@/lib/checklist-actions";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { normalizeUrl } from "@/lib/url";

// Strip HTML tags (from Canvas-synced body text) and return clean text
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Render text content: strip HTML, and if the result is a URL render it as a link
function TextContent({ content, className }: { content: string; className?: string }) {
  const text = content.includes('<') ? stripHtml(content) : content
  try {
    new URL(text)
    return <a href={text} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-primary underline break-all">{text}</a>
  } catch {
    return <p className={className ?? "text-sm text-dark-text whitespace-pre-wrap break-words"}>{text}</p>
  }
}

type SubmissionType = "text" | "link" | "file";
type SubmissionStatus = "draft" | "submitted" | "graded";
type Mode = "view" | "confirm-resubmit" | "edit";

type ChecklistItem = {
  id: string;
  text: string;
  description: string | null;
  required?: boolean;
};

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

function isImageUrl(url: string | null): boolean {
  if (!url) return false
  return /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(url)
}

export default function SubmissionForm({
  assignmentId,
  studentId,
  courseId,
  existingSubmission,
  initialHistory,
  checklistItems,
  initialChecked,
  isObserver,
  isStudentPreview,
}: {
  assignmentId: string;
  studentId: string;
  courseId: string;
  existingSubmission: Submission | null;
  initialHistory: HistoryEntry[];
  checklistItems?: ChecklistItem[];
  initialChecked?: Record<string, boolean>;
  isObserver?: boolean;
  isStudentPreview?: boolean;
}) {
  const supabase = createClient();

  const [saved, setSaved] = useState<Submission | null>(existingSubmission);
  const [mode, setMode] = useState<Mode>(existingSubmission ? "view" : "edit");
  const [history, setHistory] = useState<HistoryEntry[]>(initialHistory);

  const hasChecklist = !!checklistItems && checklistItems.length > 0;
  const [checked, setChecked] = useState<Record<string, boolean>>(initialChecked ?? {});
  const requiredItems = checklistItems?.filter(i => i.required !== false) ?? [];
  const allChecked = !hasChecklist || requiredItems.every(item => checked[item.id]);

  const toggleCheck = async (id: string) => {
    const next = !checked[id];
    setChecked(prev => ({ ...prev, [id]: next }));
    const result = await toggleStudentChecklistItem(id, studentId, next);
    if (result?.error) {
      setChecked(prev => ({ ...prev, [id]: !next }));
    }
  };

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

  const hasContent = tab === "link"
    ? linkContent.trim().length > 0
    : tab === "text"
      ? textContent.trim().length > 0
      : fileUrl.length > 0;
  useUnsavedChanges(mode === 'edit' && hasContent);

  const clearForm = () => {
    setLinkContent("");
    setTextContent("");
    setFileUrl("");
    setError(null);
  };

  const editDraft = () => {
    if (saved) {
      setTab(saved.submission_type)
      if (saved.submission_type === "link") setLinkContent(saved.content ?? "")
      else if (saved.submission_type === "text") setTextContent(saved.content ?? "")
      else setFileUrl(saved.content ?? "")
    }
    setError(null)
    setMode("edit")
  };

  const doSave = async (status: "draft" | "submitted", content: string, type: SubmissionType) => {
    if (isStudentPreview) return false;
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
      revalidateAssignmentsPage(courseId);

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
    <>
    {isStudentPreview && (
      <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800">
        Assignment submission is disabled in Student View.
      </div>
    )}
    {isObserver && (
      <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800">
        You&apos;re currently on leave. Your submitted work is visible below, but submissions are paused.
      </div>
    )}
    {hasChecklist && (
      <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Checklist</p>
          <span className="text-xs text-muted-text">
            {requiredItems.filter(i => checked[i.id]).length}/{requiredItems.length} required checked
          </span>
        </div>
        <ul className="flex flex-col gap-3">
          {checklistItems!.map(item => {
            const isBonus = item.required === false;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => !isObserver && toggleCheck(item.id)}
                  className={`flex items-start gap-3 w-full text-left group ${isObserver ? 'pointer-events-none opacity-60' : ''}`}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm transition-colors ${checked[item.id] ? "text-muted-text line-through" : "text-dark-text"}`}>
                        {item.text}
                      </p>
                      {isBonus && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-300">
                          Bonus
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-text mt-0.5">{item.description}</p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-text mt-4">
          Check off items as you complete them — your instructor will confirm each when grading.
        </p>
      </div>
    )}
    <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Turn In</p>
        {saved && (
          <span aria-live="polite" className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            saved.grade === "complete"   ? "bg-green-50 text-green-700 border border-green-600" :
            saved.grade === "incomplete" ? "bg-red-50 text-red-500 border border-red-500" :
            saved.status === "submitted" ? "bg-teal-light text-teal-primary border border-teal-primary" :
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
            {!saved.content ? (
              <p className="text-sm text-muted-text italic">No submission content — graded by instructor.</p>
            ) : saved.submission_type === "file" && isImageUrl(saved.content) ? (
              <a href={normalizeUrl(saved.content)} target="_blank" rel="noopener noreferrer" className="block w-fit">
                <img
                  src={saved.content ?? ""}
                  alt="Submitted file"
                  className="max-h-48 max-w-full rounded-lg border border-border object-contain hover:opacity-90 transition-opacity"
                />
              </a>
            ) : saved.submission_type === "file" || saved.submission_type === "link" ? (
              <a
                href={normalizeUrl(saved.content)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-teal-primary underline break-all"
              >
                {saved.content}
              </a>
            ) : (
              <TextContent content={saved.content} />
            )}
          </div>

          {saved?.grade === "incomplete" && (
            <p className="text-sm text-red-500">
              Your instructor has requested revisions. Review their feedback and resubmit when ready.
            </p>
          )}
          {!isObserver && canResubmit && (
            <button
              type="button"
              onClick={() => saved?.status === 'draft' ? editDraft() : setMode("confirm-resubmit")}
              className="text-sm text-muted-text hover:text-dark-text transition-colors w-fit"
            >
              {saved?.status === 'draft' ? 'Edit' : 'Resubmit →'}
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
                  <span className="text-muted-text shrink-0 whitespace-nowrap mt-0.5">
                    {new Date(entry.submitted_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric",
                      hour: "numeric", minute: "2-digit",
                    })}
                  </span>
                  {entry.submission_type === "file" && isImageUrl(entry.content) ? (
                    <a href={normalizeUrl(entry.content)} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <img
                        src={entry.content ?? ""}
                        alt="Submitted file"
                        className="max-h-16 max-w-full rounded border border-border object-contain hover:opacity-90 transition-opacity"
                      />
                    </a>
                  ) : entry.submission_type === "file" || entry.submission_type === "link" ? (
                    <a
                      href={normalizeUrl(entry.content)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-primary underline break-all flex-1"
                    >
                      {entry.content}
                    </a>
                  ) : (
                    <TextContent content={entry.content ?? ''} className="text-dark-text line-clamp-2 flex-1" />
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
      {!isObserver && mode === "confirm-resubmit" && saved && (
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
          <p role="alert" aria-live="assertive" className="text-xs text-red-400 min-h-[1rem]">{error ?? ''}</p>
        </div>
      )}

      {/* ── EDIT MODE: submission form ── */}
      {!isObserver && mode === "edit" && (
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

          <p role="alert" aria-live="assertive" className="text-xs text-red-400 min-h-[1rem]">{error ?? ''}</p>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !allChecked || !hasContent || !!isStudentPreview}
              className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
            {(!allChecked || !hasContent) && (
              <p className="text-xs text-amber-700">
                {!hasContent && !allChecked
                  ? "Add your submission and complete all checklist items to submit."
                  : !hasContent
                    ? "Add your submission to submit."
                    : "Complete all checklist items to submit."}
              </p>
            )}
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
    </>
  );
}
