import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SubmissionForm from '@/components/ui/SubmissionForm'
import type { ConfidenceSkill } from '@/lib/skill-actions'
import * as submissionActions from '@/lib/submission-actions'
import * as confidenceTrackerActions from '@/lib/confidence-tracker-actions'

vi.mock('@/lib/submission-actions', () => ({
  saveSubmission: vi.fn(),
}))

vi.mock('@/lib/confidence-tracker-actions', () => ({
  saveConfidenceRatings: vi.fn(),
}))

// Unrelated to this feature — stub it out so these tests stay focused.
vi.mock('@/components/ui/SubmissionComments', () => ({
  default: () => null,
}))

const SKILLS: ConfidenceSkill[] = [
  { id: 'skill-a', name: 'React' },
  { id: 'skill-b', name: 'Testing' },
]

const BASE_PROPS = {
  assignmentId: 'assignment-1',
  studentId: 'student-1',
  courseId: 'course-1',
  existingSubmission: null,
  initialHistory: [],
  confidenceSkills: SKILLS,
  initialComments: [],
}

function renderForm(overrides: Partial<React.ComponentProps<typeof SubmissionForm>> = {}) {
  return render(<SubmissionForm {...BASE_PROPS} {...overrides} />)
}

async function submitLink(user: ReturnType<typeof userEvent.setup>, url = 'https://github.com/example/repo') {
  const input = await screen.findByPlaceholderText('https://github.com/your-username/your-repo')
  await user.type(input, url)
  await user.click(screen.getByRole('button', { name: 'Submit' }))
}

beforeEach(() => {
  sessionStorage.clear()
  vi.mocked(submissionActions.saveSubmission).mockResolvedValue({
    data: {
      id: 'submission-1',
      submission_type: 'link',
      content: 'https://github.com/example/repo',
      status: 'submitted',
      grade: null,
      graded_at: null,
      submitted_at: new Date().toISOString(),
      student_comment: null,
    },
    historyEntry: {
      id: 'history-1',
      submission_type: 'link',
      content: 'https://github.com/example/repo',
      submitted_at: new Date().toISOString(),
    },
  })
  vi.mocked(confidenceTrackerActions.saveConfidenceRatings).mockResolvedValue({ error: null })
})

describe('SubmissionForm confidence rating prompt', () => {
  it('shows no rating UI when the assignment has no tagged skills', async () => {
    renderForm({ confidenceSkills: [] })
    expect(screen.queryByText(/how confident do you feel/i)).not.toBeInTheDocument()
  })

  it('shows no rating UI once the student already has submission history for this assignment', async () => {
    renderForm({ initialHistory: [{ id: 'h1', submission_type: 'link', content: 'https://old.com', submitted_at: new Date().toISOString() }] })
    expect(screen.queryByText(/how confident do you feel/i)).not.toBeInTheDocument()
  })

  it('renders a 1–10 rating control per tagged skill, positioned before the Submit button, on a first visit', async () => {
    renderForm()
    expect(await screen.findByText('React')).toBeInTheDocument()
    expect(screen.getByText('Testing')).toBeInTheDocument()
    const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
    expect(within(reactGroup).getAllByRole('radio')).toHaveLength(10)

    const submitButton = screen.getByRole('button', { name: 'Submit' })
    expect(reactGroup.compareDocumentPosition(submitButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('rating one skill and leaving another blank saves only the rated skill', async () => {
    const user = userEvent.setup()
    renderForm()
    const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
    await user.click(within(reactGroup).getByRole('radio', { name: '7' }))
    await submitLink(user)
    await waitFor(() => expect(confidenceTrackerActions.saveConfidenceRatings).toHaveBeenCalledWith(
      'assignment-1',
      [{ skillId: 'skill-a', rating: 7 }]
    ))
  })

  it('clicking a selected rating again unselects it, so it is not saved on submit', async () => {
    const user = userEvent.setup()
    renderForm()
    const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
    const ratingSeven = within(reactGroup).getByRole('radio', { name: '7' })
    await user.click(ratingSeven)
    await user.click(ratingSeven)
    await submitLink(user)
    await waitFor(() => expect(submissionActions.saveSubmission).toHaveBeenCalled())
    expect(confidenceTrackerActions.saveConfidenceRatings).not.toHaveBeenCalled()
  })

  it('leaving every rating blank still submits the assignment, without saving any rating', async () => {
    const user = userEvent.setup()
    renderForm()
    await submitLink(user)
    await waitFor(() => expect(submissionActions.saveSubmission).toHaveBeenCalled())
    expect(confidenceTrackerActions.saveConfidenceRatings).not.toHaveBeenCalled()
  })

  it('saving a Draft with a rating entered never saves the rating', async () => {
    const user = userEvent.setup()
    renderForm()
    const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
    await user.click(within(reactGroup).getByRole('radio', { name: '5' }))
    const input = await screen.findByPlaceholderText('https://github.com/your-username/your-repo')
    await user.type(input, 'https://github.com/example/repo')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(submissionActions.saveSubmission).toHaveBeenCalledWith(
      expect.any(String), 'draft', expect.any(String), expect.any(String), expect.any(Object), expect.any(Object), expect.any(Object)
    ))
    expect(confidenceTrackerActions.saveConfidenceRatings).not.toHaveBeenCalled()
  })

  it('renders the rating prompt in Student Preview mode but never saves a rating from it', async () => {
    renderForm({ isStudentPreview: true })
    expect(await screen.findByText('React')).toBeInTheDocument()
    const submitButton = screen.getByRole('button', { name: 'Submit' })
    expect(submitButton).toBeDisabled()
    expect(confidenceTrackerActions.saveConfidenceRatings).not.toHaveBeenCalled()
  })

  it('renders the rating prompt to an Observer, with no Submit control available to them', async () => {
    renderForm({ isObserver: true })
    expect(await screen.findByText('React')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument()
    expect(confidenceTrackerActions.saveConfidenceRatings).not.toHaveBeenCalled()
  })

  it('shows a rating-specific error when the submission succeeds but the rating fails to save', async () => {
    vi.mocked(confidenceTrackerActions.saveConfidenceRatings).mockResolvedValue({ error: 'network error' })
    const user = userEvent.setup()
    renderForm()
    const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
    await user.click(within(reactGroup).getByRole('radio', { name: '9' }))
    await submitLink(user)
    expect(await screen.findByText(/couldn't save your confidence ratings/i)).toBeInTheDocument()
    // The submission itself still succeeded — the form should reflect that, not a submission error.
    expect(await screen.findByText('Turned in')).toBeInTheDocument()
  })
})
