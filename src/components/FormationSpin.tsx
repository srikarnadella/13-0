import { useState } from 'react'
import { SlotReel } from './SlotReel'
import { spinFormation } from '../lib/formations'
import type { Formation } from '../lib/types'

type Props = {
  onLockIn: (formation: Formation) => void
}

export function FormationSpin({ onLockIn }: Props) {
  const [spinning, setSpinning] = useState(false)
  const [formation, setFormation] = useState<Formation | null>(null)
  const [pending, setPending] = useState<Formation | null>(null)

  function handleSpin() {
    const next = spinFormation()
    setPending(next)
    setSpinning(true)
    setTimeout(() => {
      setSpinning(false)
      setFormation(next)
    }, 1400 + 2 * 320 + 500)
  }

  return (
    <div className="flex flex-col items-center gap-10 fade-up">
      <div className="text-center">
        <h1 className="font-display text-6xl text-white mb-2 tracking-tight">
          Pick your formation
        </h1>
        <p className="text-gray-500 text-sm">Spin to land a formation, lock it in to start drafting</p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="flex gap-5 items-end">
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-widest font-medium">DEF</span>
            <SlotReel
              values={[3, 4, 5]}
              finalValue={pending?.defenders ?? 4}
              spinning={spinning}
              delay={0}
            />
          </div>
          <div className="text-3xl text-gray-700 mb-5 font-display">–</div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-widest font-medium">MID</span>
            <SlotReel
              values={[2, 3, 4]}
              finalValue={pending?.midfielders ?? 3}
              spinning={spinning}
              delay={1}
            />
          </div>
          <div className="text-3xl text-gray-700 mb-5 font-display">–</div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-widest font-medium">FWD</span>
            <SlotReel
              values={[1, 2, 3]}
              finalValue={pending?.forwards ?? 3}
              spinning={spinning}
              delay={2}
            />
          </div>
        </div>

        {formation && !spinning && (
          <div className="font-display text-3xl text-emerald-400 tracking-wide">
            {formation.key}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSpin}
          disabled={spinning}
          className="px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all duration-150"
        >
          {spinning ? 'Spinning…' : formation ? 'Spin again' : 'Spin'}
        </button>
        {formation && !spinning && (
          <button
            onClick={() => onLockIn(formation)}
            className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.97] text-black font-bold transition-all duration-150"
          >
            Lock in →
          </button>
        )}
      </div>
    </div>
  )
}
