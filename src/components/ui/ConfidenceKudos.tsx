"use client";

export interface KudosDisplayItem {
  skillName: string;
  from: number;
  to: number;
  // The skill also reached 10 (the top of the scale): say so instead of the "went up" numbers.
  maintaining?: boolean;
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
      className="kudos-card flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
    >
      <div>
        <p className="font-semibold">
          Nice progress! <span aria-hidden="true">🎉</span>
        </p>
        <ul className="mt-1 space-y-0.5">
          {items.map(item => (
            <li key={item.skillName}>
              {item.maintaining
                ? <>You&apos;re at the top of the scale in {item.skillName}! You&apos;re now maintaining this rating.</>
                : <>Your confidence in {item.skillName} went up from {item.from} to {item.to}.</>}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs font-medium underline shrink-0"
        aria-label="Dismiss progress message"
      >
        Dismiss
      </button>
    </div>
  );
}
