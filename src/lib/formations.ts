import formationsData from '../data/formations.json'
import type { Formation, PositionSlot } from './types'

type FormationKey = keyof typeof formationsData

export const FORMATION_WEIGHTS = {
  defenders: { 3: 0.20, 4: 0.60, 5: 0.20 } as Record<number, number>,
  midfielders: { 2: 0.15, 3: 0.45, 4: 0.40 } as Record<number, number>,
  forwards: { 1: 0.20, 2: 0.40, 3: 0.40 } as Record<number, number>,
}

function weightedRandom(weights: Record<number, number>): number {
  const rand = Math.random()
  let cumulative = 0
  for (const [value, weight] of Object.entries(weights)) {
    cumulative += weight
    if (rand < cumulative) return Number(value)
  }
  return Number(Object.keys(weights).at(-1))
}

export function spinFormation(): Formation {
  for (let i = 0; i < 50; i++) {
    const defenders = weightedRandom(FORMATION_WEIGHTS.defenders)
    const midfielders = weightedRandom(FORMATION_WEIGHTS.midfielders)
    const forwards = weightedRandom(FORMATION_WEIGHTS.forwards)
    if (defenders + midfielders + forwards === 10) {
      const key = `${defenders}-${midfielders}-${forwards}`
      return { defenders, midfielders, forwards, key }
    }
  }
  // Guaranteed fallback
  return { defenders: 4, midfielders: 3, forwards: 3, key: '4-3-3' }
}

export function getSlotsForFormation(formation: Formation): PositionSlot[] {
  const key = formation.key as FormationKey
  const slots = formationsData[key] ?? formationsData['4-3-3']
  return slots.map(s => ({ ...s, player: null } as PositionSlot))
}
