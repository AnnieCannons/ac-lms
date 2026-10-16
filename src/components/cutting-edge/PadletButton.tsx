export default function PadletButton({ url, label }: { url: string | null; label: string }) {
  if (!url) return <p className="text-sm text-muted-text">The Padlet link will be posted here soon.</p>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-block bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 transition-opacity">
      {label} ↗
    </a>
  )
}
