type Props = {
  label: string
  value: number // normalised 0-1
  detail?: string // e.g. "8.5 / 28"
}

export function StatBar({ label, value, detail }: Props) {
  const pct = Math.round(value * 100)
  const color =
    value >= 0.75 ? 'bg-emerald-500' : value >= 0.5 ? 'bg-amber-400' : 'bg-red-500'
  const glow =
    value >= 0.75 ? 'shadow-[0_0_8px_rgba(52,211,153,0.5)]' : ''

  return (
    <div className="flex items-center gap-3">
      <span className="w-24 sm:w-36 text-xs text-gray-500 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-2.5 bg-white/8 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color} ${glow}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {detail
        ? <span className="w-20 text-xs text-gray-400 text-right font-data tabular-nums truncate">{detail}</span>
        : <span className="w-8 text-xs text-gray-500 text-right font-data tabular-nums">{pct}</span>
      }
    </div>
  )
}
