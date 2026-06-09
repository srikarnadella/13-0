import { useEffect, useMemo, useState } from 'react'
import { SpinWheel } from './SpinWheel'
import { spinClubEra, rerollClub, rerollEra } from '../lib/draft'
import type { GameState, Player, Era, PositionType, TeamStats, PlayerStats } from '../lib/types'
import { simulate, BENCHMARKS, STAT_LABELS, projectWins } from '../lib/simulate'

type Props = {
  state: GameState
  onPick: (player: Player, slotIndex: number) => void
  onClubSkip: () => void
  onEraSkip: () => void
  onSpinResult: (club: string, era: Era, candidates: Player[]) => void
}

type RoundPhase = 'spin' | 'pick'

type ColDef = {
  key: keyof PlayerStats
  label: string
  tooltip: string
  isPercent?: boolean
}

// Each position tab shows only its relevant stats
const POS_COLS: Record<PositionType, ColDef[]> = {
  GK: [
    { key: 'savePct',             label: 'SV%',   tooltip: 'Save %',                            isPercent: true },
    { key: 'cleanSheetPct',       label: 'CS%',   tooltip: 'Clean sheet %',                     isPercent: true },
  ],
  DEF: [
    { key: 'defActionsPerSeason', label: 'DEF',   tooltip: 'Tackles + interceptions per season' },
    { key: 'goalsPerSeason',      label: 'G/SZN', tooltip: 'Goals per UCL season' },
    { key: 'assistsPerSeason',    label: 'AST',   tooltip: 'Assists per UCL season' },
  ],
  MID: [
    { key: 'goalsPerSeason',      label: 'G/SZN', tooltip: 'Goals per UCL season' },
    { key: 'assistsPerSeason',    label: 'AST',   tooltip: 'Assists per UCL season' },
    { key: 'defActionsPerSeason', label: 'DEF',   tooltip: 'Tackles + interceptions per season' },
  ],
  FWD: [
    { key: 'goalsPerSeason',      label: 'G/SZN', tooltip: 'Goals per UCL season' },
    { key: 'assistsPerSeason',    label: 'AST',   tooltip: 'Assists per UCL season' },
  ],
}

// Primary sort stat per position
const SORT_STAT: Record<PositionType, keyof PlayerStats> = {
  GK:  'savePct',
  DEF: 'defActionsPerSeason',
  MID: 'goalsPerSeason',
  FWD: 'goalsPerSeason',
}

const POS_TABS: PositionType[] = ['GK', 'DEF', 'MID', 'FWD']

const POS_COLOR: Record<PositionType, string> = {
  GK:  'text-yellow-400',
  DEF: 'text-blue-400',
  MID: 'text-green-400',
  FWD: 'text-red-400',
}

function fmtStat(col: ColDef, raw: number): string {
  if (col.isPercent) return `${raw.toFixed(1)}%`
  return raw.toFixed(2)
}

export function DraftRound({ state, onPick, onClubSkip, onEraSkip, onSpinResult }: Props) {
  const { currentRound, positionSlots, clubSkipUsed, eraSkipUsed, currentSpin, candidatePlayers, mode, formation } = state

  // Derive the position type of the next empty slot to fill
  const nextSlotPos: PositionType =
    positionSlots.find(s => !s.player)?.positionType ?? 'GK'

  const [phase, setPhase] = useState<RoundPhase>('spin')
  const [pendingSpin, setPendingSpin] = useState<ReturnType<typeof spinClubEra> | null>(null)
  const [posFilter, setPosFilter] = useState<PositionType>(nextSlotPos)
  const [search, setSearch] = useState('')

  const filledPlayers = positionSlots.filter(s => s.player !== null).map(s => s.player!)
  const pickedIds = filledPlayers.map(p => p.id)
  const pickedKey = pickedIds.join(',')
  // Memoize simulation so search-box keystrokes don't re-run the engine
  const simResult = useMemo(
    () => filledPlayers.length > 0 ? simulate(filledPlayers) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickedKey]
  )
  const liveNorm  = simResult?.normalisedStats ?? null
  const liveTeam  = simResult?.teamStats ?? null
  const projWins  = simResult ? projectWins(simResult.strengthRating) : null

  const emptyByType: Record<PositionType, number> = {
    GK:  positionSlots.filter(s => s.positionType === 'GK'  && !s.player).length,
    DEF: positionSlots.filter(s => s.positionType === 'DEF' && !s.player).length,
    MID: positionSlots.filter(s => s.positionType === 'MID' && !s.player).length,
    FWD: positionSlots.filter(s => s.positionType === 'FWD' && !s.player).length,
  }

  // Reset each round; default tab to the next slot's position
  useEffect(() => {
    setPhase('spin')
    setPendingSpin(null)
    setSearch('')
    const nextPos = positionSlots.find(s => !s.player)?.positionType ?? 'GK'
    setPosFilter(nextPos)
    const spin = spinClubEra(pickedIds, undefined, undefined, nextSlotPos)
    setPendingSpin(spin)
  }, [currentRound]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pendingSpin) {
      const spin = spinClubEra(pickedIds, undefined, undefined, nextSlotPos)
      setPendingSpin(spin)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleWheelComplete() {
    if (!pendingSpin) return
    onSpinResult(pendingSpin.club, pendingSpin.era, pendingSpin.candidates)
    setPhase('pick')
  }

  function handleClubSkip() {
    if (clubSkipUsed || !currentSpin) return
    onClubSkip()
    const result = rerollClub(currentSpin.era, pickedIds, nextSlotPos)
    setPendingSpin(result)
    onSpinResult(result.club, result.era, result.candidates)
  }

  function handleEraSkip() {
    if (eraSkipUsed || !currentSpin) return
    onEraSkip()
    const result = rerollEra(currentSpin.club, pickedIds, nextSlotPos)
    setPendingSpin(result)
    onSpinResult(result.club, result.era, result.candidates)
  }

  function isPickable(player: Player): boolean {
    return !pickedIds.includes(player.id) && emptyByType[player.positionType] > 0
  }

  function handlePickPlayer(player: Player) {
    if (!isPickable(player)) return
    const slotIndex = positionSlots.findIndex(
      s => s.positionType === player.positionType && s.player === null
    )
    if (slotIndex !== -1) onPick(player, slotIndex)
  }

  const cols = POS_COLS[posFilter]

  const filtered = candidatePlayers.filter(p => {
    if (p.positionType !== posFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const aOk = isPickable(a) ? 0 : 1
    const bOk = isPickable(b) ? 0 : 1
    if (aOk !== bOk) return aOk - bOk
    return b.stats[SORT_STAT[posFilter]] - a.stats[SORT_STAT[posFilter]]
  })

  // ── Pitch diagram ──────────────────────────────────────────────────────────
  const gkSlots  = positionSlots.slice(0, 1)
  const defSlots = formation ? positionSlots.slice(1, 1 + formation.defenders) : []
  const midSlots = formation ? positionSlots.slice(1 + formation.defenders, 1 + formation.defenders + formation.midfielders) : []
  const fwdSlots = formation ? positionSlots.slice(1 + formation.defenders + formation.midfielders) : []

  function PitchSlot({ s }: { s: typeof positionSlots[0] }) {
    const filled = s.player !== null
    return (
      <div className="flex flex-col items-center gap-1">
        {filled ? (
          <div className="slot-fill w-11 h-11 rounded-full border-2 border-emerald-500 bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs font-bold">
            {s.player!.name.split(' ').map(n => n[0]).join('').slice(0, 3)}
          </div>
        ) : (
          <div className="w-11 h-11 rounded-full border-2 border-white/20 text-gray-500 flex items-center justify-center text-xs font-bold">
            {s.positionLabel}
          </div>
        )}
        {filled && (
          <div className="text-[10px] text-gray-500 text-center max-w-12 truncate">
            {s.player!.name.split(' ').at(-1)}
          </div>
        )}
      </div>
    )
  }

  function Pitch() {
    return (
      <div className="flex-1 flex flex-col items-center justify-evenly bg-emerald-950/20 px-6 py-6">
        <div className="flex justify-center gap-4 w-full">
          {fwdSlots.map((s, i) => <PitchSlot key={i} s={s} />)}
        </div>
        <div className="w-full border-t border-emerald-900/30" />
        <div className="flex justify-center gap-4 w-full">
          {midSlots.map((s, i) => <PitchSlot key={i} s={s} />)}
        </div>
        <div className="w-full border-t border-emerald-900/30" />
        <div className="flex justify-center gap-4 w-full">
          {defSlots.map((s, i) => <PitchSlot key={i} s={s} />)}
        </div>
        <div className="w-full border-t border-emerald-900/30" />
        <div className="flex justify-center w-full">
          {gkSlots.map((s, i) => <PitchSlot key={i} s={s} />)}
        </div>
      </div>
    )
  }

  function fmtTeamStat(stat: keyof TeamStats, val: number): string {
    if (stat === 'savePct') return `${val.toFixed(1)}% / ${BENCHMARKS[stat].toFixed(1)}%`
    return `${val.toFixed(2)} / ${BENCHMARKS[stat].toFixed(2)}`
  }

  function StatBars() {
    return (
      <div className="border-t border-white/10 px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] text-gray-600 uppercase tracking-widest">Strength</div>
          {projWins !== null && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-600">Projected</span>
              <span className="font-display text-sm text-white">{projWins}–{13 - projWins}</span>
            </div>
          )}
        </div>
        {(Object.keys(STAT_LABELS) as Array<keyof TeamStats>).map(stat => {
          const val = liveNorm ? liveNorm[stat] : 0
          const pct = Math.round(val * 100)
          const color = val >= 0.75 ? 'bg-emerald-500' : val >= 0.5 ? 'bg-amber-400' : 'bg-red-500'
          return (
            <div key={stat} className="flex items-center gap-2">
              <span className="w-20 text-[10px] text-gray-600 text-right shrink-0">{STAT_LABELS[stat]}</span>
              <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${filledPlayers.length > 0 ? color : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-500 text-right font-data tabular-nums whitespace-nowrap">
                {liveNorm && liveTeam ? fmtTeamStat(stat, liveTeam[stat]) : '–'}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col md:flex-row h-[100dvh] overflow-hidden">

      {/* LEFT PANEL */}
      <div className="flex flex-col w-full md:w-[400px] md:shrink-0 border-b md:border-b-0 md:border-r border-white/10 flex-1 md:flex-none overflow-hidden">

        {phase === 'spin' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
            <div className="text-center">
              <div className="text-xs text-gray-600 uppercase tracking-widest">
                Round {currentRound + 1} of {positionSlots.length}
              </div>
            </div>
            {pendingSpin ? (
              <SpinWheel
                targetClub={pendingSpin.club}
                targetEra={pendingSpin.era}
                onSpinComplete={handleWheelComplete}
              />
            ) : (
              <div className="text-gray-600 text-sm">Loading…</div>
            )}
          </div>
        ) : (
          <>
            {/* Header: round + spin result + skips */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 flex-wrap">
              <div className="text-xs text-gray-600 font-medium shrink-0">
                <span className="hidden sm:inline">Round </span>{currentRound + 1}/{positionSlots.length}
              </div>
              {currentSpin && (
                <div className="flex items-center gap-1.5">
                  <span className="relative group px-2 py-0.5 rounded-md bg-white/10 text-white text-xs font-bold cursor-default">
                    {currentSpin.club.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()}
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                      <span className="block bg-gray-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-gray-200 whitespace-nowrap shadow-xl">
                        {currentSpin.club}
                      </span>
                    </span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-gray-300 text-xs font-mono">
                    {currentSpin.era}
                  </span>
                </div>
              )}
              {/* Projected wins — visible on mobile only (desktop shows in right panel) */}
              {projWins !== null && (
                <div className="md:hidden flex items-center gap-1 ml-auto mr-1">
                  <span className="text-[10px] text-gray-600">Proj</span>
                  <span className="font-display text-xs text-white">{projWins}–{13 - projWins}</span>
                </div>
              )}
              <div className={`flex items-center gap-1.5 ${projWins !== null ? '' : 'ml-auto'}`}>
                <button
                  onClick={handleClubSkip}
                  disabled={clubSkipUsed}
                  title="Re-roll club (keep era)"
                  className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-all ${
                    clubSkipUsed
                      ? 'border-white/5 text-gray-700 line-through cursor-not-allowed'
                      : 'border-white/20 text-gray-400 hover:bg-white/10 cursor-pointer'
                  }`}
                >
                  ↺ Team
                </button>
                <button
                  onClick={handleEraSkip}
                  disabled={eraSkipUsed}
                  title="Re-roll era (keep club)"
                  className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-all ${
                    eraSkipUsed
                      ? 'border-white/5 text-gray-700 line-through cursor-not-allowed'
                      : 'border-white/20 text-gray-400 hover:bg-white/10 cursor-pointer'
                  }`}
                >
                  ↺ Era
                </button>
              </div>
            </div>

            {/* Position tabs — pill style, shows available count */}
            <div className="flex border-b border-white/10">
              {POS_TABS.map(pos => {
                const count = candidatePlayers.filter(p => p.positionType === pos).length
                const active = posFilter === pos
                return (
                  <button
                    key={pos}
                    onClick={() => { setPosFilter(pos); setSearch('') }}
                    className={`flex-1 flex flex-col items-center py-2.5 text-xs font-semibold transition-all border-b-2 ${
                      active
                        ? `${POS_COLOR[pos]} border-current`
                        : 'text-gray-600 border-transparent hover:text-gray-400'
                    }`}
                  >
                    <span>{pos}</span>
                    <span className={`text-[10px] font-normal mt-0.5 ${active ? 'opacity-80' : 'opacity-40'}`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Search + column headers */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
              <input
                type="text"
                placeholder={`Search ${posFilter}…`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded px-2.5 py-1 text-xs text-white placeholder-gray-600 outline-none focus:border-white/20"
              />
              {cols.map(col => (
                <span
                  key={col.key}
                  className={`relative group w-11 text-right text-[10px] font-medium shrink-0 cursor-help ${
                    mode === 'scoutiq' ? 'blur-sm select-none' : 'text-gray-500'
                  }`}
                >
                  {col.label}
                  <span className="pointer-events-none absolute bottom-full right-0 mb-2 hidden group-hover:block z-50">
                    <span className="block bg-gray-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-gray-300 whitespace-nowrap shadow-xl">
                      {col.tooltip}
                    </span>
                  </span>
                </span>
              ))}
            </div>

            {/* Player list */}
            <div className="flex-1 overflow-y-auto">
              {sorted.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-gray-600 text-sm">
                  No {posFilter}s in this pool
                </div>
              ) : sorted.map(player => {
                const pickable = isPickable(player)
                return (
                  <button
                    key={player.id}
                    onClick={() => handlePickPlayer(player)}
                    disabled={!pickable}
                    className={`w-full flex items-center px-4 py-2.5 border-b border-white/5 text-left transition-all duration-150 ${
                      pickable ? 'hover:bg-white/5 active:bg-white/10 active:scale-[0.995] cursor-pointer' : 'opacity-30 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <div className="text-sm font-medium text-white truncate">{player.name}</div>
                      <div className="text-[10px] text-gray-500 truncate">
                        <span className={`font-semibold mr-1 ${POS_COLOR[player.positionType]}`}>
                          {player.positionLabel}
                        </span>
                        {player.club} · {player.era}
                      </div>
                    </div>
                    {cols.map(col => (
                      <span
                        key={col.key}
                        className={`w-11 text-right text-xs font-mono shrink-0 ${
                          mode === 'scoutiq' ? 'blur-sm select-none' : 'text-white'
                        }`}
                      >
                        {fmtStat(col, player.stats[col.key])}
                      </span>
                    ))}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* RIGHT PANEL — hidden on mobile, visible md+ */}
      <div className="hidden md:flex flex-1 flex-col overflow-hidden">
        <Pitch />
        <StatBars />
      </div>

    </div>
  )
}
