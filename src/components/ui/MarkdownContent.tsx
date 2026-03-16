'use client'
import ReactMarkdown from 'react-markdown'
import HtmlContent from './HtmlContent'

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

const HTML_CLASSES = `text-sm text-dark-text leading-relaxed
  [&_a]:text-teal-primary [&_a]:underline
  [&_p]:mb-2 [&_p:last-child]:mb-0
  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2
  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2
  [&_li]:mb-0.5
  [&_strong]:font-semibold`

export default function MarkdownContent({ content }: { content: string }) {
  const isHtml = /<[a-z][\s\S]*>/i.test(content)
  if (isHtml) {
    return <HtmlContent html={content} className={HTML_CLASSES} />
  }
  const decoded = decodeEntities(content)
  return (
    <div className="prose prose-sm max-w-none text-dark-text [&_a]:text-teal-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_li]:mb-0.5 [&_strong]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-text [&_code]:bg-surface [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-surface [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto">
      <ReactMarkdown>{decoded}</ReactMarkdown>
    </div>
  )
}
