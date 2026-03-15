'use client'
import ReactMarkdown from 'react-markdown'

// Strip HTML tags (from Canvas-synced body text)
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function MarkdownContent({ content }: { content: string }) {
  const isHtml = content.includes('<') && content.includes('>')
  if (isHtml) {
    const text = stripHtml(content)
    try {
      new URL(text)
      return <a href={text} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-primary underline break-all">{text}</a>
    } catch {
      return <p className="text-sm text-dark-text whitespace-pre-wrap break-words">{text}</p>
    }
  }
  return (
    <div className="prose prose-sm max-w-none text-dark-text [&_a]:text-teal-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_li]:mb-0.5 [&_strong]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-text [&_code]:bg-surface [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-surface [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
