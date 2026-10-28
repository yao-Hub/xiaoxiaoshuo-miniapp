export type ReaderTapZone = 'previous' | 'toolbar' | 'next'

const PREVIOUS_ZONE_RATIO = 0.35
const NEXT_ZONE_RATIO = 0.65

export function resolveReaderTapZone(y: number, viewportHeight: number): ReaderTapZone {
  if (!Number.isFinite(y) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return 'toolbar'
  }
  if (y < viewportHeight * PREVIOUS_ZONE_RATIO) {
    return 'previous'
  }
  if (y > viewportHeight * NEXT_ZONE_RATIO) {
    return 'next'
  }
  return 'toolbar'
}

export function resolveHorizontalReaderTapZone(x: number, viewportWidth: number): ReaderTapZone {
  if (!Number.isFinite(x) || !Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    return 'toolbar'
  }
  if (x < viewportWidth * PREVIOUS_ZONE_RATIO) {
    return 'previous'
  }
  if (x > viewportWidth * NEXT_ZONE_RATIO) {
    return 'next'
  }
  return 'toolbar'
}
