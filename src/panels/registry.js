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

import { TEXT_STYLES, ptToUnits } from '../appleSystem'

const textStyleToFontSize = (style) => ptToUnits(TEXT_STYLES[style]?.pt ?? 17)

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
      push(`Rectangle().fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)}).cornerRadius(${unitsToPt(panel.cornerRadius || 0)})`)
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
      fontSize: textStyleToFontSize('body'),
      // visionOS body defaults to Medium (one step heavier than iOS Regular)
      // for legibility on glass — see TEXT_STYLES in appleSystem.js.
      fontWeight: 'medium',
      textAlign: 'left',
      // SwiftUI Text-only modifiers (kept on the panel root so they appear
      // alongside the existing text fields rather than in the generic
      // `.modifiers` blob — they're part of what a Text *is*, not a modifier
      // layered on top of it).
      italic:        false,   // .italic()
      underline:     false,   // .underline()
      strikethrough: false,   // .strikethrough()
      lineLimit:     0,       // .lineLimit(n) — 0 = unlimited
      lineSpacing:   0,       // .lineSpacing(pt)
      tracking:      0,       // .tracking(pt)
      kerning:       0,       // .kerning(pt) — pair-aware spacing
      baselineOffset:0,       // .baselineOffset(pt)
      textCase:      'none',  // .textCase(.uppercase / .lowercase)
      truncationMode:'tail',  // .truncationMode(.tail / .middle / .head)
      minimumScaleFactor: 1,  // .minimumScaleFactor(0..1) — 1 = no scaling
      allowsTightening: false,// .allowsTightening(_:)
      fontDesign:    'default',// .fontDesign(.default / .serif / .rounded / .monospaced)
      monospacedDigit: false  // .monospacedDigit()
    },
    emit(panel, ctx) {
      const { push, escapeString, applyTextModifiers, style, weight, textColor } = ctx
      push(applyTextModifiers(`Text("${escapeString(panel.text || '')}").font(.${style}${weight}).foregroundStyle(${textColor})`))
    }
  },

  button: {
    defaults: {
      // 164×60 pill — the Vision Pro "Capsule" button shape Apple uses in
      // their reference UI. cornerRadius=30 makes both ends fully rounded.
      size: [ptToUnits(164), ptToUnits(60)],
      color: '#b7b6b1',
      colorToken: 'designButton',
      cornerRadius: ptToUnits(30),       // capsule
      text: 'Button',
      textStyle: 'body',
      fontSize: textStyleToFontSize('body'),
      fontWeight: 'semibold',
      textAlign: 'center',
      textColor: '#ffffff',
      textColorToken: 'designButtonText',
      // visionOS default: `.automatic` resolves to a glass-bordered capsule
      // for text/text+icon buttons. We elide `.buttonStyle(...)` from the
      // exporter when the value is `automatic` so the device renders the
      // system-tuned glass effect without an override.
      buttonStyle: 'automatic',
      buttonBorderShape: 'automatic'
    },
    emit(panel, ctx) {
      const { push, escapeString, swiftColor, sym } = ctx
      const label = sym
        ? `Label("${escapeString(panel.text || 'Button')}", systemImage: "${sym}")`
        : `Text("${escapeString(panel.text || 'Button')}")`
      // `role:` is part of the Button initializer (not a modifier) so it
      // sits inside the parentheses. visionOS still draws a glass capsule
      // but the system flags it as destructive/cancel for VoiceOver.
      const role = panel.buttonRole && panel.buttonRole !== 'none'
        ? `(role: .${panel.buttonRole}) ` : ''
      // `.automatic` and `.plain` are SwiftUI's built-in zero-config styles —
      // for `.automatic` we omit the modifier entirely so visionOS picks the
      // system glass treatment.
      const bs = panel.buttonStyle && panel.buttonStyle !== 'automatic' && panel.buttonStyle !== 'plain'
        ? `.buttonStyle(.${panel.buttonStyle})` : ''
      const shape = panel.buttonBorderShape && panel.buttonBorderShape !== 'automatic'
        ? `.buttonBorderShape(.${panel.buttonBorderShape})` : ''
      const size = panel.controlSize && panel.controlSize !== 'regular'
        ? `.controlSize(.${panel.controlSize})` : ''
      const tint = panel.tint
        ? `.tint(${swiftColor(null, panel.tint)})` : ''
      push(`Button${role}{ /* action */ } label: { ${label} }${bs}${shape}${size}${tint}`)
    }
  },

  image: {
    defaults: {
      size: [ptToUnits(320), ptToUnits(200)],
      color: '#c7c7cc',
      colorToken: 'tertiary',
      cornerRadius: ptToUnits(14),
      imageUrl: null          // blob URL or external URL
    },
    emit(panel, ctx) {
      const { push, sym } = ctx
      if (sym) push(`Image(systemName: "${sym}")`)
      else push(`Image(systemName: "photo")   // placeholder asset`)
    }
  },

  toggle: {
    defaults: {
      size: [ptToUnits(52), ptToUnits(32)],
      color: '#34c759',
      colorToken: 'systemGreen',
      cornerRadius: ptToUnits(16),
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
      size: [ptToUnits(260), ptToUnits(32)],
      color: '#e3e3e8',
      colorToken: 'systemFill',
      cornerRadius: ptToUnits(8),
      segments: ['Day', 'Week', 'Month'],
      selectedSegment: 1,
      textStyle: 'footnote',
      fontSize: textStyleToFontSize('footnote'),
      fontWeight: 'semibold',
      textColor: '#000000',
      textColorToken: 'primary'
    },
    emit(panel, ctx) {
      // Segmented control = Picker with .pickerStyle(.segmented).
      const { push, escapeString } = ctx
      const opts = panel.segments || []
      const sel = opts[panel.selectedSegment ?? 0] || ''
      push(`Picker("", selection: .constant("${escapeString(sel)}")) {`)
      opts.forEach((o) => push(`    Text("${escapeString(o)}").tag("${escapeString(o)}")`))
      push(`}.pickerStyle(.segmented)`)
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
      fontSize: textStyleToFontSize('footnote'),
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
      size: [ptToUnits(320), ptToUnits(36)],
      color: '#e3e3e8',
      colorToken: 'systemFill',
      cornerRadius: ptToUnits(18),
      text: 'Search',
      textStyle: 'body',
      fontSize: textStyleToFontSize('body'),
      fontWeight: 'medium',          // visionOS body weight
      textColor: '#8e8e93',
      textColorToken: 'secondary',
      textAlign: 'left'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      push(`// .searchable(text: $searchText, prompt: "${escapeString(panel.text || 'Search')}")   // attach on parent view`)
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
      // 'default' | 'plain' | 'inset' | 'insetGrouped' | 'grouped' |
      // 'sidebar' | 'bordered' | 'carousel' | 'elliptical'
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
      const ls = panel.listStyle ? `.listStyle(.${panel.listStyle})` : ''
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
      size: [ptToUnits(280), ptToUnits(28)],
      color: '#e3e3e8',
      colorToken: 'systemFill',
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
      size: [ptToUnits(130), ptToUnits(34)],
      color: '#e3e3e8',
      colorToken: 'systemFill',
      cornerRadius: ptToUnits(8),
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
      value: 0.7,
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
      push(`Rectangle().fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)}).cornerRadius(${unitsToPt(panel.cornerRadius || 0)})`)
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
      push(`Circle().fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})`)
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
      push(`Capsule().fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})`)
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
      fontSize: textStyleToFontSize('body'),
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
      const { push, escapeString, sym, style, weight } = ctx
      const icon = sym || panel.iconName || 'circle.fill'
      const ls = panel.styles?.labelStyle && panel.styles.labelStyle !== 'automatic'
        ? `.labelStyle(.${panel.styles.labelStyle})` : ''
      const is = panel.imageScale && panel.imageScale !== 'medium'
        ? `.imageScale(.${panel.imageScale})` : ''
      const sm = panel.symbolRenderingMode && panel.symbolRenderingMode !== 'monochrome'
        ? `.symbolRenderingMode(.${panel.symbolRenderingMode})` : ''
      push(`Label("${escapeString(panel.text || 'Label')}", systemImage: "${icon}").font(.${style}${weight})${ls}${is}${sm}`)
    }
  },

  textfield: {
    defaults: {
      size: [ptToUnits(280), ptToUnits(40)],
      color: '#e3e3e8',
      colorToken: 'systemFill',
      cornerRadius: ptToUnits(10),
      text: 'Placeholder',
      textfieldValue: '',
      textStyle: 'body',
      fontSize: textStyleToFontSize('body'),
      textColor: '#8e8e93',
      textColorToken: 'secondary',
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
      push(lines.join('\n' + ctx.ind))
    }
  },

  securefield: {
    defaults: {
      size: [ptToUnits(280), ptToUnits(40)],
      color: '#e3e3e8',
      colorToken: 'systemFill',
      cornerRadius: ptToUnits(10),
      text: 'Password',
      dotCount: 8,
      textStyle: 'body',
      fontSize: textStyleToFontSize('body'),
      textColor: '#000000',
      textColorToken: 'primary',
      // SecureField forces `.textContentType(.password)` and disables
      // selection per spec §1.3 — these are runtime-enforced; we still
      // expose `submitLabel` since visionOS surfaces it on the keyboard.
      submitLabel: 'done'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      const sl = panel.submitLabel && panel.submitLabel !== 'return'
        ? `.submitLabel(.${panel.submitLabel})` : ''
      push(`SecureField("${escapeString(panel.text || '')}", text: .constant(""))${sl}`)
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
      fontSize: textStyleToFontSize('body'),
      textColor: '#8e8e93',
      textColorToken: 'secondary'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      push(`TextEditor(text: .constant("${escapeString(panel.text || '')}"))`)
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
      textStyle: 'body',
      fontSize: textStyleToFontSize('body')
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
      textStyle: 'body',
      fontSize: textStyleToFontSize('body')
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
      textStyle: 'body',
      fontSize: textStyleToFontSize('body')
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
      fontSize: textStyleToFontSize('body'),
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
      fontSize: textStyleToFontSize('body'),
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
      textStyle: 'title3',
      fontSize: textStyleToFontSize('title3')
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
      push(`Form {`)
      ;(panel.rows || []).forEach((r) => push(`    Text("${escapeString(r.title || '')}")`))
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
      fontSize: textStyleToFontSize('headline'),
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
        const parts = nodes.map((n, i) => {
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
      push(`List {`)
      push(`    OutlineGroup(outlineSeed, children: \\.children) { node in`)
      push(`        Text(node.title)`)
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
      push(`Ellipse().fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})`)
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
      push(`UnevenRoundedRectangle(topLeadingRadius: ${tl}, bottomLeadingRadius: ${bl}, bottomTrailingRadius: ${br}, topTrailingRadius: ${tr}).fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})`)
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
      push(`LinearGradient(colors: [${a}, ${b}], startPoint: .top, endPoint: .bottom).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)}).cornerRadius(${unitsToPt(panel.cornerRadius || 0)})`)
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
      const color = panel.colorToken
        ? `.${panel.colorToken.replace(/^system/, '').toLowerCase()}`
        : '.blue'
      push(`RealityView { content in`)
      push(`    let mesh = MeshResource.generateSphere(radius: ${r})`)
      push(`    let material = SimpleMaterial(color: UIColor(${color}), isMetallic: false)`)
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
      push(`RealityView { content in`)
      push(`    let mesh = MeshResource.generateBox(width: ${w}, height: ${h}, depth: ${d}, cornerRadius: ${cr})`)
      push(`    let material = SimpleMaterial(color: .systemGreen, isMetallic: false)`)
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
      push(`RealityView { content in`)
      push(`    let mesh = MeshResource.generatePlane(width: ${w}, depth: ${d})`)
      push(`    let material = SimpleMaterial(color: .systemGray, isMetallic: false)`)
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
      push(`RealityView { content in`)
      push(`    let mesh = MeshResource.generateCone(height: ${h}, radius: ${r})`)
      push(`    let material = SimpleMaterial(color: .systemOrange, isMetallic: false)`)
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
      push(`RealityView { content in`)
      push(`    let mesh = MeshResource.generateCylinder(height: ${h}, radius: ${r})`)
      push(`    let material = SimpleMaterial(color: .systemPurple, isMetallic: false)`)
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
      fontSize: textStyleToFontSize('largeTitle'),
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
