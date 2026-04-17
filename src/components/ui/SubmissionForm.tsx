"use client";

import { useState } from "react";
import MarkdownContent, { PlainTextContent } from "@/components/ui/MarkdownContent";
import FileUpload from "@/components/ui/FileUpload";
import { toggleStudentChecklistItem } from "@/lib/checklist-actions";
import SubmissionComments, { type CommentEntry } from "@/components/ui/SubmissionComments";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { normalizeUrl } from "@/lib/url";
import { saveSubmission } from "@/lib/submission-actions";



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
  student_comment?: string | null;
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
  instructorResponseMap,
  isObserver,
  isStudentPreview,
  initialComments = [],
  currentUserName = 'Student',
  currentUserRole = 'student',
}: {
  assignmentId: string;
  studentId: string;
  courseId: string;
  existingSubmission: Submission | null;
  initialHistory: HistoryEntry[];
  checklistItems?: ChecklistItem[];
  initialChecked?: Record<string, boolean>;
  instructorResponseMap?: Map<string, boolean>;
  isObserver?: boolean;
  isStudentPreview?: boolean;
  initialComments?: CommentEntry[];
  currentUserName?: string;
  currentUserRole?: string;
}) {
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

  const [previewMd, setPreviewMd] = useState(false);
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

  const [commentText, setCommentText] = useState('');
  useUnsavedChanges((mode === 'edit' && hasContent) || commentText.trim().length > 0);

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

  const doSave = async (status: "draft" | "submitted", content: string, type: SubmissionType): Promise<Submission | null> => {
    if (isStudentPreview) return null;
    if (!content) {
      setError("Please enter your submission before saving.");
      return null;
    }
    if (type === "link" && !content.startsWith("http")) {
      setError("Please enter a valid URL starting with http:// or https://");
      return null;
    }

    setError(null);
    setSubmitting(true);

    const result = await saveSubmission(
      assignmentId,
      status,
      content,
      type,
      saved?.id ?? null,
      saved?.submitted_at ?? null,
    );

    setSubmitting(false);

    if (result.error) {
      setError(`Failed to save: ${result.error}`);
      return null;
    }

    const newSaved = result.data as Submission;
    setSaved(newSaved);

    if (status === "submitted" && result.historyEntry) {
      setHistory(prev => [result.historyEntry as HistoryEntry, ...prev]);
    }

    return newSaved;
  };

  const handleSubmit = async () => {
    const content = getContent();
    const newSaved = await doSave("submitted", content, tab);
    if (newSaved) {
      clearForm();
      setMode("view");
    }
  };

  const handleDraft = async () => {
    const content = getContent();
    const result = await doSave("draft", content, tab);
    if (result) {
      clearForm();
      setMode("view");
    }
  };

  const handleResubmitSame = async () => {
    if (!saved?.content || !saved?.submission_type) return;
    const result = await doSave("submitted", saved.content, saved.submission_type);
    if (result) setMode("view");
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
      <div className="status-late-badge border rounded-xl px-4 py-3 text-sm">
        Assignment submission is disabled in Student View.
      </div>
    )}
    {isObserver && (
      <div className="status-late-badge border rounded-xl px-4 py-3 text-sm">
        You&apos;re currently on leave. Your submitted work is visible below, but submissions are paused.
      </div>
    )}
    {hasChecklist && (
      <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Checklist</p>
            {instructorResponseMap && instructorResponseMap.size > 0 && (
              <p className="text-xs text-muted-text mt-0.5">Your self-check · Instructor review</p>
            )}
          </div>
          <span className="text-xs text-muted-text">
            {requiredItems.filter(i => checked[i.id]).length}/{requiredItems.length} required checked
          </span>
        </div>
        <ul className="flex flex-col gap-3">
          {checklistItems!.map(item => {
            const isBonus = item.required === false;
            const instructorValue = instructorResponseMap?.get(item.id);
            const instructorChecked = instructorValue === true;
            const instructorFailed = instructorValue === false;
            return (
              <li key={item.id}>
                <div className={`flex items-start gap-3 w-full ${instructorFailed ? 'status-missing-card rounded-xl px-3 py-2 -mx-1 border' : instructorChecked ? 'bg-teal-light/20 rounded-xl px-3 py-2 -mx-1' : ''}`}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={!!checked[item.id]}
                    onClick={() => !isObserver && toggleCheck(item.id)}
                    className={`flex items-start gap-3 flex-1 text-left group ${isObserver ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <span aria-hidden="true" className={`w-4 h-4 mt-0.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      checked[item.id]
                        ? "bg-teal-primary border-teal-primary"
                        : "border-muted-text group-hover:border-teal-primary"
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
                  {/* Instructor verdict badge */}
                  {instructorChecked && (
                    <span className="shrink-0 mt-0.5 flex items-center gap-1 text-xs font-semibold text-teal-primary">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                      </svg>
                      Approved
                    </span>
                  )}
                  {instructorFailed && (
                    <span className="shrink-0 mt-0.5 flex items-center gap-1 text-xs font-semibold text-red-500">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2 2l8 8M10 2l-8 8" />
                      </svg>
                      Revise
                    </span>
                  )}
                </div>
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
            saved.grade === "complete"   ? "status-complete-btn border" :
            saved.grade === "incomplete" ? "status-revision-btn border" :
            saved.status === "submitted" ? "bg-teal-light text-teal-primary border border-teal-primary" :
            saved.status === "graded"    ? "bg-purple-100 text-purple-primary" :
                                           "status-draft-badge"
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
              <PlainTextContent content={saved.content} />
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
              onClick={() => saved?.status === 'draft' || saved?.submission_type !== 'link' ? editDraft() : setMode("confirm-resubmit")}
              className={saved?.status === 'draft'
                ? "text-sm text-muted-text hover:text-dark-text transition-colors w-fit"
                : "text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:border-teal-primary hover:text-teal-primary transition-colors w-fit"
              }
            >
              {saved?.status === 'draft' ? 'Edit' : 'Resubmit'}
            </button>
          )}
          {isGraded && saved?.grade === "complete" && (
            <p className="text-xs text-muted-text">This submission has been marked complete.</p>
          )}

          {/* Submission history */}
          {history.length > 1 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
                Past Submissions ({history.length - 1})
              </p>
              {history.slice(1).map((entry) => (
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
                    <div className="flex-1 min-w-0 line-clamp-3"><MarkdownContent content={entry.content ?? ''} /></div>
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
          <div role="tablist" aria-label="Submission type" className="flex gap-1 bg-background rounded-lg p-1 border border-border w-fit">
            {(["link", "text", "file"] as SubmissionType[]).map(t => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
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
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-text">Supports **bold**, *italic*, `code`, lists, and links</p>
                <button
                  type="button"
                  onClick={() => setPreviewMd(p => !p)}
                  className="text-xs font-medium text-teal-primary hover:underline"
                >
                  {previewMd ? "Edit" : "Preview"}
                </button>
              </div>
              {previewMd ? (
                <div className="min-h-[9rem] bg-background border border-border rounded-lg px-3 py-2">
                  {textContent.trim() ? (
                    <MarkdownContent content={textContent} />
                  ) : (
                    <p className="text-sm text-muted-text italic">Nothing to preview.</p>
                  )}
                </div>
              ) : (
                <textarea
                  placeholder="Write your response here…"
                  value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                  rows={6}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-y font-mono"
                />
              )}
            </div>
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

    {/* Threaded comments — always visible below the form (student and instructor can message back and forth) */}
    {!isStudentPreview && (
      <SubmissionComments
        submissionId={saved?.id ?? null}
        initialComments={initialComments}
        currentUserId={studentId}
        currentUserName={currentUserName}
        currentUserRole={currentUserRole}
        isObserver={isObserver}
        text={commentText}
        onTextChange={setCommentText}
      />
    )}
    </>
  );
}
