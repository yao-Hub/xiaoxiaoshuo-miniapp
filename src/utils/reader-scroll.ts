import type { ReaderChapterBlock } from '@/types/reader'

export interface ReaderScrollBlockMetric {
  key: string
  top: number
  height: number
}

export interface ReaderScrollWindowUpdate {
  blocks: ReaderChapterBlock[]
  activeBlockIndex: number
  prependedBlocks: ReaderChapterBlock[]
}

export function mergeAdjacentScrollBlocks(
  blocks: ReaderChapterBlock[],
  activeChapterUrl: string,
  previous?: ReaderChapterBlock,
  next?: ReaderChapterBlock
): ReaderScrollWindowUpdate {
  const sourceIndex = blocks.findIndex((block) => block.key === activeChapterUrl)
  if (sourceIndex < 0) {
    return {
      blocks,
      activeBlockIndex: -1,
      prependedBlocks: []
    }
  }

  const mergedBlocks = [...blocks]
  const prependedBlocks: ReaderChapterBlock[] = []
  let activeBlockIndex = sourceIndex
  if (previous && !mergedBlocks.some((block) => block.key === previous.key)) {
    mergedBlocks.splice(activeBlockIndex, 0, previous)
    prependedBlocks.push(previous)
    activeBlockIndex += 1
  }
  if (next && !mergedBlocks.some((block) => block.key === next.key)) {
    mergedBlocks.splice(activeBlockIndex + 1, 0, next)
  }

  return {
    blocks: mergedBlocks,
    activeBlockIndex,
    prependedBlocks
  }
}

export function resolveScrollBlockIndex(metrics: ReaderScrollBlockMetric[], scrollTop: number) {
  const index = metrics.findIndex((metric) => scrollTop < metric.top + metric.height)
  return index >= 0 ? index : Math.max(0, metrics.length - 1)
}
