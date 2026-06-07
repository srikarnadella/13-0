import type { Era, PlayerStats } from './types'

export const ERA_MULTIPLIERS: Record<Era, Partial<PlayerStats>> = {
  // Goals/assists: scoring rates shifted down in later eras (more defensive UCL)
  // defActionsPerSeason: pressing intensity rose in later eras, so older era stats
  // get a boost to make them comparable to modern pressing-heavy squads
  '2016-18': { goalsPerSeason: 1.00,                                defActionsPerSeason: 1.08 },
  '2018-20': { goalsPerSeason: 0.97, assistsPerSeason: 1.02,        defActionsPerSeason: 1.06 },
  '2020-22': { goalsPerSeason: 0.95, assistsPerSeason: 1.03,        defActionsPerSeason: 1.04 },
  '2022-24': { goalsPerSeason: 0.93, assistsPerSeason: 1.04,        defActionsPerSeason: 1.02 },
  '2024-26': { goalsPerSeason: 0.91, assistsPerSeason: 1.05,        defActionsPerSeason: 1.00 },
}

export function applyEraMultipliers(stats: PlayerStats, era: Era): PlayerStats {
  const m = ERA_MULTIPLIERS[era]
  return {
    goalsPerSeason:      stats.goalsPerSeason      * (m.goalsPerSeason      ?? 1),
    assistsPerSeason:    stats.assistsPerSeason    * (m.assistsPerSeason    ?? 1),
    cleanSheetPct:       stats.cleanSheetPct,
    savePct:             stats.savePct,
    defActionsPerSeason: stats.defActionsPerSeason * (m.defActionsPerSeason ?? 1),
  }
}
