export type Era = '2016-18' | '2018-20' | '2020-22' | '2022-24' | '2024-26'

export type PositionType = 'GK' | 'DEF' | 'MID' | 'FWD'

export type PlayerStats = {
  goalsPerSeason: number       // avg UCL goals per season across era
  assistsPerSeason: number     // avg UCL assists per season
  cleanSheetPct: number        // GK: avg clean sheet %; outfield: 0
  savePct: number              // GK: avg save %; outfield: 0
  defActionsPerSeason: number  // avg (TklW+Int) per season; 0 for GKs/pre-2016
}

export type Player = {
  id: string
  name: string
  club: string
  era: Era
  positionType: PositionType
  positionLabel: string
  stats: PlayerStats
}

export type PositionSlot = {
  positionType: PositionType
  positionLabel: string
  player: Player | null
}

export type Formation = {
  defenders: number
  midfielders: number
  forwards: number
  key: string
}

export type TeamStats = {
  goalsPerSeason: number
  assistsPerSeason: number
  savePct: number              // GK save %; outfield players contribute 0
  defActionsPerSeason: number
}

export type Weakness = {
  stat: keyof TeamStats
  normalisedScore: number
  label: string
}

export type PhaseResult = {
  phase: string
  games: number
  wins: number
}

export type SimResult = {
  totalWins: number
  totalLosses: number
  strengthRating: number
  teamStats: TeamStats
  normalisedStats: TeamStats
  phases: PhaseResult[]
  weaknesses: Weakness[]
}

export type CurrentSpin = {
  club: string
  era: Era
}

export type GamePhase =
  | 'start'
  | 'formation-spin'
  | 'draft'
  | 'team-sheet'
  | 'simulating'
  | 'result'

export type GameMode = 'classic' | 'scoutiq'

export type GameState = {
  phase: GamePhase
  mode: GameMode
  formation: Formation | null
  positionSlots: PositionSlot[]
  currentRound: number
  clubSkipUsed: boolean
  eraSkipUsed: boolean
  currentSpin: CurrentSpin | null
  candidatePlayers: Player[]
  result: SimResult | null
}
