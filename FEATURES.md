# Features

Living catalog of everything this app can do today. Treat this as the
authoritative reference - when a feature is added, removed, or changed,
update this file in the same commit so it never drifts from reality.

Three docs at the repo root work together:

- [README.md](README.md) - install / run / build (getting started).
- **[FEATURES.md](FEATURES.md)** *(this file)* - user-visible surface.
- [VIEWS.md](VIEWS.md) - maintainer reference: every panel/stack/window
  factory, with defaults and SwiftUI emit patterns. The "what does this
  view *do* and what are its defaults" map. Update whenever you add or
  change a view type, default, or design-system constant.

> **Last updated:** 2026-05-30 *(Materials & Colors overhaul: clickable material browser, picker dropdown that follows the canvas selection, stacked colour layers in the material editor; SwiftUI-style segmented control with a Material tier picker)*

---

## Table of contents

1. [App at a glance](#app-at-a-glance)
2. [Workspace chrome](#workspace-chrome)
3. [Scene modes](#scene-modes)
4. [3D viewport](#3d-viewport)
5. [Layer hierarchy](#layer-hierarchy)
6. [Templates](#templates)
7. [Properties Inspector](#properties-inspector)
8. [Assets panel](#assets-panel)
9. [Behaviors](#behaviors)
10. [Modifier stack](#modifier-stack)
11. [Preview mode](#preview-mode)
12. [Export](#export)
13. [Keyboard shortcuts](#keyboard-shortcuts)
14. [How to update this document](#how-to-update-this-document)

---

## App at a glance

A standalone web app for designing visionOS-style interfaces. The user
drags tabs/windows/stacks/controls onto a 3D canvas, tweaks them in an
inspector, previews inside a simulated living-room studio, and exports
SwiftUI code.

- **Stack:** React 18, Vite 5, Tailwind CSS, Three.js via
  `@react-three/fiber` + `drei`, Zustand for state, postprocessing for
  bloom.
- **Runtime model:** flat `items[]` in the store, each item carries a
  `parentId`. Layout is computed from the tree every render
  ([src/layout.js](src/layout.js)).
- **Design tokens:** all visionOS-flavoured constants - text styles,
  glass tokens, SF Symbol map, window/volume presets - live in
  [src/appleSystem.js](src/appleSystem.js).

---

## Workspace chrome

Three columns plus a topbar and bottom-anchored controls.

### Topbar
- App title `visionOS Designer` - click to reopen the Splash.
- Tab strip showing every tab in the active scene; click to switch.
- Tab indicator + "+" new-tab button.

### Left column
- **Layers panel** (top half)
  - Searchable tree (magnifier icon) - type to filter by item name; Esc
    clears.
  - Buttons: new tab, new window, new stack, plus the Add (`⇧A`)
    dropdown for every other type.
  - Drag rows to reparent / reorder (cross-stack reorder supported).
  - Eye / lock icons per row, delete on hover.
  - Active-tab highlight + active-page indicator dot.
- **Assets panel** (bottom half, vertically resizable)
  - Searchable (magnifier icon mirrors LayersPanel pattern).
  - Drag-drop or import button for `.usdz` / `.glb` / `.gltf` / `.obj`
    / images.
  - `+` new folder button.
  - Built-in `Templates` virtual folder with Window / Volume subtrees.
  - Drag an asset onto the canvas to spawn a model entity.

### Right column - Properties Inspector
Two-tab strip: **Object** (the selected item) / **Scene** (global).
Details in [Properties Inspector](#properties-inspector).

### Floating viewport controls (top-right)
| Control            | Behaviour                                              |
| ------------------ | ------------------------------------------------------ |
| Flat View          | Window-mode only. Drops to flat head-on view of plate. |
| VR View            | Snaps camera to wearer's default eye-line pose.        |
| Camera Entity      | Visible when a Camera entity exists; snaps to its POV. |
| Zoom slider        | 30%-500%. Double-click to reset.                       |
| Overlays popover   | Studio (Demo Scene), Grid (X/Y/Z), Axes Gizmo, Scene Info. |
| Window / Volume    | Scene-mode toggle. Confirms before discarding work.    |

### Bottom-centre Preview
Pill button: enters Preview Mode (canvas runs as if it were the live
app). In preview, a Reset Camera pill + Exit pill replace it.

### Resizers
- Vertical splitter between Layers and Assets (percentage-based, scales
  with viewport).
- Left + right gutter drags for the side panels (200-520 px).

---

## Scene modes

| Mode    | Plate                          | Camera default                  | Notes                                                                 |
| ------- | ------------------------------ | ------------------------------- | --------------------------------------------------------------------- |
| Window  | Translucent glass plate        | Wearer's VR view (preview3D on) | Flat View button drops to head-on plate. Demo studio renders by default. |
| Volume  | Volumetric container, transparent baseplate | VR view at `(0, 1.2, 1.5)` looking at `(0, 1.2, 0)` | Always 3D. Models / attachments / RealityKit primitives live here.    |
| Immersive | Full-room metadata only      | n/a                             | Exports as `ImmersiveSpace` - set via Scene tab → Immersive Space.    |

- Switching modes from the viewport reseeds the scene; the destructive-
  action dialog confirms first if there are unsaved edits.
- `preview3D` survives mode switches (window opens in the wearer's view
  by default, matching volume).
- Scene-mode metadata, default sizes, immersive options live in
  [src/store/factories.js](src/store/factories.js) under `DEFAULT_SCENE`
  and in [src/appleSystem.js](src/appleSystem.js) under `WINDOW_PRESETS`
  / `VOLUME_PRESETS`.

### Default sizes
- Window: `1200 × 800 pt` (Regular preset - the default frame for a new
  window and the fallback when no window is selected).
- Volume: `0.6 × 0.4 × 0.6 m` (medium preset, translates via
  1360pt = 1m).
- Other presets (wide / tall / compact / square / small / large) live
  in the Window/Volume picker.

---

## 3D viewport

Built on `@react-three/fiber`. The canvas always covers the whole area
under the topbar; side panels float as absolute-positioned columns.

### Camera + controls
- **Window 3D / Volume:** OrbitControls. Left-rotates, right-pans,
  middle-dollies. Zoom slider in the overlay binds to the camera-target
  distance.
- **Window 2D (Flat View):** Orbit rotate disabled. Left-pans, right-
  pans, middle-dollies.
- **Preview Mode:** OrbitControls disabled; FirstPersonControls
  (`mouse-look + walk`) drives the wearer's POV. Window dragging is
  suppressed.

### Studio scene
- Demo studio (GLB) renders behind the user's content whenever
  `Overlays → Studio → Demo Scene` is on.
- Lit by ambient + directional key light; key light's position is
  user-controllable via Scene → Lighting and always re-targets the
  stage centre (the stool).
- Optional HDRI environment from Scene → Viewport (drei built-in
  presets or an uploaded image - uploaded images wrap as a 360°
  backdrop).

### Selection + hover
- Selection ring is a hairline tint outline (0.25% of the plate's
  longer side, 28-30% opacity), drawn in the scene accent colour.
- Hover effects on interactive panels glide via per-frame lerp
  (~120 ms ease-out). Three modes: `automatic`, `highlight`, `lift`
  with subtle scale (1-1.5%) + lift (6-12 mm).
- Hover only engages in Preview Mode (gaze proxy); in editing it stays
  off so cursor movement doesn't bounce cards around.

### Overlays popover
| Section | Toggles                                          |
| ------- | ------------------------------------------------ |
| Studio  | Demo Scene                                       |
| Grid    | X (side), Y (floor), Z (back)                    |
| Guides  | Axes Gizmo, Scene Info                           |

### Transform tools
- Modal transform (G / R / S - Blender style): pick a tool from the
  left-side transform toolbar or hit the keystroke; the cursor drives
  the entity's transform live until click confirms or Esc cancels.
- Arrow-key nudge on selected window / panel (Shift = 10× step).

---

## Layer hierarchy

```
Tab (page)
├── Window (or Volume container)
│   ├── Stack
│   │   ├── Panel        (text / button / image / ...)
│   │   ├── Stack        (nested layout)
│   │   ├── Entity       (3D primitive / model / attachment)
│   │   └── ...
│   ├── Stack (ornament: leading / trailing / top / bottom)
│   └── Panel (presentation: sheet / popover / alert /
│                     confirmationDialog / inspector)
└── Tab (...) more pages
```

### Tabs
- Top-level page. Multiple tabs render as a left-edge floating tab bar
  (PageTabBar3D) when more than one exists.
- Each tab has a name + SF Symbol icon.

### Windows
- Flat plate (default) or `windowStyle: 'volumetric'` container (set
  via the top-right Window/Volume toggle, not the inspector).
- Window-level metadata: padding, corner radius, material, ornaments,
  spatial (immersion / hover / resizability / gestures), environment.
- Drag in 3D to reposition (suppressed in Preview Mode).
- Every window owns a **Group ID** (SwiftUI `WindowGroup(id:)`). A
  fresh window mints a unique `WindowN` id automatically; users can
  rename it from the inspector. Button tap actions of type **Open
  Window (.openWindow)** target a window by this id.
- When the active tab resolves to 2+ unique Group IDs, a vertical
  **navigation capsule** floats on the leading edge with one pill per
  unique id (multiple windows that share an id collapse to one pill -
  matching a SwiftUI WindowGroup). The capsule auto-updates as windows
  are added, removed, or renamed.
  - 44×44pt icon chip per pill. 12pt padding on all sides + 12pt
    between chips (so 3 pills = 180pt tall). Icon comes from the
    Tab Icon field of the group's first window.
  - In Preview mode, hovering the capsule expands it from 68pt wide
    to 150pt and reveals a label beside each icon. The left edge
    stays anchored; the right edge moves outward.
  - Click a pill to switch groups - the open-window set resets to
    that group's primary window (any previously-spawned same-id
    side-by-side instances disappear).
  - The `.openWindow(id:)` tap action *appends* a same-group window
    to the open set (spawning it on the right with a 60pt gap to the
    previous plate), or switches groups for a different-id target.

### Stacks
Stack types (`STACK_TYPES` in [src/appleSystem.js](src/appleSystem.js)):
- `vstack` / `hstack` / `zstack`
- `grid`, `lazyVStack`, `lazyHStack`, `lazyVGrid`, `lazyHGrid`
- `section`, `disclosure`, `navigationStack`
- `tabView`, `tab`
- `toolbarItem`, `toolbarItemGroup`
- `scrollView`, `viewThatFits`

Each stack carries: alignment, spacing (or auto / nil), padding (number
or per-edge), width/height mode (`fit` / `fixed` / `fill`), optional
background + corner radius + per-corner radii (`cornerRadii: [tl, tr,
br, bl]` - matches SwiftUI's `UnevenRoundedRectangle`), ornament anchor,
scrollable flag + axis + live scroll offset, modifiers.

### Panels
Every SwiftUI primitive lives here (~55 types - full list and per-type
defaults in [VIEWS.md](VIEWS.md), source in
[src/panels/registry.js](src/panels/registry.js)):
- **Escape hatch:** `custom` ("Custom Swift" in the Shift+A palette under
  **Views**). Holds raw Swift that is emitted exactly as typed, so a view
  this designer does not model - or one Apple ships after this was written -
  can still be placed in the tree. The canvas draws a labelled placeholder
  at the node's frame rather than attempting to interpret the source, so
  the surrounding stack lays out against the right box and nobody mistakes
  it for a preview. Structural problems are flagged inline before export.
- **Text / typography:** text, link, label, ticker
  - **Text** uses the SwiftUI measurement pipeline in
    [src/text.js](src/text.js) - tighten (5%) → scale (down to
    `minimumScaleFactor`) → wrap (UAX-14-ish word breaks, with a
    character-level fallback for words wider than the bound) →
    truncate (head/middle/tail). Layout and renderer share the same
    measurement so reserved and rendered heights stay aligned.
  - Widths come from **real Inter metrics**, measured through a Canvas2D
    context ([src/textMeasure.js](src/textMeasure.js)) and installed over
    the engine's built-in uniform-advance approximation at startup. Font
    weight is part of the measurement, since bold is materially wider than
    regular at the same size. This is what makes the canvas break lines
    where the device breaks them: under a flat per-character advance,
    `lllllllllll` and `WWWWWWWWWWW` measure identically - with real metrics
    they differ by about 4x.
- **Inputs:** textfield, securefield, search. Grouped under **Inputs**
  in the Shift+A palette. The inspector shares one "Input Type"
  switcher so the same panel can pivot between the three in place -
  the same way the Geometry picker swaps shapes. In Preview mode a
  click on any field focuses it and renders a real DOM `<input>` via
  drei's `<Html>` overlay (`type="password"` for SecureField). The
  typed value persists on the panel as `textfieldValue` /
  `securefieldValue` / `searchValue`; the 3D rendering shows the live
  value (primary color), the visionOS-spec placeholder (`#545454`)
  when empty, or `•` (`•`) glyphs for SecureField. Live values
  don't reach the exporter - generated Swift keeps `text: .constant("")`.
- **Controls:** button, toggle, segmented, picker, datepicker,
  colorpicker, slider, stepper, gauge, progress, texteditor
  - **Slider, Gauge, Stepper and ProgressView honour the range you
    declare.** A slider set to `0…100` with value `50` draws at its
    midpoint, not hard right; a Stepper moves by its Step and stops at
    its bounds (the button that can do nothing dims); a ProgressView
    measures its value against Total. Gauges also draw their
    `accessoryCircular` styles as a dial and their tint gradient, and
    ProgressView draws `.circular` as a ring. Slider and Gauge value
    labels render at the ends of the track.
  - **Button** is sized by a `Size` picker (Small `65×32` / Regular
    `86×44` / Large `101×52` pt) and a `Style` picker (Capsule - 100pt
    radius, or Rounded Rect - 16pt radius). Width/height are not
    manually editable. Text size tracks the size selection (15 / 17 /
    19 pt) and side padding is a fixed 12pt. If a label is longer than
    the preset width, the button grows wider (height stays locked) so
    the text stays on a single line with the 12pt padding intact.
  - **Segmented control** renders as a SwiftUI-style recessed glass well
    with a raised pill selection. Its inspector exposes segment Count,
    Items (comma-separated), Selected index, and a **Material** tier
    picker (Ultra Thin to Ultra Thick) that tints the track. Exports as
    `Picker(...).pickerStyle(.segmented).background(.<material>, in: Capsule())`.
- **Chrome:** navbar - a NavigationBar strip pinned across the top of
  a window with one of six fixed styles (`trailingButtons`,
  `leadingTrailingButtons`, …) from `NAVBAR_STYLE_SPECS`. Always
  fills the parent's inner width; height is locked at 92pt. The
  inspector exposes Style, Title, and editable Leading / Trailing
  button arrays (each button has its own SF Symbol + tapAction).
- **Lists:** list, table, menu, outlinegroup, form, groupbox
- **Media:** image, asyncimage, slideshow
- **Layout primitives:** spacer, divider
- **Shapes & gradients:** rectangle, circle, capsule, ellipse,
  unevenRoundedRect, path, linearGradient, radialGradient,
  angularGradient. All nine share a single unified **ShapeInspector**
  with Name + Geometry switcher + Width + Height + Stroke (color +
  width). Gradients render through a real `LinearGradient` /
  `RadialGradient` / `AngularGradient` CanvasTexture rather than a
  placeholder fill, so the canvas matches the device. `cornerRadius`
  is only exposed for Rectangle (single radius) and
  UnevenRoundedRectangle (four per-corner radii).
- **Collections:** list, form, groupbox, outlinegroup, table
  - **Form and Outline Group draw their rows**, not just a plate: a
    Form is the grouped card with separators (or the two-column
    layout under `.columns`), an Outline Group is the indented
    disclosure tree, and a collapsed row hides its whole subtree.
  - **The per-type Style pickers change the canvas, not only the
    export.** A List honours row separators (visible / hidden, and
    their tint), row spacing and item tint; a Table drawn `.inset`
    swaps its grid rules for alternating row fills; a Menu set to
    `.button` collapses to its label with an optional chevron; a
    Picker lays its options out in the styles that lay them out
    (`.segmented`, `.wheel`, `.inline`, `.palette`) and shows the
    selected value with a chevron in the menu-ish ones; a Date Picker
    draws a month grid for `.graphical` and drum columns for `.wheel`,
    and shows only the components it was asked for; and a Text Field
    with a vertical axis grows down to its line limit instead of
    clipping one line.
- **Presentation:** sheet, popover, alert, confirmationdialog,
  inspector, navigationlink, contentUnavailable
  - **These present over the window rather than flowing inside it**,
    and each in its own way: sheets, alerts and confirmation dialogs
    sit centred over a dimmed plate; a popover hangs off the edge its
    arrow points from; an inspector is a trailing column with a
    divider and no dimming, narrowing the body the modals centre in.
- **3D primitives (RealityKit):** sphere, box, plane, cone, cylinder,
  text3d, mesh, realityview, canvas

### Entities (volume mode)
- Anchors, model entities, group entities, attachment entities (text /
  image / button attachments billboard toward the camera).
- Materials are physically-based with full PBR knobs (baseColor,
  roughness, metallic, emissive, clearcoat, sheen, blending,
  faceCulling, texture transforms).

---

## Templates

Splash dialog and Assets → Templates expose pre-authored scenes.

### Window templates
Six refined, production-ready window templates surface on the splash -
each maps directly onto Apple's visionOS HIG patterns and uses semantic
colour tokens so Scene → Colors re-themes the whole layout in one shot.

| Key         | Description                                                                                |
| ----------- | ------------------------------------------------------------------------------------------ |
| `blank`     | One window, one fill stack - clean starter (seeded, not in splash list).                   |
| `welcome`   | Onboarding splash - hero icon, centred title block, primary CTA, three feature tiles.      |
| `browse`    | Category grid with a search field - Music Browse / App Store landing; filter chip, featured card, 3×2 grid with count captions. |
| `player`    | Now Playing card: NOW PLAYING eyebrow, artwork, track meta, scrubber, transport row, shuffle+repeat, volume row, Lyrics / AirPlay / Queue secondary row. |
| `profile`   | People-card with avatar, identity, stat chips and primary actions; bio paragraph, skill capsules, "Recent Work" thumb strip. |
| `article`   | Long-form reader - deck, byline with avatar + Save/Share, three paragraphs, pull-quote glass card, "KEEP READING" related strip. |
| `settings`  | Large page title with plan caption, four labeled sections (General / Preferences / Privacy & Security / About), Sign Out destructive button + footer note. |

> **Legacy keys** (`musicPlayer`, `smartHome`, `settingsOld`, `mailApp`,
> `tabBar`, `filesApp`) are kept in the TEMPLATES registry for
> save-file compatibility but no longer appear in the splash picker.

### Volume templates
| Key                | Description                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| `emptyVolume`      | Stage with a single world anchor - clean starter (seeded only).        |
| `productShowcase`  | Metal sphere on a plinth with pulsing emissive ring; tap to scale.     |
| `solarSystem`      | Sun + eight planets in a row with an orbit band; tap planets to scale. |
| `moodLamps`        | Three pendant bulbs on a console; tap to brighten, slow idle bob.      |
| `gallery`          | Three framed pictures on a wall; hover to focus, tap to pop forward.   |
| `spinningShowcase` | Three cubes on a continuous-spin turntable; tap to scale + glow.       |
| `reactiveLights`   | Master orb broadcasts `wave` event → row of pucks rolls a Mexican wave.|
| `diorama` / `cardStack` | Legacy keys kept for save-file compat; not shown in splash.       |

Each volume template ships with pre-wired behaviors (timers, taps,
broadcasts) so a new user sees movement on first Preview without any
extra setup.

### Joined NavigationSplitView styling
*(Surfaces through the legacy `mailApp` / `filesApp` templates.)* The
sidebar inherits the window's outer corner radius on its left edge and
butts flush against the detail pane on the right
(`cornerRadii: [winR, 0, 0, winR]`). Surface is `#d8d8dc` - a soft
secondary tone that harmonises with the near-white window plate
(`designWindow` ≈ `#ecedef`).

---

## Properties Inspector

Two top-level tabs: **Object** (selected item) and **Scene** (global).

### Object - Window
- **Window:** name, Group ID, Tab Icon, Primary (this/auto), Scrollable.
  When **Scrollable** is on, the canvas wires a wheel handler that
  scrolls content inside the plate; world-space clip planes keep
  off-bounds content hidden regardless of the toggle (no leaks past
  the rounded edge, ever).
- **Frame:** size W/H, corner radius, padding; world position X/Y/Z
- **Appearance:** Liquid Glass material (default **Glass**:
  `#b8b8b8` @ 25% + backdrop blur on), tint token, fallback colour,
  Bg Blur on/off + amount slider. Per-property overrides on the window
  win over the material defaults; null fields let the material drive.
- **Plate chrome:** every window plate ships with a **3pt linear-
  gradient stroke** around the perimeter (45° sweep, white at
  40 / 0 / 0 / 10 percent across 0 / 41 / 57 / 100 % stops) - a soft
  visionOS-style edge highlight, no inspector control needed.
- **Volume** (only when `windowStyle === 'volumetric'`): depth, world-
  scaling behaviour, baseplate visibility, alignment, viewpoints
- **Spatial:** immersion style, hover effect, window resizability,
  gestures (multi-select chips)
- **Ornaments:** toolbar wizard (top/bottom, leading/principal/
  trailing slots)
- **Environment:** font, foreground style, layout direction, locale
- **Modifiers:** modifier stack

### Object - Stack
- **Stack:** name + kind (V / H / Z) - or **Navigation Split View**
  with style (Joined / Separated), column visibility, searchable.
- **Layout:** alignment picker, spacing (numeric or `auto`), padding
  (number or 4-edge), grid / scrollView / viewThatFits options per
  type, Size sub-block (W/H mode: Fit / Fixed / Fill, with pt values
  when Fixed), Scroll sub-block (Scrollable On/Off).
  **Scrollable stacks scroll on the canvas.** The stack's frame becomes
  a viewport, its content anchors to the top (or the leading edge for a
  horizontal axis) instead of centring, the wheel moves it, and content
  is clipped to the stack's own box — composed with the window's, so a
  scroller nested in a plate stays inside both. The indicator on the
  trailing edge is sized to the visible fraction and tracks position;
  `.scrollIndicators(.hidden)` hides it and `.scrollDisabled(true)`
  turns the gesture off, exactly as they do on device. A `ScrollView`
  stack scrolls on its own; Section, DisclosureGroup, Tab bodies,
  toolbars and NavigationSplitView bring their own scrolling and are
  left alone, which is also where the exporter draws the line.
- **Section / Disclosure / Navigation / TabView / Tab / ToolbarItem**
  (shown only when applicable): header/footer text, expanded state,
  title, active index, placement.
- **Ornament** (collapsed): anchor mode (.scene / .parent), anchor
  edge, content alignment, visibility, offset, background, material.
- **Environment:** font, foreground, direction, locale.
- **Modifiers:** modifier stack.

### Object - Panel
- **Object** (collapsed): name + frame mode. Three flavours via
  `PANEL_META`:
  - **Figma-style** (text, link): Fit / Fixed / Fill picker that drops
    a `.fixedSize` or `.frame(...)` entry into the modifier stack -
    there is no inline width field; edit the value in the Modifiers
    section. The picker also keeps the legacy `widthMode` in sync for
    the layout engine.
  - **Explicit W/H** (most controls): standard Width / Height rows.
  - **None** (button, navbar, all shapes & gradients): the per-type
    inspector owns sizing - Button uses the Size picker, Navbar is
    locked to parent-width × 92pt, ShapeInspector renders Width +
    Height itself.
- **Per-type inspector:** every panel type has its own section - Text,
  Button Size + Style + Role + Tint (W/H are not editable; the Size
  picker is the only way to change the frame), Inputs (shared Input
  Type switcher across textfield / securefield / search), Toggle Value
  + Label, Picker options, Slider min/max/step, Image URL + fit, List
  rows, Table columns, Datepicker mode, ShapeInspector (Geometry +
  Width + Height + Stroke + per-geometry rows), SF Symbol picker, etc.
  See [VIEWS.md](VIEWS.md) for per-type fields and SwiftUI emit
  patterns.
- **Modifiers:** modifier stack. Includes the full text-display
  family (`italic`, `underline`, `lineLimit`, `tracking`, `kerning`,
  `baselineOffset`, `truncationMode`, `minimumScaleFactor`,
  `allowsTightening`, `multilineTextAlignment`, `fontDesign`,
  `monospacedDigit`, …) for textual views and the `frame` /
  `fixedSize` entries the width picker manages.
  **The stack draws what it exports.** `.background`, `.overlay`,
  `.foregroundStyle`, `.clipShape`, `.glassBackgroundEffect`,
  `.containerBackground`, `.tint`, `.aspectRatio`, `.zIndex`,
  `.navigationTitle`, `.toolbarBackground`, `.hoverEffect`,
  `.hoverEffectDisabled` and `.layoutPriority` all change the canvas,
  not just the generated Swift. Where a modifier and a stored field
  describe the same thing — `.foregroundStyle` vs the Color well,
  `.navigationTitle` vs the NavStack's Title, `.hoverEffect` vs the
  Hover section, `.tint` vs the scene tint — the modifier wins, because
  it is the SwiftUI spelling. Two exceptions draw nothing and say so:
  `.fontDesign` and `.monospacedDigit` need a rounded / serif /
  monospaced face, and the app bundles Inter alone.
- **Styles:** control-size + per-control style picker (toggleStyle,
  pickerStyle, …). Hidden for buttons and toggles whose own inspector
  already includes Size + Style.
- **Hover** (interactive controls): effect, disabled, default, group
  binding.
- **SF Symbol** (types that support it - buttons, labels, links,
  navigationlinks, contentUnavailable, toggles, pickers, menus):
  symbol name, rendering mode (monochrome / hierarchical / palette /
  multicolor), variant (.fill / .circle / .square / .slash), "Remove
  Symbol" button. Variant + mode actually drive the rendered glyph -
  picking `.fill` swaps `house` → `house.fill` via `resolveSymbolName`,
  and `hierarchical` mode drops opacity to 70% while `multicolor`
  boosts stroke weight. (Label panel rolls SF Symbol controls into its
  single consolidated "Label" section - the standalone SF Symbol
  dropdown is suppressed for that type.)
- **Icons everywhere are Lucide-rendered.** Every SF Symbol name
  resolves through `SF_TO_LUCIDE` ([icons.jsx](src/components/icons.jsx))
  to a real Lucide React glyph - in the DOM (`SymbolIcon`) for the
  Layers tree, IconPickerPopover, SymbolPicker grid, and inspector
  previews, and on the canvas (`SymbolIcon3D` -
  [SymbolIcon3D.jsx](src/components/SymbolIcon3D.jsx)) for Label /
  Button / List-row icons, tab + window-group pills, and entity
  attachments. SwiftUI font weight maps to Lucide stroke width;
  `imageScale` (small / medium / large) scales the drawing box. The
  catalogue covers ~380 visionOS-relevant symbol names.
- **Behaviors** (placeholder for window-level interactions; the live
  runtime is wired for entities).

### Object - Entity
- Geometry / model picker, materials editor with full PBR (baseColor,
  roughness, metallic, emissive, clearcoat, sheen, blending, face
  culling, texture transforms), transform (position / rotation /
  scale), behaviors, hierarchy.

### Object - Tab
- Name, SF Symbol icon, ordering controls.

### Scene
- **Viewport:** background scheme (Light / Dark / Image - Image
  wraps as a 360° HDRI), HDRI preset.
- **Lighting:** ambient intensity, key intensity, key position X/Y/Z
  (always targets stage centre), Environment preset.
- **Design:** accent Tint (`.tint()`). (The old global Scheme toggle
  was removed - visionOS has no system-wide light/dark.)
- **Materials & Colors** *(renamed from "Colors")*:
  - **Browser** - a clickable grid groups every editable token:
    **System Colors** (15-swatch wheel: Red / Orange / Yellow / Green /
    Mint / Teal / Cyan / Blue / Indigo / Purple / Pink / Brown / Gray /
    Black / White), then **Text / Controls / Views / Windows /
    Separators** token chips, then the **Materials** Liquid Glass tiers
    (`glass` / `viewsRegular` / `ultraThin` / `thin` / `regular` /
    `thick` / `ultraThick` / `opaque` / `bar`). Click any swatch or chip
    to focus it in the detail editor below.
  - **Picker dropdown** - mirrors the browser selection and doubles as a
    list picker. It lists the Text / Controls / Views / Windows /
    Separators tokens plus the material tiers; the System Colors wheel is
    intentionally left out so the list stays short (pick those from the
    grid). Selecting a window, stack, or segmented control in the
    viewport auto-focuses that item's material here, rather than staying
    pinned to the last selection.
  - **System-colour detail** - a large swatch that opens the native
    picker, plus a hex field.
  - **Material detail** - grouped into three sections:
      - **Base Fill** - Type (Solid or Gradient), Color (solid) or
        From / To / Angle (gradient), Opacity (drives
        `transmission = 1 - opacity` when blur is on).
      - **Layers** - stack extra translucent colour passes over the base
        fill, each its own colour + opacity, via a full-width Add Layer
        button with per-layer remove.
      - **Effects** (shared across the whole stack) - Bg Blur on/off +
        Amount slider (drives `roughness` on the meshPhysicalMaterial
        transmission pass), Inner Shadow and Drop Shadow (each with
        X / Y / Blur / Color / Opacity).
    Edits land in `scene.materialProps[key]` (colour, opacity, gradient,
    layers, blur, shadows) and the renderer merges them with the stock
    `MATERIALS[key]` defaults at draw time. A per-item Reset and a
    Reset All restore the visionOS defaults.
- **Immersive Space:** mode (Off / Immersive), immersion style,
  progressive range + initial, upper-limb visibility, preferred
  surroundings effect (with optional colorMultiply colour),
  environment behaviour.
- **Export:** opens the SwiftUI export dialog.

### Number-input UX
Every numeric field is a scrub-or-type input:
- Click and drag horizontally (≥ 6 px) to scrub the value.
- Stay still under 6 px → focus the input, select-all, type freely.
- Pointer-up restores focus + selection automatically if no scrub
  happened. Esc cancels a typed draft.

---

## Assets panel

- **Built-in templates** appear as a virtual `Templates` folder. Click
  a template tile to apply it (replaces the scene; undoable).
- **Built-in samples** live under `Samples` → `Images` - 9 sample
  photos (`Sample 01 … Sample 09.jpg`) shipped under
  [public/samples/images/](public/samples/images/). Drop one onto a
  panel's Image field, or drag onto the canvas to spawn a textured
  plane.
- **User assets:** drag-drop or import button accepts USDZ, GLB,
  glTF, OBJ, and images. They appear as tiles with rename / delete on
  hover.
- **Folders:** `+` button creates a new folder under the current
  breadcrumb. Drag assets between folders.
- **Drag to canvas:** drop a mesh asset onto the viewport to spawn a
  Model entity. The drop is read by the wrapping div in
  [App.jsx](src/App.jsx).
- **Search:** magnifier icon flattens the listing to anything matching
  the query (across all folders and the templates registry).

---

## Behaviors

Volume entities can carry a list of behaviors. Each behavior is a
trigger + ordered actions. Implementation lives in
[src/behaviors/](src/behaviors/) (eventBus, registry, runtime, tween).

### Triggers (12)
`tap`, `hover`, `drag`, `pinch`, `rotateGesture`, `sceneStart`, `timer`,
`proximity`, `collision`, `inView`, `animationFinished`, `eventReceived`.

All twelve fire in Preview. The two **device-only** gestures have no mouse
equivalent, so the wheel stands in for both: **scroll wheel** magnifies
(`pinch`) and **shift + scroll wheel** twists (`rotateGesture`). The Behaviors
inspector names which one it is on the trigger you picked. Both carry
Begins / Changes / Ends, and a wheel burst produces all three — the first tick
opens the gesture, later ticks change it, and a pause closes it.

### Actions (15)
`scaleTo`, `moveTo`, `rotateTo`, `lookAt`, `follow`, `orbit`, `showHide`,
`setMaterial`, `shaderEffect`, `spawn`, `destroy`, `playAnimation`, `wait`,
`repeat`, `broadcast`.

### What reaches the Swift export

The vocabulary is deliberately wider than what the generator can write:
**8 of 12 triggers and 11 of 15 actions become real Swift.** The rest are
emitted as a documented block naming the RealityKit API to finish them with
(`proximity` and `inView` need a per-frame System, for instance) — nothing
you author disappears silently.

The Behaviors inspector says which is which **before** you export: choosing a
trigger or action that only documents shows an amber note under the picker.
The warning reads the same sets the generator switches on
([src/export/behaviors.js](src/export/behaviors.js)), so the two cannot drift.

Codegen lives in [src/export/behaviors.js](src/export/behaviors.js) (gestures,
`@State`, generated methods) and [src/export/realitykit.js](src/export/realitykit.js)
(the entity tree itself). The preview runtime is separate:
[src/behaviors/runtime.js](src/behaviors/runtime.js) covers all 15 actions and
11 of 12 triggers.

---

## Modifier stack

Every item carries an ordered `modifiers` array - exporter walks them
left-to-right and emits the matching SwiftUI modifier chain. Full
catalogue lives in [src/modifiers/registry.js](src/modifiers/registry.js).
Common modifiers: padding, frame, background, foregroundStyle, font,
opacity, offset, rotation, scaleEffect, blur, shadow, clipShape,
overlay, transition, hoverEffect, accessibility label/hint/value,
gesture, contextMenu, animation, etc.

**Custom** (last in the Add Modifier dropdown) takes a raw chain entry
and appends it verbatim - `.symbolEffect(.bounce)`, or anything else
SwiftUI accepts that the registry does not model. The leading dot is
added for you if you omit it. Structural problems (an unclosed bracket,
a string literal left open) surface as an inline warning, because the
text lands mid-chain in the generated file where a stray bracket breaks
the whole view. The canvas cannot preview an arbitrary modifier, so the
view renders unmodified.

The modifier section is hidden for 3D primitives and presentation panels,
so reach for the **Custom Swift** panel there instead.

---

## Preview mode

Bottom-centre Preview button enters preview. The canvas continues to
render the scene + studio; editing chrome (layers / properties /
transform toolbar / selection halos) is hidden.

- Camera switches to first-person look-around (mouse-look + walk).
  Available in both window and volume modes - windows in visionOS are
  3D objects, so the wearer's head can still turn.
- Window dragging + item selection are suppressed so the canvas reads
  as the deployed app.
- Reset Camera pill snaps back to the wearer's default pose.
- Exit Preview pill (or Esc) returns to editing.

---

## Export

Scene → Export SwiftUI Code opens [SwiftExportDialog.jsx](src/components/SwiftExportDialog.jsx).
The exporter ([src/export/swiftui.js](src/export/swiftui.js)) emits:

- One Swift file per Tab containing the tab's view tree.
- An `App.swift` with `@main`, the top-level `WindowGroup` /
  `VolumetricWindowGroup` / `ImmersiveSpace`, `.defaultSize()`, and any
  scene-level modifiers (immersion style, surroundings effect, world
  scaling, baseplate visibility, world alignment, viewpoints).
- Modifier chains in declaration order.
- RealityKit content emitted as inline `Entity` setup for volume scenes.
- **Sizing**: `.frame(...)` from each view's frame mode — an explicit
  width/height, or `maxWidth: .infinity` for a Fill axis — plus per-edge
  `.padding(.top, …)` where the edges differ.
- **Scrolling**: a stack marked Scrollable becomes a real `ScrollView`, with
  the frame on the viewport and the padding on the scrolling content — the
  same split the canvas now uses, so what scrolls on screen scrolls on
  device. `scrollAxis` and `scrollShowsIndicators` are read by both sides.
- **Free placement**: a control dragged around a window plate exports the
  matching `.offset(x:y:)`.
- **The canvas-side visuals too**: the SF Symbol variant (`.fill` /
  `.circle` / …), an input field's pill-or-rounded edge, a Text
  Editor's line count, and a Label's tinted icon tile - colour, size
  and corner radius, via the explicit `Label { } icon: { }` form.
  An Image names its asset or emits an `AsyncImage` for a remote URL,
  rather than the `photo` placeholder it used to emit whatever you had
  put in the frame.

Modifier order follows how the canvas composes a container — content inset,
then box sized, then box painted — so `.padding()` precedes `.frame()`
precedes `.background()`. See [VIEWS.md](VIEWS.md#the-round-trip-contract).

---

## Keyboard shortcuts

| Shortcut                | Action                                           |
| ----------------------- | ------------------------------------------------ |
| `⇧A`                    | Open Add menu (anywhere)                         |
| `⌘K`                    | Command palette                                  |
| `⌘Z` / `⌘⇧Z`            | Undo / Redo                                      |
| `⌘C` / `⌘V`             | Copy / Paste selected                            |
| `⌘D`                    | Duplicate selected                               |
| `Delete` / `Backspace`  | Remove selected                                  |
| Arrow keys              | Nudge position — a window moves in world space, a panel gains an `.offset` modifier (Shift = 10× step) |
| `G` / `R` / `S`         | Modal Move / Rotate / Scale (Blender-style)      |
| Click + Esc             | Cancel modal transform                           |
| Esc                     | Exit Preview Mode                                |
| Double-click text       | Edit text in-place                               |

---

## How to update this document

1. **When adding a feature:** add its row/section under the relevant
   heading. Be specific about user-visible behaviour, not internal
   implementation. Include the file path if the user might want to
   look at the code.
2. **When removing a feature:** delete the entry. Don't leave a "was
   removed" note unless the absence is surprising and worth flagging.
3. **When changing a default or behaviour:** edit in place; bump the
   "Last updated" date at the top.
4. **When the surface area is hard to summarise:** prefer a list of
   options (like Triggers / Actions / Stack types) over prose.
5. Keep the table of contents in sync with section headings.

This file is the user-facing contract for "what does the app do?".
Internal docs (architecture, build, hooks) belong in
[README.md](README.md) or alongside the code.
