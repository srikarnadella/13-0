#!/usr/bin/env node
/**
 * Parse FBref data from a combined .md file (one file per UCL season).
 *
 * FILE FORMAT (paste FBref tables together into one .md file):
 *   1. GK table (has GA, SoTA, CS% columns)
 *   2. Standard Stats table (has CrdY, CrdR, Gls, Ast columns)
 *   3. Miscellaneous Stats table (has Int, TklW columns)
 *
 * FILE NAMING CONVENTION (2016-17 onwards only):
 *   scripts/data/raw/2526.md  →  era '2024-26'
 *   scripts/data/raw/2425.md  →  era '2024-26'
 *   scripts/data/raw/2324.md  →  era '2022-24'
 *   scripts/data/raw/2223.md  →  era '2022-24'
 *   ...
 *
 * OUTPUT: JSON array of per-season player records (raw season totals).
 * Run merge-players.js to average across seasons and produce players.json.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MIN_90S = 1.5  // skip players with fewer than 1.5 appearances

const ERA_MAP = {
  '2526': '2024-26',
  '2425': '2024-26',
  '2324': '2022-24',
  '2223': '2022-24',
  '2122': '2020-22',
  '2021': '2020-22',
  '1920': '2018-20',
  '1819': '2018-20',
  '1718': '2016-18',
  '1617': '2016-18',
}

const filepath = process.argv[2]
if (!filepath) {
  console.error('Usage: node scripts/parse-md.js <path/to/NNNN.md>')
  process.exit(1)
}

const basename = path.basename(filepath, '.md')
const era = ERA_MAP[basename]
if (!era) {
  console.error(`Season "${basename}" not in ERA_MAP (only 1617-2526 supported). Skipping.`)
  process.exit(0)
}

function stripFlag(str) {
  return (str || '').replace(/^[a-z]{2,3}\s+/, '').trim()
}

function detectSection(cols) {
  if (cols.includes('GA') && cols.includes('SoTA')) return 'gk'
  if (cols.includes('Int') && cols.includes('TklW')) return 'misc'
  if (cols.includes('CrdY')) return 'standard'
  if (cols.includes('Sh') && cols.includes('SoT')) return 'shooting'
  return null
}

function mapPos(fbrefPos) {
  const p = (fbrefPos || '').toUpperCase()
  if (p.startsWith('GK')) return 'GK'
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
  if (p.startsWith('GK')) return 'GK'
  if (p[0] === 'D') return 'CB'
  if (p[0] === 'M') return 'CM'
  if (p[0] === 'F') return 'ST'
  return p.slice(0, 3) || 'CM'
}

function key(player, squad) {
  return `${player.toLowerCase().trim()}|${stripFlag(squad).toLowerCase().trim()}`
}

const lines = fs.readFileSync(filepath, 'utf8')
  .split('\n').map(l => l.trimEnd()).filter(Boolean)

const gkData  = {}
const stdData = {}
const miscData = {}
let section = null
let colIndices = {}

for (const line of lines) {
  const cols = line.split('\t').map(c => c.trim())

  const playerIdx = cols.indexOf('Player')
  const squadIdx  = cols.indexOf('Squad')
  if (playerIdx !== -1 && squadIdx !== -1) {
    const detected = detectSection(cols)
    if (detected) {
      section = detected
      colIndices = {}
      cols.forEach((c, i) => {
        if (colIndices[c] === undefined) colIndices[c] = i
        // Track second occurrence of Gls/Ast (the per-90 columns) — we still need
        // first occurrence for raw totals and second for fallback validation
        else if (c === 'Gls' && section === 'standard') colIndices['Gls_per90'] = i
        else if (c === 'Ast' && section === 'standard') colIndices['Ast_per90'] = i
      })
    }
    continue
  }

  if (!section || section === 'shooting') continue
  if (cols.length < 5) continue
  if (cols[0] === 'Rk' || cols[1] === 'Player') continue

  const name  = cols[colIndices['Player']] || ''
  const squad = cols[colIndices['Squad']]  || ''
  if (!name || name === 'Player') continue

  const nineties = parseFloat(cols[colIndices['90s']] || '0') || 0

  if (section === 'gk') {
    if (nineties < MIN_90S) continue
    gkData[key(name, squad)] = {
      csPct:   parseFloat(cols[colIndices['CS%']]   || '0') || 0,
      savePct: parseFloat(cols[colIndices['Save%']] || '0') || 0,
    }
  }

  if (section === 'standard') {
    if (nineties < MIN_90S) continue
    const k = key(name, squad)
    if (stdData[k]) continue
    // Raw totals: first occurrence of Gls/Ast columns
    const glsTotal = parseFloat(cols[colIndices['Gls']] || '0') || 0
    const astTotal = parseFloat(cols[colIndices['Ast']] || '0') || 0
    stdData[k] = {
      name,
      squad: stripFlag(squad),
      pos: cols[colIndices['Pos']] || '',
      nineties,
      glsTotal,
      astTotal,
    }
  }

  if (section === 'misc') {
    if (nineties < MIN_90S) continue
    const k = key(name, squad)
    if (miscData[k]) continue
    const tklW = parseFloat(cols[colIndices['TklW']] || '0') || 0
    const int_ = parseFloat(cols[colIndices['Int']]  || '0') || 0
    miscData[k] = { defTotal: tklW + int_ }
  }
}

// Build per-season player records with raw season totals
const players = []

for (const [k, d] of Object.entries(stdData)) {
  const posType  = mapPos(d.pos)
  const posLabel = mapPosLabel(d.pos)

  const gkEntry = gkData[k]
  const csPct   = posType === 'GK' ? (gkEntry?.csPct   ?? 0) : 0
  const savePct = posType === 'GK' ? (gkEntry?.savePct  ?? 0) : 0

  const slug = d.name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const id = `${slug}-${era.replace('-', '')}`

  const misc = miscData[k]
  const defTotal = misc ? misc.defTotal : 0

  players.push({
    id,
    name: d.name,
    club: d.squad,
    era,
    season: basename,          // track which season this came from (for averaging)
    positionType: posType,
    positionLabel: posLabel,
    stats: {
      goalsTotal:      d.glsTotal,   // raw season total
      assistsTotal:    d.astTotal,   // raw season total
      cleanSheetPct:   +csPct.toFixed(1),
      savePct:         +savePct.toFixed(1),
      defActionsTotal: defTotal,     // raw season total (TklW + Int)
    }
  })
}

console.log(JSON.stringify(players, null, 2))
console.error(`Done: ${players.length} players — ${basename}.md → era ${era}`)
