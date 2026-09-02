'use client'
import DOMPurify from 'isomorphic-dompurify'

const PROSE = 'prose prose-sm max-w-none [&_code]:bg-border/40 [&_code]:px-1 [&_code]:rounded [&_code]:text-dark-text [&_pre]:bg-border/30 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre_code]:bg-transparent [&_ul]:pl-4 [&_ol]:pl-4'

export default function CardContent({ html }: { html: string }) {
  return (
    <div
      className={PROSE}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  )
}
