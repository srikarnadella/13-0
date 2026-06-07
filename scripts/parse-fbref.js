#!/usr/bin/env node
/**
 * Convert FBref copy-paste TSV tables into players.json entries.
 *
 * SETUP:
 *   For each UCL season page on FBref, copy each stats table and save to:
 *     scripts/data/standard.tsv   — Standard Stats (Gls/90)
 *     scripts/data/passing.tsv    — Passing (KP column)
 *     scripts/data/defense.tsv    — Defense (Tkl column)
 *     scripts/data/misc.tsv       — Misc (Succ under Take-Ons)
 *     scripts/data/gk.tsv         — Goalkeeping (CS% column) — GKs only
 *
 * RUN:
 *   ERA=2022-25 node scripts/parse-fbref.js
 *   (ERA defaults to 2022-25 if not set)
 *
 * OUTPUT:
 *   Prints JSON array to stdout — pipe to a file or paste into players.json.
 *   node scripts/parse-fbref.js > /tmp/new-players.json
 */

const fs = require('fs')
const path = require('path')

const ERA = process.env.ERA || '2022-25'
const DATA_DIR = path.join(__dirname, 'data')
const MIN_90S = 1.5   // skip players with less than 1.5 90-minute appearances

// Strip FBref's country-code prefix from squad names: "it Inter" -> "Inter"
function stripFlag(str) {
  return (str || '').replace(/^[a-z]{2,3}\s+/, '').trim()
}

// Parse a tab-separated block. Handles FBref's quirks:
//   - Two header rows (we find the one containing "Player")
//   - "Matches" link column at the end
//   - Rank column (#) at the start
function parseTSV(filepath) {
  if (!fs.existsSync(filepath)) {
    console.error(`Missing: ${filepath}`)
    return { headers: [], rows: [] }
  }
  const lines = fs.readFileSync(filepath, 'utf8')
    .split('\n')
    .map(l => l.trimEnd())
    .filter(Boolean)

  // Find the header row — it contains "Player" and "Squad"
  let headerIdx = lines.findIndex(l => {
    const cols = l.split('\t')
    return cols.some(c => c.trim() === 'Player') && cols.some(c => c.trim() === 'Squad')
  })
  if (headerIdx === -1) headerIdx = 0

  const rawHeaders = lines[headerIdx].split('\t').map(h => h.trim())

  // Deduplicate repeated header names by appending _2, _3...
  const seen = {}
  const headers = rawHeaders.map(h => {
    if (!h) return '_empty'
    seen[h] = (seen[h] || 0) + 1
    return seen[h] === 1 ? h : `${h}_${seen[h]}`
  })

  const rows = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split('\t')
    // Skip sub-header rows (FBref repeats headers every N rows)
    if (cols.some(c => c.trim() === 'Player')) continue
    if (cols.length < 5) continue
    const row = {}
    headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim() })
    const name = row['Player']
    if (!name || name === 'Player') continue
    rows.push(row)
  }
  return { headers, rows }
}

// Build a lookup key: "Player|Squad" (normalised)
function key(player, squad) {
  return `${player.toLowerCase().trim()}|${stripFlag(squad).toLowerCase().trim()}`
}

// Find a column by trying multiple possible names (FBref renames columns across seasons)
function col(row, ...candidates) {
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== '') return parseFloat(row[c]) || 0
  }
  return 0
}

// ── Load tables ──────────────────────────────────────────────────────────────

const std  = parseTSV(path.join(DATA_DIR, 'standard.tsv'))
const pass = parseTSV(path.join(DATA_DIR, 'passing.tsv'))
const def  = parseTSV(path.join(DATA_DIR, 'defense.tsv'))
const misc = parseTSV(path.join(DATA_DIR, 'misc.tsv'))
const gk   = parseTSV(path.join(DATA_DIR, 'gk.tsv'))

// Build lookup maps for secondary tables
function buildMap(rows) {
  const map = {}
  for (const r of rows) map[key(r['Player'], r['Squad'])] = r
  return map
}

const passMap = buildMap(pass.rows)
const defMap  = buildMap(def.rows)
const miscMap = buildMap(misc.rows)
const gkMap   = buildMap(gk.rows)

// ── Map FBref positions to our PositionType ──────────────────────────────────

function mapPos(fbrefPos) {
  const p = (fbrefPos || '').toUpperCase()
  if (p.startsWith('GK')) return 'GK'
  if (p.includes('CB') || p === 'DF' || p.includes('WB') || p.includes('LB') || p.includes('RB')) return 'DEF'
  if (p.includes('MF') || p.includes('DM') || p.includes('CM') || p.includes('AM')) return 'MID'
  if (p.includes('FW') || p.includes('ST') || p.includes('CF') || p.includes('LW') || p.includes('RW')) return 'FWD'
  // fallback by first character
  if (p[0] === 'D') return 'DEF'
  if (p[0] === 'M') return 'MID'
  if (p[0] === 'F') return 'FWD'
  return 'MID'
}

function mapPosLabel(fbrefPos) {
  const p = (fbrefPos || '').toUpperCase()
  const known = ['GK','CB','LB','RB','LWB','RWB','CDM','CM','CAM','LM','RM','LW','RW','ST','CF','SS']
  for (const l of known) {
    if (p.includes(l)) return l
  }
  // Rough fallback
  if (p.startsWith('GK')) return 'GK'
  if (p[0] === 'D') return 'CB'
  if (p[0] === 'M') return 'CM'
  if (p[0] === 'F') return 'ST'
  return p.slice(0, 3)
}

// ── Process players ──────────────────────────────────────────────────────────

const players = []
const seen90s = new Set()

for (const row of std.rows) {
  const nineties = parseFloat(row['90s']) || 0
  if (nineties < MIN_90S) continue

  const playerName = row['Player']
  const squad = stripFlag(row['Squad'])
  const k = key(playerName, row['Squad'])

  if (seen90s.has(k)) continue
  seen90s.add(k)

  const passRow = passMap[k] || {}
  const defRow  = defMap[k]  || {}
  const miscRow = miscMap[k] || {}
  const gkRow   = gkMap[k]   || {}

  const posType  = mapPos(row['Pos'])
  const posLabel = mapPosLabel(row['Pos'])

  // Goals per 90 — prefer the per-90 column, fall back to total/90s
  const gls90 = col(row, 'Gls_2', 'Gls/90') ||
    (col(row, 'Gls') / (nineties || 1))

  // Key passes per 90
  const kp = col(passRow, 'KP')
  const kp90 = kp / (nineties || 1)

  // Tackles per 90
  const tkl = col(defRow, 'Tkl')
  const tkl90 = tkl / (nineties || 1)

  // Dribbles (successful take-ons) per 90
  const succ = col(miscRow, 'Succ', 'Succ_2')
  const drb90 = succ / (nineties || 1)

  // Clean sheet % — use GK table if available, else use a reasonable default
  let csPct = 0
  if (posType === 'GK') {
    csPct = col(gkRow, 'CS%', 'CSPct') || col(gkRow, 'CS') / (col(gkRow, 'MP') || 1) * 100
  } else {
    // Outfield: use a flat team-average placeholder (50%) — refine manually later
    csPct = 50
  }

  const id = `${playerName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${ERA}`

  players.push({
    id,
    name: playerName,
    club: squad,
    era: ERA,
    positionType: posType,
    positionLabel: posLabel,
    stats: {
      goalsPerGame:     +gls90.toFixed(3),
      keyPassesPerGame: +kp90.toFixed(3),
      cleanSheetPct:    +csPct.toFixed(1),
      tacklesPerGame:   +tkl90.toFixed(3),
      dribblesPerGame:  +drb90.toFixed(3),
    }
  })
}

console.log(JSON.stringify(players, null, 2))
console.error(`\nDone: ${players.length} players for era ${ERA}`)
