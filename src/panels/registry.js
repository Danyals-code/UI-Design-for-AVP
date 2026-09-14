// Panel type registry.
//
// Single source of truth for every panel type the designer supports. Each
// entry owns:
//   - `defaults`: the seed values used when a new panel of this type is
//     created (consumed by the store's `makePanel` factory).
//   - `emit(panel, ctx)`: emits SwiftUI source for this panel into the
//     exporter's output buffer via `ctx.push`. ctx supplies the shared
//     helpers (escapeString, swiftColor, unitsToPt, applyTextModifiers, etc.)
//     so emit functions stay terse.
//
// A future Phase 3 will add `inspectorSchema` (or `Inspector` component)
// per entry so PropertiesPanel can render type-specific controls without a
// switch. Reserved here intentionally — leave emit/defaults stable.
//
// Adding a new panel type now means: add one entry here. The store and the
// exporter pick it up automatically.

import {
  TEXT_STYLES, ptToUnits, unitsToPt, segmentedFrame, materialSwiftValue,
  NAVBAR_HEIGHT_PT, normalizeButton
} from '../appleSystem'

const textStyleToFontSize = (style) => ptToUnits(TEXT_STYLES[style]?.pt ?? 17)

// `fieldShape` picks the edge an input field draws: a pill (the visionOS
// default) or the stored corner radius. The canvas has always honoured it and
// the export said nothing, so a field the designer squared off came back
// round. `.clipShape` is where that lives in SwiftUI — the field's own
// recessed background is what gets clipped. AUDIT #20.
function fieldShapeModifier(panel) {
  const shape = panel.fieldShape || 'pill'
  if (shape === 'pill') return '.clipShape(Capsule())'
  const r = Math.round(unitsToPt(panel.cornerRadius ?? 0)) || 12
  return `.clipShape(RoundedRectangle(cornerRadius: ${r}))`
}

// Resolve a panel's colorToken/color to a valid UIColor Swift expression for
// use inside SimpleMaterial on 3D primitives. UIColor can bridge from Color.
function materialColor(colorToken, hexColor) {
  if (colorToken) {
    // e.g. 'systemBlue' → 'Color.blue', 'systemGreen' → 'Color.green'
    const known = {
      systemBlue: 'Color.blue', systemRed: 'Color.red', systemGreen: 'Color.green',
      systemOrange: 'Color.orange', systemYellow: 'Color.yellow', systemPurple: 'Color.purple',
      systemPink: 'Color.pink', systemTeal: 'Color.teal', systemIndigo: 'Color.indigo',
      systemGray: 'Color.gray', systemBrown: 'Color.brown', systemMint: 'Color.mint',
      systemCyan: 'Color.cyan', primary: 'Color.primary', secondary: 'Color.secondary'
    }
    if (known[colorToken]) return `UIColor(${known[colorToken]})`
  }
  if (hexColor) {
    const m = /^#([0-9a-f]{6})$/i.exec(hexColor)
    if (m) {
      const r = (parseInt(m[1].slice(0, 2), 16) / 255).toFixed(3)
      const g = (parseInt(m[1].slice(2, 4), 16) / 255).toFixed(3)
      const b = (parseInt(m[1].slice(4, 6), 16) / 255).toFixed(3)
      return `UIColor(Color(red: ${r}, green: ${g}, blue: ${b}))`
    }
  }
  return 'UIColor(Color.white)'
}

// LIST_STYLES doubles as the canvas's list-rendering preset table, so it
// carries a 'default' preset that SwiftUI has no `.default` case for --
// `.listStyle(.default)` does not compile. SwiftUI spells that meaning
// `.automatic`, and `.automatic` is the implicit default, so it is elided
// entirely rather than emitted as noise.
function swiftListStyle(key) {
  if (!key || key === 'default' || key === 'automatic') return ''
  return `.listStyle(.${key})`
}

// Emit a `.clipShape(RoundedRectangle(...))` chain suffix for a given corner
// radius in pt. Falls back to an empty string when radius is 0.
function clipShapeSuffix(radiusPt) {
  if (!radiusPt) return ''
  return `.clipShape(RoundedRectangle(cornerRadius: ${radiusPt}, style: .continuous))`
}

// Emit an `.overlay(<Shape>().stroke(_, lineWidth:))` chain so the shape
// keeps its fill while painting a SwiftUI-style border ring. Returns an
// empty string when the panel has no stroke configured.
function shapeStrokeOverlay(panel, shapeExpr, ctx) {
  const w = panel.strokeWidth || 0
  if (!w || !panel.strokeColor) return ''
  const color = ctx.swiftColor(null, panel.strokeColor)
  return `.overlay(${shapeExpr}.stroke(${color}, lineWidth: ${ctx.unitsToPt(w)}))`
}

// ---- emit helper conventions ----
//
// Every `emit(panel, ctx)` should call `ctx.push(line)` to append a single
// line at the current indentation. Multi-line output calls push multiple
// times. ctx fields:
//   push(line)        — append a line at current indent
//   ind               — current indentation string (for multi-line / nested)
//   escapeString(s)   — Swift string-literal escaping
//   swiftColor(t, h)  — semantic-token-or-hex → SwiftUI Color expression
//   unitsToPt(u)      — convert internal units → pt
//   applyTextModifiers(line)
//                     — appends Text-only modifier chain (.italic / .underline /
//                       .lineLimit / .tracking / .multilineTextAlignment)
//   sym               — convenience for panel.symbolName
//   fill, textColor   — pre-resolved Color expressions for panel.color and
//                       panel.textColor (most emit functions need these)
//   style, weight     — pre-resolved font style + weight clauses (e.g.
//                       '.body' and '.weight(.semibold)')

// Compile a panel tapAction into the SwiftUI statement that goes inside a
// Button/control closure. Shared by the Button emitter and the Navigation
// Bar toolbar emitter so both honour the same Interaction wiring.
//
// Unrecognized / null actions return a `/* no action */` BLOCK comment so
// the user can spot un-wired controls. It must stay a block comment: the
// result is interpolated mid-line, and a `//` line comment would swallow
// the rest of the expression. src/export/swiftui.test.js pins this.
export function compileTapAction(a, lookupItem = () => null) {
  if (!a || !a.type) return '/* no action */'
  if (a.type === 'navigateWindow') {
    const tgt = a.windowId ? lookupItem(a.windowId) : null
    // Use the window's `windowGroupId` — the same string the
    // exporter emits as `WindowGroup(id: "...")`. Falling back
    // to the sanitised name keeps legacy save files working.
    const gid = tgt?.windowGroupId
      || (tgt?.name ? tgt.name.replace(/[^A-Za-z0-9_]/g, '') : 'Window')
    return `openWindow(id: "${gid}")`
  }
  if (a.type === 'navigateTab') {
    return `selectedTab = ${a.tab ?? 0}`
  }
  if (a.type === 'presentSheet') {
    const tgt = a.panelId ? lookupItem(a.panelId) : null
    const flag = tgt?.name ? `isShowing${tgt.name.replace(/[^A-Za-z0-9_]/g, '')}` : 'isShowingSheet'
    return `${flag} = true`
  }
  if (a.type === 'dismiss') {
    const tgt = a.panelId ? lookupItem(a.panelId) : null
    const flag = tgt?.name ? `isShowing${tgt.name.replace(/[^A-Za-z0-9_]/g, '')}` : 'isShowingSheet'
    return `${flag} = false`
  }
  if (a.type === 'flipToggle') {
    const tgt = a.panelId ? lookupItem(a.panelId) : null
    const bind = tgt?.name ? tgt.name.replace(/[^A-Za-z0-9_]/g, '').replace(/^./, c => c.toLowerCase()) : 'toggleValue'
    return `${bind}.toggle()`
  }
  if (a.type === 'setToggle') {
    const tgt = a.panelId ? lookupItem(a.panelId) : null
    const bind = tgt?.name ? tgt.name.replace(/[^A-Za-z0-9_]/g, '').replace(/^./, c => c.toLowerCase()) : 'toggleValue'
    return `${bind} = ${a.value ? 'true' : 'false'}`
  }
  return '/* no action */'
}

export const PANELS = {
  // ---- Phase 0 — primitives ----
  canvas: {
    defaults: {
      size: [ptToUnits(240), ptToUnits(160)],
      color: '#ffffff',
      colorToken: 'systemBackground',
      cornerRadius: ptToUnits(16)
    },
    emit(panel, ctx) {
      // Canvas has no native SwiftUI 1:1; export as a placeholder Rectangle
      // sized to its frame. Mirrors the visual the designer renders.
      const { push, swiftColor, unitsToPt } = ctx
      const fill = swiftColor(panel.colorToken, panel.color)
      const cr = unitsToPt(panel.cornerRadius || 0)
      const clip = clipShapeSuffix(cr)
      push(`Rectangle().fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})${clip}`)
    }
  },

  text: {
    defaults: {
      size: null,           // null = auto-size from content (SwiftUI default)
      // Frame sizing mode — mirrors SwiftUI's `.frame()` / Figma's constraints.
      //   fit   — intrinsic size from content (SwiftUI default, `Text` hugs)
      //   fixed — explicit width (uses `size[0]` as the frame width)
      //   fill  — fills the parent stack's inner width (`.frame(maxWidth: .infinity)`)
      widthMode:     'fit',
      color: '#000000',
      colorToken: 'primary',
      cornerRadius: 0,
      text: 'Hello World',
      textStyle: 'body',
      // visionOS body defaults to Medium (one step heavier than iOS Regular)
      // for legibility on glass — see TEXT_STYLES in appleSystem.js.
      fontWeight: 'medium',
      textAlign: 'left'
      // Text-display modifiers (`.italic`, `.underline`, `.lineLimit`,
      // `.tracking`, `.kerning`, `.baselineOffset`, `.truncationMode`,
      // `.minimumScaleFactor`, `.allowsTightening`, `.fontDesign`,
      // `.monospacedDigit`, `.lineSpacing`, `.textCase`,
      // `.strikethrough`) live in the modifier stack
      // (`src/modifiers/registry.js`, group: 'Text') — add them through
      // the Modifiers section of the inspector. They used to be seeded
      // here as panel-root fields too, but had no inspector surface and
      // weren't read by the exporter, so the duplicates have been
      // removed.
    },
    emit(panel, ctx) {
      const { push, escapeString, applyTextModifiers, style, weight, textColor } = ctx
      push(applyTextModifiers(`Text("${escapeString(panel.text || '')}").font(.${style}${weight}).foregroundStyle(${textColor})`))
    }
  },

  button: {
    defaults: {
      // Fixed-size button. visionOS buttons ship at three standard sizes —
      // small (65×32), regular (86×44), large (101×52) — selected by
      // `controlSize`, which is also what the exporter emits. Side padding
      // (text inset) is fixed at 12pt; see the renderer in Panel3D.jsx.
      // Width/height are NOT user-editable: `computeButtonFramePt` derives
      // the frame from the size preset and the label, so every button on
      // the canvas matches an Apple-spec frame.
      //
      // Neither `size` nor `cornerRadius` is stored. They used to be, which
      // meant the canvas read a mirrored copy while the exporter read
      // `controlSize` / `buttonBorderShape`, and the two could disagree.
      // Both are derived at render time now.
      controlSize: 'regular',            // 'small' | 'regular' | 'large'
      color: '#b7b6b1',
      colorToken: 'designButton',
      text: 'Button',
      textStyle: 'body',
      fontWeight: 'semibold',
      textAlign: 'center',
      textColor: '#ffffff',
      textColorToken: 'designButtonText',
      // visionOS default: `.automatic` resolves to a glass-bordered capsule
      // for text/text+icon buttons. We elide `.buttonStyle(...)` from the
      // exporter when the value is `automatic` so the device renders the
      // system-tuned glass effect without an override.
      buttonStyle: 'automatic',
      buttonBorderShape: 'automatic',
      // SwiftUI action wiring. When the button is tapped *in preview*
      // (clicks in the editor stay as drag/select), `tapAction`
      // dispatches a typed effect against the live store. Null means
      // the button is purely visual.
      // Schema:
      //   { type: 'navigateWindow', windowId: '…' }     — swap active window
      //   { type: 'navigateTab',    stackId:  '…', tab: N } — switch a TabView
      //   { type: 'presentSheet',   panelId:  '…' }     — show a sheet
      //   { type: 'dismiss' }                           — close current sheet
      //   { type: 'setToggle',      panelId:  '…', value: bool }
      //   { type: 'flipToggle',     panelId:  '…' }
      tapAction: null
    },
    emit(panel, ctx) {
      const { push, escapeString, swiftColor, sym, lookupItem } = ctx
      const label = sym
        ? `Label("${escapeString(panel.text || 'Button')}", systemImage: "${sym}")`
        : `Text("${escapeString(panel.text || 'Button')}")`
      // `role:` is part of the Button initializer (not a modifier) so it
      // sits inside the parentheses. visionOS still draws a glass capsule
      // but the system flags it as destructive/cancel for VoiceOver.
      // A scene built before `destructive` was removed from BUTTON_STYLES
      // still carries `buttonStyle: 'destructive'`, which is not a real
      // ButtonStyle and does not compile. Normalising here means the emitter
      // never writes that line, whatever shape the scene arrived in.
      const btn = normalizeButton(panel)
      const role = btn.buttonRole && btn.buttonRole !== 'none'
        ? `(role: .${btn.buttonRole}) ` : ''
      // `.automatic` and `.plain` are SwiftUI's built-in zero-config styles —
      // for `.automatic` we omit the modifier entirely so visionOS picks the
      // system glass treatment.
      const bs = btn.buttonStyle && btn.buttonStyle !== 'automatic' && btn.buttonStyle !== 'plain'
        ? `.buttonStyle(.${btn.buttonStyle})` : ''
      const shape = btn.buttonBorderShape && btn.buttonBorderShape !== 'automatic'
        ? `.buttonBorderShape(.${btn.buttonBorderShape})` : ''
      const size = btn.controlSize && btn.controlSize !== 'regular'
        ? `.controlSize(.${btn.controlSize})` : ''
      const tint = panel.tint
        ? `.tint(${swiftColor(null, panel.tint)})` : ''
      // Compile the editor's `tapAction` to the canonical SwiftUI
      // closure body. Each action type maps to a single SwiftUI idiom
      // — they all assume standard bindings in the host View:
      //   navigateWindow → `openWindow(id:)`        (@Environment OpenWindowAction)
      //   navigateTab    → assignment to `selectedTab`   (@State binding)
      //   presentSheet   → set the `isShowingX` flag     (@State binding)
      //   dismiss        → clear the `isShowingX` flag   (@State binding)
      //   flipToggle     → call `.toggle()` on the binding
      //   setToggle      → assignment to the binding
      // Unrecognized / null actions emit a `/* no action */` comment so
      // the user can spot un-wired buttons in the source. It MUST stay a
      // BLOCK comment: the result is interpolated mid-line into
      // `Button{ <body> } label: { <label> }`, so a `//` line comment would
      // swallow the closing brace, the `label:` argument and the whole
      // trailing modifier chain, emitting Swift that does not compile.
      // src/export/swiftui.test.js pins this.
      const body = compileTapAction(panel.tapAction, lookupItem)
      push(`Button${role}{ ${body} } label: { ${label} }${bs}${shape}${size}${tint}`)
    }
  },

  image: {
    defaults: {
      size: [ptToUnits(320), ptToUnits(200)],
      color: '#c7c7cc',
      colorToken: 'tertiary',
      cornerRadius: ptToUnits(14),
      // Resolvable image source: a base64 data URL for an imported
      // asset, a /public path for template art, or an external URL the
      // user pasted. Never a `blob:` URL — those are scoped to the page
      // session and would not survive a reload or an export.
      imageUrl: null,
      // Back-reference to the assets-library record when the image came
      // from there, so the exporter can name the asset rather than
      // inlining its bytes. Null for pasted URLs and template paths.
      imageAssetId: null
    },
    emit(panel, ctx) {
      const { push, sym, escapeString } = ctx
      if (sym) { push(`Image(systemName: "${sym}")`); return }
      // The export used to emit a `photo` placeholder whatever the designer
      // had actually put in the frame, so an image reached Xcode as a
      // symbol. It now says what the source is. AUDIT #20.
      const url = panel.imageUrl
      if (!url) { push(`Image(systemName: "photo")   // no image set`); return }
      if (/^https?:\/\//i.test(url)) {
        push(`AsyncImage(url: URL(string: "${escapeString(url)}"))`)
        return
      }
      // A data: URL from the asset library, or a bundled /public path. Either
      // way the bytes belong in an asset catalog rather than in the source,
      // so name the asset and say where it came from.
      const name = /^data:/i.test(url)
        ? (panel.name || 'Image')
        : (url.split('/').pop() || 'Image').replace(/\.[^.]+$/, '')
      push(`Image("${escapeString(name)}")   // add this asset to your catalog`)
    }
  },

  toggle: {
    defaults: {
      // visionOS Toggle renders as `Label · Switch` end-to-end across
      // its container. We default the frame to a full-row size so the
      // canvas matches that — the rendering code splits the row into
      // a leading text label and a trailing 52×32 switch track.
      size: [ptToUnits(280), ptToUnits(36)],
      widthMode: 'fill',
      text: 'Toggle',
      textStyle: 'body',
      textAlign: 'left',
      textColor: '#000000',
      textColorToken: 'primary',
      // visionOS toggles use system green for the ON state — Apple's
      // official visionOS Figma kit ships the switch in `#32d74b` /
      // systemGreen, matching the iOS/iPadOS treatment rather than the
      // tinted blue we previously defaulted to.
      color: '#30d158',
      colorToken: 'systemGreen',
      cornerRadius: 0,
      toggleOn: true
    },
    emit(panel, ctx) {
      const { push, escapeString, swiftColor } = ctx
      // Spec §1.4 — `.toggleStyle(.automatic)` resolves to `.switch` on
      // visionOS, so we elide the modifier when the user kept the default.
      const ts = panel.styles?.toggleStyle && panel.styles.toggleStyle !== 'automatic'
        ? `.toggleStyle(.${panel.styles.toggleStyle})` : ''
      const cs = panel.styles?.controlSize && panel.styles.controlSize !== 'regular'
        ? `.controlSize(.${panel.styles.controlSize})` : ''
      const tint = panel.tint ? `.tint(${swiftColor(null, panel.tint)})` : ''
      push(`Toggle("${escapeString(panel.text || 'Toggle')}", isOn: .constant(${panel.toggleOn ? 'true' : 'false'}))${ts}${cs}${tint}`)
    }
  },

  segmented: {
    defaults: {
      // Frame fits the segment count: 88pt per segment, 4pt gaps + edge
      // inset, fixed 44pt pill. Three segments → 280×44. Always rendered as
      // a pill. Both surfaces read from the scene's Views material tier: the
      // long background track is the Recessed Material View (`colorToken`),
      // the raised selection pill is the Thicker tier (`selectedColorToken`).
      size: segmentedFrame(3),
      segments: ['Day', 'Week', 'Month'],
      selectedSegment: 1,
      colorToken: 'viewRecessed',
      color: '#2c2c2e',
      selectedColorToken: 'viewThicker'
    },
    emit(panel, ctx) {
      // Segmented control = Picker with .pickerStyle(.segmented), backed by
      // the chosen SwiftUI Material tier clipped to a capsule.
      const { push, escapeString } = ctx
      const opts = panel.segments || []
      const sel = opts[panel.selectedSegment ?? 0] || ''
      // The track sits on the chosen scene material; map it to the closest
      // SwiftUI ShapeStyle (Material) for export. Works for any of the 24
      // library materials, not just the four Views tiers.
      const matSwift = materialSwiftValue(panel.colorToken)
      push(`Picker("", selection: .constant("${escapeString(sel)}")) {`)
      opts.forEach((o) => push(`    Text("${escapeString(o)}").tag("${escapeString(o)}")`))
      // `selectedColorToken` — the raised selection pill's material tier —
      // is deliberately not emitted: `.pickerStyle(.segmented)` draws that
      // pill itself and SwiftUI exposes no API to re-material it. The canvas
      // has to paint something there, so it uses the tier; the export has
      // nowhere to put it. Recorded as EXEMPT in parity.baseline.js.
      push(`}.pickerStyle(.segmented).background(${matSwift}, in: Capsule())`)
    }
  },

  slideshow: {
    defaults: {
      size: [ptToUnits(360), ptToUnits(220)],
      color: '#e3e3e8',
      colorToken: 'systemFill',
      cornerRadius: ptToUnits(18),
      slideCount: 3,
      currentSlide: 0,
      text: 'Slideshow'
    },
    emit(panel, ctx) {
      // No native primitive — paginated TabView is Apple's pattern.
      const { push, escapeString } = ctx
      push(`TabView {`)
      const n = panel.slideCount ?? 3
      for (let i = 0; i < n; i++) {
        push(`    Text("${escapeString(panel.text || 'Slide')} ${i + 1}").tag(${i})`)
      }
      push(`}.tabViewStyle(.page)`)
    }
  },

  ticker: {
    defaults: {
      size: [ptToUnits(420), ptToUnits(36)],
      color: '#1c1c1e',
      colorToken: 'secondarySystemBackground',
      cornerRadius: ptToUnits(18),
      text: 'Breaking News  ·  Latest update  ·  More stories  ·  Live coverage',
      textStyle: 'footnote',
      fontWeight: 'semibold',
      textColor: '#ffffff',
      textColorToken: null,
      textAlign: 'left'
    },
    emit(panel, ctx) {
      const { push, escapeString, applyTextModifiers, style, weight, textColor } = ctx
      // Ticker has no native primitive — emit a marquee-styled Text inside a
      // single-line ScrollView. User wires the scroll animation themselves.
      push(`ScrollView(.horizontal, showsIndicators: false) {`)
      push(applyTextModifiers(`    Text("${escapeString(panel.text || '')}").font(.${style}${weight}).foregroundStyle(${textColor})`))
      push(`}`)
    }
  },

  search: {
    defaults: {
      // Matches Apple's visionOS Figma kit: 305×44, radius 12. Apple's
      // search field is the same dimensions as the text field — only the
      // leading mic affordance differs.
      size: [ptToUnits(305), ptToUnits(44)],
      // Default material is the Recessed view tier (visionOS search look);
      // the Material picker swaps among the view tiers.
      color: '#2c2c2e',
      colorToken: 'viewRecessed',
      cornerRadius: ptToUnits(12),
      // Pill (capsule) edge by default; the Edge toggle can switch to Rounded.
      fieldShape: 'pill',
      text: 'Search',
      // Live value the wearer typed in preview mode. Persisted on the
      // panel so the preview round-trips through state updates; emit
      // ignores it (SwiftUI's `.searchable` binds the parent's @State).
      searchValue: '',
      textStyle: 'body',
      fontWeight: 'medium',          // visionOS body weight
      // Labels/Secondary on glass — see textfield rationale.
      textColor: '#545454',
      textColorToken: null,
      textAlign: 'left'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      push(`// .searchable(text: $searchText, prompt: "${escapeString(panel.text || 'Search')}")   // attach on parent view`)
    }
  },

  // Navigation Bar — a chrome strip pinned across the top of a window
  // with one of 6 fixed styles. Width tracks the parent's inner width
  // (`widthMode: 'fill'`); height is locked at 92pt. Each style picks
  // a leading slot (avatar / back chip / button group) and a trailing
  // slot (avatar / search / button group); the title can be either
  // leading-aligned or centred. See NAVBAR_STYLE_SPECS in appleSystem.js
  // for the per-style layout rules.
  navbar: {
    defaults: {
      size: [ptToUnits(600), ptToUnits(NAVBAR_HEIGHT_PT)],
      widthMode: 'fill',           // always fills the parent window width
      heightMode: 'fixed',          // height locked to 92pt by spec
      color: '#000000',
      colorToken: null,             // transparent — sits over the parent's glass
      cornerRadius: 0,
      navbarStyle: 'trailingButtons',
      title: 'Title',
      // Editable button arrays. Each entry:
      //   { id, symbolName, label, tapAction }
      // `symbolName` is an SF Symbol; `label` shows when symbolName is null.
      // `tapAction` mirrors the Button panel's schema (see Button defaults)
      // — Interaction picker in the inspector configures it per-button.
      //
      // Both arrays seed with sensible defaults so the
      // `leadingTrailingButtons` style ships with buttons on both sides
      // out of the box. Other styles that don't read leading still
      // ignore it, so the extra defaults are harmless.
      leadingButtons:  [
        { id: 'nb-l-1', symbolName: 'list.bullet', label: '', tapAction: null }
      ],
      trailingButtons: [
        { id: 'nb-t-1', symbolName: 'magnifyingglass', label: '', tapAction: null },
        { id: 'nb-t-2', symbolName: 'ellipsis',        label: '', tapAction: null }
      ]
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      // No 1:1 SwiftUI primitive — exported as a comment placeholder so
      // the designer can wire it manually (or via a future toolbar map).
      push(`// NavigationBar (${panel.navbarStyle}) — title: "${escapeString(panel.title || '')}"`)
      push(`// TODO: map to .toolbar { ... } modifier on the parent window`)
    }
  },

  list: {
    defaults: {
      // Height is auto-derived from (row count × style row height) + style
      // padding at render time; see computeListHeightPt in appleSystem.js.
      // Only width is user-editable.
      size: [ptToUnits(360), ptToUnits(0)],
      color: '#ffffff',
      colorToken: 'systemBackground',
      cornerRadius: ptToUnits(14),
      rows: [
        { title: 'First Item',  subtitle: 'Subtitle text' },
        { title: 'Second Item', subtitle: 'Subtitle text' },
        { title: 'Third Item',  subtitle: 'Subtitle text' },
        { title: 'Fourth Item', subtitle: 'Subtitle text' }
      ],
      // Must match a key in LIST_STYLES (appleSystem.js): 'default' |
      // 'plain' | 'inset' | 'insetGrouped' | 'grouped' | 'sidebar'. All but
      // 'default' map 1:1 onto SwiftUI's `.listStyle(.*)` cases — visionOS
      // does not ship `.bordered` / `.carousel` / `.elliptical` so we don't
      // list them either. LIST_STYLES is a CANVAS preset table (row height,
      // insets, separators) as much as a SwiftUI mirror, and its 'default'
      // preset has no `.default` case in SwiftUI; `swiftListStyle` below
      // maps it to `.automatic`, which is what it means.
      listStyle: 'insetGrouped',
      // Spec §1.19 — list-row modifiers. Each affects the export only
      // (canvas list visuals are driven by the listStyle preset).
      listRowSeparator: 'automatic',
      listRowSeparatorTint: '',
      listRowBackground: '',
      listItemTint: '',
      listRowSpacing: 0,
      headerProminence: 'standard'
    },
    emit(panel, ctx) {
      const { push, escapeString, swiftColor } = ctx
      // Per-row modifiers attach to each row; build a single trailing
      // chain we paste onto every row line so generated SwiftUI matches
      // what the inspector specified.
      const rowMods = []
      if (panel.listRowSeparator && panel.listRowSeparator !== 'automatic') {
        rowMods.push(`.listRowSeparator(.${panel.listRowSeparator})`)
      }
      if (panel.listRowSeparatorTint) {
        rowMods.push(`.listRowSeparatorTint(${swiftColor(null, panel.listRowSeparatorTint)})`)
      }
      if (panel.listRowBackground) {
        rowMods.push(`.listRowBackground(${swiftColor(null, panel.listRowBackground)})`)
      }
      if (panel.listItemTint) {
        rowMods.push(`.listItemTint(${swiftColor(null, panel.listItemTint)})`)
      }
      const rowChain = rowMods.join('')
      push(`List {`)
      ;(panel.rows || []).forEach((r) => {
        const rowLabel = r.systemImage
          ? `Label("${escapeString(r.title || '')}", systemImage: "${r.systemImage}")`
          : `Text("${escapeString(r.title || '')}")`
        push(`    ${rowLabel}${rowChain}`)
      })
      const ls = swiftListStyle(panel.listStyle)
      const hp = panel.headerProminence && panel.headerProminence !== 'standard'
        ? `.headerProminence(.${panel.headerProminence})` : ''
      const sp = panel.listRowSpacing ? `.listRowSpacing(${panel.listRowSpacing})` : ''
      push(`}${ls}${hp}${sp}`)
    }
  },

  table: {
    defaults: {
      size: [ptToUnits(440), ptToUnits(260)],
      color: '#ffffff',
      colorToken: 'systemBackground',
      cornerRadius: ptToUnits(10),
      columns: ['Name', 'Status', 'Type'],
      rows: [
        ['Alpha',   'Active',   'A'],
        ['Bravo',   'Pending',  'B'],
        ['Charlie', 'Complete', 'A'],
        ['Delta',   'Active',   'C']
      ],
      tableStyle: 'automatic'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      push(`Table(/* rows */[]) {`)
      ;(panel.columns || []).forEach((c) => push(`    TableColumn("${escapeString(c)}") { _ in Text("") }`))
      const ts = panel.tableStyle && panel.tableStyle !== 'automatic'
        ? `.tableStyle(.${panel.tableStyle})` : ''
      push(`}${ts}`)
    }
  },

  menu: {
    defaults: {
      size: [ptToUnits(220), ptToUnits(192)],
      color: '#ffffff',
      colorToken: 'secondarySystemBackground',
      cornerRadius: ptToUnits(12),
      text: 'Menu',
      menuItems: ['Cut', 'Copy', 'Paste', 'Duplicate', 'Select All'],
      material: 'thick',
      // Spec §1.14 — menu style/order/indicator. All default to `.automatic`
      // so the exporter elides them unless the designer overrides.
      menuStyle: 'automatic',
      menuOrder: 'automatic',
      menuIndicator: 'automatic'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      push(`Menu("${escapeString(panel.text || 'Menu')}") {`)
      ;(panel.menuItems || []).forEach((m) => push(`    Button("${escapeString(m)}") { }`))
      const ms = panel.menuStyle && panel.menuStyle !== 'automatic'
        ? `.menuStyle(.${panel.menuStyle})` : ''
      const mo = panel.menuOrder && panel.menuOrder !== 'automatic'
        ? `.menuOrder(.${panel.menuOrder})` : ''
      const mi = panel.menuIndicator && panel.menuIndicator !== 'automatic'
        ? `.menuIndicator(.${panel.menuIndicator})` : ''
      push(`}${ms}${mo}${mi}`)
    }
  },

  progress: {
    defaults: {
      size: [ptToUnits(240), ptToUnits(8)],
      color: '#e3e3e8',
      colorToken: 'systemFill',
      cornerRadius: ptToUnits(4),
      value: 0.65,
      total: 1.0,                    // SwiftUI default — spec §1.10
      indeterminate: false,
      progressViewStyle: 'automatic',
      text: ''                        // optional title label
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      const title = panel.text ? `"${escapeString(panel.text)}"` : null
      const totalArg = panel.total != null && panel.total !== 1 ? `, total: ${panel.total}` : ''
      let ctor
      if (panel.indeterminate) {
        ctor = title ? `ProgressView(${title})` : `ProgressView()`
      } else {
        ctor = title
          ? `ProgressView(${title}, value: ${panel.value ?? 0.5}${totalArg})`
          : `ProgressView(value: ${panel.value ?? 0.5}${totalArg})`
      }
      const ps = panel.progressViewStyle && panel.progressViewStyle !== 'automatic'
        ? `.progressViewStyle(.${panel.progressViewStyle})` : ''
      push(`${ctor}${ps}`)
    }
  },

  slider: {
    defaults: {
      size: [ptToUnits(280), ptToUnits(60)],
      // No background plate — a SwiftUI Slider draws only its track +
      // thumb (rendered by the canvas overlay), so the panel fill is null.
      color: null,
      colorToken: null,
      cornerRadius: ptToUnits(2),
      sliderValue: 0.5,
      // Spec §1.5 — bounds default `0...1`, step `0` (continuous), no labels.
      sliderMin: 0,
      sliderMax: 1,
      sliderStep: 0,
      sliderMinLabel: '',
      sliderMaxLabel: ''
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      const v = panel.sliderValue ?? 0.5
      const lo = panel.sliderMin ?? 0
      const hi = panel.sliderMax ?? 1
      const stepArg = panel.sliderStep && panel.sliderStep > 0 ? `, step: ${panel.sliderStep}` : ''
      const range = !(lo === 0 && hi === 1) || stepArg
      // visionOS Sliders accept optional `minimumValueLabel` /
      // `maximumValueLabel` for accessory icons or text. Emit the labelled
      // form when either is non-empty so the label slot is rendered on
      // device exactly as the canvas previews.
      if (panel.sliderMinLabel || panel.sliderMaxLabel) {
        push(`Slider(value: .constant(${v}), in: ${lo}...${hi}${stepArg}) {`)
        push(`    Text("")`)
        push(`} minimumValueLabel: {`)
        push(`    Text("${escapeString(panel.sliderMinLabel || '')}")`)
        push(`} maximumValueLabel: {`)
        push(`    Text("${escapeString(panel.sliderMaxLabel || '')}")`)
        push(`}`)
      } else if (range) {
        push(`Slider(value: .constant(${v}), in: ${lo}...${hi}${stepArg})`)
      } else {
        push(`Slider(value: .constant(${v}))`)
      }
    }
  },

  stepper: {
    defaults: {
      // visionOS HIG: label on leading edge, value + ± buttons on
      // trailing edge — same row shape as Toggle. Width fills the
      // owning stack so the controls anchor on the trailing edge no
      // matter how wide the row gets.
      size: [ptToUnits(280), ptToUnits(36)],
      widthMode: 'fill',
      text: 'Stepper',
      textStyle: 'body',
      textAlign: 'left',
      textColor: '#000000',
      textColorToken: 'primary',
      color: '#e3e3e8',
      colorToken: 'systemFill',
      cornerRadius: 0,
      stepperValue: 5,
      stepperMin: 0,
      stepperMax: 10,
      stepperStep: 1            // SwiftUI default per spec §1.6
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      const step = panel.stepperStep && panel.stepperStep !== 1 ? `, step: ${panel.stepperStep}` : ''
      push(`Stepper("${escapeString(panel.text || 'Stepper')}", value: .constant(${panel.stepperValue ?? 0}), in: ${panel.stepperMin ?? 0}...${panel.stepperMax ?? 10}${step})`)
    }
  },

  gauge: {
    defaults: {
      size: [ptToUnits(140), ptToUnits(80)],
      color: '#e3e3e8',
      colorToken: 'systemFill',
      cornerRadius: ptToUnits(8),
      // `value` lives in `gaugeMin…gaugeMax`, so a 0…100 gauge reading "70"
      // holds 70, not 0.7. It was seeded 0.7 while the canvas clamped every
      // value to 0…1 — which made the bar look right and the exported
      // `Gauge(value: 0.7, in: 0...100)` read as 0.7%. AUDIT #17.
      value: 70,
      gaugeMin: 0,
      gaugeMax: 100,
      text: '70',
      gaugeMinLabel: '',
      gaugeMaxLabel: '',
      gaugeStyle: 'automatic',
      // Optional 2-stop tint gradient — spec §1.11 `tint(_:)` accepts a
      // Gradient on capacity gauges. Empty = system tint.
      gaugeTintFrom: '',
      gaugeTintTo: ''
    },
    emit(panel, ctx) {
      const { push, escapeString, swiftColor } = ctx
      const lo = panel.gaugeMin ?? 0
      const hi = panel.gaugeMax ?? 1
      const valueLabel = panel.text ? `currentValueLabel: { Text("${escapeString(panel.text)}") }` : null
      const minLabel = panel.gaugeMinLabel ? `minimumValueLabel: { Text("${escapeString(panel.gaugeMinLabel)}") }` : null
      const maxLabel = panel.gaugeMaxLabel ? `maximumValueLabel: { Text("${escapeString(panel.gaugeMaxLabel)}") }` : null
      const labelArgs = [valueLabel, minLabel, maxLabel].filter(Boolean).join(', ')
      const labelClause = labelArgs ? `, ${labelArgs}` : ''
      const gs = panel.gaugeStyle && panel.gaugeStyle !== 'automatic'
        ? `.gaugeStyle(.${panel.gaugeStyle})` : ''
      const tint = panel.gaugeTintFrom && panel.gaugeTintTo
        ? `.tint(Gradient(colors: [${swiftColor(null, panel.gaugeTintFrom)}, ${swiftColor(null, panel.gaugeTintTo)}]))`
        : ''
      push(`Gauge(value: ${panel.value ?? 0.5}, in: ${lo}...${hi}${labelClause}) { Text("") }${gs}${tint}`)
    }
  },

  // ---- Phase 1 — Layout primitives ----
  spacer: {
    defaults: {
      size: [ptToUnits(20), ptToUnits(20)],
      color: '#00000000',
      colorToken: null,
      cornerRadius: 0,
      isSpacer: true        // flag for the layout engine to expand
    },
    emit(_panel, ctx) { ctx.push(`Spacer()`) }
  },

  divider: {
    defaults: {
      size: [ptToUnits(300), ptToUnits(1)],
      color: '#c7c7cc',
      colorToken: 'tertiary',
      cornerRadius: 0
    },
    emit(_panel, ctx) { ctx.push(`Divider()`) }
  },

  rectangle: {
    defaults: {
      size: [ptToUnits(200), ptToUnits(140)],
      color: '#007aff',
      colorToken: 'systemBlue',
      cornerRadius: ptToUnits(12),
      strokeColor: null,
      strokeWidth: 0
    },
    emit(panel, ctx) {
      const { push, swiftColor, unitsToPt } = ctx
      const fill = swiftColor(panel.colorToken, panel.color)
      const cr = unitsToPt(panel.cornerRadius || 0)
      // Rectangles with a non-zero corner radius emit as RoundedRectangle
      // directly so the stroke overlay can use the same shape — SwiftUI's
      // .clipShape isn't enough to keep a stroke on the rounded edge.
      const shape = cr > 0
        ? `RoundedRectangle(cornerRadius: ${cr}, style: .continuous)`
        : `Rectangle()`
      const stroke = shapeStrokeOverlay(panel, shape, ctx)
      push(`${shape}.fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})${stroke}`)
    }
  },

  circle: {
    defaults: {
      size: [ptToUnits(120), ptToUnits(120)],
      color: '#34c759',
      colorToken: 'systemGreen',
      cornerRadius: 0,
      strokeColor: null,
      strokeWidth: 0
    },
    emit(panel, ctx) {
      const { push, swiftColor, unitsToPt } = ctx
      const fill = swiftColor(panel.colorToken, panel.color)
      const stroke = shapeStrokeOverlay(panel, 'Circle()', ctx)
      push(`Circle().fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})${stroke}`)
    }
  },

  capsule: {
    defaults: {
      size: [ptToUnits(200), ptToUnits(60)],
      color: '#af52de',
      colorToken: 'systemPurple',
      cornerRadius: 0,       // capsule auto-computes radius = min(w,h)/2
      strokeColor: null,
      strokeWidth: 0
    },
    emit(panel, ctx) {
      const { push, swiftColor, unitsToPt } = ctx
      const fill = swiftColor(panel.colorToken, panel.color)
      const stroke = shapeStrokeOverlay(panel, 'Capsule()', ctx)
      push(`Capsule().fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})${stroke}`)
    }
  },

  // ---- Phase 2 — Presentation ----
  // Phase-1 emit: matches the prior `// .sheet(...)` / `.alert(...)` /
  // `.popover(...)` placeholder comments. Phase 4 will rewrite these as
  // proper modifier emission on the parent view.
  // Presentation panels are emitted by the parent View as `.sheet(...)` /
  // `.popover(...)` / `.alert(...)` modifiers (see export/swiftui.js's
  // `emitPresentationModifier`). The exporter filters them out before
  // calling emit() — these no-op emit functions exist as a safety net in
  // case someone renders a presentation outside a window context.
  sheet: {
    defaults: {
      size: [ptToUnits(600), ptToUnits(400)],
      color: '#ffffff',
      colorToken: 'systemBackground',
      cornerRadius: ptToUnits(20),
      text: 'Sheet Content',
      sheetDetent: 'large',          // 'medium' | 'large' | 'fraction' | 'height'
      sheetFraction: 0.5,             // honoured when sheetDetent === 'fraction'
      sheetHeight: 320,               // pt — honoured when sheetDetent === 'height'
      material: 'regular',
      // Spec §1.25 — full presentation modifier set.
      presentationDragIndicator: 'automatic',
      presentationCornerRadius: 0,    // 0 = system (no override)
      presentationContentInteraction: 'automatic',
      presentationBackgroundInteraction: 'automatic',
      interactiveDismissDisabled: false
    },
    emit(_panel, ctx) {
      ctx.push('// sheet — emitted as a .sheet(...) modifier on the parent view')
    }
  },

  popover: {
    defaults: {
      size: [ptToUnits(260), ptToUnits(180)],
      color: '#ffffff',
      colorToken: 'secondarySystemBackground',
      cornerRadius: ptToUnits(12),
      text: 'Popover',
      material: 'thick',
      popoverAnchor: 'rectBounds',
      popoverArrowEdge: 'automatic'   // ignored on visionOS but preserved
    },
    emit(_panel, ctx) {
      ctx.push('// popover — emitted as a .popover(...) modifier on the parent view')
    }
  },

  alert: {
    defaults: {
      size: [ptToUnits(300), ptToUnits(180)],
      color: '#ffffff',
      colorToken: 'secondarySystemBackground',
      cornerRadius: ptToUnits(16),
      text: 'Alert Title',
      alertMessage: 'Are you sure you want to proceed?',
      alertButtons: ['Cancel', 'OK'],
      material: 'thick',
      // Spec §1.25 — dialog metadata.
      dialogSeverity: 'automatic',
      dialogIcon: '',
      dialogSuppressionToggle: false
    },
    emit(_panel, ctx) {
      ctx.push('// alert — emitted as an .alert(...) modifier on the parent view')
    }
  },

  // ---- Phase 3 — Views & Controls ----
  label: {
    defaults: {
      size: [ptToUnits(200), ptToUnits(28)],
      color: '#000000',
      colorToken: 'primary',
      cornerRadius: 0,
      text: 'Label',
      textStyle: 'body',
      fontWeight: 'medium',          // visionOS body weight
      textAlign: 'left',
      iconName: 'A',
      iconColor: '#007aff',
      // Apple sidebar Label — a tinted rounded-rect tile behind the glyph
      // (Settings.app pattern). null tile ⇒ fall back to the classic circle.
      iconTileColor: null,   // semantic token or '#rrggbb'
      iconTileSize: 28,      // pt
      iconTileRadius: 6,     // pt
      // Spec §1.12 — `.imageScale` defaults to `.medium`; `symbolRenderingMode`
      // defaults to monochrome. Both are emitted only when overridden.
      imageScale: 'medium'
    },
    emit(panel, ctx) {
      const { push, escapeString, sym, style, weight, swiftColor } = ctx
      const icon = sym || panel.iconName || 'circle.fill'
      const ls = panel.styles?.labelStyle && panel.styles.labelStyle !== 'automatic'
        ? `.labelStyle(.${panel.styles.labelStyle})` : ''
      const is = panel.imageScale && panel.imageScale !== 'medium'
        ? `.imageScale(.${panel.imageScale})` : ''
      const sm = panel.symbolRenderingMode && panel.symbolRenderingMode !== 'monochrome'
        ? `.symbolRenderingMode(.${panel.symbolRenderingMode})` : ''
      const trailing = `.font(.${style}${weight})${ls}${is}${sm}`

      // The Settings.app icon tile — a tinted rounded square behind the
      // glyph. The canvas has drawn it since the Label existed and the
      // export dropped every part of it: the tile, its colour, its radius,
      // its size, and even the glyph's own colour. AUDIT #20.
      //
      // `Label(_:systemImage:)` has nowhere to put any of that, so a tile
      // needs the explicit two-closure form.
      const tile = panel.iconTileColor
      if (!tile) {
        const fg = panel.iconColor ? `.foregroundStyle(${swiftColor(null, panel.iconColor)})` : ''
        push(`Label("${escapeString(panel.text || 'Label')}", systemImage: "${icon}")${trailing}${fg}`)
        return
      }
      const tileSize = panel.iconTileSize ?? 28
      const tileRadius = panel.iconTileRadius ?? 6
      const glyph = swiftColor(null, panel.iconColor || '#ffffff')
      push(`Label {`)
      push(`    Text("${escapeString(panel.text || 'Label')}")`)
      push(`} icon: {`)
      push(`    Image(systemName: "${icon}")`)
      push(`        .foregroundStyle(${glyph})`)
      push(`        .frame(width: ${tileSize}, height: ${tileSize})`)
      push(`        .background(${swiftColor(panel.iconTileColor.startsWith('#') ? null : panel.iconTileColor, panel.iconTileColor)}, in: RoundedRectangle(cornerRadius: ${tileRadius}))`)
      push(`}${trailing}`)
    }
  },

  textfield: {
    defaults: {
      // Matches Apple's visionOS Figma kit: 305×44, radius 12, placeholder
      // text in #545454 on the recessed glass plate.
      size: [ptToUnits(305), ptToUnits(44)],
      // Recessed glass material by default (visionOS field look); the
      // Material picker swaps among the view tiers.
      color: '#2c2c2e',
      colorToken: 'viewRecessed',
      cornerRadius: ptToUnits(12),
      // Pill (capsule) edge by default; the Edge toggle can switch to Rounded.
      fieldShape: 'pill',
      text: 'Placeholder',
      textfieldValue: '',
      textStyle: 'body',
      // Apple's visionOS placeholder is `#545454` (Labels/Secondary on glass),
      // not the iOS-stock `secondary` (#8e8e93). Clear the token so the
      // explicit hex wins over scheme resolution.
      textColor: '#545454',
      textColorToken: null,
      // Spec §1.3 — keyboardType, textContentType, submitLabel,
      // autocorrectionDisabled, textInputAutocapitalization, axis, lineLimit.
      keyboardType: 'default',
      textContentType: '',                  // '' = no .textContentType modifier
      submitLabel: 'return',
      autocorrectionDisabled: false,
      textInputAutocapitalization: 'sentences',
      axis: 'horizontal',                   // 'horizontal' (default) | 'vertical'
      lineLimit: 1                          // honoured when axis === 'vertical'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      const ax = panel.axis === 'vertical' ? `, axis: .vertical` : ''
      const lines = []
      lines.push(`TextField("${escapeString(panel.text || '')}", text: .constant("${escapeString(panel.textfieldValue || '')}")${ax})`)
      // `.textFieldStyle(.automatic)` is implicit on visionOS — only emit
      // when overridden so the device's recessed-glass field shows through.
      if (panel.styles?.textFieldStyle && panel.styles.textFieldStyle !== 'automatic') {
        lines.push(`    .textFieldStyle(.${panel.styles.textFieldStyle})`)
      }
      if (panel.keyboardType && panel.keyboardType !== 'default') {
        lines.push(`    .keyboardType(.${panel.keyboardType})`)
      }
      if (panel.textContentType) {
        lines.push(`    .textContentType(.${panel.textContentType})`)
      }
      if (panel.submitLabel && panel.submitLabel !== 'return') {
        lines.push(`    .submitLabel(.${panel.submitLabel})`)
      }
      if (panel.autocorrectionDisabled) {
        lines.push(`    .autocorrectionDisabled(true)`)
      }
      if (panel.textInputAutocapitalization && panel.textInputAutocapitalization !== 'sentences') {
        lines.push(`    .textInputAutocapitalization(.${panel.textInputAutocapitalization})`)
      }
      if (panel.axis === 'vertical' && panel.lineLimit && panel.lineLimit !== 1) {
        lines.push(`    .lineLimit(${panel.lineLimit})`)
      }
      lines.push(`    ${fieldShapeModifier(panel)}`)
      push(lines.join('\n' + ctx.ind))
    }
  },

  securefield: {
    defaults: {
      // Matches Apple's visionOS Figma kit: 305×44, radius 16. SecureField
      // deliberately uses a larger corner radius than TextField (16 vs 12)
      // in Apple's kit — kept here so the two read as distinct.
      size: [ptToUnits(305), ptToUnits(44)],
      // Recessed glass material by default (visionOS field look); the
      // Material picker swaps among the view tiers.
      color: '#2c2c2e',
      colorToken: 'viewRecessed',
      cornerRadius: ptToUnits(16),
      // Pill (capsule) edge by default; the Edge toggle can switch to Rounded.
      fieldShape: 'pill',
      text: 'Password',
      // Live value the wearer typed in preview mode. Rendered as a row
      // of dot glyphs the same way SwiftUI's SecureField masks input.
      // Emit ignores it so the generated code keeps using `.constant("")`.
      securefieldValue: '',
      // Legacy fallback when there's no live value yet — the editor
      // shows this many bullet glyphs as a visual placeholder so the
      // field reads as a password field even before the wearer types.
      dotCount: 8,
      textStyle: 'body',
      // Apple's visionOS kit shows the dots in #545454, not pure black.
      textColor: '#545454',
      textColorToken: null,
      // SecureField forces `.textContentType(.password)` and disables
      // selection per spec §1.3 — these are runtime-enforced; we still
      // expose `submitLabel` since visionOS surfaces it on the keyboard.
      submitLabel: 'done'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      const sl = panel.submitLabel && panel.submitLabel !== 'return'
        ? `.submitLabel(.${panel.submitLabel})` : ''
      push(`SecureField("${escapeString(panel.text || '')}", text: .constant(""))${sl}${fieldShapeModifier(panel)}`)
    }
  },

  texteditor: {
    defaults: {
      size: [ptToUnits(300), ptToUnits(160)],
      color: '#ffffff',
      colorToken: 'systemBackground',
      cornerRadius: ptToUnits(10),
      text: 'Type here...',
      lineCount: 5,
      textStyle: 'body',
      textColor: '#8e8e93',
      textColorToken: 'secondary'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      // `lineCount` is the height the designer drew the editor at, in lines.
      // The canvas rules that many lines and the export said nothing. AUDIT #20.
      const ll = panel.lineCount > 0 ? `.lineLimit(${panel.lineCount})` : ''
      push(`TextEditor(text: .constant("${escapeString(panel.text || '')}"))${ll}`)
    }
  },

  picker: {
    defaults: {
      size: [ptToUnits(260), ptToUnits(36)],
      color: '#e3e3e8',
      colorToken: 'systemFill',
      cornerRadius: ptToUnits(8),
      text: 'Selection',
      pickerValue: 'Option 1',
      pickerOptions: ['Option 1', 'Option 2', 'Option 3'],
      pickerStyle: 'automatic',  // → .menu on visionOS (spec §1.7)
      textStyle: 'body'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      const opts = panel.pickerOptions || []
      push(`Picker("${escapeString(panel.text || '')}", selection: .constant("${escapeString(panel.pickerValue || opts[0] || '')}")) {`)
      opts.forEach((o) => push(`    Text("${escapeString(o)}").tag("${escapeString(o)}")`))
      // `.automatic` resolves to `.menu` on visionOS — let the system
      // decide so we don't lock the picker into a specific style.
      const ps = panel.pickerStyle && panel.pickerStyle !== 'automatic'
        ? `.pickerStyle(.${panel.pickerStyle})` : ''
      push(`}${ps}`)
    }
  },

  datepicker: {
    defaults: {
      size: [ptToUnits(180), ptToUnits(36)],
      color: '#e3e3e8',
      colorToken: 'systemFill',
      cornerRadius: ptToUnits(8),
      text: 'Date',
      dateValue: '2026-04-16',
      // Spec §1.8 — `.automatic` resolves to `.compact` on visionOS.
      dateStyle: 'automatic',
      // `displayedComponents:` defaults to `[.date, .hourAndMinute]` —
      // we model the four documented combinations (date, time, both, or
      // visionOS-2-only seconds form).
      displayedComponents: 'dateAndTime',
      textStyle: 'body'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      const compMap = {
        date: '.date',
        hourAndMinute: '.hourAndMinute',
        dateAndTime: '[.date, .hourAndMinute]',
        hourMinuteAndSecond: '.hourMinuteAndSecond'
      }
      const comp = compMap[panel.displayedComponents] || compMap.dateAndTime
      const compArg = panel.displayedComponents && panel.displayedComponents !== 'dateAndTime'
        ? `, displayedComponents: ${comp}` : ''
      const ds = panel.dateStyle && panel.dateStyle !== 'automatic'
        ? `.datePickerStyle(.${panel.dateStyle})` : ''
      push(`DatePicker("${escapeString(panel.text || 'Date')}", selection: .constant(Date())${compArg})${ds}`)
    }
  },

  colorpicker: {
    defaults: {
      size: [ptToUnits(200), ptToUnits(36)],
      color: '#ffffff',
      colorToken: null,
      cornerRadius: 0,
      text: 'Color',
      pickedColor: '#ff3b30',
      // SwiftUI default is true (spec §1.9). Stored explicitly so the
      // exporter can omit `supportsOpacity:` when the default holds.
      supportsOpacity: true,
      textStyle: 'body'
    },
    emit(panel, ctx) {
      const { push, escapeString, swiftColor } = ctx
      const op = panel.supportsOpacity === false ? `, supportsOpacity: false` : ''
      push(`ColorPicker("${escapeString(panel.text || 'Color')}", selection: .constant(${swiftColor(null, panel.pickedColor || '#ff3b30')})${op})`)
    }
  },

  link: {
    defaults: {
      size: [ptToUnits(200), ptToUnits(24)],
      widthMode:     'fit',
      color: '#007aff',
      colorToken: 'systemBlue',
      cornerRadius: 0,
      text: 'Open Link',
      // Persisted destination for the SwiftUI `Link(destination: URL(...))`
      // initializer. visionOS opens the URL in Safari in a new window.
      url: 'https://www.apple.com/vision-pro/',
      textStyle: 'body',
      fontWeight: 'medium',   // visionOS body weight
      textAlign: 'left',
      italic:        false,
      underline:     true,    // links conventionally underlined by default
      strikethrough: false,
      lineLimit:     1,
      lineSpacing:   0,
      tracking:      0,
      kerning:       0,
      baselineOffset:0,
      textCase:      'none',
      truncationMode:'tail',
      minimumScaleFactor: 1,
      allowsTightening: false,
      fontDesign:    'default',
      monospacedDigit: false
    },
    emit(panel, ctx) {
      const { push, escapeString, style, weight } = ctx
      const url = (panel.url || 'https://example.com').trim()
      push(`Link("${escapeString(panel.text || 'Open')}", destination: URL(string: "${escapeString(url)}")!).font(.${style}${weight})`)
    }
  },

  // Spec §1.17 — `NavigationLink`. Two emit forms: value-based (requires
  // an enclosing NavigationStack with `.navigationDestination(for:)`) and
  // destination-based (builds the destination view inline). The exporter
  // chooses based on `linkMode`.
  navigationlink: {
    defaults: {
      size: [ptToUnits(220), ptToUnits(28)],
      widthMode: 'fit',
      color: '#0a84ff',
      colorToken: 'systemBlue',
      cornerRadius: 0,
      text: 'See Details',
      // 'value' = `NavigationLink("Title", value: someHashable)`
      // 'destination' = `NavigationLink { Destination() } label: { Text(...) }`
      linkMode: 'value',
      navValue: 'detail',          // Hashable identifier for value-based links
      destinationName: 'DetailView',
      textStyle: 'body',
      fontWeight: 'medium',
      textAlign: 'left'
    },
    emit(panel, ctx) {
      const { push, escapeString, style, weight } = ctx
      if (panel.linkMode === 'destination') {
        push(`NavigationLink {`)
        push(`    ${panel.destinationName || 'DetailView'}()`)
        push(`} label: {`)
        push(`    Text("${escapeString(panel.text || 'Open')}").font(.${style}${weight})`)
        push(`}`)
      } else {
        push(`NavigationLink("${escapeString(panel.text || 'Open')}", value: "${escapeString(panel.navValue || 'detail')}").font(.${style}${weight})`)
      }
    }
  },

  // Spec §1.25 — `.confirmationDialog(_:isPresented:titleVisibility:actions:)`.
  // Distinct from `.alert(...)` because visionOS renders it differently
  // (a glass-styled action sheet that can include destructive role buttons).
  confirmationdialog: {
    defaults: {
      size: [ptToUnits(300), ptToUnits(180)],
      color: '#ffffff',
      colorToken: 'secondarySystemBackground',
      cornerRadius: ptToUnits(16),
      text: 'Are you sure?',
      alertMessage: 'This action cannot be undone.',
      alertButtons: ['Delete', 'Cancel'],
      titleVisibility: 'automatic',  // 'automatic' | 'visible' | 'hidden'
      material: 'thick'
    },
    emit(_panel, ctx) {
      ctx.push('// confirmationDialog — emitted as a .confirmationDialog(...) modifier on the parent view')
    }
  },

  // Spec §1.25 — `.inspector(isPresented:content:)` (visionOS 1+). On
  // wide windows the inspector renders as a trailing sidebar; in compact
  // contexts SwiftUI adapts to a sheet. Stored as a presentation panel
  // so the exporter wires it as a modifier on the parent view.
  inspector: {
    defaults: {
      size: [ptToUnits(320), ptToUnits(480)],
      color: '#ffffff',
      colorToken: 'systemBackground',
      cornerRadius: ptToUnits(16),
      text: 'Inspector content',
      material: 'regular',
      // `.inspectorColumnWidth(_:)` / `(min:ideal:max:)` overrides; `null`
      // = use the system default. Stored in pt; exporter elides when null.
      inspectorColumnWidth: null,
      inspectorMinWidth: null,
      inspectorIdealWidth: null,
      inspectorMaxWidth: null
    },
    emit(_panel, ctx) {
      ctx.push('// inspector — emitted as an .inspector(...) modifier on the parent view')
    }
  },

  asyncimage: {
    defaults: {
      size: [ptToUnits(320), ptToUnits(200)],
      color: '#e3e3e8',
      colorToken: 'systemFill',
      cornerRadius: ptToUnits(14)
    },
    emit(_panel, ctx) {
      ctx.push(`AsyncImage(url: URL(string: "https://example.com/image.jpg"))`)
    }
  },

  contentUnavailable: {
    defaults: {
      size: [ptToUnits(320), ptToUnits(200)],
      color: '#ffffff',
      colorToken: 'systemBackground',
      cornerRadius: ptToUnits(16),
      text: 'No Results',
      alertMessage: 'Try a different search term.',
      textStyle: 'title3'
    },
    emit(panel, ctx) {
      const { push, escapeString, sym } = ctx
      push(`ContentUnavailableView("${escapeString(panel.text || 'No Content')}", systemImage: "${sym || 'questionmark'}", description: Text("${escapeString(panel.alertMessage || '')}"))`)
    }
  },

  // ---- Phase 4 — Collections ----
  form: {
    defaults: {
      size: [ptToUnits(360), ptToUnits(300)],
      color: '#f2f2f7',
      colorToken: 'secondarySystemBackground',
      cornerRadius: ptToUnits(14),
      rows: [
        { title: 'Username', subtitle: '' },
        { title: 'Email', subtitle: '' },
        { title: 'Notifications', subtitle: 'On' }
      ],
      rowHeight: 48,
      listStyle: 'insetGrouped',
      // Spec §1.21 — `.formStyle(.automatic)` resolves to grouped on
      // visionOS. Stored explicitly so the exporter can elide it.
      formStyle: 'automatic'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      // `rowHeight` is the height the canvas lays each row out at, so the
      // generated rows carry it too — as `minHeight`, because a Form row
      // grows for its content and the authored number is a floor rather
      // than a cap. It reached NEITHER side before phase 1.2. AUDIT #6.
      const rh = typeof panel.rowHeight === 'number' && panel.rowHeight > 0
        ? `.frame(minHeight: ${panel.rowHeight})` : ''
      push(`Form {`)
      ;(panel.rows || []).forEach((r) => push(`    Text("${escapeString(r.title || '')}")${rh}`))
      const fs = panel.formStyle && panel.formStyle !== 'automatic'
        ? `.formStyle(.${panel.formStyle})` : ''
      push(`}${fs}`)
    }
  },

  groupbox: {
    defaults: {
      size: [ptToUnits(300), ptToUnits(160)],
      color: '#f2f2f7',
      colorToken: 'secondarySystemBackground',
      cornerRadius: ptToUnits(12),
      text: 'Settings',
      textStyle: 'headline',
      groupBoxStyle: 'automatic'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      const gs = panel.groupBoxStyle && panel.groupBoxStyle !== 'automatic'
        ? `.groupBoxStyle(.${panel.groupBoxStyle})` : ''
      push(`GroupBox("${escapeString(panel.text || '')}") { }${gs}`)
    }
  },

  outlinegroup: {
    defaults: {
      size: [ptToUnits(320), ptToUnits(240)],
      color: '#ffffff',
      colorToken: 'systemBackground',
      cornerRadius: ptToUnits(12),
      rows: [
        { title: 'Documents', indent: 0, expanded: true },
        { title: 'Images', indent: 1, expanded: false },
        { title: 'Videos', indent: 1, expanded: false },
        { title: 'Downloads', indent: 0, expanded: true },
        { title: 'Recent', indent: 1, expanded: false }
      ],
      rowHeight: 44
    },
    emit(panel, ctx) {
      // Spec §1.23 — OutlineGroup needs a recursive data type. We emit a
      // self-contained `OutlineNode` struct (id, title, optional children)
      // and a hand-rolled tree built from the inspector's flat
      // (title, indent) rows so the generated SwiftUI compiles directly
      // without forcing the designer to wire up their own model.
      const { push, escapeString } = ctx
      const rows = panel.rows || []

      // Reconstruct the indent-driven tree as a literal Swift array.
      // Walk the flat list left-to-right, treating each row's `indent` as
      // its tree depth. A small stack tracks the open ancestors.
      const renderNodes = (startIdx, depth) => {
        const out = []
        let i = startIdx
        while (i < rows.length && (rows[i].indent ?? 0) >= depth) {
          if ((rows[i].indent ?? 0) > depth) { i++; continue }
          const title = escapeString(rows[i].title || '')
          // Look ahead for children (rows immediately after with indent+1).
          const childStart = i + 1
          let childEnd = childStart
          while (childEnd < rows.length && (rows[childEnd].indent ?? 0) > depth) childEnd++
          if (childEnd > childStart) {
            const kids = renderNodes(childStart, depth + 1)
            out.push({ title, children: kids })
            i = childEnd
          } else {
            out.push({ title, children: null })
            i++
          }
        }
        return out
      }
      const tree = renderNodes(0, 0)
      const dump = (nodes, indent) => {
        const ind = '    '.repeat(indent)
        const parts = nodes.map((n) => {
          const prefix = `${ind}OutlineNode(title: "${n.title}"`
          if (!n.children || !n.children.length) return `${prefix})`
          const inner = dump(n.children, indent + 1)
          return `${prefix}, children: [\n${inner}\n${ind}])`
        })
        return parts.join(',\n')
      }
      const seedLiteral = `[\n${dump(tree, 1)}\n]`

      push(`// OutlineGroup — generated recursive model`)
      push(`struct OutlineNode: Identifiable {`)
      push(`    let id = UUID()`)
      push(`    let title: String`)
      push(`    var children: [OutlineNode]? = nil`)
      push(`}`)
      push(`let outlineSeed: [OutlineNode] = ${seedLiteral}`)
      // Same row-height contract as `form`: the canvas lays each row out at
      // `rowHeight`, so the generated row carries it as a floor.
      const rh = typeof panel.rowHeight === 'number' && panel.rowHeight > 0
        ? `.frame(minHeight: ${panel.rowHeight})` : ''
      push(`List {`)
      push(`    OutlineGroup(outlineSeed, children: \\.children) { node in`)
      push(`        Text(node.title)${rh}`)
      push(`    }`)
      push(`}`)
    }
  },

  // ---- Phase 5 — Shapes & Drawing ----
  ellipse: {
    defaults: {
      size: [ptToUnits(200), ptToUnits(140)],
      color: '#ff9500',
      colorToken: 'systemOrange',
      cornerRadius: 0,
      strokeColor: null,
      strokeWidth: 0
    },
    emit(panel, ctx) {
      const { push, swiftColor, unitsToPt } = ctx
      const fill = swiftColor(panel.colorToken, panel.color)
      const stroke = shapeStrokeOverlay(panel, 'Ellipse()', ctx)
      push(`Ellipse().fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})${stroke}`)
    }
  },

  unevenRoundedRect: {
    defaults: {
      size: [ptToUnits(200), ptToUnits(140)],
      color: '#30b0c7',
      colorToken: 'systemTeal',
      topLeadingRadius: ptToUnits(24),
      topTrailingRadius: ptToUnits(8),
      bottomLeadingRadius: ptToUnits(8),
      bottomTrailingRadius: ptToUnits(24),
      strokeColor: null,
      strokeWidth: 0
    },
    emit(panel, ctx) {
      const { push, swiftColor, unitsToPt } = ctx
      const fill = swiftColor(panel.colorToken, panel.color)
      const tl = unitsToPt(panel.topLeadingRadius || 0)
      const tr = unitsToPt(panel.topTrailingRadius || 0)
      const bl = unitsToPt(panel.bottomLeadingRadius || 0)
      const br = unitsToPt(panel.bottomTrailingRadius || 0)
      const shape = `UnevenRoundedRectangle(topLeadingRadius: ${tl}, bottomLeadingRadius: ${bl}, bottomTrailingRadius: ${br}, topTrailingRadius: ${tr})`
      const stroke = shapeStrokeOverlay(panel, shape, ctx)
      push(`${shape}.fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})${stroke}`)
    }
  },

  path: {
    defaults: {
      size: [ptToUnits(200), ptToUnits(200)],
      color: '#5856d6',
      colorToken: 'systemIndigo',
      cornerRadius: 0,
      strokeColor: null,
      strokeWidth: 0
    },
    emit(panel, ctx) {
      const { push, swiftColor, unitsToPt } = ctx
      const fill = swiftColor(panel.colorToken, panel.color)
      push(`Path { p in /* describe path */ }.fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})`)
    }
  },

  linearGradient: {
    defaults: {
      size: [ptToUnits(240), ptToUnits(160)],
      color: '#007aff',
      cornerRadius: ptToUnits(12),
      gradientFrom: '#007aff',
      gradientTo: '#af52de',
      gradientAngle: 180
    },
    emit(panel, ctx) {
      const { push, swiftColor, unitsToPt } = ctx
      const a = swiftColor(null, panel.gradientFrom || '#007aff')
      const b = swiftColor(null, panel.gradientTo   || '#af52de')
      const cr = unitsToPt(panel.cornerRadius || 0)
      const clip = clipShapeSuffix(cr)
      // SwiftUI's `LinearGradient(stops:, startPoint:, endPoint:)` doesn't
      // accept an angle directly. Convert the inspector's angle (0° = top
      // → bottom) into matching `UnitPoint`s on opposite sides of the
      // panel — the editor preview and the export then read the same.
      const angle = panel.gradientAngle ?? 180
      const rad = (angle * Math.PI) / 180
      const dx = Math.sin(rad) / 2, dy = -Math.cos(rad) / 2
      const start = `UnitPoint(x: ${(0.5 - dx).toFixed(3)}, y: ${(0.5 - dy).toFixed(3)})`
      const end   = `UnitPoint(x: ${(0.5 + dx).toFixed(3)}, y: ${(0.5 + dy).toFixed(3)})`
      push(`LinearGradient(colors: [${a}, ${b}], startPoint: ${start}, endPoint: ${end}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})${clip}`)
    }
  },

  radialGradient: {
    defaults: {
      size: [ptToUnits(200), ptToUnits(200)],
      color: '#ff9500',
      cornerRadius: 0,
      gradientFrom: '#ffcc00',
      gradientTo: '#ff3b30'
    },
    emit(panel, ctx) {
      const { push, swiftColor, unitsToPt } = ctx
      const a = swiftColor(null, panel.gradientFrom || '#ffcc00')
      const b = swiftColor(null, panel.gradientTo   || '#ff3b30')
      const w = unitsToPt(panel.size?.[0] || 0)
      const h = unitsToPt(panel.size?.[1] || 0)
      push(`RadialGradient(colors: [${a}, ${b}], center: .center, startRadius: 0, endRadius: ${Math.round(Math.max(w, h) / 2)}).frame(width: ${w}, height: ${h})`)
    }
  },

  angularGradient: {
    defaults: {
      size: [ptToUnits(200), ptToUnits(200)],
      color: '#34c759',
      cornerRadius: 0,
      gradientFrom: '#34c759',
      gradientTo: '#007aff'
    },
    emit(panel, ctx) {
      const { push, swiftColor, unitsToPt } = ctx
      const a = swiftColor(null, panel.gradientFrom || '#34c759')
      const b = swiftColor(null, panel.gradientTo   || '#007aff')
      push(`AngularGradient(colors: [${a}, ${b}], center: .center).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})`)
    }
  },

  // ---- Phase 6 — 3D primitives (RealityKit / Model3D) ----
  //
  // All 3D primitives carry a shared transform block — Z offset (visionOS
  // `.offset(z:)`) plus per-axis rotation in degrees (SwiftUI's
  // `.rotation3DEffect(.degrees(n), axis:(x,y,z))`). Stored on the panel
  // root rather than under `modifiers` because 2D modifiers already cover
  // the X/Y plane and conflating the two would muddy the UI.
  //
  // visionOS lets you embed 3D content inside a Window via RealityView
  // (programmatic primitives) or Model3D (asset-loaded USDZ). These map
  // 1:1 to RealityKit's MeshResource generators. SimpleMaterial with a
  // SwiftUI Color keeps the export readable; users can swap to
  // PhysicallyBasedMaterial in their own code if they want PBR.
  //
  // The designer renders these as actual 3D primitives in the canvas (see
  // Panel3D.jsx) so users get a real preview rather than a flat icon.
  // Units convention: dimensions are stored in pt and converted to meters
  // on emit (1 m ≈ 1000 pt at the scale visionOS uses for embedded RealityViews).

  sphere: {
    defaults: {
      size: [ptToUnits(160), ptToUnits(160)],
      color: '#007aff',
      colorToken: 'systemBlue',
      cornerRadius: 0,
      radius: 80,        // pt
      depth:  160        // pt — `.frame(depth:)` on the wrapping view
    },
    emit(panel, ctx) {
      const { push } = ctx
      const r = ((panel.radius || 80) / 1000).toFixed(3)   // pt → m
      const color = materialColor(panel.colorToken, panel.color)
      push(`RealityView { content in`)
      push(`    let mesh = MeshResource.generateSphere(radius: ${r})`)
      push(`    let material = SimpleMaterial(color: ${color}, isMetallic: false)`)
      push(`    content.add(ModelEntity(mesh: mesh, materials: [material]))`)
      push(`}`)
      push(`.frame(depth: ${panel.depth || 160})`)
    }
  },

  box: {
    defaults: {
      size: [ptToUnits(160), ptToUnits(160)],
      color: '#34c759',
      colorToken: 'systemGreen',
      cornerRadius: 0,
      boxWidth:  120, boxHeight: 120, boxDepth: 120,    // pt
      boxCornerRadius: 0,                                // pt
      depth: 160
    },
    emit(panel, ctx) {
      const { push } = ctx
      const w  = ((panel.boxWidth  || 120) / 1000).toFixed(3)
      const h  = ((panel.boxHeight || 120) / 1000).toFixed(3)
      const d  = ((panel.boxDepth  || 120) / 1000).toFixed(3)
      const cr = ((panel.boxCornerRadius || 0) / 1000).toFixed(3)
      const color = materialColor(panel.colorToken, panel.color)
      push(`RealityView { content in`)
      push(`    let mesh = MeshResource.generateBox(width: ${w}, height: ${h}, depth: ${d}, cornerRadius: ${cr})`)
      push(`    let material = SimpleMaterial(color: ${color}, isMetallic: false)`)
      push(`    content.add(ModelEntity(mesh: mesh, materials: [material]))`)
      push(`}`)
      push(`.frame(depth: ${panel.depth || 160})`)
    }
  },

  plane: {
    defaults: {
      size: [ptToUnits(200), ptToUnits(140)],
      color: '#8e8e93',
      colorToken: 'systemGray',
      cornerRadius: 0,
      planeWidth: 200, planeDepth: 140,   // pt
      depth: 40
    },
    emit(panel, ctx) {
      const { push } = ctx
      const w = ((panel.planeWidth || 200) / 1000).toFixed(3)
      const d = ((panel.planeDepth || 140) / 1000).toFixed(3)
      const color = materialColor(panel.colorToken, panel.color)
      push(`RealityView { content in`)
      push(`    let mesh = MeshResource.generatePlane(width: ${w}, depth: ${d})`)
      push(`    let material = SimpleMaterial(color: ${color}, isMetallic: false)`)
      push(`    content.add(ModelEntity(mesh: mesh, materials: [material]))`)
      push(`}`)
      push(`.frame(depth: ${panel.depth || 40})`)
    }
  },

  cone: {
    defaults: {
      size: [ptToUnits(140), ptToUnits(180)],
      color: '#ff9500',
      colorToken: 'systemOrange',
      cornerRadius: 0,
      coneHeight: 180, coneRadius: 70,    // pt
      depth: 180
    },
    emit(panel, ctx) {
      const { push } = ctx
      const h = ((panel.coneHeight || 180) / 1000).toFixed(3)
      const r = ((panel.coneRadius || 70)  / 1000).toFixed(3)
      const color = materialColor(panel.colorToken, panel.color)
      push(`RealityView { content in`)
      push(`    let mesh = MeshResource.generateCone(height: ${h}, radius: ${r})`)
      push(`    let material = SimpleMaterial(color: ${color}, isMetallic: false)`)
      push(`    content.add(ModelEntity(mesh: mesh, materials: [material]))`)
      push(`}`)
      push(`.frame(depth: ${panel.depth || 180})`)
    }
  },

  cylinder: {
    defaults: {
      size: [ptToUnits(140), ptToUnits(180)],
      color: '#af52de',
      colorToken: 'systemPurple',
      cornerRadius: 0,
      cylHeight: 180, cylRadius: 70,    // pt
      depth: 180
    },
    emit(panel, ctx) {
      const { push } = ctx
      const h = ((panel.cylHeight || 180) / 1000).toFixed(3)
      const r = ((panel.cylRadius || 70)  / 1000).toFixed(3)
      const color = materialColor(panel.colorToken, panel.color)
      push(`RealityView { content in`)
      push(`    let mesh = MeshResource.generateCylinder(height: ${h}, radius: ${r})`)
      push(`    let material = SimpleMaterial(color: ${color}, isMetallic: false)`)
      push(`    content.add(ModelEntity(mesh: mesh, materials: [material]))`)
      push(`}`)
      push(`.frame(depth: ${panel.depth || 180})`)
    }
  },

  text3d: {
    defaults: {
      size: [ptToUnits(220), ptToUnits(80)],
      color: '#ffffff',
      colorToken: 'primary',
      cornerRadius: 0,
      text: 'Hello',
      textStyle: 'largeTitle',
      fontWeight: 'bold',
      extrusionDepth: 20,    // pt
      depth: 60
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      const style = panel.textStyle || 'largeTitle'
      const weight = (panel.fontWeight && panel.fontWeight !== 'regular')
        ? `.fontWeight(.${panel.fontWeight})` : ''
      // Text3D — visionOS 2.0+. extrusionDepth pt → m.
      const ed = ((panel.extrusionDepth || 20) / 1000).toFixed(3)
      push(`Text3D("${escapeString(panel.text || 'Hello')}")`)
      push(`    .font(.${style})${weight}`)
      push(`    .extrusionDepth(${ed})`)
      push(`    .frame(depth: ${panel.depth || 60})`)
    }
  },

  mesh: {
    defaults: {
      size: [ptToUnits(220), ptToUnits(220)],
      color: '#1c1c1e',
      colorToken: null,
      cornerRadius: 0,
      meshAsset: 'Earth',     // USDZ asset name in the bundle
      depth: 200
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      const asset = escapeString(panel.meshAsset || 'Earth')
      push(`Model3D(named: "${asset}")`)
      push(`    .frame(depth: ${panel.depth || 200})`)
    }
  },

  // ---- RealityView ----------------------------------------------------
  //
  // The bridge between SwiftUI and RealityKit. A RealityView is itself a
  // SwiftUI view, so it slots into the same stack/panel hierarchy as any
  // other panel. Its children in the layers tree are RealityKit entities
  // (type: 'entity') rather than SwiftUI panels — the inspector and the
  // RealityKit exporter walk those directly.
  //
  // SwiftUI emit is intentionally a stub for now: the body lists the
  // entity descendants by name as comments, and a TODO line marks where
  // the future RealityKit exporter will splice in real `content.add(...)`
  // calls.
  realityview: {
    defaults: {
      // The view itself sits in the SwiftUI tree, so it gets a frame just
      // like any other panel. visionOS RealityViews default to filling
      // their parent — we mirror that with a generous default frame.
      size: [ptToUnits(360), ptToUnits(360)],
      color: '#000000',          // backing fill (transparent in volumetric)
      colorToken: null,
      cornerRadius: 0,
      // RealityView config (visionOS spec §Reality).
      cameraMode: 'spatialTracking',  // 'nonAR' | 'spatialTracking' | 'virtualReality'
      // Visual aid drawn in the designer canvas only (axes gizmo at the
      // RealityView origin). Doesn't affect emitted Swift.
      showAnchorAxes: false
    },
    emit(panel, ctx) {
      const { push } = ctx
      // RealityKit exporter is out of scope for the visual pass — emit a
      // stub `RealityView { ... }` so designs round-trip into Xcode and
      // compile, with a clear TODO marker for the entity body.
      push(`RealityView { content in`)
      push(`    // TODO: build entities from this RealityView's child tree (see designer)`)
      push(`}`)
    }
  },

  // ---- escape hatch ----------------------------------------------------
  //
  // Raw Swift, authored by the designer and emitted verbatim.
  //
  // Every other entry in this registry models one SwiftUI view, which means
  // the reachable surface is exactly the set of entries in this file: a view
  // Apple ships but we have not modelled is simply unbuildable, and closing
  // that by hand is unbounded work. This entry removes the ceiling instead —
  // anything expressible in Swift can be placed in the tree today, at the
  // cost of no canvas preview.
  //
  // The canvas draws a labelled placeholder rather than attempting to
  // interpret the source. Rendering arbitrary Swift is not something this
  // app can do, and a placeholder that says so is more honest than a box
  // that pretends to be the view.
  //
  // The source is validated for structural sanity before export (see
  // src/export/swiftValidate.js) because it lands mid-file: an unbalanced
  // brace here breaks the whole generated view, not just this node.
  custom: {
    defaults: {
      size: [ptToUnits(240), ptToUnits(80)],
      // Swift source emitted verbatim in this node's position. The default
      // is a working one-liner so a freshly-added node exports something
      // that compiles rather than a hole in the file.
      code: 'Text("Hello from raw Swift")',
      // Short display name drawn on the placeholder. Kept separate from
      // `code` so a long multi-line fragment still reads as one tidy box
      // on the canvas.
      label: 'Custom Swift',
      color: '#2a2f3a',
      colorToken: null,
      cornerRadius: ptToUnits(12)
    },
    emit(panel, ctx) {
      const { push } = ctx
      // Normalise line endings so a fragment pasted from a Windows editor
      // does not emit stray \r into the Swift file.
      const src = String(panel.code ?? '').replace(/\r\n?/g, '\n')
      if (!src.trim()) {
        // An empty fragment still has to produce a view: the node occupies a
        // position in a result builder, and emitting nothing there would
        // silently change the parent's layout.
        push('EmptyView()')
        return
      }
      // One push per line so each gets the current indentation prefix; the
      // fragment's own internal indentation rides on top of it.
      for (const line of src.split('\n')) push(line)
    }
  }
}

// ---- interactivity ----------------------------------------------------
//
// Only panels that map to a SwiftUI control with built-in interaction get
// `.hoverEffect()` rendering and inspector exposure. visionOS auto-applies
// hover affordances to these views; for non-interactive views (Text, Image,
// Divider, shapes, gradients, presentations, indicators) the modifier is a
// no-op in SwiftUI, so we don't surface it here either.
//
// This list is the single source of truth — used by the helpers resolver,
// the inspector (to hide the Interaction section), and the exporter.
const INTERACTIVE_PANEL_TYPES = new Set([
  'button',
  'link',
  'navigationlink',
  'toggle',
  'slider',
  'stepper',
  'picker',
  'datepicker',
  'colorpicker',
  'segmented',
  'menu',
  'textfield',
  'securefield',
  'texteditor',
  'search'
])

export const isInteractivePanel = (panelType) => INTERACTIVE_PANEL_TYPES.has(panelType)


// ---- public helpers ----

// How a panel type's frame is decided. The inspector carries the same
// vocabulary in `PANEL_META.frameMode` (inspectors.jsx) because it drives
// which fields that inspector renders; this copy lives here so the exporter
// can read it without importing JSX, and `parity.test.js` pins the two to
// agree.
//
//   'explicit' - `size` IS the authored box. The exporter emits
//                `.frame(width:height:)` from it.
//   'figma'    - Fit / Fixed / Fill. `widthMode` / `heightMode` decide, and
//                'fit' means hug, so nothing is emitted.
//   'none'     - the type sizes itself: shapes and gradients write their own
//                `.frame(...)`, a Button sizes from its label and
//                `controlSize`, a Spacer has no frame at all.
const FRAME_MODES = {
  text: 'figma',
  link: 'figma',
  button: 'none',
  spacer: 'none',
  divider: 'none',
  segmented: 'none',
  navbar: 'none',
  realityview: 'none',
  rectangle: 'none',
  circle: 'none',
  capsule: 'none',
  ellipse: 'none',
  path: 'none',
  unevenRoundedRect: 'none',
  linearGradient: 'none',
  radialGradient: 'none',
  angularGradient: 'none',
  canvas: 'none',
  sphere: 'none',
  box: 'none',
  plane: 'none',
  cone: 'none',
  cylinder: 'none',
  text3d: 'none',
  mesh: 'none'
  // everything else: 'explicit'
}

// Panel types whose height is derived from their content rather than stored,
// so only the width of their `size` is meaningful. Mirrors `lockHeight` in
// PANEL_META.
const DERIVED_HEIGHT = new Set(['list'])

export const panelFrameMode = (panelType) => FRAME_MODES[panelType] || 'explicit'
export const panelHeightIsDerived = (panelType) => DERIVED_HEIGHT.has(panelType)

export const panelTypes = () => Object.keys(PANELS)

// Returns a fresh (shallow-cloned) defaults object for the given type so
// callers can mutate without poisoning the registry. Unknown types yield an
// empty object — callers should normally check `panelTypes()` first.
export const panelDefaults = (type) => {
  const entry = PANELS[type]
  return entry ? { ...entry.defaults } : {}
}

// Dispatcher used by the SwiftUI exporter. Looks up the panel type and
// delegates to its emit function. Unknown types fall through to a TODO
// marker so the generated file still compiles and obviously calls out the
// gap (mirroring the prior switch-default behavior).
export const emitPanel = (panel, ctx) => {
  const entry = PANELS[panel.panelType]
  if (!entry || typeof entry.emit !== 'function') {
    ctx.push(`// TODO: ${panel.panelType} — panel type not yet covered by the exporter`)
    return
  }
  entry.emit(panel, ctx)
}
