import { StatBar } from './StatBar'
import type { GameState, TeamStats } from '../lib/types'
import { simulate, BENCHMARKS, STAT_LABELS, projectWins } from '../lib/simulate'

type Props = {
  state: GameState
  onSimulate: () => void
}

function fmtStat(key: keyof TeamStats, val: number): string {
  if (key === 'savePct') return `${val.toFixed(1)}%`
  return val.toFixed(2)
}

export function TeamSheet({ state, onSimulate }: Props) {
  const { positionSlots, formation } = state
  const filledPlayers = positionSlots.filter(s => s.player !== null).map(s => s.player!)

  const simResult = filledPlayers.length > 0 ? simulate(filledPlayers) : null
  const liveStats = simResult?.normalisedStats ?? null
  const teamStats = simResult?.teamStats ?? null
  const projectedWins = simResult ? projectWins(simResult.strengthRating) : null

  // Group slots by position line for pitch display
  const gk = positionSlots.slice(0, 1)
  const defs = formation ? positionSlots.slice(1, 1 + formation.defenders) : []
  const mids = formation ? positionSlots.slice(1 + formation.defenders, 1 + formation.defenders + formation.midfielders) : []
  const fwds = formation ? positionSlots.slice(1 + formation.defenders + formation.midfielders) : []

  function renderSlot(slot: typeof positionSlots[0], i: number) {
    const filled = slot.player !== null
    return (
      <div key={i} className="flex flex-col items-center gap-1">
        <div className={`
          w-14 h-14 rounded-full border-2 flex items-center justify-center text-xs font-semibold
          ${filled
            ? 'border-emerald-400 bg-emerald-400/20 text-emerald-300'
            : 'border-dashed border-white/20 text-gray-600'
          }
        `}>
          {filled
            ? slot.player!.name.split(' ').map(n => n[0]).join('').slice(0, 3)
            : slot.positionLabel
          }
        </div>
        {filled && (
          <div className="text-xs text-gray-400 text-center max-w-16 leading-tight truncate">
            {slot.player!.name.split(' ').at(-1)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      <div className="text-sm text-gray-400 text-center">Your XI is complete</div>

      {/* Pitch */}
      <div className="rounded-2xl bg-emerald-950/30 border border-emerald-900/30 p-6 flex flex-col gap-6">
        <div className="flex justify-center gap-4">{fwds.map((s, i) => renderSlot(s, i))}</div>
        <div className="flex justify-center gap-4">{mids.map((s, i) => renderSlot(s, i))}</div>
        <div className="flex justify-center gap-4">{defs.map((s, i) => renderSlot(s, i))}</div>
        <div className="flex justify-center">{gk.map((s, i) => renderSlot(s, i))}</div>
      </div>

      {/* Live stat bars */}
      {liveStats && teamStats && (
        <div className="flex flex-col gap-3 px-2">
          {projectedWins !== null && (
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-xs text-gray-500 uppercase tracking-widest">Projected</span>
              <span className="font-display text-xl text-white">{projectedWins}–{13 - projectedWins}</span>
            </div>
          )}
          {(Object.keys(STAT_LABELS) as Array<keyof TeamStats>).map(stat => (
            <StatBar
              key={stat}
              label={STAT_LABELS[stat]}
              value={liveStats[stat]}
              detail={`${fmtStat(stat, teamStats[stat])} / ${fmtStat(stat, BENCHMARKS[stat])}`}
            />
          ))}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onSimulate}
        className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-black font-bold transition-all duration-150 text-lg"
      >
        Simulate campaign →
      </button>
    </div>
  )
}
