export default function FlashcardAdminPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <a
          href="/flashcards/admin/stats"
          className="rounded-2xl border border-border bg-surface p-6 hover:border-teal-primary transition-colors flex flex-col gap-2"
        >
          <span className="text-2xl">📊</span>
          <h2 className="text-base font-semibold text-dark-text">Student Stats</h2>
          <p className="text-sm text-muted-text">View flashcard activity by course and student.</p>
        </a>

        <a
          href="/flashcards/admin/badges"
          className="rounded-2xl border border-border bg-surface p-6 hover:border-teal-primary transition-colors flex flex-col gap-2"
        >
          <span className="text-2xl">🏅</span>
          <h2 className="text-base font-semibold text-dark-text">Badges</h2>
          <p className="text-sm text-muted-text">View and manage the badge and achievement system.</p>
        </a>
      </div>
    </div>
  )
}
