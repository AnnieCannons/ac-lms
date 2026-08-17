const AVATAR_PALETTE = [
  'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200',
  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
]

const SIZE_CLASSES = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-16 h-16 text-lg',
} as const

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function avatarClasses(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

export default function UserAvatar({
  name,
  avatarUrl,
  size = 'md',
  className = '',
}: {
  name?: string | null
  avatarUrl?: string | null
  size?: keyof typeof SIZE_CLASSES
  className?: string
}) {
  const displayName = name || '?'
  const sizeCls = SIZE_CLASSES[size]

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={`shrink-0 rounded-full object-cover ${sizeCls} ${className}`}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={`shrink-0 rounded-full flex items-center justify-center font-bold ${sizeCls} ${avatarClasses(displayName)} ${className}`}
    >
      {initials(displayName)}
    </span>
  )
}
