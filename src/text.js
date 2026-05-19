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
// We don't have a real font here — glyph advance is approximated from the
// drei/troika rendering used elsewhere on the canvas (`fontSize * 0.55`
// for a typical Inter glyph). The same constant is used by the layout
// engine and the renderer so what the user sees lines up with what the
// stack reserves.

import { ptToUnits } from './appleSystem'

// Average advance for a glyph at `fontSize`, given the current tracking
// (extra inter-character space) and any tighten/scale already applied.
// All inputs in scene units.
export function glyphAdvanceUnits(fontSize, trackingPt = 0, tightenFactor = 1) {
  const baseAdv = fontSize * 0.55
  const tracking = ptToUnits(trackingPt || 0)
  return baseAdv * tightenFactor + tracking
}

// Width of `text` rendered on a single line at the given metrics.
export function singleLineWidth(text, fontSize, trackingPt = 0, tightenFactor = 1) {
  if (!text) return 0
  const adv = glyphAdvanceUnits(fontSize, trackingPt, tightenFactor)
  return text.length * adv
}

// Split `text` into wrapped lines for the given `maxWidth`. Hard
// newlines always break; otherwise we accumulate words separated by
// whitespace and break at the first word that won't fit. If a single
// word is wider than `maxWidth`, we hard-break inside the word at the
// character level (SwiftUI's UAX-14 fallback).
//
// Returns an array of strings (one per visual line).
export function wrapLines(text, fontSize, maxWidth, trackingPt = 0, tightenFactor = 1) {
  if (!text) return ['']
  const adv = glyphAdvanceUnits(fontSize, trackingPt, tightenFactor)
  if (adv <= 0 || maxWidth <= 0) return [text]
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
      if (candidate.length * adv <= maxWidth) {
        line = candidate
        continue
      }
      // Token alone wider than maxWidth → character-break inside the token.
      if (tok.length * adv > maxWidth) {
        // Flush any pending line first.
        if (line) { out.push(line); line = '' }
        let chunk = ''
        for (const ch of tok) {
          if ((chunk + ch).length * adv > maxWidth && chunk) {
            out.push(chunk)
            chunk = ch
          } else {
            chunk += ch
          }
        }
        line = chunk
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
function truncateLine(text, fontSize, maxWidth, mode, trackingPt = 0, tightenFactor = 1) {
  const adv = glyphAdvanceUnits(fontSize, trackingPt, tightenFactor)
  if (adv <= 0) return text
  const budget = Math.max(1, Math.floor(maxWidth / adv))
  if (text.length <= budget) return text
  const ELLIPSIS = '…'
  // Leave at least one slot for the ellipsis itself.
  const keep = Math.max(1, budget - 1)
  if (mode === 'head') return ELLIPSIS + text.slice(text.length - keep)
  if (mode === 'middle') {
    const half = Math.floor(keep / 2)
    return text.slice(0, half) + ELLIPSIS + text.slice(text.length - (keep - half))
  }
  return text.slice(0, keep) + ELLIPSIS // 'tail' (default)
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
    fixedSizeV = false
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
    const longest = hardLines.reduce((m, l) =>
      Math.max(m, singleLineWidth(l, fontSize, trackingPt, 1)), 0)
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
    const intrinsic = singleLineWidth(safeText.split('\n').reduce((a, b) => a.length > b.length ? a : b, ''), fontSize, trackingPt, 1)
    if (intrinsic > maxWidth && intrinsic <= maxWidth * (1 / 0.95)) {
      tightenFactor = Math.max(0.95, maxWidth / intrinsic)
    }
  }

  // Step 2 — scale. If the longest hard-line still doesn't fit, shrink the
  // font (and thus glyph advance) down to `minimumScaleFactor` until it
  // fits — or we hit the floor, in which case wrap takes over.
  let scale = 1
  if (minimumScaleFactor < 1) {
    const longest = safeText.split('\n').reduce((a, b) => a.length > b.length ? a : b, '')
    const intrinsic = singleLineWidth(longest, fontSize, trackingPt, tightenFactor)
    if (intrinsic > maxWidth) {
      const need = maxWidth / intrinsic
      scale = Math.max(minimumScaleFactor, Math.min(1, need))
    }
  }
  const effFontSize = fontSize * scale

  // Step 3 — wrap.
  const wrapped = wrapLines(safeText, effFontSize, maxWidth, trackingPt, tightenFactor)

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
      kept[0] = truncateLine('… ' + kept[0], effFontSize, maxWidth, 'tail', trackingPt, tightenFactor)
      final = kept
    } else if (truncationMode === 'middle') {
      if (lineLimit === 1) {
        // Single-line middle truncation — collapse everything to one
        // string, then ellide the centre per `truncateLine`. Mirrors
        // SwiftUI's `.truncationMode(.middle) + .lineLimit(1)` which
        // drops glyphs from the middle of the joined string.
        const joined = safeText.replace(/\s+/g, ' ').trim()
        final = [truncateLine(joined, effFontSize, maxWidth, 'middle', trackingPt, tightenFactor)]
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
      kept[kept.length - 1] = truncateLine(last + (wrapped[lineLimit] || ''), effFontSize, maxWidth, 'tail', trackingPt, tightenFactor)
      final = kept
    }
  }

  // Measure final block.
  const width = final.reduce((m, l) =>
    Math.max(m, singleLineWidth(l, effFontSize, trackingPt, tightenFactor)), 0)
  const height = final.length * effFontSize * lineHeightFactor + lineGap * Math.max(0, final.length - 1)

  return { lines: final, scale, tightenFactor, width, height, truncated, fontSize: effFontSize }
}
