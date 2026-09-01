'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PREDEFINED_TAGS = [
  'HTML', 'CSS', 'JavaScript', 'React', 'SQL', 'Node.js',
  'Express.js', 'APIs', 'Git', 'Command Line', 'Accessibility',
  'Career Development', 'Other',
]

type Props = {
  mode: 'create' | 'edit'
  initialTitle?: string
  initialDescription?: string
  initialTags?: string[]
  deckId?: string
  onSave: (data: { title: string; description: string; tags: string[] }) => void
}

export default function DeckForm({
  mode,
  initialTitle = '',
  initialDescription = '',
  initialTags = [],
  onSave,
}: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags)
  const [saved, setSaved] = useState(false)

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSave({ title: title.trim(), description: description.trim(), tags: selectedTags })
    if (mode === 'edit') setSaved(true)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="deck-title" className="text-sm font-medium text-dark-text">
          Title <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input
          id="deck-title"
          type="text"
          value={title}
          onChange={e => { setTitle(e.target.value); setSaved(false) }}
          placeholder="e.g. JavaScript Fundamentals"
          required
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-dark-text placeholder:text-muted-text text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="deck-description" className="text-sm font-medium text-dark-text">
          Description <span className="text-muted-text font-normal">(optional)</span>
        </label>
        <textarea
          id="deck-description"
          value={description}
          onChange={e => { setDescription(e.target.value); setSaved(false) }}
          placeholder="What is this deck about?"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-dark-text placeholder:text-muted-text text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
        />
      </div>

      {/* Tags */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-dark-text">Tags</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Select tags">
          {PREDEFINED_TAGS.map(tag => {
            const selected = selectedTags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => { toggleTag(tag); setSaved(false) }}
                aria-pressed={selected}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selected
                    ? 'bg-teal-primary text-white border-teal-primary'
                    : 'bg-surface text-muted-text border-border hover:border-teal-primary hover:text-teal-primary'
                }`}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!title.trim()}
          className="bg-teal-primary text-white text-sm font-medium px-5 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {mode === 'create' ? 'Create Deck' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/flashcards')}
          className="text-sm text-muted-text hover:text-dark-text transition-colors"
        >
          Cancel
        </button>
        {saved && (
          <span className="text-sm text-teal-primary ml-1" role="status">
            Saved!
          </span>
        )}
      </div>

    </form>
  )
}
