import { normalizeUrl } from "@/lib/url";

// File-type submissions store either a single legacy URL string, or (for
// submissions with more than one attachment) a JSON-encoded array of URLs.
//
// Each entry is one of:
//   - a storage path in the private lms-submissions bucket
//     ("assignmentId/studentId/file.png") — what new uploads store
//   - a legacy public Supabase URL for that bucket (from before it went private)
//   - any other external URL, shown as-is
export function parseFileUrls(content: string | null | undefined): string[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
    }
  } catch {
    // Not JSON — legacy single-URL submission.
  }
  return [content];
}

export function serializeFileUrls(urls: string[]): string {
  return JSON.stringify(urls);
}

export const SUBMISSIONS_BUCKET = "lms-submissions";

// Matches public, signed and authenticated object URLs for the bucket.
const BUCKET_URL_RE = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/lms-submissions\/([^?#]+)/;
// A bare storage path: at least "assignmentId/studentId/fileName", no scheme.
const BARE_PATH_RE = /^[^/:?#\s]+\/[^/?#]+\/[^?#]+$/;

/** Same traversal rules the upload route enforces on the way in. */
export function isSafeStoragePath(path: string): boolean {
  return !!path && !path.includes("..") && !path.includes("\\") && !path.startsWith("/");
}

/**
 * The lms-submissions storage path for a stored entry, or null when the entry
 * is an external URL that doesn't live in our bucket.
 */
export function submissionFilePath(entry: string): string | null {
  const trimmed = entry.trim();
  const m = trimmed.match(BUCKET_URL_RE);
  let path: string | null = null;
  if (m) {
    try {
      path = decodeURIComponent(m[1]);
    } catch {
      path = m[1];
    }
  } else if (BARE_PATH_RE.test(trimmed)) {
    path = trimmed;
  }
  return path && isSafeStoragePath(path) ? path : null;
}

/**
 * Where to point an <a>/<img> for a stored entry. Bucket files go through
 * /api/submission-file, which checks who's asking and redirects to a
 * short-lived signed URL; external URLs just get a protocol if missing.
 */
export function submissionFileHref(entry: string): string {
  const path = submissionFilePath(entry);
  return path ? `/api/submission-file?path=${encodeURIComponent(path)}` : normalizeUrl(entry);
}

/** Human-readable file name for a stored entry. */
export function submissionFileName(entry: string): string {
  const path = submissionFilePath(entry);
  if (path) return path.split("/").pop() || path;
  try {
    return decodeURIComponent(new URL(entry).pathname.split("/").pop() || entry);
  } catch {
    return entry;
  }
}
