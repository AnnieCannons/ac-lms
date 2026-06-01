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

export const DEPARTMENT_STAGES: Record<PartnerDepartment, string[]> = {
  student_success: ['Prospect', 'Active', 'Inactive'],
  career_development: ['Prospect', 'In Conversation', 'Active Mentorship', 'Active Apprenticeship', 'Alumni', 'Inactive'],
  resourcefull: ['Prospect', 'Outreach Sent', 'In Conversation', 'Onboarding Scheduled', 'Signed Up', 'Inactive'],
  funding_partnerships: ['Prospect', 'In Conversation', 'Committed', 'Received', 'Lapsed'],
  admissions: ['Prospect', 'Outreach Sent', 'In Conversation', 'Active Referral Partner', 'Inactive'],
}
