"use client"

import { useEffect, useRef, useState } from "react"

export function CO2Counter({ totalKg, inline = false }: {
  totalKg: number
  inline?: boolean
}) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const duration = 1400
    const start    = performance.now()
    function tick(now: number) {
      const p    = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplay(totalKg * ease)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [totalKg])

  const formatted = display.toFixed(1)

  if (inline) {
    return (
      <span className="tabular-nums">
        {formatted}
        <span className="text-base font-medium text-muted-foreground ml-1">kg</span>
      </span>
    )
  }

  return (
    <div className="rounded-xl p-6 text-center bg-card border border-border shadow-sm">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Total CO₂ Avoided
      </p>
      <p className="font-bold leading-none text-green-700 tabular-nums" style={{ fontSize: 44 }}>
        {formatted}
        <span className="text-xl ml-1 font-semibold">kg</span>
      </p>
      {totalKg > 0 && (
        <p className="text-sm text-muted-foreground mt-2">
          ≈ {Math.round(totalKg * 8.3)} km not driven
        </p>
      )}
    </div>
  )
}
