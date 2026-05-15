# Features

Living catalog of everything this app can do today. Treat this as the
authoritative reference — when a feature is added, removed, or changed,
update this file in the same commit so it never drifts from reality.

Three docs at the repo root work together:

- [README.md](README.md) — install / run / build (getting started).
- **[FEATURES.md](FEATURES.md)** *(this file)* — user-visible surface.
- [VIEWS.md](VIEWS.md) — maintainer reference: every panel/stack/window
  factory, with defaults and SwiftUI emit patterns. The "what does this
  view *do* and what are its defaults" map. Update whenever you add or
  change a view type, default, or design-system constant.

> **Last updated:** 2026-05-15

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
- **Design tokens:** all visionOS-flavoured constants — text styles,
  glass tokens, SF Symbol map, window/volume presets — live in
  [src/appleSystem.js](src/appleSystem.js).

---

## Workspace chrome

Three columns plus a topbar and bottom-anchored controls.

### Topbar
- App title `visionOS Designer` — click to reopen the Splash.
- Tab strip showing every tab in the active scene; click to switch.
- Tab indicator + "+" new-tab button.

### Left column
- **Layers panel** (top half)
  - Searchable tree (magnifier icon) — type to filter by item name; Esc
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

### Right column — Properties Inspector
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
| Window  | Flat plate, near-white surface | Wearer's VR view (preview3D on) | Flat View button drops to head-on plate. Demo studio renders by default. |
| Volume  | Volumetric container, transparent baseplate | VR view at `(0, 1.55, 3)` looking at `(0, 1.2, 0)` | Always 3D. Models / attachments / RealityKit primitives live here.    |
| Immersive | Full-room metadata only      | n/a                             | Exports as `ImmersiveSpace` — set via Scene tab → Immersive Space.    |

- Switching modes from the viewport reseeds the scene; the destructive-
  action dialog confirms first if there are unsaved edits.
- `preview3D` survives mode switches (window opens in the wearer's view
  by default, matching volume).
- Scene-mode metadata, default sizes, immersive options live in
  [src/store/factories.js](src/store/factories.js) under `DEFAULT_SCENE`
  and in [src/appleSystem.js](src/appleSystem.js) under `WINDOW_PRESETS`
  / `VOLUME_PRESETS`.

### Default sizes
- Window: `1200 × 800 pt` (Regular preset — the default frame for a new
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
  presets or an uploaded image — uploaded images wrap as a 360°
  backdrop).

### Selection + hover
- Selection ring is a hairline tint outline (0.25% of plate's longer
  side, 28-30% opacity) — used to read as a fat blue halo before the
  fix.
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
- Modal transform (G / R / S — Blender style): pick a tool from the
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
│   └── Panel (presentation: sheet / popover / alert)
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
  unique id (multiple windows that share an id collapse to one pill —
  matching a SwiftUI WindowGroup). The capsule auto-updates as windows
  are added, removed, or renamed.
  - 44×44pt icon chip per pill. 12pt padding on all sides + 12pt
    between chips (so 3 pills = 180pt tall). Icon comes from the
    Tab Icon field of the group's first window.
  - In Preview mode, hovering the capsule expands it from 68pt wide
    to 150pt and reveals a label beside each icon. The left edge
    stays anchored; the right edge moves outward.
  - Click a pill to switch groups — the open-window set resets to
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
br, bl]` — matches SwiftUI's `UnevenRoundedRectangle`), ornament anchor,
scrollable flag, modifiers.

### Panels
Every SwiftUI primitive lives here (~55 types — full list and per-type
defaults in [VIEWS.md](VIEWS.md), source in
[src/panels/registry.js](src/panels/registry.js)):
- **Text / typography:** text, link, label, ticker
- **Controls:** button, toggle, segmented, picker, datepicker,
  colorpicker, slider, stepper, gauge, progress, search, textfield,
  securefield, texteditor
  - **Button** is sized by a `Size` picker (Small `65×32` / Regular
    `86×44` / Large `101×52` pt) and a `Style` picker (Capsule — 100pt
    radius, or Rounded Rect — 16pt radius). Width/height are not
    manually editable. Text size tracks the size selection (15 / 17 /
    19 pt) and side padding is a fixed 12pt. If a label is longer than
    the preset width, the button grows wider (height stays locked) so
    the text stays on a single line with the 12pt padding intact.
  - **Segmented control** is a Picker with `.pickerStyle(.segmented)` —
    Items field (comma-separated) + Selected index.
- **Lists:** list, table, menu, outlinegroup, form, groupbox
- **Media:** image, asyncimage, slideshow
- **Layout primitives:** spacer, divider
- **Shapes:** rectangle, circle, capsule, ellipse, unevenRoundedRect,
  path
- **Gradients:** linearGradient, radialGradient, angularGradient
- **Presentation:** sheet, popover, alert, confirmationdialog,
  inspector, navigationlink, contentUnavailable
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
| Key             | Description                                                                 |
| --------------- | --------------------------------------------------------------------------- |
| `blank`         | One window, one fill stack — clean starter (seeded, not in splash list).    |
| `musicPlayer`   | Now Playing card with deep-blue artwork, scrubber, transport, queue list.   |
| `smartHome`     | Greeting + room cards (soft secondary surface) + scene pills + Away toggle. |
| `settings`      | Search, account card, General list, Display + Connectivity groups.          |
| `mailApp`       | Joined NavigationSplitView with sidebar mailboxes + reading detail.         |
| `tabBar`        | Bottom Tab Bar ornament + Home content stub.                                |
| `filesApp`      | Joined NavSplit with Locations + Tags lists, toolbar, empty-state detail.   |

### Volume templates
| Key                | Description                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| `emptyVolume`      | Stage with a single world anchor — clean starter (seeded only).        |
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
The sidebar inherits the window's outer corner radius on its left edge
and butts flush against the detail pane on the right
(`cornerRadii: [winR, 0, 0, winR]`). Surface is `#d8d8dc` — a soft
secondary tone that harmonises with the near-white window plate
(`designWindow` ≈ `#ecedef`).

---

## Properties Inspector

Two top-level tabs: **Object** (selected item) and **Scene** (global).

### Object — Window
- **Window:** name
- **Frame:** size W/H, corner radius, padding; world position X/Y/Z
- **Material:** glass material, tint token, fallback colour
- **Volume** (only when `windowStyle === 'volumetric'`): depth, world-
  scaling behaviour, baseplate visibility, alignment, viewpoints
- **Spatial:** immersion style, hover effect, window resizability,
  gestures (multi-select chips)
- **Ornaments:** toolbar wizard (top/bottom, leading/principal/
  trailing slots)
- **Environment:** font, foreground style, layout direction, locale
- **Modifiers:** modifier stack

### Object — Stack
- **Stack:** name + kind (V / H / Z) — or **Navigation Split View**
  with style (Joined / Separated), column visibility, searchable.
- **Layout:** alignment picker, spacing (numeric or `auto`), padding
  (number or 4-edge), grid / scrollView / viewThatFits options per
  type, Size sub-block (W/H mode: Fit / Fixed / Fill, with pt values
  when Fixed), Scroll sub-block (Scrollable On/Off).
- **Section / Disclosure / Navigation / TabView / Tab / ToolbarItem**
  (shown only when applicable): header/footer text, expanded state,
  title, active index, placement.
- **Ornament** (collapsed): anchor mode (.scene / .parent), anchor
  edge, content alignment, visibility, offset, background, material.
- **Environment:** font, foreground, direction, locale.
- **Modifiers:** modifier stack.

### Object — Panel
- **Object** (collapsed): name + frame mode (Figma-style for shapes,
  Layout-style for controls, none for ornaments).
- **Per-type inspector:** every panel type has its own section — Text,
  Button Size + Style + Role + Tint (W/H are not editable; the Size
  picker is the only way to change the frame), Toggle Value + Label,
  Picker options, Slider min/max/step, Image URL + fit, List rows,
  Table columns, Datepicker mode, SF Symbol picker, etc. See
  [VIEWS.md](VIEWS.md) for per-type fields and SwiftUI emit patterns.
- **Modifiers:** modifier stack.
- **Styles:** control-size + per-control style picker (toggleStyle,
  pickerStyle, …). Hidden for buttons and toggles whose own inspector
  already includes Size + Style.
- **Hover** (interactive controls): effect, disabled, default, group
  binding.
- **SF Symbol** (types that support it): symbol name, rendering mode,
  variant, "Remove Symbol" button.
- **Behaviors** (placeholder for window-level interactions; the live
  runtime is wired for entities).

### Object — Entity
- Geometry / model picker, materials editor with full PBR (baseColor,
  roughness, metallic, emissive, clearcoat, sheen, blending, face
  culling, texture transforms), transform (position / rotation /
  scale), behaviors, hierarchy.

### Object — Tab
- Name, SF Symbol icon, ordering controls.

### Scene
- **Viewport:** background scheme (Light / Dark / Image — Image
  wraps as a 360° HDRI), HDRI preset.
- **Lighting:** ambient intensity, key intensity, key position X/Y/Z
  (always targets stage centre), Environment preset.
- **Design:** accent Tint (`.tint()`). (The old global Scheme toggle
  was removed — visionOS has no system-wide light/dark.)
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

### Triggers
`sceneStart`, `tap`, `hover`, `drag`, `pinch`, `rotateGesture`,
`timer`, `proximity`, `collision`, `inView`, `lookAt`, `orbit`,
`follow`, `animationFinished`, `eventReceived`.

### Actions
`moveTo`, `rotateTo`, `scaleTo`, `setMaterial`, `playAnimation`,
`spawn`, `destroy`, `showHide`, `broadcast`, `repeat`, `wait`,
`shaderEffect`.

Behaviors are exported as RealityKit code in [src/realityKit/registry.js](src/realityKit/registry.js).

---

## Modifier stack

Every item carries an ordered `modifiers` array — exporter walks them
left-to-right and emits the matching SwiftUI modifier chain. Full
catalogue lives in [src/modifiers/registry.js](src/modifiers/registry.js).
Common modifiers: padding, frame, background, foregroundStyle, font,
opacity, offset, rotation, scaleEffect, blur, shadow, clipShape,
overlay, transition, hoverEffect, accessibility label/hint/value,
gesture, contextMenu, animation, etc.

---

## Preview mode

Bottom-centre Preview button enters preview. The canvas continues to
render the scene + studio; editing chrome (layers / properties /
transform toolbar / selection halos) is hidden.

- Camera switches to first-person look-around (mouse-look + walk).
  Available in both window and volume modes — windows in visionOS are
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
| Arrow keys              | Nudge position (Shift = 10× step)                |
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
