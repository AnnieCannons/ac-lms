'use client'
import DOMPurify from 'isomorphic-dompurify'

// Same as the study page (StudyPageClient): quiz-html gives inline code the editor's
// look, and prose's added backticks are turned off.
const PROSE = 'prose prose-sm max-w-none quiz-html [&_code]:font-normal [&_code]:before:content-none [&_code]:after:content-none [&_pre]:bg-zinc-900 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre_code]:bg-transparent [&_pre_code]:text-white [&_ul]:pl-4 [&_ol]:pl-4 [&_blockquote]:border-l-2 [&_blockquote]:border-teal-primary [&_blockquote]:pl-3 [&_blockquote]:text-dark-text [&_blockquote]:not-italic'

export default function CardContent({ html }: { html: string }) {
  return (
    <div
      className={PROSE}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  )
}
