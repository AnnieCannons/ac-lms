// The learning platforms shown as cards on Level Up Your Skills. The card itself (name,
// main link, blurb) lives here; the specific recommended courses under each card are
// rows in level_up_links, edited by staff from the instructor Level Up page.

// Card order on the student page
export const LEVEL_UP_PLATFORM_IDS = ['codecademy', 'udemy', 'pluralsight', 'masterdev', 'freecodecamp', 'other'] as const
export type LevelUpPlatform = typeof LEVEL_UP_PLATFORM_IDS[number]

export type LevelUpPlatformInfo = {
  name: string
  /** Where the card's main button goes; null for "other" (only its listed links) */
  url: string | null
  description: string
  /** Students have a paid/pro account through AnnieCannons */
  proAccount: boolean
  /** Short monogram for the card icon */
  mark: string
}

export const LEVEL_UP_PLATFORMS: Record<LevelUpPlatform, LevelUpPlatformInfo> = {
  udemy: {
    name: 'Udemy',
    url: 'https://anniecannons.udemy.com/organization/home/',
    description: 'Video courses on almost any tech topic, through the AnnieCannons Udemy account.',
    proAccount: true,
    mark: 'U',
  },
  pluralsight: {
    name: 'Pluralsight',
    url: 'https://app.pluralsight.com/id?redirectTo=https://app.pluralsight.com/plan-analytics/pa-anniecannons-inc-e8664',
    description: 'Skill assessments, learning paths and video courses, through the AnnieCannons Pluralsight plan.',
    proAccount: true,
    mark: 'PS',
  },
  masterdev: {
    name: 'master.dev',
    url: 'https://master.dev/',
    description: 'In-depth courses on JavaScript, frontend and full-stack development.',
    proAccount: true,
    mark: 'M',
  },
  codecademy: {
    name: 'Codecademy',
    url: 'https://www.codecademy.com/catalog',
    description: 'Interactive lessons where you write code right in the browser.',
    proAccount: false,
    mark: 'C',
  },
  freecodecamp: {
    name: 'freeCodeCamp',
    url: 'https://www.freecodecamp.org/learn',
    description: 'Free, project-based curriculum with certifications.',
    proAccount: false,
    mark: 'fCC',
  },
  other: {
    name: 'More recommended courses',
    url: null,
    description: 'Other courses and tutorials your instructors recommend.',
    proAccount: false,
    mark: '+',
  },
}

export function isLevelUpPlatform(value: unknown): value is LevelUpPlatform {
  return typeof value === 'string' && (LEVEL_UP_PLATFORM_IDS as readonly string[]).includes(value)
}
