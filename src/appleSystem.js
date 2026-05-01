// visionOS / SwiftUI reference data for the AR/VR UI designer.
// The tool targets Apple Vision Pro exclusively — 2D Window mode and
// 3D Volume mode — so device presets are vision-specific.

// 1 scene unit == 200 points. A 1000pt window is 5 units wide.
export const POINTS_PER_UNIT = 200
export const ptToUnits = (pt) => pt / POINTS_PER_UNIT
export const unitsToPt = (u) => Math.round(u * POINTS_PER_UNIT)

// SwiftUI Font.TextStyle — authoritative set.
export const TEXT_STYLES = {
  largeTitle:  { label: 'Large Title',  pt: 34, weight: 'regular',  lineHeight: 41 },
  title:       { label: 'Title',        pt: 28, weight: 'regular',  lineHeight: 34 },
  title2:      { label: 'Title 2',      pt: 22, weight: 'regular',  lineHeight: 28 },
  title3:      { label: 'Title 3',      pt: 20, weight: 'regular',  lineHeight: 25 },
  headline:    { label: 'Headline',     pt: 17, weight: 'semibold', lineHeight: 22 },
  body:        { label: 'Body',         pt: 17, weight: 'regular',  lineHeight: 22 },
  callout:     { label: 'Callout',      pt: 16, weight: 'regular',  lineHeight: 21 },
  subheadline: { label: 'Subheadline',  pt: 15, weight: 'regular',  lineHeight: 20 },
  footnote:    { label: 'Footnote',     pt: 13, weight: 'regular',  lineHeight: 18 },
  caption:     { label: 'Caption',      pt: 12, weight: 'regular',  lineHeight: 16 },
  caption2:    { label: 'Caption 2',    pt: 11, weight: 'regular',  lineHeight: 13 }
}

export const TEXT_STYLE_ORDER = [
  'largeTitle', 'title', 'title2', 'title3', 'headline',
  'body', 'callout', 'subheadline', 'footnote', 'caption', 'caption2'
]

// visionOS window sizes. These match Apple's default "regular" window.
// Users can resize the window freely; these are just starting presets.
export const WINDOW_PRESETS = {
  regular:  { label: 'Regular',  width: 1636, height: 1142 },
  wide:     { label: 'Wide',     width: 1600, height: 900 },
  tall:     { label: 'Tall',     width: 900,  height: 1200 },
  compact:  { label: 'Compact',  width: 960,  height: 600 },
  square:   { label: 'Square',   width: 1000, height: 1000 }
}

export const VOLUME_PRESETS = {
  small:   { label: 'Small',   width: 600,  height: 600,  depth: 600 },
  medium:  { label: 'Medium',  width: 1000, height: 800,  depth: 800 },
  large:   { label: 'Large',   width: 1400, height: 1000, depth: 1200 }
}

// visionOS uses a glass material for window backgrounds. We approximate with
// a translucent fill + subtle border in the scene.
export const WINDOW_CORNER_RADIUS = 25   // pt — matches the 1636×1142 regular preset
export const WINDOW_BORDER_RADIUS = 25

// Default inner padding applied to a Window's content stack. Matches the
// 14pt edge inset used by Apple's reference layouts for a regular visionOS
// window at 1636×1142.
export const WINDOW_PADDING = 14

// Default NavigationSplitView sidebar sizing when in 'separated' style —
// the sidebar becomes a standalone rounded dialogue on the leading edge.
export const SPLIT_SEPARATED_WIDTH = 370   // pt
export const SPLIT_SEPARATED_RADIUS = 30   // pt

// visionOS ornament placements (attached chrome outside the window).
// All sizes in iOS points. The designer treats each ornament as a Stack
// pinned to one edge of the parent Window with a capsule background.
export const ORNAMENT_PLACEMENTS = {
  leading:  { label: 'Leading Sidebar' },
  trailing: { label: 'Trailing Sidebar' },
  top:      { label: 'Top Bar' },
  bottom:   { label: 'Bottom Bar' }
}

export const ORNAMENT_DEFAULTS = {
  leading:  { stackType: 'vstack', width: 60,  height: 320, padding: 12, spacing: 14, name: 'Leading Sidebar' },
  trailing: { stackType: 'vstack', width: 60,  height: 320, padding: 12, spacing: 14, name: 'Trailing Sidebar' },
  top:      { stackType: 'hstack', width: 320, height: 56,  padding: 10, spacing: 12, name: 'Top Bar' },
  bottom:   { stackType: 'hstack', width: 320, height: 56,  padding: 10, spacing: 12, name: 'Bottom Bar' }
}

// Gap between the window edge and the attached ornament.
export const ORNAMENT_GAP = 24 // pt

// SwiftUI button styles.
export const BUTTON_STYLES = {
  plain:             { label: 'Plain' },
  bordered:          { label: 'Bordered' },
  borderedProminent: { label: 'Prominent' },
  destructive:       { label: 'Destructive' }
}

// Apple visionOS Liquid Glass material tiers. Every tier renders as a
// layered liquid-glass stack (drop shadow + frosted base + bright rim +
// top specular). Opacity and rim strength vary with the tier to match
// SwiftUI semantics: lower tiers let more of the world through.
//
// Per-tier constants consumed by the liquid-glass renderer in SceneTree.
export const MATERIALS = {
  ultraThin: {
    label: 'Ultra Thin',
    opacity: 0.42,
    rimOpacity: 0.55,
    specularOpacity: 0.35,
    shadowOpacity: 0.18
  },
  thin: {
    label: 'Thin',
    opacity: 0.55,
    rimOpacity: 0.60,
    specularOpacity: 0.40,
    shadowOpacity: 0.22
  },
  regular: {
    label: 'Regular',
    opacity: 0.72,
    rimOpacity: 0.68,
    specularOpacity: 0.45,
    shadowOpacity: 0.28
  },
  thick: {
    label: 'Thick',
    opacity: 0.88,
    rimOpacity: 0.62,
    specularOpacity: 0.42,
    shadowOpacity: 0.32
  },
  ultraThick: {
    label: 'Ultra Thick',
    opacity: 0.96,
    rimOpacity: 0.55,
    specularOpacity: 0.38,
    shadowOpacity: 0.36
  },
  opaque: {
    label: 'Opaque',
    opacity: 1.0,
    rimOpacity: 0.0,
    specularOpacity: 0.0,
    shadowOpacity: 0.30
  }
}

export const MATERIAL_ORDER = ['ultraThin', 'thin', 'regular', 'thick', 'ultraThick', 'opaque']

// drei <Environment> presets used by the HDRI picker.
export const HDRI_PRESETS = {
  none:      { label: 'None',      preset: null },
  apartment: { label: 'Apartment', preset: 'apartment' },
  city:      { label: 'City',      preset: 'city' },
  dawn:      { label: 'Dawn',      preset: 'dawn' },
  forest:    { label: 'Forest',    preset: 'forest' },
  lobby:     { label: 'Lobby',     preset: 'lobby' },
  night:     { label: 'Night',     preset: 'night' },
  park:      { label: 'Park',      preset: 'park' },
  studio:    { label: 'Studio',    preset: 'studio' },
  sunset:    { label: 'Sunset',    preset: 'sunset' },
  warehouse: { label: 'Warehouse', preset: 'warehouse' }
}

// SwiftUI-equivalent semantic color tokens.
// Stored as pre-blended 6-digit hex for THREE.Color.
export const SYSTEM_COLORS = {
  light: {
    primary:                   '#000000',
    secondary:                 '#8e8e93',
    tertiary:                  '#c7c7cc',
    quaternary:                '#d1d1d6',
    systemBackground:          '#ffffff',
    secondarySystemBackground: '#f2f2f7',
    tertiarySystemBackground:  '#ffffff',
    systemFill:                '#e3e3e8',
    secondarySystemFill:       '#ebebf0',
    systemRed:                 '#ff3b30',
    systemOrange:              '#ff9500',
    systemYellow:              '#ffcc00',
    systemGreen:               '#34c759',
    systemMint:                '#00c7be',
    systemTeal:                '#30b0c7',
    systemCyan:                '#32ade6',
    systemBlue:                '#007aff',
    systemIndigo:              '#5856d6',
    systemPurple:              '#af52de',
    systemPink:                '#ff2d55',
    systemBrown:               '#a2845e',
    systemGray:                '#8e8e93',
    // visionOS glass materials (approximated)
    glassRegular:              '#f2f2f7',
    glassThin:                 '#ffffff',
    glassThick:                '#e5e5ea',
    // Design scheme — the colours a finished Vision Pro layout uses.
    // Light scheme: white windows, black text, pill buttons stay neutral grey.
    designWindow:              '#ffffff',
    designButton:              '#b7b6b1',
    designButtonText:          '#000000'
  },
  dark: {
    primary:                   '#ffffff',
    secondary:                 '#8e8e93',
    tertiary:                  '#48484a',
    quaternary:                '#3a3a3c',
    systemBackground:          '#000000',
    secondarySystemBackground: '#1c1c1e',
    tertiarySystemBackground:  '#2c2c2e',
    systemFill:                '#545458',
    secondarySystemFill:       '#4a4a4e',
    systemRed:                 '#ff453a',
    systemOrange:              '#ff9f0a',
    systemYellow:              '#ffd60a',
    systemGreen:               '#30d158',
    systemMint:                '#66d4cf',
    systemTeal:                '#40cbe0',
    systemCyan:                '#64d2ff',
    systemBlue:                '#0a84ff',
    systemIndigo:              '#5e5ce6',
    systemPurple:              '#bf5af2',
    systemPink:                '#ff375f',
    systemBrown:               '#ac8e68',
    systemGray:                '#8e8e93',
    glassRegular:              '#39393c',
    glassThin:                 '#45454a',
    glassThick:                '#2c2c2f',
    // Design scheme — dark visionOS reference values from Apple's layout.
    designWindow:              '#9ea1a2',
    designButton:              '#b7b6b1',
    designButtonText:          '#ffffff'
  }
}

export const SEMANTIC_COLOR_ORDER = [
  'primary', 'secondary', 'tertiary', 'quaternary',
  'systemBackground', 'secondarySystemBackground', 'tertiarySystemBackground',
  'systemFill', 'secondarySystemFill',
  'systemBlue', 'systemRed', 'systemGreen', 'systemOrange',
  'systemYellow', 'systemPurple', 'systemPink', 'systemTeal',
  'systemIndigo', 'systemGray'
]

export const resolveSemantic = (token, scheme) =>
  SYSTEM_COLORS[scheme]?.[token] || SYSTEM_COLORS.light[token] || '#000000'

// SwiftUI stack types + alignments.
export const STACK_TYPES = {
  vstack: {
    label: 'VStack',
    description: 'Arranges children vertically',
    alignments: ['leading', 'center', 'trailing']
  },
  hstack: {
    label: 'HStack',
    description: 'Arranges children horizontally',
    alignments: ['top', 'center', 'bottom']
  },
  zstack: {
    label: 'ZStack',
    description: 'Overlays children',
    alignments: [
      'topLeading',    'top',    'topTrailing',
      'leading',       'center', 'trailing',
      'bottomLeading', 'bottom', 'bottomTrailing'
    ]
  },
  grid: {
    label: 'Grid',
    description: 'Arranges children in a 2D grid with N columns',
    alignments: ['leading', 'center', 'trailing']
  },
  lazyvstack: {
    label: 'LazyVStack',
    description: 'Vertical stack with deferred loading',
    alignments: ['leading', 'center', 'trailing']
  },
  lazyhstack: {
    label: 'LazyHStack',
    description: 'Horizontal stack with deferred loading',
    alignments: ['top', 'center', 'bottom']
  },
  section: {
    label: 'Section',
    description: 'Grouped section with header and optional footer',
    alignments: ['leading', 'center', 'trailing']
  },
  disclosure: {
    label: 'DisclosureGroup',
    description: 'Expandable/collapsible group',
    alignments: ['leading', 'center', 'trailing']
  },
  navigationStack: {
    label: 'NavigationStack',
    description: 'Push/pop navigation — shows one child at a time',
    alignments: ['center']
  },
  tabView: {
    label: 'TabView (Navigation Stack)',
    description: 'Shows one Tab at a time — select via the active tab index',
    alignments: ['center']
  },
  tab: {
    label: 'Tab',
    description: 'A single named tab within a TabView',
    alignments: ['leading', 'center', 'trailing']
  }
}

export const STACK_TYPE_ORDER = [
  'vstack', 'hstack', 'zstack', 'grid',
  'lazyvstack', 'lazyhstack',
  'section', 'disclosure', 'navigationStack',
  'tabView', 'tab'
]

// ---- Phase 7: Style Modifiers ----

export const TOGGLE_STYLES = [
  { value: 'switch',   label: 'Switch' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'button',   label: 'Button' }
]

export const PICKER_STYLES = [
  { value: 'menu',      label: 'Menu' },
  { value: 'segmented', label: 'Segmented' },
  { value: 'wheel',     label: 'Wheel' },
  { value: 'inline',    label: 'Inline' },
  { value: 'palette',   label: 'Palette' }
]

export const LABEL_STYLES = [
  { value: 'titleAndIcon', label: 'Title & Icon' },
  { value: 'iconOnly',     label: 'Icon Only' },
  { value: 'titleOnly',    label: 'Title Only' }
]

export const TEXTFIELD_STYLES = [
  { value: 'roundedBorder', label: 'Rounded Border' },
  { value: 'plain',         label: 'Plain' }
]

export const CONTROL_SIZES = [
  { value: 'mini',    label: 'Mini' },
  { value: 'small',   label: 'Small' },
  { value: 'regular', label: 'Regular' },
  { value: 'large',   label: 'Large' },
  { value: 'extraLarge', label: 'Extra Large' }
]

export const TABLE_STYLES = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'inset',     label: 'Inset' },
  { value: 'bordered',  label: 'Bordered' }
]

// List styles mirror SwiftUI's ListStyle protocol: DefaultListStyle,
// PlainListStyle, InsetListStyle, InsetGroupedListStyle, GroupedListStyle,
// SidebarListStyle, BorderedListStyle (macOS), CarouselListStyle (watchOS),
// EllipticalListStyle (watchOS). Each style drives row height, outer padding,
// horizontal inset, whether the list has its own glass background, whether
// separators are drawn, and whether rows are grouped into a rounded card.
// Row height is style-driven (Apple doesn't expose a user knob for it on
// List — consistent spacing is part of the style contract).
//
// All values are in POINTS.
export const LIST_STYLES = {
  default:      { label: 'Default',       rowH: 44, pad: 12, inset: 20, gap: 0,  showBg: true,  showSeparators: true,  roundedRows: false, groupRadius: 12, showGroupCard: true },
  plain:        { label: 'Plain',         rowH: 44, pad: 0,  inset: 16, gap: 0,  showBg: false, showSeparators: true,  roundedRows: false, groupRadius: 0,  showGroupCard: false },
  inset:        { label: 'Inset',         rowH: 44, pad: 10, inset: 24, gap: 0,  showBg: true,  showSeparators: true,  roundedRows: false, groupRadius: 12, showGroupCard: true },
  insetGrouped: { label: 'Inset Grouped', rowH: 44, pad: 12, inset: 20, gap: 0,  showBg: false, showSeparators: true,  roundedRows: false, groupRadius: 12, showGroupCard: true },
  grouped:      { label: 'Grouped',       rowH: 44, pad: 20, inset: 0,  gap: 0,  showBg: true,  showSeparators: true,  roundedRows: false, groupRadius: 0,  showGroupCard: false },
  sidebar:      { label: 'Sidebar',       rowH: 32, pad: 8,  inset: 12, gap: 2,  showBg: false, showSeparators: false, roundedRows: true,  groupRadius: 8,  showGroupCard: false },
  bordered:     { label: 'Bordered',      rowH: 28, pad: 0,  inset: 0,  gap: 0,  showBg: true,  showSeparators: true,  roundedRows: false, groupRadius: 6,  showGroupCard: false, bordered: true },
  carousel:     { label: 'Carousel',      rowH: 72, pad: 12, inset: 16, gap: 10, showBg: false, showSeparators: false, roundedRows: true,  groupRadius: 16, showGroupCard: false },
  elliptical:   { label: 'Elliptical',    rowH: 72, pad: 12, inset: 28, gap: 8,  showBg: false, showSeparators: false, roundedRows: true,  groupRadius: 22, showGroupCard: false, tapered: true }
}

export const LIST_STYLE_ORDER = [
  'default', 'plain', 'inset', 'insetGrouped', 'grouped',
  'sidebar', 'bordered', 'carousel', 'elliptical'
]

// Auto-height for a List based on its style + row count. Row height is
// style-driven (Apple doesn't expose per-row overrides on List).
// Returns height in POINTS.
export function computeListHeightPt(panel) {
  const style = LIST_STYLES[panel.listStyle] || LIST_STYLES.default
  const rows = panel.rows || []
  const n = rows.length
  if (n === 0) return style.pad * 2 + style.rowH  // empty-state shows one row slot
  const rowsH = n * style.rowH + Math.max(0, n - 1) * (style.gap || 0)
  return rowsH + style.pad * 2
}

// ---- Phase 8: SF Symbols ----
// Curated subset of ~60 commonly-used SF Symbols for visionOS.
// Each entry maps a symbol name to a Unicode glyph that visually
// approximates the symbol when rendered with a standard font.

export const SF_SYMBOLS = {
  'house':           { glyph: '\u2302', label: 'House' },
  'house.fill':      { glyph: '\u2302', label: 'House Fill' },
  'gear':            { glyph: '\u2699', label: 'Gear' },
  'gearshape':       { glyph: '\u2699', label: 'Gearshape' },
  'person':          { glyph: '\u263A', label: 'Person' },
  'person.fill':     { glyph: '\u263A', label: 'Person Fill' },
  'person.circle':   { glyph: '\u263A', label: 'Person Circle' },
  'star':            { glyph: '\u2606', label: 'Star' },
  'star.fill':       { glyph: '\u2605', label: 'Star Fill' },
  'heart':           { glyph: '\u2661', label: 'Heart' },
  'heart.fill':      { glyph: '\u2665', label: 'Heart Fill' },
  'magnifyingglass': { glyph: '\u26B2', label: 'Search' },
  'bell':            { glyph: '\u266A', label: 'Bell' },
  'bell.fill':       { glyph: '\u266A', label: 'Bell Fill' },
  'envelope':        { glyph: '\u2709', label: 'Envelope' },
  'envelope.fill':   { glyph: '\u2709', label: 'Envelope Fill' },
  'paperplane':      { glyph: '\u27A2', label: 'Send' },
  'square.and.arrow.up': { glyph: '\u21E7', label: 'Share' },
  'doc':             { glyph: '\u25A1', label: 'Document' },
  'folder':          { glyph: '\u2603', label: 'Folder' },
  'trash':           { glyph: '\u2717', label: 'Trash' },
  'pencil':          { glyph: '\u270F', label: 'Pencil' },
  'plus':            { glyph: '+',      label: 'Plus' },
  'minus':           { glyph: '\u2212', label: 'Minus' },
  'xmark':           { glyph: '\u2715', label: 'Close' },
  'checkmark':       { glyph: '\u2713', label: 'Checkmark' },
  'chevron.right':   { glyph: '\u203A', label: 'Chevron Right' },
  'chevron.left':    { glyph: '\u2039', label: 'Chevron Left' },
  'chevron.up':      { glyph: '\u2303', label: 'Chevron Up' },
  'chevron.down':    { glyph: '\u2304', label: 'Chevron Down' },
  'arrow.left':      { glyph: '\u2190', label: 'Arrow Left' },
  'arrow.right':     { glyph: '\u2192', label: 'Arrow Right' },
  'arrow.up':        { glyph: '\u2191', label: 'Arrow Up' },
  'arrow.down':      { glyph: '\u2193', label: 'Arrow Down' },
  'photo':           { glyph: '\u25A3', label: 'Photo' },
  'camera':          { glyph: '\u25A3', label: 'Camera' },
  'video':           { glyph: '\u25B6', label: 'Video' },
  'play':            { glyph: '\u25B6', label: 'Play' },
  'pause':           { glyph: '\u2016', label: 'Pause' },
  'stop':            { glyph: '\u25A0', label: 'Stop' },
  'speaker.wave.2':  { glyph: '\u266B', label: 'Speaker' },
  'mic':             { glyph: '\u2316', label: 'Mic' },
  'phone':           { glyph: '\u260E', label: 'Phone' },
  'bubble.left':     { glyph: '\u2601', label: 'Chat' },
  'map':             { glyph: '\u2637', label: 'Map' },
  'location':        { glyph: '\u2316', label: 'Location' },
  'clock':           { glyph: '\u23F0', label: 'Clock' },
  'calendar':        { glyph: '\u2637', label: 'Calendar' },
  'bookmark':        { glyph: '\u2610', label: 'Bookmark' },
  'bookmark.fill':   { glyph: '\u2611', label: 'Bookmark Fill' },
  'tag':             { glyph: '\u2606', label: 'Tag' },
  'lock':            { glyph: '\u26BF', label: 'Lock' },
  'lock.open':       { glyph: '\u26BF', label: 'Unlock' },
  'eye':             { glyph: '\u25C9', label: 'Eye' },
  'eye.slash':       { glyph: '\u25C9', label: 'Eye Slash' },
  'wifi':            { glyph: '\u2630', label: 'WiFi' },
  'battery.100':     { glyph: '\u2588', label: 'Battery' },
  'globe':           { glyph: '\u2641', label: 'Globe' },
  'info.circle':     { glyph: '\u2139', label: 'Info' },
  'exclamationmark.triangle': { glyph: '\u26A0', label: 'Warning' },
  'questionmark.circle': { glyph: '?', label: 'Help' },
  // --- additions to cover the visionOS reference apps (Photos, News,
  // Shortcuts, Settings). Keeping the SwiftUI SF Symbol names verbatim so a
  // future code-export step can emit `Image(systemName: "...")` unchanged.
  'folder.fill':                 { glyph: '\u2603', label: 'Folder Fill' },
  'folder.badge.plus':           { glyph: '\u2603', label: 'Folder Add' },
  'doc.viewfinder.fill':         { glyph: '\u25A3', label: 'Scan Document' },
  'list.bullet':                 { glyph: '\u2630', label: 'List Bullet' },
  'square.grid.2x2':             { glyph: '\u29C9', label: 'Grid 2×2' },
  'square.grid.2x2.fill':        { glyph: '\u29C9', label: 'Grid 2×2 Fill' },
  'square.stack.fill':           { glyph: '\u25A3', label: 'Stack Fill' },
  'applewatch':                  { glyph: '\u23F1', label: 'Apple Watch' },
  'photo.on.rectangle.angled':   { glyph: '\u25A3', label: 'Photo Library' },
  'cube':                        { glyph: '\u25A2', label: 'Cube' },
  'pano':                        { glyph: '\u25AD', label: 'Panorama' },
  'ellipsis':                    { glyph: '\u2026', label: 'More' },
  'person.crop.circle':          { glyph: '\u263A', label: 'Account' },
  'person.crop.circle.fill':     { glyph: '\u263A', label: 'Account Fill' },
  'person.2.fill':               { glyph: '\u263B', label: 'People' },
  'newspaper.fill':              { glyph: '\u25A4', label: 'News' },
  'n.square.fill':               { glyph: 'N',      label: 'News+' },
  'fork.knife.circle.fill':      { glyph: '\u29B0', label: 'Recipes' },
  'clock.fill':                  { glyph: '\u23F0', label: 'History' },
  'bell.badge':                  { glyph: '\u266A', label: 'Notifications' },
  'rectangle.on.rectangle':      { glyph: '\u25A2', label: 'Reader' },
  'applelogo':                   { glyph: '\uF8FF', label: 'Apple' },
  'gearshape.fill':              { glyph: '\u2699', label: 'General' },
  'gearshape.2.fill':            { glyph: '\u2699', label: 'Settings' },
  'mountain.2.fill':             { glyph: '\u26F0', label: 'Environments' },
  'accessibility':               { glyph: '\u267F', label: 'Accessibility' },
  'sun.max.fill':                { glyph: '\u2600', label: 'Appearance' },
  'apple.logo':                  { glyph: '\uF8FF', label: 'Apple' },
  'switch.2':                    { glyph: '\u29BE', label: 'Control Center' },
  'key.fill':                    { glyph: '\u26BF', label: 'Passwords' },
  'character.book.closed.fill':  { glyph: '\u2611', label: 'Dictionary' },
  'textformat':                  { glyph: '\u212A', label: 'Fonts' },
  'keyboard':                    { glyph: '\u2328', label: 'Keyboard' },
  'visionpro':                   { glyph: '\u25D4', label: 'Vision Pro' },
  'laptopcomputer':              { glyph: '\u2328', label: 'Laptop' },
  'tray':                        { glyph: '\u25AD', label: 'Inbox' },
  'archivebox':                  { glyph: '\u2601', label: 'Archive' }
}

export const SF_SYMBOL_ORDER = Object.keys(SF_SYMBOLS)

export const SYMBOL_RENDERING_MODES = [
  { value: 'monochrome',   label: 'Monochrome' },
  { value: 'hierarchical', label: 'Hierarchical' },
  { value: 'palette',      label: 'Palette' },
  { value: 'multicolor',   label: 'Multicolor' }
]

export const SYMBOL_VARIANTS = [
  { value: null,     label: 'Default' },
  { value: 'fill',   label: 'Fill' },
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'slash',  label: 'Slash' }
]

// ---- Phase 9: Animation & Transitions ----

export const ANIMATION_CURVES = [
  { value: 'default',   label: 'Default' },
  { value: 'easeIn',    label: 'Ease In' },
  { value: 'easeOut',   label: 'Ease Out' },
  { value: 'easeInOut', label: 'Ease In Out' },
  { value: 'linear',    label: 'Linear' },
  { value: 'spring',    label: 'Spring' },
  { value: 'bouncy',    label: 'Bouncy' },
  { value: 'snappy',    label: 'Snappy' },
  { value: 'smooth',    label: 'Smooth' }
]

export const TRANSITION_TYPES = [
  { value: 'opacity',  label: 'Opacity' },
  { value: 'slide',    label: 'Slide' },
  { value: 'scale',    label: 'Scale' },
  { value: 'move',     label: 'Move' },
  { value: 'push',     label: 'Push' },
  { value: 'identity', label: 'Identity (none)' }
]

// ---- Phase 10: visionOS Spatial ----

export const IMMERSION_STYLES = [
  { value: 'mixed',       label: 'Mixed' },
  { value: 'full',        label: 'Full' },
  { value: 'progressive', label: 'Progressive' }
]

export const HOVER_EFFECTS = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'highlight', label: 'Highlight' },
  { value: 'lift',      label: 'Lift' },
  { value: 'none',      label: 'None' }
]

export const GESTURE_TYPES = [
  { value: 'tap',     label: 'Tap' },
  { value: 'longPress', label: 'Long Press' },
  { value: 'drag',    label: 'Drag' },
  { value: 'magnify', label: 'Magnify' },
  { value: 'rotate',  label: 'Rotate' },
  { value: 'spatial', label: 'Spatial' }
]

export const WINDOW_RESIZABILITY = [
  { value: 'automatic',      label: 'Automatic' },
  { value: 'contentSize',    label: 'Content Size' },
  { value: 'contentMinSize', label: 'Content Min Size' }
]

// ---- Phase 11: Accessibility ----

export const ACCESSIBILITY_TRAITS = [
  { value: 'isButton',           label: 'Button' },
  { value: 'isHeader',           label: 'Header' },
  { value: 'isSelected',         label: 'Selected' },
  { value: 'isLink',             label: 'Link' },
  { value: 'isSearchField',      label: 'Search Field' },
  { value: 'isImage',            label: 'Image' },
  { value: 'isStaticText',       label: 'Static Text' },
  { value: 'playsSound',         label: 'Plays Sound' },
  { value: 'isKeyboardKey',      label: 'Keyboard Key' },
  { value: 'isSummaryElement',   label: 'Summary' },
  { value: 'startsMediaSession', label: 'Starts Media' },
  { value: 'allowsDirectInteraction', label: 'Direct Interaction' }
]

// SwiftUI ToolbarItem placements.
export const TOOLBAR_PLACEMENTS = {
  topBarLeading:     { label: 'Top Bar Leading' },
  topBarTrailing:    { label: 'Top Bar Trailing' },
  principal:         { label: 'Principal (center)' },
  bottomBar:         { label: 'Bottom Bar' },
  confirmationAction:{ label: 'Confirmation Action' },
  cancellationAction:{ label: 'Cancellation Action' }
}
