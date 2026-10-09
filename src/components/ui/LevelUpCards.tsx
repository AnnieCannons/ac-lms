import Link from 'next/link'
import { LEVEL_UP_PLATFORMS, LEVEL_UP_PLATFORM_IDS, type LevelUpPlatform } from '@/lib/level-up-platforms'
import type { LevelUpLink } from '@/lib/level-up-links'
import RecommendedCoursesDialog from './RecommendedCoursesDialog'

const CARD = 'bg-surface rounded-2xl border border-border p-5 flex flex-col gap-3'
const MARK = 'shrink-0 w-10 h-10 rounded-xl bg-teal-light text-teal-primary font-bold text-sm flex items-center justify-center'

function NewTab() {
  return <span className="sr-only"> (opens in a new tab)</span>
}

function StudyCard({ href, mark, title, description, cta }: { href: string; mark: string; title: string; description: string; cta: string }) {
  return (
    <Link href={href} className={`${CARD} hover:border-teal-primary transition-colors group`}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={MARK}>{mark}</span>
        <h3 className="font-semibold text-dark-text">{title}</h3>
      </div>
      <p className="text-sm text-muted-text flex-1">{description}</p>
      <span className="text-sm font-semibold text-teal-primary group-hover:underline">{cta} →</span>
    </Link>
  )
}

function PlatformCard({ platform, links }: { platform: LevelUpPlatform; links: LevelUpLink[] }) {
  const info = LEVEL_UP_PLATFORMS[platform]
  return (
    <section aria-labelledby={`level-up-${platform}`} className={CARD}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={MARK}>{info.mark}</span>
        <div className="min-w-0">
          <h3 id={`level-up-${platform}`} className="font-semibold text-dark-text">{info.name}</h3>
          {/* Every platform card gets a badge so the headers line up */}
          {info.proAccount ? (
            <span className="inline-block mt-0.5 text-xs font-medium bg-purple-light text-purple-primary border border-purple-primary/30 rounded-full px-2 py-0.5">
              Pro account included
            </span>
          ) : info.url && (
            <span className="inline-block mt-0.5 text-xs font-medium bg-teal-light text-teal-primary border border-teal-primary/30 rounded-full px-2 py-0.5">
              Free
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-text">{info.description}</p>

      {links.length > 0 && <RecommendedCoursesDialog platformName={info.name} links={links} />}

      {info.url && (
        <a
          href={info.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto self-start text-sm font-semibold px-3 py-1.5 rounded-lg border border-teal-primary text-teal-primary hover:bg-teal-light transition-colors"
        >
          Open {info.name} ↗<NewTab />
        </a>
      )}
    </section>
  )
}

/** The top of Level Up Your Skills: study tools, then a card per learning platform with its recommended courses. */
export default function LevelUpCards({ courseId, links, practiceQuizCount }: { courseId: string; links: LevelUpLink[]; practiceQuizCount: number }) {
  const levelUpPath = `/student/courses/${courseId}/level-up`
  const byPlatform = (p: LevelUpPlatform) => links.filter(l => l.platform === p)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">Study tools</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <StudyCard
            href={`/flashcards?from=${encodeURIComponent(levelUpPath)}`}
            mark="FC"
            title="Flashcards"
            description="Make your own decks or study shared ones, with spaced repetition to help it stick."
            cta="Open flashcards"
          />
          <StudyCard
            href={`${levelUpPath}/practice`}
            mark="?"
            title="Practice quizzes"
            description={practiceQuizCount > 0
              ? `${practiceQuizCount} ungraded quiz${practiceQuizCount === 1 ? '' : 'zes'} to check what you know. Retake them as often as you like.`
              : 'Ungraded quizzes to check what you know. None have been added yet.'}
            cta="Practice"
          />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">Learning platforms</h2>
        {/* auto-rows-fr: every row (so every card) is the height of the tallest card */}
        <div className="grid gap-4 sm:grid-cols-2 sm:auto-rows-fr">
          {LEVEL_UP_PLATFORM_IDS
            .filter(p => p !== 'other' || byPlatform('other').length > 0)
            .map(p => <PlatformCard key={p} platform={p} links={byPlatform(p)} />)}
        </div>
      </div>
    </div>
  )
}
