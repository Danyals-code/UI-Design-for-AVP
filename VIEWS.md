# Views Reference

Detailed map of every SwiftUI-flavoured "view" the designer can place on a
canvas, plus the design-system constants those views read from. This is the
internal source-of-truth doc: when something in the app changes, the answer
to "what changed and where" should live here.

The companion docs are [README.md](README.md) (run/build) and
[FEATURES.md](FEATURES.md) (user-visible surface area). This file is the
implementer's map — paths, defaults, emit patterns, and the path from the
inspector field to the SwiftUI export.

> **Last updated:** 2026-05-15 *(window groups + navigation capsule)*

---

## Table of contents

1. [How the scene graph fits together](#how-the-scene-graph-fits-together)
2. [Coordinate system & units](#coordinate-system--units)
3. [Window](#window)
4. [Window-group tab bar (navigation capsule)](#window-group-tab-bar-navigation-capsule)
5. [Tab](#tab)
6. [Stack](#stack)
6. [Panels — alphabetical reference](#panels--alphabetical-reference)
7. [Entities (RealityKit)](#entities-realitykit)
8. [Design tokens & enums](#design-tokens--enums)
9. [How to update this file](#how-to-update-this-file)

---

## How the scene graph fits together

Every object lives in a single flat array, `state.items`, with parent
relationships expressed via `parentId`. See
[src/store/factories.js](src/store/factories.js) for the factories and
[src/store.js](src/store.js) for the store wiring.

```
Scene (DEFAULT_SCENE in factories.js)
└── Tab          (item.type = 'tab')        — top-level page
    └── Window  (item.type = 'window')      — flat plate or volumetric container
        ├── Stack   (item.type = 'stack')   — VStack / HStack / ZStack / Grid / Section / TabView / …
        │   ├── Panel  (item.type = 'panel')— text, button, slider, … (~55 types)
        │   ├── Stack  (nested)
        │   └── Entity (volume only)
        └── Stack (ornament — leading / trailing / top / bottom)
```

A "view" in this doc means any item factory you can create: Tab, Window,
Stack, Panel, or Entity. Each has its own defaults block in
`factories.js` and (for Panels) a registry entry in
[src/panels/registry.js](src/panels/registry.js).

---

## Coordinate system & units

- **1 scene unit = 1 metre.** RealityKit transforms (entity position,
  scale) are in metres. World positions in `position: [x, y, z]` are
  metres.
- **SwiftUI points → metres:** `POINTS_PER_UNIT = 1360`. So a 1200pt
  window is `1200/1360 ≈ 0.88` units wide.
- Helpers: `ptToUnits(pt)`, `unitsToPt(u)`, `metersToUnits(m)`,
  `unitsToMeters(u)`. All exported from
  [src/appleSystem.js](src/appleSystem.js).
- Sizes stored on `item.size` are always in **units** (metres). Inspector
  fields convert to/from pt at the edge.

---

## Window

**Factory:** `makeWindow(overrides)` in
[src/store/factories.js](src/store/factories.js).

**Inspector:** [src/components/PropertiesPanel/WindowProps.jsx](src/components/PropertiesPanel/WindowProps.jsx).

### Defaults

| Field | Default | Meaning |
| --- | --- | --- |
| `name` | `'Window'` | Display name in Layers. |
| `windowGroupId` | `'WindowN'` (auto-incremented) | SwiftUI `WindowGroup(id:)` identifier. Used by the `.openWindow(id:)` button tap action and by the WindowGroupTabBar3D pill labels. Defaults to a fresh `Window1` / `Window2` / … per the `nextWindowGroupId()` counter so each new window is uniquely addressable from day one. User-editable. |
| `tabIcon` | `'rectangle'` | SF Symbol drawn on this window's pill in the leading-edge navigation capsule. |
| `size` | `[1200pt, 800pt]` | Plate frame in points (stored as units). Matches `WINDOW_PRESETS.regular`. |
| `cornerRadius` | `30pt` | Outer plate radius. Matches Apple's visionOS Figma kit. |
| `position` | `[0, 1.4, -1.0]` (m) | Chest height, 1m in front of wearer. |
| `material` | `'regular'` | Liquid Glass tier — see `MATERIALS` in [appleSystem.js](src/appleSystem.js). |
| `colorToken` / `color` | `'designWindow'` / `#ecedef` | Near-white visionOS plate fill. |
| `fillOpacity` | `1.0` | Plate alpha (glass renderer adds its own translucency). |
| `padding` | `14pt` | Inner content padding (matches visionOS reference layouts). |
| `windowStyle` | `'automatic'` | `'automatic'` \| `'plain'` \| `'volumetric'` — drives `.windowStyle()` on export. |
| `scrollable` | `false` | When true the exporter wraps content in `ScrollView`. |
| `volumeDepthMeters` | `0.6` | `.defaultSize` depth in metres when volumetric. |
| `worldScalingBehavior` | `'automatic'` | `.defaultWorldScalingBehavior(...)`. |
| `volumeBaseplateVisibility` | `'automatic'` | `'automatic'` \| `'visible'` \| `'hidden'`. |
| `volumeWorldAlignment` | `'adaptive'` | visionOS 2+ default; or `'gravityAligned'`. |
| `supportedVolumeViewpoints` | `'all'` | `'all'` \| `'front'` \| `'frontBack'`. |
| `spatial.immersionStyle` | `'mixed'` | When in immersive mode. |
| `spatial.hoverEffect` | `'automatic'` | Inherited by descendant panels (`hoverEffect: 'inherit'`). |
| `spatial.windowResizability` | `'automatic'` | `.windowResizability(.automatic)`. |
| `spatial.gestures` | `['tap', 'drag']` | Allowed gesture kinds. |
| `environment` | see `DEFAULT_ENVIRONMENT` | `{ font, foregroundStyle, tint, locale, layoutDirection }`. |
| `modifiers` | `[]` | Ordered modifier stack ([src/modifiers/registry.js](src/modifiers/registry.js)). |

### Inspector sections

- **Window** — name, Group ID, Tab Icon, Primary (this/auto), Scrollable.
- **Frame** — size W/H, corner radius, padding, world position X/Y/Z.
- **Material** — glass tier, fill token, fallback hex.
- **Volume** *(only when `windowStyle === 'volumetric'`)* — depth, world scaling, baseplate, alignment, viewpoints.
- **Spatial** — immersion style, hover effect, resizability, gestures.
- **Ornaments** — toolbar wizard (top/bottom, leading/principal/trailing slots).
- **Environment** — font, foreground style, layout direction, locale.
- **Modifiers** — modifier stack.

### Export
`WindowGroup { … } .defaultSize(...) .windowStyle(...)` for a regular window;
`VolumetricWindowGroup { … }` when volumetric; `ImmersiveSpace { … }` when
the scene is immersive. See
[src/export/swiftui.js](src/export/swiftui.js).

---

## Window-group tab bar (navigation capsule)

A scene-level chrome element rendered by `WindowGroupTabBar3D` in
[src/components/SceneTree.jsx](src/components/SceneTree.jsx). Not a factory —
it has no item in `items[]`; the bar is derived live from the window
list every render. One pill per **unique `windowGroupId`** in the
active tab — windows that share an id collapse to a single pill (their
shared "WindowGroup").

### Visibility rule

Visible whenever the active tab resolves to **two or more unique
`windowGroupId` values**. Each fresh window auto-mints a unique
`WindowN` id, so adding a second window flips the bar on. Two windows
with the same id stay as one pill (the group); the bar appears only
once a *second distinct id* is added.

### Open-window set + spawn semantics

`scene.openWindowItemIds` tracks which window items are currently
rendered in preview. The set is seeded lazily from the primary window:
the first `openWindow(id:)` action read this state and decides what to do.

| Trigger | Effect |
| --- | --- |
| Click pill for the active group | No-op (already showing). |
| Click pill for a different group | Active group switches; open set resets to that group's primary window. All previously-spawned same-id instances disappear. |
| `openWindow(id:)` action targeting an item whose `windowGroupId` matches the active group | The item is **appended** to the open set — visually it spawns to the right of the current row. |
| `openWindow(id:)` action targeting a different-group item | Active group switches; open set replaces with that one item. |

The renderer in `SceneTree` lays the open windows out as a single
horizontal row centred at the wearer's chest height (1.4m, 1m forward
on z) with **60pt gap** between plates. Editor mode is unchanged —
each window stays at its stored design position.

### Layout

Vertical capsule of pills on the **leading edge** of the leftmost
rendered window (the first open window in preview; the leftmost design
position in editor). Sizing follows the visionOS spec:

- 44×44pt icon chip per pill
- 12pt outer padding on all four sides
- 12pt gap between chips
- Total height = `2·pad + N·44 + (N-1)·12` (e.g. 180pt for 3 pills)
- Collapsed width: `44 + 2·12 = 68pt`
- Expanded width: **150pt** when hovered *in preview mode* — the
  right edge moves outward and a text label appears next to each icon

When the scene also has 2+ tabs (page-tab bar visible), the window-group
bar slides one lane further outboard (`lane='outer'`) so both rails
coexist.

### Per-pill content

The pill reads from the **first window of that group** in document
order (the "representative"). One pill per group, not per item.

| Source | Shown |
| --- | --- |
| `representative.tabIcon` | SF Symbol glyph in the 44×44pt chip. Defaults to `rectangle`. |
| `representative.name` (fallback groupId) | Label appears to the right of the icon when the bar expands on hover (preview only). |

Clicking a pill calls `setActiveWindowGroup(groupId)`, which writes the
id to `scene.activeWindowGroupId` and resets the open set to the
group's primary representative.

### Inspector

Per-window: the **Group ID** and **Tab Icon** fields in the Window
inspector (Object tab). No standalone bar inspector — the bar
auto-updates from window metadata.

---

## Tab

**Factory:** `makeTab(overrides)`.

**Inspector:** [src/components/PropertiesPanel/TabProps.jsx](src/components/PropertiesPanel/TabProps.jsx).

### Defaults

| Field | Default | Meaning |
| --- | --- | --- |
| `name` | `'Tab'` | Display name. |
| `icon` | `'folder'` | SF Symbol name. |
| `visible` | `true` | |
| `collapsed` | `false` | |

### Inspector sections

- **Tab** — name, SF Symbol picker, ordering controls.

### Export

Tabs become separate `*View.swift` files; the top-level `App.swift`
composes them under a `TabView` when more than one exists.

---

## Stack

**Factory:** `makeStack(overrides)`.

**Inspector:** [src/components/PropertiesPanel/StackProps.jsx](src/components/PropertiesPanel/StackProps.jsx).

Stack types live in `STACK_TYPES` ([appleSystem.js](src/appleSystem.js))
and cover every SwiftUI layout container. Each stack carries the
superset of all stack-type fields; the inspector and exporter consult
`stackType` to decide which ones to show / emit.

### Stack types (`stackType` values)

| Kind | Notes |
| --- | --- |
| `vstack`, `hstack`, `zstack` | Plain SwiftUI stacks. Alignments differ per kind. |
| `grid` | 2D grid; `columns` + `gridMode` ('fixed' \| 'adaptive'). |
| `lazyvstack`, `lazyhstack`, `lazyVGrid`, `lazyHGrid` | Lazy variants. |
| `scrollView` | `scrollAxis`, `scrollShowsIndicators`. |
| `viewThatFits` | `fitsAxes`: `'both'` \| `'horizontal'` \| `'vertical'`. |
| `section`, `disclosure` | Section header/footer, disclosure expanded state. |
| `navigationStack`, `tabView`, `tab` | `activeChild` / `activeTab` / `tabLabel` / `tabIcon`. |
| `toolbar`, `toolbarItem`, `toolbarItemGroup` | `toolbarPlacement` per `TOOLBAR_PLACEMENTS`. |

### Defaults (superset)

| Field | Default | Meaning |
| --- | --- | --- |
| `stackType` | `'vstack'` | Layout kind. |
| `alignment` | `'center'` | Cross-axis alignment (options depend on `stackType`). |
| `spacing` | `null` | `null` = SwiftUI system-adaptive spacing. |
| `padding` | `24pt` | Uniform inner padding; `paddingEdges` (4-tuple) overrides. |
| `widthMode`, `heightMode` | `'fit'`, `'fit'` | `'fit'` \| `'fixed'` \| `'fill'`. |
| `fixedWidth`, `fixedHeight` | `null` | Used when mode is `'fixed'`. |
| `material` | `'regular'` | Background material tier. |
| `background` | `null` | Optional fill (`{ token, color }`). |
| `scrollable` | `false` | Wraps content in `ScrollView`. |
| `columns` | `2` | Grid columns. |
| `gridMode` | `'fixed'` | `'fixed'` \| `'adaptive'`. |
| `minColumnWidth` | `140pt` | Adaptive grid minimum. |
| `scrollAxis` | `'vertical'` | ScrollView axis. |
| `scrollShowsIndicators` | `true` | |
| `fitsAxes` | `'both'` | ViewThatFits axes. |
| `sectionHeader`, `sectionFooter` | `''`, `''` | Section text. |
| `expanded` | `false` | Disclosure default. |
| `activeChild`, `activeTab` | `0`, `0` | NavStack / TabView active index. |
| `ornament` | `null` | Anchor edge name when this stack is an ornament. |
| `ornamentAnchorMode` | `'scene'` | `'scene'` \| `'parent'`. |
| `ornamentContentAlignment` | `'center'` | |
| `ornamentVisibility` | `'automatic'` | |
| `ornamentOffset` | `0` | |
| `toolbarPlacement` | `'automatic'` | Drives `ToolbarItem(placement: …)`. |
| `environment` | `DEFAULT_ENVIRONMENT` | Per-stack environment overrides. |
| `modifiers` | `[]` | |

### Inspector sections

- **Stack** — name + kind picker (or **Navigation Split View** for split layouts).
- **Layout** — alignment, spacing, padding, per-type fields (Grid columns, ScrollView axis, …).
- **Size** — width/height mode (Fit / Fixed / Fill, pt values when Fixed).
- **Scroll** — Scrollable toggle.
- **Section / Disclosure / Navigation / TabView / Tab / ToolbarItem** — only shown for the matching `stackType`.
- **Ornament** — anchor mode, edge, alignment, visibility, offset, background, material.
- **Environment** — font, foreground, direction, locale.
- **Modifiers** — modifier stack.

---

## Panels — alphabetical reference

Every panel type is registered in [src/panels/registry.js](src/panels/registry.js)
(`PANELS` object) and each has a matching `INSPECTORS[type]` entry in
[src/panels/inspectors.jsx](src/panels/inspectors.jsx). Sizes are in
**pt** unless noted; the renderer divides by `POINTS_PER_UNIT` to get
metres.

Per-type metadata in `PANEL_META`:
- `frameMode: 'figma'` — Fit / Fixed / Fill width picker (text, link).
- `frameMode: 'explicit'` — manual W/H fields (default).
- `frameMode: 'none'` — no W/H controls (button — driven by Size picker).
- `lockHeight: true` — hide height (list — auto-derived from row count).

### Text & typography

#### `text`
- **Default:** size `null` (auto), text `'Hello World'`, textStyle `body`, fontWeight `medium`, textAlign `left`.
- **Frame mode:** figma (Fit / Fixed / Fill).
- **Inspector:** Text body (textarea) + Style / Weight / Color / Align + Text-only modifiers (italic, underline, strikethrough, lineLimit, tracking, kerning, baselineOffset, textCase, truncationMode, minimumScaleFactor, allowsTightening, fontDesign, monospacedDigit).
- **Emit:** `Text("...").font(.body).foregroundStyle(...)` + chained Text modifiers.

#### `link`
- **Default:** 200×24, text `'Open Link'`, url `'https://www.apple.com/vision-pro/'`, underline `true`.
- **Inspector:** Link mode (value vs URL), URL field, label text.
- **Emit:** `Link("...", destination: URL(string: "...")!)`.

#### `label`
- **Default:** 200×28, text `'Label'`, symbolName `'info.circle'` (configurable), imageScale `medium`, iconTileColor/Size/Radius.
- **Inspector:** Title text, SF Symbol picker, image scale, optional icon tile background.
- **Emit:** `Label("...", systemImage: "...").font(...)`.

#### `ticker`
- **Default:** 420×36, text `'Breaking News  ·  Latest update …'`, textStyle `footnote`, semibold, white-on-dark.
- **Inspector:** Multiline text body + standard text controls (no body row).
- **Emit:** `ScrollView(.horizontal, showsIndicators: false) { Text(...).font(...) }` (designer wires marquee).

### Controls

#### `button`
- **Default:** 86×44 (Regular), `buttonSize: 'regular'`, `buttonShape: 'capsule'`, cornerRadius `100pt`, text `'Button'`, fontSize `17pt`, textColor `'designButtonText'`, color `'designButton'` (#b7b6b1), `buttonStyle: 'automatic'`, `buttonBorderShape: 'automatic'`, `tapAction: null`.
- **Frame mode:** none (driven by `buttonSize`).
- **Side padding:** 12pt each side, fixed (renderer in [Panel3D.jsx](src/components/Panel3D.jsx) — see `textInset`).
- **Auto-grow width:** the rendered frame is `[max(presetWidth, textWidth + 24pt + symbolReserve), presetHeight]` — computed by `computeButtonFramePt` in [src/appleSystem.js](src/appleSystem.js) via `measureTextWidthPt` (canvas 2D, Inter font). Height stays at the preset; width grows past the preset whenever a longer label needs it, keeping the 12pt side padding and a single line. A leading SF Symbol reserves an extra `fontPt × 1.1 + 4pt` on the leading edge.
- **Size presets (`BUTTON_SIZES`):** small `65×32 / 15pt`, regular `86×44 / 17pt`, large `101×52 / 19pt`.
- **Shape presets (`BUTTON_SHAPES`):** capsule (`100pt` radius), roundedRectangle (`16pt` radius).
- **Inspector:** Size · Style · Role · Tint + Label sub-section (text body, weight, color, alignment). Width/height are intentionally NOT exposed — the frame tracks the Size preset and the label width.
- **Emit:** `Button(role: ...) { action } label: { Label/Text(...) }` with `.buttonStyle(...)` / `.buttonBorderShape(...)` / `.controlSize(...)` / `.tint(...)` chained only when non-default. SwiftUI's native Button auto-sizes to fit its label, so no `.frame()` is emitted — the canvas behaviour matches the device.

#### `toggle`
- **Default:** 280×36 (fill width), text `'Toggle'`, toggleOn `true`, color `'systemGreen'` (#30d158), `toggleStyle: 'automatic'` (→ `.switch` on visionOS).
- **Inspector:** Label, Value (On/Off segmented), Style, Size, Tint.
- **Emit:** `Toggle("...", isOn: .constant(true))` with style chained only when non-automatic.

#### `slider`
- **Default:** 280×60, sliderValue `0.5`, min `0`, max `1`, step `0`, optional min/max labels.
- **Inspector:** Value · Min · Max · Step + Min/Max labels.
- **Emit:** `Slider(value: .constant(0.5), in: 0...1)`.

#### `stepper`
- **Default:** 280×36 (fill width), stepperValue `5`, min `0`, max `10`, step `1`, text `'Stepper'`.
- **Inspector:** Label, Value, Min, Max, Step.
- **Emit:** `Stepper("...", value: .constant(5), in: 0...10)`.

#### `picker`
- **Default:** 260×36, text `'Selection'`, pickerOptions `['Option 1', 'Option 2', 'Option 3']`, pickerValue `'Option 1'`, `pickerStyle: 'automatic'` (→ `.menu` on visionOS).
- **Inspector:** Title, Options (textarea), Selected option, Style.
- **Emit:** `Picker("...", selection: .constant(...)) { Text("...").tag("...") }.pickerStyle(...)`.

#### `segmented`
- **Default:** 260×32, segments `['Day', 'Week', 'Month']`, selectedSegment `1`, color `'systemFill'`, cornerRadius `8pt`, textStyle `footnote`, semibold.
- **Inspector:** Items (comma-separated) + Selected index.
- **Emit:** `Picker("", selection: .constant("...")) { Text("...").tag("...") }.pickerStyle(.segmented)`.

#### `datepicker`
- **Default:** 180×36, dateValue `'2026-04-16'`, `dateStyle: 'automatic'`, `displayedComponents: 'dateAndTime'`.
- **Inspector:** Date value, Style, Components (date / time / dateAndTime / time+seconds).
- **Emit:** `DatePicker("...", selection: .constant(Date()), displayedComponents: [...]).datePickerStyle(...)`.

#### `colorpicker`
- **Default:** 200×36, text `'Color'`, pickedColor `'#ff3b30'`, supportsOpacity `true`.
- **Inspector:** Label, Color, Supports opacity toggle.
- **Emit:** `ColorPicker("...", selection: .constant(...), supportsOpacity: true)`.

#### `gauge`
- **Default:** 140×80, value `0.7`, min `0`, max `100`, `gaugeStyle: 'automatic'`, optional min/max labels, optional tint gradient (`gaugeTintFrom`/`To`).
- **Inspector:** Value, Range, Style, Tint gradient, Labels.
- **Emit:** `Gauge(value: 0.7, in: 0...100) { ... } currentValueLabel: { ... }.gaugeStyle(...)`.

#### `progress`
- **Default:** 240×8, value `0.65`, total `1.0`, indeterminate `false`.
- **Inspector:** Value / Total / Indeterminate (Yes/No segmented).
- **Emit:** `ProgressView(value: 0.65, total: 1.0).progressViewStyle(...)`.

#### `search`
- **Default:** 305×44, color `'systemFill'`, cornerRadius `12pt`, text `'Search'` (placeholder).
- **Inspector:** Placeholder.
- **Emit:** comment hint `// .searchable(text: $searchText, prompt: "...")` — designer attaches on parent.

#### `textfield`
- **Default:** 305×44, cornerRadius `12pt`, text `'Placeholder'`, textfieldValue `''`, keyboardType `'default'`, textContentType `''`, submitLabel `'return'`, autocapitalization `'sentences'`, autocorrectionDisabled `false`, axis `'horizontal'`, lineLimit `1`.
- **Inspector:** Placeholder, Value, Keyboard type, Content type, Submit label, Autocapitalization, Autocorrection, Axis (h/v), Line limit.
- **Emit:** `TextField("placeholder", text: .constant(""))` with `.keyboardType(...)` / `.textContentType(...)` / `.submitLabel(...)` / `.autocapitalization(...)` / `.lineLimit(...)` chained only when non-default.

#### `securefield`
- **Default:** 305×44, cornerRadius `16pt`, text `'Password'`, dotCount `8`, submitLabel `'done'`.
- **Inspector:** Placeholder, Dot count, Submit label.
- **Emit:** `SecureField("...", text: .constant(""))`.

#### `texteditor`
- **Default:** 300×160, text `'Type here…'`, lineCount `5`.
- **Inspector:** Body text, Line count.
- **Emit:** `TextEditor(text: .constant("..."))`.

### Collections

#### `list`
- **Default:** 360pt wide (height auto-derived from row count × row metric), 4 rows, `listStyle: 'insetGrouped'`.
- **Frame mode:** explicit + `lockHeight: true`.
- **Row metrics:** driven by `LIST_STYLES[listStyle]` — rowH / pad / inset / gap / roundedRows / showSeparators / showGroupCard.
- **Inspector:** Style (default / plain / inset / insetGrouped / grouped / sidebar) + per-row separator/tint/background/spacing controls, header prominence, row list (title + subtitle).
- **Emit:** `List { Text(...) } .listStyle(...) .listRowSeparator(...) .listRowBackground(...) .headerProminence(...)`.

#### `table`
- **Default:** 440×260, columns `['Title', 'Subtitle', 'Detail']`, rows `[3 rows × 3 cells]`, `tableStyle: 'automatic'`.
- **Inspector:** Style, Columns (comma), Rows.
- **Emit:** `Table { TableColumn("Title") { ... } }`.

#### `menu`
- **Default:** 220×192, text `'Menu'`, menuItems `['Item 1', …, 'Item 5']`, material `'thick'`, `menuStyle: 'automatic'`, `menuOrder: 'automatic'`, `menuIndicator: 'automatic'`.
- **Inspector:** Title, Items (textarea), Style, Order, Indicator.
- **Emit:** `Menu("...") { Button("...") { } } .menuStyle(...) .menuOrder(...) .menuIndicator(...)`.

#### `form`
- **Default:** 360×300, color `secondarySystemBackground`, rows `[3]`, `formStyle: 'automatic'`.
- **Inspector:** Style picker (variant switch with list / form / groupbox).
- **Emit:** `Form { Text(...) } .formStyle(...)`.

#### `groupbox`
- **Default:** 300×160, text `'Settings'`, textStyle `headline`, `groupBoxStyle: 'automatic'`.
- **Inspector:** Label, Style.
- **Emit:** `GroupBox("...") { Text(...) } .groupBoxStyle(...)`.

#### `outlinegroup`
- **Default:** 320×240, rows = nested tree with `indent` + `expanded`.
- **Inspector:** Title + rows tree.
- **Emit:** Generates an `OutlineNode` struct + `OutlineGroup` with recursive children.

### Media

#### `image`
- **Default:** 320×200, color `'tertiary'`, cornerRadius `14pt`, imageUrl `null`.
- **Inspector:** Async on/off (swap to `asyncimage`), Image URL / file picker, Fit (fill / fit / stretch / tile).
- **Emit:** `Image(systemName: "photo")` placeholder until an asset is wired.

#### `asyncimage`
- **Default:** 320×200, color `'systemFill'`.
- **Inspector:** Same shape as `image`, plus URL.
- **Emit:** `AsyncImage(url: URL(string: "..."))`.

#### `slideshow`
- **Default:** 360×220, slideCount `3`, currentSlide `0`, text `'Slideshow'`.
- **Inspector:** Slide count, active index, title.
- **Emit:** `TabView { Text("Slide 1").tag(0) … }.tabViewStyle(.page)`.

### Layout primitives

#### `spacer`
- **Default:** 20×20, `isSpacer: true`. Renders as nothing in the canvas.
- **Emit:** `Spacer()`.

#### `divider`
- **Default:** 300×1, color `'tertiary'` (#c7c7cc).
- **Emit:** `Divider()`.

### Shapes

#### `rectangle`
- **Default:** 200×140, color `'systemBlue'`, cornerRadius `12pt`.
- **Emit:** `Rectangle().fill(...).frame(...)`.

#### `circle`
- **Default:** 120×120, color `'systemGreen'`.
- **Emit:** `Circle().fill(...).frame(...)`.

#### `capsule`
- **Default:** 200×60, color `'systemPurple'`.
- **Emit:** `Capsule().fill(...).frame(...)`.

#### `ellipse`
- **Default:** 200×140, color `'systemOrange'`.
- **Emit:** `Ellipse().fill(...).frame(...)`.

#### `unevenRoundedRect`
- **Default:** 200×140, `topLeadingRadius: 24pt`, `topTrailingRadius: 8pt`, `bottomLeadingRadius: 8pt`, `bottomTrailingRadius: 24pt`.
- **Emit:** `UnevenRoundedRectangle(...).fill(...).frame(...)`.

#### `path`
- **Default:** 200×200, color `'systemIndigo'`.
- **Emit:** `Path { p in ... }.fill(...).frame(...)`.

### Gradients

#### `linearGradient`
- **Default:** 240×160, `gradientFrom: '#007aff'`, `gradientTo: '#af52de'`, `gradientAngle: 180°`.
- **Emit:** `LinearGradient(colors: [...], startPoint: .top, endPoint: .bottom)`.

#### `radialGradient`
- **Default:** 200×200, `gradientFrom: '#ffcc00'`, `gradientTo: '#ff3b30'`.
- **Emit:** `RadialGradient(colors: [...], center: .center, startRadius: …, endRadius: …)`.

#### `angularGradient`
- **Default:** 200×200, `gradientFrom: '#34c759'`, `gradientTo: '#007aff'`.
- **Emit:** `AngularGradient(colors: [...], center: .center)`.

### Presentation (modifier-emitted)

These panels never render in the parent's child list at export — they
attach as modifiers on the parent.

#### `sheet`
- **Default:** 600×400, `sheetDetent: 'large'`, `sheetFraction: 0.7`, material `'regular'`, optional `presentationDragIndicator`, `presentationCornerRadius`, `interactiveDismissDisabled`.
- **Emit:** Attached as `.sheet(isPresented: ...) { … }` on the parent view.

#### `popover`
- **Default:** 260×180, color `'systemBackground'`, material `'thick'`, `popoverAnchor: 'rectBounds'`.
- **Emit:** `.popover(isPresented: ...) { … }`.

#### `alert`
- **Default:** 300×180, text `'Alert Title'`, `alertMessage: 'Are you sure?'`, `alertButtons: ['Cancel', 'OK']`.
- **Auto-roles:** Buttons named `'Cancel' / 'Delete' / 'Remove'` get `.cancel` / `.destructive` automatically.
- **Emit:** `.alert("...", isPresented: ...) { Button(...) { } } message: { Text(...) }`.

#### `confirmationdialog`
- **Default:** 300×180, text `'Are you sure?'`, `alertButtons: ['Delete', 'Cancel']`, `titleVisibility: 'automatic'`.
- **Emit:** `.confirmationDialog("...", isPresented: ..., titleVisibility: ...) { Button(role: .destructive, ...) }`.

#### `inspector`
- **Default:** 320×480, text `'Inspector content'`, material `'regular'`, width metrics (`inspectorColumnWidth: 320pt`, min/ideal/max).
- **Emit:** `.inspector(isPresented: ...) { … }.inspectorColumnWidth(min:..., ideal:..., max:...)`.

### Navigation & misc

#### `navigationlink`
- **Default:** 220×28, text `'See Details'`, `linkMode: 'value'`, `navValue: 'detail'` (or `destinationName` when `linkMode === 'destination'`).
- **Emit:** Either `NavigationLink(value: "...") { Text(...) }` (value mode) or `NavigationLink { DestView() } label: { Text(...) }` (destination mode).

#### `contentUnavailable`
- **Default:** 320×200, text `'No Results'`, `alertMessage: 'Try a different search.'`, textStyle `title3`, symbol `'magnifyingglass'`.
- **Emit:** `ContentUnavailableView("...", systemImage: "...", description: Text("..."))`.

#### `canvas`
- **Default:** 240×160, color `'systemBackground'`, cornerRadius `16pt`.
- **Emit:** Placeholder `Rectangle()` sized to the frame (no native SwiftUI 1:1).

### 3D primitives (visionOS-only)

These are SwiftUI views that wrap RealityKit content. The canvas renders
the placeholder geometry; the exporter writes the matching SwiftUI/
RealityKit code.

| Type | Default frame | Key fields | Emit |
| --- | --- | --- | --- |
| `sphere` | 160×160 / depth 160 | `radius` | `RealityView { content in MeshResource.generateSphere(radius:) … }` |
| `box` | 160×160 / depth 160 | `boxWidth/Height/Depth`, `boxCornerRadius` | `MeshResource.generateBox(width: height: depth:)` |
| `plane` | 200×140 / depth 40 | `planeWidth`, `planeDepth` | `MeshResource.generatePlane(width: depth:)` |
| `cone` | 140×180 / depth 180 | `coneHeight`, `coneRadius` | `MeshResource.generateCone(height: radius:)` |
| `cylinder` | 140×180 / depth 180 | `cylHeight`, `cylRadius` | `MeshResource.generateCylinder(height: radius:)` |
| `text3d` | 220×80 / depth 60 | `text`, `textStyle`, `fontWeight`, `extrusionDepth` (20pt) | `Text3D("...").extrusionDepth(...).frame(depth:)` |
| `mesh` | 220×220 / depth 200 | `meshAsset` (e.g. `'Earth'`) | `Model3D(named: "...").frame(depth:)` |
| `realityview` | 360×360 | `cameraMode`, `showAnchorAxes` | `RealityView { content in /* TODO */ }` |

---

## Entities (RealityKit)

Live alongside panels in `items[]` with `type: 'entity'`. Factories in
[src/store/factories.js](src/store/factories.js); registry in
[src/realityKit/registry.js](src/realityKit/registry.js).

### Entity kinds (`entityKind`)

| Kind | Class | Can have children | Notes |
| --- | --- | --- | --- |
| `anchor` | `AnchorEntity` | yes | Root of an entity sub-tree. Anchor target via `ANCHOR_TARGETS`. |
| `model` | `ModelEntity` | yes | Mesh + materials. Default `meshType: 'box'`, position `[0, 1.2, 0]`. |
| `group` | `Entity` | yes | Empty transform node. |
| `camera` | `PerspectiveCamera` | no | Designer marker; defaults: position `[0, 1.6, 1.0]`, fov `60°`, near `0.1`, far `50`. |
| `attachment` | `Attachment` | no | Pins a SwiftUI view to a 3D position; default position `[0, 0.2, 0]`. |

Common base (every entity): `position [0,0,0]m`, `rotation [0,0,0]°`,
`scale [1,1,1]`, `components { … all 4 disabled by default }`,
`behaviors: []`.

### Anchor targets (`anchorTarget`)

| Value | SwiftUI | Extra fields |
| --- | --- | --- |
| `world` | `.world(transform: matrix_identity_float4x4)` | — |
| `head` | `.head` | — |
| `hand` | `.hand` | `handChirality` (left / right / either), `handLocation` (palm, wrist, thumbTip, indexFingerTip, …) |
| `plane` | `.plane` | `planeAlignment` (horizontal / vertical / any), `planeClassification` (any / floor / ceiling / wall / table / seat / window / door), `planeMinimumBounds` |
| `image` | `.image` | `imageGroup`, `imageName` |
| `object` | `.object` | `objectGroup`, `objectName` |

### Mesh types (`meshType`)

| Type | SwiftUI | Defaults (metres) |
| --- | --- | --- |
| `box` | `MeshResource.generateBox(width:height:depth:)` | size `[0.1, 0.1, 0.1]`, cornerRadius `0` |
| `sphere` | `MeshResource.generateSphere(radius:)` | radius `0.05` |
| `cylinder` | `MeshResource.generateCylinder(height:radius:)` | height `0.1`, radius `0.05` |
| `cone` | `MeshResource.generateCone(height:radius:)` | height `0.1`, radius `0.05` |
| `plane` | `MeshResource.generatePlane(width:depth:)` | width `0.1`, depth `0.1` |
| `text` | `MeshResource.generateText(...)` | `'Hello'`, extrusion `0.005`, font size `0.05`, alignment `center`, wordWrap |
| `usdz` | `Entity.load(named:)` | `usdzAsset: ''`, `usdzAnimationName: null` |

### Material types

| Type | Class | Defaults |
| --- | --- | --- |
| `simple` | `SimpleMaterial` | baseColor `#ffffff`, roughness `0.5`, isMetallic `false` |
| `physicallyBased` | `PhysicallyBasedMaterial` | baseColor, roughness, metallic, normal, emissive (intensity), AO, sheen, clearcoat, blending (opaque / transparent), opacityThreshold, faceCulling (back / front / none), texCoordTransform |
| `unlit` | `UnlitMaterial` | unlitColor `#ffffff`, blending, faceCulling, opacityThreshold |
| `occlusion` | `OcclusionMaterial` | (writes depth, hides behind real-world geometry) |
| `portal` | `PortalMaterial` | (reveals paired portal world) |
| `video` | `VideoMaterial` | videoAssetName `''`, autoplay `true`, loops `true`, audioGain `1.0` |
| `shaderGraph` | `ShaderGraphMaterial` | shaderGraphAssetName `''`, shaderGraphFromBundle `'main'` |

### Components

All four start disabled (`enabled: false`); the inspector turns them on.

| Component | Purpose | Key fields |
| --- | --- | --- |
| `groundingShadow` | Soft contact shadow on real-world geometry | `castsShadow: true` |
| `opacity` | Multiplies alpha for entity + descendants | `value: 1.0` |
| `imageBasedLight` | Environment map as lighting source | `resourceName`, `intensityExponent`, `inheritsRotation` |
| `imageBasedLightReceiver` | Marks entity as IBL receiver | `referenceEntity` |

### Attachment kinds

| Kind | Defaults |
| --- | --- |
| `text` | text `'Hello'`, color `#ffffff`, background `#1c1c1e`, fontSize `0.05m`, padding `0.02m`, cornerRadius `0.02m` |
| `label` | text fields + `attachmentSymbol: 'info.circle'` |
| `button` | text fields + background `#0a84ff`, padding `0.025m`, cornerRadius `0.04m` |
| `image` | `attachmentImageUrl: ''`, `attachmentSize: 0.20m`, background `#3a3a3c` |

All attachments default to `attachmentBillboard: true` (face the camera).

---

## Design tokens & enums

Reference data exported from
[src/appleSystem.js](src/appleSystem.js). Everything in this section is
read-only — components consume it but never mutate it.

### Typography — `TEXT_STYLES`

| Style | pt | Weight | Line height |
| --- | --- | --- | --- |
| `extraLargeTitle` | 36 | bold | 44 |
| `extraLargeTitle2` | 28 | bold | 34 |
| `largeTitle` | 34 | bold | 41 |
| `title` | 28 | bold | 34 |
| `title2` | 22 | bold | 28 |
| `title3` | 20 | semibold | 25 |
| `headline` | 17 | bold | 22 |
| `body` | 17 | medium | 22 |
| `callout` | 16 | regular | 21 |
| `subheadline` | 15 | regular | 20 |
| `footnote` | 13 | regular | 18 |
| `caption` | 12 | regular | 16 |
| `caption2` | 11 | regular | 13 |

### Window / Volume presets

- **`WINDOW_PRESETS`** — Regular **1200×800** (default), Wide 1280×720, Tall 720×1080, Compact 640×480, Square 720×720.
- **`VOLUME_PRESETS`** — Small `544×408×544 pt` ≈ `0.4×0.3×0.4 m`, Medium `816×544×816 pt` ≈ `0.6×0.4×0.6 m` (Apple default), Large `1224×816×1224 pt` ≈ `0.9×0.6×0.9 m`.
- **`WINDOW_CORNER_RADIUS`** — 30pt (visionOS Figma kit).
- **`WINDOW_PADDING`** — 14pt inner inset.
- **`SPLIT_SEPARATED_WIDTH`** / **`SPLIT_SEPARATED_RADIUS`** — 320pt / 30pt.

### Button presets

- **`BUTTON_SIZES`** — small `65×32` (15pt text), regular `86×44` (17pt), large `101×52` (19pt).
- **`BUTTON_SHAPES`** — capsule (`radiusPt: 100`), roundedRectangle (`radiusPt: 16`).
- **`BUTTON_TEXT_INSET_PT`** — 12pt fixed side padding inside every button.
- **`BUTTON_STYLES`** — automatic, plain, borderless, bordered, borderedProminent, glass, glassProminent, destructive.
- **`BUTTON_BORDER_SHAPES`** — automatic, capsule, circle, roundedRectangle.

### Materials (Liquid Glass tiers — `MATERIALS`)

ultraThin (0.42 opacity), thin (0.55), regular (0.72) ← window default,
thick (0.88), ultraThick (0.96), opaque (1.0), bar (0.62 — toolbar /
chrome).

### Lists (`LIST_STYLES`)

| Style | rowH | pad | inset | gap | roundedRows | showSeparators | showGroupCard |
| --- | --- | --- | --- | --- | --- | --- | --- |
| default | 44 | 12 | 20 | 4 | false | true | true |
| plain | 44 | 0 | 16 | 4 | false | true | false |
| inset | 44 | 10 | 24 | 4 | false | true | true |
| **insetGrouped** *(default for new lists)* | 48 | 6 | 16 | 4 | **true** | false | false |
| grouped | 44 | 20 | 0 | 4 | false | true | false |
| sidebar | 56 | 0 | 12 | 0 | false | false | true |

### Stack types

`STACK_TYPES` covers the entire SwiftUI layout family:
vstack / hstack / zstack / grid / lazyvstack / lazyhstack / lazyVGrid /
lazyHGrid / scrollView / viewThatFits / section / disclosure /
navigationStack / tabView / tab / toolbar / toolbarItem /
toolbarItemGroup.

### Style enums (per-control)

- `TOGGLE_STYLES` — automatic (→ switch on visionOS), switch, button.
- `PICKER_STYLES` — automatic (→ menu), menu, segmented, wheel, inline, palette, navigationLink.
- `LABEL_STYLES` — automatic, titleAndIcon, iconOnly, titleOnly.
- `TEXTFIELD_STYLES` — automatic (→ recessed glass), plain, roundedBorder.
- `CONTROL_SIZES` — mini, small, regular, large, extraLarge.
- `TABLE_STYLES` — automatic, inset.
- `DATE_PICKER_STYLES` — automatic (→ compact), compact, graphical, wheel.
- `PROGRESS_VIEW_STYLES` — automatic, linear, circular.
- `GAUGE_STYLES` — automatic (→ linearCapacity), linearCapacity, accessoryLinearCapacity, accessoryLinear, accessoryCircular, accessoryCircularCapacity.
- `FORM_STYLES` — automatic (→ grouped), grouped, columns.
- `MENU_STYLES` — automatic, borderlessButton, button.
- `NAVIGATION_SPLIT_VIEW_STYLES` — automatic (→ balanced), balanced, prominentDetail.
- `TAB_VIEW_STYLES` — automatic (→ glass ornament), page, sidebarAdaptable, tabBarOnly, grouped.
- `WINDOW_STYLES` — automatic (→ glass plate), plain, volumetric.

### Spatial enums

- `IMMERSION_STYLES` — automatic, mixed, progressive, full.
- `HOVER_EFFECTS` — automatic, highlight, lift, none.
- `GESTURE_TYPES` — tap, longPress, drag, magnify, rotate, spatial.
- `WINDOW_RESIZABILITY` — automatic, contentSize, contentMinSize.
- `WORLD_SCALING_BEHAVIOR` — automatic (→ fixed for volumes), dynamic, fixed, trackingSurface.
- `VOLUME_BASEPLATE_VISIBILITY` — automatic, visible, hidden.
- `VOLUME_WORLD_ALIGNMENT` — adaptive (default, visionOS 2+), gravityAligned.
- `VOLUME_VIEWPOINTS` — all (default), front, frontBack.

### SF Symbols

`SF_SYMBOLS` exports a curated ~100-symbol map (name → `{ glyph, label }`)
covering the symbols the bundled templates use (Photos / News /
Shortcuts / Settings / Music / Smart Home / Mail / Files / Tab Bar).
`SYMBOL_RENDERING_MODES` — monochrome / hierarchical / palette /
multicolor. `SYMBOL_VARIANTS` — default / fill / circle / square / slash.

### Semantic colours (`SYSTEM_COLORS`)

Two palettes (light / dark) with 26 tokens each: primary, secondary,
tertiary, quaternary, systemBackground variants, systemFill variants,
twelve named system colours (Blue / Red / Green / Orange / Yellow /
Purple / Pink / Teal / Indigo / Mint / Cyan / Brown / Gray), three glass
tones, and three design tokens (`designWindow`, `designButton`,
`designButtonText`).

### Animation

- `ANIMATION_CURVES` — default, easeIn, easeOut, easeInOut, linear, spring, bouncy, snappy, smooth.
- `TRANSITION_TYPES` — opacity, slide, scale, move, push, identity.

### Text-input enums (TextField / SecureField)

- `KEYBOARD_TYPES` — default, asciiCapable, numbersAndPunctuation, URL, numberPad, phonePad, namePhonePad, emailAddress, decimalPad, twitter, webSearch.
- `TEXT_CONTENT_TYPES` — name, givenName, familyName, username, password, newPassword, oneTimeCode, emailAddress, telephoneNumber, URL, fullStreetAddress, postalCode, creditCardNumber.
- `SUBMIT_LABELS` — return, done, go, send, search, next, continue, join, route.
- `TEXT_AUTOCAPITALIZATION` — sentences (default), never, characters, words.
- `DATE_COMPONENTS` — date, hourAndMinute, dateAndTime, hourMinuteAndSecond.

### Ornaments

- `ORNAMENT_PLACEMENTS` — leading, trailing, top, bottom.
- `ORNAMENT_DEFAULTS` — leading/trailing `vstack 68×180 pt, pad 8, spacing 6`; top/bottom `hstack 320×56 pt, pad 10, spacing 12`.
- `ORNAMENT_GAP` — 20pt overlap between window edge and bottom ornament.

### Accessibility

`ACCESSIBILITY_TRAITS` — isButton, isHeader, isSelected, isLink,
isSearchField, isImage, isStaticText, playsSound, isKeyboardKey,
isSummaryElement, startsMediaSession, allowsDirectInteraction.

---

## How to update this file

1. **When you add a panel type:** add an entry under
   [Panels — alphabetical reference](#panels--alphabetical-reference)
   with defaults, inspector fields, and the canonical SwiftUI emit. Keep
   the table-of-contents in sync.
2. **When you change a default:** edit the affected default in place and
   bump the "Last updated" date at the top.
3. **When you add or remove an enum/constant in `appleSystem.js`:**
   reflect it under [Design tokens & enums](#design-tokens--enums).
4. **When you change inspector layout:** update the matching panel /
   stack section's inspector list — these are the cheat-sheets a future
   reader will consult before opening the file.
5. **When a feature lands behind a flag or partial wiring:** note it
   inline with `*(WIP)*` so the doc still reflects shipped reality.

This file is the maintainer's reference. User-visible behaviour lives in
[FEATURES.md](FEATURES.md); install / build / run instructions live in
[README.md](README.md).
