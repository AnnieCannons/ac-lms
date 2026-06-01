export type PartnerDepartment =
  | 'student_success'
  | 'career_development'
  | 'resourcefull'
  | 'funding_partnerships'
  | 'admissions'

export const DEPARTMENT_LABELS: Record<PartnerDepartment, string> = {
  student_success: 'Student Success',
  career_development: 'Career Development',
  resourcefull: 'ResourceFull',
  funding_partnerships: 'Funding Partnerships',
  admissions: 'Admissions',
}

export const DEPT_COLORS: Record<PartnerDepartment, string> = {
  student_success:      'bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700/40',
  career_development:   'bg-teal-100 text-teal-800 border border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700/40',
  resourcefull:         'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/40',
  funding_partnerships: 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700/40',
  admissions:           'bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700/40',
}

export const DEPARTMENT_STAGES: Record<PartnerDepartment, string[]> = {
  student_success: ['Prospect', 'Active', 'Inactive'],
  career_development: ['Prospect', 'In Conversation', 'Active Mentorship', 'Active Apprenticeship', 'Alumni', 'Inactive'],
  resourcefull: ['Prospect', 'Outreach Sent', 'In Conversation', 'Onboarding Scheduled', 'Signed Up', 'Inactive'],
  funding_partnerships: ['Prospect', 'In Conversation', 'Committed', 'Received', 'Lapsed'],
  admissions: ['Prospect', 'Outreach Sent', 'In Conversation', 'Active Referral Partner', 'Inactive'],
}
