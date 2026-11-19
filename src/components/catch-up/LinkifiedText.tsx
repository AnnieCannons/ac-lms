// Plain text with http(s) URLs turned into links (students paste lecture recording links).
// Rendered as React text nodes, so nothing in it is treated as HTML.
const URL_RE = /(https?:\/\/[^\s<>"]+)/g

export default function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(URL_RE)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-teal-primary underline break-all">{part}</a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}
