import { create } from 'zustand'
import {
  TEXT_STYLES,
  WINDOW_PRESETS,
  VOLUME_PRESETS,
  WINDOW_CORNER_RADIUS,
  ORNAMENT_DEFAULTS,
  ptToUnits
} from './appleSystem'

let idCounter = 1
const nextId = (prefix = 'item') => `${prefix}-${idCounter++}`

const textStyleToFontSize = (style) => ptToUnits(TEXT_STYLES[style]?.pt ?? 17)

// ---- shared defaults (hoisted so factories below can reference them) ----

const DEFAULT_MODIFIERS = {
  opacity: 1.0,
  shadowColor: null,
  shadowRadius: 0,
  shadowX: 0,
  shadowY: 0,
  rotation: 0,
  scaleX: 1.0,
  scaleY: 1.0,
  offsetX: 0,
  offsetY: 0,
  borderColor: null,
  borderWidth: 0,
  disabled: false,
  clipShape: 'none'
}

const DEFAULT_STYLES = {
  toggleStyle: 'switch',
  pickerStyle: 'menu',
  labelStyle: 'titleAndIcon',
  textFieldStyle: 'roundedBorder',
  controlSize: 'regular',
  tableStyle: 'automatic'
}

const DEFAULT_ANIMATION = {
  curve: 'default',
  duration: 0.35,
  transition: 'opacity',
  springResponse: 0.55,
  springDamping: 0.825
}

const DEFAULT_ACCESSIBILITY = {
  label: '',
  hint: '',
  value: '',
  traits: [],
  isAccessibilityElement: true
}

const DEFAULT_ENVIRONMENT = {
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
const makeTab = (overrides = {}) => ({
  id: nextId('tab'),
  type: 'tab',
  name: 'Tab',
  icon: 'folder',     // SF Symbol name
  parentId: null,
  visible: true,
  collapsed: false,
  ...overrides
})

const makeWindow = (overrides = {}) => ({
  id: nextId('window'),
  type: 'window',
  name: 'Window',
  parentId: null,
  visible: true,
  collapsed: false,
  size: [ptToUnits(WINDOW_PRESETS.regular.width), ptToUnits(WINDOW_PRESETS.regular.height)],
  cornerRadius: ptToUnits(WINDOW_CORNER_RADIUS),
  position: [0, 2.5, -4.5],
  material: 'regular',
  colorToken: 'glassRegular',
  color: '#f2f2f7',
  spatial: {
    immersionStyle: 'mixed',
    hoverEffect: 'automatic',
    windowResizability: 'automatic',
    gestures: ['tap', 'drag']
  },
  environment: { ...DEFAULT_ENVIRONMENT },
  modifiers: { ...DEFAULT_MODIFIERS },
  ...overrides
})

const makeStack = (overrides = {}) => ({
  id: nextId('stack'),
  type: 'stack',
  stackType: 'vstack',
  alignment: 'center',
  spacing: 12,                // pt
  padding: 24,                // pt (uniform — used when paddingEdges is null)
  paddingEdges: null,         // { top, bottom, leading, trailing } in pt — overrides padding
  fixedWidth: null,
  fixedHeight: null,
  ornament: null,
  ornamentContentAlignment: 'center',
  ornamentVisibility: 'automatic',
  ornamentOffset: 0,
  background: null,
  material: 'regular',
  scrollable: false,
  // Grid-specific
  columns: 2,                 // for stackType 'grid'
  // Section-specific
  sectionHeader: '',          // for stackType 'section'
  sectionFooter: '',
  // Disclosure-specific
  expanded: true,             // for stackType 'disclosure'
  disclosureLabel: 'Section',
  // NavStack-specific
  activeChild: 0,             // for stackType 'navstack'
  navTitle: '',
  // TabView-specific
  activeTab: 0,               // for stackType 'tabview' — which Tab is visible
  // Tab-specific (child of tabview)
  tabLabel: '',               // display label for the tab
  tabIcon: null,              // SF Symbol name for the tab icon
  //
  modifiers: { ...DEFAULT_MODIFIERS },
  environment: { ...DEFAULT_ENVIRONMENT },
  name: 'VStack',
  parentId: null,
  visible: true,
  collapsed: false,
  ...overrides
})

const PANEL_DEFAULTS = {
  canvas: {
    size: [ptToUnits(240), ptToUnits(160)],
    color: '#ffffff',
    colorToken: 'systemBackground',
    cornerRadius: ptToUnits(16)
  },
  text: {
    size: null,           // null = auto-size from content (SwiftUI default)
    color: '#000000',
    colorToken: 'primary',
    cornerRadius: 0,
    text: 'Hello World',
    textStyle: 'body',
    fontSize: textStyleToFontSize('body'),
    fontWeight: 'regular',
    textAlign: 'left'
  },
  button: {
    size: [ptToUnits(180), ptToUnits(44)],
    color: '#e5e5ea',
    colorToken: 'secondarySystemFill',
    cornerRadius: ptToUnits(22),       // capsule
    text: 'Button',
    textStyle: 'body',
    fontSize: textStyleToFontSize('body'),
    fontWeight: 'semibold',
    textAlign: 'center',
    textColor: '#007aff',
    textColorToken: 'systemBlue',
    buttonStyle: 'bordered'
  },
  image: {
    size: [ptToUnits(320), ptToUnits(200)],
    color: '#c7c7cc',
    colorToken: 'tertiary',
    cornerRadius: ptToUnits(14),
    imageUrl: null          // blob URL or external URL
  },
  toggle: {
    size: [ptToUnits(52), ptToUnits(32)],
    color: '#34c759',
    colorToken: 'systemGreen',
    cornerRadius: ptToUnits(16),
    toggleOn: true
  },
  segmented: {
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
  slideshow: {
    size: [ptToUnits(360), ptToUnits(220)],
    color: '#e3e3e8',
    colorToken: 'systemFill',
    cornerRadius: ptToUnits(18),
    slideCount: 3,
    currentSlide: 0,
    text: 'Slideshow'
  },
  ticker: {
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
  search: {
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
  list: {
    size: [ptToUnits(360), ptToUnits(280)],
    color: '#ffffff',
    colorToken: 'systemBackground',
    cornerRadius: ptToUnits(14),
    rows: [
      { title: 'First Item',  subtitle: 'Subtitle text' },
      { title: 'Second Item', subtitle: 'Subtitle text' },
      { title: 'Third Item',  subtitle: 'Subtitle text' },
      { title: 'Fourth Item', subtitle: 'Subtitle text' }
    ],
    rowHeight: 60,
    listStyle: 'plain'  // 'plain' | 'inset' | 'sidebar'
  },
  table: {
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
  menu: {
    size: [ptToUnits(220), ptToUnits(192)],
    color: '#ffffff',
    colorToken: 'secondarySystemBackground',
    cornerRadius: ptToUnits(12),
    menuItems: ['Cut', 'Copy', 'Paste', 'Duplicate', 'Select All'],
    material: 'thick'
  },
  progress: {
    size: [ptToUnits(240), ptToUnits(8)],
    color: '#e3e3e8',
    colorToken: 'systemFill',
    cornerRadius: ptToUnits(4),
    value: 0.65,
    indeterminate: false
  },
  slider: {
    size: [ptToUnits(280), ptToUnits(28)],
    color: '#e3e3e8',
    colorToken: 'systemFill',
    cornerRadius: ptToUnits(2),
    sliderValue: 0.5
  },
  stepper: {
    size: [ptToUnits(130), ptToUnits(34)],
    color: '#e3e3e8',
    colorToken: 'systemFill',
    cornerRadius: ptToUnits(8),
    stepperValue: 5,
    stepperMin: 0,
    stepperMax: 10
  },
  gauge: {
    size: [ptToUnits(140), ptToUnits(80)],
    color: '#e3e3e8',
    colorToken: 'systemFill',
    cornerRadius: ptToUnits(8),
    value: 0.7,
    gaugeMin: 0,
    gaugeMax: 100,
    text: '70'
  },
  // Phase 1 — Layout primitives
  spacer: {
    size: [ptToUnits(20), ptToUnits(20)],
    color: '#00000000',
    colorToken: null,
    cornerRadius: 0,
    isSpacer: true        // flag for the layout engine to expand
  },
  divider: {
    size: [ptToUnits(300), ptToUnits(1)],
    color: '#c7c7cc',
    colorToken: 'tertiary',
    cornerRadius: 0
  },
  rectangle: {
    size: [ptToUnits(200), ptToUnits(140)],
    color: '#007aff',
    colorToken: 'systemBlue',
    cornerRadius: ptToUnits(12),
    strokeColor: null,
    strokeWidth: 0
  },
  circle: {
    size: [ptToUnits(120), ptToUnits(120)],
    color: '#34c759',
    colorToken: 'systemGreen',
    cornerRadius: 0,
    strokeColor: null,
    strokeWidth: 0
  },
  capsule: {
    size: [ptToUnits(200), ptToUnits(60)],
    color: '#af52de',
    colorToken: 'systemPurple',
    cornerRadius: 0,       // capsule auto-computes radius = min(w,h)/2
    strokeColor: null,
    strokeWidth: 0
  },
  // Phase 2 — Presentation
  sheet: {
    size: [ptToUnits(600), ptToUnits(400)],
    color: '#ffffff',
    colorToken: 'systemBackground',
    cornerRadius: ptToUnits(20),
    text: 'Sheet Content',
    sheetDetent: 'large',  // 'medium' | 'large'
    material: 'regular'
  },
  popover: {
    size: [ptToUnits(260), ptToUnits(180)],
    color: '#ffffff',
    colorToken: 'secondarySystemBackground',
    cornerRadius: ptToUnits(12),
    text: 'Popover',
    material: 'thick'
  },
  alert: {
    size: [ptToUnits(300), ptToUnits(180)],
    color: '#ffffff',
    colorToken: 'secondarySystemBackground',
    cornerRadius: ptToUnits(16),
    text: 'Alert Title',
    alertMessage: 'Are you sure you want to proceed?',
    alertButtons: ['Cancel', 'OK'],
    material: 'thick'
  },
  // Phase 3 — Views & Controls
  label: {
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
    iconColor: '#007aff'
  },
  textfield: {
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
  securefield: {
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
  texteditor: {
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
  picker: {
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
  datepicker: {
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
  colorpicker: {
    size: [ptToUnits(200), ptToUnits(36)],
    color: '#ffffff',
    colorToken: null,
    cornerRadius: 0,
    text: 'Color',
    pickedColor: '#ff3b30',
    textStyle: 'body',
    fontSize: textStyleToFontSize('body')
  },
  link: {
    size: [ptToUnits(200), ptToUnits(24)],
    color: '#007aff',
    colorToken: 'systemBlue',
    cornerRadius: 0,
    text: 'Open Link',
    textStyle: 'body',
    fontSize: textStyleToFontSize('body'),
    fontWeight: 'regular',
    textAlign: 'left'
  },
  asyncimage: {
    size: [ptToUnits(320), ptToUnits(200)],
    color: '#e3e3e8',
    colorToken: 'systemFill',
    cornerRadius: ptToUnits(14)
  },
  contentUnavailable: {
    size: [ptToUnits(320), ptToUnits(200)],
    color: '#ffffff',
    colorToken: 'systemBackground',
    cornerRadius: ptToUnits(16),
    text: 'No Results',
    alertMessage: 'Try a different search term.',
    textStyle: 'title3',
    fontSize: textStyleToFontSize('title3')
  },
  // Phase 4 — Collections
  form: {
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
  groupbox: {
    size: [ptToUnits(300), ptToUnits(160)],
    color: '#f2f2f7',
    colorToken: 'secondarySystemBackground',
    cornerRadius: ptToUnits(12),
    text: 'Settings',
    textStyle: 'headline',
    fontSize: textStyleToFontSize('headline')
  },
  outlinegroup: {
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
  // Phase 5 — Shapes & Drawing
  ellipse: {
    size: [ptToUnits(200), ptToUnits(140)],
    color: '#ff9500',
    colorToken: 'systemOrange',
    cornerRadius: 0,
    strokeColor: null,
    strokeWidth: 0
  },
  unevenRoundedRect: {
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
  path: {
    size: [ptToUnits(200), ptToUnits(200)],
    color: '#5856d6',
    colorToken: 'systemIndigo',
    cornerRadius: 0,
    strokeColor: null,
    strokeWidth: 0
  },
  linearGradient: {
    size: [ptToUnits(240), ptToUnits(160)],
    color: '#007aff',
    cornerRadius: ptToUnits(12),
    gradientFrom: '#007aff',
    gradientTo: '#af52de',
    gradientAngle: 180
  },
  radialGradient: {
    size: [ptToUnits(200), ptToUnits(200)],
    color: '#ff9500',
    cornerRadius: 0,
    gradientFrom: '#ffcc00',
    gradientTo: '#ff3b30'
  },
  angularGradient: {
    size: [ptToUnits(200), ptToUnits(200)],
    color: '#34c759',
    cornerRadius: 0,
    gradientFrom: '#34c759',
    gradientTo: '#007aff'
  }
}

const cap = (s) => s[0].toUpperCase() + s.slice(1)

const makePanel = (panelType, overrides = {}) => {
  const d = PANEL_DEFAULTS[panelType] || {}
  return {
    id: nextId('panel'),
    type: 'panel',
    panelType,
    name: `${cap(panelType)} ${idCounter}`,
    parentId: null,
    visible: true,
    position: [0, 0, 0],
    modifiers: { ...DEFAULT_MODIFIERS },
    styles: { ...DEFAULT_STYLES },
    animation: { ...DEFAULT_ANIMATION },
    accessibility: { ...DEFAULT_ACCESSIBILITY },
    symbolName: null,
    symbolRenderingMode: 'monochrome',
    symbolVariant: null,
    ...d,
    ...overrides
  }
}

// ---- initial scene ----

function seedScene() {
  const tab = makeTab({ name: 'Main', icon: 'folder' })
  const w = makeWindow({ name: 'Main Window', parentId: tab.id })
  const stack = makeStack({
    parentId: w.id,
    stackType: 'vstack',
    alignment: 'center',
    spacing: 16,
    padding: 48,
    name: 'Content'
  })
  const title = makePanel('text', {
    parentId: stack.id,
    name: 'Title',
    text: 'Welcome to Vision',
    textStyle: 'largeTitle',
    fontSize: textStyleToFontSize('largeTitle')
  })
  const subtitle = makePanel('text', {
    parentId: stack.id,
    name: 'Subtitle',
    text: 'Design spatial interfaces for Apple Vision Pro',
    textStyle: 'body',
    fontSize: textStyleToFontSize('body'),
    colorToken: 'secondary',
    color: '#8e8e93'
  })
  const button = makePanel('button', {
    parentId: stack.id,
    name: 'Primary Button',
    text: 'Get Started'
  })
  return { items: [tab, w, stack, title, subtitle, button], activeTabId: tab.id }
}

// ---- scene settings ----

const DEFAULT_SCENE = {
  sceneMode: 'window',          // 'window' | 'volume'
  windowPreset: 'regular',
  volumePreset: 'medium',
  colorScheme: 'light',         // viewport background only
  designScheme: 'light',        // resolves semantic tokens in the design
  tintColor: '#007aff',
  hdri: null                    // null | drei Environment preset
}

// ---- tree helpers ----

const isDescendantOf = (items, parentId, candidateId) => {
  if (!parentId) return false
  if (parentId === candidateId) return true
  const p = items.find((it) => it.id === parentId)
  return p ? isDescendantOf(items, p.parentId, candidateId) : false
}

const findParent = (items, id) => items.find((it) => it.id === id)?.parentId

// Walks up from the current selection to find the owning Window. Falls back
// to the first Window in the active tab so "add ornament/toolbar" targets the
// page the user is actually editing.
const findTargetWindow = (state) => {
  let cur = state.items.find((it) => it.id === state.selectedId)
  while (cur && cur.type !== 'window' && cur.parentId) {
    cur = state.items.find((it) => it.id === cur.parentId)
  }
  if (cur?.type === 'window') return cur
  return state.items.find((it) => it.type === 'window' && it.parentId === state.activeTabId)
      ?? state.items.find((it) => it.type === 'window')
}

// Walks up from any item to find the Tab it belongs to.
const findOwningTab = (items, id) => {
  let cur = items.find((it) => it.id === id)
  while (cur) {
    if (cur.type === 'tab') return cur
    if (!cur.parentId) return null
    cur = items.find((it) => it.id === cur.parentId)
  }
  return null
}

// ---- undo / redo helpers ----
// Snapshot captures only the data that undoable mutations touch.
// UI-only state (isDragging, clipboard, editingId) is excluded.
const MAX_UNDO = 50

const snapshot = (s) => ({
  items: s.items.map((it) => ({ ...it })),
  selectedId: s.selectedId,
  activeTabId: s.activeTabId,
  scene: { ...s.scene },
  idCounter
})

// Wraps a zustand set() call so it pushes an undo snapshot first.
// During drags we skip snapshots — drag-start captures one instead.
const undoable = (set, get, fn) => {
  const s = get()
  if (!s.isDragging) {
    const snap = snapshot(s)
    const past = [...s._past, snap].slice(-MAX_UNDO)
    set({ _past: past, _future: [] })
  }
  set(fn)
}

// ---- store ----

const _seed = seedScene()

export const useStore = create((set, get) => ({
  items: _seed.items,
  activeTabId: _seed.activeTabId,
  selectedId: null,
  editingId: null,
  isDragging: false,
  clipboard: null,
  showGrid: true,
  panMode: false,
  scene: { ...DEFAULT_SCENE },
  zoomDistance: 7.0,      // synced from OrbitControls for the zoom slider

  // Undo / redo stacks (internal, not rendered directly)
  _past: [],
  _future: [],

  undo: () => set((s) => {
    if (s._past.length === 0) return s
    const prev = s._past[s._past.length - 1]
    const future = [snapshot(s), ...s._future].slice(0, MAX_UNDO)
    idCounter = prev.idCounter ?? idCounter
    return {
      _past: s._past.slice(0, -1),
      _future: future,
      items: prev.items,
      selectedId: prev.selectedId,
      activeTabId: prev.activeTabId,
      scene: prev.scene
    }
  }),

  redo: () => set((s) => {
    if (s._future.length === 0) return s
    const next = s._future[0]
    const past = [...s._past, snapshot(s)].slice(-MAX_UNDO)
    idCounter = next.idCounter ?? idCounter
    return {
      _future: s._future.slice(1),
      _past: past,
      items: next.items,
      selectedId: next.selectedId,
      activeTabId: next.activeTabId,
      scene: next.scene
    }
  }),

  setDragging: (v) => {
    const s = get()
    // Capture one snapshot at drag-start so the whole drag is a single undo step.
    if (v && !s.isDragging) {
      const snap = snapshot(s)
      set({ isDragging: true, _past: [...s._past, snap].slice(-MAX_UNDO), _future: [] })
    } else {
      set({ isDragging: v })
    }
  },

  setZoomDistance: (d) => set({ zoomDistance: d }),
  select: (id) => set({ selectedId: id, editingId: null }),
  setEditing: (id) => set({ editingId: id, selectedId: id }),
  clearEditing: () => set({ editingId: null }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  togglePanMode: () => set((s) => ({ panMode: !s.panMode })),

  // ---- tabs (pages) ----

  // Switch the active tab. Clears selection so the Properties panel doesn't
  // keep pointing at an item in a now-hidden tab.
  selectTab: (id) => set((s) => {
    if (!s.items.find((it) => it.id === id && it.type === 'tab')) return s
    return { activeTabId: id, selectedId: null, editingId: null }
  }),

  addTab: ({ name, icon } = {}) => undoable(set, get, (s) => {
    const count = s.items.filter((it) => it.type === 'tab').length
    const tab = makeTab({
      name: name || `Tab ${count + 1}`,
      icon: icon || 'folder'
    })
    return {
      items: [...s.items, tab],
      activeTabId: tab.id,
      selectedId: tab.id
    }
  }),

  // Remove a tab and every window/stack/panel it owns. Keeps at least one tab
  // in the scene — if the user tries to remove the last one, we leave it.
  removeTab: (id) => undoable(set, get, (s) => {
    const tabs = s.items.filter((it) => it.type === 'tab')
    if (tabs.length <= 1) return s
    const toRemove = new Set([id])
    let changed = true
    while (changed) {
      changed = false
      for (const it of s.items) {
        if (!toRemove.has(it.id) && it.parentId && toRemove.has(it.parentId)) {
          toRemove.add(it.id)
          changed = true
        }
      }
    }
    const nextItems = s.items.filter((it) => !toRemove.has(it.id))
    const nextTabs = nextItems.filter((it) => it.type === 'tab')
    const nextActive = s.activeTabId === id ? nextTabs[0]?.id ?? null : s.activeTabId
    return {
      items: nextItems,
      activeTabId: nextActive,
      selectedId: toRemove.has(s.selectedId) ? null : s.selectedId
    }
  }),

  renameTab: (id, name) => undoable(set, get, (s) => ({
    items: s.items.map((it) =>
      it.id === id && it.type === 'tab' ? { ...it, name } : it
    )
  })),

  setTabIcon: (id, icon) => undoable(set, get, (s) => ({
    items: s.items.map((it) =>
      it.id === id && it.type === 'tab' ? { ...it, icon } : it
    )
  })),

  updateScene: (patch) => undoable(set, get, (s) => {
    const next = { ...s.scene, ...patch }
    // Apply preset size changes to the root window.
    const items = s.items.map((it) => {
      if (it.type !== 'window') return it
      if (patch.windowPreset && next.sceneMode === 'window') {
        const p = WINDOW_PRESETS[patch.windowPreset]
        if (p) return { ...it, size: [ptToUnits(p.width), ptToUnits(p.height)] }
      }
      if (patch.volumePreset && next.sceneMode === 'volume') {
        const p = VOLUME_PRESETS[patch.volumePreset]
        if (p) return { ...it, size: [ptToUnits(p.width), ptToUnits(p.height)] }
      }
      return it
    })
    return { scene: next, items }
  }),

  // ---- adding items ----

  addPanel: (panelType) => undoable(set, get, (s) => {
    // New panels live inside the current selection's nearest stack, or the
    // first stack in the active tab's first window if nothing relevant is
    // selected. Tabs are not valid panel parents — they only hold windows.
    let parentId = null
    const sel = s.items.find((it) => it.id === s.selectedId)
    if (sel) {
      if (sel.type === 'stack') parentId = sel.id
      else if (sel.type === 'window') {
        const firstStack = s.items.find((it) => it.parentId === sel.id && it.type === 'stack')
        parentId = firstStack ? firstStack.id : sel.id
      } else if (sel.type === 'tab') {
        // fall through to window-lookup below
      } else {
        parentId = sel.parentId
      }
    }
    if (!parentId) {
      const firstWindow = s.items.find(
        (it) => it.type === 'window' && it.parentId === s.activeTabId
      ) ?? s.items.find((it) => it.type === 'window')
      const firstStack = firstWindow && s.items.find(
        (it) => it.parentId === firstWindow.id && it.type === 'stack'
      )
      parentId = firstStack ? firstStack.id : firstWindow?.id
    }
    if (!parentId) return s
    const p = makePanel(panelType, { parentId })
    return { items: [...s.items, p], selectedId: p.id }
  }),

  addStack: (stackType = 'vstack') => undoable(set, get, (s) => {
    const sel = s.items.find((it) => it.id === s.selectedId)
    let parentId = null
    if (sel?.type === 'stack' || sel?.type === 'window') parentId = sel.id
    else if (sel && sel.type !== 'tab') parentId = sel.parentId
    if (!parentId) {
      const firstWindow = s.items.find(
        (it) => it.type === 'window' && it.parentId === s.activeTabId
      ) ?? s.items.find((it) => it.type === 'window')
      parentId = firstWindow?.id
    }
    if (!parentId) return s
    const label = { vstack: 'VStack', hstack: 'HStack', zstack: 'ZStack' }[stackType] || 'Stack'
    const stk = makeStack({ parentId, stackType, name: label })
    return { items: [...s.items, stk], selectedId: stk.id }
  }),

  addWindow: () => undoable(set, get, (s) => {
    // Windows belong to a Tab. Parent new windows to the active tab so they
    // appear on the page the user is editing. Positioning is relative to
    // other windows already on that tab.
    let parentTabId = s.activeTabId
    if (!parentTabId || !s.items.find((it) => it.id === parentTabId && it.type === 'tab')) {
      parentTabId = s.items.find((it) => it.type === 'tab')?.id
    }
    if (!parentTabId) return s
    const windows = s.items.filter(
      (it) => it.type === 'window' && it.parentId === parentTabId
    )
    let x = 0, y = 2.5, z = -4.5
    if (windows.length > 0) {
      let rightmost = windows[0]
      for (const win of windows) {
        if (win.position[0] > rightmost.position[0]) rightmost = win
      }
      const gap = 0.3
      x = rightmost.position[0] + (rightmost.size[0] / 2) + gap + 3.2
      y = rightmost.position[1]
      z = rightmost.position[2]
    }
    const w = makeWindow({ parentId: parentTabId, position: [x, y, z] })
    return { items: [...s.items, w], selectedId: w.id }
  }),

  // Add an in-window TabView (SwiftUI `TabView { Tab { ... } }`). Creates the
  // container plus 2 default Tabs. Not to be confused with the top-level page
  // tabs — this is the inline tab bar that lives inside a Window.
  addTabView: () => undoable(set, get, (s) => {
    const sel = s.items.find((it) => it.id === s.selectedId)
    let parentId = null
    if (sel?.type === 'stack' || sel?.type === 'window') parentId = sel.id
    else if (sel && sel.type !== 'tab') parentId = sel.parentId
    if (!parentId) {
      const firstWindow = s.items.find(
        (it) => it.type === 'window' && it.parentId === s.activeTabId
      ) ?? s.items.find((it) => it.type === 'window')
      parentId = firstWindow?.id
    }
    if (!parentId) return s
    const tabView = makeStack({
      parentId,
      stackType: 'tabview',
      name: 'Tab View',
      activeTab: 0,
      spacing: 0,
      padding: 0,
      alignment: 'center'
    })
    const tab1 = makeStack({
      parentId: tabView.id,
      stackType: 'tab',
      name: 'Tab 1',
      tabLabel: 'Tab 1',
      tabIcon: 'star',
      alignment: 'leading',
      spacing: 12,
      padding: 24
    })
    const tab2 = makeStack({
      parentId: tabView.id,
      stackType: 'tab',
      name: 'Tab 2',
      tabLabel: 'Tab 2',
      tabIcon: 'heart',
      alignment: 'leading',
      spacing: 12,
      padding: 24
    })
    return { items: [...s.items, tabView, tab1, tab2], selectedId: tabView.id }
  }),

  // Add a Navigation Bar ornament with N button items. Creates a top-bar
  // ornament on the current window with the requested height and labels.
  addNavBar: ({ height = 56, labels = ['Home', 'Search', 'Profile'] } = {}) => undoable(set, get, (s) => {
    const win = findTargetWindow(s)
    if (!win) return s
    const bar = makeStack({
      parentId: win.id,
      stackType: 'hstack',
      ornament: 'top',
      name: 'Navigation Bar',
      background: 'glassThick',
      fixedHeight: height,
      padding: 12,
      spacing: 16,
      alignment: 'center'
    })
    const buttonPt = Math.max(28, height - 24)
    const btns = labels.map((label) => makePanel('button', {
      parentId: bar.id,
      name: label,
      text: label,
      textStyle: 'callout',
      fontSize: textStyleToFontSize('callout'),
      fontWeight: 'semibold',
      size: [ptToUnits(Math.max(70, label.length * 11 + 24)), ptToUnits(buttonPt)],
      cornerRadius: ptToUnits(buttonPt / 2),
      buttonStyle: 'plain',
      color: '#ffffff',
      colorToken: null,
      textColor: '#007aff',
      textColorToken: 'systemBlue'
    }))
    return { items: [...s.items, bar, ...btns], selectedId: bar.id }
  }),

  // Add a Tab Bar ornament with N page buttons.
  addTabBar: ({ pages = 4, labels = ['Home', 'Search', 'Library', 'Profile'] } = {}) => undoable(set, get, (s) => {
    const win = findTargetWindow(s)
    if (!win) return s
    const effective = labels.slice(0, pages)
    while (effective.length < pages) effective.push(`Tab ${effective.length + 1}`)
    const bar = makeStack({
      parentId: win.id,
      stackType: 'hstack',
      ornament: 'bottom',
      name: 'Tab Bar',
      background: 'glassThick',
      fixedHeight: 64,
      padding: 10,
      spacing: 22,
      alignment: 'center'
    })
    const tabs = effective.map((label) => makePanel('button', {
      parentId: bar.id,
      name: label,
      text: label,
      textStyle: 'caption',
      fontSize: textStyleToFontSize('caption'),
      fontWeight: 'medium',
      size: [ptToUnits(76), ptToUnits(44)],
      cornerRadius: ptToUnits(22),
      buttonStyle: 'plain',
      color: '#ffffff',
      colorToken: null,
      textColor: '#000000',
      textColorToken: 'primary'
    }))
    return { items: [...s.items, bar, ...tabs], selectedId: bar.id }
  }),

  // Add a generic Toolbar ornament at any placement with a list of items.
  addToolbar: ({ placement = 'top', items = ['Action 1', 'Action 2', 'Action 3'] } = {}) => undoable(set, get, (s) => {
    const win = findTargetWindow(s)
    if (!win) return s
    const stackType = (placement === 'leading' || placement === 'trailing') ? 'vstack' : 'hstack'
    const bar = makeStack({
      parentId: win.id,
      stackType,
      ornament: placement,
      name: 'Toolbar',
      background: 'glassThick',
      material: 'thick',
      fixedHeight: stackType === 'hstack' ? 52 : null,
      fixedWidth:  stackType === 'vstack' ? 52 : null,
      padding: 10,
      spacing: 14,
      alignment: 'center'
    })
    const buttons = items.map((label) => makePanel('button', {
      parentId: bar.id,
      name: label,
      text: label,
      textStyle: 'footnote',
      fontSize: textStyleToFontSize('footnote'),
      fontWeight: 'semibold',
      size: [ptToUnits(Math.max(56, label.length * 10 + 20)), ptToUnits(32)],
      cornerRadius: ptToUnits(16),
      buttonStyle: 'plain',
      color: '#ffffff',
      colorToken: null,
      textColor: '#007aff',
      textColorToken: 'systemBlue'
    }))
    return { items: [...s.items, bar, ...buttons], selectedId: bar.id }
  }),

  // Attach a floating ornament (capsule bar) to the current Window. Vertical
  // ornaments (leading / trailing) are seeded with two default tabs so they
  // read as a tab bar out of the box; the cross-axis size is fixed (the pill
  // width) but the long axis is left auto so the bar grows with tab count —
  // matching Apple's HIG.
  addOrnament: (placement) => undoable(set, get, (s) => {
    const sel = s.items.find((it) => it.id === s.selectedId)
    let cur = sel
    while (cur && cur.type !== 'window' && cur.parentId) {
      cur = s.items.find((it) => it.id === cur.parentId)
    }
    const targetWindow =
      cur?.type === 'window'
        ? cur
        : s.items.find(
            (it) => it.type === 'window' && it.parentId === s.activeTabId
          ) ?? s.items.find((it) => it.type === 'window')
    if (!targetWindow) return s
    const d = ORNAMENT_DEFAULTS[placement]
    if (!d) return s

    const isVertical = placement === 'leading' || placement === 'trailing'
    const barW = isVertical ? 60 : null                         // fixed short axis
    const barH = isVertical ? null : d.height                   // long axis auto for vertical

    const stk = makeStack({
      parentId: targetWindow.id,
      stackType: d.stackType,
      name: d.name,
      ornament: placement,
      fixedWidth: isVertical ? barW : d.width,
      fixedHeight: barH,
      padding: isVertical ? 8 : d.padding,
      spacing: isVertical ? 6 : d.spacing,
      alignment: 'center',
      background: 'glassThick'
    })

    // Seed vertical bars with two default tab buttons so they look/feel like
    // tab bars from the moment they're created. Horizontal ornaments stay
    // empty — users typically populate those with toolbar actions.
    const children = []
    if (isVertical) {
      for (const label of ['Home', 'Library']) {
        children.push(makePanel('button', {
          parentId: stk.id,
          name: label,
          text: label,
          textStyle: 'caption',
          fontSize: textStyleToFontSize('caption'),
          fontWeight: 'medium',
          size: [ptToUnits(44), ptToUnits(44)],
          cornerRadius: ptToUnits(22),
          buttonStyle: 'plain',
          color: '#ffffff',
          colorToken: null,
          textColor: '#000000',
          textColorToken: 'primary'
        }))
      }
    }

    return { items: [...s.items, stk, ...children], selectedId: stk.id }
  }),

  // Create a Navigation Split View — a Window containing an HStack that
  // holds two VStacks (Sidebar + Content) sized to fill the window.
  addSplitView: () => undoable(set, get, (s) => {
    const sideW = 340
    const contentW = 1160
    const fullW = sideW + contentW     // 1500pt
    const fullH = 900
    const w = makeWindow({
      name: 'Split View',
      size: [ptToUnits(fullW), ptToUnits(fullH)],
      position: [Math.random() * 1.5 - 0.75, 2.5, -4.5]
    })
    const root = makeStack({
      parentId: w.id,
      stackType: 'hstack',
      name: 'Split Root',
      spacing: 0,
      padding: 0,
      fixedWidth: fullW,
      fixedHeight: fullH,
      alignment: 'center'
    })
    const sidebar = makeStack({
      parentId: root.id,
      stackType: 'vstack',
      name: 'Sidebar',
      spacing: 8,
      padding: 24,
      fixedWidth: sideW,
      fixedHeight: fullH,
      alignment: 'leading',
      background: 'secondarySystemBackground'
    })
    const content = makeStack({
      parentId: root.id,
      stackType: 'vstack',
      name: 'Detail',
      spacing: 16,
      padding: 48,
      fixedWidth: contentW,
      fixedHeight: fullH,
      alignment: 'center'
    })
    const sidebarItem = makePanel('text', {
      parentId: sidebar.id,
      name: 'Sidebar Title',
      text: 'Sidebar',
      textStyle: 'headline',
      fontSize: textStyleToFontSize('headline'),
      size: [ptToUnits(sideW - 48), ptToUnits(28)],
      textAlign: 'left'
    })
    const contentTitle = makePanel('text', {
      parentId: content.id,
      name: 'Title',
      text: 'Detail View',
      textStyle: 'largeTitle',
      fontSize: textStyleToFontSize('largeTitle'),
      size: [ptToUnits(contentW - 96), ptToUnits(50)]
    })
    const contentBody = makePanel('text', {
      parentId: content.id,
      name: 'Body',
      text: 'Select an item from the sidebar',
      textStyle: 'body',
      fontSize: textStyleToFontSize('body'),
      colorToken: 'secondary',
      color: '#8e8e93',
      size: [ptToUnits(contentW - 96), ptToUnits(28)]
    })
    return {
      items: [...s.items, w, root, sidebar, content, sidebarItem, contentTitle, contentBody],
      selectedId: w.id
    }
  }),

  // Presentation: add a sheet/alert/popover as a child of the current Window.
  addPresentation: (panelType) => undoable(set, get, (s) => {
    const win = findTargetWindow(s)
    if (!win) return s
    const p = makePanel(panelType, { parentId: win.id })
    return { items: [...s.items, p], selectedId: p.id }
  }),

  removeItem: (id) => undoable(set, get, (s) => {
    const target = s.items.find((it) => it.id === id)
    if (!target) return s
    // Route tab removal through removeTab so we preserve the "keep at least
    // one tab" invariant.
    if (target.type === 'tab') {
      const tabs = s.items.filter((it) => it.type === 'tab')
      if (tabs.length <= 1) return s
      const toRemove = new Set([id])
      let changed = true
      while (changed) {
        changed = false
        for (const it of s.items) {
          if (!toRemove.has(it.id) && it.parentId && toRemove.has(it.parentId)) {
            toRemove.add(it.id); changed = true
          }
        }
      }
      const nextItems = s.items.filter((it) => !toRemove.has(it.id))
      const nextTabs = nextItems.filter((it) => it.type === 'tab')
      return {
        items: nextItems,
        activeTabId: s.activeTabId === id ? nextTabs[0]?.id ?? null : s.activeTabId,
        selectedId: toRemove.has(s.selectedId) ? null : s.selectedId
      }
    }

    const toRemove = new Set([id])
    let changed = true
    while (changed) {
      changed = false
      for (const it of s.items) {
        if (!toRemove.has(it.id) && it.parentId && toRemove.has(it.parentId)) {
          toRemove.add(it.id)
          changed = true
        }
      }
    }
    // Repair `activeTab`/`activeChild` on any container whose indexed child
    // is being removed, so nothing renders past the end of the visible set.
    const items = s.items
      .filter((it) => !toRemove.has(it.id))
      .map((it) => {
        if (it.type !== 'stack') return it
        if (it.stackType === 'tabview') {
          const tabs = s.items.filter(
            (c) => c.parentId === it.id && !toRemove.has(c.id)
          )
          if (tabs.length > 0 && (it.activeTab ?? 0) >= tabs.length) {
            return { ...it, activeTab: Math.max(0, tabs.length - 1) }
          }
        }
        if (it.stackType === 'navstack') {
          const kids = s.items.filter(
            (c) => c.parentId === it.id && !toRemove.has(c.id)
          )
          if (kids.length > 0 && (it.activeChild ?? 0) >= kids.length) {
            return { ...it, activeChild: Math.max(0, kids.length - 1) }
          }
        }
        return it
      })
    return {
      items,
      selectedId: toRemove.has(s.selectedId) ? null : s.selectedId
    }
  }),

  updateItem: (id, patch) => undoable(set, get, (s) => ({
    items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it))
  })),

  // Switch a panel's panelType while preserving shared fields (position,
  // modifiers, etc.). Size is taken from the new type's default so each
  // variant gets sensible dimensions — the user can still resize afterwards.
  switchPanelType: (id, newType) => undoable(set, get, (s) => {
    const defaults = PANEL_DEFAULTS[newType] || {}
    return {
      items: s.items.map((it) => {
        if (it.id !== id || it.type !== 'panel') return it
        // Start from the new type's defaults, then layer identity/placement/
        // meta from the original. Order matters: defaults first, identity last.
        return {
          ...defaults,
          id: it.id,
          type: 'panel',
          panelType: newType,
          name: it.name,
          parentId: it.parentId,
          visible: it.visible,
          position: it.position,
          modifiers: it.modifiers,
          styles: it.styles,
          animation: it.animation,
          accessibility: it.accessibility
        }
      })
    }
  }),

  applyTextStyle: (id, styleKey) => undoable(set, get, (s) => {
    const style = TEXT_STYLES[styleKey]
    if (!style) return s
    return {
      items: s.items.map((it) =>
        it.id === id
          ? {
              ...it,
              textStyle: styleKey,
              fontSize: ptToUnits(style.pt),
              fontWeight: style.weight
            }
          : it
      )
    }
  }),

  renameItem: (id, name) => undoable(set, get, (s) => ({
    items: s.items.map((it) => (it.id === id ? { ...it, name } : it))
  })),

  toggleVisibility: (id) => undoable(set, get, (s) => ({
    items: s.items.map((it) => (it.id === id ? { ...it, visible: !it.visible } : it))
  })),

  toggleCollapse: (id) => set((s) => ({
    items: s.items.map((it) => (it.id === id ? { ...it, collapsed: !it.collapsed } : it))
  })),

  moveItem: (sourceId, targetId, mode) => undoable(set, get, (s) => {
    if (!sourceId || !targetId || sourceId === targetId) return s
    const src = s.items.find((it) => it.id === sourceId)
    const tgt = s.items.find((it) => it.id === targetId)
    if (!src || !tgt) return s
    if (src.type === 'tab') return s  // tabs stay top-level
    if (isDescendantOf(s.items, tgt.id, src.id)) return s

    // A Window can only be re-parented to a Tab.
    if (src.type === 'window') {
      if (mode === 'inside' && tgt.type !== 'tab') return s
      if (mode !== 'inside' && tgt.type !== 'window') return s
    }

    const items = s.items.filter((it) => it.id !== sourceId)
    let newParentId
    let insertIdx
    // Allowed "inside" targets: stack, window, or tab (the latter only for windows).
    const canDropInside =
      (tgt.type === 'stack' || tgt.type === 'window' || tgt.type === 'tab')
    if (mode === 'inside' && canDropInside) {
      newParentId = tgt.id
      let last = items.findIndex((it) => it.id === targetId)
      for (let i = last + 1; i < items.length; i++) {
        if (items[i].parentId === tgt.id) last = i
      }
      insertIdx = last + 1
    } else {
      newParentId = tgt.parentId
      const tIdx = items.findIndex((it) => it.id === targetId)
      insertIdx = mode === 'before' ? tIdx : tIdx + 1
    }
    if (!newParentId) return s  // can't orphan (windows must live under a tab)
    const moved = { ...src, parentId: newParentId }
    items.splice(insertIdx, 0, moved)

    // Auto-expand the destination container so the moved row doesn't appear
    // to vanish into a collapsed folder.
    const items2 = items.map((it) =>
      it.id === newParentId && it.collapsed ? { ...it, collapsed: false } : it
    )
    return { items: items2 }
  }),

  // Stash a deep subtree snapshot on the clipboard so paste can reproduce the
  // full hierarchy (was previously losing children of a copied stack).
  copyItem: (id) => set((s) => {
    const root = s.items.find((it) => it.id === id)
    if (!root || root.type === 'tab' || root.type === 'window') return s
    const collect = (parentId) =>
      s.items.filter((it) => it.parentId === parentId).flatMap((c) => [c, ...collect(c.id)])
    const subtree = [root, ...collect(root.id)].map((it) => ({ ...it }))
    return { clipboard: { rootId: root.id, items: subtree } }
  }),

  pasteItem: () => undoable(set, get, (s) => {
    if (!s.clipboard) return s
    // Back-compat with the old single-item shape.
    if (!s.clipboard.items) {
      const c = s.clipboard
      const newItem = {
        ...c,
        id: nextId(c.type === 'panel' ? 'panel' : 'stack'),
        name: `${c.name} copy`
      }
      return { items: [...s.items, newItem], selectedId: newItem.id }
    }

    const { rootId, items: subtree } = s.clipboard
    const idMap = new Map()
    for (const it of subtree) {
      const prefix = it.type === 'panel' ? 'panel' : it.type === 'stack' ? 'stack' : it.type
      idMap.set(it.id, nextId(prefix))
    }

    // Drop the paste into the selection if it's a valid parent, otherwise
    // reparent to the original root's parent (usually its former sibling).
    const oldRoot = subtree.find((it) => it.id === rootId)
    const sel = s.items.find((it) => it.id === s.selectedId)
    let newRootParent = oldRoot?.parentId ?? null
    if (sel && (sel.type === 'stack' || sel.type === 'window')) {
      newRootParent = sel.id
    }

    const cloned = subtree.map((it) => ({
      ...it,
      id: idMap.get(it.id),
      parentId: it.id === rootId
        ? newRootParent
        : idMap.get(it.parentId) ?? it.parentId,
      name: it.id === rootId ? `${it.name} copy` : it.name
    }))
    const newRootId = idMap.get(rootId)
    return {
      items: [...s.items, ...cloned],
      selectedId: newRootId
    }
  })
}))

export const isEffectivelyVisible = (items, id) => {
  let cur = items.find((it) => it.id === id)
  while (cur) {
    if (!cur.visible) return false
    if (!cur.parentId) return true
    cur = items.find((it) => it.id === cur.parentId)
  }
  return true
}
