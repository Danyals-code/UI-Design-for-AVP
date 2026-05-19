# AR/VR UI Designer

A visual, drag-and-drop designer for building visionOS-style interfaces. Lay
out windows, panels and SwiftUI-flavoured controls on a 3D canvas, tweak their
modifiers in a properties inspector, and preview the result with a real 3D
camera — HDRI lighting, orbit gestures and all.

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
  default design surface) and a volumetric placeholder that represents a
  VolumetricWindowGroup.
- **3D preview camera.** "See in 3D" rotates from the head-on design view
  to an angled orbit camera so you can see how your layout reads in space.
  Toggle HDRI environments, a reference grid, and orbit/pan modes.
- **SwiftUI-accurate tokens.** Text styles, corner radii, glass materials,
  SF Symbols, modifiers and control styles are modelled after Apple's
  visionOS Human Interface Guidelines via `appleSystem.js`.
- **SwiftUI text pipeline.** A dedicated text engine (`src/text.js`)
  runs the full tighten → scale → wrap → truncate flow so the canvas
  measures Text the way the device does — `lineLimit`,
  `truncationMode`, `minimumScaleFactor`, `allowsTightening`,
  `tracking`, `kerning`, `baselineOffset` and friends all round-trip
  through both the layout engine and the renderer.
- **Modifier-driven Fit / Fixed / Fill.** Width picker on text/link no
  longer mutates a hidden `size` field — clicking Fit / Fixed / Fill
  drops the matching `.fixedSize` or `.frame(...)` entry into
  `item.modifiers` so the user can edit the value where they see
  every other modifier.
- **Inputs that actually accept input.** Text Field, Secure Field and
  Search Field render as real DOM `<input>` overlays in Preview mode
  (drei `<Html>` — `type="password"` for SecureField), and the typed
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
| Styling           | Tailwind CSS, PostCSS, Inter via `@fontsource` |
| 3D rendering      | three.js + `@react-three/fiber` + `drei`       |
| State             | Zustand                                        |

## Getting Started

```bash
npm install
npm run dev       # starts Vite on http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve the built app
```

Requires Node 18+.

## Documentation map

Three complementary docs live at the repo root:

- **[README.md](README.md)** *(this file)* — install / run / build, the
  high-level architecture, and the doc map below.
- **[FEATURES.md](FEATURES.md)** — the user-visible surface area. What
  the app *does* — panels, viewport controls, templates, keyboard
  shortcuts. Update in the same commit as any user-facing change.
- **[VIEWS.md](VIEWS.md)** — the maintainer's map of every SwiftUI-
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
  App.jsx                 — top-level layout (topbar, panels, viewport, resize gutters)
  main.jsx                — React entry point
  store.js                — Zustand store (scene graph, history, clipboard, modifiers)
  appleSystem.js          — visionOS design tokens (text styles, glass, SF Symbols, presets)
  layout.js               — stack layout math (HStack / VStack / ZStack, fit/fixed/fill)
  text.js                 — SwiftUI Text measurement (tighten/scale/wrap/truncate)
  shapes.js               — rounded-rect geometry helpers for 3D panels
  fonts.js                — font stack + SF Symbol unicode map
  components/
    Topbar.jsx            — file / edit / view / scene menus and tab strip
    LayersPanel.jsx       — left-hand tree of tabs, windows and panels
    PropertiesPanel.jsx   — right-hand inspector for modifiers/styles/animation
    Canvas3D.jsx          — three-fiber canvas, camera routing, OrbitControls
    SceneTree.jsx         — converts the store into 3D meshes
    Panel3D.jsx           — per-panel geometry, stacks, and rounded-rect backgrounds
    ViewportOverlay.jsx   — viewport toolbar (zoom, grid, HDRI, pan, "See in 3D")
    VolumePlaceholder.jsx — placeholder shown for Volume mode while WIP
    CommandPalette.jsx    — ⌘K palette
    AddDropdown.jsx       — "+" menu in the layers panel
    SymbolPicker.jsx      — SF Symbol picker
    icons.jsx             — inline SVG icons used in chrome
```

### Scene Graph

The store ([`src/store.js`](src/store.js)) keeps a flat `items` array and a
`selectedId`. Each item is either a tab, a window, a panel, or a leaf
control. Relationships are tracked via `parentId`, and structural helpers on
the store handle reparenting, duplication, history and paste.

### Design Tokens

Everything that needs to match visionOS (glass materials, corner radii, text
styles, window presets, SF Symbol names, HDRI presets, dark/light colour
schemes) lives in [`src/appleSystem.js`](src/appleSystem.js). Components
read from this module rather than hard-coding values, so the whole app can
be restyled from one place.

### 3D Preview

Camera routing lives in `ModeHandler` inside
[`src/components/Canvas3D.jsx`](src/components/Canvas3D.jsx):

- **Head-on (design view):** camera at `(0, 2.5, 2.5)`, orbit disabled, left
  mouse pans.
- **3D preview:** camera at `(6, 3.5, 4)`, orbit enabled, right mouse
  rotates (or swap to left-rotate with the Pan button).

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

Active prototype. Window mode is fully editable; Volume mode shows a
placeholder while the volumetric preview camera is being refined. The
"See in 3D" toggle is considered experimental — gestures, gizmos and
camera behaviour may still change.

## License

Private / unreleased. No license granted for external use yet.
