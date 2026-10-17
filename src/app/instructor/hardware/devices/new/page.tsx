import { getHardwareViewer } from '@/lib/hardware-access'
import { emptyDeviceInput } from '@/lib/hardware'
import HardwareShell from '@/components/hardware/HardwareShell'
import DeviceForm from '@/components/hardware/DeviceForm'

export default async function NewDevicePage() {
  const viewer = await getHardwareViewer({ manage: true })
  return (
    <HardwareShell viewer={viewer} active="devices" breadcrumbs={[{ label: 'Hardware', href: '/instructor/hardware' }, { label: 'Add one device' }]}>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Add one device</h1>
      <p className="text-sm text-muted-text mb-6">For several of the same model, use Add a purchase instead.</p>
      <DeviceForm deviceId={null} initial={emptyDeviceInput()} />
    </HardwareShell>
  )
}
