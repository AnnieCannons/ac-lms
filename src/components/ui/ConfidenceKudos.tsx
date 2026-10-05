"use client";

export interface KudosDisplayItem {
  skillName: string;
  from: number;
  to: number;
}

interface Props {
  items: KudosDisplayItem[];
  onDismiss: () => void;
}

// Confidence Tracker v2 Phase 5: a small, one-time acknowledgment shown after a first
// submission. Purely informational — it asks nothing and stores nothing.
export default function ConfidenceKudos({ items, onDismiss }: Props) {
  if (items.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="kudos-card flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3 rounded-lg border px-3 py-2 text-sm"
    >
      <div className="min-w-0">
        <p className="font-semibold">
          Nice progress! <span aria-hidden="true">🎉</span>
        </p>
        <ul className="mt-1 space-y-0.5">
          {items.map(item => (
            <li key={item.skillName}>
              Your confidence in {item.skillName} went up from {item.from} to {item.to}.
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        // On a phone the button sits above the content (right-aligned) so the text gets the full width;
        // from `sm` up it goes back beside it. min-h-8 keeps the touch target above 24px.
        className="order-first inline-flex min-h-8 items-center self-end px-2 text-xs font-medium underline shrink-0 sm:order-none sm:self-start"
        aria-label="Dismiss progress message"
      >
        Dismiss
      </button>
    </div>
  );
}
