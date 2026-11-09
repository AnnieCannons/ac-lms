'use client'

import { useState } from 'react'
import SalesPipelineBoard from '@/components/ui/SalesPipelineBoard'
import InvestorFirmsPanel from '@/components/ui/InvestorFirmsPanel'
import {
  updateSalesDeal, updateInvestorFirm,
  type SalesDealUpdate, type InvestorFirmUpdate,
} from '@/lib/partner-sales-actions'
import { isClosedStage, todayIso, type PipelineDeal, type InvestorFirm } from '@/lib/sales-pipeline'

export type PipelineTab = 'pipeline' | 'firms'

const TABS: { id: PipelineTab; label: string }[] = [
  { id: 'pipeline', label: 'Apprenticeship Pipeline' },
  { id: 'firms', label: 'VC & PE Firms' },
]

export default function SalesPipelineView({ initialDeals, initialFirms, initialTab }: {
  initialDeals: PipelineDeal[]
  initialFirms: InvestorFirm[]
  initialTab: PipelineTab
}) {
  const [tab, setTab] = useState<PipelineTab>(initialTab)
  const [deals, setDeals] = useState(initialDeals)
  const [firms, setFirms] = useState(initialFirms)

  function selectTab(next: PipelineTab) {
    setTab(next)
    const url = new URL(window.location.href)
    if (next === 'pipeline') url.searchParams.delete('tab')
    else url.searchParams.set('tab', next)
    window.history.replaceState(null, '', url)
  }

  async function saveDeal(partnerId: string, requested: SalesDealUpdate): Promise<string | null> {
    const current = deals.find(d => d.partnerId === partnerId)
    if (!current) return 'Partner not found'

    const update: SalesDealUpdate = { ...requested }
    const today = todayIso()
    // Historical deals keep only the dates they were given, so they never pick up today's date here.
    const historical = current.isHistorical || update.isHistorical === true
    // Otherwise, a deal with no entry date has never been saved, so this save puts it in the pipeline.
    if (!historical && !current.startedOn && update.startedOn === undefined) update.startedOn = today
    if (!historical && update.stage && isClosedStage(update.stage) && !isClosedStage(current.stage) && update.closedOn === undefined) {
      update.closedOn = today
    }

    const previous = deals
    setDeals(ds => ds.map(d => {
      if (d.partnerId !== partnerId) return d
      const next = { ...d, ...update }
      if (update.introducedByPartnerId === null) next.introducedOn = null
      if (!isClosedStage(next.stage)) next.closedOn = null
      return next
    }))
    const result = await updateSalesDeal(partnerId, update)
    if (result.error) {
      setDeals(previous)
      return result.error
    }
    return null
  }

  async function saveFirm(partnerId: string, update: InvestorFirmUpdate): Promise<string | null> {
    const previous = firms
    setFirms(fs => fs.map(f => f.partnerId === partnerId ? { ...f, ...update } : f))
    const result = await updateInvestorFirm(partnerId, update)
    if (result.error) {
      setFirms(previous)
      return result.error
    }
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Sales pipeline views" className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`pipeline-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`pipeline-panel-${t.id}`}
            onClick={() => selectTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-teal-primary text-teal-primary'
                : 'border-transparent text-muted-text hover:text-dark-text'
            }`}
          >
            {t.label}
            <span className="ml-2 text-xs text-muted-text">{t.id === 'pipeline' ? deals.length : firms.length}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`pipeline-panel-${tab}`} aria-labelledby={`pipeline-tab-${tab}`}>
        {tab === 'pipeline' ? (
          <SalesPipelineBoard deals={deals} firms={firms} onSaveDeal={saveDeal} />
        ) : (
          <InvestorFirmsPanel firms={firms} deals={deals} onSaveFirm={saveFirm} onSaveDeal={saveDeal} />
        )}
      </div>
    </div>
  )
}
