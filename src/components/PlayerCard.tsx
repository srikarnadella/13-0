import type { Player } from '../lib/types'

type Props = {
  player: Player
  selected: boolean
  mode: 'classic' | 'scoutiq'
  onClick: () => void
}

const STAT_LABELS = [
  { key: 'goalsPerSeason' as const,      label: 'G/SZN' },
  { key: 'assistsPerSeason' as const,    label: 'AST' },
  { key: 'cleanSheetPct' as const,       label: 'CS%' },
  { key: 'savePct' as const,             label: 'SV%' },
  { key: 'defActionsPerSeason' as const, label: 'DEF' },
]

export function PlayerCard({ player, selected, mode, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left rounded-xl border p-4 transition-all cursor-pointer
        ${selected
          ? 'border-emerald-400 bg-emerald-400/10 shadow-lg shadow-emerald-500/10'
          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
        }
      `}
    >
      <div className="mb-3">
        <div className="font-semibold text-white text-sm leading-tight">{player.name}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {player.positionLabel} · {player.club}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{player.era}</div>
      </div>

      <div className="grid grid-cols-5 gap-1">
        {STAT_LABELS.map(({ key, label }) => (
          <div key={key} className="text-center">
            <div className="text-xs text-gray-500 mb-0.5">{label}</div>
            <div
              className={`text-xs font-mono font-semibold text-white ${
                mode === 'scoutiq' ? 'blur-sm select-none' : ''
              }`}
            >
              {(key === 'cleanSheetPct' || key === 'savePct')
                ? `${player.stats[key].toFixed(1)}%`
                : player.stats[key].toFixed(1)}
            </div>
          </div>
        ))}
      </div>
    </button>
  )
}
