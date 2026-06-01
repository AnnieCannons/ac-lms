'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'

// react-simple-maps uses browser APIs — must be loaded client-side only
const PartnerMap = dynamic(() => import('@/components/ui/PartnerMap'), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-border bg-surface h-96 flex items-center justify-center text-sm text-muted-text">
      Loading map…
    </div>
  ),
})

type Props = ComponentProps<typeof PartnerMap>

export default function PartnerMapWrapper(props: Props) {
  return <PartnerMap {...props} />
}
