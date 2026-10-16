// Decides whether a quiz shows on a given module day. Quizzes are pinned by
// module_title + day_title text (plus linked_day_id for Career Dev cross-posts).
//
// The week-number fallback lets a quiz whose module was renamed still find its
// day ("Week 5: APIs" → any module with week_number 5). It only applies when no
// module in the course has the quiz's exact module_title — otherwise a module
// whose stored week_number disagrees with its title (e.g. "Week 4: …" with
// week_number 5) would pick up the quiz too, listing it on two days.

type QuizPin = { module_title?: string | null; day_title?: string | null; linked_day_id?: string | null }
type DayRef = { id: string; day_name: string | null }
type ModuleRef = { title: string | null; week_number: number | null }

export function quizBelongsToDay(
  quiz: QuizPin,
  day: DayRef,
  module: ModuleRef,
  courseModuleTitles: ReadonlySet<string>,
): boolean {
  if (quiz.linked_day_id === day.id) return true
  if (quiz.day_title?.trim() !== day.day_name?.trim()) return false
  const quizModuleTitle = quiz.module_title?.trim()
  if (!quizModuleTitle) return false
  if (quizModuleTitle === module.title?.trim()) return true
  if (courseModuleTitles.has(quizModuleTitle)) return false
  const quizWeek = quizModuleTitle.match(/^Week\s+(\d+)/i)?.[1]
  return !!(quizWeek && module.week_number === parseInt(quizWeek, 10))
}

export function moduleTitleSet(modules: Array<{ title: string | null }>): Set<string> {
  return new Set(modules.map(m => m.title?.trim()).filter((t): t is string => !!t))
}
