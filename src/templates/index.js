// Sample templates surfaced on the splash screen. Each template is a pure
// function that returns `{ items, activeTabId }` — same shape as
// factories.seedScene — and the store's `applyTemplate` action replaces the
// current scene with whatever the template produces.
//
// Templates are window-mode only for now; the splash hides them when the
// user picks Volume mode. Each one stays small and focused so the user can
// scan it in one read and tweak it from there.

import { ptToUnits, VOLUME_PRESETS } from '../appleSystem'
import {
  makeTab, makeWindow, makeStack, makePanel,
  makeAnchorEntity, makeModelEntity, makeGroupEntity,
  makeAttachmentEntity,
  textStyleToFontSize
} from '../store/factories'

// ---- Blank ------------------------------------------------------------
// Minimum viable scene: one tab, one window, one fill-and-fit VStack.
function blank() {
  const tab = makeTab({ name: 'Main', icon: 'folder' })
  const w   = makeWindow({ name: 'Main Window', parentId: tab.id })
  const stk = makeStack({
    parentId: w.id, name: 'Content',
    stackType: 'vstack', alignment: 'center', spacing: 16, padding: 14,
    widthMode: 'fill', heightMode: 'fill'
  })
  return { items: [tab, w, stk], activeTabId: tab.id }
}

// ---- Welcome ----------------------------------------------------------
// The current default seed (kept as a template so users can come back to
// it after picking something else).
function welcome() {
  const tab = makeTab({ name: 'Main', icon: 'folder' })
  const w   = makeWindow({ name: 'Main Window', parentId: tab.id })
  const stk = makeStack({
    parentId: w.id, name: 'Content',
    stackType: 'vstack', alignment: 'center', spacing: 16, padding: 14,
    widthMode: 'fill', heightMode: 'fill'
  })
  const title = makePanel('text', {
    parentId: stk.id, name: 'Title', text: 'Welcome to Vision',
    textStyle: 'largeTitle', fontSize: textStyleToFontSize('largeTitle'),
    widthMode: 'fill', textAlign: 'center'
  })
  const sub = makePanel('text', {
    parentId: stk.id, name: 'Subtitle',
    text: 'Design spatial interfaces for Apple Vision Pro',
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    widthMode: 'fill', textAlign: 'center',
    colorToken: null, color: '#3a3a3c'
  })
  const btn = makePanel('button', {
    parentId: stk.id, name: 'Primary Button', text: 'Get Started'
  })
  return { items: [tab, w, stk, title, sub, btn], activeTabId: tab.id }
}

// ---- Settings ---------------------------------------------------------
// Inset-grouped list with a couple of toggles + a slider — the canonical
// "settings sheet" shape Apple uses across system apps.
function settings() {
  const tab = makeTab({ name: 'Settings', icon: 'gearshape' })
  const w   = makeWindow({ name: 'Settings', parentId: tab.id })
  const stk = makeStack({
    parentId: w.id, name: 'Content',
    stackType: 'vstack', alignment: 'leading', spacing: 12, padding: 24,
    widthMode: 'fill', heightMode: 'fill'
  })
  const title = makePanel('text', {
    parentId: stk.id, name: 'Title', text: 'Settings',
    textStyle: 'largeTitle', fontSize: textStyleToFontSize('largeTitle'),
    fontWeight: 'bold', widthMode: 'fill'
  })
  const list = makePanel('list', {
    parentId: stk.id, name: 'General',
    listStyle: 'insetGrouped',
    rows: [
      { title: 'Account',       subtitle: 'Signed in as you@example.com' },
      { title: 'Notifications', subtitle: 'Allowed' },
      { title: 'Appearance',    subtitle: 'Automatic' },
      { title: 'Privacy',       subtitle: '' }
    ]
  })
  const toggle = makePanel('toggle', {
    parentId: stk.id, name: 'Wi-Fi', text: 'Wi-Fi', toggleOn: true
  })
  const slider = makePanel('slider', {
    parentId: stk.id, name: 'Volume', sliderValue: 0.65
  })
  return { items: [tab, w, stk, title, list, toggle, slider], activeTabId: tab.id }
}

// ---- Onboarding -------------------------------------------------------
// Hero image + title + body + CTA — the standard first-run pattern.
function onboarding() {
  const tab = makeTab({ name: 'Welcome', icon: 'sparkles' })
  const w   = makeWindow({ name: 'Welcome', parentId: tab.id })
  const stk = makeStack({
    parentId: w.id, name: 'Content',
    stackType: 'vstack', alignment: 'center', spacing: 24, padding: 40,
    widthMode: 'fill', heightMode: 'fill'
  })
  const hero = makePanel('image', {
    parentId: stk.id, name: 'Hero',
    size: [ptToUnits(420), ptToUnits(260)]
  })
  const title = makePanel('text', {
    parentId: stk.id, name: 'Title', text: 'A new way to see your work',
    textStyle: 'largeTitle', fontSize: textStyleToFontSize('largeTitle'),
    fontWeight: 'bold', textAlign: 'center', widthMode: 'fill'
  })
  const body = makePanel('text', {
    parentId: stk.id, name: 'Body',
    text: 'Sign in with your Apple Account to sync across all your devices.',
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    textAlign: 'center', widthMode: 'fill',
    colorToken: 'secondary'
  })
  const btn = makePanel('button', {
    parentId: stk.id, name: 'Continue', text: 'Continue',
    buttonStyle: 'borderedProminent'
  })
  return { items: [tab, w, stk, hero, title, body, btn], activeTabId: tab.id }
}

// ---- Tab Bar App ------------------------------------------------------
// Bottom-anchored Tab Bar ornament + content stub. The tab bar pattern is
// SwiftUI's `TabView { Tab(...) ... }`, but we set it up as a window with
// an ornament so the canvas shows the chrome the user expects.
function tabBarApp() {
  const tab = makeTab({ name: 'App', icon: 'square.stack' })
  const w   = makeWindow({ name: 'App', parentId: tab.id })
  // Inner content
  const stk = makeStack({
    parentId: w.id, name: 'Content',
    stackType: 'vstack', alignment: 'center', spacing: 16, padding: 24,
    widthMode: 'fill', heightMode: 'fill'
  })
  const title = makePanel('text', {
    parentId: stk.id, name: 'Title', text: 'Home',
    textStyle: 'largeTitle', fontSize: textStyleToFontSize('largeTitle'),
    fontWeight: 'bold', textAlign: 'center', widthMode: 'fill'
  })
  const body = makePanel('text', {
    parentId: stk.id, name: 'Body',
    text: 'The active tab\u2019s content lives here. Switch tabs in the bar below.',
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    textAlign: 'center', widthMode: 'fill', colorToken: 'secondary'
  })
  // Bottom tab-bar ornament with 4 pages
  const bar = makeStack({
    parentId: w.id, stackType: 'hstack',
    ornament: 'bottom', name: 'Tab Bar',
    background: 'glassThick',
    fixedHeight: 64, padding: 10, spacing: 22, alignment: 'center',
    widthMode: 'fit', heightMode: 'fixed'
  })
  const tabLabels = ['Home', 'Search', 'Library', 'Profile']
  const tabIcons  = ['house', 'magnifyingglass', 'books.vertical', 'person.crop.circle']
  const tabs = tabLabels.map((label, i) => makePanel('button', {
    parentId: bar.id, name: label, text: label,
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    fontWeight: 'medium',
    size: [ptToUnits(76), ptToUnits(44)],
    cornerRadius: ptToUnits(22),
    buttonStyle: 'plain',
    color: '#ffffff', colorToken: null,
    textColor: '#000000', textColorToken: 'primary',
    symbolName: tabIcons[i] || null
  }))
  return {
    items: [tab, w, stk, title, body, bar, ...tabs],
    activeTabId: tab.id
  }
}

// ---- Sidebar App ------------------------------------------------------
// In-window NavigationSplitView (joined). The store's `addSplitView`
// helper produces this same shape — we duplicate it inline so the
// template stays self-contained and doesn't depend on store actions.
function sidebarApp() {
  const tab = makeTab({ name: 'Mail', icon: 'envelope' })
  const w   = makeWindow({ name: 'Mail', parentId: tab.id })
  const root = makeStack({
    parentId: w.id, stackType: 'hstack',
    name: 'NavigationSplitView',
    spacing: 0, padding: 0,
    widthMode: 'fill', heightMode: 'fill', alignment: 'center',
    splitStyle: 'joined', columnVisibility: 'all',
    searchable: 'sidebar', searchPrompt: 'Search'
  })
  const sidebar = makeStack({
    parentId: root.id, stackType: 'vstack', name: 'Sidebar',
    spacing: 4, padding: 16,
    widthMode: 'fixed', heightMode: 'fill', fixedWidth: 320,
    alignment: 'leading',
    background: '#6b6e70', material: 'thin'
  })
  const detail = makeStack({
    parentId: root.id, stackType: 'vstack', name: 'Detail',
    spacing: 16, padding: 48,
    widthMode: 'fill', heightMode: 'fill', alignment: 'center'
  })
  const search = makePanel('search', {
    parentId: sidebar.id, name: 'Search', text: 'Search',
    widthMode: 'fill',
    size: [ptToUnits(288), ptToUnits(36)]
  })
  const sidebarHeader = makePanel('text', {
    parentId: sidebar.id, name: 'Sidebar Header', text: 'Mailboxes',
    textStyle: 'title3', fontSize: textStyleToFontSize('title3'),
    fontWeight: 'bold', textAlign: 'left', widthMode: 'fill',
    colorToken: 'primary', color: '#000000'
  })
  const navLabels = ['Inbox', 'Starred', 'Drafts', 'Sent', 'Archive']
  const navIcons  = ['tray', 'star', 'doc', 'paperplane', 'archivebox']
  const navRows = navLabels.map((label, i) => makePanel('button', {
    parentId: sidebar.id, name: label, text: label,
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    size: [ptToUnits(288), ptToUnits(40)],
    cornerRadius: ptToUnits(10),
    buttonStyle: 'plain',
    color: '#ffffff', colorToken: null,
    textColor: '#000000', textColorToken: 'primary',
    textAlign: 'left',
    symbolName: navIcons[i] || null
  }))
  const detailTitle = makePanel('text', {
    parentId: detail.id, name: 'Title', text: 'Inbox',
    textStyle: 'largeTitle', fontSize: textStyleToFontSize('largeTitle'),
    fontWeight: 'bold', textAlign: 'center', widthMode: 'fill'
  })
  const detailBody = makePanel('text', {
    parentId: detail.id, name: 'Body',
    text: 'Pick a message to read it here.',
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    colorToken: 'secondary', textAlign: 'center', widthMode: 'fill'
  })
  return {
    items: [
      tab, w,
      root, sidebar, detail,
      search, sidebarHeader, ...navRows,
      detailTitle, detailBody
    ],
    activeTabId: tab.id
  }
}

// ---- Volume templates -------------------------------------------------
//
// Volumetric scene seeds. Each starts with a volumetric `WindowGroup` (the
// "stage" the user sees in the simulator) plus an `AnchorEntity` so the
// inspector has a sensible default selection. Sizes default to the medium
// volume preset (≈1m on a side) — a comfortable scale for desk-sized
// content in the visionOS simulator.

const volumeWindow = (overrides = {}) => {
  const p = VOLUME_PRESETS.medium
  return makeWindow({
    name: 'Volume',
    windowStyle: 'volumetric',
    size: [ptToUnits(p.width), ptToUnits(p.height)],
    // Position in metres (1 unit = 1m): chest height, 60cm forward —
    // matches visionOS default for a volumetric WindowGroup.
    position: [0, 1.0, -0.6],
    color: '#202024',
    colorToken: null,
    cornerRadius: ptToUnits(24),
    ...overrides
  })
}

// Empty volumetric stage with a single anchor at world origin. Smallest
// volume seed — gives the user a clean canvas to add entities into.
function emptyVolume() {
  const tab = makeTab({ name: 'Volume', icon: 'cube' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Volume' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })
  return { items: [tab, w, anchor], activeTabId: tab.id }
}

// Single hero object — a sphere on a base. The most common visionOS volume
// pattern (think the Earth widget, or a single 3D model showcase).
function singleObject() {
  const tab = makeTab({ name: 'Volume', icon: 'cube' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Hero Object' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })
  const sphere = makeModelEntity('sphere', {
    parentId: anchor.id,
    name: 'Hero Sphere',
    sphereRadius: 0.12,
    position: [0, 0.18, 0]
  })
  // Slightly metallic + warm tint so it reads as "polished hero object"
  // rather than a default white blob.
  sphere.materials = [{
    id: 'mat-hero-1', type: 'simple',
    baseColor: '#d0a060', baseColorTextureName: null,
    roughness: 0.32, isMetallic: true
  }]
  // A flat plinth disc underneath for visual grounding.
  const base = makeModelEntity('cylinder', {
    parentId: anchor.id,
    name: 'Plinth',
    cylinderRadius: 0.18,
    cylinderHeight: 0.02,
    position: [0, 0.01, 0]
  })
  base.materials = [{
    id: 'mat-base-1', type: 'simple',
    baseColor: '#3a3a3c', baseColorTextureName: null,
    roughness: 0.7, isMetallic: false
  }]
  return { items: [tab, w, anchor, sphere, base], activeTabId: tab.id }
}

// Labelled hero — single object on a plinth with a Text + Button
// attachment hovering above. Demonstrates the most common visionOS
// volume pattern: a 3D model with floating SwiftUI labels.
function labelledHero() {
  const tab = makeTab({ name: 'Volume', icon: 'cube' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Labelled Hero' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })

  // Glossy hero sphere on a flat plinth.
  const sphere = makeModelEntity('sphere', {
    parentId: anchor.id, name: 'Hero Sphere',
    sphereRadius: 0.14,
    position: [0, 0.20, 0]
  })
  sphere.materials = [{
    id: 'mat-hero-1', type: 'physicallyBased',
    baseColor: '#3a78ff', baseColorTextureName: null,
    roughness: 0.18, roughnessTextureName: null,
    metallic: 0.85, metallicTextureName: null,
    normalTextureName: null, ambientOcclusionTextureName: null,
    emissiveColor: '#000000', emissiveIntensity: 0,
    emissiveTextureName: null,
    clearcoat: 0.6, clearcoatRoughness: 0.1,
    sheenColor: '#000000',
    blending: 'opaque', opacityThreshold: null,
    faceCulling: 'back',
    textureCoordinateTransform: { offsetU: 0, offsetV: 0, scaleU: 1, scaleV: 1, rotation: 0 }
  }]
  const base = makeModelEntity('cylinder', {
    parentId: anchor.id, name: 'Plinth',
    cylinderRadius: 0.20, cylinderHeight: 0.025,
    position: [0, 0.012, 0]
  })
  base.materials = [{
    id: 'mat-base-2', type: 'simple',
    baseColor: '#1c1c1e', baseColorTextureName: null,
    roughness: 0.7, isMetallic: false
  }]

  // Floating title attachment above the sphere.
  const title = makeAttachmentEntity('text', {
    parentId: anchor.id, name: 'Title Label',
    position: [0, 0.55, 0],
    attachmentText: 'Sphere',
    attachmentFontSize: 0.06,
    attachmentBackground: '#0c0c0e',
    attachmentColor: '#ffffff',
    attachmentBillboard: true
  })

  // Tap-to-rotate button below the sphere.
  const cta = makeAttachmentEntity('button', {
    parentId: anchor.id, name: 'Action Button',
    position: [0, 0.45, 0.22],
    attachmentText: 'Rotate',
    attachmentFontSize: 0.04,
    attachmentBackground: '#0a84ff',
    attachmentColor: '#ffffff',
    attachmentBillboard: true
  })

  return {
    items: [tab, w, anchor, sphere, base, title, cta],
    activeTabId: tab.id
  }
}

// Multi-anchor showcase — three colour swatches each with a label
// attachment, arranged in a row. Demonstrates managing several
// attachments + entities together (e.g. a product configurator).
function showcase() {
  const tab = makeTab({ name: 'Volume', icon: 'cube' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Showcase' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })

  const items = [tab, w, anchor]
  const swatches = [
    { label: 'Crimson', color: '#e63946', x: -0.32 },
    { label: 'Sage',    color: '#83a87a', x:  0.00 },
    { label: 'Sand',    color: '#e9c46a', x:  0.32 }
  ]
  for (const s of swatches) {
    const cube = makeModelEntity('box', {
      parentId: anchor.id, name: s.label,
      boxSize: [0.14, 0.14, 0.14],
      boxCornerRadius: 0.015,
      position: [s.x, 0.20, 0]
    })
    cube.materials = [{
      id: `mat-show-${s.label}`, type: 'simple',
      baseColor: s.color, baseColorTextureName: null,
      roughness: 0.45, isMetallic: false
    }]
    items.push(cube)
    const lbl = makeAttachmentEntity('text', {
      parentId: anchor.id, name: `${s.label} Label`,
      position: [s.x, 0.42, 0],
      attachmentText: s.label,
      attachmentFontSize: 0.038,
      attachmentBackground: '#0c0c0e',
      attachmentColor: '#ffffff',
      attachmentBillboard: true
    })
    items.push(lbl)
  }
  return { items, activeTabId: tab.id }
}

// Diorama — a small grouped scene with a couple of primitives arranged
// like a tiny tableau. Demonstrates entity grouping + multi-material.
function diorama() {
  const tab = makeTab({ name: 'Volume', icon: 'cube' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Diorama' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })
  const stage = makeGroupEntity({ parentId: anchor.id, name: 'Stage' })
  // Backing wall — flat upright plane behind the props.
  const wall = makeModelEntity('plane', {
    parentId: stage.id, name: 'Wall',
    planeWidth: 0.8, planeDepth: 0.5,
    position: [0, 0.25, -0.15],
    rotation: [90, 0, 0]
  })
  wall.materials = [{
    id: 'mat-wall-1', type: 'simple',
    baseColor: '#7a8aa0', roughness: 0.85, isMetallic: false
  }]
  // Three towers of varying heights — classic diorama silhouette.
  const towerColors = ['#e07a5f', '#81b29a', '#f2cc8f']
  const towers = towerColors.map((c, i) => {
    const tower = makeModelEntity('box', {
      parentId: stage.id, name: `Tower ${i + 1}`,
      boxSize: [0.08, 0.10 + i * 0.06, 0.08],
      position: [-0.18 + i * 0.18, (0.10 + i * 0.06) / 2, 0]
    })
    tower.materials = [{
      id: `mat-tower-${i}`, type: 'simple',
      baseColor: c, roughness: 0.55, isMetallic: false
    }]
    return tower
  })
  return {
    items: [tab, w, anchor, stage, wall, ...towers],
    activeTabId: tab.id
  }
}

// ---- Public registry --------------------------------------------------

export const TEMPLATES = {
  // Window-mode
  blank:        { mode: 'window', label: 'Blank',         description: 'Empty window with a single fill stack.',                    build: blank },
  welcome:      { mode: 'window', label: 'Welcome',       description: 'Title, subtitle, and a primary action.',                    build: welcome },
  settings:     { mode: 'window', label: 'Settings',      description: 'Inset-grouped list with toggles and a slider.',             build: settings },
  onboarding:   { mode: 'window', label: 'Onboarding',    description: 'Hero image, title, body, and a continue button.',           build: onboarding },
  tabBar:       { mode: 'window', label: 'Tab Bar App',   description: 'Window with a bottom Tab Bar ornament (4 pages).',          build: tabBarApp },
  sidebar:      { mode: 'window', label: 'Sidebar App',   description: 'NavigationSplitView (joined) with a sidebar + detail.',     build: sidebarApp },
  // Volume-mode
  emptyVolume:   { mode: 'volume', label: 'Empty Volume',   description: 'Volumetric stage with a single world anchor.',              build: emptyVolume },
  singleObject:  { mode: 'volume', label: 'Single Object',  description: 'A polished sphere on a plinth — the Earth-widget pattern.', build: singleObject },
  labelledHero:  { mode: 'volume', label: 'Hero + Labels',  description: 'Glossy sphere with floating SwiftUI title + Tap action — RealityView attachments.', build: labelledHero },
  showcase:      { mode: 'volume', label: 'Showcase',       description: 'Three colour swatches with floating labels — product configurator pattern.', build: showcase },
  diorama:       { mode: 'volume', label: 'Diorama',        description: 'Grouped scene: backing wall + three towers in primary colours.', build: diorama }
}

export const TEMPLATE_ORDER_WINDOW = [
  'blank', 'welcome', 'settings', 'onboarding', 'tabBar', 'sidebar'
]
export const TEMPLATE_ORDER_VOLUME = [
  'emptyVolume', 'singleObject', 'labelledHero', 'showcase', 'diorama'
]
// Backwards compatibility — older imports refer to a flat order list.
export const TEMPLATE_ORDER = [...TEMPLATE_ORDER_WINDOW, ...TEMPLATE_ORDER_VOLUME]

// Returns the ordered template keys for a given scene mode. Used by the
// splash to show only the templates that fit the active picker.
export const templateOrderForMode = (mode) =>
  mode === 'volume' ? TEMPLATE_ORDER_VOLUME : TEMPLATE_ORDER_WINDOW

// Returns a fresh `{ items, activeTabId }` for the given template key. The
// caller (store.applyTemplate) replaces the scene with this output.
export function buildTemplate(key) {
  const t = TEMPLATES[key]
  if (!t) return null
  return t.build()
}
