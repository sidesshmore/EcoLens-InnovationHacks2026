const COLORS = {
  high: "#2D6A4F",
  mid: "#F4A261",
  low: "#C62828"
}

function barColor(score: number) {
  if (score >= 65) return COLORS.high
  if (score >= 40) return COLORS.mid
  return COLORS.low
}

export function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = barColor(score)
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#565959", marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color }}>{Math.round(score)}</span>
      </div>
      <div style={{ background: "#E8E8E8", borderRadius: 4, height: 6, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, background: color, height: "100%", borderRadius: 4, transition: "width 0.6s ease" }} />
      </div>
    </div>
  )
}
