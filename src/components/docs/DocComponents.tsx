import { ReactNode } from 'react'

export function DocH2({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xl font-bold text-dark-text mt-10 mb-3 pb-2 border-b border-border">
      {children}
    </h2>
  )
}

export function DocH3({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-dark-text mt-6 mb-2">
      {children}
    </h3>
  )
}

export function DocP({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-dark-text leading-relaxed mb-3">
      {children}
    </p>
  )
}

export function DocList({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc pl-5 text-sm text-dark-text leading-relaxed mb-3 space-y-1.5">
      {children}
    </ul>
  )
}

export function DocOL({ children }: { children: ReactNode }) {
  return (
    <ol className="list-decimal pl-5 text-sm text-dark-text leading-relaxed mb-3 space-y-1.5">
      {children}
    </ol>
  )
}

export function DocTip({ children }: { children: ReactNode }) {
  return (
    <div className="bg-teal-light border-l-4 border-teal-primary rounded-r-lg px-4 py-3 mb-4">
      <p className="text-xs font-semibold text-teal-primary uppercase tracking-wide mb-1">Tip</p>
      <div className="text-sm text-dark-text leading-relaxed">{children}</div>
    </div>
  )
}

export function DocNote({ children }: { children: ReactNode }) {
  return (
    <div className="doc-note-callout border-l-4 border-amber-400 rounded-r-lg px-4 py-3 mb-4">
      <p className="doc-note-label text-xs font-semibold uppercase tracking-wide mb-1">Note</p>
      <div className="text-sm text-dark-text leading-relaxed">{children}</div>
    </div>
  )
}

export function DocStep({ number, children }: { number: number; children: ReactNode }) {
  return (
    <div className="flex gap-3 mb-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-primary text-white text-xs font-bold flex items-center justify-center mt-0.5">
        {number}
      </span>
      <div className="text-sm text-dark-text leading-relaxed">{children}</div>
    </div>
  )
}

export function DocCode({ children }: { children: ReactNode }) {
  return (
    <code className="bg-border/40 px-1.5 py-0.5 rounded text-xs font-mono text-dark-text">
      {children}
    </code>
  )
}
