import { useEffect, useRef, useState } from 'react'

type Props = {
  values: (string | number)[]
  finalValue: string | number
  spinning: boolean
  delay?: number
  onSettled?: () => void
}

export function SlotReel({ values, finalValue, spinning, delay = 0, onSettled }: Props) {
  const [display, setDisplay] = useState<string | number>(finalValue)
  const [displayKey, setDisplayKey] = useState(0)
  const [settled, setSettled] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!spinning) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current)  clearTimeout(timeoutRef.current)
      setDisplay(finalValue)
      setDisplayKey(k => k + 1)
      setSettled(false)
      return
    }

    setSettled(false)

    timeoutRef.current = setTimeout(() => {
      let i = 0
      // Gradually slow down: start fast, end slow
      let interval = 70

      function tick() {
        setDisplay(values[i % values.length])
        setDisplayKey(k => k + 1)
        i++
        // Ease the interval from 70ms → 180ms over the spin duration
        interval = Math.min(interval + 2, 180)
        intervalRef.current = setTimeout(tick, interval) as unknown as ReturnType<typeof setInterval>
      }

      intervalRef.current = setTimeout(tick, interval) as unknown as ReturnType<typeof setInterval>

      timeoutRef.current = setTimeout(() => {
        if (intervalRef.current) clearTimeout(intervalRef.current as unknown as ReturnType<typeof setTimeout>)
        setDisplay(finalValue)
        setDisplayKey(k => k + 1)
        setSettled(true)
        onSettled?.()
      }, 1400 + delay * 300)
    }, delay * 320)

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current as unknown as ReturnType<typeof setTimeout>)
      if (timeoutRef.current)  clearTimeout(timeoutRef.current)
    }
  }, [spinning, finalValue]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`
      w-24 h-24 rounded-xl border flex items-center justify-center overflow-hidden
      transition-all duration-400
      ${settled
        ? 'border-emerald-400 text-emerald-400 bg-emerald-400/10 shadow-[0_0_24px_rgba(52,211,153,0.2)]'
        : spinning
          ? 'border-white/30 text-white bg-white/5'
          : 'border-white/20 text-white bg-white/5'}
    `}>
      <span
        key={displayKey}
        className="slot-tick font-display text-5xl"
        style={{ '--slot-dur': settled ? '300ms' : spinning ? '65ms' : '0ms' } as React.CSSProperties}
      >
        {display}
      </span>
    </div>
  )
}
