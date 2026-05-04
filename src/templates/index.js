// Sample templates surfaced on the splash screen. Each template is a pure
// function that returns `{ items, activeTabId }` — same shape as
// factories.seedScene — and the store's `applyTemplate` action replaces the
// current scene with whatever the template produces.
//
// Templates are window-mode only for now; the splash hides them when the
// user picks Volume mode. Each one stays small and focused so the user can
// scan it in one read and tweak it from there.

import { ptToUnits } from '../appleSystem'
import {
  makeTab, makeWindow, makeStack, makePanel, textStyleToFontSize
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

// ---- Public registry --------------------------------------------------

export const TEMPLATES = {
  blank:      { label: 'Blank',         description: 'Empty window with a single fill stack.',                    build: blank },
  welcome:    { label: 'Welcome',       description: 'Title, subtitle, and a primary action.',                    build: welcome },
  settings:   { label: 'Settings',      description: 'Inset-grouped list with toggles and a slider.',             build: settings },
  onboarding: { label: 'Onboarding',    description: 'Hero image, title, body, and a continue button.',           build: onboarding },
  tabBar:     { label: 'Tab Bar App',   description: 'Window with a bottom Tab Bar ornament (4 pages).',          build: tabBarApp },
  sidebar:    { label: 'Sidebar App',   description: 'NavigationSplitView (joined) with a sidebar + detail.',     build: sidebarApp }
}

export const TEMPLATE_ORDER = [
  'blank', 'welcome', 'settings', 'onboarding', 'tabBar', 'sidebar'
]

// Returns a fresh `{ items, activeTabId }` for the given template key. The
// caller (store.applyTemplate) replaces the scene with this output.
export function buildTemplate(key) {
  const t = TEMPLATES[key]
  if (!t) return null
  return t.build()
}
