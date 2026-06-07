import type { Player, TeamStats, SimResult, PhaseResult, Weakness } from './types'
import { applyEraMultipliers } from './eraWeights'

// Season-total benchmarks for an elite 11-player team
// goalsPerSeason / assistsPerSeason / defActionsPerSeason: summed across all 11 players
// cleanSheetPct / savePct: GK-only — outfield = 0, so team total ≈ GK's individual value
export const BENCHMARKS: TeamStats = {
  goalsPerSeason:      24,   // ~+9% from 22 — requires elite FWD output to max
  assistsPerSeason:    20,   // ~+11% from 18 — demands genuine playmakers
  savePct:             87,   // ~+6% from 82 — only top-tier starters reach this
  defActionsPerSeason: 220,  // theoretical elite ceiling: 4 DEF + 4 MID all at peak defensive output
}

const WEIGHTS: Record<keyof TeamStats, number> = {
  goalsPerSeason:      0.35,
  assistsPerSeason:    0.25,
  savePct:             0.20,
  defActionsPerSeason: 0.20,
}

const WEAKNESS_THRESHOLD = 0.65

export const STAT_LABELS: Record<keyof TeamStats, string> = {
  goalsPerSeason:      'Attack',
  assistsPerSeason:    'Assists',
  savePct:             'Shot-stopping',
  defActionsPerSeason: 'Defensive work',
}

const PHASES: Array<{ phase: string; games: number }> = [
  { phase: 'Group stage', games: 6 },
  { phase: 'Round of 16', games: 2 },
  { phase: 'Quarters & Semis', games: 4 },
  { phase: 'Final', games: 1 },
]

function normalise(value: number, benchmark: number): number {
  return Math.min(value / benchmark, 1)
}

export function projectWins(strength: number): number {
  // Exponent 2.2: median picks → ~5 wins, p80 picks → ~9-10 wins, optimal → 13
  const base = 13 * Math.pow(strength, 2.2)
  return Math.min(Math.round(base), 13)
}

function distributePhases(totalWins: number): PhaseResult[] {
  // Fill wins forward: group stage first, final last.
  // Losses therefore accumulate in later rounds — a 3-win team wins some
  // group games then crashes out; only a 13-win team lifts the trophy.
  let remaining = totalWins
  return PHASES.map(({ phase, games }) => {
    const wins = Math.min(remaining, games)
    remaining -= wins
    return { phase, games, wins }
  })
}

export function simulate(players: Player[]): SimResult {
  const teamStats: TeamStats = {
    goalsPerSeason: 0,
    assistsPerSeason: 0,
    savePct: 0,
    defActionsPerSeason: 0,
  }

  for (const player of players) {
    const adjusted = applyEraMultipliers(player.stats, player.era)
    teamStats.goalsPerSeason      += adjusted.goalsPerSeason
    teamStats.assistsPerSeason    += adjusted.assistsPerSeason
    teamStats.savePct             += adjusted.savePct             // outfield: 0
    teamStats.defActionsPerSeason += adjusted.defActionsPerSeason
  }

  const normalisedStats: TeamStats = {
    goalsPerSeason:      normalise(teamStats.goalsPerSeason,      BENCHMARKS.goalsPerSeason),
    assistsPerSeason:    normalise(teamStats.assistsPerSeason,    BENCHMARKS.assistsPerSeason),
    savePct:             normalise(teamStats.savePct,             BENCHMARKS.savePct),
    defActionsPerSeason: normalise(teamStats.defActionsPerSeason, BENCHMARKS.defActionsPerSeason),
  }

  const strengthRating =
    (normalisedStats.goalsPerSeason      * WEIGHTS.goalsPerSeason)      +
    (normalisedStats.assistsPerSeason    * WEIGHTS.assistsPerSeason)    +
    (normalisedStats.savePct             * WEIGHTS.savePct)             +
    (normalisedStats.defActionsPerSeason * WEIGHTS.defActionsPerSeason)

  const totalWins = projectWins(strengthRating)
  const totalLosses = 13 - totalWins
  const phases = distributePhases(totalWins)

  const weaknesses: Weakness[] = (Object.keys(normalisedStats) as Array<keyof TeamStats>)
    .filter(stat => normalisedStats[stat] < WEAKNESS_THRESHOLD)
    .map(stat => ({
      stat,
      normalisedScore: normalisedStats[stat],
      label: STAT_LABELS[stat],
    }))

  return { totalWins, totalLosses, strengthRating, teamStats, normalisedStats, phases, weaknesses }
}
