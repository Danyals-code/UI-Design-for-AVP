// Sample templates surfaced on the splash screen. Each template is a pure
// function that returns `{ items, activeTabId }` — same shape as
// factories.seedScene — and the store's `applyTemplate` action replaces the
// current scene with whatever the template produces.
//
// The set is intentionally lopsided toward "real-app" shapes: a Blank
// starter for users who'd rather build from scratch, then templates that
// each demonstrate a different production-grade pattern (NavigationSplit,
// volumetric scenes with attachments, dashboards, settings, etc.).

import { ptToUnits, VOLUME_PRESETS } from '../appleSystem'
import {
  makeTab, makeWindow, makeStack, makePanel,
  makeAnchorEntity, makeModelEntity, makeGroupEntity,
  makeAttachmentEntity,
  textStyleToFontSize
} from '../store/factories'

// ---- Blank -----------------------------------------------------------
// Minimum viable scene: one tab, one window, one fill-and-fit VStack.
// Useful for users who want to start from a blank canvas.
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

// ---- Music Player ----------------------------------------------------
// Now Playing card: hero artwork plate, track + artist labels, transport
// controls (prev / play / next), and a queue list below. Demonstrates
// stacked layout with mixed widths, SF symbols on buttons, and an
// inset-grouped list driven from data.
function musicPlayer() {
  const tab = makeTab({ name: 'Music', icon: 'music.note' })
  const w   = makeWindow({ name: 'Now Playing', parentId: tab.id })
  const root = makeStack({
    parentId: w.id, name: 'Content',
    stackType: 'vstack', alignment: 'center', spacing: 18, padding: 24,
    widthMode: 'fill', heightMode: 'fill'
  })

  // Hero artwork — square image plate at the top.
  const artwork = makePanel('image', {
    parentId: root.id, name: 'Artwork',
    size: [ptToUnits(220), ptToUnits(220)],
    cornerRadius: ptToUnits(16),
    color: '#5b3aa8', colorToken: null
  })

  // Track / artist text block.
  const trackInfo = makeStack({
    parentId: root.id, name: 'Track Info',
    stackType: 'vstack', alignment: 'center', spacing: 4, padding: 0,
    widthMode: 'fill', heightMode: 'fit'
  })
  const trackTitle = makePanel('text', {
    parentId: trackInfo.id, name: 'Track Title', text: 'Midnight City',
    textStyle: 'title2', fontSize: textStyleToFontSize('title2'),
    fontWeight: 'semibold', textAlign: 'center', widthMode: 'fill'
  })
  const trackArtist = makePanel('text', {
    parentId: trackInfo.id, name: 'Artist', text: 'M83',
    textStyle: 'subheadline', fontSize: textStyleToFontSize('subheadline'),
    textAlign: 'center', widthMode: 'fill', colorToken: 'secondary'
  })

  // Scrubber.
  const scrubber = makePanel('slider', {
    parentId: root.id, name: 'Scrubber', sliderValue: 0.42,
    widthMode: 'fill'
  })

  // Transport controls — Prev / Play / Next as a horizontal row.
  const transport = makeStack({
    parentId: root.id, name: 'Transport',
    stackType: 'hstack', alignment: 'center', spacing: 28, padding: 6,
    widthMode: 'fit', heightMode: 'fit'
  })
  const prev = makePanel('button', {
    parentId: transport.id, name: 'Prev', text: '',
    size: [ptToUnits(52), ptToUnits(52)],
    cornerRadius: ptToUnits(26),
    buttonStyle: 'plain',
    color: '#ffffff', colorToken: null,
    symbolName: 'backward.fill'
  })
  const play = makePanel('button', {
    parentId: transport.id, name: 'Play', text: '',
    size: [ptToUnits(64), ptToUnits(64)],
    cornerRadius: ptToUnits(32),
    buttonStyle: 'borderedProminent',
    symbolName: 'play.fill'
  })
  const next = makePanel('button', {
    parentId: transport.id, name: 'Next', text: '',
    size: [ptToUnits(52), ptToUnits(52)],
    cornerRadius: ptToUnits(26),
    buttonStyle: 'plain',
    color: '#ffffff', colorToken: null,
    symbolName: 'forward.fill'
  })

  // Up Next list.
  const queueHeader = makePanel('text', {
    parentId: root.id, name: 'Up Next', text: 'Up Next',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    fontWeight: 'semibold', widthMode: 'fill', colorToken: 'secondary'
  })
  const queue = makePanel('list', {
    parentId: root.id, name: 'Queue',
    listStyle: 'insetGrouped',
    rows: [
      { title: 'Reckoner',         subtitle: 'Radiohead' },
      { title: 'Strawberry Swing', subtitle: 'Coldplay' },
      { title: 'Heartbeats',       subtitle: 'The Knife' },
      { title: 'Holocene',         subtitle: 'Bon Iver' }
    ]
  })

  return {
    items: [
      tab, w, root,
      artwork,
      trackInfo, trackTitle, trackArtist,
      scrubber,
      transport, prev, play, next,
      queueHeader, queue
    ],
    activeTabId: tab.id
  }
}

// ---- Smart Home Dashboard --------------------------------------------
// Header + horizontal row of room cards + scenes ZStack + a status toggle.
// Covers nested HStacks, sized cards, and mixed control types.
function smartHome() {
  const tab = makeTab({ name: 'Home', icon: 'house.fill' })
  const w   = makeWindow({ name: 'Smart Home', parentId: tab.id })
  const root = makeStack({
    parentId: w.id, name: 'Content',
    stackType: 'vstack', alignment: 'leading', spacing: 18, padding: 24,
    widthMode: 'fill', heightMode: 'fill'
  })

  const greeting = makePanel('text', {
    parentId: root.id, name: 'Greeting', text: 'Good evening',
    textStyle: 'largeTitle', fontSize: textStyleToFontSize('largeTitle'),
    fontWeight: 'bold', widthMode: 'fill'
  })
  const status = makePanel('text', {
    parentId: root.id, name: 'Status',
    text: '4 lights on · 2 devices charging · climate set to 21°',
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    widthMode: 'fill', colorToken: 'secondary'
  })

  // Room cards row.
  const sectionLabel = makePanel('text', {
    parentId: root.id, name: 'Rooms Header', text: 'ROOMS',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    fontWeight: 'semibold', widthMode: 'fill', colorToken: 'secondary'
  })
  const rooms = makeStack({
    parentId: root.id, name: 'Rooms',
    stackType: 'hstack', alignment: 'center', spacing: 12, padding: 0,
    widthMode: 'fill', heightMode: 'fit'
  })
  const roomData = [
    { name: 'Living Room', icon: 'sofa', summary: '3 lights' },
    { name: 'Kitchen',     icon: 'fork.knife', summary: '2 devices' },
    { name: 'Bedroom',     icon: 'bed.double', summary: 'Climate 20°' },
    { name: 'Studio',      icon: 'music.mic', summary: 'Idle' }
  ]
  const roomItems = []
  for (const r of roomData) {
    const card = makeStack({
      parentId: rooms.id, name: r.name,
      stackType: 'vstack', alignment: 'leading', spacing: 6, padding: 14,
      widthMode: 'fill', heightMode: 'fixed', fixedHeight: 110,
      background: 'glassRegular',
      cornerRadius: ptToUnits(18)
    })
    const icon = makePanel('label', {
      parentId: card.id, name: `${r.name} Icon`, text: '',
      symbolName: r.icon, textStyle: 'title2',
      fontSize: textStyleToFontSize('title2'),
      colorToken: 'primary'
    })
    const title = makePanel('text', {
      parentId: card.id, name: `${r.name} Title`, text: r.name,
      textStyle: 'headline', fontSize: textStyleToFontSize('headline'),
      fontWeight: 'semibold', widthMode: 'fill'
    })
    const sub = makePanel('text', {
      parentId: card.id, name: `${r.name} Sub`, text: r.summary,
      textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
      widthMode: 'fill', colorToken: 'secondary'
    })
    roomItems.push(card, icon, title, sub)
  }

  // Scenes row of pill buttons.
  const scenesLabel = makePanel('text', {
    parentId: root.id, name: 'Scenes Header', text: 'SCENES',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    fontWeight: 'semibold', widthMode: 'fill', colorToken: 'secondary'
  })
  const scenes = makeStack({
    parentId: root.id, name: 'Scenes',
    stackType: 'hstack', alignment: 'center', spacing: 10, padding: 0,
    widthMode: 'fit', heightMode: 'fit'
  })
  const sceneData = ['Movie Night', 'Bright', 'Focus', 'Sleep']
  const sceneItems = sceneData.map((label) => makePanel('button', {
    parentId: scenes.id, name: label, text: label,
    textStyle: 'subheadline',
    fontSize: textStyleToFontSize('subheadline'),
    size: [ptToUnits(120), ptToUnits(40)],
    cornerRadius: ptToUnits(20),
    buttonStyle: 'plain',
    color: '#ffffff', colorToken: null,
    textColor: '#000000', textColorToken: 'primary'
  }))

  // Quick toggle row.
  const quickToggle = makePanel('toggle', {
    parentId: root.id, name: 'Away Mode', text: 'Away Mode', toggleOn: false
  })

  return {
    items: [
      tab, w, root,
      greeting, status,
      sectionLabel, rooms, ...roomItems,
      scenesLabel, scenes, ...sceneItems,
      quickToggle
    ],
    activeTabId: tab.id
  }
}

// ---- Settings (rich) -------------------------------------------------
// Multi-section settings page — search bar, account header, feature
// toggles, sliders, and a "danger zone" group. Mirrors the depth of an
// actual visionOS Settings sheet.
function settings() {
  const tab = makeTab({ name: 'Settings', icon: 'gearshape.fill' })
  const w   = makeWindow({ name: 'Settings', parentId: tab.id })
  const root = makeStack({
    parentId: w.id, name: 'Content',
    stackType: 'vstack', alignment: 'leading', spacing: 14, padding: 24,
    widthMode: 'fill', heightMode: 'fill'
  })
  const title = makePanel('text', {
    parentId: root.id, name: 'Title', text: 'Settings',
    textStyle: 'largeTitle', fontSize: textStyleToFontSize('largeTitle'),
    fontWeight: 'bold', widthMode: 'fill'
  })
  const search = makePanel('search', {
    parentId: root.id, name: 'Search', text: 'Search settings',
    widthMode: 'fill',
    size: [ptToUnits(360), ptToUnits(36)]
  })

  // Account header card.
  const accountCard = makeStack({
    parentId: root.id, name: 'Account',
    stackType: 'hstack', alignment: 'center', spacing: 12, padding: 14,
    widthMode: 'fill', heightMode: 'fit',
    background: 'glassRegular',
    cornerRadius: ptToUnits(14)
  })
  const avatar = makePanel('image', {
    parentId: accountCard.id, name: 'Avatar',
    size: [ptToUnits(48), ptToUnits(48)],
    cornerRadius: ptToUnits(24),
    color: '#0a84ff', colorToken: null
  })
  const acctLabels = makeStack({
    parentId: accountCard.id, name: 'Account Labels',
    stackType: 'vstack', alignment: 'leading', spacing: 2, padding: 0,
    widthMode: 'fill', heightMode: 'fit'
  })
  const acctName = makePanel('text', {
    parentId: acctLabels.id, name: 'Account Name', text: 'Danyal Sarfraz',
    textStyle: 'headline', fontSize: textStyleToFontSize('headline'),
    fontWeight: 'semibold', widthMode: 'fill'
  })
  const acctMail = makePanel('text', {
    parentId: acctLabels.id, name: 'Account Mail',
    text: 'you@icloud.com',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    widthMode: 'fill', colorToken: 'secondary'
  })

  // General list.
  const general = makePanel('list', {
    parentId: root.id, name: 'General',
    listStyle: 'insetGrouped',
    rows: [
      { title: 'About',         subtitle: 'visionOS 2.0 (build 22N130)' },
      { title: 'Software Update', subtitle: 'Up to date' },
      { title: 'Storage',       subtitle: '128 GB used of 256 GB' },
      { title: 'Privacy',       subtitle: 'On-device processing' }
    ]
  })

  // Display group.
  const displayHeader = makePanel('text', {
    parentId: root.id, name: 'Display Header', text: 'DISPLAY',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    fontWeight: 'semibold', widthMode: 'fill', colorToken: 'secondary'
  })
  const brightness = makePanel('slider', {
    parentId: root.id, name: 'Brightness', sliderValue: 0.78
  })
  const nightShift = makePanel('toggle', {
    parentId: root.id, name: 'Night Shift', text: 'Night Shift',
    toggleOn: true
  })
  const trueTone = makePanel('toggle', {
    parentId: root.id, name: 'True Tone', text: 'True Tone',
    toggleOn: true
  })

  // Connectivity group.
  const connectHeader = makePanel('text', {
    parentId: root.id, name: 'Connect Header', text: 'CONNECTIVITY',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    fontWeight: 'semibold', widthMode: 'fill', colorToken: 'secondary'
  })
  const wifi = makePanel('toggle', {
    parentId: root.id, name: 'Wi-Fi', text: 'Wi-Fi', toggleOn: true
  })
  const bluetooth = makePanel('toggle', {
    parentId: root.id, name: 'Bluetooth', text: 'Bluetooth', toggleOn: true
  })

  return {
    items: [
      tab, w, root, title, search,
      accountCard, avatar, acctLabels, acctName, acctMail,
      general,
      displayHeader, brightness, nightShift, trueTone,
      connectHeader, wifi, bluetooth
    ],
    activeTabId: tab.id
  }
}

// ---- Mail (NavigationSplitView) --------------------------------------
// Joined NavigationSplitView with a search bar, account header, mailbox
// rows, and a detail pane showing a sample message. Mirrors the actual
// Mail app shape on visionOS.
function mailApp() {
  const tab = makeTab({ name: 'Mail', icon: 'envelope.fill' })
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
    widthMode: 'fixed', heightMode: 'fill', fixedWidth: 280,
    alignment: 'leading',
    background: 'glassThin'
  })
  const detail = makeStack({
    parentId: root.id, stackType: 'vstack', name: 'Detail',
    spacing: 14, padding: 32,
    widthMode: 'fill', heightMode: 'fill', alignment: 'leading'
  })

  // Sidebar — header + nav rows + counts.
  const sidebarHeader = makePanel('text', {
    parentId: sidebar.id, name: 'Mail Header', text: 'Mail',
    textStyle: 'title2', fontSize: textStyleToFontSize('title2'),
    fontWeight: 'bold', widthMode: 'fill', colorToken: 'primary',
    color: '#000000'
  })
  const navData = [
    { label: 'All Inboxes', icon: 'tray.full',  badge: '128' },
    { label: 'Inbox',       icon: 'tray',       badge: '32'  },
    { label: 'VIP',         icon: 'star',       badge: '4'   },
    { label: 'Flagged',     icon: 'flag',       badge: '12'  },
    { label: 'Drafts',      icon: 'doc',        badge: ''    },
    { label: 'Sent',        icon: 'paperplane', badge: ''    },
    { label: 'Archive',     icon: 'archivebox', badge: ''    }
  ]
  const navRows = navData.map((n) => makePanel('button', {
    parentId: sidebar.id, name: n.label, text: n.label,
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    size: [ptToUnits(248), ptToUnits(40)],
    cornerRadius: ptToUnits(10),
    buttonStyle: 'plain',
    color: '#ffffff', colorToken: null,
    textColor: '#000000', textColorToken: 'primary',
    textAlign: 'left',
    symbolName: n.icon
  }))

  // Detail — message list header + message reading pane.
  const detailHeader = makeStack({
    parentId: detail.id, name: 'Detail Header',
    stackType: 'hstack', alignment: 'center', spacing: 12, padding: 0,
    widthMode: 'fill', heightMode: 'fit'
  })
  const senderLabels = makeStack({
    parentId: detailHeader.id, name: 'Sender',
    stackType: 'vstack', alignment: 'leading', spacing: 2, padding: 0,
    widthMode: 'fill', heightMode: 'fit'
  })
  const senderName = makePanel('text', {
    parentId: senderLabels.id, name: 'Sender Name',
    text: 'Apple Developer',
    textStyle: 'headline', fontSize: textStyleToFontSize('headline'),
    fontWeight: 'semibold', widthMode: 'fill'
  })
  const senderTime = makePanel('text', {
    parentId: senderLabels.id, name: 'Sender Time',
    text: 'Today at 10:23 AM',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    widthMode: 'fill', colorToken: 'secondary'
  })
  const reply = makePanel('button', {
    parentId: detailHeader.id, name: 'Reply', text: 'Reply',
    buttonStyle: 'borderedProminent',
    symbolName: 'arrowshape.turn.up.left'
  })
  const subject = makePanel('text', {
    parentId: detail.id, name: 'Subject',
    text: 'Your visionOS submission has been approved',
    textStyle: 'title3', fontSize: textStyleToFontSize('title3'),
    fontWeight: 'semibold', widthMode: 'fill'
  })
  const body = makePanel('text', {
    parentId: detail.id, name: 'Body',
    text: 'Hi,\n\nThanks for your patience while we reviewed your app. We\'re happy to let you know that your submission is approved and ready for distribution on the App Store for visionOS.\n\nThe Apple Developer team',
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    widthMode: 'fill'
  })

  return {
    items: [
      tab, w,
      root, sidebar, detail,
      sidebarHeader, ...navRows,
      detailHeader, senderLabels, senderName, senderTime, reply,
      subject, body
    ],
    activeTabId: tab.id
  }
}

// ---- Tab Bar App -----------------------------------------------------
// Bottom-anchored Tab Bar ornament + a Home content stub. Lives at the
// system chrome layer the way SwiftUI's `TabView { Tab(...) }` does, so
// the canvas matches what the user sees in the visionOS simulator.
function tabBarApp() {
  const tab = makeTab({ name: 'App', icon: 'square.stack.fill' })
  const w   = makeWindow({ name: 'App', parentId: tab.id })
  const stk = makeStack({
    parentId: w.id, name: 'Content',
    stackType: 'vstack', alignment: 'center', spacing: 16, padding: 32,
    widthMode: 'fill', heightMode: 'fill'
  })
  const heroIcon = makePanel('label', {
    parentId: stk.id, name: 'Hero Icon', text: '',
    symbolName: 'sparkles', textStyle: 'largeTitle',
    fontSize: ptToUnits(48), colorToken: 'primary'
  })
  const title = makePanel('text', {
    parentId: stk.id, name: 'Title', text: 'Home',
    textStyle: 'largeTitle', fontSize: textStyleToFontSize('largeTitle'),
    fontWeight: 'bold', textAlign: 'center', widthMode: 'fill'
  })
  const body = makePanel('text', {
    parentId: stk.id, name: 'Body',
    text: 'The active tab’s content lives here. Switch tabs in the bar below.',
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    textAlign: 'center', widthMode: 'fill', colorToken: 'secondary'
  })

  // Bottom tab-bar ornament.
  const bar = makeStack({
    parentId: w.id, stackType: 'hstack',
    ornament: 'bottom', name: 'Tab Bar',
    background: 'glassThick',
    fixedHeight: 64, padding: 10, spacing: 22, alignment: 'center',
    widthMode: 'fit', heightMode: 'fixed'
  })
  const tabLabels = ['Home', 'Browse', 'Library', 'Profile']
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
    items: [tab, w, stk, heroIcon, title, body, bar, ...tabs],
    activeTabId: tab.id
  }
}

// ---- Volume templates ------------------------------------------------

const volumeWindow = (overrides = {}) => {
  const p = VOLUME_PRESETS.medium
  return makeWindow({
    name: 'Volume',
    windowStyle: 'volumetric',
    size: [ptToUnits(p.width), ptToUnits(p.height)],
    // Volume container sits AT the floor. Its child World Anchor
    // (added by the seed) inherits this transform and lands on the
    // demo studio's floor — visible to the designer as a real
    // anchor pin instead of a marker floating in mid-air. Model
    // entities default to a chest-height local Y so they still
    // spawn dead-centre of the wearer's view.
    position: [0, 0, 0],
    color: '#202024',
    colorToken: null,
    cornerRadius: ptToUnits(24),
    ...overrides
  })
}

// Empty volumetric stage with a single anchor on the floor — the
// minimal volume seed for users who'd rather build their own scene.
function emptyVolume() {
  const tab = makeTab({ name: 'Volume', icon: 'cube' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Volume' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })
  return { items: [tab, w, anchor], activeTabId: tab.id }
}

// ---- Product Showcase (volume) ---------------------------------------
// A polished product hero: 3D model on a rotating plinth, floating
// title + subtitle, and a Buy attachment at the side. Demonstrates
// real-app-grade RealityView attachment composition.
function productShowcase() {
  const tab = makeTab({ name: 'Product', icon: 'cube' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Showcase' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })

  // Hero sphere on a plinth — physically-based metal.
  const sphere = makeModelEntity('sphere', {
    parentId: anchor.id, name: 'Hero Object',
    sphereRadius: 0.14,
    position: [0, 1.18, 0]
  })
  sphere.materials = [{
    id: 'mat-product-1', type: 'physicallyBased',
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
  const plinth = makeModelEntity('cylinder', {
    parentId: anchor.id, name: 'Plinth',
    cylinderRadius: 0.22, cylinderHeight: 0.04,
    position: [0, 1.0, 0]
  })
  plinth.materials = [{
    id: 'mat-product-base', type: 'simple',
    baseColor: '#1a1a1c', roughness: 0.4, isMetallic: false
  }]

  // Title / subtitle attachments above the sphere.
  const title = makeAttachmentEntity('text', {
    parentId: anchor.id, name: 'Title',
    position: [0, 1.55, 0],
    attachmentText: 'Globe Pro',
    attachmentFontSize: 0.07,
    attachmentBackground: '#0c0c0e',
    attachmentColor: '#ffffff',
    attachmentBillboard: true
  })
  const tagline = makeAttachmentEntity('text', {
    parentId: anchor.id, name: 'Tagline',
    position: [0, 1.46, 0],
    attachmentText: 'New finish · Gen 2',
    attachmentFontSize: 0.035,
    attachmentBackground: '#1c1c1e',
    attachmentColor: '#a0a0a4',
    attachmentBillboard: true
  })

  // Buy CTA off to the right + spec callout off to the left.
  const buy = makeAttachmentEntity('button', {
    parentId: anchor.id, name: 'Buy',
    position: [0.32, 1.18, 0],
    attachmentText: 'Buy · $199',
    attachmentFontSize: 0.045,
    attachmentBackground: '#0a84ff',
    attachmentColor: '#ffffff',
    attachmentBillboard: true
  })
  const spec = makeAttachmentEntity('text', {
    parentId: anchor.id, name: 'Spec',
    position: [-0.32, 1.18, 0],
    attachmentText: '78 mm · 320 g\nAnodized · 4-axis',
    attachmentFontSize: 0.028,
    attachmentBackground: '#1c1c1e',
    attachmentColor: '#cfcfcf',
    attachmentBillboard: true
  })

  return {
    items: [tab, w, anchor, sphere, plinth, title, tagline, buy, spec],
    activeTabId: tab.id
  }
}

// ---- Solar System (volume) -------------------------------------------
// Sun + four planets in a row at chest height, each with a label
// attachment. Demonstrates batch entity creation, mixed materials
// (emissive sun, matte planets), and per-entity attachments.
function solarSystem() {
  const tab = makeTab({ name: 'Cosmos', icon: 'sparkles' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Solar System' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })

  const items = [tab, w, anchor]

  // Sun — large emissive sphere on the left.
  const sun = makeModelEntity('sphere', {
    parentId: anchor.id, name: 'Sun',
    sphereRadius: 0.10,
    position: [-0.50, 1.20, 0]
  })
  sun.materials = [{
    id: 'mat-sun', type: 'simple',
    baseColor: '#ffb84a', roughness: 0.4, isMetallic: false
  }]
  items.push(sun)
  items.push(makeAttachmentEntity('text', {
    parentId: anchor.id, name: 'Sun Label',
    position: [-0.50, 1.36, 0],
    attachmentText: 'Sun',
    attachmentFontSize: 0.030,
    attachmentBackground: '#1c1c1e',
    attachmentColor: '#ffffff',
    attachmentBillboard: true
  }))

  // Inner four planets — Mercury, Venus, Earth, Mars.
  const planets = [
    { name: 'Mercury', x: -0.22, r: 0.022, color: '#a0a0a0' },
    { name: 'Venus',   x: -0.05, r: 0.034, color: '#e0c47a' },
    { name: 'Earth',   x:  0.14, r: 0.036, color: '#3a78ff' },
    { name: 'Mars',    x:  0.34, r: 0.028, color: '#cf5530' }
  ]
  for (const p of planets) {
    const sphere = makeModelEntity('sphere', {
      parentId: anchor.id, name: p.name,
      sphereRadius: p.r,
      position: [p.x, 1.20, 0]
    })
    sphere.materials = [{
      id: `mat-${p.name.toLowerCase()}`, type: 'simple',
      baseColor: p.color, roughness: 0.6, isMetallic: false
    }]
    items.push(sphere)
    items.push(makeAttachmentEntity('text', {
      parentId: anchor.id, name: `${p.name} Label`,
      position: [p.x, 1.20 + p.r + 0.05, 0],
      attachmentText: p.name,
      attachmentFontSize: 0.025,
      attachmentBackground: '#0c0c0e',
      attachmentColor: '#ffffff',
      attachmentBillboard: true
    }))
  }

  return { items, activeTabId: tab.id }
}

// ---- Diorama (volume) ------------------------------------------------
// Grouped tableau — a backing wall + three towers in primary colours.
// The simplest "look at this scene" volume; demonstrates entity
// grouping for organised hierarchies.
function diorama() {
  const tab = makeTab({ name: 'Volume', icon: 'cube' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Diorama' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })
  const stage = makeGroupEntity({ parentId: anchor.id, name: 'Stage' })
  const wall = makeModelEntity('plane', {
    parentId: stage.id, name: 'Wall',
    planeWidth: 0.9, planeDepth: 0.55,
    position: [0, 1.30, -0.18],
    rotation: [90, 0, 0]
  })
  wall.materials = [{
    id: 'mat-wall-1', type: 'simple',
    baseColor: '#7a8aa0', roughness: 0.85, isMetallic: false
  }]
  const towerColors = ['#e07a5f', '#81b29a', '#f2cc8f']
  const towers = towerColors.map((c, i) => {
    const tower = makeModelEntity('box', {
      parentId: stage.id, name: `Tower ${i + 1}`,
      boxSize: [0.09, 0.12 + i * 0.07, 0.09],
      position: [-0.20 + i * 0.20, 1.06 + (0.12 + i * 0.07) / 2, 0]
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
  blank:        { mode: 'window', label: 'Blank',          description: 'Empty window with a single fill stack — start from scratch.',                build: blank },
  musicPlayer:  { mode: 'window', label: 'Music Player',   description: 'Now Playing card with artwork, transport controls, and a queue list.',     build: musicPlayer },
  smartHome:    { mode: 'window', label: 'Smart Home',     description: 'Dashboard with greeting, room cards, scenes, and quick controls.',         build: smartHome },
  settings:     { mode: 'window', label: 'Settings',       description: 'Multi-section settings page with search, account header, and toggles.',    build: settings },
  mailApp:      { mode: 'window', label: 'Mail',           description: 'NavigationSplitView (joined) with sidebar mailboxes and a reading pane.',  build: mailApp },
  tabBar:       { mode: 'window', label: 'Tab Bar App',    description: 'Bottom Tab Bar ornament with a Home content stub.',                        build: tabBarApp },
  // Volume-mode
  emptyVolume:     { mode: 'volume', label: 'Empty Volume',     description: 'Volumetric stage with a single world anchor — start from scratch.',      build: emptyVolume },
  productShowcase: { mode: 'volume', label: 'Product Showcase', description: 'Hero object on a plinth with floating title, tagline, spec, and Buy CTA.', build: productShowcase },
  solarSystem:     { mode: 'volume', label: 'Solar System',     description: 'Emissive sun + four inner planets in a row, each with a label attachment.', build: solarSystem },
  diorama:         { mode: 'volume', label: 'Diorama',          description: 'Grouped scene: backing wall + three towers in primary colours.',         build: diorama }
}

export const TEMPLATE_ORDER_WINDOW = [
  'blank', 'musicPlayer', 'smartHome', 'settings', 'mailApp', 'tabBar'
]
export const TEMPLATE_ORDER_VOLUME = [
  'emptyVolume', 'productShowcase', 'solarSystem', 'diorama'
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
