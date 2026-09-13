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
  makeAnchorEntity, makeModelEntity, makeGroupEntity, makeLightEntity,
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
  // Three feature cards under the hero block — same pattern Apple uses
  // in the visionOS onboarding flow ("See", "Work", "Be Present"). Each
  // card carries a symbol, a tiny heading and a one-liner so the screen
  // reads as a finished pitch instead of "title + button".
  const root = makeStack({
    parentId: w.id, name: 'Content',
    stackType: 'vstack', alignment: 'center', spacing: 36, padding: 56,
    widthMode: 'fill', heightMode: 'fill'
  })
  const heroBox = makeStack({
    parentId: root.id, name: 'Hero',
    stackType: 'vstack', alignment: 'center', spacing: 16, padding: 0,
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
    stackType: 'vstack', alignment: 'center', spacing: 8, padding: 0,
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
    text: 'A new way to see, work, and be present — designed for the way you really live in your space.',
    textStyle: 'title3', fontSize: textStyleToFontSize('title3'),
    fontWeight: 'regular', textAlign: 'center',
    colorToken: 'secondary',
    size: [ptToUnits(560), ptToUnits(72)],
    widthMode: 'fixed'
  })
  // Feature row — three glass tiles in a horizontal stack. Each tile is
  // narrow so the row reads as a compact rhythm under the hero block
  // rather than competing with the title for attention.
  const features = makeStack({
    parentId: root.id, name: 'Features',
    stackType: 'hstack', alignment: 'top', spacing: 16, padding: 0,
    widthMode: 'fit', heightMode: 'fit'
  })
  const featureSpecs = [
    { name: 'See',     symbol: 'eye',            tint: 'systemBlue',   title: 'See',     copy: 'Surfaces extend past the screen edge into your environment.' },
    { name: 'Work',    symbol: 'sparkle',        tint: 'systemPurple', title: 'Work',    copy: 'Arrange spatial windows the way you arrange your desk.' },
    { name: 'Present', symbol: 'person.2.wave.2.fill', tint: 'systemTeal', title: 'Present', copy: 'Stay grounded in the room while you read, watch, and play.' }
  ]
  const featureItems = []
  for (const f of featureSpecs) {
    const tile = makeStack({
      parentId: features.id, name: `${f.name} Tile`,
      stackType: 'vstack', alignment: 'leading', spacing: 10, padding: 18,
      background: 'glassThin', cornerRadius: ptToUnits(20),
      size: [ptToUnits(220), ptToUnits(150)],
      widthMode: 'fixed', heightMode: 'fixed'
    })
    const tileIcon = makePanel('label', {
      parentId: tile.id, name: `${f.name} Icon`, text: '',
      symbolName: f.symbol, symbolRenderingMode: 'hierarchical',
      styles: { labelStyle: 'iconOnly' },
      size: [ptToUnits(32), ptToUnits(32)],
      colorToken: f.tint
    })
    const tileTitle = makePanel('text', {
      parentId: tile.id, name: `${f.name} Title`, text: f.title,
      textStyle: 'headline', fontSize: textStyleToFontSize('headline'),
      fontWeight: 'semibold', textAlign: 'left',
      widthMode: 'fill', colorToken: 'primary'
    })
    const tileCopy = makePanel('text', {
      parentId: tile.id, name: `${f.name} Copy`, text: f.copy,
      textStyle: 'footnote', fontSize: textStyleToFontSize('footnote'),
      textAlign: 'left', widthMode: 'fill', colorToken: 'secondary'
    })
    featureItems.push(tile, tileIcon, tileTitle, tileCopy)
  }
  const actions = makeStack({
    parentId: root.id, name: 'Actions',
    stackType: 'vstack', alignment: 'center', spacing: 8, padding: 0,
    widthMode: 'fit', heightMode: 'fit'
  })
  const cta = makePanel('button', {
    parentId: actions.id, name: 'Get Started',
    text: 'Get Started',
    buttonSize: 'large', buttonShape: 'capsule',
    buttonStyle: 'borderedProminent',
    size: [ptToUnits(240), ptToUnits(52)]
  })
  const skip = makePanel('button', {
    parentId: actions.id, name: 'Skip',
    text: 'Not Now',
    buttonStyle: 'plain', buttonSize: 'regular',
    colorToken: null, color: '#00000000',
    textColorToken: 'secondary'
  })
  return {
    items: [tab, w, root, heroBox, icon, titleBlock, title, subtitle,
      features, ...featureItems, actions, cta, skip],
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
  // Six categories laid out as a 3×2 grid. Each card carries a tinted
  // symbol, a title, and a count caption — the same metadata Apple uses
  // on the Music/App-Store landing tiles.
  const CARD_W = 340, CARD_H = 120, GAP = 16, ROW_W = 3 * CARD_W + 2 * GAP
  const root = makeStack({
    parentId: w.id, name: 'Content',
    stackType: 'vstack', alignment: 'leading', spacing: 18, padding: 28,
    widthMode: 'fill', heightMode: 'fill'
  })
  const headerRow = makeStack({
    parentId: root.id, name: 'Header Row',
    stackType: 'hstack', alignment: 'center', spacing: 12, padding: 0,
    widthMode: 'fill', heightMode: 'fit'
  })
  const header = makePanel('text', {
    parentId: headerRow.id, name: 'Page Title',
    text: 'Browse',
    textStyle: 'largeTitle', fontSize: textStyleToFontSize('largeTitle'),
    fontWeight: 'bold', textAlign: 'left',
    widthMode: 'fill', colorToken: 'primary'
  })
  const filterBtn = makePanel('button', {
    parentId: headerRow.id, name: 'Filter',
    text: 'Filter', symbolName: 'line.3.horizontal.decrease.circle',
    buttonStyle: 'bordered', buttonShape: 'capsule', buttonSize: 'regular',
    size: [ptToUnits(120), ptToUnits(36)]
  })
  const subhead = makePanel('text', {
    parentId: root.id, name: 'Subhead',
    text: 'Discover spatial collections curated for the way you live and work.',
    textStyle: 'subheadline', fontSize: textStyleToFontSize('subheadline'),
    textAlign: 'left', widthMode: 'fill', colorToken: 'secondary'
  })
  const searchField = makePanel('search', {
    parentId: root.id, name: 'Search',
    text: 'Search films, music, environments…',
    size: [ptToUnits(ROW_W), ptToUnits(44)]
  })
  // Featured strip — single tall hero card sitting above the grid.
  const featuredCard = makeStack({
    parentId: root.id, name: 'Featured',
    stackType: 'hstack', alignment: 'center', spacing: 18, padding: 18,
    background: 'glassThick', cornerRadius: ptToUnits(24),
    size: [ptToUnits(ROW_W), ptToUnits(132)],
    widthMode: 'fixed', heightMode: 'fixed'
  })
  const featuredArt = makePanel('image', {
    parentId: featuredCard.id, name: 'Featured Art',
    size: [ptToUnits(96), ptToUnits(96)],
    cornerRadius: ptToUnits(16),
    color: '#1c1c1e', colorToken: null,
    imageUrl: '/samples/images/Sample 01.jpg', imageFit: 'fill'
  })
  const featuredMeta = makeStack({
    parentId: featuredCard.id, name: 'Featured Meta',
    stackType: 'vstack', alignment: 'leading', spacing: 6, padding: 0,
    widthMode: 'fill', heightMode: 'fit'
  })
  const featuredEyebrow = makePanel('text', {
    parentId: featuredMeta.id, name: 'Featured Eyebrow', text: 'FEATURED',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    fontWeight: 'bold', textAlign: 'left',
    widthMode: 'fill', colorToken: 'systemBlue'
  })
  const featuredTitle = makePanel('text', {
    parentId: featuredMeta.id, name: 'Featured Title',
    text: 'Mount Hood Environment',
    textStyle: 'title3', fontSize: textStyleToFontSize('title3'),
    fontWeight: 'semibold', textAlign: 'left',
    widthMode: 'fill', colorToken: 'primary'
  })
  const featuredCopy = makePanel('text', {
    parentId: featuredMeta.id, name: 'Featured Copy',
    text: 'A wide-format spatial scene captured at the volcano summit.',
    textStyle: 'subheadline', fontSize: textStyleToFontSize('subheadline'),
    textAlign: 'left', widthMode: 'fill', colorToken: 'secondary'
  })
  const featuredCta = makePanel('button', {
    parentId: featuredCard.id, name: 'Open',
    text: 'Open', symbolName: 'arrow.right',
    buttonStyle: 'borderedProminent', buttonShape: 'capsule', buttonSize: 'regular',
    size: [ptToUnits(108), ptToUnits(40)]
  })
  // Grid of category cards
  const cards = [
    { name: 'Spatial Photos', symbol: 'photo.on.rectangle.angled', tint: 'systemPurple', count: '128 spatial moments' },
    { name: 'Films',          symbol: 'play.rectangle',            tint: 'systemPink',   count: '24 titles · 4K · Spatial' },
    { name: 'Music',          symbol: 'music.note',                tint: 'systemRed',    count: '6,500 lossless tracks' },
    { name: 'Environments',   symbol: 'mountain.2.fill',           tint: 'systemTeal',   count: '12 scenes · day & night' },
    { name: 'Apps',           symbol: 'square.grid.3x3.fill',      tint: 'systemBlue',   count: '342 installed · 12 updates' },
    { name: 'Personas',       symbol: 'person.crop.circle',        tint: 'systemOrange', count: '3 personas' }
  ]
  const rowItems = []
  for (let r = 0; r < 2; r++) {
    const row = makeStack({
      parentId: root.id, name: `Row ${r + 1}`,
      stackType: 'hstack', alignment: 'center', spacing: GAP, padding: 0,
      widthMode: 'fit', heightMode: 'fit'
    })
    rowItems.push(row)
    for (let c = 0; c < 3; c++) {
      const cfg = cards[r * 3 + c]
      const card = makeStack({
        parentId: row.id, name: cfg.name,
        stackType: 'vstack', alignment: 'leading', spacing: 10, padding: 18,
        background: 'glassThin', cornerRadius: ptToUnits(20),
        size: [ptToUnits(CARD_W), ptToUnits(CARD_H)],
        widthMode: 'fixed', heightMode: 'fixed'
      })
      const icon = makePanel('label', {
        parentId: card.id, name: `${cfg.name} Icon`, text: '',
        symbolName: cfg.symbol, symbolRenderingMode: 'hierarchical',
        styles: { labelStyle: 'iconOnly' },
        size: [ptToUnits(32), ptToUnits(32)],
        colorToken: cfg.tint
      })
      const lbl = makePanel('text', {
        parentId: card.id, name: `${cfg.name} Label`,
        text: cfg.name,
        textStyle: 'headline', fontSize: textStyleToFontSize('headline'),
        fontWeight: 'semibold', textAlign: 'left',
        widthMode: 'fill', colorToken: 'primary'
      })
      const sub = makePanel('text', {
        parentId: card.id, name: `${cfg.name} Caption`, text: cfg.count,
        textStyle: 'footnote', fontSize: textStyleToFontSize('footnote'),
        textAlign: 'left', widthMode: 'fill', colorToken: 'secondary'
      })
      rowItems.push(card, icon, lbl, sub)
    }
  }
  return {
    items: [tab, w, root, headerRow, header, filterBtn, subhead, searchField,
      featuredCard, featuredArt, featuredMeta, featuredEyebrow, featuredTitle, featuredCopy, featuredCta,
      ...rowItems],
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
  const COL_W = 380
  const root = makeStack({
    parentId: w.id, name: 'Player',
    stackType: 'vstack', alignment: 'center', spacing: 22, padding: 36,
    widthMode: 'fill', heightMode: 'fill'
  })
  // "Now Playing" eyebrow row — tiny caption + waveform dot animation
  // hint above the artwork. Matches Apple's Music card chrome.
  const eyebrowRow = makeStack({
    parentId: root.id, name: 'Eyebrow Row',
    stackType: 'hstack', alignment: 'center', spacing: 6, padding: 0,
    widthMode: 'fit', heightMode: 'fit'
  })
  const eyebrowIcon = makePanel('label', {
    parentId: eyebrowRow.id, name: 'Eyebrow Icon', text: '',
    symbolName: 'waveform', styles: { labelStyle: 'iconOnly' },
    size: [ptToUnits(14), ptToUnits(14)], colorToken: 'systemBlue'
  })
  const eyebrowText = makePanel('text', {
    parentId: eyebrowRow.id, name: 'Eyebrow', text: 'NOW PLAYING',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    fontWeight: 'bold', textAlign: 'left',
    widthMode: 'fit', colorToken: 'systemBlue'
  })
  const artwork = makePanel('image', {
    parentId: root.id, name: 'Artwork',
    size: [ptToUnits(240), ptToUnits(240)],
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
    widthMode: 'fixed', heightMode: 'fit',
    size: [ptToUnits(COL_W), 0]
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
  // Transport row — shuffle / prev / play / next / repeat (the Apple
  // Music card layout). The play button stays prominent; the side
  // buttons are plain glyphs so the eye lands on Play first.
  const transport = makeStack({
    parentId: root.id, name: 'Transport',
    stackType: 'hstack', alignment: 'center', spacing: 22, padding: 0,
    widthMode: 'fit', heightMode: 'fit'
  })
  const shuffle = makePanel('button', {
    parentId: transport.id, name: 'Shuffle',
    text: '', symbolName: 'shuffle',
    styles: { labelStyle: 'iconOnly' },
    buttonStyle: 'plain', buttonSize: 'regular',
    colorToken: null, color: '#00000000', textColorToken: 'secondary'
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
  const nextBtn = makePanel('button', {
    parentId: transport.id, name: 'Next',
    text: '', symbolName: 'forward.fill',
    styles: { labelStyle: 'iconOnly' },
    buttonStyle: 'plain', buttonSize: 'large',
    colorToken: null, color: '#00000000', textColorToken: 'primary'
  })
  const repeatBtn = makePanel('button', {
    parentId: transport.id, name: 'Repeat',
    text: '', symbolName: 'repeat',
    styles: { labelStyle: 'iconOnly' },
    buttonStyle: 'plain', buttonSize: 'regular',
    colorToken: null, color: '#00000000', textColorToken: 'secondary'
  })
  // Volume slider with speaker glyphs as end-caps.
  const volumeBlock = makeStack({
    parentId: root.id, name: 'Volume',
    stackType: 'hstack', alignment: 'center', spacing: 10, padding: 0,
    widthMode: 'fixed', heightMode: 'fit',
    size: [ptToUnits(COL_W), 0]
  })
  const volLow = makePanel('label', {
    parentId: volumeBlock.id, name: 'Volume Low', text: '',
    symbolName: 'speaker.fill', styles: { labelStyle: 'iconOnly' },
    size: [ptToUnits(16), ptToUnits(16)], colorToken: 'secondary'
  })
  const volSlider = makePanel('slider', {
    parentId: volumeBlock.id, name: 'Volume Slider',
    sliderValue: 0.65, widthMode: 'fill'
  })
  const volHigh = makePanel('label', {
    parentId: volumeBlock.id, name: 'Volume High', text: '',
    symbolName: 'speaker.wave.3.fill', styles: { labelStyle: 'iconOnly' },
    size: [ptToUnits(18), ptToUnits(18)], colorToken: 'secondary'
  })
  // Secondary action row: Lyrics / AirPlay / Queue
  const extras = makeStack({
    parentId: root.id, name: 'Extras',
    stackType: 'hstack', alignment: 'center', spacing: 12, padding: 0,
    widthMode: 'fit', heightMode: 'fit'
  })
  const lyricsBtn = makePanel('button', {
    parentId: extras.id, name: 'Lyrics',
    text: '', symbolName: 'quote.bubble',
    styles: { labelStyle: 'iconOnly' },
    buttonStyle: 'bordered', buttonShape: 'capsule', buttonSize: 'regular',
    size: [ptToUnits(48), ptToUnits(40)]
  })
  const airplayBtn = makePanel('button', {
    parentId: extras.id, name: 'AirPlay',
    text: '', symbolName: 'airplayaudio',
    styles: { labelStyle: 'iconOnly' },
    buttonStyle: 'bordered', buttonShape: 'capsule', buttonSize: 'regular',
    size: [ptToUnits(48), ptToUnits(40)]
  })
  const queueBtn = makePanel('button', {
    parentId: extras.id, name: 'Queue',
    text: '', symbolName: 'list.bullet',
    styles: { labelStyle: 'iconOnly' },
    buttonStyle: 'bordered', buttonShape: 'capsule', buttonSize: 'regular',
    size: [ptToUnits(48), ptToUnits(40)]
  })
  return {
    items: [tab, w, root,
      eyebrowRow, eyebrowIcon, eyebrowText,
      artwork, meta, title, artist,
      scrubBlock, slider, times, tNow, tEnd,
      transport, shuffle, prev, play, nextBtn, repeatBtn,
      volumeBlock, volLow, volSlider, volHigh,
      extras, lyricsBtn, airplayBtn, queueBtn
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
  const COL_W = 540
  const root = makeStack({
    parentId: w.id, name: 'Card',
    stackType: 'vstack', alignment: 'center', spacing: 18, padding: 32,
    widthMode: 'fill', heightMode: 'fill'
  })
  const avatar = makePanel('image', {
    parentId: root.id, name: 'Avatar',
    size: [ptToUnits(112), ptToUnits(112)],
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
  // Short bio paragraph — locks the reading measure to the same column
  // width as the action row below.
  const bio = makePanel('text', {
    parentId: root.id, name: 'Bio',
    text: 'Designing the way virtual interfaces live alongside the physical world. Currently leading the spatial design system at Lumen Studio.',
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    textAlign: 'center', colorToken: 'primary',
    widthMode: 'fixed', size: [ptToUnits(COL_W), ptToUnits(60)]
  })
  // Stat chips — three glass tiles aligned with the bio column.
  const stats = makeStack({
    parentId: root.id, name: 'Stats',
    stackType: 'hstack', alignment: 'center', spacing: 14, padding: 0,
    widthMode: 'fit', heightMode: 'fit'
  })
  const statBlock = []
  ;[
    { label: 'Projects',  value: '24' },
    { label: 'Followers', value: '1.2k' },
    { label: 'Following', value: '318' }
  ].forEach((s) => {
    const chip = makeStack({
      parentId: stats.id, name: s.label,
      stackType: 'vstack', alignment: 'center', spacing: 2, padding: 14,
      background: 'glassThin',
      cornerRadius: ptToUnits(16),
      size: [ptToUnits(116), ptToUnits(66)],
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
  // Skill chips — three tappable capsules under the stats. Apple uses
  // this pattern on Contacts cards to surface interests and roles.
  const skills = makeStack({
    parentId: root.id, name: 'Skills',
    stackType: 'hstack', alignment: 'center', spacing: 8, padding: 0,
    widthMode: 'fit', heightMode: 'fit'
  })
  const skillSpecs = ['Spatial UX', 'Motion', 'Prototyping', 'RealityKit']
  const skillItems = []
  for (const tag of skillSpecs) {
    const chip = makePanel('button', {
      parentId: skills.id, name: tag, text: tag,
      buttonStyle: 'bordered', buttonShape: 'capsule', buttonSize: 'regular',
      size: [ptToUnits(112), ptToUnits(34)]
    })
    skillItems.push(chip)
  }
  // Primary + secondary action row.
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
  const moreBtn = makePanel('button', {
    parentId: actions.id, name: 'More',
    text: '', symbolName: 'ellipsis',
    styles: { labelStyle: 'iconOnly' },
    buttonStyle: 'bordered', buttonShape: 'capsule', buttonSize: 'large',
    size: [ptToUnits(52), ptToUnits(52)]
  })
  // Recent-activity row — a single horizontal strip of three thumbs so
  // the profile reads as having content, not just chrome.
  const recents = makeStack({
    parentId: root.id, name: 'Recent Work',
    stackType: 'vstack', alignment: 'leading', spacing: 8, padding: 0,
    widthMode: 'fixed', size: [ptToUnits(COL_W), 0]
  })
  const recentLabel = makePanel('text', {
    parentId: recents.id, name: 'Recent Label', text: 'Recent Work',
    textStyle: 'footnote', fontSize: textStyleToFontSize('footnote'),
    fontWeight: 'semibold', textAlign: 'left',
    widthMode: 'fill', colorToken: 'secondary'
  })
  const recentRow = makeStack({
    parentId: recents.id, name: 'Recent Row',
    stackType: 'hstack', alignment: 'top', spacing: 10, padding: 0,
    widthMode: 'fill', heightMode: 'fit'
  })
  const recentItems = []
  const thumbs = ['Sample 01.jpg', 'Sample 03.jpg', 'Sample 04.jpg']
  for (let i = 0; i < thumbs.length; i++) {
    const thumb = makePanel('image', {
      parentId: recentRow.id, name: `Thumb ${i + 1}`,
      size: [ptToUnits(170), ptToUnits(110)],
      cornerRadius: ptToUnits(14),
      color: '#1c1c1e', colorToken: null,
      imageUrl: `/samples/images/${thumbs[i]}`, imageFit: 'fill'
    })
    recentItems.push(thumb)
  }
  return {
    items: [tab, w, root, avatar, identity, name, role, bio,
      stats, ...statBlock,
      skills, ...skillItems,
      actions, follow, message, moreBtn,
      recents, recentLabel, recentRow, ...recentItems
    ],
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
  const COL_W = 600
  const root = makeStack({
    parentId: w.id, name: 'Article',
    stackType: 'vstack', alignment: 'center', spacing: 14, padding: 24,
    widthMode: 'fill', heightMode: 'fill', scrollable: true
  })
  const column = makeStack({
    parentId: root.id, name: 'Column',
    stackType: 'vstack', alignment: 'leading', spacing: 14, padding: 0,
    size: [ptToUnits(COL_W), ptToUnits(900)],
    widthMode: 'fixed', heightMode: 'fit'
  })
  const eyebrow = makePanel('text', {
    parentId: column.id, name: 'Category', text: 'DESIGN · ESSAY',
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
  const deck = makePanel('text', {
    parentId: column.id, name: 'Deck',
    text: 'Why the rules of flat interfaces stop applying the moment your canvas can see the room.',
    textStyle: 'title3', fontSize: textStyleToFontSize('title3'),
    fontWeight: 'regular', textAlign: 'left',
    widthMode: 'fill', colorToken: 'secondary'
  })
  // Byline row — author chip on the leading edge, metadata on the
  // trailing edge.
  const byline = makeStack({
    parentId: column.id, name: 'Byline',
    stackType: 'hstack', alignment: 'center', spacing: 10, padding: 0,
    widthMode: 'fill', heightMode: 'fit'
  })
  const bylineAvatar = makePanel('image', {
    parentId: byline.id, name: 'Author Avatar',
    size: [ptToUnits(28), ptToUnits(28)],
    cornerRadius: ptToUnits(100),
    color: '#3a3a3c', colorToken: null,
    imageUrl: '/samples/images/Sample 02.jpg', imageFit: 'fill'
  })
  const author = makePanel('text', {
    parentId: byline.id, name: 'Author', text: 'Avery Chen',
    textStyle: 'footnote', fontSize: textStyleToFontSize('footnote'),
    fontWeight: 'semibold', textAlign: 'left',
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
  const saveBtn = makePanel('button', {
    parentId: byline.id, name: 'Save',
    text: '', symbolName: 'bookmark',
    styles: { labelStyle: 'iconOnly' },
    buttonStyle: 'bordered', buttonShape: 'capsule', buttonSize: 'regular',
    size: [ptToUnits(40), ptToUnits(34)]
  })
  const shareBtn = makePanel('button', {
    parentId: byline.id, name: 'Share',
    text: '', symbolName: 'square.and.arrow.up',
    styles: { labelStyle: 'iconOnly' },
    buttonStyle: 'bordered', buttonShape: 'capsule', buttonSize: 'regular',
    size: [ptToUnits(40), ptToUnits(34)]
  })
  const hero = makePanel('image', {
    parentId: column.id, name: 'Hero',
    size: [ptToUnits(COL_W), ptToUnits(280)],
    widthMode: 'fill',
    cornerRadius: ptToUnits(18),
    color: '#2c2c2e', colorToken: null,
    imageUrl: '/samples/images/Sample 03.jpg',
    imageFit: 'fill'
  })
  const heroCaption = makePanel('text', {
    parentId: column.id, name: 'Hero Caption',
    text: 'Mountain ranges photographed on a clear afternoon — an environment Apple ships pre-installed on the Vision Pro.',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    textAlign: 'left',
    widthMode: 'fill', colorToken: 'secondary'
  })
  const body1 = makePanel('text', {
    parentId: column.id, name: 'Paragraph 1',
    text: 'Vision changes the rules. Surfaces become unbounded, depth becomes a first-class material, and motion suggests presence rather than navigation. The result is software that feels physical without pretending to be — interfaces that breathe with the room rather than blocking it.',
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    textAlign: 'left', widthMode: 'fill', colorToken: 'primary'
  })
  // Pull quote — recessed glass tile with a hairline accent on the
  // leading edge (Apple's reader pull-quote pattern).
  const quoteCard = makeStack({
    parentId: column.id, name: 'Pull Quote',
    stackType: 'vstack', alignment: 'leading', spacing: 6, padding: 20,
    background: 'glassThin', cornerRadius: ptToUnits(18),
    widthMode: 'fill', heightMode: 'fit'
  })
  const quoteText = makePanel('text', {
    parentId: quoteCard.id, name: 'Quote',
    text: '“Spatial design isn\'t a new canvas. It\'s the canvas remembering it has weight.”',
    textStyle: 'title3', fontSize: textStyleToFontSize('title3'),
    fontWeight: 'medium', textAlign: 'left',
    widthMode: 'fill', colorToken: 'primary'
  })
  const quoteAttr = makePanel('text', {
    parentId: quoteCard.id, name: 'Quote Attribution',
    text: '— Avery Chen, Lumen Studio',
    textStyle: 'footnote', fontSize: textStyleToFontSize('footnote'),
    textAlign: 'left',
    widthMode: 'fill', colorToken: 'secondary'
  })
  const body2 = makePanel('text', {
    parentId: column.id, name: 'Paragraph 2',
    text: 'A button on a flat screen has a single job — react. A spatial button has three: it has to read at a glance, it has to feel reachable, and it has to forgive the wearer when they look slightly off-target. We end up designing fewer pixels and more affordances.',
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    textAlign: 'left', widthMode: 'fill', colorToken: 'primary'
  })
  const body3 = makePanel('text', {
    parentId: column.id, name: 'Paragraph 3',
    text: 'The most interesting work right now is happening at the seam — where the operating system stops being a layer and starts being a peer. Once your interface is part of the room, every design decision is also a courtesy.',
    textStyle: 'body', fontSize: textStyleToFontSize('body'),
    textAlign: 'left', widthMode: 'fill', colorToken: 'primary'
  })
  // Related strip at the bottom — three small cards, same style as the
  // browse grid but compressed.
  const relatedLabel = makePanel('text', {
    parentId: column.id, name: 'Related Label',
    text: 'KEEP READING',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    fontWeight: 'bold', textAlign: 'left',
    widthMode: 'fill', colorToken: 'tertiary'
  })
  const relatedRow = makeStack({
    parentId: column.id, name: 'Related Row',
    stackType: 'hstack', alignment: 'top', spacing: 12, padding: 0,
    widthMode: 'fill', heightMode: 'fit'
  })
  const relatedItems = []
  const relatedSpecs = [
    { title: 'Hover, not hit-target',  read: '4 min', tint: 'systemPink',  img: 'Sample 01.jpg' },
    { title: 'Five rules for chrome',  read: '7 min', tint: 'systemTeal',  img: 'Sample 04.jpg' },
    { title: 'A room is a viewport',   read: '5 min', tint: 'systemOrange',img: 'Sample 05.jpg' }
  ]
  for (const r of relatedSpecs) {
    const card = makeStack({
      parentId: relatedRow.id, name: r.title,
      stackType: 'vstack', alignment: 'leading', spacing: 6, padding: 12,
      background: 'glassThin', cornerRadius: ptToUnits(14),
      size: [ptToUnits(190), ptToUnits(150)],
      widthMode: 'fixed', heightMode: 'fixed'
    })
    const thumb = makePanel('image', {
      parentId: card.id, name: `${r.title} Thumb`,
      size: [ptToUnits(166), ptToUnits(80)],
      cornerRadius: ptToUnits(10),
      color: '#1c1c1e', colorToken: null,
      imageUrl: `/samples/images/${r.img}`, imageFit: 'fill'
    })
    const t = makePanel('text', {
      parentId: card.id, name: `${r.title} Title`, text: r.title,
      textStyle: 'footnote', fontSize: textStyleToFontSize('footnote'),
      fontWeight: 'semibold', textAlign: 'left',
      widthMode: 'fill', colorToken: 'primary'
    })
    const t2 = makePanel('text', {
      parentId: card.id, name: `${r.title} Read`, text: `${r.read} read`,
      textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
      textAlign: 'left', widthMode: 'fill', colorToken: 'secondary'
    })
    relatedItems.push(card, thumb, t, t2)
  }
  return {
    items: [tab, w, root, column,
      eyebrow, headline, deck,
      byline, bylineAvatar, author, sep, meta, saveBtn, shareBtn,
      hero, heroCaption,
      body1,
      quoteCard, quoteText, quoteAttr,
      body2, body3,
      relatedLabel, relatedRow, ...relatedItems
    ],
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
    stackType: 'vstack', alignment: 'center', spacing: 14, padding: 24,
    widthMode: 'fill', heightMode: 'fill', scrollable: true
  })
  // Page title — large nav-style header at the top.
  const pageTitle = makePanel('text', {
    parentId: root.id, name: 'Page Title', text: 'Settings',
    textStyle: 'largeTitle', fontSize: textStyleToFontSize('largeTitle'),
    fontWeight: 'bold', textAlign: 'left',
    widthMode: 'fixed', size: [ptToUnits(COL_W), ptToUnits(40)]
  })
  // Account header — avatar + name + "View Profile" chevron in a glass tile.
  const account = makeStack({
    parentId: root.id, name: 'Account',
    stackType: 'hstack', alignment: 'center', spacing: 14, padding: 16,
    background: 'glassThin', cornerRadius: ptToUnits(18),
    size: [ptToUnits(COL_W), ptToUnits(92)],
    widthMode: 'fixed', heightMode: 'fixed'
  })
  const avatar = makePanel('image', {
    parentId: account.id, name: 'Avatar',
    size: [ptToUnits(56), ptToUnits(56)],
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
  const acctSub = makePanel('text', {
    parentId: nameCol.id, name: 'Plan', text: 'iCloud+ · 200 GB',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    textAlign: 'left', widthMode: 'fill', colorToken: 'tertiary'
  })
  const acctChevron = makePanel('label', {
    parentId: account.id, name: 'Chevron', text: '',
    symbolName: 'chevron.right', styles: { labelStyle: 'iconOnly' },
    size: [ptToUnits(16), ptToUnits(16)], colorToken: 'tertiary'
  })
  // Per-section header text helpers — section labels live OUTSIDE the
  // list, just like in Settings.app, so the list is the pure content.
  const sectionLabels = []
  const sectionTitle = (text) => {
    const t = makePanel('text', {
      parentId: root.id, name: `${text} Header`, text,
      textStyle: 'footnote', fontSize: textStyleToFontSize('footnote'),
      fontWeight: 'semibold', textAlign: 'left',
      widthMode: 'fixed', size: [ptToUnits(COL_W), ptToUnits(20)],
      colorToken: 'secondary'
    })
    sectionLabels.push(t)
    return t
  }
  const generalHeader = sectionTitle('GENERAL')
  // General section — appearance, language, accessibility.
  const generalList = makePanel('list', {
    parentId: root.id, name: 'General',
    listStyle: 'insetGrouped',
    size: [ptToUnits(COL_W), 0], widthMode: 'fixed',
    rows: [
      { title: 'Appearance',     subtitle: 'System',  accessory: 'chevron', icon: 'circle.lefthalf.filled', iconTint: '#5856d6' },
      { title: 'Language',       subtitle: 'English', accessory: 'chevron', icon: 'globe',                  iconTint: '#0a84ff' },
      { title: 'Accessibility',  subtitle: '',        accessory: 'chevron', icon: 'figure.wave',            iconTint: '#0a84ff' }
    ]
  })
  const prefsHeader = sectionTitle('PREFERENCES')
  // Preferences section — five toggles. More breadth so the page reads
  // as a real Settings screen, not a stub.
  const prefList = makePanel('list', {
    parentId: root.id, name: 'Preferences',
    listStyle: 'insetGrouped',
    size: [ptToUnits(COL_W), 0], widthMode: 'fixed',
    rows: [
      { title: 'Notifications',     subtitle: '', accessory: 'toggle', toggleValue: true,  icon: 'bell.fill',         iconTint: '#ff453a' },
      { title: 'Sound Effects',     subtitle: '', accessory: 'toggle', toggleValue: false, icon: 'speaker.wave.2',    iconTint: '#ff9f0a' },
      { title: 'Spatial Audio',     subtitle: '', accessory: 'toggle', toggleValue: true,  icon: 'airpods',           iconTint: '#0a84ff' },
      { title: 'Auto-Brightness',   subtitle: '', accessory: 'toggle', toggleValue: true,  icon: 'sun.max.fill',      iconTint: '#ffd60a' },
      { title: 'Reduce Motion',     subtitle: '', accessory: 'toggle', toggleValue: false, icon: 'figure.walk.motion',iconTint: '#30d158' }
    ]
  })
  const privacyHeader = sectionTitle('PRIVACY & SECURITY')
  const privacyList = makePanel('list', {
    parentId: root.id, name: 'Privacy',
    listStyle: 'insetGrouped',
    size: [ptToUnits(COL_W), 0], widthMode: 'fixed',
    rows: [
      { title: 'Face ID & Optic',  subtitle: '', accessory: 'chevron', icon: 'faceid',           iconTint: '#30d158' },
      { title: 'App Permissions',  subtitle: '', accessory: 'chevron', icon: 'hand.raised.fill', iconTint: '#0a84ff' },
      { title: 'Analytics',        subtitle: '', accessory: 'toggle', toggleValue: false, icon: 'chart.bar.fill', iconTint: '#5e5ce6' }
    ]
  })
  const aboutHeader = sectionTitle('ABOUT')
  const aboutList = makePanel('list', {
    parentId: root.id, name: 'About',
    listStyle: 'insetGrouped',
    size: [ptToUnits(COL_W), 0], widthMode: 'fixed',
    rows: [
      { title: 'Version',         subtitle: '', accessory: 'value', value: '2.0.1', icon: 'info.circle.fill', iconTint: '#8e8e93' },
      { title: 'Privacy Policy',  subtitle: '', accessory: 'chevron',               icon: 'hand.raised.fill', iconTint: '#30d158' },
      { title: 'Terms of Service',subtitle: '', accessory: 'chevron',               icon: 'doc.text.fill',    iconTint: '#0a84ff' },
      { title: 'Software Update', subtitle: 'Up to date', accessory: 'chevron',     icon: 'arrow.triangle.2.circlepath', iconTint: '#34c759' }
    ]
  })
  // Trailing footer — Sign Out as a destructive button, version below.
  const footer = makeStack({
    parentId: root.id, name: 'Footer',
    stackType: 'vstack', alignment: 'center', spacing: 8, padding: 16,
    widthMode: 'fixed', size: [ptToUnits(COL_W), 0], heightMode: 'fit'
  })
  const signOut = makePanel('button', {
    parentId: footer.id, name: 'Sign Out',
    text: 'Sign Out',
    buttonStyle: 'destructive', buttonShape: 'capsule', buttonSize: 'large',
    size: [ptToUnits(180), ptToUnits(50)]
  })
  const footnote = makePanel('text', {
    parentId: footer.id, name: 'Footer Note',
    text: 'visionOS 2.1 · Made for the wearer',
    textStyle: 'caption', fontSize: textStyleToFontSize('caption'),
    textAlign: 'center', widthMode: 'fill', colorToken: 'tertiary'
  })
  return {
    items: [tab, w, root, pageTitle,
      account, avatar, nameCol, acctName, acctEmail, acctSub, acctChevron,
      generalHeader, generalList,
      prefsHeader, prefList,
      privacyHeader, privacyList,
      aboutHeader, aboutList,
      footer, signOut, footnote
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
//
// Every volume template targets Apple Vision Pro's volumetric window
// (`.windowStyle(.volumetric)`): a bounded 3D scene the wearer walks
// around, sized to feel like a tabletop diorama. The wearer's default
// pose (see VOLUME_VR_POS in Canvas3D.jsx) sits ~1.5 m away at eye
// height 1.2 m, so every scene here places its hero content at
// y ≈ 1.0–1.5 m, x/z within ±0.35 m — the sweet spot for the volumetric
// preset (0.6 × 0.4 × 0.6 m, matching Apple's `.defaultSize` example).
//
// Templates lean on visionOS-native affordances:
//   • RealityKit `ModelEntity` primitives (sphere / box / cylinder / cone)
//   • `Attachment(...)` labels — SwiftUI views anchored in 3D space
//   • Tap gestures + timer-driven ambient motion (so preview feels alive)
//   • PhysicallyBasedMaterial with clearcoat + emission for depth cues
//
// The scenes are designed for eventual replacement with real USDZ
// assets — the `pbr(...)` finishes here are hero-object-quality even
// against the primitive geometry.

let _matIdCounter = 1
const matId = () => `mat-tpl-${(_matIdCounter++).toString(36)}`

// PhysicallyBasedMaterial factory. Everything is populated with the
// schema's null defaults so downstream code paths (renderer, exporter,
// inspector) don't see undefined fields. Callers just pass a base colour
// + whichever finishes matter for that surface.
function pbr(baseColor, {
  roughness = 0.5,
  metallic = 0,
  emissive = '#000000',
  emissiveIntensity = 0,
  clearcoat = 0,
  clearcoatRoughness = 0,
  sheen = '#000000'
} = {}) {
  return {
    id: matId(),
    type: 'physicallyBased',
    baseColor,
    baseColorTextureName: null,
    roughness,
    roughnessTextureName: null,
    metallic,
    metallicTextureName: null,
    normalTextureName: null,
    ambientOcclusionTextureName: null,
    emissiveColor: emissive,
    emissiveIntensity,
    emissiveTextureName: null,
    clearcoat,
    clearcoatRoughness,
    sheenColor: sheen,
    blending: 'opaque',
    opacityThreshold: null,
    faceCulling: 'back',
    textureCoordinateTransform: { offsetU: 0, offsetV: 0, scaleU: 1, scaleV: 1, rotation: 0 }
  }
}

// SimpleMaterial factory — matte-ish diffuse without PBR overhead. Used
// for background props (roads, dirt) where the extra render cost of a
// physically-based shader isn't earned.
function simple(baseColor, roughness = 0.6, isMetallic = false) {
  return { id: matId(), type: 'simple', baseColor, roughness, isMetallic }
}

// ---- Attachment factories -------------------------------------------
//
// Sugar over makeAttachmentEntity() that lets templates read like a
// SwiftUI view tree. Every attachment is created with an Apple text
// style (body / title / caption / etc.) so fontSize + padding +
// cornerRadius stay in proportion; the shape, background, and colour
// are the only per-attachment knobs.
//
// `parent` is the entity the attachment anchors to (usually the World
// Anchor); `pos` is the local position; `text` is the caption; every
// other option lands as an override on the entity record.

// Text attachment — like SwiftUI Text(text).font(.style). Defaults to
// a dark card that reads over both the studio backdrop and lit models.
function attachText(parent, pos, text, opts = {}) {
  return makeAttachmentEntity('text', {
    parentId: parent.id,
    name: opts.name || 'Text',
    position: pos,
    attachmentText: text,
    attachmentTextStyle: opts.style || 'body',
    attachmentColor: opts.color || '#ffffff',
    attachmentBackground: opts.background || '#0c0c0e',
    attachmentBillboard: opts.billboard !== false,
    ...(opts.visible !== undefined ? { visible: opts.visible } : {}),
    ...(opts.behaviors ? { behaviors: opts.behaviors } : {})
  })
}

// Title chip — largeTitle sized, dark card, bold. The "big hero label"
// that pins above a scene.
function attachTitle(parent, pos, text, opts = {}) {
  return attachText(parent, pos, text, { style: 'largeTitle', ...opts, name: opts.name || 'Title' })
}

// Subtitle chip — subheadline size, muted colour, sits below a title.
function attachSubtitle(parent, pos, text, opts = {}) {
  return attachText(parent, pos, text, {
    style: 'subheadline',
    color: '#a0a0a4',
    background: '#1c1c1e',
    ...opts,
    name: opts.name || 'Subtitle'
  })
}

// Info card — hidden by default; revealed by a tap behavior on the
// target entity via a showHide action. Body-sized, multi-line.
function attachInfoCard(parent, pos, text, opts = {}) {
  return attachText(parent, pos, text, {
    style: 'body',
    color: '#ffffff',
    background: '#0c0c0e',
    visible: false,
    ...opts,
    name: opts.name || 'Info Card'
  })
}

// Button attachment — capsule with glass background (or a coloured tint
// via `opts.tint`). Reads like SwiftUI's `.buttonStyle(.glass)`.
function attachButton(parent, pos, text, opts = {}) {
  return makeAttachmentEntity('button', {
    parentId: parent.id,
    name: opts.name || 'Button',
    position: pos,
    attachmentText: text,
    attachmentTextStyle: opts.style || 'body',
    attachmentColor: opts.color || '#ffffff',
    attachmentBackground: opts.tint || opts.background || '#ffffff62',
    attachmentShape: 'capsule',
    attachmentBillboard: opts.billboard !== false
  })
}

// ---- Behavior sugar -------------------------------------------------
//
// One-liner factories for the interaction patterns the templates lean
// on. Each returns a behavior record ready to slot into an entity's
// `behaviors:` array. Keeping the boilerplate here means templates
// stay focused on the story, not the schema.

// Tap → scale up with spring, auto-reverse on next tap. Classic "poke
// to select" affordance from visionOS.
function onTapHighlight(scale = 1.25, duration = 0.32) {
  return behavior(
    trigger('tap', { mode: 'single' }),
    action('scaleTo', { mode: 'absolute', value: scale, duration, curve: 'spring', toggle: true })
  )
}

// Hover-in — subtle scale + emission bump on cursor enter. Matches
// visionOS's built-in `HoverEffectComponent` feedback. Emission color
// defaults to warm white (works on any base tint).
function onHoverIn(scale = 1.06, emissive = '#ffffff') {
  return behavior(
    trigger('hover', { mode: 'enter' }),
    action('scaleTo', { mode: 'absolute', value: scale, duration: 0.18, curve: 'easeOut' }),
    action('setMaterial', { property: 'emission', colorValue: emissive, duration: 0.18, curve: 'easeOut' })
  )
}
function onHoverOut() {
  return behavior(
    trigger('hover', { mode: 'leave' }),
    action('scaleTo', { mode: 'absolute', value: 1.0, duration: 0.24, curve: 'easeOut' }),
    action('setMaterial', { property: 'emission', colorValue: '#000000', duration: 0.24, curve: 'easeOut' })
  )
}

// Continuous emission pulse — ambient "alive" motion. Timer + toggle
// bounces the emission intensity every `period/2` seconds.
function loopEmissionPulse(period = 2.4, peak = 2.4) {
  return behavior(
    trigger('timer', { mode: 'loop', seconds: period }),
    action('setMaterial', { property: 'emissionIntensity', numberValue: peak, duration: period / 2, curve: 'easeInOut', toggle: true })
  )
}

// Continuous group rotation — orbital motion when applied to an
// orbit-parent group with a child offset by radius.
function loopRotateY(period = 8.0) {
  return behavior(
    trigger('timer', { mode: 'loop', seconds: period }),
    action('rotateTo', { mode: 'relative', rotation: [0, 360, 0], duration: period, curve: 'linear' })
  )
}

// Tap → reveal a linked info card via showHide. The card lives with
// `visible: false` in the tree; the tap on the model targets its id
// and fades it in. Second tap hides it (mode: 'toggle').
function onTapReveal(cardId) {
  return behavior(
    trigger('tap', { mode: 'single' }),
    action('showHide', { mode: 'toggle', target: cardId, fade: true, duration: 0.22 })
  )
}

// Hover-reveal pair — hover enter fades the card in, hover leave fades
// it out. Returns TWO behaviors (one per direction) so both go into the
// entity's `behaviors:` array with a spread. Great when the wearer
// wants to peek at info without committing to a tap.
function onHoverReveal(cardId) {
  return [
    behavior(
      trigger('hover', { mode: 'enter' }),
      action('showHide', { mode: 'show', target: cardId, fade: true, duration: 0.18 })
    ),
    behavior(
      trigger('hover', { mode: 'leave' }),
      action('showHide', { mode: 'hide', target: cardId, fade: true, duration: 0.22 })
    )
  ]
}

// Tap → shader-effect outline (visionOS `HoverEffectComponent.highlight`
// analog). Great for museum-style "focus this thing" affordances.
function onTapOutline(intensity = 1.0) {
  return behavior(
    trigger('tap', { mode: 'single' }),
    action('shaderEffect', { effect: 'outline', intensity, duration: 0.2 })
  )
}

// Scene start → run a one-shot entry animation. Kicks off automatically
// when preview mode enters.
function onSceneStart(...actions) {
  return behavior(trigger('sceneStart'), ...actions)
}

// Broadcast + receive — one entity fires an event, others react. Used
// for coordinated scene-wide animations (tap the sun → planets pulse,
// tap the master orb → row rolls a wave, etc.).
function onTapBroadcast(eventName) {
  return behavior(
    trigger('tap', { mode: 'single' }),
    action('broadcast', { name: eventName })
  )
}
function onEventReceived(eventName, ...actions) {
  return behavior(trigger('eventReceived', { name: eventName }), ...actions)
}

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

// ---- Cosmos (volume) -------------------------------------------------
// Solar-system diorama. Sun castsLight so planets receive real
// point-light shading (`entity.lightIntensity` on the sun controls
// how strongly it lights everything else — dial it up to flood the
// scene, down to a dim moonlit look). Each planet lives in a two-group
// hierarchy so a tilted orbit works cleanly:
//   • Outer TILT group — sits at the sun's centre with a fixed Z
//     rotation. This inclines the orbit plane against the ecliptic.
//   • Inner PATH group — animates Y-rotation continuously. Because the
//     tilt is applied by the OUTER group, the animated Y sweeps the
//     planet around the TILTED plane, giving a proper diagonal orbit
//     (planet is above the ecliptic on one side and below it on the
//     other).
//
// Note on Y positions: the TILT group's Y IS the orbit centre. Change
// it to move the whole orbit up or down. Changing a planet's local Y
// (inside the tilt group) instead offsets it AWAY from the orbit
// plane — the planet stops being "on" the orbit and rides an
// off-centre circle. That's not a bug in our system; it's how nested
// transforms work in RealityKit, Unity, Unreal, and every 3D engine.
function cosmosVolume() {
  const tab = makeTab({ name: 'Cosmos', icon: 'sparkles' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Cosmos' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'Solar System' })
  const items = [tab, w, anchor]

  // Sun — bright emissive sphere. Base emission 3.2 so it looks like
  // a star from the first frame; the ambient pulse brightens to 4.2
  // and back on a 2.4s cadence.
  const sun = makeModelEntity('sphere', {
    parentId: anchor.id, name: 'Sun',
    sphereRadius: 0.058,
    position: [0, 1.20, 0],
    behaviors: [
      loopEmissionPulse(2.4, 4.2),
      onTapBroadcast('solar-flare')
    ]
  })
  sun.materials = [pbr('#ffcc66', { roughness: 0.5, emissive: '#ffcc66', emissiveIntensity: 3.2 })]
  items.push(sun)

  // Sun Light — a first-class Light entity parented to the sun so it
  // moves with it. Editable from the Layers panel: click "Sun Light",
  // then dial intensity / range / colour in the inspector. Because
  // it's a proper Light entity (not a hidden model flag), it appears
  // with a Blender-style bulb icon and shows up in the SwiftUI export
  // as a PointLightComponent on the sun's Entity.
  items.push(makeLightEntity('point', {
    parentId: sun.id,
    name: 'Sun Light',
    position: [0, 0, 0],
    lightColor: '#ffe6b0',
    lightIntensity: 2,
    lightRange: 3.0
  }))

  // Sun caption — pinned above the sun at y=1.35.
  items.push(attachText(anchor, [0, 1.35, 0], 'Sun', {
    style: 'title3', name: 'Sun Label',
    color: '#ffd9a3', background: '#2a1c00'
  }))

  // Five planets. Jupiter rides a tilted orbit plane (20° from ecliptic)
  // and its Tilt group sits lower (y=1.12) so its whole orbit lives
  // below the inner planets' plane.
  const planetSpecs = [
    { name: 'Mercury', orbit: 0.18, radius: 0.014, color: '#8a827a', metallic: 0.15, period:  8.0, tilt: 0,  centreY: 1.20, fact: 'Mercury\n4,879 km · 88 days' },
    { name: 'Venus',   orbit: 0.28, radius: 0.024, color: '#b8a05a', metallic: 0.05, period: 12.0, tilt: 0,  centreY: 1.20, fact: 'Venus\n12,104 km · 225 days' },
    { name: 'Earth',   orbit: 0.38, radius: 0.028, color: '#3060cc', metallic: 0.02, period: 16.0, tilt: 0,  centreY: 1.20, fact: 'Earth\n12,742 km · 365 days' },
    { name: 'Mars',    orbit: 0.48, radius: 0.022, color: '#a04022', metallic: 0.05, period: 20.0, tilt: 0,  centreY: 1.20, fact: 'Mars\n6,779 km · 687 days' },
    { name: 'Jupiter', orbit: 0.62, radius: 0.045, color: '#a07a54', metallic: 0.03, period: 28.0, tilt: 20, centreY: 1.12, fact: 'Jupiter\n139,820 km · 12 years\nTilted orbit' }
  ]
  for (const p of planetSpecs) {
    // OUTER: tilt group. Sits at the orbit centre (usually the sun,
    // but Jupiter's group sits lower so its orbit rides beneath the
    // inner planets). Static rotation on Z inclines the orbit plane.
    const tiltGroup = makeGroupEntity({
      parentId: anchor.id, name: `${p.name} Tilt`,
      position: [0, p.centreY, 0],
      rotation: [0, 0, p.tilt]
    })
    items.push(tiltGroup)

    // INNER: path group. Y rotation animates continuously in the
    // tilted parent frame — this is what gives a real diagonal orbit
    // instead of a flat circle.
    const pathGroup = makeGroupEntity({
      parentId: tiltGroup.id, name: `${p.name} Path`,
      position: [0, 0, 0],
      behaviors: [loopRotateY(p.period)]
    })
    items.push(pathGroup)

    // Info card — hidden by default. Hovering the planet fades it in;
    // moving off fades it out. Sized at 0.020m with an offset of 0.07m
    // above the planet.
    const card = attachInfoCard(
      { id: pathGroup.id },
      [p.orbit, 0.07, 0],
      p.fact,
      {
        name: `${p.name} Info`,
        style: 'body',
        color: '#ffffff',
        background: '#0c0c0e'
      }
    )
    card.attachmentFontSize = 0.020
    items.push(card)

    // Planet. Roughness 0.90 for a truly matte, dusty surface — cuts
    // the "wet plastic" specular shine planets had before. Base
    // emission stays 0 so the sun's point-light does all the lighting
    // work (day side bright, night side dark).
    const planet = makeModelEntity('sphere', {
      parentId: pathGroup.id, name: p.name,
      sphereRadius: p.radius,
      position: [p.orbit, 0, 0],
      // Hovering shows the info card (reveal via showHide) and glows
      // the planet lightly. No tap-highlight scaling — the previous
      // "tap → 2.2× puff" felt aggressive. Solar-flare event still
      // ripples every planet in a scale pulse.
      behaviors: [
        onHoverIn(1.10, p.color),
        onHoverOut(),
        ...onHoverReveal(card.id),
        onEventReceived('solar-flare',
          action('scaleTo', { mode: 'absolute', value: 1.4, duration: 0.25, curve: 'easeOut' }),
          action('wait', { seconds: 0.35 }),
          action('scaleTo', { mode: 'absolute', value: 1.0, duration: 0.35, curve: 'easeIn' })
        )
      ]
    })
    planet.materials = [pbr(p.color, {
      roughness: 0.90, metallic: p.metallic,
      // Earth keeps a faint clearcoat to sell the ocean sheen; the
      // rocky planets stay fully matte.
      clearcoat: p.name === 'Earth' ? 0.25 : 0,
      clearcoatRoughness: 0.6
    })]
    items.push(planet)
  }

  items.push(attachTitle(anchor, [0, 1.56, 0], 'Cosmos'))
  items.push(attachSubtitle(anchor, [0, 1.47, 0], 'Tap the sun for a flare · hover a planet for info'))

  return { items, activeTabId: tab.id }
}

// ---- Anatomy (volume) ------------------------------------------------
// Beating heart on a museum plinth — the Complete Anatomy visionOS
// pattern. Tap any chamber to reveal a body-styled info card explaining
// its function; hovering glows the chamber and outlines it via a shader
// effect so the reader knows which one they're about to tap.
function anatomyVolume() {
  const tab = makeTab({ name: 'Anatomy', icon: 'heart.fill' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Human Heart' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'Specimen' })
  const items = [tab, w, anchor]

  // Marble plinth — the exhibit's base. Clearcoat + low roughness
  // reads as polished stone under the studio key light.
  const plinth = makeModelEntity('cylinder', {
    parentId: anchor.id, name: 'Plinth',
    cylinderRadius: 0.16, cylinderHeight: 0.02,
    position: [0, 1.00, 0]
  })
  plinth.materials = [pbr('#2a2a2c', { roughness: 0.3, metallic: 0.15, clearcoat: 0.5, clearcoatRoughness: 0.2 })]
  items.push(plinth)

  // Under-glow halo — warm crimson signalling "living tissue". Pulses
  // in sync with the heartbeat via an event-received listener.
  const halo = makeModelEntity('cylinder', {
    parentId: anchor.id, name: 'Halo',
    cylinderRadius: 0.18, cylinderHeight: 0.003,
    position: [0, 1.012, 0],
    behaviors: [
      onEventReceived('heartbeat',
        action('setMaterial', { property: 'emissionIntensity', numberValue: 1.6, duration: 0.15, curve: 'easeOut' }),
        action('wait', { seconds: 0.2 }),
        action('setMaterial', { property: 'emissionIntensity', numberValue: 1.0, duration: 0.25, curve: 'easeIn' })
      )
    ]
  })
  halo.materials = [pbr('#2a0508', { roughness: 0.9, emissive: '#e63a5a', emissiveIntensity: 1.0 })]
  items.push(halo)

  // Heart group — parent of every chamber and vessel. Beats at ~65 BPM
  // (0.9 s cycle). On each beat the heart broadcasts a 'heartbeat' event
  // the halo (and any future entity — ECG, timer, monitor) can react to.
  const heart = makeGroupEntity({
    parentId: anchor.id, name: 'Heart',
    position: [0, 1.22, 0],
    behaviors: [
      behavior(
        trigger('timer', { mode: 'loop', seconds: 0.9 }),
        action('scaleTo', { mode: 'absolute', value: 1.06, duration: 0.18, curve: 'easeOut', toggle: true }),
        action('broadcast', { name: 'heartbeat' })
      )
    ]
  })
  items.push(heart)

  // Four chambers — atria above ventricles. Each carries hover,
  // tap-highlight, and tap-reveal for its info card + shader outline.
  const chamberSpecs = [
    { name: 'Left Atrium',      color: '#c9425c', pos: [ 0.038, 0.040, -0.015], r: 0.042, card: [ 0.20, 1.30, 0], fact: 'Left Atrium\nReceives oxygenated blood\nfrom the lungs' },
    { name: 'Right Atrium',     color: '#5c86c9', pos: [-0.038, 0.040, -0.015], r: 0.042, card: [-0.20, 1.30, 0], fact: 'Right Atrium\nReceives deoxygenated blood\nfrom the body' },
    { name: 'Left Ventricle',   color: '#a02d47', pos: [ 0.032, -0.028,  0.000], r: 0.055, card: [ 0.22, 1.13, 0], fact: 'Left Ventricle\nPumps oxygenated blood\nto the body' },
    { name: 'Right Ventricle',  color: '#3d68a8', pos: [-0.034, -0.028,  0.000], r: 0.050, card: [-0.22, 1.13, 0], fact: 'Right Ventricle\nPumps deoxygenated blood\nto the lungs' }
  ]
  for (const c of chamberSpecs) {
    // Info card — hidden until tapped. Named colour matches the
    // chamber tint so the card reads as visually linked.
    const card = attachInfoCard(anchor, c.card, c.fact, {
      name: `${c.name} Card`,
      style: 'body',
      color: '#ffffff',
      background: '#0c0c0e'
    })
    items.push(card)

    const chamber = makeModelEntity('sphere', {
      parentId: heart.id, name: c.name,
      sphereRadius: c.r,
      position: c.pos,
      behaviors: [
        onHoverIn(1.08, c.color),
        onHoverOut(),
        onTapHighlight(1.30, 0.32),
        onTapReveal(card.id),
        onTapOutline(1.2)
      ]
    })
    chamber.materials = [pbr(c.color, {
      roughness: 0.32, metallic: 0.05,
      emissive: c.color, emissiveIntensity: 0.18,
      clearcoat: 0.6, clearcoatRoughness: 0.18, sheen: '#ffb0b0'
    })]
    items.push(chamber)
  }

  // Aorta — the classic arch coming off the left ventricle.
  const aorta = makeModelEntity('cylinder', {
    parentId: heart.id, name: 'Aorta',
    cylinderRadius: 0.013, cylinderHeight: 0.11,
    position: [0.018, 0.082, -0.005],
    rotation: [0, 0, -25]
  })
  aorta.materials = [pbr('#e63a5a', { roughness: 0.32, emissive: '#3a0000', emissiveIntensity: 0.15, clearcoat: 0.55 })]
  items.push(aorta)

  // Pulmonary artery — companion vessel on the right ventricle.
  const pulmonary = makeModelEntity('cylinder', {
    parentId: heart.id, name: 'Pulmonary Artery',
    cylinderRadius: 0.011, cylinderHeight: 0.09,
    position: [-0.022, 0.078, 0.005],
    rotation: [0, 0, 20]
  })
  pulmonary.materials = [pbr('#3d68a8', { roughness: 0.32, emissive: '#00223a', emissiveIntensity: 0.15, clearcoat: 0.55 })]
  items.push(pulmonary)

  // Title + subtitle.
  items.push(attachTitle(anchor, [0, 1.55, 0], 'Human Heart'))
  items.push(attachSubtitle(anchor, [0, 1.50, 0], 'Tap a chamber for details'))

  return { items, activeTabId: tab.id }
}

// ---- Engine (volume) -------------------------------------------------
// Inline-4 combustion engine on a service stand. The block acts as the
// scene's ignition — tap it to broadcast 'ignition', which crank +
// pistons + exhaust listen for to run their firing loops. Tapping the
// Start button attachment does the same, so the wearer can drive the
// scene from either the mesh or the button. Hover feedback on every
// interactive part; tap a piston to reveal its cylinder-order card.
function engineVolume() {
  const tab = makeTab({ name: 'Engine', icon: 'gearshape.2' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Engine' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'Engine Rig' })
  const items = [tab, w, anchor]

  // Brushed-steel service stand.
  const stand = makeModelEntity('cylinder', {
    parentId: anchor.id, name: 'Service Stand',
    cylinderRadius: 0.22, cylinderHeight: 0.015,
    position: [0, 1.00, 0]
  })
  stand.materials = [pbr('#3a3a3c', { roughness: 0.28, metallic: 0.75, clearcoat: 0.35 })]
  items.push(stand)

  // Diagnostic ring — cool blue undertone. Pulses on 'ignition'.
  const glow = makeModelEntity('cylinder', {
    parentId: anchor.id, name: 'Diag Ring',
    cylinderRadius: 0.24, cylinderHeight: 0.003,
    position: [0, 1.009, 0],
    behaviors: [
      onEventReceived('ignition',
        action('setMaterial', { property: 'emissionIntensity', numberValue: 2.4, duration: 0.4, curve: 'easeOut' }),
        action('wait', { seconds: 0.5 }),
        action('setMaterial', { property: 'emissionIntensity', numberValue: 0.7, duration: 0.6, curve: 'easeIn' })
      )
    ]
  })
  glow.materials = [pbr('#0a1a3a', { roughness: 0.9, emissive: '#3a78ff', emissiveIntensity: 0.7 })]
  items.push(glow)

  // Engine block — hovering it hints tappability; tapping it broadcasts
  // 'ignition' scene-wide. The block's own emission ramps up so the
  // block itself reads as "powered".
  const block = makeModelEntity('box', {
    parentId: anchor.id, name: 'Engine Block',
    boxSize: [0.34, 0.08, 0.10],
    position: [0, 1.06, 0],
    behaviors: [
      onHoverIn(1.02, '#3a78ff'),
      onHoverOut(),
      onTapBroadcast('ignition'),
      behavior(
        trigger('tap', { mode: 'single' }),
        action('setMaterial', { property: 'emissionIntensity', numberValue: 0.6, duration: 0.3, curve: 'easeOut', toggle: true })
      )
    ]
  })
  block.materials = [pbr('#18181a', {
    roughness: 0.35, metallic: 0.55,
    emissive: '#3a78ff', emissiveIntensity: 0.0,
    clearcoat: 0.45, clearcoatRoughness: 0.2
  })]
  items.push(block)

  // Crankshaft — thin horizontal cylinder. Runs a continuous spin
  // once the scene starts (sceneStart), and pulses on ignition.
  const crank = makeModelEntity('cylinder', {
    parentId: anchor.id, name: 'Crankshaft',
    cylinderRadius: 0.009, cylinderHeight: 0.36,
    position: [0, 1.03, 0],
    rotation: [0, 0, 90],
    behaviors: [
      behavior(
        trigger('timer', { mode: 'loop', seconds: 1.2 }),
        action('rotateTo', { mode: 'relative', rotation: [360, 0, 0], duration: 1.2, curve: 'linear' })
      )
    ]
  })
  crank.materials = [pbr('#c9c9cf', { roughness: 0.18, metallic: 0.9, clearcoat: 0.6, clearcoatRoughness: 0.1 })]
  items.push(crank)

  // Four pistons — staggered firing order 1-3-4-2. Each gets a reveal
  // card on tap ("Cylinder 1 · Compression") for the automotive-visual
  // pattern (Reality Composer Pro-style callouts).
  const pistonSpecs = [
    { name: 'Piston 1', x: -0.13,  y0: 1.120, order: '1st', stage: 'Intake' },
    { name: 'Piston 2', x: -0.043, y0: 1.100, order: '3rd', stage: 'Power' },
    { name: 'Piston 3', x:  0.043, y0: 1.115, order: '4th', stage: 'Exhaust' },
    { name: 'Piston 4', x:  0.13,  y0: 1.105, order: '2nd', stage: 'Compression' }
  ]
  for (const p of pistonSpecs) {
    const card = attachInfoCard(anchor, [p.x, 1.24, 0], `${p.name}\n${p.order} in firing order\n${p.stage} stroke`, {
      name: `${p.name} Info`, style: 'body', color: '#ffe08a', background: '#0c0c0e'
    })
    items.push(card)

    const piston = makeModelEntity('cylinder', {
      parentId: anchor.id, name: p.name,
      cylinderRadius: 0.021, cylinderHeight: 0.05,
      position: [p.x, p.y0, 0],
      behaviors: [
        behavior(
          trigger('timer', { mode: 'loop', seconds: 0.6 }),
          action('moveTo', { mode: 'offset', position: [0, 0.022, 0], duration: 0.3, curve: 'easeInOut', toggle: true })
        ),
        onHoverIn(1.08, '#ffcc00'),
        onHoverOut(),
        onTapReveal(card.id),
        behavior(
          trigger('tap', { mode: 'single' }),
          action('setMaterial', { property: 'emission', colorValue: '#ffcc00', duration: 0.2, curve: 'easeOut', toggle: true })
        )
      ]
    })
    piston.materials = [pbr('#8a8a90', {
      roughness: 0.28, metallic: 0.88,
      emissive: '#000000', emissiveIntensity: 0.0,
      clearcoat: 0.55, clearcoatRoughness: 0.15
    })]
    items.push(piston)

    // Spark plug — small cone on top of each piston.
    const plug = makeModelEntity('cone', {
      parentId: anchor.id, name: `${p.name} Plug`,
      coneRadius: 0.010, coneHeight: 0.030,
      position: [p.x, p.y0 + 0.048, 0]
    })
    plug.materials = [pbr('#e6b34a', { roughness: 0.32, metallic: 0.85, clearcoat: 0.4 })]
    items.push(plug)
  }

  // Exhaust manifold — glowing pipe. Pulses on ambient timer; flares
  // brighter when ignition fires.
  const exhaust = makeModelEntity('cylinder', {
    parentId: anchor.id, name: 'Exhaust',
    cylinderRadius: 0.014, cylinderHeight: 0.30,
    position: [0, 1.06, 0.062],
    rotation: [0, 0, 90],
    behaviors: [
      loopEmissionPulse(1.5, 1.6),
      onEventReceived('ignition',
        action('setMaterial', { property: 'emissionIntensity', numberValue: 3.0, duration: 0.25, curve: 'easeOut' }),
        action('wait', { seconds: 0.3 }),
        action('setMaterial', { property: 'emissionIntensity', numberValue: 0.4, duration: 0.4, curve: 'easeIn' })
      )
    ]
  })
  exhaust.materials = [pbr('#2a2a2c', { roughness: 0.45, metallic: 0.55, emissive: '#ff5a1c', emissiveIntensity: 0.4 })]
  items.push(exhaust)

  // Start button — Apple's `.buttonStyle(.glass)` analog. Tapping it
  // fires the same 'ignition' event as tapping the block. Positioned
  // as a floating attachment above the intake side.
  items.push(attachButton(anchor, [-0.16, 1.34, 0], 'Start', {
    name: 'Start Button',
    tint: '#0a84ff',
    color: '#ffffff'
  }))

  // Title + subtitle.
  items.push(attachTitle(anchor, [0, 1.44, 0], 'Inline-4'))
  items.push(attachSubtitle(anchor, [0, 1.39, 0], 'Tap the block or Start to ignite · tap a piston for its role'))

  return { items, activeTabId: tab.id }
}

// ---- Museum (volume) -------------------------------------------------
// Greek amphora on a slowly-rotating turntable. Hovering the vase
// pauses the turntable and outlines the piece with a shader effect
// (the WWDC "highlight this artifact" pattern). Tapping the plinth
// toggles the turntable's rotation state so the wearer can lock the
// artifact in any preferred orientation.
function museumVolume() {
  const tab = makeTab({ name: 'Museum', icon: 'building.columns' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Artifact' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'Exhibit' })
  const items = [tab, w, anchor]

  // Marble plinth — tapping it broadcasts 'pause-turntable' which the
  // turntable listens for to stop / resume its rotation loop.
  const plinth = makeModelEntity('cylinder', {
    parentId: anchor.id, name: 'Plinth',
    cylinderRadius: 0.13, cylinderHeight: 0.28,
    position: [0, 1.01, 0],
    behaviors: [
      onHoverIn(1.01, '#ffcc80'),
      onHoverOut(),
      onTapBroadcast('pause-turntable')
    ]
  })
  plinth.materials = [pbr('#e8e5db', { roughness: 0.5, metallic: 0.0, clearcoat: 0.3, clearcoatRoughness: 0.4 })]
  items.push(plinth)

  // Spotlight glow ring — warm halo. Sees a soft brighten on scene
  // start so the exhibit "wakes up" as the wearer arrives.
  const spot = makeModelEntity('cylinder', {
    parentId: anchor.id, name: 'Spotlight',
    cylinderRadius: 0.12, cylinderHeight: 0.002,
    position: [0, 1.151, 0],
    behaviors: [
      onSceneStart(
        action('setMaterial', { property: 'emissionIntensity', numberValue: 1.4, duration: 1.2, curve: 'easeOut' })
      )
    ]
  })
  spot.materials = [pbr('#3a2a10', { roughness: 0.9, emissive: '#e6a34a', emissiveIntensity: 0.2 })]
  items.push(spot)

  // Turntable — rotates on a 24s loop. When the plinth broadcasts
  // 'pause-turntable', the turntable snaps to its current angle by
  // running a zero-degree relative rotate (which cancels the timer's
  // ongoing action's next tick). Second broadcast resumes.
  const turntable = makeGroupEntity({
    parentId: anchor.id, name: 'Turntable',
    position: [0, 1.155, 0],
    behaviors: [
      loopRotateY(24.0)
    ]
  })
  items.push(turntable)

  // Vase silhouette. Foot → belly → shoulder → neck → lip stacked so
  // the outline reads classical from any angle. Every part carries
  // hover feedback + tap-outline. Tapping the belly reveals the vase's
  // period info card (hidden by default).
  const vaseCard = attachInfoCard(anchor, [0.30, 1.35, 0], 'Amphora\nc. 550 BCE\nAttic terracotta', {
    name: 'Vase Info', style: 'headline', color: '#ffcc80', background: '#0c0c0e'
  })
  items.push(vaseCard)

  const vaseParts = [
    { kind: 'cylinder', name: 'Foot',     r: 0.030, h: 0.008, y: 0.004,  reveal: false },
    { kind: 'sphere',   name: 'Belly',    r: 0.056, y: 0.058,            reveal: true  },
    { kind: 'cylinder', name: 'Shoulder', r: 0.036, h: 0.012, y: 0.106,  reveal: false },
    { kind: 'cylinder', name: 'Neck',     r: 0.022, h: 0.046, y: 0.135,  reveal: false },
    { kind: 'cylinder', name: 'Lip',      r: 0.033, h: 0.008, y: 0.162,  reveal: true  }
  ]
  for (const p of vaseParts) {
    const opts = p.kind === 'sphere'
      ? { sphereRadius: p.r }
      : { cylinderRadius: p.r, cylinderHeight: p.h }
    const behaviors = [
      onHoverIn(1.04, '#ffcc80'),
      onHoverOut(),
      onTapHighlight(1.12, 0.3),
      onTapOutline(1.0)
    ]
    if (p.reveal) behaviors.push(onTapReveal(vaseCard.id))
    const part = makeModelEntity(p.kind, {
      parentId: turntable.id, name: p.name,
      ...opts,
      position: [0, p.y, 0],
      behaviors
    })
    // Painted terracotta — warm red-brown, faint sheen so it catches
    // the studio key light like a fired ceramic.
    part.materials = [pbr('#a04030', {
      roughness: 0.42, metallic: 0.05,
      clearcoat: 0.5, clearcoatRoughness: 0.3,
      sheen: '#602418'
    })]
    items.push(part)
  }

  // Black accent bands on the belly — flat discs faked as very short
  // cylinders slightly larger than the belly sphere.
  const bandSpecs = [
    { name: 'Upper Band', y: 0.075 },
    { name: 'Lower Band', y: 0.042 }
  ]
  for (const b of bandSpecs) {
    const band = makeModelEntity('cylinder', {
      parentId: turntable.id, name: b.name,
      cylinderRadius: 0.057, cylinderHeight: 0.005,
      position: [0, b.y, 0]
    })
    band.materials = [pbr('#1a0a06', { roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 })]
    items.push(band)
  }

  // Two attribution cards — permanent orbit around the plinth so the
  // provenance always reads. Used for at-a-glance metadata.
  items.push(attachText(anchor, [-0.30, 1.35, 0], 'Attic Black-figure', {
    name: 'Attribution', style: 'body', color: '#e6d4b0', background: '#0c0c0e'
  }))
  items.push(attachText(anchor, [0, 1.35, -0.28], 'Collection\nof the Museum', {
    name: 'Provenance', style: 'body', color: '#c9c9cf', background: '#0c0c0e'
  }))

  // Title.
  items.push(attachTitle(anchor, [0, 1.55, 0], 'Greek Amphora'))
  items.push(attachSubtitle(anchor, [0, 1.50, 0], 'Tap the belly for its era · tap the plinth to pause'))

  return { items, activeTabId: tab.id }
}

// ---- City Block (volume) ---------------------------------------------
// Urban-planning diorama: four towers around a central plaza with a
// live traffic signal and a car patrolling the perimeter. Tapping a
// tower reveals its stats card (name / height / floors / year), hover
// glows the facade, and tapping the plaza toggles a scene-wide "night
// mode" broadcast that dims towers to a moody evening tone.
function cityBlockVolume() {
  const tab = makeTab({ name: 'City', icon: 'building.2' })
  const w   = volumeWindow({ parentId: tab.id, name: 'City Block' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'City Block' })
  const items = [tab, w, anchor]

  // Asphalt slab — the block's ground plane.
  const ground = makeModelEntity('box', {
    parentId: anchor.id, name: 'Ground',
    boxSize: [0.60, 0.008, 0.60],
    position: [0, 1.00, 0]
  })
  ground.materials = [pbr('#2a2a2c', { roughness: 0.85, metallic: 0.02 })]
  items.push(ground)

  // Cross-shaped road — two flat white boxes intersecting at the
  // centre. Slightly above the slab so they don't Z-fight.
  const roadNS = makeModelEntity('box', {
    parentId: anchor.id, name: 'Avenue N-S',
    boxSize: [0.08, 0.001, 0.60],
    position: [0, 1.0048, 0]
  })
  roadNS.materials = [simple('#3a3a3c', 0.9)]
  items.push(roadNS)
  const roadEW = makeModelEntity('box', {
    parentId: anchor.id, name: 'Avenue E-W',
    boxSize: [0.60, 0.001, 0.08],
    position: [0, 1.0048, 0]
  })
  roadEW.materials = [simple('#3a3a3c', 0.9)]
  items.push(roadEW)

  // Four towers — hover glows, tap reveals a stats card, and each
  // listens for 'night-mode' to brighten its emission (city lights on).
  const towerSpecs = [
    { name: 'Solstice Tower', pos: [-0.17, -0.17], h: 0.36, color: '#3a78ff', glow: '#3a78ff', fact: 'Solstice Tower\n380 ft · 32 floors\nCompleted 2019' },
    { name: 'Meridian Tower', pos: [ 0.17, -0.17], h: 0.24, color: '#e0c47a', glow: '#ffcc00', fact: 'Meridian Tower\n260 ft · 20 floors\nCompleted 2015' },
    { name: 'Beacon Hall',    pos: [-0.17,  0.17], h: 0.18, color: '#c04040', glow: '#ff5a4a', fact: 'Beacon Hall\n200 ft · 15 floors\nCompleted 2011' },
    { name: 'Lantern Court',  pos: [ 0.17,  0.17], h: 0.29, color: '#7ec8c8', glow: '#40e0e0', fact: 'Lantern Court\n310 ft · 26 floors\nCompleted 2022' }
  ]
  for (const b of towerSpecs) {
    // Stats card — hidden by default, positioned outside the block.
    const cardOffsetX = b.pos[0] < 0 ? -0.34 : 0.34
    const cardOffsetY = 1.05 + b.h + 0.05
    const cardOffsetZ = b.pos[1]
    const card = attachInfoCard(anchor, [cardOffsetX, cardOffsetY, cardOffsetZ], b.fact, {
      name: `${b.name} Info`, style: 'body', color: '#ffffff', background: '#0c0c0e'
    })
    items.push(card)

    const tower = makeModelEntity('box', {
      parentId: anchor.id, name: b.name,
      boxSize: [0.14, b.h, 0.14],
      position: [b.pos[0], 1.005 + b.h / 2, b.pos[1]],
      behaviors: [
        onHoverIn(1.02, b.glow),
        onHoverOut(),
        onTapHighlight(1.05, 0.3),
        onTapReveal(card.id),
        onEventReceived('night-mode',
          action('setMaterial', { property: 'emissionIntensity', numberValue: 1.4, duration: 0.6, curve: 'easeInOut', toggle: true })
        )
      ]
    })
    tower.materials = [pbr(b.color, {
      roughness: 0.5, metallic: 0.15,
      emissive: b.glow, emissiveIntensity: 0.4,
      clearcoat: 0.4, clearcoatRoughness: 0.3
    })]
    items.push(tower)

    // Rooftop antenna.
    const antenna = makeModelEntity('cone', {
      parentId: anchor.id, name: `${b.name} Antenna`,
      coneRadius: 0.008, coneHeight: 0.04,
      position: [b.pos[0], 1.005 + b.h + 0.02, b.pos[1]]
    })
    antenna.materials = [pbr('#c9c9cf', { roughness: 0.3, metallic: 0.8 })]
    items.push(antenna)
  }

  // Central plaza — tap it to toggle scene-wide 'night-mode'. The
  // plaza itself brightens on scene start so it reads as inhabited.
  const plaza = makeModelEntity('cylinder', {
    parentId: anchor.id, name: 'Plaza',
    cylinderRadius: 0.05, cylinderHeight: 0.002,
    position: [0, 1.006, 0],
    behaviors: [
      onHoverIn(1.05, '#7be39c'),
      onHoverOut(),
      onTapBroadcast('night-mode')
    ]
  })
  plaza.materials = [pbr('#3a5a2a', { roughness: 0.8, metallic: 0, emissive: '#5aaa4a', emissiveIntensity: 0.2 })]
  items.push(plaza)

  // Traffic light — pole plus three lamps that pulse emission on a
  // shared 3s loop with staggered auto-reverse.
  const pole = makeModelEntity('cylinder', {
    parentId: anchor.id, name: 'Signal Pole',
    cylinderRadius: 0.005, cylinderHeight: 0.11,
    position: [0.058, 1.06, 0.058]
  })
  pole.materials = [pbr('#1a1a1c', { roughness: 0.4, metallic: 0.6 })]
  items.push(pole)
  const lightSpecs = [
    { name: 'Red',    y: 1.128, color: '#ff3b30' },
    { name: 'Yellow', y: 1.108, color: '#ffcc00' },
    { name: 'Green',  y: 1.088, color: '#34c759' }
  ]
  for (const l of lightSpecs) {
    const light = makeModelEntity('sphere', {
      parentId: anchor.id, name: `Signal ${l.name}`,
      sphereRadius: 0.009,
      position: [0.058, l.y, 0.058],
      behaviors: [loopEmissionPulse(3.0, 2.4)]
    })
    light.materials = [pbr(l.color, { roughness: 0.5, emissive: l.color, emissiveIntensity: 0.4 })]
    items.push(light)
  }

  // Car — tiny box on a Y-rotating group at the block's centre.
  const carPath = makeGroupEntity({
    parentId: anchor.id, name: 'Car Path',
    position: [0, 1.014, 0],
    behaviors: [
      behavior(
        trigger('timer', { mode: 'loop', seconds: 9.0 }),
        action('rotateTo', { mode: 'relative', rotation: [0, -360, 0], duration: 9.0, curve: 'linear' })
      )
    ]
  })
  items.push(carPath)
  const car = makeModelEntity('box', {
    parentId: carPath.id, name: 'Car',
    boxSize: [0.032, 0.010, 0.017],
    position: [0.24, 0, 0]
  })
  car.materials = [pbr('#ff453a', {
    roughness: 0.32, metallic: 0.4,
    emissive: '#ff6d3a', emissiveIntensity: 0.35,
    clearcoat: 0.7, clearcoatRoughness: 0.1
  })]
  items.push(car)

  // Title + subtitle.
  items.push(attachTitle(anchor, [0, 1.55, 0], 'Downtown Block'))
  items.push(attachSubtitle(anchor, [0, 1.50, 0], 'Tap a tower for stats · tap the plaza for night mode'))

  return { items, activeTabId: tab.id }
}

// ---- Meadow (volume) -------------------------------------------------
// Landscape diorama modelled on Apple's Weather visionOS layout. A sun
// arcs across the sky on a 30 s cycle; tapping it fires 'day-night' so
// the meadow flips lighting mood (moon brightens, weather card content
// swaps). Tap the cloud to broadcast 'downpour' — rain intensifies for
// a few seconds. Tapping the farmhouse reveals a "current forecast"
// card.
function weatherVolume() {
  const tab = makeTab({ name: 'Weather', icon: 'cloud.sun' })
  const w   = volumeWindow({ parentId: tab.id, name: 'Meadow' })
  const anchor = makeAnchorEntity({ parentId: w.id, name: 'Landscape' })
  const items = [tab, w, anchor]

  // Grass base — wide low cylinder so the diorama feels round rather
  // than square. Slight sheen picks up the studio key light like
  // dewy grass.
  const ground = makeModelEntity('cylinder', {
    parentId: anchor.id, name: 'Meadow',
    cylinderRadius: 0.28, cylinderHeight: 0.02,
    position: [0, 1.00, 0]
  })
  ground.materials = [pbr('#4a7a3a', { roughness: 0.85, metallic: 0, sheen: '#2a5a20' })]
  items.push(ground)

  // Two rolling hills in the background — spheres partially buried
  // in the ground so only the upper hemisphere shows.
  const hillSpecs = [
    { name: 'Hill Left',  pos: [-0.14, 1.005, -0.12], r: 0.10, color: '#3a6a2a' },
    { name: 'Hill Right', pos: [ 0.14, 1.010, -0.12], r: 0.08, color: '#4a7a3a' }
  ]
  for (const h of hillSpecs) {
    const hill = makeModelEntity('sphere', {
      parentId: anchor.id, name: h.name,
      sphereRadius: h.r,
      position: h.pos
    })
    hill.materials = [pbr(h.color, { roughness: 0.9, metallic: 0 })]
    items.push(hill)
  }

  // Small farmhouse — hovering warms up the wooden facade; tapping
  // reveals the "current forecast" info card. Farmhouse is deliberately
  // in the foreground so it's the wearer's near-field anchor.
  const forecastCard = attachInfoCard(anchor, [0.24, 1.22, 0.10],
    'Forecast\nSunny 68°F\nWinds W · 4 mph\nHumidity 42%',
    { name: 'Forecast Card', style: 'body', color: '#ffe08a', background: '#0c0c0e' }
  )
  items.push(forecastCard)

  const house = makeModelEntity('box', {
    parentId: anchor.id, name: 'Farmhouse',
    boxSize: [0.06, 0.05, 0.05],
    position: [-0.06, 1.034, 0.10],
    behaviors: [
      onHoverIn(1.05, '#ffcc80'),
      onHoverOut(),
      onTapReveal(forecastCard.id)
    ]
  })
  house.materials = [pbr('#e6d4b0', { roughness: 0.7, metallic: 0, clearcoat: 0.2 })]
  items.push(house)
  const roof = makeModelEntity('cone', {
    parentId: anchor.id, name: 'Roof',
    coneRadius: 0.045, coneHeight: 0.035,
    position: [-0.06, 1.076, 0.10]
  })
  roof.materials = [pbr('#a03a2a', { roughness: 0.55, metallic: 0.05, clearcoat: 0.3 })]
  items.push(roof)

  // Chimney — thin box on the roof, brick-coloured.
  const chimney = makeModelEntity('box', {
    parentId: anchor.id, name: 'Chimney',
    boxSize: [0.010, 0.024, 0.010],
    position: [-0.048, 1.088, 0.096]
  })
  chimney.materials = [pbr('#8a3020', { roughness: 0.8, metallic: 0 })]
  items.push(chimney)

  // Two pine trees — cylinder trunk + cone foliage.
  const treeSpecs = [
    { name: 'Pine Left',  x: -0.16, z: 0.06 },
    { name: 'Pine Right', x:  0.16, z: 0.06 }
  ]
  for (const t of treeSpecs) {
    const trunk = makeModelEntity('cylinder', {
      parentId: anchor.id, name: `${t.name} Trunk`,
      cylinderRadius: 0.006, cylinderHeight: 0.04,
      position: [t.x, 1.028, t.z]
    })
    trunk.materials = [pbr('#5a3a2a', { roughness: 0.9, metallic: 0 })]
    items.push(trunk)
    const foliage = makeModelEntity('cone', {
      parentId: anchor.id, name: `${t.name} Foliage`,
      coneRadius: 0.032, coneHeight: 0.08,
      position: [t.x, 1.088, t.z]
    })
    foliage.materials = [pbr('#2a5a1a', { roughness: 0.9, metallic: 0, sheen: '#4a7a3a' })]
    items.push(foliage)
  }

  // Sky group — spins slowly on X so its children (sun + moon) arc
  // over the landscape once every 30 s. Anchored above the meadow
  // centre so the arc pivots naturally.
  const sky = makeGroupEntity({
    parentId: anchor.id, name: 'Sky',
    position: [0, 1.02, 0],
    behaviors: [
      behavior(
        trigger('timer', { mode: 'loop', seconds: 30.0 }),
        action('rotateTo', { mode: 'relative', rotation: [360, 0, 0], duration: 30.0, curve: 'linear' })
      )
    ]
  })
  items.push(sky)

  // Sun — hover glows warm, tap fires 'day-night' broadcast (moon
  // listens + brightens; sun dims). Sun also carries hover feedback.
  const sun = makeModelEntity('sphere', {
    parentId: sky.id, name: 'Sun',
    sphereRadius: 0.030,
    position: [0, 0.34, 0.02],
    behaviors: [
      onHoverIn(1.10, '#ffe08a'),
      onHoverOut(),
      onTapBroadcast('day-night'),
      onEventReceived('day-night',
        action('setMaterial', { property: 'emissionIntensity', numberValue: 0.3, duration: 0.8, curve: 'easeInOut', toggle: true })
      )
    ]
  })
  sun.materials = [pbr('#ffe08a', { roughness: 0.5, emissive: '#ffcc00', emissiveIntensity: 2.4 })]
  items.push(sun)

  // Moon — dim companion. Brightens on 'day-night' so the sky is
  // never dark — the wearer sees the moon replace the sun.
  const moon = makeModelEntity('sphere', {
    parentId: sky.id, name: 'Moon',
    sphereRadius: 0.022,
    position: [0, -0.34, 0.02],
    behaviors: [
      onEventReceived('day-night',
        action('setMaterial', { property: 'emissionIntensity', numberValue: 2.2, duration: 0.8, curve: 'easeInOut', toggle: true })
      )
    ]
  })
  moon.materials = [pbr('#e0e0e6', { roughness: 0.7, emissive: '#c0c0d0', emissiveIntensity: 0.5 })]
  items.push(moon)

  // Cloud — hovers/taps drive a 'downpour' broadcast that the rain
  // drops listen for; they compress their fall period to a quicker
  // cadence for a few seconds.
  const cloud = makeGroupEntity({
    parentId: anchor.id, name: 'Cloud',
    position: [0.10, 1.30, -0.04],
    behaviors: [
      behavior(
        trigger('timer', { mode: 'loop', seconds: 4.0 }),
        action('moveTo', { mode: 'offset', position: [-0.04, 0, 0], duration: 4.0, curve: 'easeInOut', toggle: true })
      ),
      onHoverIn(1.05, '#c0d0ff'),
      onHoverOut(),
      onTapBroadcast('downpour')
    ]
  })
  items.push(cloud)
  const puffSpecs = [
    { x: -0.03, y:  0.00, r: 0.022 },
    { x:  0.00, y:  0.010, r: 0.028 },
    { x:  0.03, y:  0.00, r: 0.022 },
    { x:  0.010, y: -0.010, r: 0.020 }
  ]
  for (let i = 0; i < puffSpecs.length; i++) {
    const p = puffSpecs[i]
    const puff = makeModelEntity('sphere', {
      parentId: cloud.id, name: `Puff ${i + 1}`,
      sphereRadius: p.r,
      position: [p.x, p.y, 0]
    })
    puff.materials = [pbr('#e6e6ea', { roughness: 0.9, metallic: 0, emissive: '#a0a0b0', emissiveIntensity: 0.25 })]
    items.push(puff)
  }

  // Rain — four thin vertical cylinders under the cloud. Each listens
  // for 'downpour' and briefly speeds up its fall (short + hard).
  for (let i = 0; i < 4; i++) {
    const drop = makeModelEntity('cylinder', {
      parentId: cloud.id, name: `Drop ${i + 1}`,
      cylinderRadius: 0.001, cylinderHeight: 0.020,
      position: [-0.030 + i * 0.020, -0.05, 0.010 + (i % 2) * 0.010],
      behaviors: [
        behavior(
          trigger('timer', { mode: 'loop', seconds: 0.6 + i * 0.08 }),
          action('moveTo', { mode: 'offset', position: [0, -0.08, 0], duration: 0.5, curve: 'linear', toggle: true })
        ),
        onEventReceived('downpour',
          action('moveTo', { mode: 'offset', position: [0, -0.05, 0], duration: 0.15, curve: 'linear' }),
          action('wait', { seconds: 0.1 }),
          action('moveTo', { mode: 'offset', position: [0, 0.05, 0], duration: 0.1, curve: 'linear' })
        )
      ]
    })
    drop.materials = [pbr('#6a8ac0', { roughness: 0.2, emissive: '#3a5a80', emissiveIntensity: 0.6 })]
    items.push(drop)
  }

  // Weather widget card. Uses the ATTACHMENT_TEXT_STYLES 'headline'
  // ramp so the card scales as a unit — no arbitrary metre picks.
  items.push(attachText(anchor, [-0.24, 1.34, 0.04], 'SUNNY\n68° · Feels 71°', {
    name: 'Weather Card', style: 'headline', color: '#ffe08a', background: '#0c0c0e'
  }))

  // Title + subtitle.
  items.push(attachTitle(anchor, [0, 1.55, 0], 'Meadow'))
  items.push(attachSubtitle(anchor, [0, 1.50, 0], 'Tap the sun for night · tap the cloud for a downpour'))

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
  // Volume-mode templates surfaced on the splash. Six polished
  // guided-diorama scenes, each showcasing a visionOS volumetric-window
  // pattern: orbital motion (cosmos), continuous ambient animation
  // (engine, city, museum turntable), tap-to-highlight interactions,
  // and Attachment-anchored floating labels. Designed around the
  // wearer's default 1.5 m stand-off — every scene fits inside the
  // volumetric preset envelope (~0.6 × 0.4 × 0.6 m).
  cosmos:      { mode: 'volume', label: 'Cosmos',        description: 'Solar system: sun with four planets orbiting on glow rings. Tap a planet to focus.',            build: cosmosVolume },
  anatomy:     { mode: 'volume', label: 'Anatomy',       description: 'Beating human heart on a museum plinth with labelled chambers. Tap a chamber to isolate.',      build: anatomyVolume },
  engine:      { mode: 'volume', label: 'Engine',        description: 'Inline-4 engine with rotating crankshaft, firing pistons, and a glowing exhaust. Tap to spark.',build: engineVolume },
  museum:      { mode: 'volume', label: 'Museum',        description: 'Greek amphora on a slowly-rotating turntable with three period info cards floating around.',    build: museumVolume },
  cityBlock:   { mode: 'volume', label: 'City Block',    description: 'Miniature downtown: four lit towers, a cycling traffic light, and a car looping the block.',    build: cityBlockVolume },
  meadow:      { mode: 'volume', label: 'Meadow',        description: 'Landscape diorama: farmhouse, trees, drifting rain cloud, and a sun that arcs across the sky.', build: weatherVolume }
}

export const TEMPLATE_ORDER_WINDOW = [
  'welcome', 'browse', 'player', 'profile', 'article', 'settings'
]
export const TEMPLATE_ORDER_VOLUME = [
  'cosmos', 'anatomy', 'engine', 'museum', 'cityBlock', 'meadow'
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
