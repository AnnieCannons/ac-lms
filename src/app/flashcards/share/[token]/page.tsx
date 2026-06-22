import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDeckByShareToken, getCardsByDeck, checkAlreadyImported } from '@/lib/flashcards/queries'
import ImportButton from './ImportButton'
import Link from 'next/link'
import DOMPurify from 'isomorphic-dompurify'

const PROSE = 'prose prose-sm max-w-none [&_code]:bg-border/40 [&_code]:px-1 [&_code]:rounded [&_code]:text-dark-text [&_pre]:bg-border/30 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre_code]:bg-transparent [&_ul]:pl-4 [&_ol]:pl-4'

const TYPE_LABELS: Record<string, string> = {
  basic: 'Basic',
  type_in: 'Type In',
  cloze: 'Cloze',
  image_occlusion: 'Image Occlusion',
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const deck = await getDeckByShareToken(token)

  if (!deck) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <p className="text-dark-text font-semibold mb-2">Deck not found</p>
        <p className="text-sm text-muted-text mb-6">This share link may be invalid or the deck may no longer be shared.</p>
        <Link href="/flashcards" className="text-sm text-teal-primary hover:underline">← Back to My Decks</Link>
      </div>
    )
  }

  const [cards, alreadyImported] = await Promise.all([
    getCardsByDeck(deck.id),
    checkAlreadyImported(user.id, deck.id),
  ])

  return (
    <div className="max-w-xl mx-auto px-6 py-12 flex flex-col items-center gap-6">

      <div className="w-full bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold text-dark-text">{deck.title}</h1>
          {deck.description && (
            <p className="text-sm text-muted-text mt-1">{deck.description}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {deck.tags.map((tag: string) => (
            <span key={tag} className="bg-teal-light text-teal-primary text-xs font-medium px-2 py-0.5 rounded-md">
              {tag}
            </span>
          ))}
        </div>

        <p className="text-sm text-muted-text">{cards.length} {cards.length === 1 ? 'card' : 'cards'}</p>
      </div>

      <div className="w-full flex flex-col gap-3">
        {cards.map((card, i) => (
          <div key={card.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-text font-medium">{i + 1}</span>
              <span className="bg-teal-light text-teal-primary text-xs font-medium px-2 py-0.5 rounded-md">
                {TYPE_LABELS[card.card_type] ?? card.card_type}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-muted-text uppercase tracking-widest mb-1">Front</p>
                <div
                  className={PROSE}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(card.front_content) }}
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-text uppercase tracking-widest mb-1">Back</p>
                <div
                  className={PROSE}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(card.back_content) }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <ImportButton deckId={deck.id} deckTitle={deck.title} alreadyImported={alreadyImported} />
    </div>
  )
}
