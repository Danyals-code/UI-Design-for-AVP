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
      fontWeight: 'regular',
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
      textCase:      'none'   // .textCase(.uppercase / .lowercase)
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
      buttonStyle: 'bordered'
    },
    emit(panel, ctx) {
      const { push, escapeString, sym } = ctx
      const label = sym
        ? `Label("${escapeString(panel.text || 'Button')}", systemImage: "${sym}")`
        : `Text("${escapeString(panel.text || 'Button')}")`
      const bs = panel.buttonStyle && panel.buttonStyle !== 'plain' ? `.buttonStyle(.${panel.buttonStyle})` : ''
      push(`Button { /* action */ } label: { ${label} }${bs}`)
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
      const { push, escapeString } = ctx
      push(`Toggle("${escapeString(panel.text || 'Toggle')}", isOn: .constant(${panel.toggleOn ? 'true' : 'false'}))`)
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
      fontWeight: 'regular',
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
      listStyle: 'insetGrouped'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      push(`List {`)
      ;(panel.rows || []).forEach((r) => {
        const rowLabel = r.systemImage
          ? `Label("${escapeString(r.title || '')}", systemImage: "${r.systemImage}")`
          : `Text("${escapeString(r.title || '')}")`
        push(`    ${rowLabel}`)
      })
      push(`}${panel.listStyle ? `.listStyle(.${panel.listStyle})` : ''}`)
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
      ]
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      push(`Table(/* rows */[]) {`)
      ;(panel.columns || []).forEach((c) => push(`    TableColumn("${escapeString(c)}") { _ in Text("") }`))
      push(`}`)
    }
  },

  menu: {
    defaults: {
      size: [ptToUnits(220), ptToUnits(192)],
      color: '#ffffff',
      colorToken: 'secondarySystemBackground',
      cornerRadius: ptToUnits(12),
      menuItems: ['Cut', 'Copy', 'Paste', 'Duplicate', 'Select All'],
      material: 'thick'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      push(`Menu("${escapeString(panel.text || 'Menu')}") {`)
      ;(panel.menuItems || []).forEach((m) => push(`    Button("${escapeString(m)}") { }`))
      push(`}`)
    }
  },

  progress: {
    defaults: {
      size: [ptToUnits(240), ptToUnits(8)],
      color: '#e3e3e8',
      colorToken: 'systemFill',
      cornerRadius: ptToUnits(4),
      value: 0.65,
      indeterminate: false
    },
    emit(panel, ctx) {
      ctx.push(`ProgressView(value: ${panel.value ?? 0.5})`)
    }
  },

  slider: {
    defaults: {
      size: [ptToUnits(280), ptToUnits(28)],
      color: '#e3e3e8',
      colorToken: 'systemFill',
      cornerRadius: ptToUnits(2),
      sliderValue: 0.5
    },
    emit(panel, ctx) {
      ctx.push(`Slider(value: .constant(${panel.sliderValue ?? 0.5}))`)
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
      stepperMax: 10
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      push(`Stepper("${escapeString(panel.text || 'Stepper')}", value: .constant(${panel.stepperValue ?? 0}), in: ${panel.stepperMin ?? 0}...${panel.stepperMax ?? 10})`)
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
      text: '70'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      push(`Gauge(value: ${panel.value ?? 0.5}) { Text("${escapeString(panel.text || '')}") }`)
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
      sheetDetent: 'large',  // 'medium' | 'large'
      material: 'regular'
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
      material: 'thick'
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
      material: 'thick'
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
      fontWeight: 'regular',
      textAlign: 'left',
      iconName: 'A',
      iconColor: '#007aff',
      // Apple sidebar Label — a tinted rounded-rect tile behind the glyph
      // (Settings.app pattern). null tile ⇒ fall back to the classic circle.
      iconTileColor: null,   // semantic token or '#rrggbb'
      iconTileSize: 28,      // pt
      iconTileRadius: 6      // pt
    },
    emit(panel, ctx) {
      const { push, escapeString, sym, style, weight } = ctx
      const icon = sym || panel.iconName || 'circle.fill'
      push(`Label("${escapeString(panel.text || 'Label')}", systemImage: "${icon}").font(.${style}${weight})`)
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
      textColorToken: 'secondary'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      push(`TextField("${escapeString(panel.text || '')}", text: .constant("${escapeString(panel.textfieldValue || '')}"))`)
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
      textColorToken: 'primary'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      push(`SecureField("${escapeString(panel.text || '')}", text: .constant(""))`)
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
      pickerStyle: 'menu',
      textStyle: 'body',
      fontSize: textStyleToFontSize('body')
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      const opts = panel.pickerOptions || []
      push(`Picker("${escapeString(panel.text || '')}", selection: .constant("${escapeString(panel.pickerValue || opts[0] || '')}")) {`)
      opts.forEach((o) => push(`    Text("${escapeString(o)}").tag("${escapeString(o)}")`))
      push(`}${panel.pickerStyle ? `.pickerStyle(.${panel.pickerStyle})` : ''}`)
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
      dateStyle: 'compact',
      textStyle: 'body',
      fontSize: textStyleToFontSize('body')
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      push(`DatePicker("${escapeString(panel.text || 'Date')}", selection: .constant(Date()))`)
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
      textStyle: 'body',
      fontSize: textStyleToFontSize('body')
    },
    emit(panel, ctx) {
      const { push, escapeString, swiftColor } = ctx
      push(`ColorPicker("${escapeString(panel.text || 'Color')}", selection: .constant(${swiftColor(null, panel.pickedColor || '#ff3b30')}))`)
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
      textStyle: 'body',
      fontSize: textStyleToFontSize('body'),
      fontWeight: 'regular',
      textAlign: 'left',
      italic:        false,
      underline:     true,    // links conventionally underlined by default
      strikethrough: false,
      lineLimit:     1,
      lineSpacing:   0,
      tracking:      0,
      textCase:      'none'
    },
    emit(panel, ctx) {
      // We don't persist a URL — use the displayed text as the destination label.
      const { push, escapeString, style, weight } = ctx
      push(`Link("${escapeString(panel.text || 'Open')}", destination: URL(string: "https://example.com")!).font(.${style}${weight})`)
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
      listStyle: 'insetGrouped'
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      push(`Form {`)
      ;(panel.rows || []).forEach((r) => push(`    Text("${escapeString(r.title || '')}")`))
      push(`}`)
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
      fontSize: textStyleToFontSize('headline')
    },
    emit(panel, ctx) {
      const { push, escapeString } = ctx
      push(`GroupBox("${escapeString(panel.text || '')}") { }`)
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
      // SwiftUI OutlineGroup needs a recursive data model — emit a simple
      // placeholder Text list. Phase 4 may revisit this with proper nesting.
      const { push, escapeString } = ctx
      push(`// OutlineGroup — replace with your own recursive data model`)
      push(`List {`)
      ;(panel.rows || []).forEach((r) => push(`    Text("${escapeString(r.title || '')}")`))
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
  }
}

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
