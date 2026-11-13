'use client'
import dynamic from 'next/dynamic'

// The form reads the browser's timezone to show and enter the start time, so it never
// renders on the server.
const CuttingEdgeEventFormLoader = dynamic(() => import('./CuttingEdgeEventForm'), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-text">Loading…</p>,
})

export default CuttingEdgeEventFormLoader
