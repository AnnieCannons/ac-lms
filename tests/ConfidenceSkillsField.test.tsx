import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import ConfidenceSkillsField from '@/components/ui/ConfidenceSkillsField'
import type { ConfidenceSkill } from '@/lib/skill-actions'
import * as skillActions from '@/lib/skill-actions'

vi.mock('@/lib/skill-actions', () => ({
  listSkills: vi.fn(),
  createSkill: vi.fn(),
  renameSkill: vi.fn(),
}))

const EXISTING_SKILLS: ConfidenceSkill[] = [
  { id: '1', name: 'JavaScript' },
  { id: '2', name: 'React' },
]

function Harness({ initial = [] as ConfidenceSkill[] }) {
  const [value, setValue] = useState<ConfidenceSkill[]>(initial)
  return <ConfidenceSkillsField value={value} onChange={setValue} />
}

beforeEach(() => {
  vi.mocked(skillActions.listSkills).mockResolvedValue({ error: null, skills: EXISTING_SKILLS })
})

describe('ConfidenceSkillsField', () => {
  it('filters suggestions case-insensitively as the instructor types', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = await screen.findByPlaceholderText('Type to search or create a skill…')
    await user.type(input, 'java')
    expect(await screen.findByText('JavaScript')).toBeInTheDocument()
    expect(screen.queryByText('React')).not.toBeInTheDocument()
  })

  it('selecting an existing suggestion adds it as a tag without creating a duplicate', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = await screen.findByPlaceholderText('Type to search or create a skill…')
    await user.type(input, 'React')
    const suggestion = await screen.findByText('React')
    await user.click(suggestion)
    expect(skillActions.createSkill).not.toHaveBeenCalled()
    expect(await screen.findByLabelText('Remove React')).toBeInTheDocument()
  })

  it('pressing Enter on unmatched text creates a new skill and adds it as a tag', async () => {
    const newSkill: ConfidenceSkill = { id: '3', name: 'GraphQL' }
    vi.mocked(skillActions.createSkill).mockResolvedValue({ error: null, skill: newSkill })
    const user = userEvent.setup()
    render(<Harness />)
    const input = await screen.findByPlaceholderText('Type to search or create a skill…')
    await user.type(input, 'GraphQL{Enter}')
    await waitFor(() => expect(skillActions.createSkill).toHaveBeenCalledWith('GraphQL'))
    expect(await screen.findByLabelText('Remove GraphQL')).toBeInTheDocument()
  })

  it('removing a tag does not call createSkill or renameSkill', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[EXISTING_SKILLS[0]]} />)
    const removeButton = await screen.findByLabelText('Remove JavaScript')
    await user.click(removeButton)
    expect(screen.queryByLabelText('Remove JavaScript')).not.toBeInTheDocument()
    expect(skillActions.createSkill).not.toHaveBeenCalled()
    expect(skillActions.renameSkill).not.toHaveBeenCalled()
  })

  it('renaming an already-tagged skill updates the displayed name', async () => {
    vi.mocked(skillActions.renameSkill).mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<Harness initial={[EXISTING_SKILLS[0]]} />)
    const renameButton = await screen.findByLabelText('Rename JavaScript')
    await user.click(renameButton)
    const renameInput = screen.getByDisplayValue('JavaScript')
    await user.clear(renameInput)
    await user.type(renameInput, 'JS (ES2024){Enter}')
    await waitFor(() => expect(skillActions.renameSkill).toHaveBeenCalledWith('1', 'JS (ES2024)'))
    expect(await screen.findByText('JS (ES2024)')).toBeInTheDocument()
  })

  it('offers a rename affordance on a suggestion while still searching, before it is selected', async () => {
    vi.mocked(skillActions.renameSkill).mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<Harness />)
    const input = await screen.findByPlaceholderText('Type to search or create a skill…')
    await user.type(input, 'java')
    const renameButton = await screen.findByLabelText('Rename JavaScript')
    await user.click(renameButton)
    const renameInput = screen.getByDisplayValue('JavaScript')
    await user.clear(renameInput)
    await user.type(renameInput, 'JS (ES2024){Enter}')
    await waitFor(() => expect(skillActions.renameSkill).toHaveBeenCalledWith('1', 'JS (ES2024)'))
    // Renaming from the dropdown must not select/tag the skill onto this assignment.
    expect(skillActions.createSkill).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Remove JS (ES2024)')).not.toBeInTheDocument()
  })
})
