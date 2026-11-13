/** A card with its title and an optional action on one aligned header row. */
export default function Card({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="bg-surface rounded-2xl border border-border">
      <div className="flex flex-wrap items-center justify-between gap-x-4 px-5 py-3 border-b border-border">
        <h2 className="text-sm font-bold text-dark-text">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}
