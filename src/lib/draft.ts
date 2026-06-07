import playersData from '../data/players.json'
import type { Player, Era, PositionType, CurrentSpin } from './types'

const ALL_PLAYERS = playersData as Player[]

const ERAS: Era[] = ['2016-18', '2018-20', '2020-22', '2022-24', '2024-26']
const CLUBS = [...new Set(ALL_PLAYERS.map(p => p.club))]

// Minimum players of the required position type a club+era must have for the spin to be valid
const MIN_POS_PLAYERS = 2
const MAX_RETRIES = 15

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Returns ALL players from a club+era (full squad for tab browsing)
function getSquad(club: string, era: Era, excludeIds: string[] = []): Player[] {
  return ALL_PLAYERS.filter(
    p => p.club === club && p.era === era && !excludeIds.includes(p.id)
  )
}

// How many players of a specific position type are in the squad
function countByPos(squad: Player[], positionType: PositionType): number {
  return squad.filter(p => p.positionType === positionType).length
}

export function spinClubEra(
  excludeIds: string[] = [],
  overrideClub?: string,
  overrideEra?: Era,
  positionType?: PositionType
): CurrentSpin & { candidates: Player[] } {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const club = overrideClub ?? randomFrom(CLUBS)
    const era  = overrideEra  ?? randomFrom(ERAS)
    const squad = getSquad(club, era, excludeIds)
    // Validate the squad has enough players of the needed position type
    const valid = positionType
      ? countByPos(squad, positionType) >= MIN_POS_PLAYERS
      : squad.length >= MIN_POS_PLAYERS
    if (valid) {
      return { club, era, candidates: squad }
    }
  }

  // Fallback: exhaustive search for any club+era with enough position-specific players
  const shuffledEras = [...ERAS].sort(() => Math.random() - 0.5)
  for (const era of shuffledEras) {
    const eligible = CLUBS.filter(c => {
      const squad = getSquad(c, era, excludeIds)
      return positionType
        ? countByPos(squad, positionType) >= MIN_POS_PLAYERS
        : squad.length >= MIN_POS_PLAYERS
    })
    if (eligible.length > 0) {
      const club = randomFrom(eligible)
      return { club, era, candidates: getSquad(club, era, excludeIds) }
    }
  }

  // Last resort: return whatever we find so the game never hard-blocks
  const era = randomFrom(ERAS)
  const club = randomFrom(CLUBS)
  return { club, era, candidates: getSquad(club, era, excludeIds) }
}

export function rerollClub(
  currentEra: Era,
  excludeIds: string[] = [],
  positionType?: PositionType
): CurrentSpin & { candidates: Player[] } {
  return spinClubEra(excludeIds, undefined, currentEra, positionType)
}

export function rerollEra(
  currentClub: string,
  excludeIds: string[] = [],
  positionType?: PositionType
): CurrentSpin & { candidates: Player[] } {
  return spinClubEra(excludeIds, currentClub, undefined, positionType)
}
