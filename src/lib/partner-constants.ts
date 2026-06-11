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

export const STAGE_COLORS: Record<string, string> = {
  // ResourceFull
  'Identified for outreach':      'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700/40',
  'Invited to join':              'bg-teal-100 text-teal-800 border border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700/40',
  'Invited to rejoin':            'bg-cyan-100 text-cyan-800 border border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-700/40',
  'Coordinating/In Conversation': 'bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700/40',
  'Meeting Scheduled':            'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/40',
  'Sign up in progress':          'bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700/40',
  'Onboarded':                    'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700/40',
  'Seeking contact':              'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700/40',
  // Career Development
  'Prospect':                     'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700/40',
  'In Conversation':              'bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700/40',
  'Active Mentorship':            'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700/40',
  'Active Apprenticeship':        'bg-teal-100 text-teal-800 border border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700/40',
  'Alumni':                       'bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700/40',
  'Inactive':                     'bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700/40',
  // Funding Partnerships
  'Committed':                    'bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700/40',
  'Received':                     'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700/40',
  'Lapsed':                       'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700/40',
  'Outreach Sent':                'bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700/40',
}

export const DEPARTMENT_STAGES: Record<PartnerDepartment, string[]> = {
  student_success: [],
  career_development: ['Prospect', 'In Conversation', 'Active Mentorship', 'Active Apprenticeship', 'Alumni', 'Inactive'],
  resourcefull: ['Identified for outreach', 'Invited to join', 'Invited to rejoin', 'Coordinating/In Conversation', 'Meeting Scheduled', 'Sign up in progress', 'Onboarded', 'Seeking contact'],
  funding_partnerships: ['Prospect', 'In Conversation', 'Committed', 'Received', 'Lapsed'],
  admissions: [],
}
