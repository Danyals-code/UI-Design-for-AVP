// visionOS / SwiftUI reference data for the AR/VR UI designer.
// The tool targets Apple Vision Pro exclusively — 2D Window mode and
// 3D Volume mode — so device presets are vision-specific.

// 1 scene unit == 1 metre. visionOS uses points (~1360pt = 1m at default
// scaling per Apple's spec) for SwiftUI sizes and metres for RealityKit
// transforms. We unify on metres in canvas space so a 1280pt SwiftUI
// window and a 0.1m RealityKit sphere render at physically correct
// relative scale (≈12.8:1 — matching what designers see on device).
//
// `POINTS_PER_UNIT` (== `POINTS_PER_METER`) is the conversion factor for
// SwiftUI pt-based sizes; `ptToUnits(pt)` returns metres.
// Anything that needs raw metres (RealityKit entities, world positions)
// uses metres directly.
export const POINTS_PER_UNIT = 1360
export const ptToUnits = (pt) => pt / POINTS_PER_UNIT
export const unitsToPt = (u) => Math.round(u * POINTS_PER_UNIT)
// Explicit metres helper for code that wants the conversion direction
// to be obvious. Identity right now (1 unit = 1m) but isolating it as a
// named function lets us re-tune the canvas scale without touching
// every call site.
export const metersToUnits = (m) => m
export const unitsToMeters = (u) => u

// SwiftUI Font.TextStyle — authoritative set.
//
// Weights follow Apple's visionOS typography spec (WWDC23 #10076 + Apple
// Design Resources Figma kit). visionOS bumps body weight one step relative
// to iOS for legibility on glass — body is Medium (vs Regular on iOS) and
// titles/headline render Bold by default. `extraLargeTitle` and
// `extraLargeTitle2` are visionOS-only.
export const TEXT_STYLES = {
  extraLargeTitle:  { label: 'Extra Large Title',   pt: 36, weight: 'bold',    lineHeight: 44 },
  extraLargeTitle2: { label: 'Extra Large Title 2', pt: 28, weight: 'bold',    lineHeight: 34 },
  largeTitle:  { label: 'Large Title',  pt: 34, weight: 'bold',    lineHeight: 41 },
  title:       { label: 'Title',        pt: 28, weight: 'bold',    lineHeight: 34 },
  title2:      { label: 'Title 2',      pt: 22, weight: 'bold',    lineHeight: 28 },
  title3:      { label: 'Title 3',      pt: 20, weight: 'semibold',lineHeight: 25 },
  headline:    { label: 'Headline',     pt: 17, weight: 'bold',    lineHeight: 22 },
  body:        { label: 'Body',         pt: 17, weight: 'medium',  lineHeight: 22 },
  callout:     { label: 'Callout',      pt: 16, weight: 'regular', lineHeight: 21 },
  subheadline: { label: 'Subheadline',  pt: 15, weight: 'regular', lineHeight: 20 },
  footnote:    { label: 'Footnote',     pt: 13, weight: 'regular', lineHeight: 18 },
  caption:     { label: 'Caption',      pt: 12, weight: 'regular', lineHeight: 16 },
  caption2:    { label: 'Caption 2',    pt: 11, weight: 'regular', lineHeight: 13 }
}

export const TEXT_STYLE_ORDER = [
  'extraLargeTitle', 'extraLargeTitle2',
  'largeTitle', 'title', 'title2', 'title3', 'headline',
  'body', 'callout', 'subheadline', 'footnote', 'caption', 'caption2'
]

// Resolve the spec-default weight for a text style. Used by the SwiftUI
// exporter to decide whether to emit `.fontWeight(...)` — if the panel's
// weight matches the visionOS default for its style, the modifier is
// omitted so SwiftUI's own resolution wins on device.
export const textStyleDefaultWeight = (style) =>
  TEXT_STYLES[style]?.weight ?? 'regular'

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
// Window outer corner radius: visionOS HIG / Apple Design Resources cite
// ~46 pt as the system-determined value for the standard glass plate.
// Not formally published, but consistent across simulator measurements.
export const WINDOW_CORNER_RADIUS = 46   // pt
export const WINDOW_BORDER_RADIUS = 46

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
// visionOS bottom ornaments overlap the window edge by 20 pt (WWDC23 #10076).
export const ORNAMENT_GAP = 20 // pt

// SwiftUI button styles.
// `automatic` is the visionOS default — it resolves to a glass-bordered
// capsule for text/text+icon and to a circle for icon-only buttons.
// `glass` / `glassProminent` are the explicit visionOS 26 styles.
// `destructive` isn't a SwiftUI ButtonStyle — it's expressed via the
// `role: .destructive` initializer — kept here as a convenience.
export const BUTTON_STYLES = {
  automatic:         { label: 'Automatic (Glass Capsule)' },
  plain:             { label: 'Plain' },
  borderless:        { label: 'Borderless' },
  bordered:          { label: 'Bordered' },
  borderedProminent: { label: 'Prominent' },
  glass:             { label: 'Glass' },
  glassProminent:    { label: 'Glass Prominent' },
  destructive:       { label: 'Destructive' }
}

// Default `.buttonBorderShape()` shape per visionOS HIG: capsule for
// text/text+icon buttons; circle for icon-only buttons. Other allowed
// values per spec §1.2: `roundedRectangle` (with optional radius) and
// `automatic` (system-decided).
export const BUTTON_BORDER_SHAPES = [
  { value: 'automatic',        label: 'Automatic' },
  { value: 'capsule',          label: 'Capsule' },
  { value: 'circle',           label: 'Circle' },
  { value: 'roundedRectangle', label: 'Rounded Rectangle' }
]

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
  },
  // `.bar` material — used for toolbar/navigation chrome on visionOS.
  // Visually sits between thin and regular; the system tunes it for legibility
  // against toolbar-chrome backgrounds.
  bar: {
    label: 'Bar',
    opacity: 0.62,
    rimOpacity: 0.58,
    specularOpacity: 0.38,
    shadowOpacity: 0.20
  }
}

export const MATERIAL_ORDER = ['ultraThin', 'thin', 'regular', 'thick', 'ultraThick', 'opaque', 'bar']

// HDRIs bundled with the app (public/hdri/). Each `file` is loaded by drei's
// <Environment files=...> via the RGBELoader. Keeping them local-first keeps
// preview reliable offline and avoids any first-use latency.
export const HDRI_PRESETS = {
  none:    { label: 'None',     file: null },
  sample1: { label: 'Sample 1', file: '/hdri/Sample_01_2k.hdr' },
  sample2: { label: 'Sample 2', file: '/hdri/Sample_02_2k.hdr' },
  sample3: { label: 'Sample 3', file: '/hdri/Sample_03_2k.hdr' }
}

export const HDRI_ORDER = ['none', 'sample1', 'sample2', 'sample3']

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
    // Light scheme: a near-white translucent plate. The 92% alpha
    // stamped onto the plate by `LiquidGlass` lets the room peek
    // through the way real visionOS glass does.
    designWindow:              '#ecedef',
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
    // Design scheme — even in dark mode, visionOS plates are not
    // opaque grey. They're a translucent light plate that picks up
    // the environment. The 92% fill opacity gives a glassy lift over
    // the studio decor / room behind.
    designWindow:              '#ecedef',
    designButton:              '#b7b6b1',
    designButtonText:          '#ffffff'
  }
}

export const SEMANTIC_COLOR_ORDER = [
  'primary', 'secondary', 'tertiary', 'quaternary',
  'systemBackground', 'secondarySystemBackground', 'tertiarySystemBackground',
  'systemFill', 'secondarySystemFill', 'tertiarySystemFill', 'quaternarySystemFill',
  'systemBlue', 'systemRed', 'systemGreen', 'systemOrange',
  'systemYellow', 'systemPurple', 'systemPink', 'systemTeal',
  'systemIndigo', 'systemMint', 'systemCyan', 'systemBrown', 'systemGray'
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
  },
  // Spec §1.24 — `ScrollView(_ axes:, showsIndicators:, content:)`. Default
  // axis is `.vertical`. Models a scroll container around child content.
  scrollView: {
    label: 'ScrollView',
    description: 'Scroll container — wraps children on the chosen axis',
    alignments: ['center']
  },
  // Spec §1.24 — `LazyVGrid(columns:, alignment:, spacing:, pinnedViews:, content:)`.
  // Renders rows lazily as they scroll into view; columns drive item width.
  lazyVGrid: {
    label: 'LazyVGrid',
    description: 'Lazy 2D grid — flows columns vertically',
    alignments: ['leading', 'center', 'trailing']
  },
  lazyHGrid: {
    label: 'LazyHGrid',
    description: 'Lazy 2D grid — flows rows horizontally',
    alignments: ['top', 'center', 'bottom']
  },
  // Spec §1.24 — `ViewThatFits(in:[.horizontal,.vertical], content:)`.
  // Picks the first child that fits in the available space.
  viewThatFits: {
    label: 'ViewThatFits',
    description: 'Picks the first child that fits the available space',
    alignments: ['center']
  },
  // Spec §1.26 — `Toolbar` is a SwiftUI modifier (`.toolbar { ... }`) whose
  // body is a builder of `ToolbarItem`/`ToolbarItemGroup`. We model it as
  // a stack so designers can drop items into it; the exporter wires it as
  // a `.toolbar { … }` modifier on the parent view.
  toolbar: {
    label: 'Toolbar',
    description: 'Attaches a toolbar (top, bottom, or ornament) to the parent view',
    alignments: ['center']
  },
  // ToolbarItem — a single placement (`.principal`, `.bottomOrnament`, etc.).
  // `toolbarItem.placement` drives where it lives in the chrome.
  toolbarItem: {
    label: 'ToolbarItem',
    description: 'A single placement slot in a Toolbar',
    alignments: ['center']
  },
  // ToolbarItemGroup — multiple items sharing one placement.
  toolbarItemGroup: {
    label: 'ToolbarItemGroup',
    description: 'A group of toolbar items sharing one placement',
    alignments: ['leading', 'center', 'trailing']
  }
}

export const STACK_TYPE_ORDER = [
  'vstack', 'hstack', 'zstack', 'grid',
  'lazyvstack', 'lazyhstack', 'lazyVGrid', 'lazyHGrid',
  'scrollView', 'viewThatFits',
  'section', 'disclosure', 'navigationStack',
  'tabView', 'tab',
  'toolbar', 'toolbarItem', 'toolbarItemGroup'
]

// ---- Phase 7: Style Modifiers ----

// SwiftUI ToggleStyle — `.checkbox` is intentionally absent: it is
// macOS-only and unavailable on visionOS (spec §1.4).
export const TOGGLE_STYLES = [
  { value: 'automatic', label: 'Automatic (Switch)' },
  { value: 'switch',    label: 'Switch' },
  { value: 'button',    label: 'Button' }
]

// SwiftUI PickerStyle. `.navigationLink` requires an enclosing
// NavigationStack; `.palette` is visionOS 1+. `.automatic` resolves to
// `.menu` on visionOS.
export const PICKER_STYLES = [
  { value: 'automatic',      label: 'Automatic (Menu)' },
  { value: 'menu',           label: 'Menu' },
  { value: 'segmented',      label: 'Segmented' },
  { value: 'wheel',          label: 'Wheel' },
  { value: 'inline',         label: 'Inline' },
  { value: 'palette',        label: 'Palette' },
  { value: 'navigationLink', label: 'Navigation Link' }
]

// SwiftUI LabelStyle. `.automatic` shows icon+title in body context and
// icon-only in toolbars (the visionOS-tuned default).
export const LABEL_STYLES = [
  { value: 'automatic',    label: 'Automatic' },
  { value: 'titleAndIcon', label: 'Title & Icon' },
  { value: 'iconOnly',     label: 'Icon Only' },
  { value: 'titleOnly',    label: 'Title Only' }
]

// SwiftUI TextFieldStyle. `.automatic` resolves on visionOS to a recessed
// glass field (`.thickMaterial` background); `.roundedBorder` is the
// iOS-style rounded rect — kept here so designers can opt into it
// explicitly.
export const TEXTFIELD_STYLES = [
  { value: 'automatic',    label: 'Automatic (Recessed Glass)' },
  { value: 'plain',        label: 'Plain' },
  { value: 'roundedBorder', label: 'Rounded Border' }
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
  { value: 'inset',     label: 'Inset' }
]

// ---- Additional style enums (spec parity, Step 1 foundation) ----
//
// These are surfaced so the inspector (Step 2) and the SwiftUI exporter
// can reference a single source of truth. Ordering follows Apple docs:
// `.automatic` first so it remains the default selection.

export const TAB_VIEW_STYLES = [
  { value: 'automatic',        label: 'Automatic (Glass Ornament)' },
  { value: 'page',             label: 'Page' },
  { value: 'sidebarAdaptable', label: 'Sidebar Adaptable' },
  { value: 'tabBarOnly',       label: 'Tab Bar Only' },
  { value: 'grouped',          label: 'Grouped' }
]

// SwiftUI WindowStyle (visionOS): `.automatic` (glass plate),
// `.plain` (chrome-less), `.volumetric` (bounded 3D volume).
export const WINDOW_STYLES = [
  { value: 'automatic',  label: 'Automatic (Glass Plate)' },
  { value: 'plain',      label: 'Plain' },
  { value: 'volumetric', label: 'Volumetric' }
]

export const DATE_PICKER_STYLES = [
  { value: 'automatic', label: 'Automatic (Compact)' },
  { value: 'compact',   label: 'Compact' },
  { value: 'graphical', label: 'Graphical' },
  { value: 'wheel',     label: 'Wheel' }
]

export const PROGRESS_VIEW_STYLES = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'linear',    label: 'Linear' },
  { value: 'circular',  label: 'Circular' }
]

export const GAUGE_STYLES = [
  { value: 'automatic',                label: 'Automatic (Linear Capacity)' },
  { value: 'linearCapacity',           label: 'Linear Capacity' },
  { value: 'accessoryLinearCapacity',  label: 'Accessory Linear Capacity' },
  { value: 'accessoryLinear',          label: 'Accessory Linear' },
  { value: 'accessoryCircular',        label: 'Accessory Circular' },
  { value: 'accessoryCircularCapacity',label: 'Accessory Circular Capacity' }
]

export const FORM_STYLES = [
  { value: 'automatic', label: 'Automatic (Grouped)' },
  { value: 'grouped',   label: 'Grouped' },
  { value: 'columns',   label: 'Columns' }
]

export const MENU_STYLES = [
  { value: 'automatic',       label: 'Automatic' },
  { value: 'borderlessButton',label: 'Borderless Button' },
  { value: 'button',          label: 'Button' }
]

export const NAVIGATION_SPLIT_VIEW_STYLES = [
  { value: 'automatic',        label: 'Automatic (Balanced)' },
  { value: 'balanced',         label: 'Balanced' },
  { value: 'prominentDetail',  label: 'Prominent Detail' }
]

export const DISCLOSURE_GROUP_STYLES = [
  { value: 'automatic', label: 'Automatic' }
]

export const GROUP_BOX_STYLES = [
  { value: 'automatic', label: 'Automatic' }
]

// SwiftUI MenuOrder / MenuIndicator / MenuActionDismissBehavior.
export const MENU_ORDER = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'priority',  label: 'Priority' },
  { value: 'fixed',     label: 'Fixed' }
]

export const MENU_INDICATOR_VISIBILITY = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'visible',   label: 'Visible' },
  { value: 'hidden',    label: 'Hidden' }
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
// Row gap defaults to 4 pt on visionOS lists — the spec-mandated minimum
// spacing between adjacent items so hover effects on neighbouring rows
// don't visually overlap (WWDC23 #10076).
export const LIST_STYLES = {
  default:      { label: 'Default',       rowH: 44, pad: 12, inset: 20, gap: 4,  showBg: true,  showSeparators: true,  roundedRows: false, groupRadius: 12, showGroupCard: true },
  plain:        { label: 'Plain',         rowH: 44, pad: 0,  inset: 16, gap: 4,  showBg: false, showSeparators: true,  roundedRows: false, groupRadius: 0,  showGroupCard: false },
  inset:        { label: 'Inset',         rowH: 44, pad: 10, inset: 24, gap: 4,  showBg: true,  showSeparators: true,  roundedRows: false, groupRadius: 12, showGroupCard: true },
  insetGrouped: { label: 'Inset Grouped', rowH: 44, pad: 12, inset: 20, gap: 4,  showBg: false, showSeparators: true,  roundedRows: false, groupRadius: 12, showGroupCard: true },
  grouped:      { label: 'Grouped',       rowH: 44, pad: 20, inset: 0,  gap: 4,  showBg: true,  showSeparators: true,  roundedRows: false, groupRadius: 0,  showGroupCard: false },
  sidebar:      { label: 'Sidebar',       rowH: 32, pad: 8,  inset: 12, gap: 4,  showBg: false, showSeparators: false, roundedRows: true,  groupRadius: 8,  showGroupCard: false },
}

export const LIST_STYLE_ORDER = [
  'default', 'plain', 'inset', 'insetGrouped', 'grouped', 'sidebar'
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
  { value: 'automatic',   label: 'Automatic' },
  { value: 'mixed',       label: 'Mixed' },
  { value: 'progressive', label: 'Progressive' },
  { value: 'full',        label: 'Full' }
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

// ---- TextField / SecureField (visionOS) ----
//
// Mirrors SwiftUI's UITextContentType / UIKeyboardType / SubmitLabel / etc.
// We expose the cases that visionOS actually surfaces in its virtual
// keyboard ornament — see spec §1.3.

export const KEYBOARD_TYPES = [
  { value: 'default',          label: 'Default' },
  { value: 'asciiCapable',     label: 'ASCII' },
  { value: 'numbersAndPunctuation', label: 'Numbers & Punctuation' },
  { value: 'URL',              label: 'URL' },
  { value: 'numberPad',        label: 'Number Pad' },
  { value: 'phonePad',         label: 'Phone Pad' },
  { value: 'namePhonePad',     label: 'Name & Phone' },
  { value: 'emailAddress',     label: 'Email' },
  { value: 'decimalPad',       label: 'Decimal' },
  { value: 'twitter',          label: 'Twitter' },
  { value: 'webSearch',        label: 'Web Search' }
]

export const TEXT_CONTENT_TYPES = [
  { value: '',                 label: '— None —' },
  { value: 'name',             label: 'Name' },
  { value: 'givenName',        label: 'Given Name' },
  { value: 'familyName',       label: 'Family Name' },
  { value: 'username',         label: 'Username' },
  { value: 'password',         label: 'Password' },
  { value: 'newPassword',      label: 'New Password' },
  { value: 'oneTimeCode',      label: 'One-Time Code' },
  { value: 'emailAddress',     label: 'Email' },
  { value: 'telephoneNumber',  label: 'Phone' },
  { value: 'URL',              label: 'URL' },
  { value: 'fullStreetAddress',label: 'Address' },
  { value: 'postalCode',       label: 'Postal Code' },
  { value: 'creditCardNumber', label: 'Credit Card' }
]

export const SUBMIT_LABELS = [
  { value: 'return',   label: 'Return' },
  { value: 'done',     label: 'Done' },
  { value: 'go',       label: 'Go' },
  { value: 'send',     label: 'Send' },
  { value: 'search',   label: 'Search' },
  { value: 'next',     label: 'Next' },
  { value: 'continue', label: 'Continue' },
  { value: 'join',     label: 'Join' },
  { value: 'route',    label: 'Route' }
]

export const TEXT_AUTOCAPITALIZATION = [
  { value: 'sentences',  label: 'Sentences (default)' },
  { value: 'never',      label: 'Never' },
  { value: 'characters', label: 'Characters' },
  { value: 'words',      label: 'Words' }
]

// ---- DatePicker components & ProgressView/Gauge label edges ----

export const DATE_COMPONENTS = [
  { value: 'date',                label: 'Date Only' },
  { value: 'hourAndMinute',       label: 'Time Only' },
  { value: 'dateAndTime',         label: 'Date + Time (default)' },
  { value: 'hourMinuteAndSecond', label: 'Time + Seconds (visionOS 2+)' }
]

// ---- Volume metadata (visionOS volumetric windows, spec §3.2) ----
//
// Apple maps point space to physical metres at exactly 1360 pt = 1 m on
// visionOS. We expose the conversion here so the Volume inspector can
// display real-world dimensions, and the SwiftUI exporter can emit
// `.defaultSize(width:height:depth:in: .meters)` directly.

export const POINTS_PER_METER = 1360
export const ptToMeters = (pt) => pt / POINTS_PER_METER
export const metersToPt = (m) => m * POINTS_PER_METER

export const WORLD_SCALING_BEHAVIOR = [
  { value: 'automatic',       label: 'Automatic (volumes → fixed)' },
  { value: 'dynamic',         label: 'Dynamic (window-like)' },
  { value: 'fixed',           label: 'Fixed (real-world)' },
  { value: 'trackingSurface', label: 'Tracking Surface (visionOS 26)' }
]

export const VOLUME_BASEPLATE_VISIBILITY = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'visible',   label: 'Visible' },
  { value: 'hidden',    label: 'Hidden' }
]

export const VOLUME_WORLD_ALIGNMENT = [
  { value: 'adaptive',      label: 'Adaptive (default, visionOS 2+)' },
  { value: 'gravityAligned',label: 'Gravity Aligned' }
]

export const VOLUME_VIEWPOINTS = [
  { value: 'all',     label: 'All four sides (default)' },
  { value: 'front',   label: 'Front only' },
  { value: 'frontBack', label: 'Front + Back' }
]

// ---- Glass background & container background (visionOS, spec §3.3) ----
//
// `.glassBackgroundEffect(displayMode:)` adds Apple's tuned translucent
// layer with specular highlights. The optional `in: shape` overload
// (visionOS 2+) lets the designer pick a containing shape that produces
// the highlight curve. `.containerBackground(_:for:)` paints the window
// or navigation chrome background and is window-scoped on visionOS.

export const GLASS_DISPLAY_MODES = [
  { value: 'never',    label: 'Never (off)' },
  { value: 'always',   label: 'Always' },
  { value: 'implicit', label: 'Implicit (cascaded)' }
]

export const GLASS_SHAPES = [
  { value: 'auto',             label: 'Container Relative (default)' },
  { value: 'capsule',          label: 'Capsule' },
  { value: 'circle',           label: 'Circle' },
  { value: 'roundedRectangle', label: 'Rounded Rectangle' },
  { value: 'rectangle',        label: 'Rectangle (no specular)' }
]

export const CONTAINER_BG_PLACEMENTS = [
  { value: 'window',     label: 'Window' },
  { value: 'navigation', label: 'Navigation' }
]

// ---- Image scale (Label, Image, SF Symbol) ----

export const IMAGE_SCALES = [
  { value: 'small',  label: 'Small' },
  { value: 'medium', label: 'Medium (default)' },
  { value: 'large',  label: 'Large' }
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
