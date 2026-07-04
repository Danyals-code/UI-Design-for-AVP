// Element factories + shared constants.
//
// Owns the module-scoped `idCounter` so every factory produces stable, unique
// ids regardless of which slice creates the item. The undo slice reads/writes
// the counter via getIdCounter/setIdCounter so undo+redo can restore the exact
// id sequence — critical for paste, copy, and any operation that reseeds ids.

import {
  TEXT_STYLES,
  WINDOW_PRESETS,
  WINDOW_CORNER_RADIUS,
  buildDefaultSceneColors,
  ptToUnits
} from '../appleSystem'
import { panelDefaults } from '../panels/registry'
import {
  ANCHOR_DEFAULTS,
  TRANSFORM_DEFAULTS,
  CAMERA_DEFAULTS,
  ATTACHMENT_DEFAULTS,
  ATTACHMENT_KINDS,
  LIGHT_DEFAULTS,
  LIGHT_TYPES,
  buildDefaultComponents,
  meshDefaults,
  materialDefaults,
  ENTITY_KINDS
} from '../realityKit/registry'

// ---- id counter ----

let idCounter = 1
export const nextId = (prefix = 'item') => `${prefix}-${idCounter++}`
export const getIdCounter = () => idCounter
export const setIdCounter = (v) => { idCounter = v }

// ---- text style → font size ----

export const textStyleToFontSize = (style) => ptToUnits(TEXT_STYLES[style]?.pt ?? 17)

// ---- shared defaults ----

// Modifiers were once a flat object; they are now an ordered array of
// `{ id, type, ...args }` entries (see src/modifiers/registry.js). Each new
// item starts with an empty array — modifiers are added explicitly by the
// designer from the inspector's "+ Add Modifier" dropdown, which is filtered
// per view to the SwiftUI methods that view actually accepts.

// Per-component style defaults. All values follow visionOS spec defaults
// (`.automatic` resolves to the visionOS-tuned look). Where the spec gives
// a different concrete default than `.automatic`, we keep the `.automatic`
// alias so the exporter can elide the `.xxxStyle()` modifier entirely.
export const DEFAULT_STYLES = {
  toggleStyle: 'automatic',     // → .switch on visionOS
  pickerStyle: 'automatic',     // → .menu on visionOS
  labelStyle: 'automatic',      // icon+title in body, icon-only in toolbars
  textFieldStyle: 'automatic',  // → recessed glass (.thickMaterial) on visionOS
  controlSize: 'regular',
  tableStyle: 'automatic',
  buttonBorderShape: 'automatic'
}

export const DEFAULT_ANIMATION = {
  curve: 'default',
  duration: 0.35,
  transition: 'opacity',
  springResponse: 0.55,
  springDamping: 0.825
}

export const DEFAULT_ACCESSIBILITY = {
  label: '',
  hint: '',
  value: '',
  traits: [],
  isAccessibilityElement: true
}

export const DEFAULT_ENVIRONMENT = {
  font: null,
  foregroundStyle: null,
  tint: null,
  locale: null,
  layoutDirection: 'leftToRight'
}

// ---- element factories ----

// A Tab is a top-level "page": the logical container that owns one or more
// Windows. Only one Tab is visible at a time (via activeTabId). Tabs show up
// as chips in the layers-panel tab bar and as roots in the layers tree.
export const makeTab = (overrides = {}) => ({
  id: nextId('tab'),
  type: 'tab',
  name: 'Tab',
  icon: 'folder',     // SF Symbol name
  parentId: null,
  visible: true,
  collapsed: false,
  ...overrides
})

// Counter for default WindowGroup IDs. SwiftUI `WindowGroup(id:)` needs a
// stable, unique string per group; we mint one here so every new window
// ships with a non-colliding default. Users can rename freely from the
// inspector. Decoupled from the item-id counter so a user-renamed group
// won't drift when items are reseeded (e.g. paste, undo).
let windowGroupCounter = 1
export const nextWindowGroupId = () => `Window${windowGroupCounter++}`

export const makeWindow = (overrides = {}) => ({
  id: nextId('window'),
  type: 'window',
  name: 'Window',
  // SwiftUI WindowGroup identifier — passed to `openWindow(id:)` from
  // button tap actions and used by the WindowGroupTabBar to label each
  // pill. Defaults to a fresh `WindowN` so every new window can be
  // opened by name from the start; users can rename to anything
  // unique. The SwiftUI exporter emits `WindowGroup(id: "<groupId>")`.
  windowGroupId: nextWindowGroupId(),
  // Per-window navigation chrome — the WindowGroupTabBar3D capsule (see
  // SceneTree.jsx) renders one pill per window with this icon and the
  // window's name as the pill label.
  tabIcon: 'rectangle',     // SF Symbol name shown in the navigation pill
  parentId: null,
  visible: true,
  collapsed: false,
  size: [ptToUnits(WINDOW_PRESETS.regular.width), ptToUnits(WINDOW_PRESETS.regular.height)],
  cornerRadius: ptToUnits(WINDOW_CORNER_RADIUS),
  // Position is in metres now (1 unit = 1m). Default puts the window
  // at chest height (1.4m above floor) and 1m in front of the wearer's
  // headset — matches the visionOS default placement for a regular
  // SwiftUI WindowGroup at launch.
  position: [0, 1.4, -1.0],
  // Default plate material is the visionOS Glass tier — 50% gray at
  // 30% alpha with the bg blur on. Defined in MATERIALS.glass so the
  // values stay in one place and the Materials & Colors editor can
  // tune them scene-wide. Color / opacity / blur are intentionally
  // left undefined so the renderer falls through to the material
  // defaults; the user can still override per-window via the Window
  // → Appearance inspector.
  material: 'glass',
  colorToken: null,
  color: null,
  fillOpacity: null,
  blur: null,
  blurAmount: null,
  padding: 14,             // pt — default inner padding for the window content
  spatial: {
    immersionStyle: 'mixed',
    hoverEffect: 'automatic',
    windowResizability: 'automatic',
    gestures: ['tap', 'drag']
  },
  // visionOS window-style metadata (spec §3.1, §3.2). Defaults match
  // Apple's `.automatic` glass plate; `.volumetric` enables the rest of
  // the volume-only knobs below.
  windowStyle: 'automatic',         // 'automatic' | 'plain' | 'volumetric'
  // Wrap the window's content in a SwiftUI ScrollView. When true the
  // canvas draws a trailing-edge scroll-indicator and the exporter
  // wraps the root view in `ScrollView { ... }`. Off by default so
  // a regular dashboard / settings layout doesn't get an unwanted
  // scrollbar — flip it on for long content (e.g. a settings page
  // that overruns the plate height).
  scrollable: false,
  // Vertical scroll offset (units) for scrollable windows. The
  // canvas-side wheel handler in `Window3D` writes to this field; the
  // content layer is translated by `-scrollY`, so it slides upward
  // while the four clipping planes anchored to the window's world
  // bounds hide whatever moves out of frame.
  scrollY: 0,
  // Volume metadata — only consulted when windowStyle === 'volumetric'.
  // 0.6m matches Apple's canonical example
  // `.defaultSize(width: 0.6, height: 0.4, depth: 0.6, in: .meters)`.
  volumeDepthMeters: 0.6,           // .defaultSize depth in meters
  worldScalingBehavior: 'automatic',// .defaultWorldScalingBehavior
  volumeBaseplateVisibility: 'automatic',
  volumeWorldAlignment: 'adaptive', // visionOS 2+
  supportedVolumeViewpoints: 'all', // 'all' | 'front' | 'frontBack'
  environment: { ...DEFAULT_ENVIRONMENT },
  modifiers: [],
  ...overrides
})

export const makeStack = (overrides = {}) => ({
  id: nextId('stack'),
  type: 'stack',
  stackType: 'vstack',
  alignment: 'center',
  // SwiftUI default for VStack/HStack `spacing` is `nil` — a system-adaptive
  // value chosen at layout time. Keeping the field explicitly null so the
  // exporter can omit the `spacing:` argument entirely (matches Apple's
  // baseline). Designers can still set a concrete value to override.
  spacing: null,              // pt | null (null = system-adaptive)
  padding: 24,                // pt (uniform — used when paddingEdges is null)
  paddingEdges: null,         // { top, bottom, leading, trailing } in pt — overrides padding
  fixedWidth: null,
  fixedHeight: null,
  // Frame sizing mode — mirrors SwiftUI's `.frame()` / Figma's constraints.
  //   fit    — hug contents (intrinsic size from children)
  //   fixed  — explicit size via `fixedWidth` / `fixedHeight`
  //   fill   — fill the parent stack / window's inner axis
  // Backwards-compat: if `widthMode`/`heightMode` are unset but `fixedWidth`/
  // `fixedHeight` are present on legacy data, the layout engine falls back to
  // treating that axis as 'fixed'. New stacks default to 'fit' on both axes.
  widthMode:  'fit',
  heightMode: 'fit',
  ornament: null,
  // Spec §1.26 / §3.4 — `attachmentAnchor` is required for `.ornament(...)`.
  // 'scene' attaches in the scene-relative coordinate space (the default
  // visionOS behaviour); 'parent' (visionOS 26) anchors to the owning view.
  ornamentAnchorMode: 'scene',     // 'scene' | 'parent'
  ornamentContentAlignment: 'center',
  ornamentVisibility: 'automatic',
  ornamentOffset: 0,
  // Spec §1.26 — Toolbar items carry a placement (.principal, .topBarLeading,
  // .topBarTrailing, .bottomOrnament, …). Only consulted when the stack's
  // stackType is 'toolbarItem' or 'toolbarItemGroup'.
  toolbarPlacement: 'automatic',
  background: null,
  material: 'regular',
  // Optional frosted-glass blur — when a stack has a background it can
  // also toggle the visionOS-style blur via the Material picker. Off
  // by default; the inspector exposes the toggle in the same row group.
  blur: false,
  blurAmount: 12,
  scrollable: false,
  // Grid-specific — mirrors SwiftUI's `GridItem` sizing modes.
  //   gridMode 'fixed'    → uses `columns` directly (N equal columns)
  //   gridMode 'adaptive' → derives columns from inner width and
  //                         `minColumnWidth` (≈ `GridItem(.adaptive(minimum:))`)
  columns: 2,
  gridMode: 'fixed',
  minColumnWidth: 140,        // pt — only consulted when gridMode==='adaptive'
  // ScrollView-specific (§1.24) — axis defaults to `.vertical`, indicators
  // default to true. Both feed the SwiftUI exporter.
  scrollAxis: 'vertical',     // 'vertical' | 'horizontal' | 'both'
  scrollShowsIndicators: true,
  // ViewThatFits — `in:` axes; default both.
  fitsAxes: 'both',           // 'both' | 'horizontal' | 'vertical'
  // Section-specific
  sectionHeader: '',          // for stackType 'section'
  sectionFooter: '',
  // Disclosure-specific
  expanded: false,            // for stackType 'disclosure' — spec default is collapsed
  disclosureLabel: 'Section',
  // NavStack-specific
  activeChild: 0,             // for stackType 'navigationStack'
  navTitle: '',
  // TabView-specific
  activeTab: 0,               // for stackType 'tabView' — which Tab is visible
  // Tab-specific (child of tabView)
  tabLabel: '',               // display label for the tab
  tabIcon: null,              // SF Symbol name for the tab icon
  //
  modifiers: [],
  environment: { ...DEFAULT_ENVIRONMENT },
  name: 'VStack',
  parentId: null,
  visible: true,
  collapsed: false,
  ...overrides
})

const cap = (s) => s[0].toUpperCase() + s.slice(1)

export const makePanel = (panelType, overrides = {}) => {
  const d = panelDefaults(panelType)
  return {
    id: nextId('panel'),
    type: 'panel',
    panelType,
    name: `${cap(panelType)} ${idCounter}`,
    parentId: null,
    visible: true,
    position: [0, 0, 0],
    modifiers: [],
    styles: { ...DEFAULT_STYLES },
    animation: { ...DEFAULT_ANIMATION },
    accessibility: { ...DEFAULT_ACCESSIBILITY },
    symbolName: null,
    symbolRenderingMode: 'monochrome',
    symbolVariant: null,
    // visionOS .hoverEffect — `inherit` walks up to the owning window's
    // `spatial.hoverEffect`. Override per-panel for special-case behaviour
    // (e.g. force `none` on a decorative element, force `lift` on a CTA).
    hoverEffect: 'inherit',
    ...d,
    ...overrides
  }
}

// ---- entity factories (RealityKit) ----
//
// Entities live in the same `items[]` array as everything else (with
// type 'entity'); they piggy-back on the existing tree, undo, clipboard,
// and selection plumbing. Subtypes:
//
//   anchor — root of an entity sub-tree (AnchorEntity)
//   model  — mesh + material(s) (ModelEntity)
//   group  — empty transform node (Entity)
//
// Containment is enforced at the move/drop layer via
// `childKindsAllowedUnder` in src/realityKit/registry.js.

const capLabel = (key) => ENTITY_KINDS[key]?.label || 'Entity'

// Build a fresh material entry. Used by makeModelEntity and by the
// "Add material" action in the inspector.
export const makeMaterial = (type = 'simple', overrides = {}) => ({
  id: nextId('mat'),
  type,
  ...materialDefaults(type),
  ...overrides
})

// Common base for every entity kind — id + tree wiring + transform +
// visual components. Kind-specific fields are spliced on top.
const makeEntityBase = (entityKind, overrides = {}) => ({
  id: nextId('entity'),
  type: 'entity',
  entityKind,
  name: capLabel(entityKind),
  parentId: null,
  visible: true,
  collapsed: false,
  // Transform — metres + degrees, RealityKit-native.
  position: [...TRANSFORM_DEFAULTS.position],
  rotation: [...TRANSFORM_DEFAULTS.rotation],
  scale:    [...TRANSFORM_DEFAULTS.scale],
  // Visual components (all disabled by default — designer enables what
  // they need via the Components section). Cloning per-entity keeps the
  // registry's defaults pristine.
  components: buildDefaultComponents(),
  // Behaviors — array of { id, trigger:{type,params}, actions:[{id,type,params}] }
  // entries that fire only in Preview mode. The dummy `interaction`
  // single-trigger / single-action object that used to live here was
  // a UI placeholder; the real per-entity wiring lives in this array.
  behaviors: [],
  ...overrides
})

// AnchorEntity — pins the sub-tree to world / head / hand / plane / image
// / object space. Always the root of an entity sub-tree (RealityKit also
// lets anchors nest, which we permit).
export const makeAnchorEntity = (overrides = {}) => makeEntityBase('anchor', {
  name: 'Anchor',
  ...ANCHOR_DEFAULTS,
  ...overrides
})

// ModelEntity — mesh + materials. `meshType` defaults to 'box' so a fresh
// model entity is visible the moment it's added; the inspector swaps
// mesh-specific fields when meshType changes.
//
// Default position is 1.2 m above the entity's parent — typical chest
// height for a wearer in a volumetric scene. With the seed anchor
// pinned to the floor, this drops a fresh sphere / box / etc. dead in
// front of the wearer at eye-line, not on the floor.
export const makeModelEntity = (meshType = 'box', overrides = {}) => makeEntityBase('model', {
  name: capLabel('model'),
  meshType,
  // Splice the picked mesh's parameters in. `meshDefaults` deep-clones,
  // so editing one entity never bleeds into another.
  ...meshDefaults(meshType),
  position: [0, 1.2, 0],
  // RealityKit lets a mesh carry multiple sub-meshes, each with its own
  // material; we model that as an ordered array so the inspector can
  // add / remove / reorder material slots.
  materials: [makeMaterial('simple')],
  ...overrides
})

// Empty Entity — pure transform node. Useful as a parent for grouping.
export const makeGroupEntity = (overrides = {}) => makeEntityBase('group', {
  name: capLabel('group'),
  ...overrides
})

// Camera entity — designer-only marker for the wearer's viewpoint.
// Default placement: head height (1.6m), at world origin, looking at
// the front of a typical volumetric stage.
export const makeCameraEntity = (overrides = {}) => makeEntityBase('camera', {
  name: capLabel('camera'),
  position: [0, 1.6, 1.0],
  ...CAMERA_DEFAULTS,
  ...overrides
})

// Attachment entity — anchors a SwiftUI view to a 3D position. The
// `attachmentKind` chooses Text / Label / Button / Image; the rest of
// the fields are kind-specific (text content, color, font size, etc.).
// Exports as `Attachment(id:) { ... SwiftUI view ... }` inside the
// RealityView's `attachments:` closure.
export const makeAttachmentEntity = (attachmentKind = 'text', overrides = {}) => {
  const kindDefaults = ATTACHMENT_KINDS[attachmentKind]?.defaults || {}
  const label = ATTACHMENT_KINDS[attachmentKind]?.label || 'Attachment'
  return makeEntityBase('attachment', {
    name: label,
    ...ATTACHMENT_DEFAULTS,
    attachmentKind,
    ...kindDefaults,
    // Attachments float roughly 20cm above their parent's origin by
    // default — typical "label hovering above the model" placement.
    position: [0, 0.2, 0],
    ...overrides
  })
}

// Light entity — RealityKit lets any Entity carry a
// PointLight/Spot/Directional/IBL Component; we surface it as its
// own kind so it shows in Layers with a proper icon + inspector. The
// `lightType` sub-kind decides which component the exporter emits and
// which extra fields (inner/outer angle for spot, no range for
// directional, etc.) apply.
export const makeLightEntity = (lightType = 'point', overrides = {}) => {
  const typeDefaults = LIGHT_TYPES[lightType]?.defaults || {}
  const typeLabel = LIGHT_TYPES[lightType]?.label || 'Light'
  return makeEntityBase('light', {
    name: `${typeLabel} Light`,
    // Common defaults, then this specific type's defaults, then user
    // overrides. LIGHT_DEFAULTS carries the field shape so consumers
    // (renderer, inspector, exporter) can rely on every field
    // existing.
    ...LIGHT_DEFAULTS,
    lightType,
    ...typeDefaults,
    // Chest-height above the entity's parent — a fresh light drops in
    // where the wearer's eye can already see the affected geometry.
    position: [0, 1.2, 0],
    ...overrides
  })
}

// Generic dispatcher used by add-actions and the clipboard.
export const makeEntity = (entityKind, overrides = {}) => {
  if (entityKind === 'anchor') return makeAnchorEntity(overrides)
  if (entityKind === 'model')  return makeModelEntity(overrides.meshType || 'box', overrides)
  if (entityKind === 'camera') return makeCameraEntity(overrides)
  if (entityKind === 'attachment') return makeAttachmentEntity(overrides.attachmentKind || 'text', overrides)
  if (entityKind === 'light') return makeLightEntity(overrides.lightType || 'point', overrides)
  return makeGroupEntity(overrides)
}

// ---- initial scene ----

export function seedScene() {
  const tab = makeTab({ name: 'Main', icon: 'folder' })
  const w = makeWindow({ name: 'Main Window', parentId: tab.id })
  const stack = makeStack({
    parentId: w.id,
    stackType: 'vstack',
    alignment: 'center',
    spacing: 16,
    padding: 14,          // matches visionOS default window inset
    name: 'Content',
    // Fill the window so the content can be centred both axes.
    widthMode: 'fill',
    heightMode: 'fill'
  })
  const title = makePanel('text', {
    parentId: stack.id,
    name: 'Title',
    text: 'Welcome to Vision',
    textStyle: 'largeTitle',
    fontSize: textStyleToFontSize('largeTitle'),
    widthMode: 'fill',
    textAlign: 'center'
  })
  const subtitle = makePanel('text', {
    parentId: stack.id,
    name: 'Subtitle',
    text: 'Design spatial interfaces for Apple Vision Pro',
    textStyle: 'body',
    fontSize: textStyleToFontSize('body'),
    widthMode: 'fill',
    textAlign: 'center',
    // Secondary tracks the Scene → Colors palette, so retuning Secondary
    // updates every seed text using it. The plate sits over a translucent
    // glass now (#808080/30%), so the visionOS Secondary tier reads
    // cleanly against the studio backdrop.
    colorToken: 'secondary'
  })
  const button = makePanel('button', {
    parentId: stack.id,
    name: 'Primary Button',
    text: 'Get Started'
  })
  return { items: [tab, w, stack, title, subtitle, button], activeTabId: tab.id }
}

// ---- scene settings ----

export const DEFAULT_SCENE = {
  sceneMode: 'window',          // 'window' | 'volume' | 'immersive'
  windowPreset: 'regular',
  volumePreset: 'medium',
  colorScheme: 'dark',          // 'light' | 'dark' | 'image' — viewport bg
  backgroundImage: null,        // data URL (used when colorScheme==='image')
  // The designer's window plate is rendered as a near-white glass
  // (#ecedef) for both colour schemes, so we resolve content tokens
  // against the LIGHT palette by default — that keeps text dark,
  // list cards on `secondarySystemBackground` light, and the entire
  // window readable. Users who want a dark visionOS app can flip
  // this in Scene → Appearance.
  designScheme: 'light',
  tintColor: '#007aff',
  hdri: null,                   // null | drei Environment preset
  // Window mode renders inside the same 3D studio as volume mode — the
  // wearer's living-room view is the default so the designer immediately
  // sees how their window reads in space. The viewport's "VR View"
  // pill flips this off for a flat head-on plate when needed.
  preview3D: true,
  // Toggle a simulator-style demo scene (floor + scattered props) behind
  // the user's content. On by default for both modes so the designer
  // gets a sense of scale immediately.
  showDemoScene: true,
  // Preview mode — the canvas runs as if it were the deployed app.
  // Editing chrome (layers panel, properties panel, transform toolbar,
  // selection outlines) is hidden; the user interacts with their
  // panels and entities via mouse the same way a wearer would via
  // gaze + pinch. Toggled from the viewport's bottom Preview button.
  previewMode: false,
  // Window navigation. The editor can lay out multiple WindowGroups
  // side-by-side; preview shows just one centred in front of the
  // camera at a time. `primaryWindowId` is the entry point (null =
  // first window). `activeWindowId` tracks which window is *currently*
  // presented — a Button's tap action can mutate it to "navigate" to
  // a different window. Both null when there are no windows. On
  // preview exit, every window snaps back to its editor `position`
  // so the design layout is preserved.
  primaryWindowId: null,
  activeWindowId:  null,
  // Window-group navigation state. `activeWindowGroupId` is the
  // currently-selected pill in the leading-edge navigation capsule;
  // `openWindowItemIds` is the ordered list of window items currently
  // spawned (rendered side-by-side in preview). Both start null/[]
  // and are populated lazily — clicking a pill or firing an
  // `.openWindow(id:)` action seeds them on first use.
  activeWindowGroupId: null,
  openWindowItemIds:   [],
  // Lighting — designer-controllable ambient + key light. Defaults are
  // tuned so a fresh scene reads bright and well-lit without the user
  // needing to load an HDRI. The Scene → Lighting inspector exposes
  // these as sliders. Numbers chosen by eye against
  // MeshStandardMaterial; ACES tone-mapping flattens the top a little
  // so we can lean a bit hotter than 1.0.
  ambientLightIntensity: 0.7,
  keyLightIntensity:     0.5,
  // Key-light position in world space (metres). The light always targets
  // the stage centre at (0, 1.2, 0) — moving the position changes the
  // angle of the cast shadow on the floor without ever pointing the
  // light away from the wooden stool / hero object. Default sits high
  // and slightly forward so contact shadows fall mostly underneath
  // entities rather than across the back wall.
  keyLightPosition: [0, 4.5, 1.5],
  // Studio HDRI (drei `<Environment preset="...">`) for instant IBL
  // without the user picking a file. `null` defers to scene.hdri (a
  // bundled .hdr asset) when present, otherwise no environment.
  environmentPreset: 'apartment',  // null | 'studio' | 'apartment' | 'city' | 'park' | 'sunset' | 'warehouse' | 'forest' | 'lobby' | 'dawn' | 'night'
  // Realism toggles. Each is independent so designers can dial the
  // canvas down on lower-end machines (or up for screenshots).
  // Defaults are tuned for "looks great on a modern laptop" — turn off
  // any single one if frame-rate matters.
  bloom:           true,   // EffectComposer Bloom — emissive glow
  ssao:            false,  // EffectComposer SSAO — ambient occlusion (heavy)
  softShadows:     true,   // PCSS shadow softening
  contactShadows:  true,   // soft shadow disc under window-mode plates
  rimLights:       true,   // drei <Lightformer> studio rim lights in volume
  // ImmersiveSpace scene options (spec §3.1). Only consulted when
  // sceneMode === 'immersive'.
  //   immersionStyle: .mixed (default), .progressive, .full, .automatic
  //   progressiveRange: [min, max] for `.progressive(_:initialAmount:)`
  //   upperLimbVisibility: .automatic | .visible | .hidden
  //   preferredSurroundingsEffect: 'none' | 'systemDark' | 'colorMultiply'
  //   immersiveEnvironmentBehavior: 'automatic' (default) | 'coexist' (visionOS 26)
  immersionStyle: 'mixed',
  progressiveRange: [0.5, 1.0],
  progressiveInitial: 0.5,
  upperLimbVisibility: 'automatic',
  preferredSurroundingsEffect: 'none',
  surroundingsColorMultiply: '#000000',
  immersiveEnvironmentBehavior: 'automatic',
  // Designer-editable color palette. Seeded from the visionOS Figma kit
  // (see DEFAULT_SCENE_COLORS in appleSystem.js). Every panel that
  // carries a `colorToken` resolves through `resolveSemantic(token, scene)`
  // — so retuning a token here propagates to every consumer (text,
  // controls, view materials, separators) without touching individual
  // items. Use Scene → Materials & Colors to edit.
  colors: buildDefaultSceneColors(),
  // Per-material property overrides keyed by the MATERIAL_ORDER key
  // (glass, viewsRegular, ultraThin, …). Each entry can carry any of
  // `{ color, opacity, blur, blurAmount, innerShadow, dropShadow,
  //   layers }` — `resolveMaterial(key, scene.materialProps)` merges
  // these on top of MATERIALS defaults at draw time. Empty by default
  // so a fresh scene reads from the stock visionOS tiers.
  materialProps: {}
}
