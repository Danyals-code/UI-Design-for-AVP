// Inter font files bundled via @fontsource/inter. Vite resolves `?url` imports
// to hashed asset URLs that troika-three-text can fetch without CORS issues.
// Having per-weight files lets the 3D text actually change weight instead of
// faking it with the one default weight troika ships with. Italic variants are
// imported alongside so `.italic()` on Text can swap to a proper italic face
// (troika's `fontStyle` prop only works if the font file itself is italic).

import regularUrl  from '@fontsource/inter/files/inter-latin-400-normal.woff?url'
import mediumUrl   from '@fontsource/inter/files/inter-latin-500-normal.woff?url'
import semiboldUrl from '@fontsource/inter/files/inter-latin-600-normal.woff?url'
import boldUrl     from '@fontsource/inter/files/inter-latin-700-normal.woff?url'

import regularItalicUrl  from '@fontsource/inter/files/inter-latin-400-italic.woff?url'
import mediumItalicUrl   from '@fontsource/inter/files/inter-latin-500-italic.woff?url'
import semiboldItalicUrl from '@fontsource/inter/files/inter-latin-600-italic.woff?url'
import boldItalicUrl     from '@fontsource/inter/files/inter-latin-700-italic.woff?url'

export const INTER_FONTS = {
  regular:  regularUrl,
  medium:   mediumUrl,
  semibold: semiboldUrl,
  bold:     boldUrl
}

export const INTER_FONTS_ITALIC = {
  regular:  regularItalicUrl,
  medium:   mediumItalicUrl,
  semibold: semiboldItalicUrl,
  bold:     boldItalicUrl
}

export const getInterFont = (weight = 'regular', italic = false) => {
  const table = italic ? INTER_FONTS_ITALIC : INTER_FONTS
  return table[weight] || table.regular
}
