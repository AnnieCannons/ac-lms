import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('next/dynamic', () => ({ default: () => ({ html }: { html?: string }) => <span>{html}</span> }))
const submitQuiz = vi.fn()
vi.mock('@/app/student/courses/[id]/quizzes/[quizId]/actions', () => ({ submitQuiz: (fd: FormData) => submitQuiz(fd) }))

import QuizForm from '@/app/student/courses/[id]/quizzes/[quizId]/QuizForm'

beforeEach(() => {
  submitQuiz.mockReset()
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))
})

describe('QuizForm submit', () => {
  it('sends one submission however many times Submit is clicked', async () => {
    let finish!: () => void
    submitQuiz.mockReturnValue(new Promise<void>(r => { finish = r })) // still saving
    render(
      <QuizForm
        courseId="c1"
        quizId="q1"
        attemptCount={2}
        questions={[{ ident: 'q', question_text: 'Pick one', choices: [{ ident: 'a', text: 'A' }] }]}
      />,
    )
    fireEvent.click(screen.getByRole('radio'))
    const button = screen.getByRole('button', { name: 'Submit quiz' })
    await act(async () => {
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)
    })
    expect(submitQuiz).toHaveBeenCalledTimes(1)
    expect((submitQuiz.mock.calls[0][0] as FormData).get('attemptCount')).toBe('2')
    expect(await screen.findByRole('button', { name: 'Submitting…' })).toBeDisabled()
    await act(async () => finish())
  })

  it('lets the student try again if the submission comes back with an error', async () => {
    submitQuiz.mockResolvedValue({ error: 'Quiz submissions are paused while on leave.' })
    render(
      <QuizForm courseId="c1" quizId="q1" attemptCount={0}
        questions={[{ ident: 'q', question_text: 'Pick one', choices: [{ ident: 'a', text: 'A' }] }]} />,
    )
    fireEvent.click(screen.getByRole('radio'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit quiz' })) })
    expect(submitQuiz).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: 'Submit quiz' })).not.toBeDisabled()
  })
})
