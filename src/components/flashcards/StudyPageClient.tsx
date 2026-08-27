'use client'
import { useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import DOMPurify from 'isomorphic-dompurify'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { updateCard, rateCard, completeStudySession } from '@/lib/flashcards/actions'
import type { Deck, Card } from '@/lib/flashcards/seed'

function sanitize(html: string) {
  return DOMPurify.sanitize(html)
}

const LEARNING_STEPS_MINUTES = [1, 10]

function previewInterval(isGraduated: boolean, learningStep: number, interval: number, ef: number, rating: string): string {
  if (!isGraduated) {
    // Learning phase previews (in minutes)
    if (rating === 'Again') return `<${LEARNING_STEPS_MINUTES[0]}m`
    if (rating === 'Hard') {
      const curr = LEARNING_STEPS_MINUTES[learningStep] ?? LEARNING_STEPS_MINUTES[0]
      const next = LEARNING_STEPS_MINUTES[learningStep + 1] ?? curr
      return `<${Math.round((curr + next) / 2)}m`
    }
    if (rating === 'Good') {
      const nextStep = learningStep + 1
      if (nextStep >= LEARNING_STEPS_MINUTES.length) return '1d' // graduates
      return `<${LEARNING_STEPS_MINUTES[nextStep]}m`
    }
    // Easy: graduate with 4d
    return '4d'
  }

  // Graduated: SM-2 day previews
  if (rating === 'Again') return '1d'
  let next = interval
  if (rating === 'Hard') next = Math.max(1, Math.ceil(interval * 1.2))
  else if (rating === 'Good') next = interval <= 1 ? (interval === 0 ? 1 : 6) : Math.round(interval * ef)
  else next = interval === 0 ? 4 : interval === 1 ? 6 : Math.round(interval * ef * 1.3)

  if (next === 1) return '1d'
  if (next < 7) return `${next}d`
  if (next < 30) return `${Math.round(next / 7)}w`
  if (next < 365) return `${Math.round(next / 30)}mo`
  return `${Math.round(next / 365)}y`
}

const RATINGS = [
  { label: 'Again', className: 'rating-again border border-red-300 text-red-700 bg-red-100 hover:bg-red-200' },
  { label: 'Hard',  className: 'rating-hard border border-orange-300 text-orange-700 bg-orange-100 hover:bg-orange-200' },
  { label: 'Good',  className: 'rating-good border border-blue-300 text-blue-700 bg-blue-100 hover:bg-blue-200' },
  { label: 'Easy',  className: 'rating-easy border border-emerald-300 text-emerald-700 bg-emerald-100 hover:bg-emerald-200' },
] as const

type RatingLabel = typeof RATINGS[number]['label']

const PROSE = 'prose prose-sm max-w-none [&_code]:bg-border/40 [&_code]:px-1 [&_code]:rounded [&_code]:text-dark-text [&_pre]:bg-border/30 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre_code]:bg-transparent [&_pre_code]:text-dark-text [&_ul]:pl-4 [&_ol]:pl-4 [&_blockquote]:border-l-2 [&_blockquote]:border-teal-primary [&_blockquote]:pl-3 [&_blockquote]:text-dark-text [&_blockquote]:not-italic'

type Props = {
  deck: Deck
  initialCards: Card[]
}

export default function StudyPageClient({ deck, initialCards }: Props) {
  const sessionTotal = initialCards.length

  const [queue, setQueue] = useState<Card[]>(initialCards)
  const [showingBack, setShowingBack] = useState(false)
  const [rotateY, setRotateY] = useState(0)
  const [noTransition, setNoTransition] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [typeAnswer, setTypeAnswer] = useState('')
  const [typeRevealed, setTypeRevealed] = useState(false)
  const [clozeRevealed, setClozeRevealed] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [sessionDone, setSessionDone] = useState(false)


  // useRef so handleRate always reads the latest counts without stale closures
  const sessionStats = useRef({ Again: 0, Hard: 0, Good: 0, Easy: 0 })


  const card = queue[0]
  const front = card?.front_content ?? ''
  const back  = card?.back_content  ?? ''
  const isTypeIn = card?.card_type === 'type_in'
  const isCloze = card?.card_type === 'cloze'

  const clozeHtml = useMemo(() => {
    if (!isCloze || !front) return ''
    let idx = 0
    return front.replace(
      /<span[^>]*data-type="cloze-blank"[^>]*data-word="([^"]*)"[^>]*>[^<]*<\/span>/g,
      (_match, word) => {
        const isTarget = idx++ === (card?.blank_index ?? 0)
        if (isTarget) {
          return clozeRevealed
            ? `<span class="cloze-study-revealed">${word}</span>`
            : `<span class="cloze-study-target" role="button" tabindex="0" aria-label="Click to reveal">[...]</span>`
        }
        return `<span class="cloze-study-other">[...]</span>`
      }
    )
  }, [isCloze, front, card?.blank_index, clozeRevealed])

  const handleClozeClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('cloze-study-target')) {
      setClozeRevealed(true)
    }
  }

  const doFlip = async () => {
    if (isAnimating || isEditing || isTypeIn || isCloze) return
    setIsAnimating(true)
    setRotateY(90)
    await new Promise(r => setTimeout(r, 220))
    setShowingBack(prev => !prev)
    setNoTransition(true)
    setRotateY(-90)
    await new Promise(r => setTimeout(r, 16))
    setNoTransition(false)
    setRotateY(0)
    await new Promise(r => setTimeout(r, 220))
    setIsAnimating(false)
  }

  const resetToFront = () => {
    setShowingBack(false)
    setNoTransition(true)
    setRotateY(0)
    setTimeout(() => setNoTransition(false), 20)
    setIsAnimating(false)
    setTypeAnswer('')
    setTypeRevealed(false)
    setClozeRevealed(false)
    setIsEditing(false)
  }

  const handleRate = (rating: RatingLabel) => {
    const [current, ...rest] = queue

    // Track rating count (ref = no stale closure)
    sessionStats.current[rating]++

    // Save card progress in background — UI doesn't wait
    rateCard(current.id, rating).catch(err => console.error('Failed to save progress:', err))

    const newCompleted = completed + 1
    setCompleted(newCompleted)

    if (rest.length === 0) {
      const { Again, Hard, Good, Easy } = sessionStats.current
      completeStudySession(deck.id, {
        cards_studied: Again + Hard + Good + Easy,
        again: Again,
        hard: Hard,
        good: Good,
        easy: Easy,
      }).catch(err => console.error('Failed to save session:', err))
      setSessionDone(true)
      return
    }

    setQueue(rest)
    resetToFront()
  }

  const handleTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTypeRevealed(true)
  }

  const handleEditSave = async () => {
    if (!card) return
    setQueue(prev => prev.map(c =>
      c.id === card.id ? { ...c, front_content: editFront, back_content: editBack } : c
    ))
    setIsEditing(false)
    try {
      await updateCard(card.id, deck.id, {
        card_type: card.card_type,
        front_content: editFront,
        back_content: editBack,
      })
    } catch (err) {
      console.error('Failed to update card:', err)
    }
  }

  const progress = sessionTotal > 0 ? completed / sessionTotal : 0

  if (sessionDone) {
    return <CompletionScreen completed={completed} />
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col min-h-[calc(100vh-4rem)]">

      <div className="flex items-center justify-between mb-2">
        <Link href="/flashcards" className="text-sm text-muted-text hover:text-dark-text transition-colors">
          ← My Decks
        </Link>
        <span className="text-xs text-muted-text">{completed + 1} / {sessionTotal}</span>
      </div>

      <div className="w-full h-1 progress-track rounded-full overflow-hidden">
        <div
          className="h-1 bg-teal-primary rounded-full transition-all duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <p className="text-xs font-medium text-teal-primary text-center mt-4 mb-6">{deck.title}</p>

      {isEditing ? (
        <div className="bg-border/30 border border-border rounded-2xl p-6 flex flex-col gap-5">
          <h2 className="text-sm font-semibold text-dark-text">Edit Card</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-text uppercase tracking-widest">Front</label>
            <div className="[&>div]:!bg-surface [&_.ProseMirror]:!bg-surface">
              <RichTextEditor content={editFront} onChange={setEditFront} placeholder="Front of the card…" minHeight={100} storagePath={`flashcard-images/${deck.id}/`} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-text uppercase tracking-widest">
              {isTypeIn ? 'Expected Answer' : 'Back'}
            </label>
            <div className="[&>div]:!bg-surface [&_.ProseMirror]:!bg-surface">
              <RichTextEditor content={editBack} onChange={setEditBack} placeholder="Back of the card…" minHeight={100} storagePath={`flashcard-images/${deck.id}/`} />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleEditSave}
              className="bg-teal-primary text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="text-sm text-muted-text hover:text-dark-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center flex-1 gap-4">

          <div
            className="w-full cursor-pointer select-none"
            style={{ perspective: '1200px' }}
            onClick={doFlip}
          >
            <div
              className="w-full bg-surface rounded-2xl p-8 min-h-[160px]"
              style={{
                border: '2px solid var(--color-teal-primary)',
                transform: `rotateY(${rotateY}deg)`,
                transition: noTransition ? 'none' : 'transform 0.22s ease-in-out',
              }}
            >
              <p className="text-base font-semibold text-teal-primary mb-5">
                {showingBack ? 'Answer' : 'Question'}
              </p>
              {isCloze ? (
                <div
                  className={`${PROSE} [&_.cloze-study-target]:bg-teal-light [&_.cloze-study-target]:border-b-2 [&_.cloze-study-target]:border-teal-primary [&_.cloze-study-target]:text-teal-primary [&_.cloze-study-target]:px-1 [&_.cloze-study-target]:cursor-pointer [&_.cloze-study-target]:font-medium [&_.cloze-study-revealed]:bg-teal-light [&_.cloze-study-revealed]:border-b-2 [&_.cloze-study-revealed]:border-teal-primary [&_.cloze-study-revealed]:text-teal-primary [&_.cloze-study-revealed]:px-1 [&_.cloze-study-revealed]:font-medium [&_.cloze-study-other]:text-muted-text`}
                  dangerouslySetInnerHTML={{ __html: sanitize(clozeHtml) }}
                  onClick={handleClozeClick}
                />
              ) : (
                <div
                  className={PROSE}
                  dangerouslySetInnerHTML={{ __html: sanitize(showingBack ? back : front) }}
                />
              )}
            </div>
          </div>

          <button
            onClick={() => { setEditFront(front); setEditBack(back); setIsEditing(true) }}
            className={`flex items-center gap-1 text-xs text-muted-text hover:text-dark-text transition-colors ${isCloze ? 'invisible' : ''}`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit card
          </button>

          {isTypeIn && !showingBack && !typeRevealed && (
            <form onSubmit={handleTypeSubmit} className="w-full flex flex-col items-center gap-3 mt-2">
              <input
                type="text"
                value={typeAnswer}
                onChange={e => setTypeAnswer(e.target.value)}
                placeholder="Type your answer…"
                className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                autoFocus
              />
              <button
                type="submit"
                disabled={!typeAnswer.trim()}
                className="bg-teal-primary text-white text-sm font-medium px-8 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Check Answer
              </button>
            </form>
          )}

          {isTypeIn && typeRevealed && (
            <div className="w-full flex flex-col gap-3 mt-2">
              <div className="rounded-lg border border-border bg-surface px-4 py-3">
                <p className="text-[10px] font-semibold text-muted-text uppercase tracking-widest mb-1">Your answer</p>
                <p className="text-sm text-dark-text">{typeAnswer}</p>
              </div>
              <div className="rounded-lg border border-teal-primary bg-teal-light px-4 py-3">
                <p className="text-[10px] font-semibold text-muted-text uppercase tracking-widest mb-1">Correct answer</p>
                <div className={`text-sm ${PROSE}`} dangerouslySetInnerHTML={{ __html: sanitize(back) }} />
              </div>
              <div className="flex justify-center gap-3">
                {RATINGS.map(r => (
                  <div key={r.label} className="flex flex-col items-center gap-1">
                    <span className="text-[11px] text-muted-text">{previewInterval(card.is_graduated ?? false, card.learning_step ?? 0, card.interval ?? 0, card.easiness_factor ?? 2.5, r.label)}</span>
                    <button onClick={() => handleRate(r.label)}
                      className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${r.className}`}>
                      {r.label}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isCloze && (
            <div className="flex justify-center gap-3 mt-2">
              {!clozeRevealed ? (
                <p className="text-xs text-muted-text">Click the blank to reveal</p>
              ) : (
                RATINGS.map(r => (
                  <div key={r.label} className="flex flex-col items-center gap-1">
                    <span className="text-[11px] text-muted-text">{previewInterval(card.is_graduated ?? false, card.learning_step ?? 0, card.interval ?? 0, card.easiness_factor ?? 2.5, r.label)}</span>
                    <button onClick={() => handleRate(r.label)}
                      className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${r.className}`}>
                      {r.label}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {!isTypeIn && !isCloze && (
            <div className="flex justify-center gap-3 mt-2">
              {!showingBack ? (
                <button
                  onClick={doFlip}
                  className="bg-teal-primary text-white text-sm font-medium px-10 py-3 rounded-xl hover:opacity-90 transition-opacity"
                >
                  Show Answer
                </button>
              ) : (
                RATINGS.map(r => (
                  <div key={r.label} className="flex flex-col items-center gap-1">
                    <span className="text-[11px] text-muted-text">{previewInterval(card.is_graduated ?? false, card.learning_step ?? 0, card.interval ?? 0, card.easiness_factor ?? 2.5, r.label)}</span>
                    <button onClick={() => handleRate(r.label)}
                      className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${r.className}`}>
                      {r.label}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CompletionScreen({ completed }: { completed: number }) {
  return (
    <div className="max-w-xl mx-auto px-6 py-16 flex flex-col items-center text-center gap-6">
      <div className="text-6xl select-none">🎉</div>
      <div>
        <h1 className="text-2xl font-bold text-dark-text mb-2">Session complete!</h1>
        <p className="text-sm text-muted-text">
          You reviewed {completed} {completed === 1 ? 'card' : 'cards'}. Great work!
        </p>
      </div>
      <Link
        href="/flashcards"
        className="bg-teal-primary text-white text-sm font-medium px-8 py-3 rounded-xl hover:opacity-90 transition-opacity"
      >
        Back to My Decks
      </Link>
    </div>
  )
}
