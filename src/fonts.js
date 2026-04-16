// Inter font files bundled via @fontsource/inter. Vite resolves `?url` imports
// to hashed asset URLs that troika-three-text can fetch without CORS issues.
// Having per-weight files lets the 3D text actually change weight instead of
// faking it with the one default weight troika ships with.

import regularUrl  from '@fontsource/inter/files/inter-latin-400-normal.woff?url'
import mediumUrl   from '@fontsource/inter/files/inter-latin-500-normal.woff?url'
import semiboldUrl from '@fontsource/inter/files/inter-latin-600-normal.woff?url'
import boldUrl     from '@fontsource/inter/files/inter-latin-700-normal.woff?url'

export const INTER_FONTS = {
  regular:  regularUrl,
  medium:   mediumUrl,
  semibold: semiboldUrl,
  bold:     boldUrl
}

export const getInterFont = (weight = 'regular') =>
  INTER_FONTS[weight] || INTER_FONTS.regular
