import { isConfidenceRatingsEnabled } from '@/lib/feature-flags'
import { SkillConfidenceNavProvider } from '@/components/ui/SkillConfidenceNavContext'

// Read per request, never baked in at build time, so flipping the flag needs no rebuild.
export const dynamic = 'force-dynamic'

// Deliberately does no auth: every student page already verifies its own caller.
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <SkillConfidenceNavProvider enabled={isConfidenceRatingsEnabled()}>{children}</SkillConfidenceNavProvider>
}
