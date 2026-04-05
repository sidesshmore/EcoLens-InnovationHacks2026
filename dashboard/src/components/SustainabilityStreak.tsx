interface SustainabilityStreakProps {
  streak: number
  scanCount: number
}

const MILESTONES = [
  { days: 7, label: "Week Warrior", icon: "🌱" },
  { days: 30, label: "Eco Month", icon: "🌿" },
  { scans: 100, label: "Century Scanner", icon: "🏆" },
]

export function SustainabilityStreak({ streak, scanCount }: SustainabilityStreakProps) {
  const earned = MILESTONES.filter(
    (m) => (m.days ? streak >= m.days : scanCount >= (m.scans ?? 0))
  )

  return (
    <div className="rounded-2xl p-5" style={{ background: "#1A252F", border: "1px solid #2d3e4e" }}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">🔥</span>
        <div>
          <div className="font-bold text-lg" style={{ color: "#FF9900" }}>
            {streak}-day streak
          </div>
          <div className="text-xs" style={{ color: "#888" }}>
            Sustainable choices on {streak} consecutive purchases
          </div>
        </div>
      </div>

      {earned.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-2" style={{ color: "#888" }}>BADGES EARNED</div>
          <div className="flex gap-2 flex-wrap">
            {earned.map((m) => (
              <div
                key={m.label}
                className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: "#2D6A4F", color: "#B7E4C7" }}
              >
                {m.icon} {m.label}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 text-xs" style={{ color: "#666" }}>
        {scanCount} total scans
      </div>
    </div>
  )
}
