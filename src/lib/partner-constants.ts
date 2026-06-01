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
  student_success:      'bg-purple-100 text-purple-800 border border-purple-200',
  career_development:   'bg-teal-100 text-teal-800 border border-teal-200',
  resourcefull:         'bg-blue-100 text-blue-800 border border-blue-200',
  funding_partnerships: 'bg-green-100 text-green-800 border border-green-200',
  admissions:           'bg-orange-100 text-orange-800 border border-orange-200',
}

export const DEPARTMENT_STAGES: Record<PartnerDepartment, string[]> = {
  student_success: ['Prospect', 'Active', 'Inactive'],
  career_development: ['Prospect', 'In Conversation', 'Active Mentorship', 'Active Apprenticeship', 'Alumni', 'Inactive'],
  resourcefull: ['Prospect', 'Outreach Sent', 'In Conversation', 'Onboarding Scheduled', 'Signed Up', 'Inactive'],
  funding_partnerships: ['Prospect', 'In Conversation', 'Committed', 'Received', 'Lapsed'],
  admissions: ['Prospect', 'Outreach Sent', 'In Conversation', 'Active Referral Partner', 'Inactive'],
}
