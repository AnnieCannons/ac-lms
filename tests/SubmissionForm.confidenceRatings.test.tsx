import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format, addDays } from 'date-fns'
import SubmissionForm from '@/components/ui/SubmissionForm'
import type { ConfidenceSkillWithStatus } from '@/lib/confidence-tracker-actions'
import * as submissionActions from '@/lib/submission-actions'
import * as confidenceTrackerActions from '@/lib/confidence-tracker-actions'
import * as goalMetActions from '@/lib/goal-met-actions'

vi.mock('@/lib/submission-actions', () => ({
  saveSubmission: vi.fn(),
}))

// Keep every real export (STUDY_PLAN_OPTIONS, validators, etc. — ConfidenceRatingPrompt
// needs the real STUDY_PLAN_OPTIONS to render its <select>) and only replace the one
// function this test suite needs to observe/control.
vi.mock('@/lib/confidence-tracker-actions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/confidence-tracker-actions')>(
    '@/lib/confidence-tracker-actions'
  )
  return { ...actual, saveConfidenceRatings: vi.fn() }
})

// The celebration's "what helped" and next-goal steps call these; observe them, don't hit a database.
vi.mock('@/lib/goal-met-actions', () => ({ answerWhatHelped: vi.fn(), setSkillGoal: vi.fn() }))

// Unrelated to this feature — stub it out so these tests stay focused.
vi.mock('@/components/ui/SubmissionComments', () => ({
  default: () => null,
}))

const SKILLS: ConfidenceSkillWithStatus[] = [
  { id: 'skill-a', name: 'React', isNew: false, canSetGoal: false, isMaintaining: false },
  { id: 'skill-b', name: 'Testing', isNew: false, canSetGoal: false, isMaintaining: false },
]

const NEW_SKILL: ConfidenceSkillWithStatus[] = [{ id: 'skill-a', name: 'React', isNew: true, canSetGoal: true, isMaintaining: false }]

// A skill the student has rated before (no "New" tag) but skipped goal-setting on that
// occasion — goal-setting must still be offered on a later assignment.
const SKIPPED_GOAL_SKILL: ConfidenceSkillWithStatus[] = [
  { id: 'skill-a', name: 'React', isNew: false, canSetGoal: true, isMaintaining: false },
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

const DEFAULT_TARGET_DATE = format(addDays(new Date(), 7), 'yyyy-MM-dd')

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

  it('lets Student Preview rate skills and set goals like a student, but Submit stays disabled and nothing is ever saved', async () => {
    const user = userEvent.setup()
    renderForm({ confidenceSkills: NEW_SKILL, isStudentPreview: true })
    const group = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
    // the rating buttons are interactive...
    within(group).getAllByRole('radio').forEach(r => expect(r).toBeEnabled())
    await user.click(within(group).getByRole('radio', { name: '6' }))
    expect(within(group).getByRole('radio', { name: '6' })).toHaveAttribute('aria-checked', 'true')
    // ...and so is goal setting (suggested goal 8, with its target date and study plan)
    const goalGroup = screen.getByRole('radiogroup', { name: 'Goal for React' })
    expect(within(goalGroup).getByRole('radio', { name: 'Goal 8' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('checkbox', { name: 'Study flashcards' }))

    // ...but the banner says so, Submit is disabled, and nothing reaches the server
    expect(screen.getByText('Assignment submission is disabled in Student View.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
    expect(submissionActions.saveSubmission).not.toHaveBeenCalled()
    expect(confidenceTrackerActions.saveConfidenceRatings).not.toHaveBeenCalled()
  })

  it('does not save anything from Student Preview even if a save is forced through', async () => {
    const user = userEvent.setup()
    renderForm({ isStudentPreview: true })
    await user.type(await screen.findByPlaceholderText('https://github.com/your-username/your-repo'), 'https://github.com/example/repo')
    const group = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
    await user.click(within(group).getByRole('radio', { name: '9' }))
    // Save draft is not disabled in preview, so this exercises the same guard a forced Submit would hit.
    await user.click(screen.getByRole('button', { name: /save draft/i }))
    expect(submissionActions.saveSubmission).not.toHaveBeenCalled()
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
    expect(await screen.findByText(/couldn't save your confidence rating/i)).toBeInTheDocument()
    // The submission itself still succeeded — the form should reflect that, not a submission error.
    expect(await screen.findByText('Turned in')).toBeInTheDocument()
  })

  describe('incremental kudos', () => {
    async function rateReactAndSubmit() {
      const user = userEvent.setup()
      renderForm()
      const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '6' }))
      await submitLink(user)
      return user
    }

    it('shows the change beside "Turned in" when the action reports an increase, and it can be dismissed', async () => {
      vi.mocked(confidenceTrackerActions.saveConfidenceRatings).mockResolvedValue({
        error: null,
        kudos: [{ skillId: 'skill-a', from: 4, to: 6 }],
      })
      const user = await rateReactAndSubmit()
      expect(await screen.findByText(/Your confidence in React went up from 4 to 6/)).toBeInTheDocument()
      expect(await screen.findByText('Turned in')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /dismiss progress message/i }))
      expect(screen.queryByText(/went up from/)).not.toBeInTheDocument()
    })

    it('shows nothing when no kudos are returned', async () => {
      vi.mocked(confidenceTrackerActions.saveConfidenceRatings).mockResolvedValue({ error: null, kudos: [] })
      await rateReactAndSubmit()
      expect(await screen.findByText('Turned in')).toBeInTheDocument()
      expect(screen.queryByText(/went up from/)).not.toBeInTheDocument()
    })

    it('shows the rating error and no kudos when the rating save fails', async () => {
      vi.mocked(confidenceTrackerActions.saveConfidenceRatings).mockResolvedValue({
        error: 'network error',
        kudos: [{ skillId: 'skill-a', from: 4, to: 6 }],
      })
      await rateReactAndSubmit()
      expect(await screen.findByText(/couldn't save your confidence rating/i)).toBeInTheDocument()
      expect(screen.queryByText(/went up from/)).not.toBeInTheDocument()
    })

    it('never shows kudos in Student Preview', async () => {
      renderForm({ isStudentPreview: true })
      await screen.findByText('React')
      expect(screen.queryByText(/went up from/)).not.toBeInTheDocument()
    })
  })

  describe('goal-met and 10 celebrations', () => {
    const GOAL_MET = {
      skillId: 'skill-a',
      rating: 7,
      kind: 'goal' as const,
      goal: { outcomeId: 'outcome-1', target: 7, ownPlanText: null, nextGoalAllowed: false },
    }

    async function rateReactAndSubmit() {
      const user = userEvent.setup()
      renderForm()
      const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '7' }))
      await submitLink(user)
      return user
    }

    it('shows the celebration and the "what helped" question beside "Turned in", in place of a kudos line for that skill', async () => {
      vi.mocked(confidenceTrackerActions.saveConfidenceRatings).mockResolvedValue({ error: null, kudos: [], celebrations: [GOAL_MET] })
      await rateReactAndSubmit()
      expect(await screen.findByText(/You reached your goal of 7 in React!/)).toBeInTheDocument()
      expect(screen.getByRole('group', { name: /What helped you reach your goal\?.*for React/ })).toBeInTheDocument()
      expect(await screen.findByText('Turned in')).toBeInTheDocument()
      expect(screen.queryByText(/went up from/)).not.toBeInTheDocument()
    })

    it('can be dismissed', async () => {
      vi.mocked(confidenceTrackerActions.saveConfidenceRatings).mockResolvedValue({ error: null, kudos: [], celebrations: [GOAL_MET] })
      const user = await rateReactAndSubmit()
      await user.click(await screen.findByRole('button', { name: /dismiss celebration/i }))
      expect(screen.queryByText(/You reached your goal/)).not.toBeInTheDocument()
    })

    it('celebrates a first-ever 10 without asking anything, and says the student is maintaining it', async () => {
      vi.mocked(confidenceTrackerActions.saveConfidenceRatings).mockResolvedValue({
        error: null, kudos: [], celebrations: [{ skillId: 'skill-a', rating: 10, kind: 'first' }],
      })
      await rateReactAndSubmit()
      expect(await screen.findByText(/You're at 10 in React!/)).toBeInTheDocument()
      expect(screen.getByText(/You're maintaining this rating/)).toBeInTheDocument()
      expect(screen.queryByRole('group', { name: /What helped/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    })

    it('celebrates a return to 10 and asks what helped', async () => {
      vi.mocked(confidenceTrackerActions.saveConfidenceRatings).mockResolvedValue({
        error: null, kudos: [], celebrations: [{
          skillId: 'skill-a', rating: 10, kind: 'returned',
          goal: { outcomeId: 'outcome-2', target: null, ownPlanText: null, nextGoalAllowed: false },
        }],
      })
      await rateReactAndSubmit()
      expect(await screen.findByText(/You're back at 10 in React!/)).toBeInTheDocument()
      expect(screen.getByText(/You're maintaining this rating/)).toBeInTheDocument()
      expect(screen.getByRole('group', { name: /What helped/ })).toBeInTheDocument()
    })

    it('saves the chosen options, scoped to the met goal, and thanks the student', async () => {
      vi.mocked(confidenceTrackerActions.saveConfidenceRatings).mockResolvedValue({ error: null, kudos: [], celebrations: [GOAL_MET] })
      vi.mocked(goalMetActions.answerWhatHelped).mockResolvedValue({ error: null })
      const user = await rateReactAndSubmit()
      await user.click(await screen.findByRole('checkbox', { name: 'Studying flashcards' }))
      await user.click(screen.getByRole('checkbox', { name: 'Reviewing class notes' }))
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(goalMetActions.answerWhatHelped).toHaveBeenCalledWith('outcome-1', ['flashcards', 'review_notes'], undefined))
      expect(await screen.findByText(/your answer is saved/)).toBeInTheDocument()
    })

    it('treats "Skip for now" like walking away: nothing saved, and it points to My Skill Confidence', async () => {
      vi.mocked(confidenceTrackerActions.saveConfidenceRatings).mockResolvedValue({ error: null, kudos: [], celebrations: [GOAL_MET] })
      const user = await rateReactAndSubmit()
      await user.click(await screen.findByRole('button', { name: 'Skip for now' }))
      expect(goalMetActions.answerWhatHelped).not.toHaveBeenCalled()
      expect(await screen.findByText(/any time from My Skill Confidence/)).toBeInTheDocument()
    })

    it('shows neither celebration nor kudos when the rating save failed', async () => {
      vi.mocked(confidenceTrackerActions.saveConfidenceRatings).mockResolvedValue({ error: 'network error', celebrations: [GOAL_MET] })
      await rateReactAndSubmit()
      expect(await screen.findByText(/couldn't save your confidence rating/i)).toBeInTheDocument()
      expect(screen.queryByText(/You reached your goal/)).not.toBeInTheDocument()
    })

    it('never shows a celebration in Student Preview', async () => {
      renderForm({ isStudentPreview: true })
      await screen.findByText('React')
      expect(screen.queryByText(/You reached your goal/)).not.toBeInTheDocument()
    })
  })

  describe('kudos card', () => {
    it('has no maintaining variant: a rise to 10 reported as kudos reads as a plain "went up from X to Y"', async () => {
      vi.mocked(confidenceTrackerActions.saveConfidenceRatings).mockResolvedValue({
        error: null, kudos: [{ skillId: 'skill-a', from: 6, to: 10 }], celebrations: [],
      })
      const user = userEvent.setup()
      renderForm({ confidenceSkills: NEW_SKILL })
      const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '10' }))
      expect(screen.queryByText(/Nice progress!/)).not.toBeInTheDocument()
      await submitLink(user)
      expect(await screen.findByText(/Your confidence in React went up from 6 to 10/)).toBeInTheDocument()
      expect(screen.queryByText(/maintaining/)).not.toBeInTheDocument()
      expect(screen.queryByText(/top of the scale/)).not.toBeInTheDocument()
    })

    it('shows nothing extra after submitting a 10 when the server reports no kudos or celebration', async () => {
      vi.mocked(confidenceTrackerActions.saveConfidenceRatings).mockResolvedValue({ error: null, kudos: [], celebrations: [] })
      const user = userEvent.setup()
      renderForm({ confidenceSkills: NEW_SKILL })
      const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '10' }))
      await submitLink(user)
      expect(await screen.findByText('Turned in')).toBeInTheDocument()
      expect(screen.queryByText(/Nice progress!/)).not.toBeInTheDocument()
      expect(screen.queryByText(/maintaining/)).not.toBeInTheDocument()
    })
  })

  describe('maintained skills', () => {
    const MAINTAINED: ConfidenceSkillWithStatus[] = [
      { id: 'skill-g', name: 'Git', isNew: false, canSetGoal: true, isMaintaining: true },
      { id: 'skill-a', name: 'React', isNew: false, canSetGoal: false, isMaintaining: false },
    ]
    const openDisclosure = (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByRole('button', { name: /Still feeling confident on/ }))

    it('shows the maintained skill collapsed, with no separate maintaining card', async () => {
      renderForm({ confidenceSkills: MAINTAINED })
      expect(await screen.findByRole('button', { name: /Still feeling confident on your maintaining skills/ })).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('radiogroup', { name: 'Confidence rating for Git' })).not.toBeInTheDocument()
      expect(screen.getByRole('radiogroup', { name: 'Confidence rating for React' })).toBeInTheDocument()
    })

    it('does not send an untouched maintained skill to saveConfidenceRatings', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: MAINTAINED })
      const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '4' }))
      await submitLink(user)
      await waitFor(() =>
        expect(confidenceTrackerActions.saveConfidenceRatings).toHaveBeenCalledWith('assignment-1', [{ skillId: 'skill-a', rating: 4 }])
      )
    })

    it('does not call saveConfidenceRatings at all when only maintained skills exist and none is touched', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: [MAINTAINED[0]] })
      await submitLink(user)
      await waitFor(() => expect(submissionActions.saveSubmission).toHaveBeenCalled())
      expect(confidenceTrackerActions.saveConfidenceRatings).not.toHaveBeenCalled()
    })

    it('sends a lower rating on a maintained skill, with its goal when chosen', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: [MAINTAINED[0]] })
      await openDisclosure(user)
      const gitGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for Git' })
      await user.click(within(gitGroup).getByRole('radio', { name: '6' }))
      const planGroup = screen.getByRole('group', { name: /How do you plan to work on this/ })
      await user.click(within(planGroup).getByRole('checkbox', { name: 'Study flashcards' }))
      await submitLink(user)
      await waitFor(() =>
        expect(confidenceTrackerActions.saveConfidenceRatings).toHaveBeenCalledWith('assignment-1', [
          { skillId: 'skill-g', rating: 6, goal: { goal: 8, targetDate: DEFAULT_TARGET_DATE, studyPlan: ['flashcards'], studyPlanOther: undefined } },
        ])
      )
    })

    it('blocks Submit until a goal started on a maintained skill has a study plan', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: [MAINTAINED[0]] })
      await user.type(await screen.findByPlaceholderText('https://github.com/your-username/your-repo'), 'https://github.com/example/repo')
      await openDisclosure(user)
      const gitGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for Git' })
      await user.click(within(gitGroup).getByRole('radio', { name: '6' }))
      expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
    })

    it('sends a lower rating without a goal when the goal is skipped', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: [MAINTAINED[0]] })
      await openDisclosure(user)
      const gitGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for Git' })
      await user.click(within(gitGroup).getByRole('radio', { name: '6' }))
      await user.click(screen.getByRole('button', { name: 'Skip' }))
      await submitLink(user)
      await waitFor(() =>
        expect(confidenceTrackerActions.saveConfidenceRatings).toHaveBeenCalledWith('assignment-1', [{ skillId: 'skill-g', rating: 6 }])
      )
    })

    it('sends an explicit 10 on a maintained skill, with no goal and no study plan needed', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: [MAINTAINED[0]] })
      await openDisclosure(user)
      const gitGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for Git' })
      await user.click(within(gitGroup).getByRole('radio', { name: '10, current rating' }))
      expect(screen.queryByRole('group', { name: /How do you plan to work on this/ })).not.toBeInTheDocument()
      await submitLink(user)
      await waitFor(() =>
        expect(confidenceTrackerActions.saveConfidenceRatings).toHaveBeenCalledWith('assignment-1', [{ skillId: 'skill-g', rating: 10 }])
      )
    })

    it('does not save a rating on a maintained skill from a Draft', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: [MAINTAINED[0]] })
      await openDisclosure(user)
      const gitGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for Git' })
      await user.click(within(gitGroup).getByRole('radio', { name: '6' }))
      await user.type(await screen.findByPlaceholderText('https://github.com/your-username/your-repo'), 'https://github.com/example/repo')
      await user.click(screen.getByRole('button', { name: 'Save draft' }))
      await waitFor(() => expect(submissionActions.saveSubmission).toHaveBeenCalled())
      expect(confidenceTrackerActions.saveConfidenceRatings).not.toHaveBeenCalled()
    })

    it('Student Preview can try a maintained skill but nothing is saved; an Observer cannot change it', async () => {
      const user = userEvent.setup()
      const { unmount } = renderForm({ confidenceSkills: [MAINTAINED[0]], isStudentPreview: true })
      await openDisclosure(user)
      const gitGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for Git' })
      await user.click(within(gitGroup).getByRole('radio', { name: '6' }))
      expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
      expect(confidenceTrackerActions.saveConfidenceRatings).not.toHaveBeenCalled()
      unmount()
      // The preview's rating was kept for in-app navigation; start the observer from a clean slate.
      sessionStorage.clear()

      renderForm({ confidenceSkills: [MAINTAINED[0]], isObserver: true })
      await openDisclosure(user)
      const observed = await screen.findByRole('radiogroup', { name: 'Confidence rating for Git' })
      within(observed).getAllByRole('radio').forEach(r => expect(r).toBeDisabled())
    })
  })

  describe('new-skill goal capture', () => {
    it('shows a "New" tag for a skill the student has never rated before', async () => {
      renderForm({ confidenceSkills: NEW_SKILL })
      expect(await screen.findByText('React')).toHaveTextContent('New')
    })

    it('still offers goal-setting on a later assignment for a skill previously rated but skipped, with no "New" tag', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: SKIPPED_GOAL_SKILL })
      expect(await screen.findByText('React')).not.toHaveTextContent('New')
      const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '5' }))
      const planGroup = screen.getByRole('group', { name: /How do you plan to work on this/ })
      await user.click(within(planGroup).getByRole('checkbox', { name: 'Study flashcards' }))
      await submitLink(user)
      await waitFor(() =>
        expect(confidenceTrackerActions.saveConfidenceRatings).toHaveBeenCalledWith('assignment-1', [
          expect.objectContaining({ skillId: 'skill-a', rating: 5, goal: expect.objectContaining({ goal: 7 }) }),
        ])
      )
    })

    it('disables Submit until a goal in progress has a study plan chosen, then re-enables it', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: NEW_SKILL })
      const input = await screen.findByPlaceholderText('https://github.com/your-username/your-repo')
      await user.type(input, 'https://github.com/example/repo')
      const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '5' }))

      expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
      expect(screen.getByText(/Finish setting your skill goal/)).toBeInTheDocument()

      const planGroup = screen.getByRole('group', { name: /How do you plan to work on this/ })
      await user.click(within(planGroup).getByRole('checkbox', { name: 'Study flashcards' }))
      expect(screen.getByRole('button', { name: 'Submit' })).not.toBeDisabled()
    })

    it('rating a new skill and completing its goal saves the rating and goal together', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: NEW_SKILL })
      const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '5' }))
      const planGroup = screen.getByRole('group', { name: /How do you plan to work on this/ })
      await user.click(within(planGroup).getByRole('checkbox', { name: 'Study flashcards' }))
      await submitLink(user)
      await waitFor(() =>
        expect(confidenceTrackerActions.saveConfidenceRatings).toHaveBeenCalledWith('assignment-1', [
          {
            skillId: 'skill-a',
            rating: 5,
            goal: {
              goal: 7,
              targetDate: DEFAULT_TARGET_DATE,
              studyPlan: ['flashcards'],
              studyPlanOther: undefined,
            },
          },
        ])
      )
    })

    it('lets a student choose more than one study plan for the same goal', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: NEW_SKILL })
      const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '5' }))
      const planGroup = screen.getByRole('group', { name: /How do you plan to work on this/ })
      await user.click(within(planGroup).getByRole('checkbox', { name: 'Study flashcards' }))
      await user.click(within(planGroup).getByRole('checkbox', { name: 'Get help from an Instructor or a TA' }))
      await submitLink(user)
      await waitFor(() =>
        expect(confidenceTrackerActions.saveConfidenceRatings).toHaveBeenCalledWith('assignment-1', [
          expect.objectContaining({
            skillId: 'skill-a',
            rating: 5,
            goal: expect.objectContaining({ studyPlan: ['flashcards', 'ta_help'] }),
          }),
        ])
      )
    })

    it('rating a new skill 10 saves just the rating, with no goal, target date or study plan needed', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: NEW_SKILL })
      const input = await screen.findByPlaceholderText('https://github.com/your-username/your-repo')
      await user.type(input, 'https://github.com/example/repo')
      const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '10' }))
      expect(screen.queryByRole('group', { name: /How do you plan to work on this/ })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Submit' })).not.toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      await waitFor(() =>
        expect(confidenceTrackerActions.saveConfidenceRatings).toHaveBeenCalledWith('assignment-1', [
          { skillId: 'skill-a', rating: 10 },
        ])
      )
    })

    it('clearing the goal before submit sends only the plain rating', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: NEW_SKILL })
      const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '5' }))
      await user.click(screen.getByRole('button', { name: 'Skip' }))
      await submitLink(user)
      await waitFor(() =>
        expect(confidenceTrackerActions.saveConfidenceRatings).toHaveBeenCalledWith('assignment-1', [
          { skillId: 'skill-a', rating: 5 },
        ])
      )
    })

    it('sends free-text "Other" study plan content when chosen', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: NEW_SKILL })
      const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '5' }))
      const planGroup = screen.getByRole('group', { name: /How do you plan to work on this/ })
      await user.click(within(planGroup).getByRole('checkbox', { name: 'Other' }))
      await user.type(screen.getByPlaceholderText('Describe your plan…'), 'Pairing with a friend')
      await submitLink(user)
      await waitFor(() =>
        expect(confidenceTrackerActions.saveConfidenceRatings).toHaveBeenCalledWith('assignment-1', [
          expect.objectContaining({
            skillId: 'skill-a',
            rating: 5,
            goal: expect.objectContaining({ studyPlan: ['other'], studyPlanOther: 'Pairing with a friend' }),
          }),
        ])
      )
    })

    it('does not persist abandoned "Other" text after deselecting it in favor of a different study plan', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: NEW_SKILL })
      const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '5' }))
      const planGroup = screen.getByRole('group', { name: /How do you plan to work on this/ })
      await user.click(within(planGroup).getByRole('checkbox', { name: 'Other' }))
      await user.type(screen.getByPlaceholderText('Describe your plan…'), 'abandoned text')
      await user.click(within(planGroup).getByRole('checkbox', { name: 'Other' }))
      await user.click(within(planGroup).getByRole('checkbox', { name: 'Study flashcards' }))
      await submitLink(user)
      await waitFor(() =>
        expect(confidenceTrackerActions.saveConfidenceRatings).toHaveBeenCalledWith('assignment-1', [
          expect.objectContaining({
            skillId: 'skill-a',
            rating: 5,
            goal: expect.objectContaining({ studyPlan: ['flashcards'], studyPlanOther: undefined }),
          }),
        ])
      )
    })

    it('saving a Draft with a new-skill rating and in-progress goal never saves either', async () => {
      const user = userEvent.setup()
      renderForm({ confidenceSkills: NEW_SKILL })
      const reactGroup = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '5' }))
      const input = await screen.findByPlaceholderText('https://github.com/your-username/your-repo')
      await user.type(input, 'https://github.com/example/repo')
      await user.click(screen.getByRole('button', { name: 'Save draft' }))
      await waitFor(() => expect(submissionActions.saveSubmission).toHaveBeenCalled())
      expect(confidenceTrackerActions.saveConfidenceRatings).not.toHaveBeenCalled()
    })

    it('Student Preview shows the "New" tag and lets you set a goal, but cannot save a rating or goal', async () => {
      renderForm({ confidenceSkills: NEW_SKILL, isStudentPreview: true })
      expect(await screen.findByText('React')).toHaveTextContent('New')
      expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
      expect(confidenceTrackerActions.saveConfidenceRatings).not.toHaveBeenCalled()
    })

    it('Observer cannot change ratings or goals at all', async () => {
      renderForm({ confidenceSkills: NEW_SKILL, isObserver: true })
      const group = await screen.findByRole('radiogroup', { name: 'Confidence rating for React' })
      within(group).getAllByRole('radio').forEach(r => expect(r).toBeDisabled())
    })

    it('Observer sees the "New" tag with no Submit control available to save it', async () => {
      renderForm({ confidenceSkills: NEW_SKILL, isObserver: true })
      expect(await screen.findByText('React')).toHaveTextContent('New')
      expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument()
      expect(confidenceTrackerActions.saveConfidenceRatings).not.toHaveBeenCalled()
    })
  })
})
