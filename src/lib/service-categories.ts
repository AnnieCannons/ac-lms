/**
 * Predefined service categories for partner organizations.
 * Used in the partner form, filter bar, and auto-tag script.
 */

export const SERVICE_CATEGORIES = [
  'Case Management',
  'Childcare / Family Support',
  'Domestic Violence Services',
  'Financial Assistance',
  'Financial Literacy',
  'Food / Basic Needs',
  'Healthcare',
  'Housing',
  'Immigration Services',
  'Job Training / Employment',
  'Leadership Development',
  'Legal Aid',
  'Mental Health / Counseling',
  'Other',
  'Peer Support / Group Support',
  'Substance Use Recovery',
  'Youth Services',
] as const

export type ServiceCategory = typeof SERVICE_CATEGORIES[number]

/** Keywords used to auto-tag partners from free-text fields */
export const CATEGORY_KEYWORDS: Record<ServiceCategory, string[]> = {
  'Case Management': [
    'case management', 'case manager', 'care coordination', 'wraparound', 'service coordination',
  ],
  'Leadership Development': [
    'leadership', 'leadership development', 'mentoring', 'coaching', 'professional development',
    'civic engagement', 'advocacy training',
  ],
  'Other': [],
  'Peer Support / Group Support': [
    'peer support', 'group support', 'support group', 'peer mentor', 'community support',
    'mutual aid', 'peer-led',
  ],
  'Housing': [
    'housing', 'shelter', 'homeless', 'transitional housing', 'home', 'rapid rehousing',
    'affordable housing', 'eviction', 'residential', 'housing program', 'housing options',
  ],
  'Childcare / Family Support': [
    'childcare', 'child care', 'family', 'parenting', 'children', 'foster', 'kids',
    'parent', 'reunification', 'family services', 'family support',
  ],
  'Mental Health / Counseling': [
    'mental health', 'counseling', 'counselling', 'therapy', 'therapist', 'psychological',
    'trauma', 'behavioral health', 'wellness', 'psychiatric', 'ptsd',
  ],
  'Legal Aid': [
    'legal', 'attorney', 'lawyer', 'law ', 'justice', 'court', 'rights', 'legal aid',
    'legal services', 'public defender', 'criminal record', 'expungement',
  ],
  'Job Training / Employment': [
    'job', 'employment', 'workforce', 'career', 'training', 'vocational', 'work readiness',
    'apprenticeship', 'internship', 'job placement', 'job training', 'economic empowerment',
  ],
  'Substance Use Recovery': [
    'substance', 'recovery', 'addiction', 'alcohol', 'drug', 'sobriety', 'rehab',
    'detox', 'substance use', 'substance abuse', 'clean slate',
  ],
  'Domestic Violence Services': [
    'domestic violence', ' dv ', 'abuse', 'survivor', 'intimate partner', 'safety planning',
    'battered', 'violence against', 'sexual assault', 'sexual violence', 'trafficking',
    'exploitation', 'human trafficking',
  ],
  'Youth Services': [
    'youth', 'young adult', 'teen', 'adolescent', 'tay', 'transitional age youth',
    'age 16', 'age 18', 'age 24', 'young people', 'foster youth',
  ],
  'Immigration Services': [
    'immigration', 'immigrant', 'undocumented', 'visa', 'citizenship', 'refugee',
    'asylum', 'daca', 'deportation', 'immigration services',
  ],
  'Food / Basic Needs': [
    'food', 'nutrition', 'basic needs', 'food pantry', 'meals', 'hunger', 'groceries',
    'clothing', 'hygiene', 'supplies', 'diaper',
  ],
  'Healthcare': [
    'health', 'medical', 'clinic', 'hospital', 'primary care', 'healthcare',
    'calim', 'medi-cal', 'medicaid', 'reproductive', 'ob/gyn', 'dental', 'vision',
  ],
  'Financial Assistance': [
    'financial assistance', 'benefits', 'cash assistance', 'emergency funds',
    'rental assistance', 'utility', 'stipend', 'compensation', 'calaim',
  ],
  'Financial Literacy': [
    'financial literacy', 'financial education', 'budgeting', 'credit', 'money management',
    'banking', 'savings', 'debt', 'financial skills', 'financial coaching',
  ],
}
