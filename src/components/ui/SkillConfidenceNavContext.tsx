'use client'
import { createContext, useContext } from 'react'

// The Skill Confidence feature flag is server-only, but StudentTopNav is a client component
// rendered by ~20 pages. The student layout reads the flag on the server and passes it down
// through this context, so no call site needs a new prop.
const SkillConfidenceNavContext = createContext(false)

export function SkillConfidenceNavProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <SkillConfidenceNavContext.Provider value={enabled}>{children}</SkillConfidenceNavContext.Provider>
}

export function useSkillConfidenceNavEnabled() {
  return useContext(SkillConfidenceNavContext)
}
