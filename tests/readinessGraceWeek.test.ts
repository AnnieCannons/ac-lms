import { describe, it, expect } from 'vitest'
import { graceWeekMessage } from '@/lib/readiness'
import { ESCALATION_EVENT_LABEL } from '@/components/ui/ReadinessWidgets'

describe('step 1 grace week', () => {
  it('tells the channel the score improved and what happens next', () => {
    const text = graceWeekMessage('Amirah', 'red', 3, 'yellow')
    expect(text).toContain("Amirah's readiness score went up from red to yellow (3/5)")
    expect(text).toContain('stay in step 1 for another week')
    expect(text).toContain('Two green weeks in a row will close out the process')
    expect(text).toContain("otherwise they'll move to step 2")
  })

  it('escapes Slack control characters in the name', () => {
    expect(graceWeekMessage('<!channel>', 'red', 2, 'yellow')).not.toContain('<!channel>')
  })

  it('has a history label', () => {
    expect(ESCALATION_EVENT_LABEL.step1_grace).toBeTruthy()
  })
})
