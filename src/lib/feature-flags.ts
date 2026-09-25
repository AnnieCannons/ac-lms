// Server-only feature flags. Never prefix these with NEXT_PUBLIC_ — they're
// checked in server-side code and must never be exposed to the browser bundle.

// Confidence Tracker v2, Phases 2+ (rating capture and everything built on top of it).
// Defaults to disabled (fail-safe) if unset in a given environment. Phase 1's
// instructor-facing skill tagging is intentionally NOT gated by this flag — it
// stays live regardless, since tagging alone has no student-facing effect.
export function isConfidenceRatingsEnabled(): boolean {
  return process.env.CONFIDENCE_TRACKER_V2_RATINGS_ENABLED === 'true'
}
