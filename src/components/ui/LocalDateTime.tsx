'use client'

export default function LocalDateTime({ iso, options }: {
  iso: string
  options?: Intl.DateTimeFormatOptions
}) {
  const opts: Intl.DateTimeFormatOptions = options ?? {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }
  return <>{new Date(iso).toLocaleDateString('en-US', opts)}</>
}
