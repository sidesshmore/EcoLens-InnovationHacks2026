"use client"

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts"
import type { TrendPoint } from "@/lib/supabase"

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { dataKey: string; value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const co2   = payload.find(p => p.dataKey === "co2")?.value ?? 0
  const scans = payload.find(p => p.dataKey === "scans")?.value ?? 0
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-lg text-xs">
      <p className="font-bold text-slate-900 mb-1">{label}</p>
      <p className="text-emerald-700 font-semibold">{co2} kg CO₂ avoided</p>
      {scans > 0 && (
        <p className="text-slate-500 mt-0.5">{scans} product{scans !== 1 ? "s" : ""} scanned</p>
      )}
    </div>
  )
}

export function ImpactTrendChart({ data }: { data: TrendPoint[] }) {
  const hasData = data.some(d => d.co2 > 0 || d.scans > 0)

  if (!hasData) {
    return (
      <div className="h-[180px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm">No scans yet in the last 14 days</p>
        <p className="text-xs">Install the extension and start scoring products</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          interval={3}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => v === 0 ? "0" : `${v}kg`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#10b981", strokeWidth: 1, strokeDasharray: "3 3" }} />
        <Area
          type="monotone"
          dataKey="co2"
          stroke="#10b981"
          strokeWidth={2.5}
          fill="url(#co2Grad)"
          dot={false}
          activeDot={{ r: 5, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
