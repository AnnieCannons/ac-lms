/**
 * Seed data for the flashcard app.
 *
 * Used during development before the database tables exist.
 * Content is stored as HTML strings here — in production,
 * front_content and back_content will be Tiptap JSON (jsonb).
 *
 * Data shapes match the production schema exactly so swapping
 * in real Supabase queries is a clean replacement.
 */

// ---------------------------------------------------------------------------
// Types (mirror the database schema)
// ---------------------------------------------------------------------------

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
  front_content: string // HTML string for seed data; Tiptap JSON (jsonb) in production
  back_content: string  // HTML string for seed data; Tiptap JSON (jsonb) in production
  audio_url: string | null
  image_url: string | null
  occlusion_zones: null
  order: number
  created_at: string
  updated_at: string
  source_card_id: string | null
}

export type CardProgress = {
  id: string
  user_id: string
  card_id: string
  state: CardState
  interval: number
  easiness_factor: number
  due_date: string
  last_reviewed_at: string | null
}

// Deck shape used by the home screen — adds computed counts
export type DeckWithCounts = Deck & {
  card_count: number
  new_count: number
  in_progress_count: number
  review_count: number
  import_count: number
  last_push_date: string | null
}

// ---------------------------------------------------------------------------
// Seed user (replace with real auth user during development)
// ---------------------------------------------------------------------------

export const SEED_USER_ID = 'seed-user-1'

// ---------------------------------------------------------------------------
// Decks
// ---------------------------------------------------------------------------

export const SEED_DECKS: Deck[] = [
  {
    id: 'deck-js-1',
    owner_user_id: SEED_USER_ID,
    title: 'JavaScript Fundamentals',
    description: 'Core JavaScript concepts — variables, data types, the DOM, and functions.',
    tags: ['JavaScript'],
    is_shared: true,
    share_token: 'js-fundamentals-xk92m',
    original_deck_id: null,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
  },
  {
    id: 'deck-css-1',
    owner_user_id: SEED_USER_ID,
    title: 'CSS Fundamentals',
    description: 'Selectors, declarations, rules, and CSS variables.',
    tags: ['CSS'],
    is_shared: true,
    share_token: 'css-fundamentals-share-token',
    original_deck_id: null,
    created_at: '2026-05-10T00:00:00Z',
    updated_at: '2026-05-10T00:00:00Z',
  },
  {
    id: 'deck-html-1',
    owner_user_id: SEED_USER_ID,
    title: 'HTML Essentials',
    description: 'Semantic elements, attributes, forms, and accessibility basics.',
    tags: ['HTML'],
    is_shared: false,
    share_token: null,
    original_deck_id: 'deck-js-1',
    created_at: '2026-06-10T00:00:00Z',
    updated_at: '2026-06-10T00:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// Cards — JavaScript Fundamentals
// ---------------------------------------------------------------------------

export const SEED_CARDS: Card[] = [
  {
    id: 'card-js-1',
    deck_id: 'deck-js-1',
    card_type: 'basic',
    front_content: `<p>What is the difference between declaring a variable with <code>let</code> vs <code>const</code>?</p>`,
    back_content: `<ul>
      <li>Using <strong><code>let</code></strong> will allow you to reassign the variable later</li>
      <li>Using <strong><code>const</code></strong> means constant — you cannot reassign the variable later</li>
    </ul>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 1,
    created_at: '2026-05-01T00:00:00Z',
  },
  {
    id: 'card-js-2',
    deck_id: 'deck-js-1',
    card_type: 'basic',
    front_content: `<p>What are the data types in JavaScript?</p>`,
    back_content: `<ul>
      <li>Strings</li>
      <li>Numbers</li>
      <li>Arrays</li>
      <li>Objects</li>
      <li>Booleans</li>
      <li>Null</li>
      <li>Undefined</li>
    </ul>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 2,
    created_at: '2026-05-01T00:00:00Z',
  },
  {
    id: 'card-js-3',
    deck_id: 'deck-js-1',
    card_type: 'basic',
    front_content: `<p>How can you tell what data type a variable is?</p>`,
    back_content: `<ol>
      <li>Look at the syntax of the value (i.e., strings use quotes, arrays use <code>[]</code>, objects use <code>{}</code>, etc.)</li>
      <li>Use <code>typeof</code> and <code>console.log()</code>!</li>
    </ol>
    <pre><code>// declare a variable
let isLoggedIn = true;

console.log(typeof(isLoggedIn));
// console should show: "boolean"</code></pre>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 3,
    created_at: '2026-05-01T00:00:00Z',
  },
  {
    id: 'card-js-4',
    deck_id: 'deck-js-1',
    card_type: 'basic',
    front_content: `<p>How do you store an HTML element into a JavaScript variable?</p>`,
    back_content: `<ul>
      <li>Use <code>document.querySelector()</code> to access the element</li>
      <li>Save it into a variable</li>
    </ul>
    <pre><code class="language-html">&lt;!-- HTML file with the element --&gt;
&lt;p class="welcome"&gt;Welcome, Customer!&lt;/p&gt;</code></pre>
    <pre><code class="language-js">// JavaScript file

// save the element into a variable
const greeting = document.querySelector(".welcome-text");</code></pre>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 4,
    created_at: '2026-05-01T00:00:00Z',
  },
  {
    id: 'card-js-5',
    deck_id: 'deck-js-1',
    card_type: 'basic',
    front_content: `<p>What are DOM methods?</p>`,
    back_content: `<p>DOM methods are JavaScript functions that let you find, add, change, or remove elements on the page.</p>
    <pre><code>document.querySelector(".card"); // finds an element
document.createElement("div");   // creates a new element
element.classList.remove("hidden"); // removes a class from an element</code></pre>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 5,
    created_at: '2026-05-01T00:00:00Z',
  },
  {
    id: 'card-js-6',
    deck_id: 'deck-js-1',
    card_type: 'basic',
    front_content: `<p>How do you call a function?</p>`,
    back_content: `<p>You call a function by writing its name followed by parentheses.</p>
    <pre><code>sayHello();</code></pre>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 6,
    created_at: '2026-05-01T00:00:00Z',
  },

  // -------------------------------------------------------------------------
  // Cards — CSS Fundamentals
  // -------------------------------------------------------------------------

  {
    id: 'card-css-1',
    deck_id: 'deck-css-1',
    card_type: 'basic',
    front_content: `<p>What is a selector?</p>`,
    back_content: `<p>A CSS selector lets you select the element you want to apply a style on.</p>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 1,
    created_at: '2026-05-10T00:00:00Z',
  },
  {
    id: 'card-css-2',
    deck_id: 'deck-css-1',
    card_type: 'basic',
    front_content: `<p>What is a property?</p>`,
    back_content: `<p>A CSS property defines which type of style is being set on an element. For example, <code>color</code>, <code>font-weight</code>, and <code>border</code>.</p>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 2,
    created_at: '2026-05-10T00:00:00Z',
  },
  {
    id: 'card-css-3',
    deck_id: 'deck-css-1',
    card_type: 'basic',
    front_content: `<p>What is a value?</p>`,
    back_content: `<p>A CSS value is assigned to a CSS property.</p>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 3,
    created_at: '2026-05-10T00:00:00Z',
  },
  {
    id: 'card-css-4',
    deck_id: 'deck-css-1',
    card_type: 'basic',
    front_content: `<p>What is a declaration?</p>`,
    back_content: `<p>A CSS declaration consists of a property/value pair.</p>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 4,
    created_at: '2026-05-10T00:00:00Z',
  },
  {
    id: 'card-css-5',
    deck_id: 'deck-css-1',
    card_type: 'basic',
    front_content: `<p>What is a declaration block?</p>`,
    back_content: `<p>A CSS declaration block is everything inside the curly braces. It is a block of declarations.</p>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 5,
    created_at: '2026-05-10T00:00:00Z',
  },
  {
    id: 'card-css-6',
    deck_id: 'deck-css-1',
    card_type: 'basic',
    front_content: `<p>What is a rule?</p>`,
    back_content: `<p>A CSS rule is the whole thing — the selector and the declaration block.</p>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 6,
    created_at: '2026-05-10T00:00:00Z',
  },
  {
    id: 'card-css-7',
    deck_id: 'deck-css-1',
    card_type: 'basic',
    front_content: `<p>What are some commonly used CSS selectors?</p>`,
    back_content: `<ul>
      <li>
        <strong>Type Selectors</strong> — select elements based on the type of element
        <pre><code class="language-css">/* all &lt;p&gt; elements */
p {
  color: #ffffff;
}</code></pre>
      </li>
      <li>
        <strong>Class Selectors</strong> — select elements based on their class
        <pre><code class="language-css">/* all elements with class="card" */
.card {
  color: #ffffff;
}</code></pre>
      </li>
      <li>
        <strong>Descendant Selectors</strong> — select a descendant of an element
        <pre><code class="language-css">/* any &lt;ul&gt; that is a descendant of a &lt;nav&gt; */
nav ul {
  list-style-type: none;
}

/* any &lt;h2&gt; inside an element with class="card" */
.card h2 {
  list-style-type: none;
}</code></pre>
      </li>
    </ul>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 7,
    created_at: '2026-05-10T00:00:00Z',
  },
  {
    id: 'card-css-8',
    deck_id: 'deck-css-1',
    card_type: 'basic',
    front_content: `<p>What are CSS variables?</p>`,
    back_content: `<p>CSS variables are reusable values you define once with a name like <code>--my-color: blue</code> and then reference anywhere in your stylesheet with <code>var(--my-color)</code>, making it easy to keep your styles consistent and update them in one place.</p>
    <pre><code class="language-css">/* create the variables */
:root {
  --white: #ffffff;
  --black: #000000;
}

/* use the variable as a value */
body {
  color: var(--white);
  background-color: var(--black);
}</code></pre>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 8,
    created_at: '2026-05-10T00:00:00Z',
  },
  {
    id: 'card-css-9',
    deck_id: 'deck-css-1',
    card_type: 'basic',
    front_content: `<p>How do you declare a CSS variable?</p>`,
    back_content: `<pre><code class="language-css">/* create the variable */
:root {
  --white: #ffffff;
}</code></pre>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 9,
    created_at: '2026-05-10T00:00:00Z',
  },
  {
    id: 'card-css-10',
    deck_id: 'deck-css-1',
    card_type: 'basic',
    front_content: `<p>How do you use a CSS variable?</p>`,
    back_content: `<pre><code class="language-css">/* use the variable as a value */
body {
  color: var(--white);
}</code></pre>`,
    audio_url: null,
    image_url: null,
    occlusion_zones: null,
    order: 10,
    created_at: '2026-05-10T00:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// Card Progress — simulates a user mid-way through studying both decks
// ---------------------------------------------------------------------------

export const SEED_CARD_PROGRESS: CardProgress[] = [
  // JavaScript deck — mix of all three states
  { id: 'cp-1', user_id: SEED_USER_ID, card_id: 'card-js-1', state: 'review',      interval: 7,  easiness_factor: 2.6, due_date: '2026-06-08', last_reviewed_at: '2026-06-01T10:00:00Z' },
  { id: 'cp-2', user_id: SEED_USER_ID, card_id: 'card-js-2', state: 'review',      interval: 4,  easiness_factor: 2.5, due_date: '2026-06-06', last_reviewed_at: '2026-06-02T10:00:00Z' },
  { id: 'cp-3', user_id: SEED_USER_ID, card_id: 'card-js-3', state: 'in_progress', interval: 1,  easiness_factor: 2.3, due_date: '2026-06-05', last_reviewed_at: '2026-06-04T10:00:00Z' },
  { id: 'cp-4', user_id: SEED_USER_ID, card_id: 'card-js-4', state: 'in_progress', interval: 1,  easiness_factor: 2.5, due_date: '2026-06-05', last_reviewed_at: '2026-06-04T14:00:00Z' },
  // card-js-5 and card-js-6 are new (no progress entry = never studied)

  // CSS deck — mostly new, a couple in progress
  { id: 'cp-5', user_id: SEED_USER_ID, card_id: 'card-css-1', state: 'in_progress', interval: 1, easiness_factor: 2.5, due_date: '2026-06-05', last_reviewed_at: '2026-06-04T09:00:00Z' },
  { id: 'cp-6', user_id: SEED_USER_ID, card_id: 'card-css-2', state: 'in_progress', interval: 1, easiness_factor: 2.5, due_date: '2026-06-05', last_reviewed_at: '2026-06-04T09:05:00Z' },
  // card-css-3 through card-css-10 are new (no progress entry = never studied)
]

// ---------------------------------------------------------------------------
// Cards — HTML Essentials (imported deck)
// ---------------------------------------------------------------------------

// These cards are appended to SEED_CARDS via push to avoid rewriting the const declaration
;(function () {
  const htmlCards: Card[] = [
    {
      id: 'card-html-1',
      deck_id: 'deck-html-1',
      card_type: 'basic',
      front_content: `<p>What is the difference between a <code>block</code> element and an <code>inline</code> element?</p>`,
      back_content: `<ul><li><strong>Block</strong> elements start on a new line and take full width (e.g. <code>div</code>, <code>p</code>, <code>h1</code>)</li><li><strong>Inline</strong> elements flow within text and only take up as much width as needed (e.g. <code>span</code>, <code>a</code>, <code>strong</code>)</li></ul>`,
      audio_url: null,
      image_url: null,
      occlusion_zones: null,
      order: 1,
      created_at: '2026-06-10T00:00:00Z',
    },
    {
      id: 'card-html-2',
      deck_id: 'deck-html-1',
      card_type: 'basic',
      front_content: `<p>What does <code>semantic HTML</code> mean and why does it matter?</p>`,
      back_content: `<p>Semantic HTML uses elements that describe their meaning (e.g. <code>header</code>, <code>nav</code>, <code>main</code>, <code>article</code>) rather than generic <code>div</code> and <code>span</code>. It improves accessibility, SEO, and code readability.</p>`,
      audio_url: null,
      image_url: null,
      occlusion_zones: null,
      order: 2,
      created_at: '2026-06-10T00:00:00Z',
    },
    {
      id: 'card-html-3',
      deck_id: 'deck-html-1',
      card_type: 'type_in',
      front_content: `<p>What HTML attribute makes a form field required before submission?</p>`,
      back_content: `<p><code>required</code></p>`,
      audio_url: null,
      image_url: null,
      occlusion_zones: null,
      order: 3,
      created_at: '2026-06-10T00:00:00Z',
    },
  ]
  SEED_CARDS.push(...htmlCards)
})()

// ---------------------------------------------------------------------------
// Activity log — seed data for the GitHub-style activity grid
// ---------------------------------------------------------------------------

export const SEED_ACTIVITY_LOG = [
  { user_id: SEED_USER_ID, date: '2026-05-20', cards_studied_count: 8 },
  { user_id: SEED_USER_ID, date: '2026-05-21', cards_studied_count: 12 },
  { user_id: SEED_USER_ID, date: '2026-05-23', cards_studied_count: 5 },
  { user_id: SEED_USER_ID, date: '2026-05-26', cards_studied_count: 10 },
  { user_id: SEED_USER_ID, date: '2026-05-27', cards_studied_count: 15 },
  { user_id: SEED_USER_ID, date: '2026-05-28', cards_studied_count: 7 },
  { user_id: SEED_USER_ID, date: '2026-05-29', cards_studied_count: 20 },
  { user_id: SEED_USER_ID, date: '2026-06-02', cards_studied_count: 6 },
  { user_id: SEED_USER_ID, date: '2026-06-03', cards_studied_count: 11 },
  { user_id: SEED_USER_ID, date: '2026-06-04', cards_studied_count: 9 },
]

// ---------------------------------------------------------------------------
// Helper — compute card counts per deck for the home screen
// ---------------------------------------------------------------------------

export function getDeckWithCounts(deck: Deck): DeckWithCounts {
  const deckCards = SEED_CARDS.filter(c => c.deck_id === deck.id)
  const cardIds = new Set(deckCards.map(c => c.id))

  const progressEntries = SEED_CARD_PROGRESS.filter(
    p => p.user_id === SEED_USER_ID && cardIds.has(p.card_id)
  )

  const studiedCardIds = new Set(progressEntries.map(p => p.card_id))
  const newCount = deckCards.filter(c => !studiedCardIds.has(c.id)).length
  const inProgressCount = progressEntries.filter(p => p.state === 'in_progress').length
  const reviewCount = progressEntries.filter(p => p.state === 'review').length

  return {
    ...deck,
    card_count: deckCards.length,
    new_count: newCount,
    in_progress_count: inProgressCount,
    review_count: reviewCount,
  }
}

export function getAllDecksWithCounts(): DeckWithCounts[] {
  return SEED_DECKS.map(getDeckWithCounts)
}

export function getDeckByShareToken(token: string): Deck | undefined {
  return SEED_DECKS.find(d => d.share_token === token)
}
