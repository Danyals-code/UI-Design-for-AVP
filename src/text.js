// SwiftUI-style text measurement and wrapping.
//
// This module is the single source of truth for how Text panels size
// themselves, wrap, tighten, scale, and truncate. The layout engine uses
// it to ask "if I give this text W points of width, how tall does it
// become?" and Panel3D uses it to figure out the final font scale,
// letter-spacing adjustment, and (when truncated) the per-line strings to
// hand to drei's `<Text>`.
//
// The resolution order matches SwiftUI's published behavior:
//   1. tighten      — if `allowsTightening`, shrink kerning up to ~5%
//   2. scale        — if `minimumScaleFactor < 1`, scale font down
//   3. wrap         — break text at UAX-14-ish word boundaries (with a
//                     character fallback for words wider than the bound)
//   4. truncate     — when wrapped line count exceeds `lineLimit`, slice
//                     per `truncationMode` (.head / .middle / .tail) and
//                     drop in an ellipsis.
//
import { ptToUnits } from './appleSystem'

// ---- glyph measurement ------------------------------------------------
//
// How wide is a run of text? Everything below — wrapping, tightening,
// scaling, truncating — reduces to that one question, so it is the single
// pluggable point in this module.
//
// The built-in answer is a uniform advance: every glyph is `fontSize * 0.55`
// wide, the rough average for Inter. It is a poor model of a proportional
// face — "Illinois" and "WWWWWWWW" are the same length and nowhere near the
// same width — so lines wrap in the wrong places relative to the device. Its
// one virtue is that it needs no DOM, which keeps this module pure and its
// tests deterministic.
//
// The browser replaces it at startup with a measurer backed by real font
// metrics (see `src/textMeasure.js`). That is what makes the canvas break
// lines where the device breaks them. Node keeps the approximation, so the
// test suite pins pipeline *behaviour* — line limits, truncation modes,
// scale floors — independently of whichever font happens to be installed.
export const UNIFORM_ADVANCE_RATIO = 0.55

const uniformMeasure = (text, fontSize) => text.length * fontSize * UNIFORM_ADVANCE_RATIO

let measureNatural = uniformMeasure

// Install a measurer: `(text, fontSizeUnits, weight) => widthUnits`, giving
// the natural width of the run before tracking and tightening are applied.
// Passing null restores the built-in approximation.
export function setTextMeasurer(fn) {
  measureNatural = typeof fn === 'function' ? fn : uniformMeasure
}

export function resetTextMeasurer() {
  measureNatural = uniformMeasure
}

// Average advance for a glyph at `fontSize`, given the current tracking and
// any tightening already applied. Retained because callers outside this
// module reason in "roughly how wide is a character" terms; the pipeline
// itself measures whole runs instead, which is the only way to get a
// proportional face right.
export function glyphAdvanceUnits(fontSize, trackingPt = 0, tightenFactor = 1) {
  const baseAdv = fontSize * UNIFORM_ADVANCE_RATIO
  const tracking = ptToUnits(trackingPt || 0)
  return baseAdv * tightenFactor + tracking
}

// Width of `text` rendered on a single line at the given metrics.
//
// Tracking is extra space *per character*, so it scales with the run length
// and is added after tightening — tightening squeezes the glyphs, not the
// letter-spacing the designer asked for. With the uniform measurer this is
// algebraically identical to the old `length × advance`, so installing a
// real measurer is the only thing that changes any number.
export function singleLineWidth(text, fontSize, trackingPt = 0, tightenFactor = 1, weight, design) {
  if (!text) return 0
  return measureNatural(text, fontSize, weight, design) * tightenFactor
       + text.length * ptToUnits(trackingPt || 0)
}

// Longest line by rendered width. Picking by `String.length` instead is the
// classic proportional-font bug: the longest string is very often not the
// widest one.
function widestLine(lines, fontSize, trackingPt, tightenFactor, weight, design) {
  let best = ''
  let bestW = -1
  for (const l of lines) {
    const w = singleLineWidth(l, fontSize, trackingPt, tightenFactor, weight, design)
    if (w > bestW) { bestW = w; best = l }
  }
  return { line: best, width: Math.max(0, bestW) }
}

// Largest `n` for which `slice(text, n)` fits in `maxWidth`. Binary search
// keeps this O(log n) measurements rather than one per character, which
// matters once a real measurer is installed and each call touches a canvas.
// `fromEnd` searches suffixes instead of prefixes.
function fitCharCount(text, fontSize, maxWidth, trackingPt, tightenFactor, weight, design, fromEnd = false) {
  const slice = (n) => fromEnd ? text.slice(text.length - n) : text.slice(0, n)
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (singleLineWidth(slice(mid), fontSize, trackingPt, tightenFactor, weight, design) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return lo
}

// Split `text` into wrapped lines for the given `maxWidth`. Hard
// newlines always break; otherwise we accumulate words separated by
// whitespace and break at the first word that won't fit. If a single
// word is wider than `maxWidth`, we hard-break inside the word at the
// character level (SwiftUI's UAX-14 fallback).
//
// Returns an array of strings (one per visual line).
export function wrapLines(text, fontSize, maxWidth, trackingPt = 0, tightenFactor = 1, weight, design) {
  if (!text) return ['']
  if (fontSize <= 0 || maxWidth <= 0) return [text]
  const width = (s) => singleLineWidth(s, fontSize, trackingPt, tightenFactor, weight, design)
  const out = []

  // Honour hard newlines first — each '\n' starts a new visual line and
  // the wrapper runs independently on each.
  for (const para of text.split('\n')) {
    if (para === '') { out.push(''); continue }
    // Split into tokens but keep the trailing whitespace on each token so
    // word widths include the space that follows them. The final word in
    // a paragraph has no trailing space.
    const tokens = para.match(/\S+\s*|\s+/g) || [para]
    let line = ''
    for (const tok of tokens) {
      const candidate = line + tok
      if (width(candidate) <= maxWidth) {
        line = candidate
        continue
      }
      // Token alone wider than maxWidth → character-break inside the token.
      if (width(tok) > maxWidth) {
        // Flush any pending line first.
        if (line) { out.push(line); line = '' }
        let rest = tok
        while (rest) {
          const n = fitCharCount(rest, fontSize, maxWidth, trackingPt, tightenFactor, weight, design)
          // Always consume at least one character, or a glyph wider than the
          // whole bound would spin here forever.
          const take = Math.max(1, n)
          if (take >= rest.length) { rest = rest.slice(0, take); break }
          out.push(rest.slice(0, take))
          rest = rest.slice(take)
        }
        line = rest
        continue
      }
      // Token fits on its own; just start a new line for it.
      if (line) out.push(line.replace(/\s+$/, ''))
      line = tok
    }
    out.push(line.replace(/\s+$/, ''))
  }
  return out.length ? out : ['']
}

// Truncate a single line to fit `maxWidth` at the given metrics, inserting
// an ellipsis per `mode` (.head | .middle | .tail). Returns the truncated
// string. If the line already fits, returns it unchanged.
function truncateLine(text, fontSize, maxWidth, mode, trackingPt = 0, tightenFactor = 1, weight, design) {
  if (fontSize <= 0 || maxWidth <= 0) return text
  const width = (s) => singleLineWidth(s, fontSize, trackingPt, tightenFactor, weight, design)
  if (width(text) <= maxWidth) return text

  const ELLIPSIS = '…'
  // The ellipsis has to fit too, so the budget for real characters is the
  // bound minus whatever the ellipsis glyph itself costs — which, in a
  // proportional face, is not one average character's worth.
  const budget = Math.max(0, maxWidth - width(ELLIPSIS))

  if (mode === 'head') {
    const keep = fitCharCount(text, fontSize, budget, trackingPt, tightenFactor, weight, design, true)
    return ELLIPSIS + text.slice(text.length - Math.max(1, keep))
  }
  if (mode === 'middle') {
    // Split the budget evenly by width, not by character count — the two
    // halves of a proportional string rarely cost the same.
    const half = budget / 2
    const head = fitCharCount(text, fontSize, half, trackingPt, tightenFactor, weight, design)
    const tail = fitCharCount(text, fontSize, half, trackingPt, tightenFactor, weight, design, true)
    const h = Math.max(1, head)
    const t = Math.max(1, Math.min(tail, text.length - h))
    return text.slice(0, h) + ELLIPSIS + text.slice(text.length - t)
  }
  // 'tail' (default)
  const keep = fitCharCount(text, fontSize, budget, trackingPt, tightenFactor, weight, design)
  return text.slice(0, Math.max(1, keep)) + ELLIPSIS
}

// The full SwiftUI Text pipeline. Inputs and outputs are in scene units.
//
//   text                — raw string (may contain '\n')
//   fontSize            — base font size before scaling (units)
//   maxWidth            — proposed width (units); the wrap bound
//   options:
//     trackingPt        — extra inter-character spacing in pt (default 0)
//     lineSpacingPt     — extra space between visual lines in pt (default 0)
//     lineLimit         — max line count; null/undefined/0 = unlimited
//     truncationMode    — 'head' | 'middle' | 'tail' (default 'tail')
//     minimumScaleFactor— smallest scale before truncation kicks in
//     allowsTightening  — boolean (kerning can shrink by ~5%)
//     fixedSizeH        — when true, ignore maxWidth and report intrinsic
//     fixedSizeV        — when true, never truncate vertically
//
// Returns:
//   { lines, scale, tightenFactor, width, height, truncated, fontSize }
//
//     lines         — array of strings, post-tighten/scale/wrap/truncate
//     scale         — applied font scale (1.0 if no scale)
//     tightenFactor — applied tighten (1.0 if no tightening)
//     width         — measured rendered width (longest line)
//     height        — total rendered height including line spacing
//     truncated     — true when lineLimit clipped at least one line
//     fontSize      — fontSize × scale (the size to render at)
export function measureSwiftUIText(text, fontSize, maxWidth, options = {}) {
  const {
    trackingPt = 0,
    lineSpacingPt = 0,
    lineLimit = null,
    truncationMode = 'tail',
    minimumScaleFactor = 1,
    allowsTightening = false,
    fixedSizeH = false,
    fixedSizeV = false,
    // Font weight ('regular' | 'medium' | 'semibold' | 'bold'). A real
    // measurer needs it: bold Inter is materially wider than regular at the
    // same size, so measuring a heading as regular under-reserves its space
    // and the canvas wraps a line later than the device does.
    fontWeight = 'regular',
    // Font design ('default' | 'rounded' | 'serif' | 'monospaced'). Same
    // reason as the weight: each design is a different face with different
    // advances, so measuring them all as Inter breaks lines in the wrong
    // places. AUDIT #5.
    fontDesign = 'default'
  } = options

  const safeText = text || ''
  const lineGap = ptToUnits(lineSpacingPt || 0)
  // SwiftUI's default line height for Inter at 17pt sits around 1.32× the
  // point size; we use 1.4 to match what drei/troika renders. The same
  // factor is used by every consumer of this module.
  const lineHeightFactor = 1.4

  // `fixedSize(horizontal: true)` — text gets its intrinsic single-line
  // size and never wraps. Width is the natural width of the longest
  // hard-line; height is the count of hard-lines.
  if (fixedSizeH) {
    const hardLines = safeText.split('\n')
    const longest = widestLine(hardLines, fontSize, trackingPt, 1, fontWeight, fontDesign).width
    const h = hardLines.length * fontSize * lineHeightFactor + lineGap * Math.max(0, hardLines.length - 1)
    return {
      lines: hardLines,
      scale: 1,
      tightenFactor: 1,
      width: longest,
      height: h,
      truncated: false,
      fontSize
    }
  }

  // Step 1 — tighten. SwiftUI's `.allowsTightening(true)` lets the layout
  // shrink kerning so a line that's *just barely* over the bound still
  // fits on one line. We model that as a 5% reduction in glyph advance
  // (the typical max SwiftUI applies before falling back to scale/wrap).
  let tightenFactor = 1
  if (allowsTightening) {
    const intrinsic = widestLine(safeText.split('\n'), fontSize, trackingPt, 1, fontWeight, fontDesign).width
    if (intrinsic > maxWidth && intrinsic <= maxWidth * (1 / 0.95)) {
      tightenFactor = Math.max(0.95, maxWidth / intrinsic)
    }
  }

  // Step 2 — scale. If the longest hard-line still doesn't fit, shrink the
  // font (and thus glyph advance) down to `minimumScaleFactor` until it
  // fits — or we hit the floor, in which case wrap takes over.
  let scale = 1
  if (minimumScaleFactor < 1) {
    const intrinsic = widestLine(safeText.split('\n'), fontSize, trackingPt, tightenFactor, fontWeight, fontDesign).width
    if (intrinsic > maxWidth) {
      const need = maxWidth / intrinsic
      scale = Math.max(minimumScaleFactor, Math.min(1, need))
    }
  }
  const effFontSize = fontSize * scale

  // Step 3 — wrap.
  const wrapped = wrapLines(safeText, effFontSize, maxWidth, trackingPt, tightenFactor, fontWeight, fontDesign)

  // Step 4 — truncate. When `lineLimit` is positive and the wrap produced
  // more lines than allowed, slice down and re-truncate the boundary line
  // per `truncationMode`.
  let truncated = false
  let final = wrapped
  if (typeof lineLimit === 'number' && lineLimit > 0 && wrapped.length > lineLimit && !fixedSizeV) {
    truncated = true
    if (truncationMode === 'head') {
      // Drop leading lines, ellipsis-prefix the first kept line.
      const kept = wrapped.slice(wrapped.length - lineLimit)
      kept[0] = truncateLine('… ' + kept[0], effFontSize, maxWidth, 'tail', trackingPt, tightenFactor, fontWeight, fontDesign)
      final = kept
    } else if (truncationMode === 'middle') {
      if (lineLimit === 1) {
        // Single-line middle truncation — collapse everything to one
        // string, then ellide the centre per `truncateLine`. Mirrors
        // SwiftUI's `.truncationMode(.middle) + .lineLimit(1)` which
        // drops glyphs from the middle of the joined string.
        const joined = safeText.replace(/\s+/g, ' ').trim()
        final = [truncateLine(joined, effFontSize, maxWidth, 'middle', trackingPt, tightenFactor, fontWeight, fontDesign)]
      } else {
        const half = Math.floor(lineLimit / 2)
        const head = wrapped.slice(0, half)
        const tail = wrapped.slice(wrapped.length - (lineLimit - half - 1))
        final = [...head, '…', ...tail]
      }
    } else {
      // 'tail' (default) — keep first N lines, add ellipsis on the last.
      const kept = wrapped.slice(0, lineLimit)
      const last = kept[kept.length - 1] + ' '
      kept[kept.length - 1] = truncateLine(last + (wrapped[lineLimit] || ''), effFontSize, maxWidth, 'tail', trackingPt, tightenFactor, fontWeight, fontDesign)
      final = kept
    }
  }

  // Measure final block.
  const width = widestLine(final, effFontSize, trackingPt, tightenFactor, fontWeight, fontDesign).width
  const height = final.length * effFontSize * lineHeightFactor + lineGap * Math.max(0, final.length - 1)

  return { lines: final, scale, tightenFactor, width, height, truncated, fontSize: effFontSize }
}
