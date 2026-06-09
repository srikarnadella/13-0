import { useReducer } from 'react'
import { FormationSpin } from './components/FormationSpin'
import { DraftRound } from './components/DraftRound'
import { TeamSheet } from './components/TeamSheet'
import { SimResult } from './components/SimResult'
import { getSlotsForFormation } from './lib/formations'
import { simulate } from './lib/simulate'
import type { GameState, Formation, Player, Era } from './lib/types'

const INITIAL_STATE: GameState = {
  phase: 'start',
  mode: 'classic',
  formation: null,
  positionSlots: [],
  currentRound: 0,
  clubSkipUsed: false,
  eraSkipUsed: false,
  currentSpin: null,
  candidatePlayers: [],
  result: null,
}

type Action =
  | { type: 'SET_MODE'; mode: GameState['mode'] }
  | { type: 'START_FORMATION_SPIN' }
  | { type: 'LOCK_FORMATION'; formation: Formation }
  | { type: 'SPIN_RESULT'; club: string; era: Era; candidates: Player[] }
  | { type: 'PICK_PLAYER'; player: Player; slotIndex: number }
  | { type: 'CLUB_SKIP' }
  | { type: 'ERA_SKIP' }
  | { type: 'SIMULATE' }
  | { type: 'RESET' }

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.mode }

    case 'START_FORMATION_SPIN':
      return { ...state, phase: 'formation-spin' }

    case 'LOCK_FORMATION': {
      const positionSlots = getSlotsForFormation(action.formation)
      return {
        ...state,
        phase: 'draft',
        formation: action.formation,
        positionSlots,
        currentRound: 0,
        currentSpin: null,
        candidatePlayers: [],
      }
    }

    case 'SPIN_RESULT':
      return {
        ...state,
        currentSpin: { club: action.club, era: action.era },
        candidatePlayers: action.candidates,
      }

    case 'CLUB_SKIP':
      return { ...state, clubSkipUsed: true }

    case 'ERA_SKIP':
      return { ...state, eraSkipUsed: true }

    case 'PICK_PLAYER': {
      const updatedSlots = state.positionSlots.map((slot, i) =>
        i === action.slotIndex ? { ...slot, player: action.player } : slot
      )
      const nextRound = state.currentRound + 1
      const allDone = nextRound >= state.positionSlots.length
      return {
        ...state,
        positionSlots: updatedSlots,
        phase: allDone ? 'team-sheet' : 'draft',
        currentRound: nextRound,
        currentSpin: null,
        candidatePlayers: [],
      }
    }

    case 'SIMULATE': {
      const players = state.positionSlots.map(s => s.player!)
      const result = simulate(players)
      return { ...state, phase: 'result', result }
    }

    case 'RESET':
      return { ...INITIAL_STATE }

    default:
      return state
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  return (
    <div className={`min-h-screen bg-[#0a0a0f] flex flex-col ${state.phase === 'draft' ? '' : 'items-center justify-center px-4 py-12'}`}>
      {state.phase === 'start' && (
        <div className="fade-up flex flex-col items-center gap-10 max-w-sm w-full">
          {/* Hero */}
          <div className="text-center flex flex-col items-center gap-4">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-8xl leading-none text-white tracking-tight">13</span>
              <span className="font-display text-5xl text-emerald-400 leading-none">–</span>
              <span className="font-display text-8xl leading-none text-emerald-400 tracking-tight">0</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              Draft an all-time UCL XI from the modern era.
              <br />
              Can you go unbeaten through all 13 games?
            </p>
          </div>

          {/* Mode picker */}
          <div className="w-full flex flex-col gap-3">
            <div className="flex rounded-xl overflow-hidden border border-white/10 bg-white/5">
              <button
                onClick={() => dispatch({ type: 'SET_MODE', mode: 'classic' })}
                className={`flex-1 py-3 text-sm font-medium transition-colors duration-150 ${
                  state.mode === 'classic'
                    ? 'bg-white/15 text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                Classic
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_MODE', mode: 'scoutiq' })}
                className={`flex-1 py-3 text-sm font-medium transition-colors duration-150 ${
                  state.mode === 'scoutiq'
                    ? 'bg-white/15 text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                ScoutIQ
              </button>
            </div>
            <p className="text-xs text-gray-600 text-center">
              {state.mode === 'scoutiq'
                ? 'Stats are hidden — draft on instinct'
                : 'All stats visible on player cards'}
            </p>

            <button
              onClick={() => dispatch({ type: 'START_FORMATION_SPIN' })}
              className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-bold text-lg transition-all duration-150"
            >
              Build your XI
            </button>
          </div>
        </div>
      )}

      {state.phase === 'formation-spin' && (
        <div className="fade-up w-full flex justify-center"><FormationSpin
          onLockIn={(formation) => dispatch({ type: 'LOCK_FORMATION', formation })}
        /></div>
      )}

      {state.phase === 'draft' && (
        <div className="fade-up w-full h-[100dvh]"><DraftRound
          state={state}
          onPick={(player, slotIndex) => dispatch({ type: 'PICK_PLAYER', player, slotIndex })}
          onClubSkip={() => dispatch({ type: 'CLUB_SKIP' })}
          onEraSkip={() => dispatch({ type: 'ERA_SKIP' })}
          onSpinResult={(club, era, candidates) =>
            dispatch({ type: 'SPIN_RESULT', club, era, candidates })
          }
        /></div>
      )}

      {state.phase === 'team-sheet' && (
        <div className="fade-up w-full max-w-2xl">
          <TeamSheet
            state={state}
            onSimulate={() => dispatch({ type: 'SIMULATE' })}
          />
        </div>
      )}

      {state.phase === 'result' && state.result && (
        <div className="fade-up w-full max-w-2xl">
          <SimResult
            result={state.result}
            state={state}
            onPlayAgain={() => dispatch({ type: 'RESET' })}
          />
        </div>
      )}
    </div>
  )
}
