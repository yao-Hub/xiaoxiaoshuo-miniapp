<script setup lang="ts">
import { computed } from 'vue'
import type { ReaderHighlightRange, ReaderPageLine } from '@/types/reader'

const props = defineProps<{
  bookTitle: string
  chapterTitle: string
  lines: ReaderPageLine[]
  showHeading: boolean
  fontSizePx: number
  flow: 'page' | 'scroll'
  highlightRange?: ReaderHighlightRange
}>()

const renderedLines = computed(() =>
  props.lines.map((line, lineIndex) => {
    const range = props.highlightRange
    const rangeStart = range
      ? Math.max(range.startOffset, line.lineStartOffset)
      : line.lineStartOffset
    const rangeEnd = range ? Math.min(range.endOffset, line.lineEndOffset) : line.lineStartOffset
    const highlighted =
      Boolean(range) && range?.paragraphIndex === line.paragraphIndex && rangeStart < rangeEnd
    const indentOffset = line.lineStartOffset === 0 ? 2 : 0
    const highlightStart = rangeStart - line.lineStartOffset + indentOffset
    const highlightEnd = rangeEnd - line.lineStartOffset + indentOffset
    return {
      key: `${props.flow}-${lineIndex}`,
      paragraphEnd: line.paragraphEnd,
      segments: highlighted
        ? [
            { text: line.text.slice(0, highlightStart), highlighted: false },
            { text: line.text.slice(highlightStart, highlightEnd), highlighted: true },
            { text: line.text.slice(highlightEnd), highlighted: false }
          ].filter((segment) => segment.text)
        : [{ text: line.text, highlighted: false }]
    }
  })
)
</script>

<template>
  <view
    class="reader-chapter-content"
    :class="`reader-chapter-content--${props.flow}`"
    :style="{ fontSize: `${props.fontSizePx}px` }"
  >
    <template v-if="props.showHeading">
      <view class="book-name">{{ props.bookTitle }}</view>
      <view class="chapter-name">{{ props.chapterTitle }}</view>
      <view class="divider" />
    </template>
    <view
      v-for="line in renderedLines"
      :key="line.key"
      class="reader-line"
      :class="{ 'paragraph-end': line.paragraphEnd }"
    >
      <text class="reader-line-text">
        <text
          v-for="(segment, segmentIndex) in line.segments"
          :key="`${line.key}-${segmentIndex}`"
          :class="{ 'reader-highlight': segment.highlighted }"
          >{{ segment.text }}</text
        >
      </text>
    </view>
  </view>
</template>

<style scoped>
.reader-chapter-content {
  line-height: 1.95;
}

.reader-chapter-content--page {
  height: 100%;
  padding: 12rpx 40rpx 0;
  overflow: hidden;
}

.reader-chapter-content--scroll {
  padding: 12rpx 40rpx calc(24rpx + env(safe-area-inset-bottom));
}

.book-name {
  overflow: hidden;
  color: var(--accent);
  font-size: 28rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
  line-height: 1.95;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapter-name {
  margin-top: 18rpx;
  color: var(--reader-ink);
  font-size: 1.35em;
  font-weight: 800;
  line-height: 1.4;
}

.divider {
  width: 92rpx;
  height: 5rpx;
  margin: 30rpx 0 38rpx;
  background: var(--gold);
  border-radius: 999rpx;
}

.reader-line {
  letter-spacing: 1rpx;
  line-height: 1.95;
  overflow-wrap: anywhere;
  white-space: nowrap;
}

.reader-line.paragraph-end {
  margin-bottom: 30rpx;
}

.reader-highlight {
  color: var(--accent);
}
</style>
