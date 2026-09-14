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

// Segmented control frame, fitted to its segment count. Each segment is
// 88pt wide with 4pt gaps between segments and a 4pt edge inset, on a
// fixed 44pt-tall pill: width = 88·n + 4·(n−1) + 4·2 = 92·n + 4. So two
// segments = 188×44 (88px selection thumb + 36 tall after the 4pt inset).
export const SEGMENT_PT = 88
export const SEGMENT_GAP_PT = 4
export const SEGMENT_HEIGHT_PT = 44
export const segmentedFrame = (n) => {
  const count = Math.max(1, n || 1)
  return [ptToUnits(92 * count + 4), ptToUnits(SEGMENT_HEIGHT_PT)]
}

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

// ---- Attachment text ramp (volumetric-window typography) --------------
//
// Apple-standard type ramp scaled for RealityView Attachments inside a
// volumetric window. The wearer's default pose (VOLUME_VR_POS in
// Canvas3D.jsx) sits ~1.5m from the volume centre, so attachments use
// larger equivalent-pt sizes than the 40cm 2D window ramp (TEXT_STYLES)
// to stay legible at wearer distance. Padding and corner radius scale
// with the font so a `body` chip and a `largeTitle` chip both read as
// "Apple standard" — no arbitrary picking of raw metre values.
//
// Horizontal padding is ~1.55× vertical, mirroring SwiftUI's
// `.padding(.horizontal, 20).padding(.vertical, 12)` convention for
// capsule chips. Vertical stays tighter so the chip hugs its cap-height
// while horizontal breathes for glyph shoulder-space.
//
// All values in metres. Approximate on-device pt equivalents in the
// trailing comment for reference (1m ≈ 1360pt at our canvas scale).
export const ATTACHMENT_TEXT_STYLES = {
  caption:         { label: 'Caption',           fontSize: 0.014, hPadding: 0.010, vPadding: 0.006, cornerRadius: 0.010, weight: 'regular'  },  // ~19pt
  footnote:        { label: 'Footnote',          fontSize: 0.018, hPadding: 0.012, vPadding: 0.008, cornerRadius: 0.012, weight: 'regular'  },  // ~24pt
  subheadline:     { label: 'Subheadline',       fontSize: 0.020, hPadding: 0.014, vPadding: 0.009, cornerRadius: 0.013, weight: 'regular'  },  // ~27pt
  body:            { label: 'Body',              fontSize: 0.022, hPadding: 0.016, vPadding: 0.010, cornerRadius: 0.014, weight: 'medium'   },  // ~30pt — visionOS body weight
  callout:         { label: 'Callout',           fontSize: 0.024, hPadding: 0.018, vPadding: 0.011, cornerRadius: 0.015, weight: 'medium'   },  // ~33pt
  headline:        { label: 'Headline',          fontSize: 0.028, hPadding: 0.020, vPadding: 0.012, cornerRadius: 0.016, weight: 'semibold' },  // ~38pt
  title3:          { label: 'Title 3',           fontSize: 0.032, hPadding: 0.024, vPadding: 0.014, cornerRadius: 0.018, weight: 'semibold' },  // ~44pt
  title2:          { label: 'Title 2',           fontSize: 0.036, hPadding: 0.028, vPadding: 0.016, cornerRadius: 0.020, weight: 'bold'     },  // ~49pt
  title:           { label: 'Title',             fontSize: 0.040, hPadding: 0.032, vPadding: 0.018, cornerRadius: 0.022, weight: 'bold'     },  // ~54pt
  largeTitle:      { label: 'Large Title',       fontSize: 0.048, hPadding: 0.036, vPadding: 0.020, cornerRadius: 0.024, weight: 'bold'     },  // ~65pt
  extraLargeTitle: { label: 'Extra Large Title', fontSize: 0.058, hPadding: 0.042, vPadding: 0.024, cornerRadius: 0.028, weight: 'bold'     }   // ~79pt
}

export const ATTACHMENT_TEXT_STYLE_ORDER = [
  'caption', 'footnote', 'subheadline', 'body', 'callout',
  'headline', 'title3', 'title2', 'title', 'largeTitle', 'extraLargeTitle'
]

// Attachment shape — matches SwiftUI's `.background(_, in:)` shape options.
// `capsule` auto-computes cornerRadius = half of the frame's short axis so
// the panel caps as a pill (matches SwiftUI's Capsule() shape). `roundedRect`
// uses the resolved cornerRadius from the text-style ramp (or an override).
export const ATTACHMENT_SHAPES = [
  { value: 'roundedRect', label: 'Rounded Rectangle' },
  { value: 'capsule',     label: 'Capsule (Pill)' }
]

// Resolve an attachment's effective sizing from its `attachmentTextStyle`
// key + optional explicit overrides. `attachmentFontSize`,
// `attachmentPadding` / `attachmentHPadding` / `attachmentVPadding`,
// `attachmentCornerRadius` still win when set — the ramp is a default,
// not a lock. `attachmentPadding` legacy field forces both axes; the
// H/V split falls back to the ramp otherwise.
export function resolveAttachmentStyle(entity) {
  const key = entity?.attachmentTextStyle || 'body'
  const style = ATTACHMENT_TEXT_STYLES[key] || ATTACHMENT_TEXT_STYLES.body
  const legacyPad = entity?.attachmentPadding
  return {
    fontSize:     entity?.attachmentFontSize     ?? style.fontSize,
    hPadding:     entity?.attachmentHPadding     ?? legacyPad ?? style.hPadding,
    vPadding:     entity?.attachmentVPadding     ?? legacyPad ?? style.vPadding,
    cornerRadius: entity?.attachmentCornerRadius ?? style.cornerRadius,
    weight:       entity?.attachmentWeight       ?? style.weight
  }
}

// Resolve the spec-default weight for a text style. Used by the SwiftUI
// exporter to decide whether to emit `.fontWeight(...)` — if the panel's
// weight matches the visionOS default for its style, the modifier is
// omitted so SwiftUI's own resolution wins on device.
export const textStyleDefaultWeight = (style) =>
  TEXT_STYLES[style]?.weight ?? 'regular'

// visionOS window sizes. The Regular preset is the default frame for a
// freshly-created window (or when no window is selected) — 1200×800
// gives a comfortably wide landscape canvas that matches the proportions
// most visionOS reference apps ship with. Other presets stay around for
// designers who want a different starting frame.
export const WINDOW_PRESETS = {
  regular:  { label: 'Regular',  width: 1200, height: 800 },
  wide:     { label: 'Wide',     width: 1280, height: 720 },
  tall:     { label: 'Tall',     width: 720,  height: 1080 },
  compact:  { label: 'Compact',  width: 640,  height: 480 },
  square:   { label: 'Square',   width: 720,  height: 720 }
}

// Volume sizes follow Apple's `.defaultSize(_, _, _, in: .meters)` —
// the canonical example is 0.6 × 0.4 × 0.6 m. We store them in pt
// for the canvas (1360pt = 1m) so they round-trip cleanly through
// the layout engine, then re-emit in metres at export time.
export const VOLUME_PRESETS = {
  small:   { label: 'Small',   width: 544,  height: 408,  depth: 544 },   // 0.4 × 0.3 × 0.4 m
  medium:  { label: 'Medium',  width: 816,  height: 544,  depth: 816 },   // 0.6 × 0.4 × 0.6 m (Apple default)
  large:   { label: 'Large',   width: 1224, height: 816,  depth: 1224 }   // 0.9 × 0.6 × 0.9 m
}

// visionOS uses a glass material for window backgrounds. We approximate with
// a translucent fill + subtle border in the scene.
// Window outer corner radius: 30pt matches Apple's current visionOS Figma
// kit (the standard glass plate component and the separated-sidebar
// plate both ship at 30pt). The earlier 46pt traced to visionOS 1.0
// simulator measurements that have since drifted to the modern value.
export const WINDOW_CORNER_RADIUS = 30   // pt
export const WINDOW_BORDER_RADIUS = 30

// Default inner padding applied to a Window's content stack. Matches the
// 14pt edge inset used by Apple's reference layouts for a regular visionOS
// window at 1636×1142.
export const WINDOW_PADDING = 14

// Default NavigationSplitView sidebar sizing when in 'separated' style —
// the sidebar becomes a standalone rounded dialogue on the leading edge.
// Apple's visionOS Figma kit ships the separated sidebar at 320pt wide.
export const SPLIT_SEPARATED_WIDTH = 320   // pt
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

// Vertical tab bars (leading / trailing ornaments) follow Apple's visionOS
// Figma kit — 68pt wide, ~180pt tall for a 3-item icon-only bar, with
// tight 6pt inter-icon spacing and 8pt outer padding. Height is the
// ornament's intrinsic size for 3 items; designers grow it by adding
// tabs (the layout engine hugs the contents in 'fit' mode).
export const ORNAMENT_DEFAULTS = {
  leading:  { stackType: 'vstack', width: 68,  height: 180, padding: 8,  spacing: 6,  name: 'Leading Sidebar' },
  trailing: { stackType: 'vstack', width: 68,  height: 180, padding: 8,  spacing: 6,  name: 'Trailing Sidebar' },
  top:      { stackType: 'hstack', width: 320, height: 56,  padding: 10, spacing: 12, name: 'Top Bar' },
  bottom:   { stackType: 'hstack', width: 320, height: 56,  padding: 10, spacing: 12, name: 'Bottom Bar' }
}

// Gap between the window edge and the attached ornament.
// visionOS bottom ornaments overlap the window edge by 20 pt (WWDC23 #10076).
export const ORNAMENT_GAP = 20 // pt

// Button size presets. visionOS surfaces three fixed sizes; each one
// determines the button frame, the text point size, and (via the renderer)
// the leading SF-Symbol inset. Side padding is a constant 12pt, baked into
// the renderer in `Panel3D.jsx`. The numbers below are the single source of
// truth — the inspector reads them when the user picks a size, the canvas
// reads them when rendering, and the SwiftUI exporter reads them when
// emitting `.frame()` (when an override is needed).
export const BUTTON_SIZES = {
  small:   { label: 'Small',   width:  65, height: 32, fontPt: 15 },
  regular: { label: 'Regular', width:  86, height: 44, fontPt: 17 },
  large:   { label: 'Large',   width: 101, height: 52, fontPt: 19 }
}
export const BUTTON_SIZE_ORDER = ['small', 'regular', 'large']

// Button shape presets — drives corner radius only. Capsule renders as a
// pill (radius 100pt — effectively the full half-height, which visually
// caps both ends at the spec). Rounded Rect uses a 16pt radius — the
// visionOS Figma kit's secondary button shape.
export const BUTTON_SHAPES = {
  capsule:          { label: 'Capsule',     radiusPt: 100 },
  roundedRectangle: { label: 'Rounded Rect', radiusPt:  16 }
}
export const BUTTON_SHAPE_ORDER = ['capsule', 'roundedRectangle']

// Fixed text inset (side padding) inside every button, applied by the
// renderer to the text's horizontal placement. Matches the Apple Figma
// kit's 12pt edge-to-glyph spec.
export const BUTTON_TEXT_INSET_PT = 12

// Measure a string's width in points using a canvas 2D context with
// Inter (the font the canvas renders with via troika). Buttons use this
// to grow their frame so a longer label still fits on a single line
// with the 12pt side padding intact. The 0.58-glyph-advance fallback is
// only used during SSR / when `document` isn't available — the renderer
// always runs in the browser so the canvas path is the live one.
let _btnMeasureCanvas = null
export function measureTextWidthPt(text, fontSizePt, weight = 'regular') {
  if (!text) return 0
  if (typeof document === 'undefined') return text.length * fontSizePt * 0.58
  if (!_btnMeasureCanvas) _btnMeasureCanvas = document.createElement('canvas')
  const ctx = _btnMeasureCanvas.getContext('2d')
  if (!ctx) return text.length * fontSizePt * 0.58
  const cssWeight = weight === 'bold' ? 700
    : weight === 'semibold' ? 600
    : weight === 'medium' ? 500 : 400
  ctx.font = `${cssWeight} ${fontSizePt}px Inter, system-ui, sans-serif`
  return ctx.measureText(text).width
}

// Resolve a button panel's *effective* frame in points. Height is locked
// to its `buttonSize` preset; width is **always** `textWidth + 2×12pt`
// padding (plus a small reserve when there's a leading SF Symbol) so
// the padding stays exactly 12pt on each side regardless of label
// length. A short label shrinks the button; a long label grows it. The
// only floor is the preset height — keeps an empty button from
// collapsing to a 24pt sliver while it's being authored.
export function computeButtonFramePt(panel) {
  const preset  = buttonSizePreset(panel?.controlSize || panel?.buttonSize || 'regular')
  const fontPt  = preset.fontPt
  // +1pt safety margin on the measured width — troika's text layout
  // and canvas 2D's advance metric can disagree by a fraction at the
  // tail of the last glyph, and we'd rather over-pad by half a pt than
  // wrap a label.
  const labelW  = measureTextWidthPt(panel?.text || '', fontPt, panel?.fontWeight) + 1
  // Leading-symbol reserve: icon glyph (~fontPt × 1.1) + 4pt gap.
  const symbolReserve = panel?.symbolName ? fontPt * 1.1 + 4 : 0
  const needed = labelW + symbolReserve + BUTTON_TEXT_INSET_PT * 2
  return [Math.max(preset.height, needed), preset.height]
}

// SwiftUI button styles.
// `automatic` is the visionOS default — it resolves to a glass-bordered
// capsule for text/text+icon and to a circle for icon-only buttons.
// `glass` / `glassProminent` are the explicit visionOS 26 styles.
//
// Every key here is emitted verbatim as `.buttonStyle(.<key>)`, so every key
// has to name a real `ButtonStyle`. `destructive` used to sit in this list
// as "a convenience" and produced `.buttonStyle(.destructive)`, which does
// not compile: destructive is a `ButtonRole`, carried by the separate
// `buttonRole` field and emitted as `Button(role: .destructive)`. Scenes
// that still carry it are normalised by `normalizeButton` below.
export const BUTTON_STYLES = {
  automatic:         { label: 'Automatic (Glass Capsule)' },
  plain:             { label: 'Plain' },
  borderless:        { label: 'Borderless' },
  bordered:          { label: 'Bordered' },
  borderedProminent: { label: 'Prominent' },
  glass:             { label: 'Glass' },
  glassProminent:    { label: 'Glass Prominent' }
}

// Bring a button's legacy field shapes onto the canonical ones.
//
// Buttons accumulated three pairs of fields that meant one thing each, where
// the canvas read one half and the exporter read the other:
//
//   buttonStyle: 'destructive'  ->  buttonRole: 'destructive'
//     Not a ButtonStyle at all. `.buttonStyle(.destructive)` does not
//     compile; the role is what the designer meant.
//   buttonSize                  ->  controlSize
//     Same concept, two vocabularies. `.controlSize` is the real SwiftUI
//     spelling, so it wins and the canvas metrics key off it.
//   buttonShape                 ->  buttonBorderShape
//     Same concept, and `buttonShape` was only ever mirrored into a stored
//     `cornerRadius` the renderer read. The radius is derived now.
//
// Shared by the project loader (so the inspector shows the corrected value)
// and by the button emitter (so a scene already in memory, or a template
// that has not been re-seeded, still exports correct Swift).
export function normalizeButton(panel) {
  if (!panel) return panel
  let out = panel
  const set = (patch) => { out = { ...out, ...patch } }

  if (out.buttonStyle === 'destructive') {
    set({
      buttonStyle: 'automatic',
      buttonRole: out.buttonRole && out.buttonRole !== 'none' ? out.buttonRole : 'destructive'
    })
  }
  if (out.buttonSize && !out.controlSize) set({ controlSize: out.buttonSize })
  if (out.buttonShape && (!out.buttonBorderShape || out.buttonBorderShape === 'automatic')) {
    set({ buttonBorderShape: out.buttonShape })
  }
  return out
}

// visionOS ships three standard button frames. `controlSize` carries five
// cases, because SwiftUI applies it to every control; the two the canvas has
// no spec for collapse onto the nearest one it does. Approximating on the
// canvas is honest — the exported `.controlSize(.mini)` is still exact.
export function buttonSizePreset(controlSize) {
  const key = controlSize === 'mini' ? 'small'
            : controlSize === 'extraLarge' ? 'large'
            : controlSize
  return BUTTON_SIZES[key] || BUTTON_SIZES.regular
}

// Corner radius in points for a button's border shape. `automatic` is the
// visionOS default, which draws a capsule for text and text+icon buttons.
export function buttonRadiusPt(buttonBorderShape) {
  const key = !buttonBorderShape || buttonBorderShape === 'automatic'
    ? 'capsule'
    : buttonBorderShape
  return (BUTTON_SHAPES[key] || BUTTON_SHAPES.capsule).radiusPt
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
// Each material entry carries the full property set the renderer
// needs: base color (single-fill tint), composite opacity, optional
// layered passes (D6D6D6 + #000000-style), a frosted-glass blur toggle
// + radius, and optional inner / drop shadow descriptors. The Scene →
// Materials & Colors editor lets the user override any of these
// per-scene via `scene.materialProps[key]`; the renderer merges the
// override on top of the defaults below at draw time.
const NO_SHADOW = null

export const MATERIALS = {
  // Glass — visionOS plate default. Neutral #b8b8b8 at 25% alpha, backed
  // by a 40pt backdrop blur. Matches the windowGlass token in
  // DEFAULT_SCENE_COLORS so a fresh window lands on Apple's reference
  // plate look. Shadows are opt-in: the user toggles them from the
  // Materials & Colors editor when they actively want a contact cue.
  glass: {
    label: 'Glass',
    fillType: 'solid',
    color: '#b8b8b8',
    gradientFrom: '#b8b8b8',
    gradientTo: '#cccccc',
    gradientAngle: 180,
    opacity: 0.25,
    blur: true,
    blurAmount: 40,
    innerShadow: NO_SHADOW,
    dropShadow: NO_SHADOW,
    rimOpacity: 0.45,
    specularOpacity: 0.30,
    shadowOpacity: 0.20
  },
  // Views/Regular — layered composite plate (D6D6D6 @ 45% + #000000 @ 8%).
  // The renderer reads `.layers` and paints both passes; the legacy
  // single-`opacity` path still works for every other tier.
  viewsRegular: {
    label: 'Views Regular',
    fillType: 'solid',
    color: '#D6D6D6',
    gradientFrom: '#D6D6D6',
    gradientTo: '#a0a0a0',
    gradientAngle: 180,
    opacity: 0.45,
    blur: false,
    blurAmount: 12,
    innerShadow: NO_SHADOW,
    dropShadow: NO_SHADOW,
    rimOpacity: 0.0,
    specularOpacity: 0.0,
    shadowOpacity: 0.0,
    layers: [
      { color: '#D6D6D6', opacity: 0.45 },
      { color: '#000000', opacity: 0.08 }
    ]
  },
  ultraThin: {
    label: 'Ultra Thin',
    fillType: 'solid',
    color: '#ffffff',
    gradientFrom: '#ffffff', gradientTo: '#d0d0d0', gradientAngle: 180,
    opacity: 0.42,
    blur: true,
    blurAmount: 30,
    innerShadow: NO_SHADOW,
    dropShadow: NO_SHADOW,
    rimOpacity: 0.55,
    specularOpacity: 0.35,
    shadowOpacity: 0.18
  },
  thin: {
    label: 'Thin',
    fillType: 'solid',
    color: '#ffffff',
    gradientFrom: '#ffffff', gradientTo: '#c0c0c0', gradientAngle: 180,
    opacity: 0.55,
    blur: true,
    blurAmount: 20,
    innerShadow: NO_SHADOW,
    dropShadow: NO_SHADOW,
    rimOpacity: 0.60,
    specularOpacity: 0.40,
    shadowOpacity: 0.22
  },
  regular: {
    label: 'Regular',
    fillType: 'solid',
    color: '#ffffff',
    gradientFrom: '#ffffff', gradientTo: '#b0b0b0', gradientAngle: 180,
    opacity: 0.72,
    blur: true,
    blurAmount: 16,
    innerShadow: NO_SHADOW,
    dropShadow: NO_SHADOW,
    rimOpacity: 0.68,
    specularOpacity: 0.45,
    shadowOpacity: 0.28
  },
  thick: {
    label: 'Thick',
    fillType: 'solid',
    color: '#ffffff',
    gradientFrom: '#ffffff', gradientTo: '#a0a0a0', gradientAngle: 180,
    opacity: 0.88,
    blur: true,
    blurAmount: 12,
    innerShadow: NO_SHADOW,
    dropShadow: NO_SHADOW,
    rimOpacity: 0.62,
    specularOpacity: 0.42,
    shadowOpacity: 0.32
  },
  ultraThick: {
    label: 'Ultra Thick',
    fillType: 'solid',
    color: '#ffffff',
    gradientFrom: '#ffffff', gradientTo: '#909090', gradientAngle: 180,
    opacity: 0.96,
    blur: true,
    blurAmount: 8,
    innerShadow: NO_SHADOW,
    dropShadow: NO_SHADOW,
    rimOpacity: 0.55,
    specularOpacity: 0.38,
    shadowOpacity: 0.36
  },
  opaque: {
    label: 'Opaque',
    fillType: 'solid',
    color: '#ffffff',
    gradientFrom: '#ffffff', gradientTo: '#888888', gradientAngle: 180,
    opacity: 1.0,
    blur: false,
    blurAmount: 0,
    innerShadow: NO_SHADOW,
    dropShadow: NO_SHADOW,
    rimOpacity: 0.0,
    specularOpacity: 0.0,
    shadowOpacity: 0.30
  },
  // `.bar` material — toolbar / chrome on visionOS.
  bar: {
    label: 'Bar',
    fillType: 'solid',
    color: '#ffffff',
    gradientFrom: '#ffffff', gradientTo: '#a0a0a0', gradientAngle: 180,
    opacity: 0.62,
    blur: true,
    blurAmount: 18,
    innerShadow: NO_SHADOW,
    dropShadow: NO_SHADOW,
    rimOpacity: 0.58,
    specularOpacity: 0.38,
    shadowOpacity: 0.20
  }
}

export const MATERIAL_ORDER = ['glass', 'viewsRegular', 'ultraThin', 'thin', 'regular', 'thick', 'ultraThick', 'opaque', 'bar']

// SwiftUI material tiers offered as the segmented control's track
// background — the only appearance control for a segmented picker (it
// has no user fill colour). `swift` maps 1:1 to a SwiftUI `Material`
// value for export. `tint` is the 0–1 lerp toward the lighter rim used
// to nudge the recessed-well shade in the preview so the choice reads.
export const SEGMENT_MATERIALS = [
  { value: 'ultraThin',  label: 'Ultra Thin',  swift: '.ultraThinMaterial',  tint: 0.0 },
  { value: 'thin',       label: 'Thin',        swift: '.thinMaterial',       tint: 0.14 },
  { value: 'regular',    label: 'Regular',     swift: '.regularMaterial',    tint: 0.28 },
  { value: 'thick',      label: 'Thick',       swift: '.thickMaterial',      tint: 0.44 },
  { value: 'ultraThick', label: 'Ultra Thick', swift: '.ultraThickMaterial', tint: 0.6 }
]

// Closest SwiftUI Material for each "Views" scene material token (the
// viewRecessed→viewThicker tier the user picks from Scene → Materials &
// Colors). Used only when exporting controls that sit on a view material —
// e.g. the segmented picker's track — to code. The tokens themselves live in
// DEFAULT_SCENE_COLORS / scene.colors and drive the live preview tint.
export const VIEW_MATERIAL_SWIFT = {
  viewRecessed: '.regularMaterial',
  viewThin:     '.thinMaterial',
  viewRegular:  '.regularMaterial',
  viewThicker:  '.thickMaterial'
}

// Resolve a material's final property set from MATERIALS defaults +
// optional `scene.materialProps[key]` user overrides. The Materials &
// Colors editor writes overrides; the LiquidGlass renderer + the
// window inspector preview both read through this helper so they stay
// in sync.
export function resolveMaterial(key, sceneMaterialProps) {
  const base = MATERIALS[key] || {}
  const override = (sceneMaterialProps || {})[key] || {}
  return { ...base, ...override }
}

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

// ---- Scene Color Palette ---------------------------------------------
//
// Designer-editable color system. Mirrors the visionOS Figma "Color
// styles" panel — Text/Controls/Views/Windows/Separators + the system
// colour wheel. Each token lives on `scene.colors` so the user can
// retune the whole project from Scene → Colors and every panel that
// references a token tracks the change automatically.
//
// `resolveSemantic(token, sceneOrScheme)` consults `scene.colors[token]`
// first; if absent it falls back to the legacy SYSTEM_COLORS table so
// scheme-aware tokens (systemBackground, glassRegular, …) still work.
export const SCENE_COLOR_LABELS = {
  // Text
  primary:           'Primary',
  secondary:         'Secondary',
  tertiary:          'Tertiary',
  // Controls (state-driven)
  controlIdle:       'Idle',
  controlHover:      'Hover',
  controlPinch:      'Pinch',
  controlSelected:   'Selected',
  controlDisabled:   'Disabled',
  // Views (material tiers)
  viewRecessed:      'Recessed Material View',
  viewThin:          'Thin',
  viewRegular:       'Regular',
  viewThicker:       'Thicker',
  // Windows
  windowGlass:       'Glass',
  windowGlassKeyboard:'Glass — Keyboard',
  // Separators
  separator:         'Separator',
  // System colour wheel
  systemRed:         'Red',
  systemOrange:      'Orange',
  systemYellow:      'Yellow',
  systemGreen:       'Green',
  systemMint:        'Mint',
  systemTeal:        'Teal',
  systemCyan:        'Cyan',
  systemBlue:        'Blue',
  systemIndigo:      'Indigo',
  systemPurple:      'Purple',
  systemPink:        'Pink',
  systemBrown:       'Brown',
  systemGray:        'Gray',
  black:             'Black',
  white:             'White'
}

// Categorical ordering for the inspector picker + Scene → Colors editor.
// Order matches the visionOS Figma kit reading order.
export const SCENE_COLOR_GROUPS = [
  { key: 'colors',     label: 'Colors',     tokens: ['systemRed', 'systemOrange', 'systemYellow', 'systemGreen', 'systemMint', 'systemTeal', 'systemCyan', 'systemBlue', 'systemIndigo', 'systemPurple', 'systemPink', 'systemBrown', 'systemGray', 'black', 'white'] },
  { key: 'text',       label: 'Text',       tokens: ['primary', 'secondary', 'tertiary'] },
  { key: 'controls',   label: 'Controls',   tokens: ['controlIdle', 'controlHover', 'controlPinch', 'controlSelected', 'controlDisabled'] },
  { key: 'views',      label: 'Views',      tokens: ['viewRecessed', 'viewThin', 'viewRegular', 'viewThicker'] },
  { key: 'windows',    label: 'Windows',    tokens: ['windowGlass', 'windowGlassKeyboard'] },
  { key: 'separators', label: 'Separators', tokens: ['separator'] }
]

// Default hex values for a fresh scene. Picked from the visionOS Figma
// kit reference (the "Color styles" page in Apple's design system) so
// a brand-new project lands on values matching the spatial UI HIG.
export const DEFAULT_SCENE_COLORS = {
  // Text — high-contrast on glass; Apple uses near-white as the
  // primary baseline because visionOS plates render translucent.
  primary:            '#ffffff',
  secondary:          '#b0b0b3',
  tertiary:           '#6e6e72',
  // Controls — gradient from dim → fully-lit; idle reads as
  // a recessed control on glass, selected pops to white.
  controlIdle:        '#6e6e72',
  controlHover:       '#8e8e93',
  controlPinch:       '#545458',
  controlSelected:    '#ffffff',
  controlDisabled:    '#48484a',
  // Views — material tier tints (visionOS Material approximations).
  viewRecessed:       '#2c2c2e',
  viewThin:           '#45454a',
  viewRegular:        '#39393c',
  viewThicker:        '#5a5a5e',
  // Windows — neutral #b8b8b8 with 25% opacity baked in. Kept in sync
  // with MATERIALS.glass so the "Glass" token and the Glass material
  // read identically. The renderer blends this over the studio backdrop
  // the way visionOS does over the wearer's room. designWindow in
  // SYSTEM_COLORS is kept for the legacy scheme tables.
  windowGlass:        '#b8b8b8',
  windowGlassOpacity: 0.25,
  windowGlassKeyboard:'#2c2c2e',
  // Separators — Apple's tertiary-on-dark hairline.
  separator:          '#38383a',
  // System colour wheel (mirrors the iOS systemX palette).
  systemRed:          '#ff3b30',
  systemOrange:       '#ff9500',
  systemYellow:       '#ffcc00',
  systemGreen:        '#34c759',
  systemMint:         '#00c7be',
  systemTeal:         '#30b0c7',
  systemCyan:         '#32ade6',
  systemBlue:         '#007aff',
  systemIndigo:       '#5856d6',
  systemPurple:       '#af52de',
  systemPink:         '#ff2d55',
  systemBrown:        '#a2845e',
  systemGray:         '#8e8e93',
  black:              '#000000',
  white:              '#ffffff'
}

// Build a fresh defaults map. Cloning so the consumer can mutate the
// returned object without affecting the module-level constant.
export const buildDefaultSceneColors = () => ({ ...DEFAULT_SCENE_COLORS })

// Resolve a semantic color token to a hex string.
//
// Accepts either a scheme string (legacy: 'light' / 'dark') or a scene
// object. When a scene object is passed we consult `scene.colors[token]`
// first — that's how the Scene → Colors editor's overrides propagate
// to every consumer. We then fall back to the per-scheme SYSTEM_COLORS
// table for tokens the scene palette doesn't cover (systemBackground,
// glassRegular, designWindow, …).
export const resolveSemantic = (token, sceneOrScheme) => {
  // Caller passed a scene object — check material/color overrides first.
  if (sceneOrScheme && typeof sceneOrScheme === 'object') {
    // Tokens edited via the Materials editor store their color in
    // materialProps[token]; honour that first so a material-color edit
    // flows to every consumer that resolves this token.
    const matColor = sceneOrScheme.materialProps?.[token]?.color
    if (matColor) return matColor
    const override = sceneOrScheme.colors?.[token]
    if (override) return override
    const scheme = sceneOrScheme.designScheme || 'light'
    return SYSTEM_COLORS[scheme]?.[token]
      || DEFAULT_SCENE_COLORS[token]
      || SYSTEM_COLORS.light[token]
      || '#000000'
  }
  // Legacy path — scheme string. Still honours DEFAULT_SCENE_COLORS so
  // new tokens (controlIdle, viewRegular, …) resolve even when the
  // caller hasn't been migrated to pass the scene.
  const scheme = sceneOrScheme || 'light'
  return SYSTEM_COLORS[scheme]?.[token]
    || DEFAULT_SCENE_COLORS[token]
    || SYSTEM_COLORS.light[token]
    || '#000000'
}

// ---- Unified material library ----------------------------------------
//
// The SINGLE source of truth behind every "Material" dropdown in the app.
// It mirrors EXACTLY the list the Scene → Materials & Colors detail editor
// builds: every non-system-colour scene token (Text / Controls / Views /
// Windows / Separators — 15 entries) followed by the nine liquid-glass
// tiers (MATERIAL_ORDER). 15 + 9 = the 24 materials the user tunes in
// Scene Settings. Each descriptor is `{ value, label, group }` so a picker
// can render the same grouped list the Scene editor shows.
export const MATERIAL_LIBRARY = [
  ...SCENE_COLOR_GROUPS
    .filter((g) => g.key !== 'colors')
    .flatMap((g) => g.tokens.map((t) => ({ value: t, label: SCENE_COLOR_LABELS[t] || t, group: g.label }))),
  ...MATERIAL_ORDER.map((k) => ({ value: k, label: MATERIALS[k]?.label || k, group: 'Materials' }))
]

// Flat list of the 24 valid material keys — used to validate / clamp a
// stored selection back into the library.
export const MATERIAL_LIBRARY_VALUES = MATERIAL_LIBRARY.map((m) => m.value)

// True when `key` names a liquid-glass tier (a full MATERIALS spec with
// blur / layers / rim). Token-materials (primary, viewRecessed, separator,
// …) return false — they resolve to a flat tinted plate.
export const isGlassMaterialKey = (key) => Object.prototype.hasOwnProperty.call(MATERIALS, key)

// Resolve ANY of the 24 library materials to a full render spec.
//
// • Glass tiers (glass, regular, …) resolve exactly like `resolveMaterial`
//   — the MATERIALS default merged with the user's
//   `scene.materialProps[key]` overrides — so existing windows / stacks
//   render byte-identically.
// • Token-materials (primary, viewRecessed, separator, …) have no MATERIALS
//   entry, so we synthesise a flat solid plate: the colour comes from
//   `resolveSemantic` (which already honours scene.colors + the Materials
//   editor's colour override), and any other detailed setting the user
//   tuned (fillType / gradient / opacity / blur / layers / shadows) is
//   merged on top from `scene.materialProps[key]`.
//
// This is the helper that makes a detailed-settings edit in Scene →
// Materials propagate to every view that references the material.
export function resolveAnyMaterial(key, scene) {
  const sceneMaterialProps = (scene && typeof scene === 'object') ? scene.materialProps : null
  if (key && MATERIALS[key]) {
    return resolveMaterial(key, sceneMaterialProps)
  }
  const override = (sceneMaterialProps || {})[key] || {}
  const color = resolveSemantic(key, scene)
  return {
    fillType: 'solid',
    gradientFrom: color,
    gradientTo: color,
    gradientAngle: 180,
    opacity: 1,
    blur: false,
    blurAmount: 0,
    layers: null,
    innerShadow: null,
    dropShadow: null,
    rimOpacity: 0,
    specularOpacity: 0,
    shadowOpacity: 0,
    ...override,
    // resolveSemantic already folds in `override.color`; restate it last so
    // the spread above can't leave a stale colour behind.
    color: override.color || color
  }
}

// Closest SwiftUI ShapeStyle (Material) string for ANY library material —
// used when exporting a control that paints a `.background(...)` from the
// chosen material (segmented track, input plate, …). Glass tiers map to
// their matching `Material`; the four Views tokens use VIEW_MATERIAL_SWIFT;
// every other token falls back to `.regularMaterial` so the export always
// emits a valid ShapeStyle.
const TIER_SWIFT = {
  glass: '.regularMaterial',
  viewsRegular: '.regularMaterial',
  ultraThin: '.ultraThinMaterial',
  thin: '.thinMaterial',
  regular: '.regularMaterial',
  thick: '.thickMaterial',
  ultraThick: '.ultraThickMaterial',
  opaque: '.thickMaterial',
  bar: '.bar'
}
export function materialSwiftValue(key) {
  return TIER_SWIFT[key] || VIEW_MATERIAL_SWIFT[key] || '.regularMaterial'
}

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
// Per-style row metrics. The 4pt `gap` matches Apple's visionOS HIG
// reference (see Settings.app screenshot — every row sits as its own
// rounded chip with 4pt vertical breathing room between them).
// `roundedRows: true` paints each row as its own glass capsule which
// is the dominant visionOS pattern; the legacy "flat rows inside one
// group card" treatment lingers as `default` for parity with iOS but
// `insetGrouped` (the one the templates actually use) now follows
// the spatial HIG metric.
export const LIST_STYLES = {
  default:      { label: 'Default',       rowH: 44, pad: 12, inset: 20, gap: 4,  showBg: true,  showSeparators: true,  roundedRows: false, groupRadius: 12, showGroupCard: true },
  plain:        { label: 'Plain',         rowH: 44, pad: 0,  inset: 16, gap: 4,  showBg: false, showSeparators: true,  roundedRows: false, groupRadius: 0,  showGroupCard: false },
  inset:        { label: 'Inset',         rowH: 44, pad: 10, inset: 24, gap: 4,  showBg: true,  showSeparators: true,  roundedRows: false, groupRadius: 12, showGroupCard: true },
  insetGrouped: { label: 'Inset Grouped', rowH: 48, pad: 6,  inset: 16, gap: 4,  showBg: false, showSeparators: false, roundedRows: true,  groupRadius: 14, showGroupCard: false },
  grouped:      { label: 'Grouped',       rowH: 44, pad: 20, inset: 0,  gap: 4,  showBg: true,  showSeparators: true,  roundedRows: false, groupRadius: 0,  showGroupCard: false },
  sidebar:      { label: 'Sidebar',       rowH: 56, pad: 0,  inset: 12, gap: 0,  showBg: false, showSeparators: false, roundedRows: false, groupRadius: 14, showGroupCard: true },
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
  // U+26B2 is the alchemical "neutral" sign which renders as a venus/\u2640
  // glyph in most fonts. U+1F50D is a more reliable magnifier; if the
  // user's font doesn't have it, the renderer falls back gracefully.
  'magnifyingglass': { glyph: '\u2315', label: 'Search' },
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
  'tray.full':                   { glyph: '\u25A6', label: 'Inbox Full' },
  'tray.full.fill':              { glyph: '\u25A6', label: 'Inbox Full Fill' },
  'archivebox':                  { glyph: '\u26C1', label: 'Archive' },
  'archivebox.fill':             { glyph: '\u26C1', label: 'Archive Fill' },
  'flag':                        { glyph: '\u2691', label: 'Flag' },
  'flag.fill':                   { glyph: '\u2691', label: 'Flag Fill' },
  'paperplane.fill':             { glyph: '\u27A4', label: 'Send Fill' },
  'doc.fill':                    { glyph: '\u25A0', label: 'Document Fill' },
  // Music app additions
  'music.note':                  { glyph: '\u266B', label: 'Music' },
  'music.mic':                   { glyph: '\u2698', label: 'Studio' },
  'play.fill':                   { glyph: '\u25B6', label: 'Play Fill' },
  'pause.fill':                  { glyph: '\u2389', label: 'Pause Fill' },
  'forward.fill':                { glyph: '\u23ED', label: 'Forward' },
  'backward.fill':               { glyph: '\u23EE', label: 'Backward' },
  // Smart home additions
  'sofa':                        { glyph: '\u29C9', label: 'Sofa' },
  'sofa.fill':                   { glyph: '\u29C9', label: 'Sofa Fill' },
  'fork.knife':                  { glyph: '\u2692', label: 'Cutlery' },
  'bed.double':                  { glyph: '\u2630', label: 'Bed' },
  'bed.double.fill':             { glyph: '\u2630', label: 'Bed Fill' },
  // Tab bar additions
  'books.vertical':              { glyph: '\u26C0', label: 'Library' },
  'books.vertical.fill':         { glyph: '\u26C0', label: 'Library Fill' },
  // Mail reply / forward
  'arrowshape.turn.up.left':     { glyph: '\u21A9', label: 'Reply' },
  'arrowshape.turn.up.left.fill':{ glyph: '\u21A9', label: 'Reply Fill' },
  'arrowshape.turn.up.right':    { glyph: '\u21AA', label: 'Forward' },
  'square.stack':                { glyph: '\u29C9', label: 'Stack' },
  // Layout / misc
  'sparkles':                    { glyph: '\u2728', label: 'Sparkles' },
  // ---- Phase 9 additions: broader coverage of the visionOS / iOS 17
  // symbol catalogue. Lookups in the picker stay alphabetically ordered
  // by insertion; the SymbolIcon3D / SymbolIcon DOM renderer maps each
  // name to a Lucide glyph via SF_TO_LUCIDE in src/components/icons.jsx.
  // Unicode `glyph` is a legacy fallback only \u2014 never user-facing now.
  // Files & documents
  'doc.text':                    { glyph: '\u25a1', label: 'Text Document' },
  'doc.text.fill':               { glyph: '\u25a0', label: 'Text Document Fill' },
  'doc.plaintext':               { glyph: '\u25a1', label: 'Plain Text' },
  'doc.on.doc':                  { glyph: '\u25a2', label: 'Copy' },
  'doc.on.clipboard':            { glyph: '\u25a2', label: 'Paste' },
  'square.and.pencil':           { glyph: '\u270f', label: 'Compose' },
  'pencil.tip':                  { glyph: '\u270f', label: 'Pencil Tip' },
  'pencil.line':                 { glyph: '\u270f', label: 'Pencil Line' },
  'highlighter':                 { glyph: '\u270e', label: 'Highlighter' },
  'eraser':                      { glyph: '\u25a1', label: 'Eraser' },
  'paperclip':                   { glyph: '\u2702', label: 'Paperclip' },
  'link':                        { glyph: '\u2693', label: 'Link' },
  'link.circle':                 { glyph: '\u2693', label: 'Link Circle' },
  // Status / state
  'checkmark.circle':            { glyph: '\u2713', label: 'Checkmark Circle' },
  'checkmark.circle.fill':       { glyph: '\u2713', label: 'Checkmark Circle Fill' },
  'checkmark.square':            { glyph: '\u2611', label: 'Checkmark Square' },
  'checkmark.square.fill':       { glyph: '\u2611', label: 'Checkmark Square Fill' },
  'xmark.circle':                { glyph: '\u2715', label: 'Close Circle' },
  'xmark.circle.fill':           { glyph: '\u2715', label: 'Close Circle Fill' },
  'xmark.square':                { glyph: '\u2612', label: 'Close Square' },
  'plus.circle':                 { glyph: '\u2295', label: 'Plus Circle' },
  'plus.circle.fill':            { glyph: '\u2295', label: 'Plus Circle Fill' },
  'plus.square':                 { glyph: '\u229e', label: 'Plus Square' },
  'minus.circle':                { glyph: '\u2296', label: 'Minus Circle' },
  'minus.circle.fill':           { glyph: '\u2296', label: 'Minus Circle Fill' },
  'minus.square':                { glyph: '\u229f', label: 'Minus Square' },
  'circle':                      { glyph: '\u25cb', label: 'Circle' },
  'circle.fill':                 { glyph: '\u25cf', label: 'Circle Fill' },
  'square':                      { glyph: '\u25a1', label: 'Square' },
  'square.fill':                 { glyph: '\u25a0', label: 'Square Fill' },
  'triangle':                    { glyph: '\u25b3', label: 'Triangle' },
  'triangle.fill':               { glyph: '\u25b2', label: 'Triangle Fill' },
  'octagon':                     { glyph: '\u2b22', label: 'Octagon' },
  // Filters / sorting / search
  'line.3.horizontal':           { glyph: '\u2630', label: 'Menu' },
  'line.3.horizontal.decrease':  { glyph: '\u2630', label: 'Filter' },
  'arrow.up.arrow.down':         { glyph: '\u21c5', label: 'Sort' },
  'slider.horizontal.3':         { glyph: '\u2261', label: 'Adjustments' },
  // Sharing
  'square.and.arrow.down':       { glyph: '\u21e9', label: 'Download' },
  'square.and.arrow.up.on.square': { glyph: '\u21e7', label: 'Share' },
  'icloud':                      { glyph: '\u2601', label: 'iCloud' },
  'icloud.and.arrow.up':         { glyph: '\u2601', label: 'iCloud Upload' },
  'icloud.and.arrow.down':       { glyph: '\u2601', label: 'iCloud Download' },
  'arrow.down.circle':           { glyph: '\u2193', label: 'Download Circle' },
  'arrow.up.circle':             { glyph: '\u2191', label: 'Upload Circle' },
  'arrow.clockwise':             { glyph: '\u21bb', label: 'Refresh' },
  'arrow.counterclockwise':      { glyph: '\u21ba', label: 'Undo' },
  // Communication extra
  'message':                     { glyph: '\u2709', label: 'Message' },
  'message.fill':                { glyph: '\u2709', label: 'Message Fill' },
  'envelope.open':               { glyph: '\u2709', label: 'Envelope Open' },
  'envelope.badge':              { glyph: '\u2709', label: 'Envelope Badge' },
  'envelope.arrow.triangle.branch': { glyph: '\u2709', label: 'Mail Routing' },
  'phone.fill':                  { glyph: '\u260e', label: 'Phone Fill' },
  'phone.arrow.up.right':        { glyph: '\u260e', label: 'Outgoing Call' },
  'phone.arrow.down.left':       { glyph: '\u260e', label: 'Incoming Call' },
  'video.fill':                  { glyph: '\u25b6', label: 'Video Fill' },
  'video.slash':                 { glyph: '\u25b6', label: 'Video Off' },
  'mic.fill':                    { glyph: '\u2316', label: 'Mic Fill' },
  'mic.slash':                   { glyph: '\u2316', label: 'Mic Off' },
  'mic.slash.fill':              { glyph: '\u2316', label: 'Mic Off Fill' },
  // Media controls extra
  'speaker':                     { glyph: '\u266b', label: 'Speaker' },
  'speaker.slash':               { glyph: '\u266b', label: 'Mute' },
  'speaker.wave.1':              { glyph: '\u266b', label: 'Speaker Low' },
  'speaker.wave.3':              { glyph: '\u266b', label: 'Speaker High' },
  'shuffle':                     { glyph: '\u21c6', label: 'Shuffle' },
  'repeat':                      { glyph: '\u21bb', label: 'Repeat' },
  'repeat.1':                    { glyph: '\u21bb', label: 'Repeat One' },
  'goforward.10':                { glyph: '\u21bb', label: 'Skip Forward 10s' },
  'gobackward.10':               { glyph: '\u21ba', label: 'Skip Back 10s' },
  'play.circle':                 { glyph: '\u25b6', label: 'Play Circle' },
  'play.circle.fill':            { glyph: '\u25b6', label: 'Play Circle Fill' },
  'pause.circle':                { glyph: '\u2016', label: 'Pause Circle' },
  'pause.circle.fill':           { glyph: '\u2016', label: 'Pause Circle Fill' },
  'stop.circle':                 { glyph: '\u25a0', label: 'Stop Circle' },
  'stop.circle.fill':            { glyph: '\u25a0', label: 'Stop Circle Fill' },
  // Connectivity
  'wifi.slash':                  { glyph: '\u2630', label: 'WiFi Off' },
  'bluetooth':                   { glyph: '\u2225', label: 'Bluetooth' },
  'antenna.radiowaves.left.and.right': { glyph: '\u2630', label: 'Signal' },
  'airplayvideo':                { glyph: '\u25b6', label: 'AirPlay Video' },
  'airplayaudio':                { glyph: '\u266b', label: 'AirPlay Audio' },
  // Battery
  'battery.0':                   { glyph: '\u2588', label: 'Battery 0%' },
  'battery.25':                  { glyph: '\u2588', label: 'Battery 25%' },
  'battery.50':                  { glyph: '\u2588', label: 'Battery 50%' },
  'battery.75':                  { glyph: '\u2588', label: 'Battery 75%' },
  'bolt':                        { glyph: '\u26a1', label: 'Bolt' },
  'bolt.fill':                   { glyph: '\u26a1', label: 'Bolt Fill' },
  // Charts & data
  'chart.bar':                   { glyph: '\u2588', label: 'Bar Chart' },
  'chart.bar.fill':              { glyph: '\u2588', label: 'Bar Chart Fill' },
  'chart.line.uptrend.xyaxis':   { glyph: '\u2197', label: 'Line Chart' },
  'chart.pie':                   { glyph: '\u25d4', label: 'Pie Chart' },
  'chart.pie.fill':              { glyph: '\u25d4', label: 'Pie Chart Fill' },
  'arrow.up.right':              { glyph: '\u2197', label: 'Trending Up' },
  'arrow.down.right':            { glyph: '\u2198', label: 'Trending Down' },
  'percent':                     { glyph: '%',      label: 'Percent' },
  'number':                      { glyph: '#',      label: 'Number' },
  // Time
  'timer':                       { glyph: '\u23f2', label: 'Timer' },
  'hourglass':                   { glyph: '\u231b', label: 'Hourglass' },
  'alarm':                       { glyph: '\u23f0', label: 'Alarm' },
  'alarm.fill':                  { glyph: '\u23f0', label: 'Alarm Fill' },
  'stopwatch':                   { glyph: '\u23f1', label: 'Stopwatch' },
  'calendar.badge.plus':         { glyph: '\u2637', label: 'Calendar Plus' },
  'calendar.badge.minus':        { glyph: '\u2637', label: 'Calendar Minus' },
  // Location extra
  'mappin':                      { glyph: '\u2316', label: 'Pin' },
  'mappin.and.ellipse':          { glyph: '\u2316', label: 'Place' },
  'location.fill':               { glyph: '\u2316', label: 'Location Fill' },
  'location.circle':             { glyph: '\u2316', label: 'Location Circle' },
  'arrow.triangle.turn.up.right.diamond': { glyph: '\u27a4', label: 'Directions' },
  'flag.checkered':              { glyph: '\u2691', label: 'Flag Checkered' },
  'safari':                      { glyph: '\u25cc', label: 'Safari' },
  'compass':                     { glyph: '\u29b5', label: 'Compass' },
  'globe.americas':              { glyph: '\u2641', label: 'Americas' },
  'globe.europe.africa':         { glyph: '\u2641', label: 'Europe/Africa' },
  'globe.asia.australia':        { glyph: '\u2641', label: 'Asia/Australia' },
  // Devices
  'iphone':                      { glyph: '\u25ad', label: 'iPhone' },
  'ipad':                        { glyph: '\u25ad', label: 'iPad' },
  'desktopcomputer':             { glyph: '\u2328', label: 'Desktop' },
  'macbook':                     { glyph: '\u2328', label: 'MacBook' },
  'tv':                          { glyph: '\u25ad', label: 'TV' },
  'tv.fill':                     { glyph: '\u25ad', label: 'TV Fill' },
  'headphones':                  { glyph: '\u266a', label: 'Headphones' },
  'airpods':                     { glyph: '\u266a', label: 'AirPods' },
  'gamecontroller':              { glyph: '\u2660', label: 'Game Controller' },
  'gamecontroller.fill':         { glyph: '\u2660', label: 'Game Controller Fill' },
  'printer':                     { glyph: '\u2399', label: 'Printer' },
  'printer.fill':                { glyph: '\u2399', label: 'Printer Fill' },
  'speaker.zzz':                 { glyph: '\u266b', label: 'Speaker Off' },
  // Security
  'shield':                      { glyph: '\u26e8', label: 'Shield' },
  'shield.fill':                 { glyph: '\u26e8', label: 'Shield Fill' },
  'lock.fill':                   { glyph: '\u26bf', label: 'Lock Fill' },
  'lock.shield':                 { glyph: '\u26bf', label: 'Lock Shield' },
  'lock.open.fill':              { glyph: '\u26bf', label: 'Unlock Fill' },
  'faceid':                      { glyph: '\u263a', label: 'Face ID' },
  'touchid':                     { glyph: '\u261a', label: 'Touch ID' },
  // Weather
  'sun.max':                     { glyph: '\u2600', label: 'Sun' },
  'sun.min':                     { glyph: '\u2600', label: 'Sun Min' },
  'moon':                        { glyph: '\u263d', label: 'Moon' },
  'moon.fill':                   { glyph: '\u263d', label: 'Moon Fill' },
  'cloud':                       { glyph: '\u2601', label: 'Cloud' },
  'cloud.fill':                  { glyph: '\u2601', label: 'Cloud Fill' },
  'cloud.rain':                  { glyph: '\u2614', label: 'Rain' },
  'cloud.snow':                  { glyph: '\u2603', label: 'Snow' },
  'cloud.sun':                   { glyph: '\u26c5', label: 'Partly Cloudy' },
  'cloud.bolt':                  { glyph: '\u26c8', label: 'Thunderstorm' },
  'wind':                        { glyph: '\u2603', label: 'Wind' },
  'snowflake':                   { glyph: '\u2744', label: 'Snowflake' },
  'thermometer':                 { glyph: '\u2615', label: 'Thermometer' },
  'drop':                        { glyph: '\u25cc', label: 'Drop' },
  'flame':                       { glyph: '\u2615', label: 'Flame' },
  'flame.fill':                  { glyph: '\u2615', label: 'Flame Fill' },
  // Health & activity
  'heart.text.square':           { glyph: '\u2665', label: 'Health' },
  'figure.walk':                 { glyph: '\u263a', label: 'Walk' },
  'figure.run':                  { glyph: '\u263a', label: 'Run' },
  'dumbbell':                    { glyph: '\u2692', label: 'Dumbbell' },
  'dumbbell.fill':               { glyph: '\u2692', label: 'Dumbbell Fill' },
  'bicycle':                     { glyph: '\u26b2', label: 'Bicycle' },
  'figure.yoga':                 { glyph: '\u263a', label: 'Yoga' },
  // Shopping & commerce
  'cart':                        { glyph: '\u26c1', label: 'Cart' },
  'cart.fill':                   { glyph: '\u26c1', label: 'Cart Fill' },
  'creditcard':                  { glyph: '\u25ad', label: 'Credit Card' },
  'creditcard.fill':             { glyph: '\u25ad', label: 'Credit Card Fill' },
  'dollarsign.circle':           { glyph: '$',      label: 'Dollar' },
  'dollarsign.circle.fill':      { glyph: '$',      label: 'Dollar Fill' },
  'eurosign.circle':             { glyph: '\u20ac',      label: 'Euro' },
  'sterlingsign.circle':         { glyph: '\u00a3',      label: 'Pound' },
  'yensign.circle':              { glyph: '\u00a5',      label: 'Yen' },
  'bag':                         { glyph: '\u26c1', label: 'Bag' },
  'bag.fill':                    { glyph: '\u26c1', label: 'Bag Fill' },
  'gift':                        { glyph: '\u2603', label: 'Gift' },
  'gift.fill':                   { glyph: '\u2603', label: 'Gift Fill' },
  // Food
  'cup.and.saucer':              { glyph: '\u2615', label: 'Coffee' },
  'cup.and.saucer.fill':         { glyph: '\u2615', label: 'Coffee Fill' },
  'mug':                         { glyph: '\u2615', label: 'Mug' },
  'wineglass':                   { glyph: '\u26c0', label: 'Wine Glass' },
  // Smart home extra
  'lightbulb':                   { glyph: '\u2600', label: 'Lightbulb' },
  'lightbulb.fill':              { glyph: '\u2600', label: 'Lightbulb Fill' },
  'lamp.desk':                   { glyph: '\u2600', label: 'Desk Lamp' },
  'lamp.ceiling':                { glyph: '\u2600', label: 'Ceiling Lamp' },
  'fan':                         { glyph: '\u2735', label: 'Fan' },
  'fan.desk':                    { glyph: '\u2735', label: 'Desk Fan' },
  'thermometer.sun':             { glyph: '\u2600', label: 'Temperature' },
  'house.lodge':                 { glyph: '\u2302', label: 'Lodge' },
  'building':                    { glyph: '\u25a6', label: 'Building' },
  'building.2':                  { glyph: '\u25a6', label: 'Buildings' },
  'door.left.hand.open':         { glyph: '\u25a1', label: 'Door Open' },
  'door.left.hand.closed':       { glyph: '\u25a0', label: 'Door Closed' },
  'window.vertical.open':        { glyph: '\u25a1', label: 'Window Open' },
  'bathtub':                     { glyph: '\u26c0', label: 'Bath' },
  'shower':                      { glyph: '\u26c0', label: 'Shower' },
  // Transport
  'car':                         { glyph: '\u26f4', label: 'Car' },
  'car.fill':                    { glyph: '\u26f4', label: 'Car Fill' },
  'airplane':                    { glyph: '\u2708', label: 'Airplane' },
  'airplane.departure':          { glyph: '\u2708', label: 'Departure' },
  'airplane.arrival':            { glyph: '\u2708', label: 'Arrival' },
  'tram':                        { glyph: '\u26f4', label: 'Tram' },
  'tram.fill':                   { glyph: '\u26f4', label: 'Tram Fill' },
  'fuelpump':                    { glyph: '\u26fd', label: 'Gas Station' },
  'sailboat':                    { glyph: '\u26f5', label: 'Sailboat' },
  // Knowledge & education
  'book':                        { glyph: '\u26c0', label: 'Book' },
  'book.fill':                   { glyph: '\u26c0', label: 'Book Fill' },
  'book.closed':                 { glyph: '\u26c0', label: 'Closed Book' },
  'graduationcap':               { glyph: '\u2302', label: 'Graduation' },
  'graduationcap.fill':          { glyph: '\u2302', label: 'Graduation Fill' },
  'pencil.and.ruler':            { glyph: '\u270f', label: 'Pencil + Ruler' },
  'magazine':                    { glyph: '\u25a4', label: 'Magazine' },
  'magazine.fill':               { glyph: '\u25a4', label: 'Magazine Fill' },
  // Awards & achievement
  'trophy':                      { glyph: '\u2605', label: 'Trophy' },
  'trophy.fill':                 { glyph: '\u2605', label: 'Trophy Fill' },
  'medal':                       { glyph: '\u2606', label: 'Medal' },
  'medal.fill':                  { glyph: '\u2605', label: 'Medal Fill' },
  'crown':                       { glyph: '\u2654', label: 'Crown' },
  'crown.fill':                  { glyph: '\u2654', label: 'Crown Fill' },
  'rosette':                     { glyph: '\u2606', label: 'Rosette' },
  // Reactions
  'hand.thumbsup':               { glyph: '\u261d', label: 'Thumbs Up' },
  'hand.thumbsup.fill':          { glyph: '\u261d', label: 'Thumbs Up Fill' },
  'hand.thumbsdown':             { glyph: '\u261f', label: 'Thumbs Down' },
  'hand.thumbsdown.fill':        { glyph: '\u261f', label: 'Thumbs Down Fill' },
  'hand.wave':                   { glyph: '\u270b', label: 'Wave' },
  'hand.wave.fill':              { glyph: '\u270b', label: 'Wave Fill' },
  'face.smiling':                { glyph: '\u263a', label: 'Smile' },
  'face.smiling.fill':           { glyph: '\u263a', label: 'Smile Fill' },
  // Tools / editing
  'wrench':                      { glyph: '\u2692', label: 'Wrench' },
  'wrench.fill':                 { glyph: '\u2692', label: 'Wrench Fill' },
  'hammer':                      { glyph: '\u2692', label: 'Hammer' },
  'hammer.fill':                 { glyph: '\u2692', label: 'Hammer Fill' },
  'screwdriver':                 { glyph: '\u2692', label: 'Screwdriver' },
  'paintbrush':                  { glyph: '\u270e', label: 'Paintbrush' },
  'paintbrush.fill':             { glyph: '\u270e', label: 'Paintbrush Fill' },
  'paintpalette':                { glyph: '\u26c0', label: 'Palette' },
  'eyedropper':                  { glyph: '\u25cc', label: 'Eyedropper' },
  'scissors':                    { glyph: '\u2702', label: 'Scissors' },
  'ruler':                       { glyph: '\u2197', label: 'Ruler' },
  // Vision & accessibility extra
  'eye.fill':                    { glyph: '\u25c9', label: 'Eye Fill' },
  'eye.trianglebadge.exclamationmark': { glyph: '\u25c9', label: 'Eye Alert' },
  'ear':                         { glyph: '\u263a', label: 'Ear' },
  'ear.fill':                    { glyph: '\u263a', label: 'Ear Fill' },
  'figure.roll':                 { glyph: '\u267f', label: 'Wheelchair' },
  // Misc
  'tag.fill':                    { glyph: '\u2606', label: 'Tag Fill' },
  'tag.circle':                  { glyph: '\u2606', label: 'Tag Circle' },
  'bookmark.circle':             { glyph: '\u2610', label: 'Bookmark Circle' },
  'star.circle':                 { glyph: '\u2605', label: 'Star Circle' },
  'star.circle.fill':            { glyph: '\u2605', label: 'Star Circle Fill' },
  'heart.circle':                { glyph: '\u2665', label: 'Heart Circle' },
  'heart.circle.fill':           { glyph: '\u2665', label: 'Heart Circle Fill' },
  'rectangle.stack':             { glyph: '\u25a2', label: 'Card Stack' },
  'rectangle.portrait':          { glyph: '\u25ad', label: 'Portrait Rect' },
  'rectangle.landscape':         { glyph: '\u25ad', label: 'Landscape Rect' },
  'square.grid.3x3':             { glyph: '\u29c9', label: 'Grid 3\u00d73' },
  'square.grid.4x3':             { glyph: '\u29c9', label: 'Grid 4\u00d73' },
  'circle.grid.2x2':             { glyph: '\u29c9', label: 'Circle Grid' },
  'circle.grid.3x3':             { glyph: '\u29c9', label: 'Circle Grid 3\u00d73' },
  'power':                       { glyph: '\u23fb', label: 'Power' },
  'power.circle':                { glyph: '\u23fb', label: 'Power Circle' },
  'powersleep':                  { glyph: '\u23fe', label: 'Sleep' },
  'questionmark':                { glyph: '?',      label: 'Question Mark' },
  'exclamationmark':             { glyph: '!',      label: 'Exclamation' },
  'exclamationmark.circle':      { glyph: '!',      label: 'Alert Circle' },
  'exclamationmark.octagon':     { glyph: '!',      label: 'Stop Sign' },
  'at':                          { glyph: '@',      label: 'At' },
  'asterisk':                    { glyph: '*',      label: 'Asterisk' },
  'function':                    { glyph: 'f',      label: 'Function' }
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

// ---- Navigation Bar ---------------------------------------------------
//
// Six fixed navbar styles, mirroring the visionOS Figma kit's NavBar
// configurations. Each style locks the *structural* defaults (item sizes
// and positions); the inspector exposes the variable parts (title text
// plus add/remove of the trailing/leading button arrays).
//
// Geometry that's common across all six styles:
//   - Height: 92pt — locked
//   - Side padding: 24pt — locked
//   - All items vertically centred; item height: 44pt
//   - Adjacent buttons in a group: 16pt spacing
//   - Avatar: 44×44 circle
//   - Trailing search: 305×44 capsule
//   - Back (circular): 44×44 circle
//   - Back (capsule): 76×44, chevron + "Back" with 2pt gap between glyph & label
export const NAVBAR_HEIGHT_PT       = 92
export const NAVBAR_SIDE_PADDING_PT = 24
export const NAVBAR_ITEM_PT         = 44       // every interactive item is 44 high
export const NAVBAR_ITEM_GAP_PT     = 16       // gap between adjacent buttons
export const NAVBAR_AVATAR_PT       = 44
export const NAVBAR_SEARCH_W_PT     = 305
export const NAVBAR_BACK_CAPSULE_W_PT = 76
export const NAVBAR_BACK_ICON_TEXT_GAP_PT = 2

export const NAVBAR_STYLES = [
  { value: 'trailingAvatar',            label: 'Trailing avatar' },
  { value: 'trailingButtons',           label: 'Trailing buttons' },
  { value: 'trailingSearch',            label: 'Trailing search' },
  { value: 'leadingTrailingButtons',    label: 'Leading and trailing buttons' },
  { value: 'backTrailingButtons',       label: 'Back and trailing buttons' },
  { value: 'backCapsuleTrailingButtons',label: 'Back hover and trailing buttons' }
]

// Per-button interaction picker. Mirrors the Button panel's tapAction
// vocabulary (see PANELS.button.defaults.tapAction) but exposes only
// the action *types* — params (targetWindowId, panelId, tab index, …)
// can be wired up via a follow-up "Configure…" pass when each is picked.
export const NAVBAR_INTERACTIONS = [
  { value: 'none',           label: 'None' },
  { value: 'navigateWindow', label: 'Open Window' },
  { value: 'navigateTab',    label: 'Switch Tab' },
  { value: 'presentSheet',   label: 'Present Sheet' },
  { value: 'dismiss',        label: 'Dismiss' },
  { value: 'flipToggle',     label: 'Toggle Switch' }
]

// Per-style descriptor: which slots are present, where the title sits,
// and whether the leading slot is a fixed chip (avatar / back button)
// or a user-editable button array. The renderer + inspector both read
// from this map so adding a new style means adding one entry.
//
//   leading: 'none' | 'avatar' | 'backCircle' | 'backCapsule' | 'buttons'
//   trailing:'none' | 'avatar' | 'search' | 'buttons'
//   titleAlign: 'left' | 'center'
//   leadingEditable / trailingEditable: whether the inspector exposes
//     add/remove for that slot's button array
export const NAVBAR_STYLE_SPECS = {
  trailingAvatar:             { leading: 'none',         trailing: 'avatar',  titleAlign: 'left',   leadingEditable: false, trailingEditable: false },
  trailingButtons:            { leading: 'none',         trailing: 'buttons', titleAlign: 'left',   leadingEditable: false, trailingEditable: true  },
  trailingSearch:             { leading: 'none',         trailing: 'search',  titleAlign: 'left',   leadingEditable: false, trailingEditable: false },
  leadingTrailingButtons:     { leading: 'buttons',      trailing: 'buttons', titleAlign: 'center', leadingEditable: true,  trailingEditable: true  },
  backTrailingButtons:        { leading: 'backCircle',   trailing: 'buttons', titleAlign: 'center', leadingEditable: false, trailingEditable: true  },
  backCapsuleTrailingButtons: { leading: 'backCapsule',  trailing: 'buttons', titleAlign: 'center', leadingEditable: false, trailingEditable: true  }
}

// SwiftUI ToolbarItem placements.
export const TOOLBAR_PLACEMENTS = {
  topBarLeading:     { label: 'Top Bar Leading' },
  topBarTrailing:    { label: 'Top Bar Trailing' },
  principal:         { label: 'Principal (center)' },
  bottomBar:         { label: 'Bottom Bar' },
  confirmationAction:{ label: 'Confirmation Action' },
  cancellationAction:{ label: 'Cancellation Action' }
}

// ---------------------------------------------------------------------------
// Control ranges (AUDIT #17)
//
// SwiftUI's Slider, Gauge and ProgressView each take a value inside a declared
// range and paint how far through that range it sits. The canvas used to clamp
// the raw value to 0…1 and paint *that*, which is only right when the range
// happens to be 0…1: a slider authored `0…100` at `50` drew hard right here and
// centred on device, and a Gauge — whose own default range is `0…100` — drew a
// full bar for a value that reads as 0.7% in Swift.
//
// `controlFraction` is the one place that conversion happens. Bounds are read
// with the same fallbacks the exporter uses (`min ?? 0`, `max ?? 1`) so the two
// sides resolve missing bounds identically rather than each guessing. A
// zero-width range has no meaningful fraction — SwiftUI draws those empty — so
// it maps to 0 rather than dividing by zero.
export function controlFraction(value, min, max) {
  const lo = Number(min ?? 0)
  const hi = Number(max ?? 1)
  const v = Number(value)
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(v)) return 0
  if (hi === lo) return 0
  return Math.max(0, Math.min(1, (v - lo) / (hi - lo)))
}

// Two-stop colour mix, for the gauge's `.tint(Gradient(colors: [from, to]))`.
// The canvas paints the gauge fill as one colour, so it samples the gradient
// at the value's own position — the stop the eye actually lands on. Falls
// back to the first colour if either side isn't a 6-digit hex.
export function mixHex(from, to, t) {
  const parse = (h) => /^#[0-9a-f]{6}$/i.test(h || '')
    ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
    : null
  const a = parse(from)
  const b = parse(to)
  if (!a || !b) return from || to || '#007aff'
  const k = Math.max(0, Math.min(1, t))
  const ch = (i) => Math.round(a[i] + (b[i] - a[i]) * k).toString(16).padStart(2, '0')
  return `#${ch(0)}${ch(1)}${ch(2)}`
}

// The inverse, for the preview's drag-to-set: a 0…1 position along the track
// becomes a value in the control's own range, snapped to `step` when the
// designer set one (SwiftUI treats step 0 as continuous).
export function valueFromFraction(t, min, max, step) {
  const lo = Number(min ?? 0)
  const hi = Number(max ?? 1)
  let v = lo + t * (hi - lo)
  const s = Number(step)
  if (Number.isFinite(s) && s > 0) v = lo + Math.round((v - lo) / s) * s
  return Math.max(Math.min(lo, hi), Math.min(Math.max(lo, hi), v))
}

// SwiftUI `.aspectRatio(_:contentMode:)` reshapes the frame to a width/height
// ratio. `.fit` shrinks the box so it fits inside the proposal; `.fill` grows
// it so it covers. Both the layout engine and the renderer run this, because
// a frame the stack reserves and a frame the panel paints have to be the same
// box — that agreement is what `layout.test.js` exists to pin.
export function applyAspectRatio(size, aspect) {
  if (!aspect) return size
  const [w, h] = size
  const r = Number(aspect.ratio ?? aspect)
  if (!Number.isFinite(r) || r <= 0 || !(w > 0) || !(h > 0)) return size
  const fill = aspect.contentMode === 'fill'
  const current = w / h
  if (Math.abs(current - r) < 1e-9) return size
  // Too wide for the target ratio: fitting narrows the width, filling raises
  // the height. Too tall is the mirror of that.
  if (current > r) return fill ? [w, w / r] : [h * r, h]
  return fill ? [h * r, h] : [w, w / r]
}

// Panel types that are not laid out as children at all: in SwiftUI each one
// attaches to its PARENT as a `.sheet(…)` / `.alert(…)` / `.confirmationDialog(…)`
// / `.inspector(…)` modifier, so it is presented over the view rather than
// flowing inside it.
//
// This lived in three places — the exporter, the canvas and the modifier
// registry — and two of them disagreed: the canvas knew about three types and
// the exporter about five. A `confirmationdialog` or an `inspector` was
// therefore laid out as an ordinary child on screen and emitted as a modal
// modifier in the code: the wrong *place*, not merely the wrong pixels. It
// lives here, in the vocabulary both sides already import, because the token
// module is the one layer with no cycle to worry about. AUDIT #7.
const PRESENTATION_PANEL_TYPES = new Set([
  'sheet', 'popover', 'alert', 'confirmationdialog', 'inspector'
])

export const isPresentationPanel = (panelType) => PRESENTATION_PANEL_TYPES.has(panelType)

// How wide an `.inspector(…)` column is. This mirrors the precedence the
// exporter emits — an exact `.inspectorColumnWidth(n)` wins outright,
// otherwise `.inspectorColumnWidth(min:ideal:max:)` clamps the ideal (falling
// back to the panel's stored width) between the bounds — so the column the
// canvas draws and the column the generated code asks for are the same box.
// It lives beside the other metric resolvers rather than in the renderer so
// that precedence can be pinned by a test; all four fields reached the export
// only until phase 1.3, because the canvas had no inspector presentation at
// all to apply them to. AUDIT #7.
// Takes the four widths rather than the panel, so the caller spells each
// field at the call site — the same shape `controlFraction` uses, and what
// keeps the parity scan able to see that the canvas reads them.
export function inspectorColumnWidth({ exact, ideal, min, max, stored }, windowW) {
  const pt = (v) => (v == null ? null : ptToUnits(v))
  const exactU = pt(exact)
  if (exactU != null) return Math.min(exactU, windowW)
  let width = pt(ideal) ?? (stored ?? ptToUnits(320))
  const minU = pt(min)
  const maxU = pt(max)
  if (minU != null) width = Math.max(width, minU)
  if (maxU != null) width = Math.min(width, maxU)
  // However wide it asks to be, it still has to fit the window it splits.
  return Math.max(ptToUnits(40), Math.min(width, windowW * 0.8))
}

// Which `outlinegroup` rows are on screen, given that a collapsed row hides
// everything beneath it. The inspector stores the tree flattened to
// (title, indent, expanded), and `indent` is the row's depth — the same rule
// the `outlinegroup` emitter above uses to rebuild the recursive
// `OutlineNode` model, so the shape the canvas walks and the shape the export
// writes are read from the field the same way.
//
// Returns the visible rows, each tagged with its nesting `level` and whether
// it `isParent` (the next row sits deeper). `expanded` is a preview
// affordance rather than a document property: SwiftUI's OutlineGroup owns its
// expansion state at runtime, so the export carries the tree and not which
// parts of it happen to be open.
export function outlineVisibleRows(rows) {
  const out = []
  if (!Array.isArray(rows)) return out
  let hiddenBelow = null          // level of the collapsed ancestor, if any
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {}
    const level = r.indent ?? 0
    if (hiddenBelow != null) {
      if (level > hiddenBelow) continue
      hiddenBelow = null
    }
    const next = rows[i + 1]
    const isParent = !!next && (next.indent ?? 0) > level
    out.push({ ...r, level, isParent })
    if (isParent && !r.expanded) hiddenBelow = level
  }
  return out
}

// ---------------------------------------------------------------------------
// Per-type style vocabularies the canvas branches on (AUDIT #19)
//
// These name style cases in string literals, which is exactly the shape that
// rots quietly: a misspelled case never matches and the canvas silently keeps
// its default treatment — the very defect #19 was about. They live here, next
// to the vocabularies they draw from, so a test can check each name is a real
// case of its own picker.
// ---------------------------------------------------------------------------

// Picker styles that lay their options out on screen. The menu-ish styles
// keep them behind a tap, which a still canvas cannot open, so those draw the
// selected value and a chevron instead.
export const PICKER_STYLES_SHOWING_OPTIONS = ['segmented', 'wheel', 'inline', 'palette']

// Menu styles that collapse the menu to its label, revealing the items only
// once opened.
export const MENU_STYLES_AS_BUTTON = ['button', 'borderlessButton']

// Which parts of a date a `displayedComponents` value asks for. The exporter
// maps the same four values onto `.date` / `.hourAndMinute` /
// `[.date, .hourAndMinute]` / `.hourMinuteAndSecond`, so this is the canvas
// half of one decision: show the parts the generated picker will show, and no
// others. Before phase 1.8 the canvas printed the raw stored ISO date
// whatever was chosen, so a time-only picker still previewed a date.
export function dateComponentsParts(components) {
  switch (components) {
    case 'date':                return { date: true,  time: false, seconds: false }
    case 'hourAndMinute':       return { date: false, time: true,  seconds: false }
    case 'hourMinuteAndSecond': return { date: false, time: true,  seconds: true  }
    default:                    return { date: true,  time: true,  seconds: false }
  }
}
