"use client";

export interface MaintainingDisplayItem {
  skillName: string;
}

interface Props {
  items: MaintainingDisplayItem[];
  onDismiss: () => void;
}

// Confidence Tracker v2: shown after a first submission for a skill the student rated 10 (the top
// of the scale), which starts "maintaining this rating" rather than a numeric goal. Shown after
// submitting, not while rating. Purely informational — it asks nothing and stores nothing.
export default function ConfidenceMaintaining({ items, onDismiss }: Props) {
  if (items.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="kudos-card flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
    >
      <ul className="space-y-0.5">
        {items.map(item => (
          <li key={item.skillName}>
            You&apos;re at the top of the scale in {item.skillName}! You&apos;re now maintaining this rating.
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs font-medium underline shrink-0"
        aria-label="Dismiss maintaining message"
      >
        Dismiss
      </button>
    </div>
  );
}
