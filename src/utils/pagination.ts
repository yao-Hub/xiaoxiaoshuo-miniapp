import type { ReaderPageData, ReaderPageLine } from '@/types/reader'

export interface ReaderPaginationLayout {
  textWidthPx: number
  pageHeightPx: number
  fontSizePx: number
  letterSpacingPx: number
  lineHeight: number
  paragraphGapPx: number
  headingHeightPx: number
}

function characterUnits(character: string) {
  if (/\s/.test(character)) {
    return 0.34
  }
  if ((character.codePointAt(0) || 0) <= 0xff) {
    return 0.56
  }
  return 1
}

function isClosingPunctuation(character: string) {
  return /[，。！？；：、）》」』”’]/.test(character)
}

export function estimateTextLines(
  text: string,
  widthPx: number,
  fontSizePx: number,
  letterSpacingPx = 0
) {
  const characterAdvance = Math.max(1, fontSizePx + letterSpacingPx)
  const capacity = Math.max(1, Math.floor(widthPx / characterAdvance))
  let lines = 1
  let used = 0

  for (const character of Array.from(text)) {
    const units = characterUnits(character)
    if (used > 0 && used + units > capacity && !isClosingPunctuation(character)) {
      lines += 1
      used = 0
    }
    used += units
  }
  return lines
}

interface WrappedLine {
  text: string
  startOffset: number
  endOffset: number
}

function wrapParagraph(paragraph: string, capacity: number): WrappedLine[] {
  const characters = Array.from(paragraph.trim())
  const lines: WrappedLine[] = []
  let current = ''
  let usedUnits = 2
  let currentStartOffset = 0

  characters.forEach((character, index) => {
    const units = characterUnits(character)
    const canOverflowForPunctuation = isClosingPunctuation(character) && current.length > 0

    if (usedUnits + units > capacity && !canOverflowForPunctuation) {
      if (current.trim()) {
        lines.push({
          text: current,
          startOffset: currentStartOffset,
          endOffset: index
        })
      }
      current = ''
      usedUnits = 0
      currentStartOffset = index
    }

    current += character
    usedUnits += units
  })

  if (current.trim() || !lines.length) {
    lines.push({
      text: current,
      startOffset: currentStartOffset,
      endOffset: characters.length
    })
  }
  return lines.map((line, index) => ({
    ...line,
    text: index === 0 ? `\u3000\u3000${line.text}` : line.text
  }))
}

export function splitChapterParagraphs(content: string) {
  return String(content || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

export function buildReaderPages(
  paragraphs: string[],
  layout: ReaderPaginationLayout
): ReaderPageData[] {
  const source = paragraphs.map((paragraph) => paragraph.trim()).filter(Boolean)
  if (!source.length) {
    return [{ lines: [], showHeading: true }]
  }

  const characterAdvance = layout.fontSizePx + layout.letterSpacingPx
  const lineCapacity = Math.max(4, Math.floor(layout.textWidthPx / characterAdvance))
  const lineHeightPx = layout.fontSizePx * layout.lineHeight
  const pages: ReaderPageData[] = []
  let currentLines: ReaderPageLine[] = []
  let showHeading = true
  let remainingHeight = Math.max(0, layout.pageHeightPx - layout.headingHeightPx)

  const finishPage = () => {
    pages.push({ lines: currentLines, showHeading })
    currentLines = []
    showHeading = false
    remainingHeight = layout.pageHeightPx
  }

  source.forEach((paragraph, paragraphIndex) => {
    const paragraphLines = wrapParagraph(paragraph, lineCapacity)
    paragraphLines.forEach((text, lineIndex) => {
      const isLastLine = lineIndex === paragraphLines.length - 1

      if (currentLines.length && lineHeightPx > remainingHeight) {
        finishPage()
      }

      currentLines.push({
        text: text.text,
        paragraphEnd: isLastLine,
        paragraphIndex,
        lineStartOffset: text.startOffset,
        lineEndOffset: text.endOffset
      })
      remainingHeight -= lineHeightPx
      if (isLastLine && remainingHeight >= layout.paragraphGapPx) {
        remainingHeight -= layout.paragraphGapPx
      }
    })
  })

  if (currentLines.length || !pages.length) {
    finishPage()
  }
  return pages
}
