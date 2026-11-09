import Link from 'next/link'
import { getSalesPipelineData } from '@/lib/partner-sales-actions'
import SalesPipelineView from '@/components/ui/SalesPipelineView'

export default async function SalesPipelinePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const { error, deals, firms, targets } = await getSalesPipelineData()

  return (
    <main className="px-6 py-10">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Sales Pipeline</h1>
          <p className="text-sm text-muted-text mt-1">
            Track hiring partners from first contact to placing and converting apprentices, and the VC and PE firms introducing them.
          </p>
        </div>
        <Link
          href="/instructor/partnerships/new"
          className="px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors"
        >
          + Add Partner
        </Link>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-700">Couldn&apos;t load the pipeline: {error}</p>
      ) : (
        <SalesPipelineView initialDeals={deals} initialFirms={firms} initialTargets={targets} initialTab={tab === 'firms' ? 'firms' : 'pipeline'} />
      )}
    </main>
  )
}
