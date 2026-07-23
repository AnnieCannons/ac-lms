import Link from 'next/link'

export default function FlashcardAdminPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-dark-text mb-8">Admin</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/flashcards/admin/student-activity"
          className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-2 hover:border-teal-primary transition-colors group"
        >
          <h2 className="text-base font-semibold text-dark-text group-hover:text-teal-primary transition-colors">Student Activity</h2>
          <p className="text-sm text-muted-text">View cards studied, days active, and most studied decks by course.</p>
        </Link>
        <Link
          href="/flashcards/import-activity"
          className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-2 hover:border-teal-primary transition-colors group"
        >
          <h2 className="text-base font-semibold text-dark-text group-hover:text-teal-primary transition-colors">Import Activity</h2>
          <p className="text-sm text-muted-text">See which students have imported your shared decks and when updates were last pushed.</p>
        </Link>
      </div>
    </div>
  )
}
