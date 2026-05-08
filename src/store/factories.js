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
  ptToUnits
} from '../appleSystem'
import { panelDefaults } from '../panels/registry'
import {
  ANCHOR_DEFAULTS,
  TRANSFORM_DEFAULTS,
  CAMERA_DEFAULTS,
  ATTACHMENT_DEFAULTS,
  ATTACHMENT_KINDS,
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

export const makeWindow = (overrides = {}) => ({
  id: nextId('window'),
  type: 'window',
  name: 'Window',
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
  material: 'regular',
  colorToken: 'designWindow',
  color: '#9ea1a2',
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
  // Volume metadata — only consulted when windowStyle === 'volumetric'.
  volumeDepthMeters: 1.0,           // .defaultSize depth in meters
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
export const makeModelEntity = (meshType = 'box', overrides = {}) => makeEntityBase('model', {
  name: capLabel('model'),
  meshType,
  // Splice the picked mesh's parameters in. `meshDefaults` deep-clones,
  // so editing one entity never bleeds into another.
  ...meshDefaults(meshType),
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

// Generic dispatcher used by add-actions and the clipboard.
export const makeEntity = (entityKind, overrides = {}) => {
  if (entityKind === 'anchor') return makeAnchorEntity(overrides)
  if (entityKind === 'model')  return makeModelEntity(overrides.meshType || 'box', overrides)
  if (entityKind === 'camera') return makeCameraEntity(overrides)
  if (entityKind === 'attachment') return makeAttachmentEntity(overrides.attachmentKind || 'text', overrides)
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
    // The design-scheme window uses a #9ea1a2 fill, so semantic 'secondary'
    // (#8e8e93 in dark) vanishes into the glass. A darker #3a3a3c reads
    // clearly on both the dark-scheme and light-scheme window colours.
    colorToken: null,
    color: '#3a3a3c'
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
  designScheme: 'dark',         // resolves semantic tokens in the design.
                                // visionOS defaults to dark glass + white
                                // primary text, so we match that out-of-box.
  tintColor: '#007aff',
  hdri: null,                   // null | drei Environment preset
  // Legacy gate from the experimental window-mode 3D preview camera.
  // Kept for window mode (the 2D / 3D viewport toggle still drives it);
  // volume mode renders the canvas directly without consulting this.
  preview3D: false,
  // Toggle a simulator-style demo scene (floor + scattered props) behind
  // any volumetric content. Off by default so a brand-new project starts
  // clean; users flip it on from the viewport overlay when they want a
  // sense of scale.
  showDemoScene: true,
  // Lighting — designer-controllable ambient + key light. Defaults are
  // tuned so a fresh scene reads bright and well-lit without the user
  // needing to load an HDRI. The Scene → Lighting inspector exposes
  // these as sliders. Numbers chosen by eye against
  // MeshStandardMaterial; ACES tone-mapping flattens the top a little
  // so we can lean a bit hotter than 1.0.
  ambientLightIntensity: 1.4,
  keyLightIntensity:     0.9,
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
  immersiveEnvironmentBehavior: 'automatic'
}
