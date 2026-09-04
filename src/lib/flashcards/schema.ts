// Types mirroring the flashcard database schema.

export const FLASHCARD_ADMIN_ROLES = ['instructor', 'staff', 'admin', 'ta'] as const
export function isFlashcardAdmin(role: string | null | undefined): boolean {
  return FLASHCARD_ADMIN_ROLES.includes(role as typeof FLASHCARD_ADMIN_ROLES[number])
}

export type CardType =
  | 'basic'
  | 'type_in'
  | 'cloze'
  | 'image_occlusion'

export type CardState = 'new' | 'in_progress' | 'review'

export type Deck = {
  id: string
  owner_user_id: string
  title: string
  description: string
  tags: string[]
  course_tag?: string[]
  is_shared: boolean
  share_token: string | null
  original_deck_id: string | null
  created_at: string
  updated_at: string
}

export type Card = {
  id: string
  deck_id: string
  card_type: CardType
  front_content: string
  back_content: string
  audio_url: string | null
  image_url: string | null
  occlusion_zones: null
  order: number
  created_at: string
  updated_at: string
  source_card_id: string | null
  blank_index?: number | null
  interval?: number
  easiness_factor?: number
  learning_step?: number
  is_graduated?: boolean
}

export type CardProgress = {
  id: string
  user_id: string
  card_id: string
  state: CardState
  interval: number
  easiness_factor: number
  due_date: string
  due_at: string | null
  learning_step: number
  last_reviewed_at: string | null
}

export type DeckWithCounts = Deck & {
  card_count: number
  new_count: number
  in_progress_count: number
  review_count: number
  import_count: number
  last_push_date: string | null
}
