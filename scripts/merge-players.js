#!/usr/bin/env node
/**
 * Merge per-season player records into a single players.json.
 *
 * Input: JSON arrays piped from multiple parse-md.js runs (concatenated)
 * Output: One JSON array where each record is the average of all seasons
 *         the player appeared in for that era.
 *
 * Usage:
 *   for f in scripts/data/raw/{1617,1718,1819,1920,2021,2122,2223,2324,2425,2526}.md; do
 *     node scripts/parse-md.js "$f" 2>/dev/null
 *   done | node scripts/merge-players.js > src/data/players.json
 *
 * Each parse-md.js outputs a JSON array; we read stdin as text and
 * concatenate all arrays before merging.
 */

import { readFileSync } from 'fs'

const raw = readFileSync('/dev/stdin', 'utf8').trim()

// Handle multiple JSON arrays concatenated on stdin (one per season file)
// We need to join them into one flat array.
// parse-md.js outputs valid JSON arrays separated by newlines.
// Strategy: wrap all arrays by replacing "][" boundaries.
let allRecords
try {
  // If parse-md.js outputs are concatenated, there may be "][" between them
  const fixed = raw.replace(/\]\s*\[/g, ',')
  allRecords = JSON.parse(fixed)
} catch {
  console.error('Failed to parse stdin as JSON — ensure parse-md.js output is piped correctly.')
  process.exit(1)
}

// Group by (name, club, era) — the canonical identity
const groups = new Map()

for (const rec of allRecords) {
  const k = `${rec.name}|${rec.club}|${rec.era}`
  if (!groups.has(k)) {
    groups.set(k, { meta: rec, seasons: [] })
  }
  groups.get(k).seasons.push(rec.stats)
}

// Average the stats across all seasons in the group
function avg(nums) {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

const merged = []

for (const { meta, seasons } of groups.values()) {
  const goalsAvg      = avg(seasons.map(s => s.goalsTotal      ?? s.goalsPerSeason ?? 0))
  const assistsAvg    = avg(seasons.map(s => s.assistsTotal    ?? s.assistsPerSeason ?? 0))
  const csPctAvg      = avg(seasons.map(s => s.cleanSheetPct   ?? 0))
  const savePctAvg    = avg(seasons.map(s => s.savePct         ?? 0))
  const defActionsAvg = avg(seasons.map(s => s.defActionsTotal ?? s.defActionsPerSeason ?? 0))

  // Deterministic id based on name + era (no season suffix)
  const slug = meta.name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const id = `${slug}-${meta.era.replace('-', '')}`

  merged.push({
    id,
    name:          meta.name,
    club:          meta.club,
    era:           meta.era,
    positionType:  meta.positionType,
    positionLabel: meta.positionLabel,
    stats: {
      goalsPerSeason:      +goalsAvg.toFixed(2),
      assistsPerSeason:    +assistsAvg.toFixed(2),
      cleanSheetPct:       +csPctAvg.toFixed(1),
      savePct:             +savePctAvg.toFixed(1),
      defActionsPerSeason: +defActionsAvg.toFixed(1),
    }
  })
}

// Sort: era asc, then club asc, then name asc
merged.sort((a, b) => {
  if (a.era < b.era) return -1
  if (a.era > b.era) return  1
  if (a.club < b.club) return -1
  if (a.club > b.club) return  1
  return a.name.localeCompare(b.name)
})

process.stdout.write(JSON.stringify(merged, null, 2) + '\n')
console.error(`Merged: ${allRecords.length} season records → ${merged.length} unique players`)
