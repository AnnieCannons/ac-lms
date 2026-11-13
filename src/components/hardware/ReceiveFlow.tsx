'use client'

import { useRouter } from 'next/navigation'
import type { HardwareDevice } from '@/lib/hardware'
import ReceiveForm from './ReceiveForm'

/**
 * The Mark received page's form. After saving it moves to a URL that carries what was
 * received, so the page itself shows the confirmation (and a reload doesn't lose it).
 */
export default function ReceiveFlow({ studentId, devices }: { studentId: string; devices: HardwareDevice[] }) {
  const router = useRouter()
  return (
    <ReceiveForm
      bare
      devices={devices}
      onSuccess={(ids, status) => {
        router.replace(`/instructor/hardware/receive?student=${studentId}&done=${ids.join(',')}&next=${status}`)
        router.refresh()
      }}
    />
  )
}
