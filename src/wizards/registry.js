// Add-flow wizards.
//
// When the user adds a compound component (Tab Bar, Sidebar, Toolbar,
// Context Menu, …) we pop a modal that asks ONLY the structural
// yes/no/how-many questions the user can't recover from afterwards —
// orientation, group count, "show counter on this row", etc. Per-item
// names / symbols / counter values are auto-filled with sensible
// samples so the inserted panels look populated; the user edits the
// concrete strings in the inspector after insertion.
//
// Each entry in `WIZARDS` is a self-contained spec:
//   - title / description: shown in the modal chrome
//   - fields:  schema for the form (the dialog renders this generically)
//   - defaults: initial field values
//   - build(params, ctx): returns `{ items, selectedId, replace? }`.
//     If `replace` is true, the returned `items` array is the full
//     replacement for the store's items (used by the sidebar wizard
//     to reparent existing window content into the detail pane).
//     Otherwise the returned items are appended to the existing list.
//
// Field schema tags supported by AddWizardDialog:
//   { type: 'number',  id, label, default, min, max, step }
//   { type: 'boolean', id, label, default }
//   { type: 'select',  id, label, default, options:[{value,label}] }
//   { type: 'list',    id, label, itemLabel, minItems, maxItems,
//                      default:[...], itemFields:[...] }

import {
  makeStack, makePanel, textStyleToFontSize
} from '../store/factories'
import { ptToUnits } from '../appleSystem'

// ---- sample fillers ----------------------------------------------------
//
// Every "name / symbol / counter / option label" the user could fill in
// is auto-populated from these arrays. The wizard surfaces the
// structural toggles (show? how many?) only; the user edits the
// concrete strings in the inspector after the panel is dropped.

const TAB_LABELS  = ['Home', 'Search', 'Library', 'Profile', 'Settings', 'More']
const TAB_SYMBOLS = ['house.fill', 'magnifyingglass', 'books.vertical.fill',
                     'person.crop.circle.fill', 'gearshape.fill', 'ellipsis']

const SIDEBAR_TITLES  = ['Inbox', 'Drafts', 'Sent', 'Archive', 'Trash',
                         'Spam', 'Junk', 'Important', 'Starred', 'Flagged',
                         'Outbox', 'All Mail']
const SIDEBAR_SYMBOLS = ['tray', 'doc', 'paperplane', 'archivebox', 'trash',
                         'envelope', 'envelope.fill', 'flag', 'star',
                         'bookmark', 'tag', 'folder']
const SIDEBAR_COUNTERS = ['42', '12', '7', '3', '1', '8', '24', '99', '5', '6', '11', '0']
const SECTION_HEADINGS = ['Inboxes', 'Mailboxes', 'Favourites', 'Tags', 'Smart Folders']

const TOOLBAR_LEADING_LABELS  = ['Edit', 'Cancel', 'Back', 'Close']
const TOOLBAR_TRAILING_LABELS = ['Done', 'Save', 'Add', 'Share']

const MENU_ITEMS    = ['Cut', 'Copy', 'Paste', 'Duplicate', 'Select All', 'Delete']
const PICKER_OPTS   = ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5']
const SEGMENT_LABELS = ['Day', 'Week', 'Month', 'Year']
const LIST_TITLES   = ['First Item', 'Second Item', 'Third Item', 'Fourth Item',
                       'Fifth Item', 'Sixth Item', 'Seventh Item', 'Eighth Item']
const TABLE_COLUMNS = ['Name', 'Status', 'Type', 'Date', 'Size']

// ---- Tab Bar -----------------------------------------------------------
//
// SwiftUI maps to `TabView { Tab("...", systemImage: "...") { ... } }`,
// rendered by visionOS as a 44pt circular icon cluster inside a glass
// capsule (Figma node 1:94). No per-tab user input — pick orientation
// and count and the wizard fills in sample tabs.

const tabBarWizard = {
  title: 'Add Tab Bar',
  description: "Pick orientation and how many tabs. Labels and symbols are sample-filled; edit each tab in the inspector after insertion.",
  defaults: { placement: 'bottom', tabCount: 3, selected: 1 },
  fields: [
    {
      type: 'select', id: 'placement', label: 'Placement',
      options: [
        { value: 'bottom',   label: 'Bottom (horizontal)' },
        { value: 'leading',  label: 'Leading (vertical)' },
        { value: 'trailing', label: 'Trailing (vertical)' }
      ]
    },
    { type: 'number', id: 'tabCount', label: 'Tabs',         min: 1, max: 6, step: 1 },
    { type: 'number', id: 'selected', label: 'Selected tab', min: 1, max: 6, step: 1 }
  ],
  build(params, ctx) {
    const vertical = params.placement === 'leading' || params.placement === 'trailing'
    const count = Math.max(1, Math.min(6, params.tabCount || 3))
    const selected = Math.max(1, Math.min(count, params.selected || 1))
    const bar = makeStack({
      parentId: ctx.windowId,
      stackType: vertical ? 'vstack' : 'hstack',
      ornament: params.placement,
      name: 'Tab Bar',
      // Apple Figma kit (Tab Bar 1:94): 34pt capsule, 12pt padding,
      // 12pt gap, glass-thick fill with white-40 border.
      background: 'glassThick', material: 'thick',
      padding: 12, spacing: 12,
      cornerRadius: ptToUnits(34),
      alignment: 'center', widthMode: 'fit', heightMode: 'fit'
    })
    const tabs = Array.from({ length: count }, (_, i) => makePanel('button', {
      parentId: bar.id,
      name: TAB_LABELS[i] || `Tab ${i + 1}`,
      // 44pt circular icon button — visionOS Tab Bar idiom.
      text: '',
      symbolName: TAB_SYMBOLS[i] || 'circle.fill',
      size: [ptToUnits(44), ptToUnits(44)],
      cornerRadius: ptToUnits(22),
      buttonStyle: 'plain',
      color: (i + 1) === selected ? '#ffffff12' : '#00000000',
      colorToken: null,
      textColor: '#ffffff', textColorToken: null
    }))
    return { items: [bar, ...tabs], selectedId: bar.id }
  }
}

// ---- Sidebar (NavigationSplitView) ------------------------------------
//
// SwiftUI shape:
//   NavigationSplitView {
//     List {
//       Section { ... }                  // group 1, no header
//       Section("Section Heading") { ... } // group 2 with heading
//     }
//     .navigationTitle("Title")
//     .toolbar { ToolbarItem { Button("Edit") {} } }
//   } detail: { /* existing window content */ }
//
// Wizard asks only:
//   - splitStyle (joined / separated)
//   - showHeader (yes/no)
//   - showHeaderButton (yes/no) — only when showHeader
//   - groups: list of { showSectionHeader, items: [{ showCounter }] }
//     - groups can be empty (0+) — a header-only sidebar is valid
//
// Everything else (header title text, item titles, symbols, counter
// numbers, section heading text) is auto-filled from the sample arrays.
//
// The build reparents any existing window content into the new Detail
// column so the user doesn't end up with a sidebar next to their
// previous seed scene. No "Select an Item" placeholder — if the user
// wants empty detail, they want empty detail.

const sidebarWizard = {
  title: 'Add Sidebar',
  description: "Configure the NavigationSplitView. Per-link titles, symbols, and counter values are sample-filled — edit them in the inspector after insertion.",
  defaults: {
    splitStyle: 'joined',
    showHeader: true,
    showHeaderButton: true,
    groups: [
      { itemCount: 2 },
      { itemCount: 3 }
    ]
  },
  fields: [
    {
      type: 'select', id: 'splitStyle', label: 'Style',
      options: [
        { value: 'joined',    label: 'Joined (default)' },
        { value: 'separated', label: 'Separated (floating)' }
      ]
    },
    { type: 'boolean', id: 'showHeader',       label: 'Show header' },
    { type: 'boolean', id: 'showHeaderButton', label: 'Show "Edit" button', dependsOn: 'showHeader' },
    {
      // Groups can be empty — a header-only sidebar is valid. Each row
      // is just "Group NN  [Items]  ×" — the wizard fills section
      // heading text from samples, user edits in the inspector after
      // insertion.
      type: 'list', id: 'groups', label: 'Groups',
      itemLabel: 'Group', minItems: 0, maxItems: 5,
      inlineRow: true,
      itemFields: [
        { type: 'number', id: 'itemCount', label: 'Items', min: 1, max: 12 }
      ]
    }
  ],
  // Sidebar build — mirrors SwiftUI's NavigationSplitView shape: one
  // sidebar slot containing a List of NavigationLinks (each tagged with
  // a `navTag` value), and a detail slot whose content is whichever
  // destination matches the active tag. We model the detail slot as
  // N sibling Destination stacks (one per nav link) so the user can
  // see + toggle visibility per destination from the layers panel.
  // No wrapper "Detail" stack — destinations live directly inside the
  // NavigationSplitView so the layer tree matches SwiftUI's mental model.
  build(params, ctx) {
    const items   = ctx.items
    const winId   = ctx.windowId
    const separated = params.splitStyle === 'separated'
    const sideW = 320

    // Existing direct children of the window that should move into the
    // first destination (so the user's current authoring doesn't get
    // orphaned by the split-view insert). Excludes chrome.
    const presentationTypes = ['sheet', 'popover', 'alert']
    const existingContent = items.filter((it) =>
      it.parentId === winId &&
      !(it.type === 'stack' && it.ornament) &&
      !(it.type === 'panel' && presentationTypes.includes(it.panelType))
    )
    const reparentedIds = new Set(existingContent.map((it) => it.id))

    // NavigationSplitView root — no wrapper Sidebar / Detail stacks.
    // Sidebar-slot and detail-slot children sit DIRECTLY inside this
    // root; the layout engine reads their `slot` field to split them
    // into the two columns. This matches the SwiftUI shape:
    //   NavigationSplitView {
    //     List { ... }            // sidebar slot
    //   } detail: { Destination() }
    // (the only "stack" left under the NavSplitView is the Header HStack
    // which represents `.navigationTitle + .toolbar` modifiers SwiftUI
    // applies to the List — semantically not a wrapper container).
    const root = makeStack({
      parentId: winId,
      stackType: 'hstack',
      name: separated ? 'NavigationSplitView (Separated)' : 'NavigationSplitView',
      spacing: separated ? 16 : 0, padding: 0,
      widthMode: 'fill', heightMode: 'fill', alignment: 'center',
      splitStyle: params.splitStyle,
      columnVisibility: 'all'
    })

    const built = [root]
    const innerSidebarW = sideW - 32   // 320pt sidebar minus 16pt × 2 inset

    if (params.showHeader) {
      // Apple visionOS Sidebar Header (Figma 6:1485): 92pt height,
      // pl-28 / pr-20 inner padding, Title rendered SF Pro Bold 29pt
      // (largeTitle ≈ 34pt is the nearest SwiftUI style), trailing
      // Edit button rendered as a 44pt-high glass pill.
      const headerRow = makeStack({
        parentId: root.id, stackType: 'hstack', name: 'Header',
        alignment: 'center', spacing: 8, padding: 0,
        paddingEdges: { top: 0, bottom: 0, leading: 28, trailing: 20 },
        widthMode: 'fill', heightMode: 'fixed', fixedHeight: 92,
        slot: 'sidebar'
      })
      built.push(headerRow)
      built.push(makePanel('text', {
        parentId: headerRow.id, name: 'Title', text: 'Title',
        textStyle: 'largeTitle', fontSize: textStyleToFontSize('largeTitle'),
        fontWeight: 'bold', widthMode: 'fill',
        colorToken: null, color: '#000000',
        // Truncate with an ellipsis if the title is longer than the
        // header's remaining inner width (sidebar 320 − pl-28 − pr-20
        // − Edit pill − gap). Without this a user-typed title pushes
        // the Edit button outside the sidebar plate.
        lineLimit: 1,
        truncationMode: 'tail'
      }))
      if (params.showHeaderButton) {
        built.push(makePanel('button', {
          parentId: headerRow.id, name: 'Edit', text: 'Edit',
          // Figma Header button (6:1491): h-44 rounded-500 px-20.
          size: [ptToUnits(72), ptToUnits(44)],
          cornerRadius: ptToUnits(22),
          buttonStyle: 'plain',
          color: '#ecedef', colorToken: null,
          textColor: '#000000', textColorToken: null,
          textStyle: 'body', fontSize: textStyleToFontSize('body'),
          fontWeight: 'semibold'
        }))
      }
    }

    // Walk the groups → produce sample-filled List rows + a parallel
    // array of Destination stacks. Each row carries a `navTag` that
    // matches a sibling destination's `navTag`. Counters always render
    // — disable per-row in the inspector if not wanted, per spec.
    let linkIndex = 0
    const destinationDescriptors = [] // { navTag, rowTitle }
    ;(params.groups || []).forEach((group, gi) => {
      // Every group ships with a sample section heading text panel by
      // default — user clears the text or hides the panel via the
      // inspector if they don't want one. Apple's visionOS SectionHeader
      // (Figma 6:1494) renders as 66pt tall with pt-12 px-24 and SF Pro
      // Semibold 20pt — title3 (20pt) is the nearest SwiftUI style.
      built.push(makePanel('text', {
        parentId: root.id, name: `Section ${gi + 1} Header`,
        text: SECTION_HEADINGS[gi] || 'Section Heading',
        textStyle: 'title3', fontSize: textStyleToFontSize('title3'),
        fontWeight: 'semibold', widthMode: 'fill', colorToken: 'primary',
        slot: 'sidebar'
      }))
      const count = Math.max(1, Math.min(12, group.itemCount || 1))
      const rows = []
      for (let ii = 0; ii < count; ii++) {
        const title  = SIDEBAR_TITLES[linkIndex % SIDEBAR_TITLES.length]
        const symbol = SIDEBAR_SYMBOLS[linkIndex % SIDEBAR_SYMBOLS.length]
        const counter = SIDEBAR_COUNTERS[linkIndex % SIDEBAR_COUNTERS.length]
        const navTag = `dest-${linkIndex}`
        rows.push({ title, subtitle: '', systemImage: symbol, value: counter, navTag })
        destinationDescriptors.push({ navTag, rowTitle: title })
        linkIndex++
      }
      built.push(makePanel('list', {
        parentId: root.id, name: `Group ${gi + 1}`,
        size: [ptToUnits(innerSidebarW), ptToUnits(0)],
        listStyle: 'sidebar',
        rows,
        slot: 'sidebar'
      }))
    })

    // Detail slot — N destinations, one per nav link, all siblings of
    // the Sidebar inside the NavigationSplitView. Each carries a
    // `navTag` matching its corresponding row. The first destination
    // adopts any existing window content the user had already authored;
    // the rest are empty (the user fills them later).
    // Only the first destination is visible by default so the canvas
    // shows the active detail without the others stacking next to it.
    const destinations = destinationDescriptors.map((d, idx) => makeStack({
      parentId: root.id,
      stackType: 'vstack',
      name: `Destination ${idx + 1} (${d.rowTitle})`,
      spacing: 16, padding: 32,
      widthMode: 'fill', heightMode: 'fill', alignment: 'leading',
      slot: 'detail',
      navTag: d.navTag,
      visible: idx === 0
    }))
    // Mark the active destination on the root so preview/exporter can
    // route to it. Stored on the NavSplitView stack itself so the field
    // survives undo and round-trips through serialization.
    root.activeDestination = destinationDescriptors[0]?.navTag || null

    // If the user had existing seed content in the window, move it into
    // Destination 1 so they don't lose work.
    const firstDestId = destinations[0]?.id
    const movedToDest = (firstDestId && existingContent.length)
      ? existingContent.map((it) => ({ ...it, parentId: firstDestId }))
      : existingContent.map((it) => ({ ...it }))

    const untouched = items.filter((it) => !reparentedIds.has(it.id))
    return {
      items: [...untouched, ...movedToDest, ...built, ...destinations],
      selectedId: root.id,
      replace: true
    }
  }
}

// ---- Toolbar ----------------------------------------------------------
//
// SwiftUI: `.toolbar { ToolbarItemGroup(placement: .leading) { ... } ... }`.
// Wizard asks placement + slot counts. Labels are sample-filled.

const toolbarWizard = {
  title: 'Add Toolbar',
  description: "Pick placement and how many items in each slot. Labels are sample-filled — edit in the inspector after insertion.",
  defaults: { placement: 'top', showTitle: true, leadingCount: 1, trailingCount: 1 },
  fields: [
    {
      type: 'select', id: 'placement', label: 'Placement',
      options: [
        { value: 'top',    label: 'Top' },
        { value: 'bottom', label: 'Bottom' }
      ]
    },
    { type: 'boolean', id: 'showTitle',    label: 'Show centred title' },
    { type: 'number',  id: 'leadingCount', label: 'Leading items',  min: 0, max: 4 },
    { type: 'number',  id: 'trailingCount',label: 'Trailing items', min: 0, max: 4 }
  ],
  proxy: (store, params) => {
    const leading  = Array.from({ length: params.leadingCount  || 0 }, (_, i) => TOOLBAR_LEADING_LABELS[i]  || 'Item')
    const trailing = Array.from({ length: params.trailingCount || 0 }, (_, i) => TOOLBAR_TRAILING_LABELS[i] || 'Item')
    store.addToolbar({
      placement: params.placement,
      principal: params.showTitle ? 'Title' : '',
      leading, trailing
    })
  }
}

// ---- Context Menu (visionOS Context Menu) -----------------------------

const contextMenuWizard = {
  title: 'Add Context Menu',
  description: "A glass capsule listing selectable items. Pick whether to show a header and how many rows.",
  defaults: { showHeader: false, itemCount: 4 },
  fields: [
    { type: 'boolean', id: 'showHeader', label: 'Show header' },
    { type: 'number',  id: 'itemCount', label: 'Items', min: 1, max: 12 }
  ],
  build(params, ctx) {
    const items = Array.from({ length: params.itemCount || 4 },
      (_, i) => MENU_ITEMS[i] || `Item ${i + 1}`)
    const menu = makePanel('menu', {
      parentId: ctx.windowId,
      name: 'Context Menu',
      menuItems: items,
      material: 'thick',
      cornerRadius: ptToUnits(28),
      size: [ptToUnits(280), ptToUnits(56 * items.length + (params.showHeader ? 56 : 0) + 24)]
    })
    return { items: [menu], selectedId: menu.id }
  }
}

// ---- List, Form, Table, Slideshow, Segmented, Picker, Menu ------------

const listWizard = {
  title: 'Add List',
  description: 'Pick a style and row count. Row titles are sample-filled.',
  defaults: { listStyle: 'insetGrouped', rowCount: 4 },
  fields: [
    {
      type: 'select', id: 'listStyle', label: 'Style',
      options: [
        { value: 'default',      label: 'Default' },
        { value: 'plain',        label: 'Plain' },
        { value: 'inset',        label: 'Inset' },
        { value: 'insetGrouped', label: 'Inset Grouped' },
        { value: 'grouped',      label: 'Grouped' },
        { value: 'sidebar',      label: 'Sidebar' }
      ]
    },
    { type: 'number', id: 'rowCount', label: 'Rows', min: 1, max: 20 }
  ],
  build(params, ctx) {
    const rows = Array.from({ length: params.rowCount || 4 }, (_, i) => ({
      title: LIST_TITLES[i] || `Item ${i + 1}`,
      subtitle: 'Subtitle text'
    }))
    const panel = makePanel('list', {
      parentId: ctx.windowId,
      listStyle: params.listStyle, rows
    })
    return { items: [panel], selectedId: panel.id }
  }
}

const formWizard = {
  title: 'Add Form',
  description: 'A grouped form. Field names are sample-filled.',
  defaults: { rowCount: 3 },
  fields: [
    { type: 'number', id: 'rowCount', label: 'Rows', min: 1, max: 12 }
  ],
  build(params, ctx) {
    const names = ['Username', 'Email', 'Notifications', 'Language', 'Theme', 'Privacy']
    const rows = Array.from({ length: params.rowCount || 3 }, (_, i) => ({
      title: names[i] || `Field ${i + 1}`, subtitle: ''
    }))
    const panel = makePanel('form', { parentId: ctx.windowId, rows })
    return { items: [panel], selectedId: panel.id }
  }
}

const tableWizard = {
  title: 'Add Table',
  description: 'Pick column and row counts. Column headers are sample-filled.',
  defaults: { columnCount: 3, rowCount: 4 },
  fields: [
    { type: 'number', id: 'columnCount', label: 'Columns', min: 1, max: 6 },
    { type: 'number', id: 'rowCount',    label: 'Rows',    min: 1, max: 50 }
  ],
  build(params, ctx) {
    const cols = Array.from({ length: params.columnCount || 3 },
      (_, i) => TABLE_COLUMNS[i] || `Col ${i + 1}`)
    const rows = Array.from({ length: params.rowCount || 4 }, (_, r) =>
      cols.map((_, c) => `R${r + 1}C${c + 1}`))
    const panel = makePanel('table', { parentId: ctx.windowId, columns: cols, rows })
    return { items: [panel], selectedId: panel.id }
  }
}

const slideshowWizard = {
  title: 'Add Slideshow',
  description: 'A paginated TabView. Pick the slide count.',
  defaults: { slideCount: 3 },
  fields: [
    { type: 'number', id: 'slideCount', label: 'Slides', min: 1, max: 12 }
  ],
  build(params, ctx) {
    const panel = makePanel('slideshow', {
      parentId: ctx.windowId,
      slideCount: params.slideCount
    })
    return { items: [panel], selectedId: panel.id }
  }
}

const segmentedWizard = {
  title: 'Add Segmented Control',
  description: 'Pick the segment count. Labels are sample-filled.',
  defaults: { segmentCount: 3, selected: 1 },
  fields: [
    { type: 'number', id: 'segmentCount', label: 'Segments', min: 2, max: 6 },
    { type: 'number', id: 'selected',     label: 'Selected (1-based)', min: 1, max: 6 }
  ],
  build(params, ctx) {
    const segments = Array.from({ length: params.segmentCount || 3 },
      (_, i) => SEGMENT_LABELS[i] || `Seg ${i + 1}`)
    const panel = makePanel('segmented', {
      parentId: ctx.windowId,
      segments,
      selectedSegment: Math.max(0, Math.min(segments.length - 1, (params.selected || 1) - 1))
    })
    return { items: [panel], selectedId: panel.id }
  }
}

const pickerWizard = {
  title: 'Add Picker',
  description: 'Pick style and option count. Labels are sample-filled.',
  defaults: { pickerStyle: 'automatic', optionCount: 3 },
  fields: [
    {
      type: 'select', id: 'pickerStyle', label: 'Style',
      options: [
        { value: 'automatic',  label: 'Automatic (Menu)' },
        { value: 'menu',       label: 'Menu' },
        { value: 'segmented',  label: 'Segmented' },
        { value: 'wheel',      label: 'Wheel' },
        { value: 'inline',     label: 'Inline' }
      ]
    },
    { type: 'number', id: 'optionCount', label: 'Options', min: 1, max: 12 }
  ],
  build(params, ctx) {
    const opts = Array.from({ length: params.optionCount || 3 },
      (_, i) => PICKER_OPTS[i] || `Option ${i + 1}`)
    const panel = makePanel('picker', {
      parentId: ctx.windowId,
      text: 'Selection',
      pickerOptions: opts, pickerValue: opts[0],
      pickerStyle: params.pickerStyle
    })
    return { items: [panel], selectedId: panel.id }
  }
}

const menuWizard = {
  title: 'Add Menu',
  description: 'Pick how many items. Labels are sample-filled.',
  defaults: { itemCount: 3 },
  fields: [
    { type: 'number', id: 'itemCount', label: 'Items', min: 1, max: 12 }
  ],
  build(params, ctx) {
    const items = Array.from({ length: params.itemCount || 3 },
      (_, i) => MENU_ITEMS[i] || `Item ${i + 1}`)
    const panel = makePanel('menu', {
      parentId: ctx.windowId,
      text: 'Menu', menuItems: items
    })
    return { items: [panel], selectedId: panel.id }
  }
}

// ---- registry ----------------------------------------------------------

export const WIZARDS = {
  tabBar:      tabBarWizard,
  sidebar:     sidebarWizard,
  toolbar:     toolbarWizard,
  contextMenu: contextMenuWizard,
  list:        listWizard,
  form:        formWizard,
  table:       tableWizard,
  slideshow:   slideshowWizard,
  segmented:   segmentedWizard,
  picker:      pickerWizard,
  menu:        menuWizard
}

export const hasWizard = (kind) => Object.prototype.hasOwnProperty.call(WIZARDS, kind)
