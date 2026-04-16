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

/** Renders plain-text submission content: preserves newlines and auto-links URLs. */
export function PlainTextContent({ content }: { content: string }) {
  const urlRegex = /https?:\/\/[^\s]+/g
  const parts: { type: 'text' | 'url'; value: string }[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = urlRegex.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    parts.push({ type: 'url', value: match[0] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) parts.push({ type: 'text', value: content.slice(lastIndex) })
  return (
    <p className="text-sm text-dark-text whitespace-pre-wrap break-all">
      {parts.map((part, i) =>
        part.type === 'url' ? (
          <a key={i} href={part.value} target="_blank" rel="noopener noreferrer" className="text-teal-primary underline">
            {part.value}
          </a>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </p>
  )
}

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
