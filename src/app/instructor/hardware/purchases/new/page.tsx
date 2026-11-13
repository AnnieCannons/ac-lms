import { getHardwareViewer } from '@/lib/hardware-access'
import HardwareShell from '@/components/hardware/HardwareShell'
import BatchForm from '@/components/hardware/BatchForm'

export default async function NewPurchasePage() {
  const viewer = await getHardwareViewer({ manage: true })
  return (
    <HardwareShell viewer={viewer} active="devices" breadcrumbs={[{ label: 'Hardware', href: '/instructor/hardware' }, { label: 'Add a purchase' }]}>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Add a purchase</h1>
      <p className="text-sm text-muted-text mb-6">Add a whole order at once, like 20 refurbished laptops of the same model and year.</p>
      <BatchForm />
    </HardwareShell>
  )
}
