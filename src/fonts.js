// Font files bundled via @fontsource. Vite resolves `?url` imports to hashed
// asset URLs that troika-three-text can fetch without CORS issues. Having
// per-weight files lets the 3D text actually change weight instead of faking
// it with the one default weight troika ships with. Italic variants are
// imported alongside so `.italic()` on Text can swap to a proper italic face
// (troika's `fontStyle` prop only works if the font file itself is italic).
//
// ---- the four designs (AUDIT #5) ----
//
// `.fontDesign(_:)` picks one of four faces, and until the faces were bundled
// the canvas had exactly one of them: three of the four values drew Inter and
// shipped something else, so a serif heading previewed as a grotesque. The
// substitutes are the same kind of stand-in Inter already is for SF Pro —
// chosen for the shape of the face rather than for being the same file:
//
//   .default     SF Pro          → Inter           (already the app's stand-in)
//   .rounded     SF Pro Rounded  → Nunito          (rounded terminals, same
//                                                   geometric-humanist bones)
//   .serif       New York        → Source Serif 4  (a screen-first transitional
//                                                   serif, which is what New
//                                                   York is)
//   .monospaced  SF Mono         → Roboto Mono     (neutral humanist mono at
//                                                   similar proportions)
//
// Every design carries the same four weights and both styles, so a design
// swap never silently changes the weight as well. The CSS faces are loaded in
// `main.jsx` under matching family names: the canvas measures through Canvas2D
// and renders through troika, and those two have to be looking at the same
// face or the text wraps in one place and draws in another.

import interRegular  from '@fontsource/inter/files/inter-latin-400-normal.woff?url'
import interMedium   from '@fontsource/inter/files/inter-latin-500-normal.woff?url'
import interSemibold from '@fontsource/inter/files/inter-latin-600-normal.woff?url'
import interBold     from '@fontsource/inter/files/inter-latin-700-normal.woff?url'

import interRegularItalic  from '@fontsource/inter/files/inter-latin-400-italic.woff?url'
import interMediumItalic   from '@fontsource/inter/files/inter-latin-500-italic.woff?url'
import interSemiboldItalic from '@fontsource/inter/files/inter-latin-600-italic.woff?url'
import interBoldItalic     from '@fontsource/inter/files/inter-latin-700-italic.woff?url'

import roundedRegular  from '@fontsource/nunito/files/nunito-latin-400-normal.woff?url'
import roundedMedium   from '@fontsource/nunito/files/nunito-latin-500-normal.woff?url'
import roundedSemibold from '@fontsource/nunito/files/nunito-latin-600-normal.woff?url'
import roundedBold     from '@fontsource/nunito/files/nunito-latin-700-normal.woff?url'

import roundedRegularItalic  from '@fontsource/nunito/files/nunito-latin-400-italic.woff?url'
import roundedMediumItalic   from '@fontsource/nunito/files/nunito-latin-500-italic.woff?url'
import roundedSemiboldItalic from '@fontsource/nunito/files/nunito-latin-600-italic.woff?url'
import roundedBoldItalic     from '@fontsource/nunito/files/nunito-latin-700-italic.woff?url'

import serifRegular  from '@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff?url'
import serifMedium   from '@fontsource/source-serif-4/files/source-serif-4-latin-500-normal.woff?url'
import serifSemibold from '@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff?url'
import serifBold     from '@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff?url'

import serifRegularItalic  from '@fontsource/source-serif-4/files/source-serif-4-latin-400-italic.woff?url'
import serifMediumItalic   from '@fontsource/source-serif-4/files/source-serif-4-latin-500-italic.woff?url'
import serifSemiboldItalic from '@fontsource/source-serif-4/files/source-serif-4-latin-600-italic.woff?url'
import serifBoldItalic     from '@fontsource/source-serif-4/files/source-serif-4-latin-700-italic.woff?url'

import monoRegular  from '@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff?url'
import monoMedium   from '@fontsource/roboto-mono/files/roboto-mono-latin-500-normal.woff?url'
import monoSemibold from '@fontsource/roboto-mono/files/roboto-mono-latin-600-normal.woff?url'
import monoBold     from '@fontsource/roboto-mono/files/roboto-mono-latin-700-normal.woff?url'

import monoRegularItalic  from '@fontsource/roboto-mono/files/roboto-mono-latin-400-italic.woff?url'
import monoMediumItalic   from '@fontsource/roboto-mono/files/roboto-mono-latin-500-italic.woff?url'
import monoSemiboldItalic from '@fontsource/roboto-mono/files/roboto-mono-latin-600-italic.woff?url'
import monoBoldItalic     from '@fontsource/roboto-mono/files/roboto-mono-latin-700-italic.woff?url'

export const INTER_FONTS = {
  regular:  interRegular,
  medium:   interMedium,
  semibold: interSemibold,
  bold:     interBold
}

export const INTER_FONTS_ITALIC = {
  regular:  interRegularItalic,
  medium:   interMediumItalic,
  semibold: interSemiboldItalic,
  bold:     interBoldItalic
}

// design → { normal, italic } → weight → url.
//
// Keyed by the SwiftUI `FontDesign` case names, because those are the strings
// the modifier stores and the exporter emits — one vocabulary, so a design the
// inspector offers cannot miss a face here without the lookup falling through
// to `default` in the open.
const FONT_FILES = {
  default: {
    normal: INTER_FONTS,
    italic: INTER_FONTS_ITALIC
  },
  rounded: {
    normal: { regular: roundedRegular, medium: roundedMedium, semibold: roundedSemibold, bold: roundedBold },
    italic: { regular: roundedRegularItalic, medium: roundedMediumItalic, semibold: roundedSemiboldItalic, bold: roundedBoldItalic }
  },
  serif: {
    normal: { regular: serifRegular, medium: serifMedium, semibold: serifSemibold, bold: serifBold },
    italic: { regular: serifRegularItalic, medium: serifMediumItalic, semibold: serifSemiboldItalic, bold: serifBoldItalic }
  },
  monospaced: {
    normal: { regular: monoRegular, medium: monoMedium, semibold: monoSemibold, bold: monoBold },
    italic: { regular: monoRegularItalic, medium: monoMediumItalic, semibold: monoSemiboldItalic, bold: monoBoldItalic }
  }
}

// The CSS family name each design is registered under in `main.jsx`. Canvas2D
// measurement takes the family by name; troika takes the file above. The two
// must name the same face, so both come from this one table.
export const FONT_FAMILIES = {
  default: 'Inter',
  rounded: 'Nunito',
  serif: 'Source Serif 4',
  monospaced: 'Roboto Mono'
}

export const FONT_DESIGNS = Object.keys(FONT_FILES)

// The vocabulary the inspector offers, in the order it lists them, with the
// Apple face each one stands for. One list rather than two: a design the
// inspector can set with no face behind it would draw Inter and say nothing
// about it, which is the shape #19 spent a phase on. The Apple names are in
// the labels because the designer is picking a system face, not a bundled one.
export const FONT_DESIGN_OPTIONS = [
  { value: 'default',    label: 'Default (SF Pro)' },
  { value: 'serif',      label: 'Serif (New York)' },
  { value: 'rounded',    label: 'Rounded (SF Rounded)' },
  { value: 'monospaced', label: 'Monospaced (SF Mono)' }
]

// The generic CSS fallback for each design, so a measurement taken before the
// webfont loads lands on something of the right shape rather than on the UI
// sans for all four.
const FONT_FALLBACKS = {
  default: 'system-ui, sans-serif',
  rounded: 'system-ui, sans-serif',
  serif: 'Georgia, serif',
  monospaced: 'ui-monospace, SFMono-Regular, Menlo, monospace'
}

export const fontFamilyFor = (design) => {
  const key = FONT_FAMILIES[design] ? design : 'default'
  return `"${FONT_FAMILIES[key]}", ${FONT_FALLBACKS[key]}`
}

// The file troika should shape with. An unknown design falls back to the
// default face rather than to nothing, so a project carrying a value this
// build has never heard of still renders.
export function getFont(design, weight = 'regular', italic = false) {
  const face = FONT_FILES[design] || FONT_FILES.default
  const table = italic ? face.italic : face.normal
  return table[weight] || table.regular
}

export const getInterFont = (weight = 'regular', italic = false) =>
  getFont('default', weight, italic)
