// File-type submissions store either a single legacy URL string, or (for
// submissions with more than one attachment) a JSON-encoded array of URLs.
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
