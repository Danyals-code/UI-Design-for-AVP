# AR/VR UI Designer

A visual, drag-and-drop designer for building visionOS-style interfaces. Lay
out windows, panels and SwiftUI-flavoured controls on a 3D canvas, tweak their
modifiers in a properties inspector, and preview the result with a real 3D
camera - HDRI lighting, orbit gestures and all.

Built as a standalone web app (React + Vite + React-Three-Fiber) so a
designer or student can explore visionOS layout concepts without needing
Xcode, a Mac, or a headset.

---

## Highlights

- **Tabs → Windows → Panels → Controls.** A scene is modelled the same way
  SwiftUI models a visionOS app: tabs act as top-level pages, windows are
  floating surfaces inside a tab (the default new window is 1200 × 800 pt),
  and panels contain stacks / controls.
- **Window and Volume modes.** Switch between a flat window canvas (the
  default design surface) and a fully-editable volumetric container
  (a VolumetricWindowGroup) holding 3D entities and behaviors.
- **3D preview camera.** "VR View" places the camera at the wearer's
  eye-line so you can read your layout in space; "Flat View" (window
  mode) drops back to a head-on view of the plate. Toggle HDRI
  environments, a reference grid, and orbit/pan modes.
- **SwiftUI-accurate tokens.** Text styles, corner radii, glass materials,
  SF Symbols, modifiers and control styles are modelled after Apple's
  visionOS Human Interface Guidelines via `appleSystem.js`.
- **Liquid Glass materials with real backdrop blur.** Window plates
  default to a `Glass` material (`#b8b8b8` @ 25%, blur on) rendered via
  three.js `meshPhysicalMaterial` transmission + roughness: actual
  GPU-side mipmap blur of whatever sits behind the plate, not a flat
  white overlay. Each tier (Glass / Views Regular / Ultra Thin / Thin /
  Regular / Thick / Ultra Thick / Opaque / Bar) is fully editable from
  Scene → Materials & Colors: solid or gradient fill, opacity, stacked
  colour layers, blur amount, inner shadow, drop shadow.
- **SF Symbols rendered as Lucide icons.** Every SF Symbol name (~380
  catalogued) routes through a Lucide-React map so glyphs look the
  same in the DOM, in 3D label panels, and in the symbol picker.
  Variant (`.fill` / `.circle`) and rendering mode (hierarchical /
  palette / multicolor) both swap the actual glyph drawn.
- **Window content is clipped + scrollable.** Four world-space clip
  planes attached every frame keep child meshes inside the plate edges,
  so text and panels never leak past rounded corners. Marking a window
  scrollable wires a wheel-driven scroll on its content sub-group.
- **Raw-Swift escape hatch.** A `Custom Swift` view and a `.custom`
  modifier take source the designer types and emit it verbatim, so a view
  or API this designer doesn't model is still reachable without a code
  change. The canvas draws an honest placeholder rather than guessing at
  a preview, and fragments are structurally validated before they can
  break the generated file.
- **Text measured with real font metrics.** Wrapping, truncation and
  intrinsic sizing run on actual advance widths — weight *and*
  `.fontDesign(_:)` included, so a serif heading is measured in a serif —
  rather than a flat per-character constant, so the canvas breaks lines
  where the device does.
- **SwiftUI text pipeline.** A dedicated text engine (`src/text.js`)
  runs the full tighten → scale → wrap → truncate flow so the canvas
  measures Text the way the device does - `lineLimit`,
  `truncationMode`, `minimumScaleFactor`, `allowsTightening`,
  `tracking`, `kerning`, `baselineOffset` and friends all round-trip
  through both the layout engine and the renderer.
- **Modifier-driven Fit / Fixed / Fill.** Width picker on text/link no
  longer mutates a hidden `size` field - clicking Fit / Fixed / Fill
  drops the matching `.fixedSize` or `.frame(...)` entry into
  `item.modifiers` so the user can edit the value where they see
  every other modifier.
- **Inputs that actually accept input.** Text Field, Secure Field and
  Search Field render as real DOM `<input>` overlays in Preview mode
  (drei `<Html>` - `type="password"` for SecureField), and the typed
  value lives on the panel so the canvas mirrors it the same way
  SwiftUI's binding would.
- **Keyboard-first editing.** `⇧A` opens the Add menu, arrow keys nudge
  selected items, `⌘Z / ⌘⇧Z` for undo/redo, `⌘C / ⌘V / ⌘D` for clipboard
  and duplicate, `Delete` / `Backspace` to remove.
- **Command palette.** Jump to any action from a single menu.

## Tech Stack

| Area              | Library                                        |
| ----------------- | ---------------------------------------------- |
| UI framework      | React 18                                       |
| Build / dev       | Vite 5                                         |
| Styling           | Tailwind CSS, PostCSS; Inter / Nunito / Source Serif 4 / Roboto Mono via `@fontsource`, one per `.fontDesign(_:)` case |
| 3D rendering      | three.js + `@react-three/fiber` + `drei`       |
| Icons             | `lucide-react` (SF Symbol → Lucide map)        |
| State             | Zustand                                        |

## Getting Started

```bash
npm install
npm run dev       # starts Vite on http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve the built app
```

Requires Node 18.18+ (see `engines` in package.json). CI runs Node 20.

## Quality gates

```bash
npm run check     # lint errors, then tests, then build - the CI gate
```

Or individually:

```bash
npm test          # Vitest, single run
npm run test:watch
npm run lint      # everything, warnings included
npm run lint:errors  # errors only - what CI gates on
```

The test suite covers the subsystems where a silent regression is expensive,
because two code paths have to agree with each other:

- **`src/export/`** - every template exports Swift that is structurally
  valid: braces balance, string literals close on the line they open, and
  no line of code is handed to a `//` comment. Plus the RealityKit and
  toolbar output, and the behaviour codegen.
- **`src/layout.js`** - `layoutStack` (which positions children) and
  `resolvedChildSizes` (which sizes them for the renderer) must not drift,
  or siblings overlap. Checked across every stack in every template.
- **`src/text.js`** - the SwiftUI Text pipeline: `lineLimit` as a hard cap,
  every truncation mode, scale floors, tightening bounds. Plus the
  measurement seam: that an installed measurer is consulted, that real
  per-glyph widths change where lines break, and that font weight reaches
  it. The suite runs on the built-in uniform-advance approximation, so it
  pins pipeline *behaviour* independently of whichever font is installed.
- **`src/export/swiftValidate.js`** - the escape hatch: raw Swift reaches
  the generated file byte-for-byte, and a fragment that would break that
  file is caught while the user can still see it.
- **`src/store/`** and **`src/appleSystem.js`** - undo/redo and clipboard
  invariants, project round-trip, complete material resolution for all
  24 library entries in both design schemes, and the metric resolvers both
  renderers share (control ranges, aspect ratio, inspector column width,
  outline row visibility).
- **`src/behaviors/runtime.js`** - the preview gesture seam: every pointer
  trigger the registry offers has a path in the runtime (derived from the
  registry, so a trigger the designer can pick and the preview ignores fails
  here), and the wheel bursts that stand in for the two-handed device
  gestures produce a begin, changes and an end.
- **`src/parity.test.js`** - the canvas ↔ export contract. The app renders
  one document two ways (three.js and SwiftUI), and this pins that both
  sides read the *same* properties: every field read by only one of them
  must be declared in `src/parity.baseline.js` with a tier and a reason.
  Wire a new field into one side only and it fails; close a divergence and
  forget to delete its entry and it also fails, so the ledger can neither
  grow silently nor claim debt that no longer exists. It also validates that
  every enum case the exporter emits exists in the real SwiftUI API.
  `npm test` prints the open count. See [AUDIT.md](AUDIT.md) §6.0.

ESLint is tuned for correctness rather than style: hooks rules, undefined
and unused bindings, duplicate keys and cases. Warnings are tracked but do
not fail the build; errors do.

CI (`.github/workflows/ci.yml`) runs the same three steps on pull requests
and on pushes to `main`, and can be triggered by hand from the Actions tab.

## Documentation map

Three complementary docs live at the repo root:

- **[README.md](README.md)** *(this file)* - install / run / build, the
  high-level architecture, and the doc map below.
- **[FEATURES.md](FEATURES.md)** - the user-visible surface area. What
  the app *does* - panels, viewport controls, templates, keyboard
  shortcuts. Update in the same commit as any user-facing change.
- **[VIEWS.md](VIEWS.md)** - the maintainer's map of every SwiftUI-
  flavoured view the designer can place: every panel type, stack type,
  window/entity factory, with defaults and the canonical SwiftUI emit
  pattern. Use this as the comparison baseline when changing how a
  view works or what its defaults are.

When you change behaviour: update FEATURES. When you change defaults
or add a view type: update VIEWS. When you change install / build /
architecture: update README.

## Project Layout

```
src/
  App.jsx                 - top-level layout (topbar, side columns, viewport, resize gutters)
  main.jsx                - React entry point
  store.js                - public store entry point (re-exports store/)
  appleSystem.js          - visionOS design tokens (type ramp, materials, colours, SF Symbols, presets)
  layout.js               - stack layout math (VStack / HStack / ZStack / Grid / ScrollView, fit/fixed/fill)
  text.js                 - SwiftUI Text measurement (tighten → scale → wrap → truncate)
  parity.test.js          - canvas ↔ export contract (see Quality gates)
  parity.baseline.js      - the declared-divergence ledger parity.test.js checks against
  textMeasure.js          - real Inter metrics via Canvas2D, installed over text.js at startup
  shapes.js               - rounded-rect / ellipse / rim-ring geometry helpers
  containment.js          - SwiftUI containment rules (which views may legally nest where)
  fonts.js                - Inter woff URLs per weight, upright + italic
  index.css               - Tailwind layers + the inspector/field/segmented component classes

  store/                  - Zustand store, split into per-domain slices over one shared root
    index.js              - composes every slice, owns the initial state
    factories.js          - element factories (tab/window/stack/panel/entity), id counter, DEFAULT_SCENE
    helpers.js            - tree walks (ancestors, owning tab, name uniqueness, hover resolution)
    undo.js               - snapshot undo/redo + the `undoable()` wrapper every mutation goes through
    items.js              - generic CRUD: select, update, rename, remove, visibility, move/reparent
    scene.js              - scene settings, templates, mode switch, tap actions, add-flow wizards
    tabs.js               - tabs (top-level pages)
    windows.js            - windows + window chrome (tab bar, toolbar, NavigationSplitView)
    stacks.js             - stacks + the in-window TabView
    panels.js             - panel add, type switch, presentations, text styles
    entities.js           - RealityKit entity CRUD, material slots, components, transforms
    clipboard.js          - deep subtree copy / paste with fresh ids
    assets.js             - imported meshes + images, folder tree, drag-into-scene
    persistence.js        - project serialize / open / save-to-file + debounced autosave

  panels/
    registry.js           - view registry: 56 panel types, each with defaults + SwiftUI emit()
    inspectors.jsx        - per-panelType inspector bodies + PANEL_META
  modifiers/
    registry.js           - 43 SwiftUI modifiers: defaults, strict allow-list, inspector row, emit
  realityKit/
    registry.js           - entity kinds, anchor targets, meshes, materials, components, light types
  behaviors/              - preview-only interaction system (never mutates the store)
    registry.js           - the locked trigger + action vocabulary with param schemas
    runtime.js            - per-entity runtime: tweens, continuous motion, trigger wiring
    eventBus.js           - broadcast + lifecycle pub/sub (exports as NotificationCenter)
    tween.js              - easing and lerp helpers
  wizards/
    registry.js           - structural add-flows (sidebar, toolbar, list, table, picker, menu, ...)
  templates/
    index.js              - 6 window + 6 volume templates, blank seeds, legacy keys
  export/
    swiftui.js            - SwiftUI generator: one view file per tab + App.swift
    swiftValidate.js      - structural check for designer-authored raw Swift
    realitykit.js         - the entity subtree as a RealityView (meshes, materials, attachments)
    behaviors.js          - trigger / action wiring as gestures, @State and generated methods

  components/
    Topbar.jsx            - project title, help button, tab strip
    FileMenu.jsx          - New / Open / Save project menu + autosave status
    LayersPanel.jsx       - left tree of tabs / windows / stacks / panels / entities
    AssetsPanel.jsx       - imported mesh + image library with folders
    PropertiesPanel.jsx   - public inspector entry point (re-exports PropertiesPanel/)
    Canvas3D.jsx          - three-fiber canvas, lighting, camera routing, post-processing
    SceneTree.jsx         - store → 3D: windows, stacks, liquid-glass plates, navigation capsules
    Panel3D.jsx           - 3D renderers for all 55 view types
    Entity3D.jsx          - RealityKit entity rendering, gizmos, lights, attachments
    DemoVolumeScene.jsx   - studio backdrop GLB behind the user's content
    ViewportOverlay.jsx   - top-right toolbar (zoom, overlays, Window/Volume, 2D/3D)
    TransformToolbar.jsx  - Blender-style move / rotate / scale tool switch
    ModalTransform.jsx    - cursor-driven G / R / S modal transforms
    FirstPersonControls.jsx - preview-mode WASD + mouse-look camera rig
    PreviewButton.jsx     - bottom-centre Preview / Exit Preview pill and hint strip
    SceneInfoOverlay.jsx  - Blender-style scene statistics HUD
    CommandPalette.jsx    - ⇧A / ⌘K add palette
    AddDropdown.jsx       - layers-panel "+" trigger for the add palette
    AddWizardDialog.jsx   - modal that renders the pending wizard's schema
    Splash.jsx            - first-launch scene-type + template picker
    HelpDialog.jsx        - in-app guide
    SwiftExportDialog.jsx - generated SwiftUI files, one tab button per file
    SymbolPicker.jsx      - SF Symbol picker (renders Lucide icons)
    SymbolIcon3D.jsx      - rasterises Lucide SVGs to CanvasTexture for 3D
    icons.jsx             - Lucide imports, SF Symbol → Lucide map, SymbolIcon (DOM)
    PropertiesPanel/      - the inspector, split per domain
      index.jsx           - Object / Scene tab router
      TabProps.jsx        - tab inspector
      WindowProps.jsx     - window inspector (frame, material, spatial, ornaments)
      StackProps.jsx      - stack inspector, plus the NavigationSplitView controls
      PanelProps.jsx      - registry-driven panel inspector scaffold
      EntityProps.jsx     - RealityKit entity inspector
      SceneProps.jsx      - scene tab: viewport, lighting, Materials & Colors, export
      BehaviorsSection.jsx - trigger / action card editor
      ModifierStack.jsx   - Blender-style stacked SwiftUI modifiers
      primitives.jsx      - fields, sliders, colour pickers, section accordions
      shared.jsx          - shared inspector sections (text, frame, layout, symbol)
      wizards.jsx         - inline toolbar / tab-bar / split-view wizards
      useScrub.js         - drag-to-scrub numeric fields
```

### Scene Graph

The store ([`src/store/`](src/store/index.js), re-exported from
[`src/store.js`](src/store.js)) keeps one flat `items` array plus a
`selectedId`. Every node lives in that array - tabs, windows, stacks,
panels and RealityKit entities alike - and relationships are tracked only
via `parentId`. Because there is a single array, selection, undo,
clipboard, visibility and drag-reparenting are each implemented once and
work for every node type.

The store is composed from per-domain slices (see the layout above). They
all read and write the same root via `set`/`get` rather than owning a
subtree, so consumers keep using `useStore((s) => s.someAction)`
regardless of which slice an action lives in. Every mutating action is
wrapped in `undoable()`, which snapshots `items`, selection, active tab,
scene settings and the id counter before applying the change.

### Design Tokens

Everything that needs to match visionOS (glass materials, corner radii, text
styles, window presets, SF Symbol names, HDRI presets, dark/light colour
schemes) lives in [`src/appleSystem.js`](src/appleSystem.js). Components
read from this module rather than hard-coding values, so the whole app can
be restyled from one place.

### 3D Preview

Camera routing lives in `ModeHandler` inside
[`src/components/Canvas3D.jsx`](src/components/Canvas3D.jsx). The
viewport runs in the wearer's VR view by default (`preview3D` on):

- **VR View (window):** camera at `(0, 1.4, 0.4)` looking at the plate
  at `(0, 1.4, -1.0)`. OrbitControls left-rotate, right-pan.
- **VR View (volume):** camera at `(0, 1.2, 1.5)` looking at the volume
  centre `(0, 1.2, 0)`.
- **Flat View (window only):** orbit rotate disabled, head-on view of
  the plate; left and right mouse both pan.

HDRI environments, grid, and panning are applied through the viewport
toolbar in [`src/components/ViewportOverlay.jsx`](src/components/ViewportOverlay.jsx).

## Keyboard Shortcuts

| Shortcut                | Action                                           |
| ----------------------- | ------------------------------------------------ |
| `⇧A`                    | Open the Add menu                                |
| `⌘Z` / `⌘⇧Z`            | Undo / Redo                                      |
| `⌘C` / `⌘V`             | Copy / Paste selected                            |
| `⌘D`                    | Duplicate selected                               |
| `Delete` / `Backspace`  | Remove selected                                  |
| Arrow keys              | Nudge position (Shift = 10× step)                |
| `⌘K`                    | Command palette                                  |

## Status

Active prototype. Both Window and Volume modes are fully editable.
Volume mode ships six pre-wired behavior templates (product showcase,
solar system, mood lamps, gallery, spinning showcase, reactive
lights). The VR View preview camera is still experimental: gestures,
gizmos and camera behaviour may still change.

## License

Private / unreleased. No license granted for external use yet.
