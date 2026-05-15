// Sample templates surfaced on the splash screen. Each template is a pure
// function that returns `{ items, activeTabId }` — same shape as
// factories.seedScene — and the store's `applyTemplate` action replaces the
// current scene with whatever the template produces.
//
// The set is intentionally lopsided toward "real-app" shapes: a Blank
// starter for users who'd rather build from scratch, then templates that
// each demonstrate a different production-grade pattern (NavigationSplit,
// volumetric scenes with attachments, dashboards, settings, etc.).

import { ptToUnits, VOLUME_PRESETS, WINDOW_CORNER_RADIUS } from '../appleSystem'

// Pre-baked corner-radii arrays for the joined NavigationSplitView
// sidebar (top-left + bottom-left round to match the window plate;
// right edge is flush against the detail pane). Centralised so the
// Mail and Files templates stay in sync with the addSplitView wizard.
const JOINED_SIDEBAR_RADII = [
  ptToUnits(WINDOW_CORNER_RADIUS), 0, 0, ptToUnits(WINDOW_CORNER_RADIUS)
]
import {
  makeTab, makeWindow, makeStack, makePanel,
  makeAnchorEntity, makeModelEntity, makeGroupEntity,
  makeAttachmentEntity,
  textStyleToFontSize
} from '../store/factories'
import { defaultParamsFor, getTriggerSchema, getActionSchema } from '../behaviors/registry'

// ---- Behavior helpers (template-only) -------------------------------
//
// Volume templates ship with a small set of pre-wired interactions so a
// new user can hit Preview and immediately see triggers / actions
// firing without any extra setup. These helpers compose a single
// behavior record (trigger + actions) using the same schema the
// Behaviors inspector edits, so the templates' interactions are
// indistinguishable from user-authored ones.

let _behIdCounter = 1
const behId = () => `beh-tpl-${(_behIdCounter++).toString(36)}`
const actId = () => `act-tpl-${(_behIdCounter++).toString(36)}`

function trigger(type, params = {}) {
  const base = defaultParamsFor(getTriggerSchema(type))
  return { type, params: { ...base, ...params } }
}
function action(type, params = {}) {
  const base = defaultParamsFor(getActionSchema(type))
  return { id: actId(), type, params: { ...base, ...params } }
}
function behavior(trig, ...actions) {
  return { id: behId(), trigger: trig, actions }
}

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

// =====================================================================
// Window-mode templates — visionOS HIG aligned, production-ready.
//
// Every template uses semantic colour tokens (so Scene → Colors retunes
// the whole scene), HIG-correct typography ramps, glass plates, and
// 24pt margins. Symbol-only buttons use `iconOnly` label style; SF
// Symbol names match Apple's library. Layouts are designed to land
// directly on a 1200×800 Regular window plate.
// =====================================================================

// ---- Welcome (onboarding splash) -----------------------------------
// Hero icon + centred title block + primary CTA. Mirrors the
// "Welcome to <app>" pattern used by Apple's first-launch flows
// (Tips, Translate, Reality Composer Pro).
function welcomeTpl() {
  const tab = makeTab({ name: 'Welcome', icon: 'sparkles' })
  const w   = makeWindow({ name: 'Welcome', parentId: tab.id })
  const root = makeStack({
    parentId: w.id, name: 'Content',
    stackType: 'vstack', alignment: 'center', spacing: 28, padding: 56,
    widthMode: 'fill', heightMode: 'fill'
  })
  const heroBox = makeStack({
    parentId: root.id, name: 'Hero',
    stackType: 'vstack', alignment: 'center', spacing: 18, padding: 0,
    widthMode: 'fit', heightMode: 'fit'
  })
  const icon = makePanel('label', {
    parentId: heroBox.id, name: 'Hero Icon', text: '',
    symbolName: 'sparkles', symbolRenderingMode: 'hierarchical',
    styles: { labelStyle: 'iconOnly' },
    size: [ptToUnits(96), ptToUnits(96)],
    colorToken: 'systemBlue'
  })
  const titleBlock = makeStack({
    parentId: heroBox.id, name: 'Titles',
    stackType: 'vstack', alignment: 'center', spacing: 6, padding: 0,
    widthMode: 'fit', heightMode: 'fit'
  })
  const title = makePanel('text', {
    parentId: titleBlock.id, name: 'Title',
    text: 'Welcome to Vision',
    textStyle: 'extraLargeTitle', fontSize: textStyleToFontSize('extraLargeTitle'),
    fontWeight: 'bold', textAlign: 'center',
    colorToken: 'primary'
  })
  const subtitle = makePanel('text', {
    parentId: titleBlock.id, name: 'Subtitle',
    text: 'A new way to see, work, and be present — designed for spatial computing.',
    textStyle: 'title3', fontSize: textStyleToFontSize('title3'),
    fontWeight: 'regular', textAlign: 'center',
    colorToken: 'secondary',
    size: [ptToUnits(520), ptToUnits(72)],
    widthMode: 'fixed'
  })
  const actions = makeStack({
    parentId: root.id, name: 'Actions',
    stackType: 'vstack', alignment: 'center', spacing: 12, padding: 0,
    widthMode: 'fit', heightMode: 'fit'
  })
  const cta = makePanel('button', {
    parentId: actions.id, name: 'Get Started',
    text: 'Get Started',
    buttonSize: 'large', buttonShape: 'capsule',
    buttonStyle: 'borderedProminent',
    size: [ptToUnits(220), ptToUnits(52)]
  })
  const skip = makePanel('button', {
    parentId: actions.id, name: 'Skip',
    text: 'Not Now',
    buttonStyle: 'plain', buttonSize: 'regular',
    colorToken: null, color: '#00000000',
    textColorToken: 'secondary'
  })
  return {
    items: [tab, w, root, heroBox, icon, titleBlock, title, subtitle, actions, cta, skip],
    activeTabId: tab.id
  }
}

// ---- Browse (grid + search) ----------------------------------------
// Library-style page: page title, search bar, then four category cards
// arranged as two HStacks (instead of a grid stack — the layout engine
// honours explicit widths inside hstacks more reliably than fill-grid).
// Mirrors Music's "Browse" and App Store's category landing.
function browseTpl() {
  const tab = makeTab({ name: 'Browse', icon: 'square.grid.2x2' })
  const w   = makeWindow({ name: 'Browse', parentId: tab.id })
  const CARD_W = 540, CARD_H = 110, GAP = 16
  const root = makeStack({
    parentId: w.id, name: 'Content',
    stackType: 'vstack', alignment: 'leading', spacing: 16, padding: 24,
    widthMode: 'fill', heightMode: 'fill'
  })
  const header = makePanel('text', {
    parentId: root.id, name: 'Page Title',
    text: 'Browse',
    textStyle: 'largeTitle', fontSize: textStyleToFontSize('largeTitle'),
    fontWeight: 'bold', textAlign: 'left',
    widthMode: 'fill', colorToken: 'primary'
  })
  const searchField = makePanel('search', {
    parentId: root.id, name: 'Search',
    text: 'Search categories',
    size: [ptToUnits(2 * CARD_W + GAP), ptToUnits(44)]
  })
  const cards = [
    { name: 'Spatial Photos', symbol: 'photo.on.rectangle.angled', tint: 'systemPurple' },
    { name: 'Films',          symbol: 'play.rectangle',            tint: 'systemPink' },
    { name: 'Music',          symbol: 'music.note',                tint: 'systemRed' },
    { name: 'Environments',   symbol: 'mountain.2.fill',           tint: 'systemTeal' }
  ]
  const rowItems = []
  for (let r = 0; r < 2; r++) {
    const row = makeStack({
      parentId: root.id, name: `Row ${r + 1}`,
      stackType: 'hstack', alignment: 'center', spacing: GAP, padding: 0,
      widthMode: 'fit', heightMode: 'fit'
    })
    rowItems.push(row)
    for (let c = 0; c < 2; c++) {
      const cfg = cards[r * 2 + c]
      const card = makeStack({
        parentId: row.id, name: cfg.name,
        stackType: 'vstack', alignment: 'leading', spacing: 12, padding: 18,
        background: 'glassThin', cornerRadius: ptToUnits(20),
        size: [ptToUnits(CARD_W), ptToUnits(CARD_H)],
        widthMode: 'fixed', heightMode: 'fixed'
      })
      const icon = makePanel('label', {
        parentId: card.id, name: `${cfg.name} Icon`, text: '',
        symbolName: cfg.symbol, symbolRenderingMode: 'hierarchical',
        styles: { labelStyle: 'iconOnly' },
        size: [ptToUnits(36), ptToUnits(36)],
        colorToken: cfg.tint
      })
      const lbl = makePanel('text', {
        parentId: card.id, name: `${cfg.name} Label`,
        text: cfg.name,
        textStyle: 'title3', fontSize: textStyleToFontSize('title3'),
        fontWeight: 'semibold', textAlign: 'left',
        widthMode: 'fit', colorToken: 'primary'
      })
      rowItems.push(card, icon, lbl)
    }
  }
  return {
    items: [tab, w, root, header, searchField, ...rowItems],
    activeTabId: tab.id
  }
}

// ---- Player (Now Playing card) -------------------------------------
// Hero artwork → title/artist → scrubber → transport row. Refined,
// minimal — no queue list, no clutter. Sized to land in the middle
// of a 1200×800 window with breathing room on either side.
function playerTpl() {
  const tab = makeTab({ name: 'Player', icon: 'play.circle.fill' })
  const w   = makeWindow({ name: 'Now Playing', parentId: tab.id })
  const root = makeStack({
    parentId: w.id, name: 'Player',
    stackType: 'vstack', alignment: 'center', spacing: 20, padding: 40,
    widthMode: 'fill', heightMode: 'fill'
  })
  const artwork = makePanel('image', {
    parentId: root.id, name: 'Artwork',
    size: [ptToUnits(260), ptToUnits(260)],
    cornerRadius: ptToUnits(24),
    color: '#1c1c1e', colorToken: null,
    imageUrl: '/samples/images/Sample 02.jpg',
    imageFit: 'fill'
  })
  const meta = makeStack({
    parentId: root.id, name: 'Track Info',
    stackType: 'vstack', alignment: 'center', spacing: 4, padding: 0,
    widthMode: 'fill', heightMode: 'fit'
  })
  const title = makePanel('text', {
    parentId: meta.id, name: 'Track',
    text: 'Midnight City',
    textStyle: 'title2', fontSize: textStyleToFontSize('title2'),
    fontWeight: 'semibold', textAlign: 'center',
    widthMode: 'fill', colorToken: 'primary'
  })
  const artist = makePanel('text', {
    parentId: meta.id, name: 'Artist',
    text: 'M83 · Hurry Up, We’re Dreaming',
    textStyle: 'subheadline', fontSize: textStyleToFontSize('subheadline'),
    textAlign: 'center', widthMode: 'fill', colorToken: 'secondary'
  })
  const scrubBlock = makeStack({
    parentId: root.id, name: 'Scrubber',
    stackType: 'vstack', alignment: 'center', spacing: 4, padding: 0,
    widthMode: 'fill', heightMode: 'fit',
    size: [ptToUnits(360), 0]
  })
  const slider = makePanel('slider', {
    parentId: scrubBlock.id, name: 'Progress',
    sliderValue: 0.42, widthMode: 'fill'
  })
  const times = makeStack({
    parentId: scrubBlock.id, name: 'Times',
    stackType: 'hstack', alignment: 'center', spacing: 0, padding: 0,
    widthMode: 'fill', heightMode: 'fit'
  })
  const tNow = makePanel('text', {
    parentId: times.id, name: 'Elapsed', text: '1:48',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    textAlign: 'left', widthMode: 'fill', colorToken: 'secondary'
  })
  const tEnd = makePanel('text', {
    parentId: times.id, name: 'Remaining', text: '−2:30',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    textAlign: 'right', widthMode: 'fill', colorToken: 'secondary'
  })
  const transport = makeStack({
    parentId: root.id, name: 'Transport',
    stackType: 'hstack', alignment: 'center', spacing: 28, padding: 0,
    widthMode: 'fit', heightMode: 'fit'
  })
  const prev = makePanel('button', {
    parentId: transport.id, name: 'Previous',
    text: '', symbolName: 'backward.fill',
    styles: { labelStyle: 'iconOnly' },
    buttonStyle: 'plain', buttonSize: 'large',
    colorToken: null, color: '#00000000', textColorToken: 'primary'
  })
  const play = makePanel('button', {
    parentId: transport.id, name: 'Play',
    text: '', symbolName: 'play.fill',
    styles: { labelStyle: 'iconOnly' },
    buttonStyle: 'borderedProminent', buttonShape: 'capsule', buttonSize: 'large',
    size: [ptToUnits(72), ptToUnits(72)],
    cornerRadius: ptToUnits(100)
  })
  const next = makePanel('button', {
    parentId: transport.id, name: 'Next',
    text: '', symbolName: 'forward.fill',
    styles: { labelStyle: 'iconOnly' },
    buttonStyle: 'plain', buttonSize: 'large',
    colorToken: null, color: '#00000000', textColorToken: 'primary'
  })
  return {
    items: [tab, w, root, artwork, meta, title, artist,
      scrubBlock, slider, times, tNow, tEnd,
      transport, prev, play, next
    ],
    activeTabId: tab.id
  }
}

// ---- Profile card --------------------------------------------------
// People-style detail page: round avatar, name, role line, three
// stat chips, and a primary "Follow / Message" CTA. Used in
// Contacts, Find My, People in Messages.
function profileTpl() {
  const tab = makeTab({ name: 'Profile', icon: 'person.crop.circle' })
  const w   = makeWindow({ name: 'Profile', parentId: tab.id })
  const root = makeStack({
    parentId: w.id, name: 'Card',
    stackType: 'vstack', alignment: 'center', spacing: 20, padding: 36,
    widthMode: 'fill', heightMode: 'fill'
  })
  const avatar = makePanel('image', {
    parentId: root.id, name: 'Avatar',
    size: [ptToUnits(120), ptToUnits(120)],
    cornerRadius: ptToUnits(100),
    color: '#3a3a3c', colorToken: null,
    imageUrl: '/samples/images/Sample 02.jpg',
    imageFit: 'fill'
  })
  const identity = makeStack({
    parentId: root.id, name: 'Identity',
    stackType: 'vstack', alignment: 'center', spacing: 4, padding: 0,
    widthMode: 'fit', heightMode: 'fit'
  })
  const name = makePanel('text', {
    parentId: identity.id, name: 'Name', text: 'Avery Chen',
    textStyle: 'title', fontSize: textStyleToFontSize('title'),
    fontWeight: 'bold', textAlign: 'center', colorToken: 'primary'
  })
  const role = makePanel('text', {
    parentId: identity.id, name: 'Role', text: 'Spatial Designer · San Francisco',
    textStyle: 'subheadline', fontSize: textStyleToFontSize('subheadline'),
    textAlign: 'center', colorToken: 'secondary'
  })
  const stats = makeStack({
    parentId: root.id, name: 'Stats',
    stackType: 'hstack', alignment: 'center', spacing: 16, padding: 0,
    widthMode: 'fit', heightMode: 'fit'
  })
  const statBlock = []
  ;[
    { label: 'Projects', value: '24' },
    { label: 'Followers', value: '1.2k' },
    { label: 'Following', value: '318' }
  ].forEach((s, i) => {
    const chip = makeStack({
      parentId: stats.id, name: s.label,
      stackType: 'vstack', alignment: 'center', spacing: 2, padding: 12,
      background: 'glassThin',
      cornerRadius: ptToUnits(14),
      size: [ptToUnits(100), ptToUnits(64)],
      widthMode: 'fixed', heightMode: 'fixed'
    })
    const v = makePanel('text', {
      parentId: chip.id, name: `${s.label} Value`, text: s.value,
      textStyle: 'title3', fontSize: textStyleToFontSize('title3'),
      fontWeight: 'semibold', textAlign: 'center', colorToken: 'primary'
    })
    const lbl = makePanel('text', {
      parentId: chip.id, name: `${s.label} Label`, text: s.label,
      textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
      textAlign: 'center', colorToken: 'secondary'
    })
    statBlock.push(chip, v, lbl)
  })
  const actions = makeStack({
    parentId: root.id, name: 'Actions',
    stackType: 'hstack', alignment: 'center', spacing: 12, padding: 0,
    widthMode: 'fit', heightMode: 'fit'
  })
  const follow = makePanel('button', {
    parentId: actions.id, name: 'Follow',
    text: 'Follow', symbolName: 'person.crop.circle.badge.plus',
    buttonStyle: 'borderedProminent', buttonShape: 'capsule', buttonSize: 'large',
    size: [ptToUnits(160), ptToUnits(52)]
  })
  const message = makePanel('button', {
    parentId: actions.id, name: 'Message',
    text: 'Message', symbolName: 'bubble.left',
    buttonStyle: 'bordered', buttonShape: 'capsule', buttonSize: 'large',
    size: [ptToUnits(160), ptToUnits(52)]
  })
  return {
    items: [tab, w, root, avatar, identity, name, role, stats, ...statBlock, actions, follow, message],
    activeTabId: tab.id
  }
}

// ---- Article (long-form reader) ------------------------------------
// Reader layout: eyebrow / category, big headline, byline metadata
// row, hero image, body paragraphs. Width clamped to a comfortable
// reading measure (~560pt). Pattern: News, Books, Reader Mode.
function articleTpl() {
  const tab = makeTab({ name: 'Read', icon: 'doc.text' })
  const w   = makeWindow({ name: 'Article', parentId: tab.id })
  const COL_W = 560
  const root = makeStack({
    parentId: w.id, name: 'Article',
    stackType: 'vstack', alignment: 'center', spacing: 14, padding: 24,
    widthMode: 'fill', heightMode: 'fill', scrollable: true
  })
  const column = makeStack({
    parentId: root.id, name: 'Column',
    stackType: 'vstack', alignment: 'leading', spacing: 12, padding: 0,
    size: [ptToUnits(COL_W), ptToUnits(640)],
    widthMode: 'fixed', heightMode: 'fit'
  })
  const eyebrow = makePanel('text', {
    parentId: column.id, name: 'Category', text: 'DESIGN',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    fontWeight: 'bold', textAlign: 'left',
    widthMode: 'fill', colorToken: 'systemBlue'
  })
  const headline = makePanel('text', {
    parentId: column.id, name: 'Headline',
    text: 'Designing for the Spatial Era',
    textStyle: 'extraLargeTitle2', fontSize: textStyleToFontSize('extraLargeTitle2'),
    fontWeight: 'bold', textAlign: 'left',
    widthMode: 'fill', colorToken: 'primary'
  })
  const byline = makeStack({
    parentId: column.id, name: 'Byline',
    stackType: 'hstack', alignment: 'center', spacing: 8, padding: 0,
    widthMode: 'fill', heightMode: 'fit'
  })
  const author = makePanel('text', {
    parentId: byline.id, name: 'Author', text: 'By Avery Chen',
    textStyle: 'footnote', fontSize: textStyleToFontSize('footnote'),
    fontWeight: 'medium', textAlign: 'left',
    widthMode: 'fit', colorToken: 'primary'
  })
  const sep = makePanel('text', {
    parentId: byline.id, name: 'Sep', text: '·',
    textStyle: 'footnote', fontSize: textStyleToFontSize('footnote'),
    widthMode: 'fit', colorToken: 'tertiary'
  })
  const meta = makePanel('text', {
    parentId: byline.id, name: 'Meta', text: 'May 15 · 6 min read',
    textStyle: 'footnote', fontSize: textStyleToFontSize('footnote'),
    textAlign: 'left',
    widthMode: 'fill', colorToken: 'secondary'
  })
  const hero = makePanel('image', {
    parentId: column.id, name: 'Hero',
    size: [ptToUnits(COL_W), ptToUnits(260)],
    widthMode: 'fill',
    cornerRadius: ptToUnits(16),
    color: '#2c2c2e', colorToken: null,
    imageUrl: '/samples/images/Sample 03.jpg',
    imageFit: 'fill'
  })
  const body1 = makePanel('text', {
    parentId: column.id, name: 'Paragraph',
    text: 'Vision changes the rules. Surfaces become unbounded, depth becomes a first-class material, and motion suggests presence rather than navigation. The result is software that feels physical without pretending to be — interfaces that breathe with the room rather than blocking it.',
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    textAlign: 'left', widthMode: 'fill', colorToken: 'primary'
  })
  return {
    items: [tab, w, root, column, eyebrow, headline, byline, author, sep, meta, hero, body1],
    activeTabId: tab.id
  }
}

// ---- Settings / Preferences ----------------------------------------
// Sectioned list inside a single window. Account header with avatar
// + name, then two grouped sections: Preferences (toggles) and About
// (info rows). Mirrors Apple's Settings.app inside a window plate.
function settingsTpl() {
  const tab = makeTab({ name: 'Settings', icon: 'gearshape' })
  const w   = makeWindow({ name: 'Settings', parentId: tab.id })
  const COL_W = 640
  const root = makeStack({
    parentId: w.id, name: 'Settings',
    stackType: 'vstack', alignment: 'center', spacing: 12, padding: 24,
    widthMode: 'fill', heightMode: 'fill', scrollable: true
  })
  // Account header — small avatar + name + chevron-style "View Profile" link.
  const account = makeStack({
    parentId: root.id, name: 'Account',
    stackType: 'hstack', alignment: 'center', spacing: 14, padding: 14,
    background: 'glassThin', cornerRadius: ptToUnits(16),
    size: [ptToUnits(COL_W), ptToUnits(80)],
    widthMode: 'fixed', heightMode: 'fixed'
  })
  const avatar = makePanel('image', {
    parentId: account.id, name: 'Avatar',
    size: [ptToUnits(48), ptToUnits(48)],
    cornerRadius: ptToUnits(100),
    color: '#3a3a3c', colorToken: null,
    imageUrl: '/samples/images/Sample 02.jpg',
    imageFit: 'fill'
  })
  const nameCol = makeStack({
    parentId: account.id, name: 'Name Column',
    stackType: 'vstack', alignment: 'leading', spacing: 2, padding: 0,
    widthMode: 'fill', heightMode: 'fit'
  })
  const acctName = makePanel('text', {
    parentId: nameCol.id, name: 'Name', text: 'Avery Chen',
    textStyle: 'headline', fontSize: textStyleToFontSize('headline'),
    fontWeight: 'semibold', textAlign: 'left',
    widthMode: 'fill', colorToken: 'primary'
  })
  const acctEmail = makePanel('text', {
    parentId: nameCol.id, name: 'Email', text: 'avery@example.com',
    textStyle: 'subheadline', fontSize: textStyleToFontSize('subheadline'),
    textAlign: 'left', widthMode: 'fill', colorToken: 'secondary'
  })
  const acctChevron = makePanel('label', {
    parentId: account.id, name: 'Chevron', text: '',
    symbolName: 'chevron.right', styles: { labelStyle: 'iconOnly' },
    size: [ptToUnits(16), ptToUnits(16)], colorToken: 'tertiary'
  })
  // Preferences section — three toggle rows.
  const prefList = makePanel('list', {
    parentId: root.id, name: 'Preferences',
    listStyle: 'insetGrouped',
    size: [ptToUnits(COL_W), 0], widthMode: 'fixed',
    rows: [
      { title: 'Notifications', subtitle: '', accessory: 'toggle', toggleValue: true,  icon: 'bell.fill',       iconTint: '#ff453a' },
      { title: 'Sound Effects', subtitle: '', accessory: 'toggle', toggleValue: false, icon: 'speaker.wave.2',  iconTint: '#ff9f0a' },
      { title: 'Spatial Audio', subtitle: '', accessory: 'toggle', toggleValue: true,  icon: 'airpods',         iconTint: '#0a84ff' }
    ]
  })
  // About section — info rows with right-aligned values.
  const aboutList = makePanel('list', {
    parentId: root.id, name: 'About',
    listStyle: 'insetGrouped',
    size: [ptToUnits(COL_W), 0], widthMode: 'fixed',
    rows: [
      { title: 'Version',         subtitle: '', accessory: 'value', value: '2.0.1', icon: 'info.circle.fill', iconTint: '#8e8e93' },
      { title: 'Privacy Policy',  subtitle: '', accessory: 'chevron',               icon: 'hand.raised.fill', iconTint: '#30d158' },
      { title: 'Terms of Service',subtitle: '', accessory: 'chevron',               icon: 'doc.text.fill',    iconTint: '#0a84ff' }
    ]
  })
  return {
    items: [tab, w, root,
      account, avatar, nameCol, acctName, acctEmail, acctChevron,
      prefList, aboutList
    ],
    activeTabId: tab.id
  }
}

// ---- Legacy: Music Player ------------------------------------------
// Kept so older saved scenes that reference the previous template
// keys continue to load. Not surfaced on the splash.
function musicPlayer() {
  const tab = makeTab({ name: 'Music', icon: 'music.note' })
  const w   = makeWindow({ name: 'Now Playing', parentId: tab.id })
  const root = makeStack({
    parentId: w.id, name: 'Content',
    stackType: 'vstack', alignment: 'center', spacing: 18, padding: 24,
    widthMode: 'fill', heightMode: 'fill'
  })

  // Hero artwork — square image plate at the top. Tonal deep blue
  // sits in the same palette as the system accent so the artwork plate
  // and the prominent Play button read as related, not random.
  const artwork = makePanel('image', {
    parentId: root.id, name: 'Artwork',
    size: [ptToUnits(220), ptToUnits(220)],
    cornerRadius: ptToUnits(16),
    color: '#1e3a8a', colorToken: null
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
  // Plain transport buttons — soft secondary circles that pair with
  // the light window plate. Play stays prominent (system blue) so
  // the visual hierarchy still reads at a glance.
  const prev = makePanel('button', {
    parentId: transport.id, name: 'Prev', text: '',
    size: [ptToUnits(52), ptToUnits(52)],
    cornerRadius: ptToUnits(26),
    buttonStyle: 'plain',
    color: '#d8d8dc', colorToken: null,
    textColor: '#000000', textColorToken: null,
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
    color: '#d8d8dc', colorToken: null,
    textColor: '#000000', textColorToken: null,
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
    // Soft secondary surface so cards sit on the near-white window
    // plate without the harsh dark-on-light contrast the glass-token
    // resolution produced in dark scheme.
    const card = makeStack({
      parentId: rooms.id, name: r.name,
      stackType: 'vstack', alignment: 'leading', spacing: 6, padding: 14,
      widthMode: 'fill', heightMode: 'fixed', fixedHeight: 110,
      background: '#d8d8dc',
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
  // Scene pills — slight rounding (12pt) to match visionOS's actual
  // control radius, and a soft secondary surface that pairs with the
  // light room cards above. Width bumped to 140pt so the longest
  // label ("Movie Night") fits without truncating, with 12pt of
  // padding on either side of the glyph run.
  const sceneData = ['Movie Night', 'Bright', 'Focus', 'Sleep']
  const sceneItems = sceneData.map((label) => makePanel('button', {
    parentId: scenes.id, name: label, text: label,
    textStyle: 'subheadline',
    fontSize: textStyleToFontSize('subheadline'),
    size: [ptToUnits(140), ptToUnits(40)],
    cornerRadius: ptToUnits(12),
    buttonStyle: 'plain',
    color: '#d8d8dc', colorToken: null,
    textColor: '#000000', textColorToken: null
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
  // Taller window — Settings ships with title + search + account card
  // + a 4-row list + a header + slider + 4 toggles. Regular (800×600)
  // overflowed the plate; 800×900 holds the full set without scrolling.
  const w   = makeWindow({
    name: 'Settings', parentId: tab.id,
    size: [ptToUnits(800), ptToUnits(900)]
  })
  const root = makeStack({
    parentId: w.id, name: 'Content',
    stackType: 'vstack', alignment: 'leading', spacing: 14, padding: 32,
    widthMode: 'fill', heightMode: 'fill'
  })
  const title = makePanel('text', {
    parentId: root.id, name: 'Title', text: 'Settings',
    textStyle: 'largeTitle', fontSize: textStyleToFontSize('largeTitle'),
    fontWeight: 'bold', widthMode: 'fill'
  })
  // Fill width so the search field tracks the window plate at any
  // preset size — we used to ship a fixed 360pt width alongside
  // widthMode:'fill', which the layout engine treated as conflicting
  // and left the field looking stuck on the leading edge.
  const search = makePanel('search', {
    parentId: root.id, name: 'Search', text: 'Search settings',
    widthMode: 'fill'
  })

  // Account header card — soft secondary surface that harmonises
  // with the near-white window plate.
  const accountCard = makeStack({
    parentId: root.id, name: 'Account',
    stackType: 'hstack', alignment: 'center', spacing: 12, padding: 14,
    widthMode: 'fill', heightMode: 'fit',
    background: '#d8d8dc',
    cornerRadius: ptToUnits(14)
  })
  // Solid coloured swatch — `image` panels with no imageUrl render
  // a "missing image" cross which made the avatar look like a `+`
  // tile. A `circle` keeps the same disc silhouette but stays
  // visually intentional regardless of whether a user uploads.
  const avatar = makePanel('circle', {
    parentId: accountCard.id, name: 'Avatar',
    size: [ptToUnits(48), ptToUnits(48)],
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
  // NavigationSplitView needs horizontal room — a 280pt sidebar plus
  // a detail pane wide enough for a multi-line email body doesn't fit
  // the 800pt regular preset. 1280×800 mirrors the visionOS Wide
  // preset and gives the detail pane ~960pt of breathing room.
  const w   = makeWindow({
    name: 'Mail', parentId: tab.id,
    size: [ptToUnits(1280), ptToUnits(800)]
  })
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
    // Sidebar surface harmonised with the near-white window plate
    // (`designWindow` resolves to #ecedef). A soft secondary tone —
    // #d8d8dc — sits one step darker than the plate so the seam
    // reads without the previous near-black sidebar fighting the
    // light detail pane.
    background: '#d8d8dc',
    cornerRadius: ptToUnits(WINDOW_CORNER_RADIUS),
    cornerRadii: JOINED_SIDEBAR_RADII
  })
  const detail = makeStack({
    parentId: root.id, stackType: 'vstack', name: 'Detail',
    spacing: 14, padding: 32,
    widthMode: 'fill', heightMode: 'fill', alignment: 'leading'
  })

  // Sidebar — header + nav rows + counts. Light sidebar surface
  // (#d8d8dc) calls for dark type so the title reads cleanly.
  const sidebarHeader = makePanel('text', {
    parentId: sidebar.id, name: 'Mail Header', text: 'Mail',
    textStyle: 'title2', fontSize: textStyleToFontSize('title2'),
    fontWeight: 'bold', widthMode: 'fill', colorToken: null,
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
  // Sidebar nav rows — plain "selectable list item" treatment.
  // widthMode:'fill' (instead of a hardcoded 248pt size) lets each
  // row stretch the full inner width of the sidebar regardless of
  // what fixed width the sidebar gets resized to, matching the way
  // visionOS Mail draws its rows flush to the sidebar's leading edge.
  const navRows = navData.map((n) => makePanel('button', {
    parentId: sidebar.id, name: n.label, text: n.label,
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    widthMode: 'fill',
    size: [ptToUnits(248), ptToUnits(36)],
    cornerRadius: ptToUnits(8),
    buttonStyle: 'plain',
    color: '#00000000', colorToken: null,
    textColor: '#000000', textColorToken: null,
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
  // Body text uses a fixed-height fill frame so the parent VStack
  // leaves room for the wrapped lines. Without the explicit
  // heightMode the layout engine uses the single-line intrinsic
  // height and the wrapped body paints over the subject above.
  const body = makePanel('text', {
    parentId: detail.id, name: 'Body',
    text: 'Hi, thanks for your patience while we reviewed your app. We\'re happy to let you know that your submission is approved and ready for distribution on the App Store for visionOS.\n\n— The Apple Developer team',
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    widthMode: 'fill',
    heightMode: 'fixed', size: [ptToUnits(640), ptToUnits(160)]
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

  // Bottom tab-bar ornament — tight 2pt internal padding, height
  // hugs the contained pills (heightMode 'fit'), and the ornament
  // anchor logic in SceneTree lets it overlap the window plate by
  // 20pt per the visionOS HIG (WWDC23 #10076). Background tone
  // picks up the off-white plate so the bar reads as part of the app
  // rather than a contrasting dark band.
  const bar = makeStack({
    parentId: w.id, stackType: 'hstack',
    ornament: 'bottom', name: 'Tab Bar',
    background: '#d8d8dc',
    padding: 2, spacing: 4, alignment: 'center',
    widthMode: 'fit', heightMode: 'fit'
  })
  // Tab pills — selected tab uses the system accent fill, others
  // sit on the bar's secondary tone with dark labels for readability
  // against the light surface. Pill width bumped to 100pt so the
  // icon + label combo fits without the glyph overrunning the text.
  // Icons trimmed to symbols our SF_SYMBOLS map renders reliably.
  // Tab pills are full capsules — cornerRadius = height/2 so the
  // ends are perfectly round (matches the HIG Apple Music transport
  // pill). The active tab keeps the borderedProminent fill;
  // inactive tabs render flat in the ornament's shared capsule.
  const tabLabels = ['Home', 'Browse', 'Library', 'Profile']
  const tabIcons  = ['house.fill', 'magnifyingglass', 'books.vertical.fill', 'person.crop.circle.fill']
  const TAB_HEIGHT = 44
  const tabs = tabLabels.map((label, i) => makePanel('button', {
    parentId: bar.id, name: label, text: label,
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    fontWeight: 'medium',
    size: [ptToUnits(110), ptToUnits(TAB_HEIGHT)],
    cornerRadius: ptToUnits(TAB_HEIGHT / 2),
    buttonStyle: i === 0 ? 'borderedProminent' : 'plain',
    color: i === 0 ? '#0a84ff' : '#ecedef', colorToken: null,
    textColor: i === 0 ? '#ffffff' : '#000000', textColorToken: null,
    symbolName: tabIcons[i] || null
  }))

  return {
    items: [tab, w, stk, heroIcon, title, body, bar, ...tabs],
    activeTabId: tab.id
  }
}

// ---- Files -----------------------------------------------------------
// NavigationSplitView-style file browser modelled after the visionOS
// Files app: a sidebar with section headers (Locations, Tags), a
// "Recents" / "Shared" pinned pair at the top, and a main pane that
// shows the current path's empty state. The shape is the same as
// Mail / Photos / Music — useful as a quick "give me a sidebar
// shell" starting point.
function filesApp() {
  const tab = makeTab({ name: 'Files', icon: 'folder' })
  // Same NavigationSplitView shape as Mail — needs the Wide preset.
  const w   = makeWindow({
    name: 'Files', parentId: tab.id,
    size: [ptToUnits(1280), ptToUnits(800)]
  })

  // Outer HStack: sidebar (240pt) | divider | main (fill).
  const root = makeStack({
    parentId: w.id, name: 'Split',
    stackType: 'hstack', alignment: 'top', spacing: 0, padding: 0,
    widthMode: 'fill', heightMode: 'fill',
    splitStyle: 'joined', columnVisibility: 'all'
  })

  // ---- Sidebar ----
  // Joined sidebar — left edge inherits the window's corner radius;
  // right edge is flush against the detail pane. Soft secondary
  // surface that pairs with the near-white window plate.
  // Sidebar is 280pt wide (was 240) with 14pt inner padding so the
  // "Files" title + "..." menu button fit on one row without
  // clipping. JOINED split style rounds the leading edge into the
  // window corner; the right edge sits flush against the detail pane.
  const sidebar = makeStack({
    parentId: root.id, name: 'Sidebar',
    stackType: 'vstack', alignment: 'leading', spacing: 16, padding: 16,
    // Apple's visionOS Figma kit ships the sidebar at 320pt wide — see
    // SidebarItem (6:1512) which is 320×56. The earlier 280pt was an
    // arbitrary fit; 320pt aligns rows to the kit's metrics.
    fixedWidth: 320,
    widthMode: 'fixed', heightMode: 'fill',
    background: '#d8d8dc',
    cornerRadius: ptToUnits(WINDOW_CORNER_RADIUS),
    cornerRadii: JOINED_SIDEBAR_RADII
  })
  // Title row: "Files" + ⋯ menu. Uses title1 instead of largeTitle
  // so the title fits inside a 240pt sidebar without clipping. The
  // menu button keeps a faint glass swatch (matching visionOS' soft
  // pill chrome) — previously it had transparent fill + no glyph
  // colour, so it rendered as a blank dot.
  const sidebarHeader = makeStack({
    parentId: sidebar.id, name: 'Header',
    stackType: 'hstack', alignment: 'center', spacing: 8, padding: 0,
    widthMode: 'fill', heightMode: 'fit'
  })
  const sidebarTitle = makePanel('text', {
    parentId: sidebarHeader.id, name: 'Title', text: 'Files',
    textStyle: 'title1', fontSize: textStyleToFontSize('title1'),
    fontWeight: 'bold', widthMode: 'fill'
  })
  const sidebarMenu = makePanel('button', {
    parentId: sidebarHeader.id, name: 'Menu', text: '',
    size: [ptToUnits(32), ptToUnits(32)],
    cornerRadius: ptToUnits(16),
    buttonStyle: 'plain',
    color: '#ecedef', colorToken: null,
    textColor: '#000000', textColorToken: null,
    symbolName: 'ellipsis'
  })

  // Pinned rows. Width pinned to the sidebar width minus padding so
  // the list doesn't blow past the sidebar's fixed 240pt frame.
  // Pinned group — Apple's Files renders the top "Recents / Shared"
  // pair as separate rounded pill rows inside the sidebar gap, same
  // visual cadence as the section rows below. Sidebar list-style ships
  // each row in its own pill, matching the Figma SidebarItem (6:1512).
  const pinnedList = makePanel('list', {
    parentId: sidebar.id, name: 'Pinned',
    size: [ptToUnits(288), ptToUnits(0)],
    listStyle: 'sidebar',
    rows: [
      { title: 'Recents', subtitle: '' },
      { title: 'Shared',  subtitle: '' }
    ]
  })

  // Locations section. Apple's visionOS sidebar headers are weighted
  // landmarks, not muted captions — headline (17pt) semibold matches
  // the Figma kit's "Section Heading" style (white text on glass).
  // Row trailing `value` slots in for the count badge Apple shows on
  // the right edge of inbox-like rows (the "42" affordance).
  const locationsHeader = makePanel('text', {
    parentId: sidebar.id, name: 'Locations Header', text: 'Locations',
    textStyle: 'headline', fontSize: textStyleToFontSize('headline'),
    fontWeight: 'semibold', widthMode: 'fill',
    colorToken: 'primary'
  })
  const locationsList = makePanel('list', {
    parentId: sidebar.id, name: 'Locations',
    size: [ptToUnits(288), ptToUnits(0)],
    listStyle: 'sidebar',
    rows: [
      { title: 'iCloud Drive',           subtitle: '', value: '42' },
      { title: 'On My Apple Vision Pro', subtitle: '' },
      { title: 'Recently Deleted',       subtitle: '' }
    ]
  })

  // Tags section.
  const tagsHeader = makePanel('text', {
    parentId: sidebar.id, name: 'Tags Header', text: 'Tags',
    textStyle: 'headline', fontSize: textStyleToFontSize('headline'),
    fontWeight: 'semibold', widthMode: 'fill',
    colorToken: 'primary'
  })
  const tagsList = makePanel('list', {
    parentId: sidebar.id, name: 'Tags',
    size: [ptToUnits(288), ptToUnits(0)],
    listStyle: 'sidebar',
    rows: [
      { title: 'Red',    subtitle: '' },
      { title: 'Orange', subtitle: '' },
      { title: 'Yellow', subtitle: '' },
      { title: 'Green',  subtitle: '' }
    ]
  })

  // ---- Main ----
  const main = makeStack({
    parentId: root.id, name: 'Main',
    stackType: 'vstack', alignment: 'center', spacing: 0, padding: 0,
    widthMode: 'fill', heightMode: 'fill'
  })
  // Top toolbar: ‹ › buttons + "Recents" title + Select pill.
  // Tighter spacing + padding so the contents reliably fit inside
  // the main pane regardless of how the joined NavigationSplitView
  // allocates width between sidebar and detail. The crumb text
  // hugs its content (no widthMode fill) and gets pushed to the
  // centre by a leading Spacer; a trailing Spacer pushes the
  // Select pill to the right edge.
  const toolbar = makeStack({
    parentId: main.id, name: 'Toolbar',
    stackType: 'hstack', alignment: 'center', spacing: 6, padding: 8,
    widthMode: 'fill', heightMode: 'fit'
  })
  const back = makePanel('button', {
    parentId: toolbar.id, name: 'Back', text: '',
    size: [ptToUnits(30), ptToUnits(30)],
    cornerRadius: ptToUnits(15),
    buttonStyle: 'plain',
    color: '#d8d8dc', colorToken: null,
    textColor: '#000000', textColorToken: null,
    symbolName: 'chevron.left'
  })
  const fwd = makePanel('button', {
    parentId: toolbar.id, name: 'Forward', text: '',
    size: [ptToUnits(30), ptToUnits(30)],
    cornerRadius: ptToUnits(15),
    buttonStyle: 'plain',
    color: '#d8d8dc', colorToken: null,
    textColor: '#000000', textColorToken: null,
    symbolName: 'chevron.right'
  })
  const leadSpacer = makePanel('spacer', { parentId: toolbar.id, name: 'Lead Spacer' })
  const crumb = makePanel('text', {
    parentId: toolbar.id, name: 'Crumb', text: 'Recents',
    textStyle: 'headline', fontSize: textStyleToFontSize('headline'),
    fontWeight: 'semibold', textAlign: 'center',
    // Explicit width so the layout engine never wraps the title to
    // two lines when the spacers push the centre slot small.
    widthMode: 'fixed', size: [ptToUnits(120), ptToUnits(24)]
  })
  const trailSpacer = makePanel('spacer', { parentId: toolbar.id, name: 'Trail Spacer' })
  const select = makePanel('button', {
    parentId: toolbar.id, name: 'Select', text: 'Select',
    size: [ptToUnits(64), ptToUnits(30)],
    cornerRadius: ptToUnits(15),
    buttonStyle: 'plain',
    color: '#d8d8dc', colorToken: null,
    textColor: '#000000', textColorToken: null
  })

  // Empty-state column in the middle.
  const empty = makeStack({
    parentId: main.id, name: 'Empty State',
    stackType: 'vstack', alignment: 'center', spacing: 8, padding: 60,
    widthMode: 'fill', heightMode: 'fill'
  })
  const emptyIcon = makePanel('button', {
    parentId: empty.id, name: 'Icon', text: '',
    size: [ptToUnits(56), ptToUnits(56)],
    cornerRadius: ptToUnits(28),
    buttonStyle: 'plain',
    color: '#00000000', colorToken: null,
    symbolName: 'clock'
  })
  const emptyTitle = makePanel('text', {
    parentId: empty.id, name: 'Title', text: 'No Recents',
    textStyle: 'title2', fontSize: textStyleToFontSize('title2'),
    fontWeight: 'semibold', textAlign: 'center', widthMode: 'fill'
  })
  const emptyBody = makePanel('text', {
    parentId: empty.id, name: 'Body',
    text: 'Recently opened documents will appear here.',
    textStyle: 'subheadline', fontSize: textStyleToFontSize('subheadline'),
    textAlign: 'center', widthMode: 'fill', colorToken: 'secondary'
  })

  return {
    items: [
      tab, w, root,
      sidebar, sidebarHeader, sidebarTitle, sidebarMenu,
      pinnedList, locationsHeader, locationsList, tagsHeader, tagsList,
      main, toolbar, back, fwd, leadSpacer, crumb, trailSpacer, select,
      empty, emptyIcon, emptyTitle, emptyBody
    ],
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

// Empty volumetric stage with a single anchor on the floor — kept as
// the seed when the user switches into volume mode, but not surfaced
// as a splash pick.
function emptyVolume() {
  const tab = makeTab({ name: 'Volume', icon: 'cube' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Volume' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })
  return { items: [tab, w, anchor], activeTabId: tab.id }
}

// ---- Product Showcase (volume) ---------------------------------------
// Polished product-page hero: a brushed-metal sphere sitting on a
// dark plinth, with a glow ring underneath, title / tagline floating
// above, a spec callout on the left and a Buy CTA on the right.
// Volume camera sits on +Z, so layout uses ±X for left/right and
// +Y for up; entities keep their default 0° rotation and face the
// wearer correctly.
function productShowcase() {
  const tab = makeTab({ name: 'Product', icon: 'cube' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Showcase' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })

  // Plinth — short cylinder on the floor as a stage for the hero.
  const plinth = makeModelEntity('cylinder', {
    parentId: anchor.id, name: 'Plinth',
    cylinderRadius: 0.22, cylinderHeight: 0.04,
    position: [0, 1.0, 0]
  })
  plinth.materials = [{
    id: 'mat-product-base', type: 'simple',
    baseColor: '#1a1a1c', roughness: 0.4, isMetallic: false
  }]

  // Glow ring just above the plinth — flat thin disc with bright
  // emissive colour to read as ambient floor lighting. A loop timer
  // pulses the emission once a second to give the showcase a
  // "powered on" feel.
  const glow = makeModelEntity('cylinder', {
    parentId: anchor.id, name: 'Glow Ring',
    cylinderRadius: 0.30, cylinderHeight: 0.005,
    position: [0, 1.025, 0],
    behaviors: [
      behavior(
        trigger('timer', { mode: 'loop', seconds: 1.6 }),
        action('setMaterial', { property: 'emissionIntensity', numberValue: 2.4, duration: 0.8, curve: 'easeInOut', toggle: true })
      )
    ]
  })
  glow.materials = [{
    id: 'mat-product-glow', type: 'physicallyBased',
    baseColor: '#0a84ff', baseColorTextureName: null,
    roughness: 0.9, roughnessTextureName: null,
    metallic: 0, metallicTextureName: null,
    normalTextureName: null, ambientOcclusionTextureName: null,
    emissiveColor: '#0a84ff', emissiveIntensity: 1.4,
    emissiveTextureName: null,
    clearcoat: 0, clearcoatRoughness: 0,
    sheenColor: '#000000',
    blending: 'opaque', opacityThreshold: null,
    faceCulling: 'back',
    textureCoordinateTransform: { offsetU: 0, offsetV: 0, scaleU: 1, scaleV: 1, rotation: 0 }
  }]

  // Hero sphere — physically-based metal with clearcoat finish. Auto-
  // rotates on its plinth via a long-period timer so the designer
  // sees movement immediately on Preview, and tap toggles a slight
  // scale lift to read as "selected".
  const sphere = makeModelEntity('sphere', {
    parentId: anchor.id, name: 'Hero Object',
    sphereRadius: 0.14,
    position: [0, 1.18, 0],
    behaviors: [
      behavior(
        trigger('tap', { mode: 'single' }),
        action('scaleTo', { mode: 'absolute', value: 1.25, duration: 0.35, curve: 'spring', toggle: true })
      ),
      // Continuous slow Y-rotation so the showcase reads as alive
      // without any user input. 8s per full turn = a relaxed
      // turntable cadence.
      behavior(
        trigger('timer', { mode: 'loop', seconds: 8 }),
        action('rotateTo', { mode: 'relative', rotation: [0, 360, 0], duration: 8, curve: 'linear' })
      )
    ]
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

  // Spec callout (left), price (small, above Buy), Buy CTA (right).
  const spec = makeAttachmentEntity('text', {
    parentId: anchor.id, name: 'Spec',
    position: [-0.36, 1.20, 0],
    attachmentText: '78 mm · 320 g\nAnodized · 4-axis',
    attachmentFontSize: 0.028,
    attachmentBackground: '#1c1c1e',
    attachmentColor: '#cfcfcf',
    attachmentBillboard: true
  })
  const price = makeAttachmentEntity('text', {
    parentId: anchor.id, name: 'Price',
    position: [0.36, 1.27, 0],
    attachmentText: '$199',
    attachmentFontSize: 0.05,
    attachmentBackground: '#0c0c0e',
    attachmentColor: '#ffffff',
    attachmentBillboard: true
  })
  const buy = makeAttachmentEntity('button', {
    parentId: anchor.id, name: 'Buy',
    position: [0.36, 1.18, 0],
    attachmentText: 'Buy now',
    attachmentFontSize: 0.045,
    attachmentBackground: '#0a84ff',
    attachmentColor: '#ffffff',
    attachmentBillboard: true
  })

  return {
    items: [tab, w, anchor, plinth, glow, sphere, title, tagline, spec, price, buy],
    activeTabId: tab.id
  }
}

// ---- Solar System (volume) -------------------------------------------
// All eight planets plus the sun, lined up at chest height with size-
// scaled radii and per-planet labels. A thin glowing orbit ring sits
// under the row as a "this is a system" anchor. Sun is grouped under a
// "Star" empty so designers can move/rotate the whole row at once.
function solarSystem() {
  const tab = makeTab({ name: 'Cosmos', icon: 'sparkles' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Solar System' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })
  const system = makeGroupEntity({ parentId: anchor.id, name: 'System' })

  const items = [tab, w, anchor, system]

  // Sun — large emissive sphere at the left end. On scene start a
  // slow pulse loop bumps emission up + back down so the sun looks
  // alive even before the user touches anything.
  const sun = makeModelEntity('sphere', {
    parentId: system.id, name: 'Sun',
    sphereRadius: 0.10,
    position: [-0.55, 1.20, 0],
    behaviors: [
      behavior(
        trigger('timer', { mode: 'loop', seconds: 2.4 }),
        action('setMaterial', { property: 'emissionIntensity', numberValue: 2.4, duration: 1.2, curve: 'easeInOut', toggle: true })
      )
    ]
  })
  sun.materials = [{
    id: 'mat-sun', type: 'physicallyBased',
    baseColor: '#ffb84a', roughness: 0.6, metallic: 0,
    emissiveColor: '#ffb84a', emissiveIntensity: 1.6,
    clearcoat: 0, clearcoatRoughness: 0, sheenColor: '#000000',
    blending: 'opaque', opacityThreshold: null, faceCulling: 'back',
    baseColorTextureName: null, roughnessTextureName: null, metallicTextureName: null,
    normalTextureName: null, ambientOcclusionTextureName: null, emissiveTextureName: null,
    textureCoordinateTransform: { offsetU: 0, offsetV: 0, scaleU: 1, scaleV: 1, rotation: 0 }
  }]
  items.push(sun)
  items.push(makeAttachmentEntity('text', {
    parentId: system.id, name: 'Sun Label',
    position: [-0.55, 1.36, 0],
    attachmentText: 'Sun',
    attachmentFontSize: 0.030,
    attachmentBackground: '#2a2200',
    attachmentColor: '#ffd9a3',
    attachmentBillboard: true
  }))

  // Eight planets at increasing X. Sizes are perceptual (not to scale)
  // so the inner planets stay readable next to the gas giants.
  const planets = [
    { name: 'Mercury', x: -0.32, r: 0.018, color: '#a0a0a0', emissive: '#000000' },
    { name: 'Venus',   x: -0.20, r: 0.028, color: '#e0c47a', emissive: '#000000' },
    { name: 'Earth',   x: -0.08, r: 0.030, color: '#3a78ff', emissive: '#000000' },
    { name: 'Mars',    x:  0.04, r: 0.024, color: '#cf5530', emissive: '#000000' },
    { name: 'Jupiter', x:  0.18, r: 0.058, color: '#c89a72', emissive: '#000000' },
    { name: 'Saturn',  x:  0.34, r: 0.050, color: '#e6d3a3', emissive: '#000000' },
    { name: 'Uranus',  x:  0.46, r: 0.038, color: '#7ec8c8', emissive: '#000000' },
    { name: 'Neptune', x:  0.58, r: 0.036, color: '#3e60c0', emissive: '#000000' }
  ]
  for (const p of planets) {
    // Tap on a planet pops it up to 1.6× scale; tapping again snaps
    // back via auto-reverse. Each planet gets its own behavior record
    // so the runtime state is per-entity.
    const sphere = makeModelEntity('sphere', {
      parentId: system.id, name: p.name,
      sphereRadius: p.r,
      position: [p.x, 1.20, 0],
      behaviors: [
        behavior(
          trigger('tap', { mode: 'single' }),
          action('scaleTo', { mode: 'absolute', value: 1.6, duration: 0.3, curve: 'spring', toggle: true })
        )
      ]
    })
    sphere.materials = [{
      id: `mat-${p.name.toLowerCase()}`, type: 'simple',
      baseColor: p.color, roughness: 0.6, isMetallic: false
    }]
    items.push(sphere)
    items.push(makeAttachmentEntity('text', {
      parentId: system.id, name: `${p.name} Label`,
      position: [p.x, 1.20 + p.r + 0.05, 0],
      attachmentText: p.name,
      attachmentFontSize: 0.022,
      attachmentBackground: '#0c0c0e',
      attachmentColor: '#ffffff',
      attachmentBillboard: true
    }))
  }

  // Saturn's ring — flat thin disc tilted slightly so it reads as a ring.
  const saturnRing = makeModelEntity('cylinder', {
    parentId: system.id, name: 'Saturn Ring',
    cylinderRadius: 0.085, cylinderHeight: 0.002,
    position: [0.34, 1.20, 0],
    rotation: [12, 0, 0]
  })
  saturnRing.materials = [{
    id: 'mat-saturn-ring', type: 'simple',
    baseColor: '#c9b58a', roughness: 0.7, isMetallic: false
  }]
  items.push(saturnRing)

  // Floor band — long thin disc under the row, faint emissive blue, to
  // ground the system visually without competing with the planets.
  const orbitBand = makeModelEntity('box', {
    parentId: system.id, name: 'Orbit Band',
    boxSize: [1.05, 0.004, 0.04],
    position: [0.13, 1.04, 0]
  })
  orbitBand.materials = [{
    id: 'mat-orbit-band', type: 'physicallyBased',
    baseColor: '#0a1230', roughness: 0.9, metallic: 0,
    emissiveColor: '#3a78ff', emissiveIntensity: 0.6,
    clearcoat: 0, clearcoatRoughness: 0, sheenColor: '#000000',
    blending: 'opaque', opacityThreshold: null, faceCulling: 'back',
    baseColorTextureName: null, roughnessTextureName: null, metallicTextureName: null,
    normalTextureName: null, ambientOcclusionTextureName: null, emissiveTextureName: null,
    textureCoordinateTransform: { offsetU: 0, offsetV: 0, scaleU: 1, scaleV: 1, rotation: 0 }
  }]
  items.push(orbitBand)

  return { items, activeTabId: tab.id }
}

// ---- (Diorama deprecated — replaced by moodLamps below) ---------------
function diorama_legacy() {
  const tab = makeTab({ name: 'Diorama', icon: 'cube' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Diorama' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })
  const stage = makeGroupEntity({ parentId: anchor.id, name: 'Stage' })

  // Backing wall — vertical plane behind the towers. Default
  // rotation [0,0,0] keeps the plane upright with its normal facing
  // +Z (toward the wearer at +Z).
  const wall = makeModelEntity('plane', {
    parentId: stage.id, name: 'Wall',
    planeWidth: 0.9, planeDepth: 0.55,
    position: [0, 1.30, -0.18]
  })
  wall.materials = [{
    id: 'mat-wall-1', type: 'simple',
    baseColor: '#7a8aa0', roughness: 0.85, isMetallic: false
  }]

  // Floor pad — horizontal plane at the towers' base, rotated 90° on
  // X so its normal points up.
  const pad = makeModelEntity('plane', {
    parentId: stage.id, name: 'Floor Pad',
    planeWidth: 0.92, planeDepth: 0.45,
    position: [0, 1.045, 0],
    rotation: [-90, 0, 0]
  })
  pad.materials = [{
    id: 'mat-pad-1', type: 'simple',
    baseColor: '#3a3f48', roughness: 0.7, isMetallic: false
  }]

  // Three towers in saturated colours, ascending heights. Tap a
  // tower to launch it 12 cm up with a spring curve, auto-reverse
  // brings it back on the second tap — a tiny tactile interaction
  // that hints at how the behaviour system stacks transforms.
  const towerColors = ['#e07a5f', '#81b29a', '#f2cc8f']
  const towers = towerColors.map((c, i) => {
    const h = 0.12 + i * 0.07
    const tower = makeModelEntity('box', {
      parentId: stage.id, name: `Tower ${i + 1}`,
      boxSize: [0.09, h, 0.09],
      position: [-0.22 + i * 0.22, 1.05 + h / 2, 0],
      behaviors: [
        behavior(
          trigger('tap', { mode: 'single' }),
          action('moveTo', { mode: 'offset', position: [0, 0.12, 0], duration: 0.35, curve: 'spring', toggle: true })
        )
      ]
    })
    tower.materials = [{
      id: `mat-tower-${i}`, type: 'simple',
      baseColor: c, roughness: 0.55, isMetallic: false
    }]
    return tower
  })

  const label = makeAttachmentEntity('text', {
    parentId: stage.id, name: 'Title',
    position: [0, 1.62, 0],
    attachmentText: 'Diorama',
    attachmentFontSize: 0.040,
    attachmentBackground: '#0c0c0e',
    attachmentColor: '#ffffff',
    attachmentBillboard: true
  })

  return {
    items: [tab, w, anchor, stage, wall, pad, ...towers, label],
    activeTabId: tab.id
  }
}

// ---- Mood Lamps (volume) ---------------------------------------------
// Three pendant lamps in a row over a dark slab "console". Each lamp
// is a sphere bulb on a thin stem; tap a bulb to toggle it from a low
// resting glow to a saturated colour pulse, and tap again to dim back
// down (auto-reverse). Demonstrates per-entity state via `toggle: true`
// without any global variables — useful as a starter for any "smart
// home / picker / per-item state" UI.
function moodLamps() {
  const tab = makeTab({ name: 'Mood', icon: 'lightbulb' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Mood Lamps' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })
  const items = [tab, w, anchor]

  // Console slab — flat box that visually grounds the lamps.
  const slab = makeModelEntity('box', {
    parentId: anchor.id, name: 'Console',
    boxSize: [0.84, 0.04, 0.18],
    position: [0, 1.05, 0]
  })
  slab.materials = [{
    id: 'mat-slab', type: 'simple',
    baseColor: '#1a1a1c', roughness: 0.85, isMetallic: false
  }]
  items.push(slab)

  // Three lamps. Each lamp = stem (small cylinder) + bulb (sphere).
  // Bulb has a saturated emissive colour; the tap behaviour pulses
  // the emission intensity up to a "fully on" level, and the second
  // tap (auto-reverse) dims it back to its resting glow.
  const lampSpecs = [
    { name: 'Warm',  x: -0.30, color: '#ff9a3c', restGlow: 0.4 },
    { name: 'Cool',  x:  0.00, color: '#3a78ff', restGlow: 0.4 },
    { name: 'Lime',  x:  0.30, color: '#7be39c', restGlow: 0.4 }
  ]
  for (const l of lampSpecs) {
    const stem = makeModelEntity('cylinder', {
      parentId: anchor.id, name: `${l.name} Stem`,
      cylinderRadius: 0.005, cylinderHeight: 0.10,
      position: [l.x, 1.13, 0]
    })
    stem.materials = [{
      id: `mat-stem-${l.name.toLowerCase()}`, type: 'simple',
      baseColor: '#3a3a3c', roughness: 0.6, isMetallic: false
    }]
    items.push(stem)

    const bulb = makeModelEntity('sphere', {
      parentId: anchor.id, name: `${l.name} Lamp`,
      sphereRadius: 0.045,
      position: [l.x, 1.24, 0],
      behaviors: [
        behavior(
          trigger('tap', { mode: 'single' }),
          action('setMaterial', { property: 'emissionIntensity', numberValue: 3.0, duration: 0.35, curve: 'easeOut', toggle: true })
        ),
        // Subtle gentle bob so even unactivated lamps feel alive.
        behavior(
          trigger('timer', { mode: 'loop', seconds: 2.6 }),
          action('moveTo', { mode: 'offset', position: [0, 0.012, 0], duration: 1.3, curve: 'easeInOut', toggle: true })
        )
      ]
    })
    bulb.materials = [{
      id: `mat-bulb-${l.name.toLowerCase()}`, type: 'physicallyBased',
      baseColor: l.color, roughness: 0.35, metallic: 0,
      emissiveColor: l.color, emissiveIntensity: l.restGlow,
      clearcoat: 0.4, clearcoatRoughness: 0.2, sheenColor: '#000000',
      blending: 'opaque', opacityThreshold: null, faceCulling: 'back',
      baseColorTextureName: null, roughnessTextureName: null, metallicTextureName: null,
      normalTextureName: null, ambientOcclusionTextureName: null, emissiveTextureName: null,
      textureCoordinateTransform: { offsetU: 0, offsetV: 0, scaleU: 1, scaleV: 1, rotation: 0 }
    }]
    items.push(bulb)
  }

  // Caption above.
  items.push(makeAttachmentEntity('text', {
    parentId: anchor.id, name: 'Caption',
    position: [0, 1.40, 0],
    attachmentText: 'Tap a lamp',
    attachmentFontSize: 0.030,
    attachmentBackground: '#0c0c0e',
    attachmentColor: '#ffffff',
    attachmentBillboard: true
  }))

  return { items, activeTabId: tab.id }
}

// ---- Spinning Showcase (volume) --------------------------------------
// Three product cubes arranged in a triangle; the whole group rotates
// continuously around Y like a museum turntable. Tap any cube to scale
// up + emit; tap again to settle back. Demonstrates continuous
// behaviour (timer-driven group rotation) layered with per-entity tap
// interactions, so designers can copy the pattern for any
// "always-moving showcase" UI.
function spinningShowcase() {
  const tab = makeTab({ name: 'Showcase', icon: 'cube' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Showcase' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })
  // Group rotates as a unit. The continuous spin lives on this group
  // via a 6-second loop timer that nudges Y by +60° each tick — over
  // many cycles the visual cadence is a smooth slow turn.
  const turntable = makeGroupEntity({
    parentId: anchor.id, name: 'Turntable',
    position: [0, 1.20, 0],
    behaviors: [
      behavior(
        trigger('timer', { mode: 'loop', seconds: 6.0 }),
        action('rotateTo', { mode: 'relative', rotation: [0, 360, 0], duration: 6.0, curve: 'linear' })
      )
    ]
  })

  // Three cubes equally spaced around the group origin.
  const cubeSpecs = [
    { name: 'Crimson',  angle: 0,           color: '#e94e62' },
    { name: 'Emerald',  angle: 120,         color: '#3aab7a' },
    { name: 'Sapphire', angle: 240,         color: '#3a78ff' }
  ]
  const items = [tab, w, anchor, turntable]
  const radius = 0.18
  for (const c of cubeSpecs) {
    const rad = c.angle * Math.PI / 180
    const cube = makeModelEntity('box', {
      parentId: turntable.id, name: c.name,
      boxSize: [0.10, 0.10, 0.10],
      position: [Math.cos(rad) * radius, 0, Math.sin(rad) * radius],
      rotation: [0, -c.angle, 0],  // face outward
      behaviors: [
        behavior(
          trigger('tap', { mode: 'single' }),
          action('scaleTo', { mode: 'absolute', value: 1.4, duration: 0.3, curve: 'spring', toggle: true })
        ),
        behavior(
          trigger('tap', { mode: 'single' }),
          action('setMaterial', { property: 'emissionIntensity', numberValue: 2.4, duration: 0.25, curve: 'easeOut', toggle: true })
        )
      ]
    })
    cube.materials = [{
      id: `mat-cube-${c.name.toLowerCase()}`, type: 'physicallyBased',
      baseColor: c.color, roughness: 0.4, metallic: 0.2,
      emissiveColor: c.color, emissiveIntensity: 0.3,
      clearcoat: 0.5, clearcoatRoughness: 0.2, sheenColor: '#000000',
      blending: 'opaque', opacityThreshold: null, faceCulling: 'back',
      baseColorTextureName: null, roughnessTextureName: null, metallicTextureName: null,
      normalTextureName: null, ambientOcclusionTextureName: null, emissiveTextureName: null,
      textureCoordinateTransform: { offsetU: 0, offsetV: 0, scaleU: 1, scaleV: 1, rotation: 0 }
    }]
    items.push(cube)
  }

  // Title above the turntable.
  items.push(makeAttachmentEntity('text', {
    parentId: anchor.id, name: 'Title',
    position: [0, 1.45, 0],
    attachmentText: 'Showcase',
    attachmentFontSize: 0.038,
    attachmentBackground: '#0c0c0e',
    attachmentColor: '#ffffff',
    attachmentBillboard: true
  }))

  return { items, activeTabId: tab.id }
}

// ---- Gallery (volume) ------------------------------------------------
// Three framed picture planes mounted on the back wall, with a small
// caption label under each. Picture frames are thin boxes behind a
// brighter inner plane to mimic a matte / mount. Designers can swap
// the picture-plane materials for textures later.
function gallery() {
  const tab = makeTab({ name: 'Gallery', icon: 'square.grid.2x2' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Gallery' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })

  // Back wall — wider than the diorama to leave room for three frames.
  const wall = makeModelEntity('plane', {
    parentId: anchor.id, name: 'Back Wall',
    planeWidth: 1.4, planeDepth: 0.7,
    position: [0, 1.40, -0.20]
  })
  wall.materials = [{
    id: 'mat-gallery-wall', type: 'simple',
    baseColor: '#e9e6dd', roughness: 0.9, isMetallic: false
  }]

  const items = [tab, w, anchor, wall]
  const pictures = [
    { name: 'Sunrise',  x: -0.45, color: '#f4a261' },
    { name: 'Forest',   x:  0.00, color: '#2a9d8f' },
    { name: 'Twilight', x:  0.45, color: '#5a4fcf' }
  ]
  for (const p of pictures) {
    // Frame — thin box flush against the wall.
    const frame = makeModelEntity('box', {
      parentId: anchor.id, name: `${p.name} Frame`,
      boxSize: [0.32, 0.24, 0.012],
      position: [p.x, 1.40, -0.193]
    })
    frame.materials = [{
      id: `mat-frame-${p.name.toLowerCase()}`, type: 'simple',
      baseColor: '#1a1a1c', roughness: 0.55, isMetallic: false
    }]
    items.push(frame)

    // Picture — coloured plane sitting just in front of the frame.
    // On hover-enter it warms emission AND scales up slightly so the
    // "focused work" feedback is visible against the wall. Hover-
    // leave reverses both. Plus a tap behaviour pops it forward as a
    // "select" cue, so the gallery reads as interactive even without
    // gaze hardware.
    const pic = makeModelEntity('plane', {
      parentId: anchor.id, name: p.name,
      planeWidth: 0.28, planeDepth: 0.20,
      position: [p.x, 1.40, -0.186],
      behaviors: [
        behavior(
          trigger('hover', { mode: 'enter' }),
          action('setMaterial', { property: 'emission', colorValue: p.color, duration: 0.18, curve: 'easeOut' }),
          action('scaleTo', { mode: 'absolute', value: 1.08, duration: 0.18, curve: 'easeOut' })
        ),
        behavior(
          trigger('hover', { mode: 'leave' }),
          action('setMaterial', { property: 'emission', colorValue: '#000000', duration: 0.25, curve: 'easeOut' }),
          action('scaleTo', { mode: 'absolute', value: 1.0, duration: 0.25, curve: 'easeOut' })
        ),
        behavior(
          trigger('tap', { mode: 'single' }),
          action('moveTo', { mode: 'offset', position: [0, 0, 0.04], duration: 0.3, curve: 'spring', toggle: true })
        )
      ]
    })
    pic.materials = [{
      id: `mat-pic-${p.name.toLowerCase()}`, type: 'simple',
      baseColor: p.color, roughness: 0.45, isMetallic: false
    }]
    items.push(pic)

    items.push(makeAttachmentEntity('text', {
      parentId: anchor.id, name: `${p.name} Caption`,
      position: [p.x, 1.20, -0.18],
      attachmentText: p.name,
      attachmentFontSize: 0.026,
      attachmentBackground: '#0c0c0e',
      attachmentColor: '#ffffff',
      attachmentBillboard: true
    }))
  }
  return { items, activeTabId: tab.id }
}

// ---- Card Stack (volume) ---------------------------------------------
// Three flat 3D cards fanned in a row at chest height, each with a
// title and a body label. A great starter for designers who want to
// wire up tap-to-flip behaviours: every card is a default-rotated
// plane facing the wearer.
function cardStack() {
  const tab = makeTab({ name: 'Cards', icon: 'rectangle.stack' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Cards' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })

  const items = [tab, w, anchor]
  const cards = [
    { name: 'Today',    x: -0.34, color: '#0a84ff', body: 'Sunny\n68° / 51°' },
    { name: 'Tomorrow', x:  0.00, color: '#5e5ce6', body: 'Cloudy\n65° / 49°' },
    { name: 'Friday',   x:  0.34, color: '#ff9f0a', body: 'Showers\n61° / 47°' }
  ]
  for (const c of cards) {
    // Card body — slightly thick box so it reads as a card, not a
    // sticker. Default rotation [0,0,0] keeps the card facing +Z.
    // Tap-to-flip is wired by default: rotateY 180° with auto-reverse,
    // so the second tap flips back to the front face.
    const card = makeModelEntity('box', {
      parentId: anchor.id, name: c.name,
      boxSize: [0.26, 0.34, 0.02],
      position: [c.x, 1.22, 0],
      behaviors: [
        behavior(
          trigger('tap', { mode: 'single' }),
          action('rotateTo', { mode: 'relative', rotation: [0, 180, 0], duration: 0.45, curve: 'easeInOut', toggle: true })
        )
      ]
    })
    card.materials = [{
      id: `mat-card-${c.name.toLowerCase()}`, type: 'physicallyBased',
      baseColor: c.color, roughness: 0.4, metallic: 0,
      emissiveColor: c.color, emissiveIntensity: 0.25,
      clearcoat: 0.4, clearcoatRoughness: 0.2, sheenColor: '#000000',
      blending: 'opaque', opacityThreshold: null, faceCulling: 'back',
      baseColorTextureName: null, roughnessTextureName: null, metallicTextureName: null,
      normalTextureName: null, ambientOcclusionTextureName: null, emissiveTextureName: null,
      textureCoordinateTransform: { offsetU: 0, offsetV: 0, scaleU: 1, scaleV: 1, rotation: 0 }
    }]
    items.push(card)

    items.push(makeAttachmentEntity('text', {
      parentId: anchor.id, name: `${c.name} Title`,
      position: [c.x, 1.34, 0.012],
      attachmentText: c.name,
      attachmentFontSize: 0.030,
      attachmentBackground: '#00000000',
      attachmentColor: '#ffffff',
      attachmentBillboard: true
    }))
    items.push(makeAttachmentEntity('text', {
      parentId: anchor.id, name: `${c.name} Body`,
      position: [c.x, 1.20, 0.012],
      attachmentText: c.body,
      attachmentFontSize: 0.024,
      attachmentBackground: '#00000000',
      attachmentColor: '#ffffff',
      attachmentBillboard: true
    }))
  }
  return { items, activeTabId: tab.id }
}

// ---- Reactive Lights (volume) ----------------------------------------
// A row of five glowing pucks plus a master orb that broadcasts a
// scene-wide "wave" event when tapped. Each puck listens for the
// event and pops + glows in sequence after a short stagger, so the
// whole row rolls like a Mexican wave. Showcases broadcast events,
// staggered timers, and mixed transform / material animations — a
// great "what's possible" template for new users.
function reactiveLights() {
  const tab = makeTab({ name: 'Lights', icon: 'sparkles' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Reactive Lights' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'World Anchor' })
  const items = [tab, w, anchor]

  // Master orb in the centre — tap it to broadcast a "wave" event
  // that the row of pucks listens for. Also pulses on its own.
  const master = makeModelEntity('sphere', {
    parentId: anchor.id, name: 'Master Orb',
    sphereRadius: 0.07,
    position: [0, 1.50, 0],
    behaviors: [
      behavior(
        trigger('tap', { mode: 'single' }),
        action('broadcast', { name: 'wave' })
      ),
      behavior(
        trigger('timer', { mode: 'loop', seconds: 0.9 }),
        action('setMaterial', { property: 'emissionIntensity', numberValue: 2.6, duration: 0.45, curve: 'easeInOut', toggle: true })
      )
    ]
  })
  master.materials = [{
    id: 'mat-master', type: 'physicallyBased',
    baseColor: '#ffffff', roughness: 0.4, metallic: 0,
    emissiveColor: '#ffffff', emissiveIntensity: 1.0,
    clearcoat: 0.3, clearcoatRoughness: 0.2, sheenColor: '#000000',
    blending: 'opaque', opacityThreshold: null, faceCulling: 'back',
    baseColorTextureName: null, roughnessTextureName: null, metallicTextureName: null,
    normalTextureName: null, ambientOcclusionTextureName: null, emissiveTextureName: null,
    textureCoordinateTransform: { offsetU: 0, offsetV: 0, scaleU: 1, scaleV: 1, rotation: 0 }
  }]
  items.push(master)

  // Title above the row.
  items.push(makeAttachmentEntity('text', {
    parentId: anchor.id, name: 'Title',
    position: [0, 1.66, 0],
    attachmentText: 'Tap the orb',
    attachmentFontSize: 0.034,
    attachmentBackground: '#0c0c0e',
    attachmentColor: '#ffffff',
    attachmentBillboard: true
  }))

  // Five pucks in a row at chest height, each in its own colour. They
  // all listen for the "wave" event but use the staggered stack of
  // wait + scaleTo + setMaterial actions so the wave rolls left to
  // right. Tap on a puck individually toggles a self pop too.
  const pucks = [
    { name: 'Puck 1', x: -0.40, color: '#e94e62' },
    { name: 'Puck 2', x: -0.20, color: '#f5b14a' },
    { name: 'Puck 3', x:  0.00, color: '#7be39c' },
    { name: 'Puck 4', x:  0.20, color: '#3a78ff' },
    { name: 'Puck 5', x:  0.40, color: '#a05dff' }
  ]
  for (let i = 0; i < pucks.length; i++) {
    const p = pucks[i]
    const stagger = i * 0.12
    const puck = makeModelEntity('cylinder', {
      parentId: anchor.id, name: p.name,
      cylinderRadius: 0.06, cylinderHeight: 0.04,
      position: [p.x, 1.10, 0],
      behaviors: [
        // Wave reaction — staggered pop + glow, then wait + reverse.
        behavior(
          trigger('eventReceived', { name: 'wave' }),
          action('wait', { seconds: stagger }),
          action('moveTo', { mode: 'offset', position: [0, 0.10, 0], duration: 0.18, curve: 'easeOut' }),
          action('setMaterial', { property: 'emissionIntensity', numberValue: 2.5, duration: 0.18, curve: 'easeOut' }),
          action('wait', { seconds: 0.25 }),
          action('moveTo', { mode: 'offset', position: [0, 0, 0], duration: 0.30, curve: 'easeIn' }),
          action('setMaterial', { property: 'emissionIntensity', numberValue: 0.6, duration: 0.30, curve: 'easeIn' })
        ),
        // Self-tap — single pop, auto-reverse.
        behavior(
          trigger('tap', { mode: 'single' }),
          action('scaleTo', { mode: 'absolute', value: 1.4, duration: 0.25, curve: 'spring', toggle: true })
        )
      ]
    })
    puck.materials = [{
      id: `mat-puck-${i}`, type: 'physicallyBased',
      baseColor: p.color, roughness: 0.45, metallic: 0,
      emissiveColor: p.color, emissiveIntensity: 0.6,
      clearcoat: 0.2, clearcoatRoughness: 0.3, sheenColor: '#000000',
      blending: 'opaque', opacityThreshold: null, faceCulling: 'back',
      baseColorTextureName: null, roughnessTextureName: null, metallicTextureName: null,
      normalTextureName: null, ambientOcclusionTextureName: null, emissiveTextureName: null,
      textureCoordinateTransform: { offsetU: 0, offsetV: 0, scaleU: 1, scaleV: 1, rotation: 0 }
    }]
    items.push(puck)
  }

  return { items, activeTabId: tab.id }
}

// ---- Public registry --------------------------------------------------

export const TEMPLATES = {
  // `blank` and `emptyVolume` are kept here because the store seeds
  // them when the user switches scene modes; they're intentionally
  // omitted from the splash order arrays below so they don't appear
  // as picks (they're not really templates, just empty starters).
  blank:        { mode: 'window', label: 'Blank',          description: 'Empty window with a single fill stack — start from scratch.',                build: blank },
  emptyVolume:  { mode: 'volume', label: 'Empty Volume',   description: 'Volumetric stage with a single world anchor — start from scratch.',          build: emptyVolume },
  // Window-mode templates surfaced on the splash. Six refined,
  // production-ready layouts that map directly onto Apple's visionOS
  // HIG patterns — onboarding splash, category browse, Now Playing
  // card, profile detail, long-form article, and a sectioned settings
  // page. Each uses semantic colour tokens so Scene → Colors
  // re-themes the whole layout in one shot.
  welcome:      { mode: 'window', label: 'Welcome',        description: 'Onboarding splash — hero icon, centred title block, primary CTA.',          build: welcomeTpl },
  browse:       { mode: 'window', label: 'Browse',         description: 'Category grid with a search field — Music Browse / App Store landing.',     build: browseTpl },
  player:       { mode: 'window', label: 'Player',         description: 'Now Playing card: artwork, track meta, scrubber, transport row.',           build: playerTpl },
  profile:      { mode: 'window', label: 'Profile',        description: 'People-card with avatar, identity, stat chips, and primary actions.',       build: profileTpl },
  article:      { mode: 'window', label: 'Article',        description: 'Long-form reader: eyebrow, headline, byline, hero image, body copy.',       build: articleTpl },
  settings:     { mode: 'window', label: 'Settings',       description: 'Sectioned preferences page with account header and grouped toggle rows.',   build: settingsTpl },
  // Legacy template keys preserved for save-file compatibility — not
  // surfaced in the splash picker.
  musicPlayer:  { mode: 'window', label: 'Music Player (legacy)',   description: 'Legacy Now Playing template.',  build: musicPlayer },
  smartHome:    { mode: 'window', label: 'Smart Home (legacy)',     description: 'Legacy Smart Home dashboard.',  build: smartHome },
  settingsOld:  { mode: 'window', label: 'Settings (legacy)',       description: 'Legacy Settings template.',     build: settings },
  mailApp:      { mode: 'window', label: 'Mail (legacy)',           description: 'Legacy Mail template.',         build: mailApp },
  tabBar:       { mode: 'window', label: 'Tab Bar App (legacy)',    description: 'Legacy Tab Bar template.',      build: tabBarApp },
  filesApp:     { mode: 'window', label: 'Files (legacy)',          description: 'Legacy Files template.',        build: filesApp },
  // Volume-mode
  productShowcase: { mode: 'volume', label: 'Product Showcase', description: 'Metal hero auto-rotates on a plinth with a pulsing glow ring; tap to scale up.', build: productShowcase },
  solarSystem:     { mode: 'volume', label: 'Solar System',     description: 'Eight planets and the sun lined up with a glowing orbit band. Tap any planet to scale up, sun pulses.', build: solarSystem },
  moodLamps:       { mode: 'volume', label: 'Mood Lamps',       description: 'Three pendant lamps over a console. Tap a lamp to brighten it; lamps gently bob on their own.', build: moodLamps },
  gallery:         { mode: 'volume', label: 'Gallery',          description: 'Three framed pictures on a back wall. Hover or tap to focus each work.',                              build: gallery },
  spinningShowcase:{ mode: 'volume', label: 'Spinning Showcase',description: 'Three product cubes on a turntable that spins continuously. Tap a cube to highlight it.',           build: spinningShowcase },
  reactiveLights:  { mode: 'volume', label: 'Reactive Lights',  description: 'Master orb broadcasts a wave event; five coloured pucks roll a Mexican wave in sequence.',           build: reactiveLights },
  // Legacy keys kept for backwards compatibility with any saved
  // scenes — not surfaced on the splash.
  diorama:         { mode: 'volume', label: 'Diorama',          description: 'Three towers on a floor pad with a backing wall.',                                                  build: diorama_legacy },
  cardStack:       { mode: 'volume', label: 'Card Stack',       description: 'A row of weather cards. Tap a card to flip it 180°.',                                              build: cardStack }
}

export const TEMPLATE_ORDER_WINDOW = [
  'welcome', 'browse', 'player', 'profile', 'article', 'settings'
]
export const TEMPLATE_ORDER_VOLUME = [
  'productShowcase', 'solarSystem', 'moodLamps', 'gallery', 'spinningShowcase', 'reactiveLights'
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
