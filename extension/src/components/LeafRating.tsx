export function LeafRating({ rating, size = 18 }: { rating: number; size?: number }) {
  return (
    <span style={{ fontSize: size, lineHeight: 1 }} title={`${rating} out of 5 leaves`}>
      {"🍃".repeat(rating)}{"🤍".repeat(5 - rating)}
    </span>
  )
}
