export function clampReadingPosition(value: number, maximum: number) {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum < 0) {
    return 0
  }
  return Math.min(Math.max(0, value), maximum)
}

export function calculateBookChapterProgress(index: number, total: number) {
  if (!Number.isFinite(index) || !Number.isFinite(total) || total <= 0) {
    return 0
  }
  if (total === 1) {
    return 100
  }
  return Math.round((clampReadingPosition(index, total - 1) / (total - 1)) * 100)
}
