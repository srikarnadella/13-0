import { StatBar } from './StatBar'
import type { SimResult as SimResultType, GameState, TeamStats } from '../lib/types'
import { STAT_LABELS } from '../lib/simulate'

type Props = {
  result: SimResultType
  state: GameState
  onPlayAgain: () => void
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 9H4a2 2 0 0 1-2-2V5h4" />
      <path d="M18 9h2a2 2 0 0 0 2-2V5h-4" />
      <path d="M6 3h12v7a6 6 0 0 1-12 0V3Z" />
      <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
      <path d="M8 21h8" />
    </svg>
  )
}

const PHASE_LABELS: Record<string, string> = {
  'Group stage': 'Groups',
  'Round of 16': 'R16',
  'Quarters & Semis': 'QF/SF',
  'Final': 'Final',
}

export function SimResult({ result, state, onPlayAgain }: Props) {
  const { totalWins, totalLosses, strengthRating, normalisedStats, phases, weaknesses } = result
  const isPerfect = totalWins === 13
  const ratingPct = Math.round(strengthRating * 100)

  function handleShare() {
    const players = state.positionSlots.map(s => s.player).filter(Boolean)
    const lines = [
      `I went ${totalWins}–${totalLosses} in the UCL with my all-time XI`,
      ...players.map(p => `${p!.positionLabel}: ${p!.name} (${p!.era})`),
    ]
    navigator.clipboard.writeText(lines.join('\n'))
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-8 fade-up">

      {/* Record hero */}
      <div className="text-center flex flex-col items-center gap-3">
        {isPerfect && (
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <TrophyIcon className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-widest">Perfect campaign</span>
            <TrophyIcon className="w-5 h-5" />
          </div>
        )}
        <div className={`flex items-baseline gap-3 ${isPerfect ? 'glow-emerald rounded-2xl px-6 py-2' : ''}`}>
          <span className={`font-display text-8xl leading-none tracking-tight ${isPerfect ? 'text-emerald-400' : 'text-white'}`}>
            {totalWins}
          </span>
          <span className={`font-display text-5xl leading-none ${isPerfect ? 'text-emerald-600' : 'text-gray-600'}`}>–</span>
          <span className={`font-display text-8xl leading-none tracking-tight ${isPerfect ? 'text-emerald-600' : 'text-gray-400'}`}>
            {totalLosses}
          </span>
        </div>
        <div className="text-gray-500 text-sm">
          {isPerfect ? '13 wins from 13 UCL games' : `${totalWins} wins from 13 UCL games`}
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/8 border border-white/10">
          <span className="text-xs text-gray-500">Team strength</span>
          <span className="font-data text-sm font-semibold text-white tabular-nums">{ratingPct}/100</span>
        </div>
      </div>

      {/* Phase breakdown */}
      <div className="grid grid-cols-4 gap-2">
        {phases.map(({ phase, games, wins }) => {
          const perfect = wins === games
          const partial = wins > 0 && !perfect
          return (
            <div
              key={phase}
              className={`rounded-2xl border p-4 text-center transition-colors ${
                perfect
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : partial
                    ? 'border-amber-500/25 bg-amber-500/8'
                    : 'border-red-500/25 bg-red-500/8'
              }`}
            >
              <div className={`font-display text-2xl ${perfect ? 'text-emerald-400' : partial ? 'text-amber-400' : 'text-red-400'}`}>
                {wins}/{games}
              </div>
              <div className="text-xs text-gray-600 mt-1 leading-tight">
                {PHASE_LABELS[phase] ?? phase}
              </div>
            </div>
          )
        })}
      </div>

      {/* Stat breakdown */}
      <div className="flex flex-col gap-3 px-1">
        <div className="text-xs text-gray-600 uppercase tracking-widest mb-1">Performance</div>
        {(Object.keys(STAT_LABELS) as Array<keyof TeamStats>).map(stat => (
          <StatBar key={stat} label={STAT_LABELS[stat]} value={normalisedStats[stat]} />
        ))}
      </div>

      {/* Weaknesses */}
      {weaknesses.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-gray-600 uppercase tracking-widest">Weaknesses</div>
          {weaknesses.map(w => (
            <div key={w.stat} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span className="text-sm text-red-300">{w.label}</span>
              <span className="ml-auto text-xs text-red-500 font-data tabular-nums">{Math.round(w.normalisedScore * 100)}/100</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-sm text-emerald-400">No weaknesses detected</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pb-8">
        <button
          onClick={onPlayAgain}
          className="flex-1 py-3.5 rounded-xl bg-white/8 hover:bg-white/14 active:scale-[0.98] text-white font-semibold transition-all duration-150 border border-white/10"
        >
          Play again
        </button>
        <button
          onClick={handleShare}
          className="flex-1 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-bold transition-all duration-150"
        >
          Copy to clipboard
        </button>
      </div>
    </div>
  )
}
