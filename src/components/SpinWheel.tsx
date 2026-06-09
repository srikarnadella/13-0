import { useEffect, useRef, useState } from 'react'
import type { Era } from '../lib/types'

type Props = {
  targetClub: string
  targetEra: Era
  onSpinComplete: () => void
}

type Phase = 'idle' | 'spinning' | 'teamSettled' | 'settled'

const SPIN_CLUBS = [
  'Real Madrid', 'Barcelona', 'Liverpool', 'Bayern Munich',
  'Manchester City', 'Chelsea', 'Arsenal', 'Juventus',
  'Inter', 'AC Milan', 'Paris Saint-Germain', 'Atlético Madrid',
  'Dortmund', 'Porto', 'Ajax', 'Benfica', 'Napoli', 'Atalanta',
  'Monaco', 'PSV', 'Sporting CP', 'Newcastle United',
]

const SPIN_ERAS: Era[] = ['2016-18', '2018-20', '2020-22', '2022-24', '2024-26']

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const CLUB_CODES: Record<string, string> = {
  'Real Madrid': 'RMA', 'Barcelona': 'BAR', 'Liverpool': 'LIV',
  'Bayern Munich': 'FCB', 'Manchester City': 'MCI', 'Manchester United': 'MNU',
  'Chelsea': 'CHE', 'Arsenal': 'ARS', 'Juventus': 'JUV',
  'Inter': 'INT', 'AC Milan': 'ACM', 'Paris Saint-Germain': 'PSG',
  'Atlético Madrid': 'ATM', 'Atletico Madrid': 'ATM',
  'Borussia Dortmund': 'BVB', 'Dortmund': 'BVB',
  'Porto': 'FCP', 'Ajax': 'AJX', 'Benfica': 'SLB', 'Sporting CP': 'SCP',
  'Napoli': 'NAP', 'Atalanta': 'ATA', 'Newcastle United': 'NEW',
  'PSV': 'PSV', 'Monaco': 'ASM', 'Leverkusen': 'B04',
  'Tottenham': 'TOT', 'Tottenham Hotspur': 'TOT',
  'Club Brugge': 'BRU', 'Galatasaray': 'GAL', 'CSKA Moscow': 'CSK',
  'Olympiacos': 'OLY', 'Celtic': 'CEL', 'Rangers': 'RNG',
  'Villarreal': 'VIL', 'Sevilla': 'SEV', 'Valencia': 'VAL',
  'Schalke': 'S04', 'Roma': 'ROM', 'Lazio': 'LAZ',
  'Marseille': 'OM', 'Lyon': 'OL', 'Lille': 'LIL',
  'RB Leipzig': 'RBL', 'Salzburg': 'RBS', 'RB Salzburg': 'RBS',
  'Athletic Club': 'ATH', 'Real Sociedad': 'RSO',
  'Eintracht Frankfurt': 'SGE', 'Union SG': 'USG',
  'FC Kairat': 'KAI', 'Qarabağ': 'QAR', 'Pafos FC': 'PAF',
  'Bodø/Glimt': 'BOD', 'FC Copenhagen': 'FCK', 'Slavia Prague': 'SLA',
}

export function teamCode(club: string): string {
  if (CLUB_CODES[club]) return CLUB_CODES[club]
  const words = club
    .split(/[\s\-/]+/)
    .filter(w => !['fc', 'sc', 'cf', 'ac', 'de', 'the', 'rb', 'af'].includes(w.toLowerCase()))
  if (words.length === 0) return club.slice(0, 3).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  return words.map(w => w[0]).join('').slice(0, 3).toUpperCase()
}

function eraShort(era: Era | string): string {
  return (era as string).slice(2)  // '2006-09' → '06-09'
}

export function SpinWheel({ targetClub, targetEra, onSpinComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [displayClub, setDisplayClub] = useState('')
  const [displayEra, setDisplayEra] = useState('')
  // Incrementing keys retrigger the CSS slot-tick animation on each value change
  const [clubKey, setClubKey] = useState(0)
  const [eraKey,  setEraKey]  = useState(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  // Refs ensure settle() always reads the latest prop values even if they change mid-spin
  const targetClubRef = useRef(targetClub)
  const targetEraRef  = useRef(targetEra)
  targetClubRef.current = targetClub
  targetEraRef.current  = targetEra

  useEffect(() => {
    return () => timersRef.current.forEach(t => clearTimeout(t))
  }, [])

  function after(ms: number, fn: () => void) {
    const t = setTimeout(fn, ms)
    timersRef.current.push(t)
  }

  function setClub(val: string) {
    setDisplayClub(val)
    setClubKey(k => k + 1)
  }
  function setEra(val: string) {
    setDisplayEra(val)
    setEraKey(k => k + 1)
  }

  function handleSpin() {
    if (phase !== 'idle') return
    setPhase('spinning')

    const startTime = performance.now()

    // Fast phase: tick every 70ms for 1400ms — elapsed-time check avoids drift
    function fastTick() {
      setClub(teamCode(randomFrom(SPIN_CLUBS)))
      setEra(eraShort(randomFrom(SPIN_ERAS)))
      if (performance.now() - startTime < 1400) {
        after(70, fastTick)
      } else {
        slowPhase()
      }
    }

    // Slow phase: tick every 140ms for 700ms, easing toward settle
    function slowPhase() {
      const slowStart = performance.now()
      function slowTick() {
        setClub(teamCode(randomFrom(SPIN_CLUBS)))
        setEra(eraShort(randomFrom(SPIN_ERAS)))
        const elapsed = performance.now() - slowStart
        // Gradually increase interval: 140ms → 220ms over the slow phase
        const interval = 140 + Math.floor((elapsed / 700) * 80)
        if (elapsed < 700) {
          after(interval, slowTick)
        } else {
          settle()
        }
      }
      after(140, slowTick)
    }

    // Settle club first, then era — read from refs so skips that change props mid-spin are respected
    function settle() {
      after(120, () => {
        setClub(teamCode(targetClubRef.current))
        setPhase('teamSettled')
        after(480, () => {
          setEra(eraShort(targetEraRef.current))
          setPhase('settled')
          after(800, onSpinComplete)
        })
      })
    }

    after(70, fastTick)
  }

  const teamSettled = phase === 'teamSettled' || phase === 'settled'
  const eraSettled  = phase === 'settled'

  // CSS custom property sets the animation duration for each phase
  const fastDur   = '55ms'
  const slowDur   = '120ms'
  const settleDur = '300ms'
  const clubDur = phase === 'spinning' ? fastDur : teamSettled ? settleDur : slowDur
  const eraDur  = phase === 'spinning' ? fastDur : eraSettled  ? settleDur : slowDur

  return (
    <div className="flex flex-col items-center gap-6 w-full px-2">
      <div className="flex gap-3 items-start w-full justify-center">

        {/* Team card */}
        <div className="flex flex-col items-center gap-2">
          <div className={`
            w-32 h-24 sm:w-40 sm:h-28 rounded-2xl bg-[#13131e] flex flex-col items-center justify-center gap-2
            border-4 transition-all duration-300
            ${teamSettled
              ? 'border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.3)]'
              : phase === 'spinning'
                ? 'border-amber-500/60'
                : 'border-amber-500/30'}
          `}>
            <span className="text-[10px] font-bold tracking-[0.25em] text-orange-400 uppercase">Team</span>
            <span
              key={clubKey}
              className={`slot-tick font-black tracking-wider leading-none overflow-hidden ${
                phase === 'idle' ? 'text-white/15 text-2xl sm:text-4xl' :
                displayClub.length <= 3 ? 'text-2xl sm:text-4xl text-white' : 'text-xl sm:text-3xl text-white'
              }`}
              style={{ '--slot-dur': clubDur } as React.CSSProperties}
            >
              {phase === 'idle' ? '—' : displayClub}
            </span>
          </div>
          <span className="text-xs text-gray-500 max-w-32 sm:max-w-40 text-center truncate">
            {teamSettled ? targetClub : 'Team'}
          </span>
        </div>

        {/* Era card */}
        <div className="flex flex-col items-center gap-2">
          <div className={`
            w-32 h-24 sm:w-40 sm:h-28 rounded-2xl bg-[#13131e] flex flex-col items-center justify-center gap-2
            border-4 transition-all duration-300
            ${eraSettled
              ? 'border-purple-400 shadow-[0_0_40px_rgba(192,132,252,0.3)]'
              : phase !== 'idle'
                ? 'border-purple-500/60'
                : 'border-purple-500/30'}
          `}>
            <span className="text-[10px] font-bold tracking-[0.25em] text-orange-400 uppercase">Era</span>
            <span
              key={eraKey}
              className={`slot-tick text-2xl sm:text-4xl font-black tracking-wider leading-none overflow-hidden ${
                phase === 'idle' ? 'text-white/15' : 'text-white'
              }`}
              style={{ '--slot-dur': eraDur } as React.CSSProperties}
            >
              {phase === 'idle' ? '—' : (displayEra || '—')}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {eraSettled ? targetEra : 'Era'}
          </span>
        </div>

      </div>

      {/* Button / status */}
      {phase === 'idle' && (
        <button
          onClick={handleSpin}
          className="px-16 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-95 text-white font-black text-lg tracking-[0.2em] uppercase transition-all shadow-lg shadow-orange-500/25"
        >
          Spin
        </button>
      )}
      {phase === 'spinning' && (
        <div className="text-gray-500 text-sm tracking-widest uppercase">Spinning…</div>
      )}
      {phase === 'teamSettled' && (
        <div className="text-amber-400 text-sm tracking-widest uppercase">Settling era…</div>
      )}
      {phase === 'settled' && (
        <div className="text-emerald-400 font-semibold text-sm tracking-widest uppercase">Locked in</div>
      )}
    </div>
  )
}
