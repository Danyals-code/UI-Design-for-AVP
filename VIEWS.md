# Views Reference

Detailed map of every SwiftUI-flavoured "view" the designer can place on a
canvas, plus the design-system constants those views read from. This is the
internal source-of-truth doc: when something in the app changes, the answer
to "what changed and where" should live here.

The companion docs are [README.md](README.md) (run/build) and
[FEATURES.md](FEATURES.md) (user-visible surface area). This file is the
implementer's map - paths, defaults, emit patterns, and the path from the
inspector field to the SwiftUI export.

> **Last updated:** 2026-09-14 *(round-trip contract: one field per concept, frame emission driven by `frameMode`, and a parity harness that fails the build when the canvas and the exporter read different fields — see [AUDIT.md](AUDIT.md))*

---

## Table of contents

1. [How the scene graph fits together](#how-the-scene-graph-fits-together)
2. [Coordinate system & units](#coordinate-system--units)
3. [The round-trip contract](#the-round-trip-contract)
4. [Window](#window)
5. [Window-group tab bar (navigation capsule)](#window-group-tab-bar-navigation-capsule)
6. [Tab](#tab)
7. [Stack](#stack)
8. [Panels: alphabetical reference](#panels-alphabetical-reference)
9. [Entities (RealityKit)](#entities-realitykit)
10. [Design tokens & enums](#design-tokens--enums)
11. [How to update this file](#how-to-update-this-file)

---

## How the scene graph fits together

Every object lives in a single flat array, `state.items`, with parent
relationships expressed via `parentId`. See
[src/store/factories.js](src/store/factories.js) for the factories and
[src/store.js](src/store.js) for the store wiring.

```
Scene (DEFAULT_SCENE in factories.js)
└── Tab          (item.type = 'tab')        - top-level page
    └── Window  (item.type = 'window')      - flat plate or volumetric container
        ├── Stack   (item.type = 'stack')   - VStack / HStack / ZStack / Grid / Section / TabView / …
        │   ├── Panel  (item.type = 'panel')- text, button, slider, … (~55 types)
        │   ├── Stack  (nested)
        │   └── Entity (volume only)
        └── Stack (ornament - leading / trailing / top / bottom)
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
- **Y points UP** in scene space. SwiftUI's `.offset(y:)` points DOWN, so
  anything that round-trips a vertical offset flips sign at the boundary.
  `panel.position` and the `offset` modifier both do.

---

## The round-trip contract

Every view here is rendered twice: by `components/` onto the 3D canvas, and
by `export/` as SwiftUI. **The canvas is the specification** — the export has
to reproduce what the designer sees, not the other way round.

Two rules follow, and `src/parity.test.js` enforces both:

1. **One field per concept.** If the canvas reads one field and the exporter
   reads another, they will drift — and they did, until each pair collapsed
   onto the single field the exporter needs (the real SwiftUI spelling) with
   the canvas deriving its metrics from it. Adding a field that only one side
   reads fails the build unless it is declared in `src/parity.baseline.js`
   with a reason.
2. **Sizing comes from `frameMode`.** Each panel type declares how its frame
   is decided, and the exporter reads the same vocabulary the inspector does:

   | `frameMode` | Means | Export emits |
   | ----------- | ----- | ------------ |
   | `explicit` | `size` IS the authored box | `.frame(width:height:)` from `size` |
   | `figma` | Fit / Fixed / Fill picker | from `widthMode`/`heightMode`; `fit` hugs |
   | `none` | the type sizes itself | nothing (shapes emit their own; Button derives from `controlSize`) |

   The canonical copy lives in `panels/registry.js` (`panelFrameMode`) so the
   exporter can read it without importing the inspector's JSX;
   `registry.test.js` pins it against `PANEL_META.frameMode`.

Modifier order is part of the contract too. The canvas composes a container as
*content inset → box sized → box painted*, so the exporter emits
`.padding()` before `.frame()` before `.background()`. Reversing the first two
turns a 640pt box with inset content into a 688pt box.

3. **A modifier beats a stored field for the same concept.** Where both exist
   — `.foregroundStyle` vs `textColor`, `.navigationTitle` vs `navTitle`,
   `.hoverEffect` vs `panel.hoverEffect`, `.tint` vs the scene tint — the
   modifier wins on the canvas, because it is the spelling the exporter
   emits. This is rule 1 in the cases where collapsing to one field was not
   an option: the modifier stack and the inspector well are both legitimate
   ways to say it, so the canvas resolves the precedence rather than letting
   the two disagree.

   Every modifier that reaches the canvas does so through
   `summarizeModifiers()`, which reduces the ordered stack to a flat
   last-write-wins struct. A modifier whose `summarize()` writes nothing is
   invisible by construction — that was how `navigationTitle`,
   `toolbarBackground` and `layoutPriority` stayed inert while emitting
   correct Swift. `parity.test.js` runs every `summarize()` against a
   recording proxy and fails when nothing a renderer reads comes out.

   Two modifiers are declared invisible on purpose: `.fontDesign` and
   `.monospacedDigit` need a rounded / serif / monospaced face and the app
   bundles Inter alone, so there is nothing honest to draw.

Two modifiers change geometry rather than paint, so they live in the layout
engine and not the renderer: `.aspectRatio` reshapes a frame (applied once, in
`computeSize`) and `.layoutPriority` decides which flexible child receives a
stack's slack (applied by `layoutStack` and `resolvedChildSizes` from one
shared helper, so the two cannot disagree).

`AUDIT.md` tracks what still diverges, and `npm test` prints the open count.

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
| `material` | `'glass'` | Liquid Glass tier; see `MATERIALS` in [appleSystem.js](src/appleSystem.js). Default is `glass` (#b8b8b8 @ 25% with bg blur on). |
| `colorToken` / `color` | `null` / `null` | Per-window overrides - both null in the factory so the material's own `color` flows through. Setting either wins over the material. |
| `fillOpacity` | `null` | Per-window override; null = use `MATERIALS[material].opacity`. When blur is on, the value drives `transmission = 1 − fillOpacity` (lower opacity = clearer glass). |
| `blur` / `blurAmount` | `null` / `null` | Per-window override; null = use material defaults. `blurAmount` (pt) maps to `roughness = min(0.85, blurAmount/60)` on `meshPhysicalMaterial`. |
| `padding` | `14pt` | Inner content padding (matches visionOS reference layouts). |
| `windowStyle` | `'automatic'` | `'automatic'` \| `'plain'` \| `'volumetric'` - drives `.windowStyle()` on export. |
| `scrollable` | `false` | When true the canvas wires a wheel handler that drives `scrollY`, and the SwiftUI exporter wraps content in `ScrollView`. |
| `scrollY` | `0` (units) | Vertical scroll offset of the content sub-group. Only consulted when `scrollable` is true. Bounds-clamped to `[0, contentHeight − innerHeight]`. |
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

- **Window** - name, Group ID, Tab Icon, Primary (this/auto), Scrollable.
- **Frame** - size W/H, corner radius, padding, world position X/Y/Z.
- **Material** - glass tier, fill token, fallback hex.
- **Volume** *(only when `windowStyle === 'volumetric'`)* - depth, world scaling, baseplate, alignment, viewpoints.
- **Spatial** - immersion style, hover effect, resizability, gestures.
- **Ornaments** - toolbar wizard (top/bottom, leading/principal/trailing slots).
- **Environment** - font, foreground style, layout direction, locale.
- **Modifiers** - modifier stack.

### Export
`WindowGroup { … } .defaultSize(...) .windowStyle(...)` for a regular window;
`VolumetricWindowGroup { … }` when volumetric; `ImmersiveSpace { … }` when
the scene is immersive. See
[src/export/swiftui.js](src/export/swiftui.js).

---

## Window-group tab bar (navigation capsule)

A scene-level chrome element rendered by `WindowGroupTabBar3D` in
[src/components/SceneTree.jsx](src/components/SceneTree.jsx). Not a factory -
it has no item in `items[]`; the bar is derived live from the window
list every render. One pill per **unique `windowGroupId`** in the
active tab - windows that share an id collapse to a single pill (their
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
| `openWindow(id:)` action targeting an item whose `windowGroupId` matches the active group | The item is **appended** to the open set - visually it spawns to the right of the current row. |
| `openWindow(id:)` action targeting a different-group item | Active group switches; open set replaces with that one item. |

The renderer in `SceneTree` lays the open windows out as a single
horizontal row centred at the wearer's chest height (1.4m, 1m forward
on z) with **60pt gap** between plates. Editor mode is unchanged -
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
- Expanded width: **150pt** when hovered *in preview mode* - the
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
inspector (Object tab). No standalone bar inspector - the bar
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

- **Tab** - name, SF Symbol picker, ordering controls.

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
| `scrollable` | `false` | Wraps content in `ScrollView` on export; makes the stack's frame a scrolling viewport on the canvas. |
| `scrollY`, `scrollX` | `0`, `0` (units) | Live scroll offset of the content sub-group, clamped to the overflow. Preview state, not a document property — the exporter emits nothing for it. |
| `columns` | `2` | Grid columns. |
| `gridMode` | `'fixed'` | `'fixed'` \| `'adaptive'`. |
| `minColumnWidth` | `140pt` | Adaptive grid minimum. |
| `scrollAxis` | `'vertical'` | ScrollView axis. Read literally by both sides — an HStack marked scrollable with the default axis scrolls *vertically*, because that is what it exports. |
| `scrollShowsIndicators` | `true` | Shows the scroll thumb on the canvas and `showsIndicators:` on export. |
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

- **Stack** - name + kind picker (or **Navigation Split View** for split layouts).
- **Layout** - alignment, spacing, padding, per-type fields (Grid columns, ScrollView axis, …).
- **Size** - width/height mode (Fit / Fixed / Fill, pt values when Fixed).
- **Scroll** - Scrollable toggle, axis, indicators.
- **Section / Disclosure / Navigation / TabView / Tab / ToolbarItem** - only shown for the matching `stackType`.
- **Ornament** - anchor mode, edge, alignment, visibility, offset, background, material.
- **Environment** - font, foreground, direction, locale.
- **Modifiers** - modifier stack.

---

## Panels: alphabetical reference

Every panel type is registered in [src/panels/registry.js](src/panels/registry.js)
(`PANELS` object) and each has a matching `INSPECTORS[type]` entry in
[src/panels/inspectors.jsx](src/panels/inspectors.jsx). Sizes are in
**pt** unless noted; the renderer divides by `POINTS_PER_UNIT` to get
metres.

Per-type metadata in `PANEL_META` ([src/panels/inspectors.jsx](src/panels/inspectors.jsx)):
- `frameMode: 'figma'` - Fit / Fixed / Fill width picker (`text`, `link`).
  Clicking the picker rewrites `item.modifiers` with the matching
  `.fixedSize(horizontal: true)` (Fit), `.frame(width:)` (Fixed) or
  `.frame(maxWidth: .infinity)` (Fill) - there is no inline width field
  any more. See [`applyWidthMode`](src/components/PropertiesPanel/shared.jsx).
- `frameMode: 'explicit'` - manual W/H fields (default).
- `frameMode: 'none'` - no W/H controls. Used by `button` and `navbar`
  (driven by their own Size / fixed-height contracts), and by every
  shape / gradient (the unified ShapeInspector owns the Width + Height
  rows internally so the generic Object section stays out of the way).
- `lockHeight: true` - hide height (`list` - auto-derived from row count).
- `mergedIdentity: true` - the panel's own inspector renders the Name
  field, so PanelProps suppresses the generic "Object - X" header.
  Applies to: `text`, every shape (`rectangle`, `circle`, `capsule`,
  `ellipse`, `path`, `unevenRoundedRect`) and every gradient
  (`linearGradient`, `radialGradient`, `angularGradient`).

### Text & typography

#### `text`
- **Default:** size `null` (auto-size - width is driven by the
  modifier-stack entry the Fit/Fixed/Fill picker drops in), text
  `'Hello World'`, textStyle `body`, fontWeight `medium`, textAlign
  `left`. Color uses `color` / `colorToken` (Text is a pure foreground
  element, so no separate `textColor` field - that name is reserved
  for panels that also carry a background fill).
- **Frame mode:** figma (Fit / Fixed / Fill). The picker writes a
  `.fixedSize` or `.frame(...)` entry into the modifier stack rather
  than a hidden width field.
- **Measurement:** layout and renderer share `measureSwiftUIText` from
  [src/text.js](src/text.js) - the parent stack passes its known fixed
  width down so wrap height makes it back into intrinsic sizing. The
  full SwiftUI flow (tighten → scale → wrap → truncate, with UAX-14-ish
  word-boundary line breaks and character fallback for over-wide words)
  runs the same in both places, so reserved and rendered heights agree.
- **Inspector:** Text body (textarea) + Style / Weight / Color / Align.
  Text-display modifiers (`italic`, `underline`, `strikethrough`,
  `lineLimit`, `lineSpacing`, `tracking`, `kerning`, `baselineOffset`,
  `textCase`, `truncationMode`, `minimumScaleFactor`,
  `allowsTightening`, `multilineTextAlignment`, `fontDesign`,
  `monospacedDigit`) are added through the **Modifiers** section, not
  as panel-root fields - they appear in the same stack as every other
  modifier and emit in declaration order. The renderer reads them via
  `modSummary` so the canvas matches the export.
- **Emit:** `Text("...").font(.body).foregroundStyle(...)` plus
  `.multilineTextAlignment(.leading|.trailing)` when `textAlign` is
  non-center (`applyTextModifiers` in
  [src/export/swiftui.js](src/export/swiftui.js)); every other text
  modifier is emitted from the modifier stack by the generic
  `renderModifiers` walker.

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
- **Default:** `controlSize: 'regular'` (86×44), text `'Button'`, textStyle `body`, textColor `'designButtonText'`, color `'designButton'` (#b7b6b1), `buttonStyle: 'automatic'`, `buttonBorderShape: 'automatic'`, `buttonRole: 'none'`, `tapAction: null`.
- **Frame mode:** none. The frame comes from the `controlSize` preset plus the measured label (`computeButtonFramePt`), and the corner radius from `buttonBorderShape` (`buttonRadiusPt`). Neither `size` nor `cornerRadius` is stored — they were mirrors the canvas read while the exporter read `controlSize` / `buttonBorderShape`, and the two could disagree.
- **Side padding:** 12pt each side, fixed (renderer in [Panel3D.jsx](src/components/Panel3D.jsx) - see `textInset`).
- **Auto-grow width:** the rendered frame is `[max(presetWidth, textWidth + 24pt + symbolReserve), presetHeight]` - computed by `computeButtonFramePt` in [src/appleSystem.js](src/appleSystem.js) via `measureTextWidthPt` (canvas 2D, Inter font). Height stays at the preset; width grows past the preset whenever a longer label needs it, keeping the 12pt side padding and a single line. A leading SF Symbol reserves an extra `fontPt × 1.1 + 4pt` on the leading edge.
- **Size presets (`BUTTON_SIZES`):** small `65×32 / 15pt`, regular `86×44 / 17pt`, large `101×52 / 19pt`.
- **Shape presets (`BUTTON_SHAPES`):** capsule (`100pt` radius), roundedRectangle (`16pt` radius).
- **Inspector:** Size · Style · Role · Tint + Label sub-section (text body, weight, color, alignment). Width/height are intentionally NOT exposed - the frame tracks the Size preset and the label width.
- **Emit:** `Button(role: ...) { action } label: { Label/Text(...) }` with `.buttonStyle(...)` / `.buttonBorderShape(...)` / `.controlSize(...)` / `.tint(...)` chained only when non-default. SwiftUI's native Button auto-sizes to fit its label, so no `.frame()` is emitted - the canvas behaviour matches the device.

#### `toggle`
- **Default:** 280×36 (fill width), text `'Toggle'`, toggleOn `true`, color `'systemGreen'` (#30d158), `toggleStyle: 'automatic'` (→ `.switch` on visionOS).
- **Inspector:** Label, Value (On/Off segmented), Style, Size, Tint.
- **Emit:** `Toggle("...", isOn: .constant(true))` with style chained only when non-automatic.

#### `slider`
- **Default:** 280×60, sliderValue `0.5`, min `0`, max `1`, step `0`, optional min/max labels.
- **Inspector:** Value · Min · Max · Step + Min/Max labels.
- **Emit:** `Slider(value: .constant(0.5), in: 0...1)`.
- **Range:** `sliderValue` lives in `sliderMin…sliderMax`, not in `0…1`. The canvas maps it through `controlFraction` and drag-to-set writes back in that range, snapped to `sliderStep`. The value labels shrink the track the way SwiftUI's `minimumValueLabel:` / `maximumValueLabel:` slots do.

#### `stepper`
- **Default:** 280×36 (fill width), stepperValue `5`, min `0`, max `10`, step `1`, text `'Stepper'`.
- **Inspector:** Label, Value, Min, Max, Step.
- **Emit:** `Stepper("...", value: .constant(5), in: 0...10)`.
- **Range:** the ± buttons move by `stepperStep` and stop at `stepperMin` / `stepperMax`; the button that can no longer do anything dims, as it does on device.

#### `picker`
- **Default:** 260×36, text `'Selection'`, pickerOptions `['Option 1', 'Option 2', 'Option 3']`, pickerValue `'Option 1'`, `pickerStyle: 'automatic'` (→ `.menu` on visionOS).
- **Inspector:** Title, Options (textarea), Selected option, Style.
- **Emit:** `Picker("...", selection: .constant(...)) { Text("...").tag("...") }.pickerStyle(...)`.

#### `segmented`
- **Default:** `segmentedFrame(3)` = `280×44pt` (92pt per segment + 4pt edge inset, fixed 44pt pill), segments `['Day', 'Week', 'Month']`, selectedSegment `1`, material `'regular'`. Renders as a recessed glass well (the `material` tier) with a raised pill selection; the track itself has no fill colour.
- **Inspector:** one merged **Segmented** section - Name, Frame, segment Count, Items (comma-separated), Selected index, and a **Material** tier picker (`SEGMENT_MATERIALS`: Ultra Thin to Ultra Thick).
- **Emit:** `Picker("", selection: .constant("...")) { Text("...").tag("...") }.pickerStyle(.segmented).background(.<material>, in: Capsule())` - the material maps 1:1 to a SwiftUI `Material` value.

#### `datepicker`
- **Default:** 180×36, dateValue `'2026-04-16'`, `dateStyle: 'automatic'`, `displayedComponents: 'dateAndTime'`.
- **Inspector:** Date value, Style, Components (date / time / dateAndTime / time+seconds).
- **Emit:** `DatePicker("...", selection: .constant(Date()), displayedComponents: [...]).datePickerStyle(...)`.

#### `colorpicker`
- **Default:** 200×36, text `'Color'`, pickedColor `'#ff3b30'`, supportsOpacity `true`.
- **Inspector:** Label, Color, Supports opacity toggle.
- **Emit:** `ColorPicker("...", selection: .constant(...), supportsOpacity: true)`.

#### `gauge`
- **Default:** 140×80, value `70`, min `0`, max `100`, `gaugeStyle: 'automatic'`, optional min/max labels, optional tint gradient (`gaugeTintFrom`/`To`).
- **Inspector:** Value, Range, Style, Tint gradient, Labels.
- **Emit:** `Gauge(value: 70, in: 0...100) { ... } currentValueLabel: { ... }.gaugeStyle(...)`.
- **Range:** `value` sits in `gaugeMin…gaugeMax`, which defaults to `0…100` — so a gauge reading "70" holds `70`, not `0.7`. It was seeded `0.7` until phase 1.7, which looked right only because the canvas clamped every value to `0…1`. The `accessoryCircular` styles draw a dial rather than a bar, and a two-stop tint is sampled at the value's own position.

#### `progress`
- **Default:** 240×8, value `0.65`, total `1.0`, indeterminate `false`.
- **Inspector:** Value / Total / Indeterminate (Yes/No segmented).
- **Emit:** `ProgressView(value: 0.65, total: 1.0).progressViewStyle(...)`.
- **Range:** `value` is measured against `total`, not against 1. `.circular` draws a ring; `indeterminate` gets the position-unknown treatment, since the canvas is a still frame and a spinner is time-based.

> **Inputs group.** `textfield`, `securefield` and `search` share one
> "Input Type" variant switcher in the inspector (see
> `INPUT_VARIANTS` in [src/panels/inspectors.jsx](src/panels/inspectors.jsx))
> so the user can pivot between the three in place, the same way the
> Geometry picker swaps shapes. The Shift+A palette groups them under
> a dedicated **Inputs** category. In Preview mode a click on any
> field focuses it and renders a real DOM `<input>` via drei's
> `<Html>` overlay sized to the 3D field plate - `type="password"`
> for SecureField. Typing writes to `textfieldValue` /
> `securefieldValue` / `searchValue`; the canvas shows the live value
> in the primary text color, the visionOS-spec placeholder
> (`#545454`) when empty, or a row of `•` (`•`) glyphs for
> SecureField. Live values never reach `emit()` - exported Swift
> keeps `text: .constant("")` so the binding stays the user's job.

#### `search`
- **Default:** 305×44, color `'systemFill'`, cornerRadius `12pt`, text `'Search'` (placeholder), `searchValue: ''` (live preview), textStyle `body`, fontWeight `medium`, textColor `#545454`.
- **Inspector:** Input Type switcher + Placeholder.
- **Emit:** comment hint `// .searchable(text: $searchText, prompt: "...")` - designer attaches on parent.

#### `textfield`
- **Default:** 305×44, cornerRadius `12pt`, text `'Placeholder'`, textColor `#545454` (visionOS Labels/Secondary on glass - not the iOS `#8e8e93`), `textfieldValue: ''`, keyboardType `'default'`, textContentType `''`, submitLabel `'return'`, autocorrectionDisabled `false`, textInputAutocapitalization `'sentences'`, axis `'horizontal'`, lineLimit `1`.
- **Inspector:** Input Type switcher + Placeholder, Value, Keyboard type, Content type, Submit label, Autocapitalization, Autocorrection, Axis (h/v), Line limit.
- **Emit:** `TextField("placeholder", text: .constant(""))` with `, axis: .vertical` when applicable, then `.keyboardType(...)` / `.textContentType(...)` / `.submitLabel(...)` / `.autocorrectionDisabled(true)` / `.textInputAutocapitalization(...)` / `.lineLimit(...)` / `.textFieldStyle(...)` chained only when non-default.

#### `securefield`
- **Default:** 305×44, cornerRadius `16pt` (deliberately larger than TextField's 12pt - matches Apple's visionOS Figma kit), text `'Password'`, textColor `#545454`, `securefieldValue: ''`, `dotCount: 8` (visual fallback bullets when no live value), submitLabel `'done'`.
- **Inspector:** Input Type switcher + Placeholder, Dot count, Submit label.
- **Emit:** `SecureField("...", text: .constant(""))`.

#### `texteditor`
- **Default:** 300×160, text `'Type here…'`, lineCount `5`.
- **Inspector:** Body text, Line count.
- **Emit:** `TextEditor(text: .constant("..."))`.

### Collections

#### `list`
- **Default:** 360pt wide (height auto-derived from row count × row metric), 4 rows, `listStyle: 'insetGrouped'`.
- **Frame mode:** explicit + `lockHeight: true`.
- **Row metrics:** driven by `LIST_STYLES[listStyle]` - rowH / pad / inset / gap / roundedRows / showSeparators / showGroupCard.
- **Inspector:** Style (default / plain / inset / insetGrouped / grouped / sidebar - visionOS does not ship `.bordered` / `.carousel` / `.elliptical`) + per-row separator/tint/background/spacing controls, header prominence, row list (title + subtitle).
- **Emit:** `List { Text(...) } .listStyle(...) .listRowSeparator(...) .listRowBackground(...) .headerProminence(...)`.

#### `table`
- **Default:** 440×260, columns `['Name', 'Status', 'Type']`, rows `[['Alpha','Active','A'], ['Bravo','Pending','B'], ['Charlie','Complete','A'], ['Delta','Active','C']]`, `tableStyle: 'automatic'`.
- **Inspector:** Style, Columns (comma), Rows.
- **Emit:** `Table { TableColumn("Name") { _ in Text("") } }`.

#### `menu`
- **Default:** 220×192, text `'Menu'`, menuItems `['Cut', 'Copy', 'Paste', 'Duplicate', 'Select All']`, material `'thick'`, `menuStyle: 'automatic'`, `menuOrder: 'automatic'`, `menuIndicator: 'automatic'`.
- **Inspector:** Title, Items (textarea), Style, Order, Indicator.
- **Emit:** `Menu("...") { Button("...") { } } .menuStyle(...) .menuOrder(...) .menuIndicator(...)`.

#### `form`
- **Default:** 360×300, color `secondarySystemBackground`, rows `[3]`, `formStyle: 'automatic'`.
- **Inspector:** Style picker (variant switch with list / form / groupbox).
- **Emit:** `Form { Text(...).frame(minHeight: rowHeight) } .formStyle(...)`.
- **Canvas:** `.automatic` / `.grouped` draw the inset card with hairline separators, title leading and value (`subtitle`) trailing; `.columns` draws the two-column layout, labels trailing-aligned in a leading gutter. Rows are laid out at `rowHeight`, which the export carries as `minHeight` — a Form row grows for its content, so the authored number is a floor.

#### `groupbox`
- **Default:** 300×160, text `'Settings'`, textStyle `headline`, `groupBoxStyle: 'automatic'`.
- **Inspector:** Label, Style.
- **Emit:** `GroupBox("...") { Text(...) } .groupBoxStyle(...)`.

#### `outlinegroup`
- **Default:** 320×240, rows = nested tree with `indent` + `expanded`.
- **Inspector:** Title + rows tree.
- **Emit:** Generates an `OutlineNode` struct + `OutlineGroup` with recursive children, each row carrying `.frame(minHeight: rowHeight)`.
- **Canvas:** the disclosure tree, indented by `indent`, with a chevron on rows that have children. A collapsed row hides its whole subtree, not just its immediate children - see `outlineVisibleRows()` in `appleSystem.js`, which reads `indent` by the same rule the emitter uses to rebuild the tree. `expanded` is a preview affordance rather than a document property: SwiftUI's OutlineGroup owns its expansion state at runtime, so the export carries the tree and not which parts of it happen to be open.

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

### Shapes & Gradients

> All shape and gradient panel types share one unified
> **ShapeInspector** ([src/panels/inspectors.jsx](src/panels/inspectors.jsx))
> rather than per-type sections. The inspector renders one consolidated
> block: Name + Geometry switcher (primary control - pick from
> rectangle / circle / capsule / ellipse / path / unevenRoundedRect /
> the three gradients) + Width + Height + a Stroke row (color + width
> on every shape, suppressed for gradients), plus geometry-specific
> rows:
>
> - `cornerRadius` is only shown for **Rectangle** (single radius) and
>   **UnevenRoundedRectangle** (four per-corner radii:
>   `topLeadingRadius`, `topTrailingRadius`, `bottomLeadingRadius`,
>   `bottomTrailingRadius`). Circle / Capsule / Ellipse / Path render
>   with their natural geometry; no radius field.
> - Gradients expose From / To color stops; LinearGradient also exposes
>   Angle. Real `LinearGradient` / `RadialGradient` / `AngularGradient`
>   textures are baked through a CanvasTexture helper in
>   [src/components/Panel3D.jsx](src/components/Panel3D.jsx) so the
>   canvas shows the actual gradient - not a placeholder fill.
> - Stroke is rendered as a slightly-larger backing layer in
>   `strokeColor` behind the fill (canvas side) and as
>   `.overlay(<Shape>().stroke(_, lineWidth:))` on emit.
>
> All shapes & gradients carry `PANEL_META = { frameMode: 'none',
> mergedIdentity: true }` - the generic Object section is suppressed
> because ShapeInspector owns the Width/Height rows itself.

#### `rectangle`
- **Default:** 200×140, color `'systemBlue'`, cornerRadius `12pt`, stroke disabled.
- **Emit:** `Rectangle().fill(...).frame(...)` (`.clipShape(RoundedRectangle)` when radius > 0, `.overlay(...stroke...)` when stroke is set).

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

These panels never render in the parent's child list - they attach to the
parent as `.sheet(…)` / `.popover(…)` / `.alert(…)` /
`.confirmationDialog(…)` / `.inspector(…)` modifiers, and the canvas presents
them over the window rather than flowing them inside it.

The set lives in `appleSystem.js` (`isPresentationPanel`) and is imported by
the canvas, the exporter and the modifier registry alike. It used to be
hand-maintained in each: the canvas knew about three types and the exporter
about five, so a `confirmationdialog` or an `inspector` was laid out as an
ordinary child on screen and presented modally in the code - the wrong
*place*, not merely the wrong pixels. `parity.test.js` now fails if any side
stops consulting the shared set or starts keeping its own copy.

They are not all presented the same way, so the canvas does not place them the
same way: **modals** (sheet, alert, confirmationdialog) sit centred over a
dimmed plate; a **popover** hangs off the edge its `popoverArrowEdge` points
from, with an arrow drawn there (narrower for a `point` anchor); an
**inspector** is a trailing column with a divider and no dimming, because it
is not modal - and it narrows the body the modals centre in, the way a real
split view does.

#### `sheet`
- **Default:** 600×400, `sheetDetent: 'large'`, `sheetFraction: 0.7`, material `'regular'`, optional `presentationDragIndicator`, `presentationCornerRadius`, `interactiveDismissDisabled`.
- **Emit:** Attached as `.sheet(isPresented: ...) { … }` on the parent view.

#### `popover`
- **Default:** 260×180, color `'systemBackground'`, material `'thick'`, `popoverAnchor: 'rectBounds'`, `popoverArrowEdge: 'automatic'`.
- **Emit:** `.popover(isPresented: ..., attachmentAnchor: ..., arrowEdge: ...) { … }` - both arguments elided at their defaults.
- **Canvas:** anchored to the named arrow edge with an arrow drawn there; `automatic` centres it. A `point` anchor draws the narrower arrow. visionOS ignores `arrowEdge`, but the same document targets iPadOS and macOS, where it is the difference between a menu above the button and below it.

#### `alert`
- **Default:** 300×180, text `'Alert Title'`, `alertMessage: 'Are you sure?'`, `alertButtons: ['Cancel', 'OK']`, `dialogSeverity: 'automatic'`, `dialogIcon: ''`.
- **Canvas:** `dialogIcon` draws a glyph above the title, tinted red when `dialogSeverity` is `critical`.
- **Auto-roles:** Buttons named `'Cancel' / 'Delete' / 'Remove'` get `.cancel` / `.destructive` automatically.
- **Emit:** `.alert("...", isPresented: ...) { Button(...) { } } message: { Text(...) }`.

#### `confirmationdialog`
- **Default:** 300×180, text `'Are you sure?'`, `alertButtons: ['Delete', 'Cancel']`, `titleVisibility: 'automatic'`.
- **Emit:** `.confirmationDialog("...", isPresented: ..., titleVisibility: ...) { Button(role: .destructive, ...) }`.
- **Canvas:** shares the alert's renderer - title, message, roled buttons - because SwiftUI presents the two the same way. `titleVisibility` is honoured, including `.automatic`'s rule that the title shows only when there is a message to caption it.

#### `inspector`
- **Default:** 320×480, text `'Inspector content'`, material `'regular'`, width metrics (`inspectorColumnWidth`, min/ideal/max - all `null` = system default).
- **Emit:** `.inspector(isPresented: ...) { … }.inspectorColumnWidth(min:..., ideal:..., max:...)`.
- **Canvas:** a trailing column at the width `inspectorColumnWidth()` (`appleSystem.js`) resolves, mirroring the exporter's precedence - an exact width wins outright, otherwise the ideal (falling back to the stored frame) is clamped between min and max, and the result still has to fit the window it splits.

### Navigation & misc

#### `navbar`
- **Default:** 600pt wide × `NAVBAR_HEIGHT_PT` (92pt) tall, `widthMode: 'fill'` (always tracks parent inner width), `heightMode: 'fixed'`, transparent (sits over the parent's glass), cornerRadius `0`, `navbarStyle: 'trailingButtons'`, title `'Title'`, leadingButtons `[{ symbolName: 'list.bullet' }]`, trailingButtons `[{ symbolName: 'magnifyingglass' }, { symbolName: 'ellipsis' }]`.
- **PANEL_META:** `frameMode: 'none'` - width is parent-driven, height locked at 92pt by spec. The inspector exposes Style / Title / Leading + Trailing button arrays only.
- **Inspector:** Style picker (six fixed styles from `NAVBAR_STYLE_SPECS` in [appleSystem.js](src/appleSystem.js)), title, per-button rows (symbol + label + tapAction picker mirroring the Button action schema).
- **Emit:** comment placeholder (`// NavigationBar (style) - title: "..."` + `// TODO: map to .toolbar { ... } modifier on the parent window`) - there's no 1:1 SwiftUI primitive yet.

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

## Escape hatch

One view type exists to have no SwiftUI equivalent: it is whatever the
designer types. Every other entry in this document models a specific Apple
API, which means the set of buildable views is exactly the set catalogued
here. `custom` removes that ceiling — a view we have not modelled, a helper
the user already wrote, or an API newer than this file can all be placed in
the tree today.

| Type | Default frame | Key fields | Emit |
| --- | --- | --- | --- |
| `custom` | 240×80 | `code` (Swift source), `label` (placeholder caption) | the contents of `code`, verbatim, one line per line |

- **Defaults:** `code: 'Text("Hello from raw Swift")'`, `label: 'Custom Swift'`,
  fill `#2a2f3a`, corner radius 12pt.
- **Emit:** each line of `code` is pushed at the current indentation, so the
  fragment's own internal indentation nests correctly inside the generated
  view. Line endings are normalised, so a fragment pasted from a Windows
  editor does not carry `
` into the Swift file. An empty `code` emits
  `EmptyView()` rather than nothing — the node occupies a slot in a result
  builder, and emitting nothing there would silently change the parent's
  layout.
- **Canvas:** a labelled placeholder at the node's frame, captioned with
  `label` and the first non-blank line of `code`. It is deliberately not a
  preview: rendering arbitrary Swift is not something this app can do, and a
  box that pretended otherwise would be worse than one that says so.
- **Validation:** `code` is checked by
  [src/export/swiftValidate.js](src/export/swiftValidate.js) for balanced
  brackets and string literals that close on the line they open — the same
  two structural properties the export test suite pins for generated code.
  Failures are a non-blocking inline warning, since a fragment that does not
  balance *yet* is a normal mid-edit state.

There is a matching modifier, `customModifier` (`.custom` in the Add Modifier
dropdown), which appends an arbitrary chain entry to any view that shows the
modifier section. It applies to every such view rather than a curated list:
the strict allow-list exists to stop the inspector offering a modifier SwiftUI
would reject, and here the user is asserting they know what they are attaching.

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
| `world` | `.world(transform: matrix_identity_float4x4)` | - |
| `head` | `.head` | - |
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
read-only - components consume it but never mutate it.

### Typography - `TEXT_STYLES`

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

- **`WINDOW_PRESETS`** - Regular **1200×800** (default), Wide 1280×720, Tall 720×1080, Compact 640×480, Square 720×720.
- **`VOLUME_PRESETS`** - Small `544×408×544 pt` ≈ `0.4×0.3×0.4 m`, Medium `816×544×816 pt` ≈ `0.6×0.4×0.6 m` (Apple default), Large `1224×816×1224 pt` ≈ `0.9×0.6×0.9 m`.
- **`WINDOW_CORNER_RADIUS`** - 30pt (visionOS Figma kit).
- **`WINDOW_PADDING`** - 14pt inner inset.
- **`SPLIT_SEPARATED_WIDTH`** / **`SPLIT_SEPARATED_RADIUS`** - 320pt / 30pt.

### Button presets

- **`BUTTON_SIZES`** - small `65×32` (15pt text), regular `86×44` (17pt), large `101×52` (19pt).
- **`BUTTON_SHAPES`** - capsule (`radiusPt: 100`), roundedRectangle (`radiusPt: 16`).
- **`BUTTON_TEXT_INSET_PT`** - 12pt fixed side padding inside every button.
- **`BUTTON_STYLES`** - automatic, plain, borderless, bordered, borderedProminent, glass, glassProminent, destructive.
- **`BUTTON_BORDER_SHAPES`** - automatic, capsule, circle, roundedRectangle.

### Materials (Liquid Glass tiers - `MATERIALS`)

Each entry in `MATERIALS` carries the full property set the renderer
consumes. Per-scene overrides (colour, opacity, gradient, stacked
`layers`, blur, inner/drop shadow) land in `scene.materialProps[key]`,
edited from Scene's Materials & Colors panel.
`resolveMaterial(key, scene.materialProps)` (in
[appleSystem.js](src/appleSystem.js)) returns the merged config that
both the window plate and stack backgrounds read.

| Field | Type | Notes |
| --- | --- | --- |
| `label` | string | Display name in the picker. |
| `fillType` | `'solid'` \| `'gradient'` | Solid uses `color`; gradient bakes a CanvasTexture from `gradientFrom` → `gradientTo` at `gradientAngle`° and samples it across the plate. |
| `color` | hex | Base fill tint (solid mode). |
| `gradientFrom` / `gradientTo` / `gradientAngle` | hex / hex / deg | Stops + SwiftUI-style angle (0° = top→bottom). |
| `opacity` | 0..1 | Base alpha when blur is off. When blur is on, drives `transmission = max(0.05, 1 − opacity)`. |
| `blur` | bool | Toggles the visionOS frosted-glass look - see Backdrop blur below. |
| `blurAmount` | pt (0..40) | Drives `roughness = min(0.85, blurAmount/60)` on the transmission material. |
| `innerShadow` | `{offsetX, offsetY, blur, color, opacity}` \| `null` | Drawn as a rim overlay inside the plate. Off by default. |
| `dropShadow` | `{offsetX, offsetY, blur, color, opacity}` \| `null` | Drawn as a slightly-inflated rounded rect behind the plate. Off by default. |
| `layers` | `[{color, opacity}, …]` \| undefined | Stacked translucent colour passes painted over the base fill (bottom-up). User-editable per scene from the material editor's Layers group. `viewsRegular` ships two by default: `#D6D6D6 @ 45%` + `#000000 @ 8%`. |

#### Tier defaults

| Key | label | color | opacity | blur | blurAmt | layers |
| --- | --- | --- | --- | --- | --- | --- |
| **`glass`** *(window default)* | Glass | `#b8b8b8` | 0.25 | **on** | 40 | - |
| `viewsRegular` | Views Regular | `#D6D6D6` | 0.45 | off | 12 | D6D6D6@45% + #000000@8% |
| `ultraThin` | Ultra Thin | `#ffffff` | 0.42 | on | 30 | - |
| `thin` | Thin | `#ffffff` | 0.55 | on | 20 | - |
| `regular` | Regular | `#ffffff` | 0.72 | on | 16 | - |
| `thick` | Thick | `#ffffff` | 0.88 | on | 12 | - |
| `ultraThick` | Ultra Thick | `#ffffff` | 0.96 | on | 8 | - |
| `opaque` | Opaque | `#ffffff` | 1.00 | off | 0 | - |
| `bar` | Bar | `#ffffff` | 0.62 | on | 18 | - |

`MATERIAL_ORDER` lists keys in picker order. Every tier defaults to
`fillType: 'solid'`, `innerShadow: null`, `dropShadow: null`.

#### Backdrop blur (real, GPU-side)

When `material.blur` is true the window plate uses three.js's built-in
`meshPhysicalMaterial` with `transmission`, `roughness`, `thickness`,
`ior=1.5`. The renderer copies the scene into a shared transmission
framebuffer once per frame and the plate samples it via mipmaps driven
by `roughness` - the higher the blur amount, the coarser the mip and
the softer the backdrop. `Canvas3D.onCreated` sets
`gl.transmissionResolutionScale = 1.0` so the framebuffer matches
canvas resolution and the blur stays stable on camera movement.
Earlier attempts using drei's `MeshTransmissionMaterial` were
abandoned - per-instance render targets fought our `localClippingEnabled`
setup and caused GL-context loss.

#### Plate stroke

Every window plate carries a **3pt linear-gradient stroke** built from
`rimRingShape` (outer rounded rect minus inset inner ring). The texture
is a 45° diagonal sweep - `#ffffff @ 40%` → `0%` (41% stop) → `0%`
(57% stop) → `#ffffff @ 10%` - giving a bright top-left wash and a
soft bottom-right highlight. Cached once at module level
(`getStrokeGradientTexture` in [SceneTree.jsx](src/components/SceneTree.jsx))
and reused across every window.

#### Content clipping + scroll

Window content lives inside a `<group ref={contentClipRef}>` and the
renderer attaches four world-space `THREE.Plane` clip planes - anchored
to the window's bounds every frame - to every descendant material. The
renderer has `localClippingEnabled: true` (`Canvas3D.jsx`). Result:
text, panels, gradients can never leak past the plate edges. When
`scrollable` is true a wheel handler on the inner group updates
`scrollY` (clamped to the content overflow); the group translates by
`scrollY` while the clip planes stay pinned, so off-bounds content is
discarded.

A **scrollable stack** does the same thing one level down, and the two
compose. `scrollAxesOf` (`layout.js`) decides which stacks scroll, and
mirrors the exporter exactly: the `scrollView` TYPE always, any other
plain stack on the `scrollable` FLAG, and never the containers that
return early in `renderStack` (toolbars, NavigationSplitView, Tab,
Section, DisclosureGroup). `layoutStack` anchors a scroller's content to
the leading edge of its axis rather than centring it, because a
ScrollView's content is taller than its box by definition. Clip rects
**compose rather than replace**: `ClipContext` passes an ancestor's
planes down, each clipper concatenates its own and assigns the
combination across its subtree, and marks its group `userData.ownsClip`
so the ancestor's walk stops at that boundary. Padding rides with the
scrolling content and the frame sizes the viewport — the same split the
exporter uses.

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

- `TOGGLE_STYLES` - automatic (→ switch on visionOS), switch, button.
- `PICKER_STYLES` - automatic (→ menu), menu, segmented, wheel, inline, palette, navigationLink.
- `LABEL_STYLES` - automatic, titleAndIcon, iconOnly, titleOnly.
- `TEXTFIELD_STYLES` - automatic (→ recessed glass), plain, roundedBorder.
- `CONTROL_SIZES` - mini, small, regular, large, extraLarge.
- `TABLE_STYLES` - automatic, inset.
- `DATE_PICKER_STYLES` - automatic (→ compact), compact, graphical, wheel.
- `PROGRESS_VIEW_STYLES` - automatic, linear, circular.
- `GAUGE_STYLES` - automatic (→ linearCapacity), linearCapacity, accessoryLinearCapacity, accessoryLinear, accessoryCircular, accessoryCircularCapacity.
- `FORM_STYLES` - automatic (→ grouped), grouped, columns.
- `MENU_STYLES` - automatic, borderlessButton, button.
- `NAVIGATION_SPLIT_VIEW_STYLES` - automatic (→ balanced), balanced, prominentDetail.
- `TAB_VIEW_STYLES` - automatic (→ glass ornament), page, sidebarAdaptable, tabBarOnly, grouped.
- `WINDOW_STYLES` - automatic (→ glass plate), plain, volumetric.

### Spatial enums

- `IMMERSION_STYLES` - automatic, mixed, progressive, full.
- `HOVER_EFFECTS` - automatic, highlight, lift, none.
- `GESTURE_TYPES` - tap, longPress, drag, magnify, rotate, spatial.
- `WINDOW_RESIZABILITY` - automatic, contentSize, contentMinSize.
- `WORLD_SCALING_BEHAVIOR` - automatic (→ fixed for volumes), dynamic, fixed, trackingSurface.
- `VOLUME_BASEPLATE_VISIBILITY` - automatic, visible, hidden.
- `VOLUME_WORLD_ALIGNMENT` - adaptive (default, visionOS 2+), gravityAligned.
- `VOLUME_VIEWPOINTS` - all (default), front, frontBack.

### SF Symbols (rendered via Lucide)

`SF_SYMBOLS` exports a curated ~380-name map (name → `{ glyph, label }`)
covering the symbols the bundled templates use, plus broad coverage of
the visionOS / iOS 17 catalogue (files, status, media controls,
weather, health, smart home, transport, awards, reactions, tools, etc).
The `glyph` field is a legacy Unicode codepoint kept only for older
DOM call sites - every modern call site renders the SF Symbol as a
**Lucide icon** via the `SF_TO_LUCIDE` map in
[src/components/icons.jsx](src/components/icons.jsx).

| Component | Where it lives | Used by |
| --- | --- | --- |
| `SymbolIcon` (DOM) | [icons.jsx](src/components/icons.jsx) | LayersPanel rows, IconPickerPopover, SymbolPicker grid, inspector previews |
| `SymbolIcon3D` (canvas) | [SymbolIcon3D.jsx](src/components/SymbolIcon3D.jsx) | Panel3D label/button/list-row icons, SceneTree tab + window-group pills, Entity3D attachment symbols |

Both honour SwiftUI symbol traits:

- **`weight`** → `strokeWidth` via `SYMBOL_WEIGHT_STROKES`
  (ultraLight 0.75 … black 2.75; regular = 1.5)
- **`imageScale`** → size multiplier via `SYMBOL_IMAGE_SCALES`
  (small 0.84, medium 1.0, large 1.2)
- **`variant`** (`.fill` / `.circle` / `.square` / `.slash`) → resolved
  by `resolveSymbolName(name, variant)` which tries `${name}.${variant}`
  in the map and falls back to the base name when the variant isn't in
  the catalogue.
- **`renderingMode`** (`monochrome` / `hierarchical` / `palette` /
  `multicolor`) → `symbolModeStyling(mode, color, secondaryColor)`
  applies the matching tint/opacity/strokeBoost.

`SymbolIcon3D` rasterises the Lucide SVG to a `CanvasTexture` once per
`(name, color, weight, pixelSize)` key (cached at module level) and
paints it onto a planeGeometry sized in scene units. `SYMBOL_RENDERING_MODES`,
`SYMBOL_VARIANTS` still live in [appleSystem.js](src/appleSystem.js)
for the inspector dropdowns.

### Semantic colours (`SYSTEM_COLORS`)

Two palettes (light / dark) with 26 tokens each: primary, secondary,
tertiary, quaternary, systemBackground variants, systemFill variants,
twelve named system colours (Blue / Red / Green / Orange / Yellow /
Purple / Pink / Teal / Indigo / Mint / Cyan / Brown / Gray), three glass
tones, and three design tokens (`designWindow`, `designButton`,
`designButtonText`).

### Animation

- `ANIMATION_CURVES` - default, easeIn, easeOut, easeInOut, linear, spring, bouncy, snappy, smooth.
- `TRANSITION_TYPES` - opacity, slide, scale, move, push, identity.

### Text-input enums (TextField / SecureField)

- `KEYBOARD_TYPES` - default, asciiCapable, numbersAndPunctuation, URL, numberPad, phonePad, namePhonePad, emailAddress, decimalPad, twitter, webSearch.
- `TEXT_CONTENT_TYPES` - name, givenName, familyName, username, password, newPassword, oneTimeCode, emailAddress, telephoneNumber, URL, fullStreetAddress, postalCode, creditCardNumber.
- `SUBMIT_LABELS` - return, done, go, send, search, next, continue, join, route.
- `TEXT_AUTOCAPITALIZATION` - sentences (default), never, characters, words.
- `DATE_COMPONENTS` - date, hourAndMinute, dateAndTime, hourMinuteAndSecond.

### Ornaments

- `ORNAMENT_PLACEMENTS` - leading, trailing, top, bottom.
- `ORNAMENT_DEFAULTS` - leading/trailing `vstack 68×180 pt, pad 8, spacing 6`; top/bottom `hstack 320×56 pt, pad 10, spacing 12`.
- `ORNAMENT_GAP` - 20pt overlap between window edge and bottom ornament.

### Accessibility

`ACCESSIBILITY_TRAITS` - isButton, isHeader, isSelected, isLink,
isSearchField, isImage, isStaticText, playsSound, isKeyboardKey,
isSummaryElement, startsMediaSession, allowsDirectInteraction.

### Modifier registry highlights

Full catalogue in [src/modifiers/registry.js](src/modifiers/registry.js).
Notable entries the inspector and exporter depend on:

- **`frame`** - defaults `{ width: null, height: null, minWidth: null,
  minHeight: null, maxWidth: false, maxHeight: false, alignment:
  'center' }`. `maxWidth`/`maxHeight` use `true` as a sentinel for
  `.infinity`; a number is a finite cap. Emits the corresponding
  `.frame(width: …, maxWidth: .infinity, …)` chain. This is what the
  Fit/Fixed/Fill picker on text/link writes into the modifier stack.
- **`fixedSize`** - defaults `{ horizontal: true, vertical: true }`.
  The Fit width-mode drops a `{ horizontal: true, vertical: false }`
  entry so a Text view hugs its single-line intrinsic width.
- **Text-display family** (`group: 'Text'`, accept on textual views -
  `text`, `link`, `button`, `label`, `ticker`, `slideshow`, `text3d`):
  `italic`, `underline`, `strikethrough`, `textCase`, `lineLimit`,
  `lineSpacing`, `tracking`, `kerning`, `baselineOffset`,
  `truncationMode`, `minimumScaleFactor`, `allowsTightening`,
  `multilineTextAlignment`, `fontDesign`, `monospacedDigit`. These
  mirror the on-panel Text fields one-for-one so authors can either
  set them inline on a Text panel or stack them as reusable modifiers
  on any textual view.

---

## How to update this file

1. **When you add a panel type:** add an entry under
   [Panels: alphabetical reference](#panels-alphabetical-reference)
   with defaults, inspector fields, and the canonical SwiftUI emit. Keep
   the table-of-contents in sync.
2. **When you change a default:** edit the affected default in place and
   bump the "Last updated" date at the top.
3. **When you add or remove an enum/constant in `appleSystem.js`:**
   reflect it under [Design tokens & enums](#design-tokens--enums).
4. **When you change inspector layout:** update the matching panel /
   stack section's inspector list - these are the cheat-sheets a future
   reader will consult before opening the file.
5. **When a feature lands behind a flag or partial wiring:** note it
   inline with `*(WIP)*` so the doc still reflects shipped reality.
6. **When you add a field to any item:** wire it into BOTH the canvas and
   the exporter, or declare it in `src/parity.baseline.js` with a reason.
   `src/parity.test.js` fails the build otherwise — see
   [The round-trip contract](#the-round-trip-contract).

This file is the maintainer's reference. User-visible behaviour lives in
[FEATURES.md](FEATURES.md); install / build / run instructions live in
[README.md](README.md).
