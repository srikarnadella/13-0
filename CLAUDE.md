# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# 13-0 — Champions League Perfect Run

Build a browser-based draft game where the player constructs a historical Champions League XI and simulates a perfect 13-0 UCL campaign. Inspired by 82-0.com.

---

## Tech stack

- Single-page app: React + TypeScript
- Styling: Tailwind CSS
- State: `useState` / `useReducer` — no external state library
- No backend, no auth, no database. All data is bundled as static JSON.
- Target: deploy to Vercel or GitHub Pages as a static site

---

## Dev setup

Bootstrap (first time only):
```bash
npm create vite@latest . -- --template react-ts
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install
```

Common commands:
```bash
npm run dev        # start dev server (localhost:5173)
npm run build      # production build
npm run preview    # preview the production build locally
npx tsc --noEmit   # type-check without emitting
```

No test runner is configured yet. Add Vitest when tests are needed:
```bash
npm install -D vitest
```
The simulation engine (`lib/simulate.ts`) is pure logic — test it directly with Vitest without mounting any React components.

---

## Project structure

```
src/
  data/
    players.json       # full player dataset
    formations.json    # valid formation definitions
  components/
    FormationSpin.tsx  # screen 1 — three-reel slot machine
    DraftRound.tsx     # screen 2 — per-round player selection
    TeamSheet.tsx      # screen 3 — live pitch view + stat bars
    SimResult.tsx      # screen 4 — final result
    SlotReel.tsx       # reusable animated reel column
    PlayerCard.tsx     # selectable player card
    StatBar.tsx        # labelled progress bar
  lib/
    simulate.ts        # simulation engine
    formations.ts      # formation logic + validation
    draft.ts           # slot machine + skip logic
    eraWeights.ts      # ERA_MULTIPLIERS config
  App.tsx
  main.tsx
```

---

## Game flow

```
1. Formation spin   →   2. Draft rounds (11 picks)   →   3. Simulation   →   4. Result
```

### Phase 1 — Formation spin

Three slot reels spin independently:

| Reel | Label | Valid values | Weight |
|------|-------|--------------|--------|
| 1 | Defenders | 3, 4, 5 | 3→20%, 4→60%, 5→20% |
| 2 | Midfielders | 2, 3, 4, 5 | weighted toward 3–4 |
| 3 | Forwards | 1, 2, 3 | weighted toward 2–3 |

**Constraint:** defenders + midfielders + forwards must equal 10 (outfield players). The GK is always fixed as position slot 1. Reject and re-draw any combination that doesn't sum to 10.

**Playable shape bounds:**
- Defenders: min 3, max 5
- Midfielders: min 2, max 5
- Forwards: min 1, max 3

The player presses "Spin" to trigger all three reels. Reels animate sequentially (reel 1 settles, then 2, then 3). After settling, the resulting formation (e.g. 4-3-3) is displayed and a "Lock in" button confirms it.

The formation is **structural only** — it determines how many position slots exist in each line. It does not affect the simulation score.

---

### Phase 2 — Draft rounds

One round per position slot = 11 rounds total. Round order follows the formation from back to front: GK → defenders (left to right) → midfielders (left to right) → forwards (left to right).

Each round:
1. Spin the slot machine to get a **club + era** combo
2. Show 4 player cards from that club in that era who fit the current position type
3. Player selects one card — that player fills the current position slot
4. Advance to next round

#### Position types

Map each slot to a position type:

```ts
type PositionType = 'GK' | 'DEF' | 'MID' | 'FWD'
```

The slot machine only draws players whose `positionType` matches the current slot's type.

#### Slot machine logic

Each spin randomly selects:
- **Club**: uniform random from all clubs in `players.json`
- **Era**: uniform random from the 6 eras

If the chosen club + era combination has fewer than 4 eligible players for the current position type, re-spin automatically (max 5 retries, then expand to any club in that era). The minimum is 4 (not 2) because the player selection screen shows a 2×2 grid — showing fewer would break the layout.

#### Skips

Each game grants exactly:
- **1 club skip**: re-rolls only the club, keeps the era
- **1 era skip**: re-rolls only the era, keeps the club

Track as boolean flags `clubSkipUsed` and `eraSkipUsed`. Render used skips as greyed-out/struck-through.

#### Game modes

Toggle at the start screen, persisted for the full game:

| Mode | Behaviour |
|------|-----------|
| Classic | All player stats visible on cards |
| ScoutIQ | Stat values blurred (`filter: blur(4px)`), player name + club + era visible |

---

## Data — `players.json`

Array of player objects. Minimum viable dataset: ~250 players across all eras and clubs. All stats sourced from FBref UCL competition data.

```ts
type Player = {
  id: string
  name: string
  club: string            // UCL club name, e.g. "Real Madrid"
  era: Era
  positionType: PositionType
  positionLabel: string   // e.g. "CB", "CAM", "LW"
  stats: PlayerStats
}

type Era =
  | '2006-09'   // 2006/07 – 2008/09
  | '2010-13'   // 2009/10 – 2012/13
  | '2014-17'   // 2013/14 – 2016/17
  | '2018-21'   // 2017/18 – 2020/21
  | '2022-25'   // 2021/22 – 2024/25

type PlayerStats = {
  goalsPerGame: number      // goals scored per UCL game in that era
  keyPassesPerGame: number  // key passes (chances created) per game
  cleanSheetPct: number     // % of games player's team kept a clean sheet (defenders/GKs)
                            // For attackers/midfielders: set to team average in that era
  tacklesPerGame: number    // defensive actions per game
  dribblesPerGame: number   // successful dribbles per game
}
```

**Era-adjusted benchmarks** — UCL scoring rates and pressing intensity have shifted across these windows. Store era multipliers in a separate config rather than baking them in:

```ts
// lib/eraWeights.ts
export const ERA_MULTIPLIERS: Record<Era, Partial<PlayerStats>> = {
  '2006-09': { goalsPerGame: 1.00, tacklesPerGame: 1.05 },
  '2010-13': { goalsPerGame: 0.98 },
  '2014-17': { goalsPerGame: 0.96, dribblesPerGame: 1.05 },
  '2018-21': { goalsPerGame: 0.94, keyPassesPerGame: 1.03 },
  '2022-25': { goalsPerGame: 0.92 },
}
```

Apply multipliers when calculating the team's aggregate stats so that raw FBref numbers are comparable across eras.

---

## Simulation engine — `lib/simulate.ts`

### Step 1 — Aggregate team stats

Sum each stat across all 11 players, then apply era multipliers.

```ts
type TeamStats = {
  goalsPerGame: number
  keyPassesPerGame: number
  cleanSheetPct: number
  tacklesPerGame: number
  dribblesPerGame: number
}
```

### Step 2 — Normalise each stat

Each stat is normalised against a "perfect team" benchmark (the theoretical max if you picked optimally in every slot). Output is a 0–1 score per category.

```ts
const BENCHMARKS: TeamStats = {
  goalsPerGame: 3.5,
  keyPassesPerGame: 5.5,
  cleanSheetPct: 85,
  tacklesPerGame: 28,
  dribblesPerGame: 9,
}

function normalise(value: number, benchmark: number): number {
  return Math.min(value / benchmark, 1)
}
```

### Step 3 — Composite strength rating

Weighted average of the 5 normalised scores:

```ts
const WEIGHTS = {
  goalsPerGame:     0.28,
  keyPassesPerGame: 0.22,
  cleanSheetPct:    0.22,
  tacklesPerGame:   0.16,
  dribblesPerGame:  0.12,
}
```

`strengthRating = Σ (normalisedScore × weight)` → range 0–1.

### Step 4 — Win-projection curve

Map strength rating to wins via a non-linear S-curve. The relationship is not linear — going from 0.7 → 0.8 is much easier than 0.9 → 1.0.

```ts
function projectWins(strength: number): number {
  // S-curve: easy gains below 0.7, hard gains above 0.9
  const base = 13 * Math.pow(strength, 2.4)
  return Math.min(Math.round(base), 13)
}
```

Threshold for a perfect run: `wins === 13`. Tune the exponent (2.4) during playtesting so a very good team lands around 10–11 wins, and only an optimal team hits 13.

### Step 5 — Phase breakdown

Split 13 projected wins across 4 phases:

| Phase | Games | Label |
|-------|-------|-------|
| Group stage | 6 | "Group stage" |
| Round of 16 | 2 | "Round of 16" |
| QF + SF | 4 | "Quarters & Semis" |
| Final | 1 | "Final" |

Distribute losses starting from the later phases (a team that goes 11–2 loses in the semis, not the groups).

### Step 6 — Weakness detection

Flag any stat where the normalised score is below 0.65:

```ts
type Weakness = {
  stat: keyof TeamStats
  normalisedScore: number
  label: string  // human-readable, e.g. "Defensive solidity"
}
```

Surface weaknesses on the result screen with a red callout per flagged category.

---

## UI — screen-by-screen

### Screen 0 — Start

- Game title + tagline
- Mode toggle: Classic / ScoutIQ
- "Start" button
- Brief how-to-play modal (link, not inline)

### Screen 1 — Formation spin

- Three labelled reels: Defenders / Midfielders / Forwards
- Each reel cycles through numbers with a slot-machine animation (CSS `@keyframes` or a short JS interval)
- Reels settle sequentially left to right with ~300ms delay between each
- Resulting formation displayed large beneath the reels (e.g. "4–3–3")
- "Spin again" button (no limit — let them keep spinning until happy)
- "Lock in" button to confirm and start the draft

### Screen 2 — Draft round

- Header: round N of 11, current position label (e.g. "CB — slot 2 of 4"), era badge
- Slot machine showing club + era with spin animation
- Club skip / era skip buttons (grey out when used)
- 2×2 grid of player cards
  - Name, club, era, position label
  - Stats (blurred in ScoutIQ)
  - Highlight selected card with coloured border
- "Confirm pick" CTA

### Screen 3 — Team sheet (visible between rounds)

- 4-3-3 / whatever-formation pitch diagram with filled + empty slots
- Filled slots: player initials + name + era
- Empty slots: dashed circle + position label + era to be assigned
- Live stat bars (5 bars, update after each pick)
- Bar colour: green if above 0.75 normalised, amber 0.5–0.75, red below 0.5
- "Simulate" button appears only after all 11 slots are filled

### Screen 4 — Result

- Large record display: "13–0" (green if perfect) or "10–3" etc.
- Overall strength rating out of 100
- 5-stat breakdown cards
- Phase-by-phase results grid
- Weakness callouts (red) or "No weaknesses" (green)
- "Play again" + "Share" buttons

#### Share

Generate a text summary for clipboard:

```
I went [record] in the UCL with my all-time XI
GK: [name] ([era])
...
[url]
```

---

## State machine

```ts
type GamePhase =
  | 'start'
  | 'formation-spin'
  | 'draft'           // currentRound: 0–10
  | 'team-sheet'      // shown between rounds and after round 11
  | 'simulating'      // brief loading state
  | 'result'

type GameState = {
  phase: GamePhase
  mode: 'classic' | 'scoutiq'
  formation: Formation | null       // e.g. { defenders: 4, midfielders: 3, forwards: 3 }
  positionSlots: PositionSlot[]     // ordered list of 11 slots
  currentRound: number
  clubSkipUsed: boolean
  eraSkipUsed: boolean
  currentSpin: { club: string; era: Era } | null
  result: SimResult | null
}

type PositionSlot = {
  positionType: PositionType
  positionLabel: string
  player: Player | null
}
```

---

## Formations config — `data/formations.json`

Pre-define position slot sequences for each valid formation so you don't compute them on the fly:

```json
{
  "4-3-3": [
    { "positionType": "GK",  "positionLabel": "GK" },
    { "positionType": "DEF", "positionLabel": "RB" },
    { "positionType": "DEF", "positionLabel": "CB" },
    { "positionType": "DEF", "positionLabel": "CB" },
    { "positionType": "DEF", "positionLabel": "LB" },
    { "positionType": "MID", "positionLabel": "CM" },
    { "positionType": "MID", "positionLabel": "CM" },
    { "positionType": "MID", "positionLabel": "CM" },
    { "positionType": "FWD", "positionLabel": "RW" },
    { "positionType": "FWD", "positionLabel": "ST" },
    { "positionType": "FWD", "positionLabel": "LW" }
  ]
}
```

Cover at minimum: 4-3-3, 4-4-2, 3-5-2, 4-2-3-1, 3-4-3, 5-3-2, 5-4-1, 4-5-1, 3-4-3.

---

## Key decisions already made

- Formation is **structural only** — does not affect simulation weights or scoring
- No positional synergy bonuses or penalties
- Era multipliers are applied to raw stats before aggregation, not to the final score
- Losses in the phase breakdown are distributed from later rounds backward
- ScoutIQ blurs stat values — names, clubs, and era labels remain visible
- One club skip + one era skip per game, no resets mid-game
- Formation spin has no limit — player can keep spinning before locking in
- Minimum 4 eligible players required per club + era + position before confirming a spin (re-spin if fewer, since the card grid is always 2×2)
- Eras cover 2006–present only (5 × 4-year bands); all stats sourced from FBref — no estimation needed

---

## Build order recommendation

1. `players.json` — seed ~50 players from FBref (one per position type per era) to make the game playable, fill out to ~250 later. Source from FBref UCL competition pages filtered by season range.
2. `simulate.ts` — get the engine working and testable in isolation with mock team data
3. `FormationSpin.tsx` — the slot machine animation is the trickiest UI piece, solve it early
4. `DraftRound.tsx` + `PlayerCard.tsx` — core gameplay loop
5. `TeamSheet.tsx` — pitch diagram with live stat bars
6. `SimResult.tsx` — result + share
7. Wire together in `App.tsx` with the state machine
8. ScoutIQ mode — add blur toggle last, it's a one-line CSS change per card