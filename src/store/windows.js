// Windows + window-level wizards.
//
// Includes the structural wizards that author content *attached to a Window*:
//   - addWindow                    (new window inside the active tab)
//   - addTabBar                    (bottom-anchored ornament with N pills)
//   - addToolbar                   (top/bottom toolbar w/ leading/principal/trailing slots)
//   - addSplitView                 (in-window NavigationSplitView; joined or separated)
//   - setSplitStyle                (swap joined↔separated at runtime)
//   - setSplitColumnVisibility     (NavigationSplitView columnVisibility binding)
//   - setSplitSearchable           (NavigationSplitView .searchable() toggle)
//
// In-window TabView lives in `stacks.js` because it produces a stack subtree
// without window-level chrome.

import { ptToUnits, SPLIT_SEPARATED_WIDTH, SPLIT_SEPARATED_RADIUS } from '../appleSystem'
import { undoable } from './undo'
import { makeWindow, makeStack, makePanel, textStyleToFontSize } from './factories'
import { findTargetWindow } from './helpers'

export const createWindowsSlice = (set, get) => ({
  addWindow: (overrides = {}) => undoable(set, get, (s) => {
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
    const w = makeWindow({ parentId: parentTabId, position: [x, y, z], ...overrides })
    return { items: [...s.items, w], selectedId: w.id }
  }),

  // Convenience wrapper — in volume mode the Shift+A "Window" entry is
  // surfaced as "Volume" and routes here so the new shell is volumetric
  // out of the gate (instead of the user having to flip windowStyle in
  // the inspector after adding a flat plate).
  addVolume: () => get().addWindow({
    name: 'Volume',
    windowStyle: 'volumetric',
    position: [0, 0, 0],
    color: '#202024',
    colorToken: null
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

  // Add a SwiftUI-style `.toolbar` ornament. Placement is `top` or `bottom`
  // (mirroring `.toolbar(placement: .topBar/.bottomBar)` / visionOS
  // `.ornament(attachmentAnchor: .scene(.bottom))`). Items are grouped into
  // three slots — `leading`, `principal`, `trailing` — matching
  // `ToolbarItem(placement: .topBarLeading / .principal / .topBarTrailing)`.
  // Layout uses spacers between the groups so leading sticks to the left,
  // principal centers, and trailing sticks to the right.
  addToolbar: ({
    placement = 'top',
    leading = ['Edit'],
    principal = 'Title',
    trailing = ['Done']
  } = {}) => undoable(set, get, (s) => {
    const win = findTargetWindow(s)
    if (!win) return s

    const bar = makeStack({
      parentId: win.id,
      stackType: 'hstack',
      ornament: placement === 'bottom' ? 'bottom' : 'top',
      name: placement === 'bottom' ? 'Bottom Toolbar' : 'Top Toolbar',
      background: 'glassThick',
      material: 'thick',
      widthMode: 'fill',        // toolbar spans the full window width
      heightMode: 'fixed',
      fixedHeight: 52,
      padding: 12,
      spacing: 10,
      alignment: 'center'
    })

    const mkButton = (label) => makePanel('button', {
      parentId: bar.id,
      name: label,
      text: label,
      textStyle: 'callout',
      fontSize: textStyleToFontSize('callout'),
      fontWeight: 'semibold',
      size: [ptToUnits(Math.max(56, label.length * 10 + 20)), ptToUnits(32)],
      cornerRadius: ptToUnits(16),
      buttonStyle: 'plain',
      color: '#ffffff',
      colorToken: null,
      textColor: '#007aff',
      textColorToken: 'systemBlue'
    })

    const leadingBtns  = (leading  || []).map(mkButton)
    const trailingBtns = (trailing || []).map(mkButton)
    const principalItems = []
    const titleText = (principal || '').trim()
    if (titleText) {
      principalItems.push(makePanel('text', {
        parentId: bar.id,
        name: 'Title',
        text: titleText,
        textStyle: 'headline',
        fontSize: textStyleToFontSize('headline'),
        fontWeight: 'semibold',
        textAlign: 'center',
        colorToken: 'primary',
        color: '#000000',
        widthMode: 'fit'
      }))
    }
    // Spacers push each group to its slot: leading | spacer | principal | spacer | trailing
    const sp1 = makePanel('spacer', { parentId: bar.id, name: 'Spacer' })
    const sp2 = makePanel('spacer', { parentId: bar.id, name: 'Spacer' })

    // Child order (parentId + insertion order) drives HStack layout.
    const newItems = [
      bar,
      ...leadingBtns,
      sp1,
      ...principalItems,
      sp2,
      ...trailingBtns
    ]
    return { items: [...s.items, ...newItems], selectedId: bar.id }
  }),

  // SwiftUI NavigationSplitView — two-column sidebar + detail living *inside*
  // the current window (not a new window). The root HStack fills the window;
  // the sidebar has a fixed ideal width (Apple's default ≈ 320pt on visionOS)
  // and the detail column fills the remaining space. The sidebar is styled
  // as a list of navigation rows (matching `.listStyle(.sidebar)`), and the
  // detail column shows an inspector-like title + body placeholder.
  // style: 'joined' | 'separated'
  //   joined    — Apple's default two-column split (320pt sidebar, flush).
  //   separated — Sidebar floats as a standalone 623×fill dialogue box with
  //               a 30pt radius inside the window; detail fills the rest.
  addSplitView: ({ style = 'joined' } = {}) => undoable(set, get, (s) => {
    const win = findTargetWindow(s)
    if (!win) return s

    // Preserve anything the user has already placed in the window — the
    // existing items move into the new Detail column so the split view
    // doesn't overlap with them. We only adopt *direct* content children
    // (not ornaments/toolbars or presentation overlays).
    const presentationTypes = ['sheet', 'popover', 'alert']
    const existingContent = s.items.filter((it) =>
      it.parentId === win.id &&
      !(it.type === 'stack' && it.ornament) &&
      !(it.type === 'panel' && presentationTypes.includes(it.panelType))
    )

    const separated = style === 'separated'
    const sideW = separated ? SPLIT_SEPARATED_WIDTH : 320
    const root = makeStack({
      parentId: win.id,
      stackType: 'hstack',
      name: separated ? 'NavigationSplitView (Separated)' : 'NavigationSplitView',
      spacing: separated ? 16 : 0,
      padding: 0,
      widthMode: 'fill',
      heightMode: 'fill',
      alignment: 'center',
      splitStyle: style,
      // Mirrors SwiftUI's `NavigationSplitView(columnVisibility:)` binding.
      //   'all'          — sidebar + detail visible (default)
      //   'detailOnly'   — sidebar collapsed, detail fills window
      //   'doubleColumn' — both visible (alias for 'all' in two-column
      //                    layouts; kept so future triple-column layouts
      //                    can distinguish it from .all)
      columnVisibility: 'all',
      // Mirrors SwiftUI's `.searchable(text:, placement:)` modifier.
      //   'none'    — no search
      //   'sidebar' — search field pinned to top of the sidebar
      //   'toolbar' — search field rendered in the window toolbar
      searchable: 'none',
      searchPrompt: 'Search'
    })
    const sidebar = makeStack({
      parentId: root.id,
      stackType: 'vstack',
      name: 'Sidebar',
      spacing: 4,
      padding: 16,
      widthMode: 'fixed',
      heightMode: 'fill',
      fixedWidth: sideW,
      alignment: 'leading',
      // Readable mid-grey that sits between the window fill (#9ea1a2) and
      // black — avoids the near-black the previous secondarySystemBackground
      // token resolved to in dark mode.
      background: '#6b6e70',
      material: 'thin',
      // Separated sidebars render as a floating dialogue with a 30pt radius.
      ...(separated ? { cornerRadius: ptToUnits(SPLIT_SEPARATED_RADIUS) } : {})
    })
    const detail = makeStack({
      parentId: root.id,
      stackType: 'vstack',
      name: 'Detail',
      spacing: 16,
      padding: 48,
      widthMode: 'fill',
      heightMode: 'fill',
      alignment: 'center'
    })

    // Sidebar: header + a few navigation rows (the visual analogue of
    // `List { NavigationLink("Inbox") ... }` with `.listStyle(.sidebar)`).
    const sidebarHeader = makePanel('text', {
      parentId: sidebar.id,
      name: 'Sidebar Header',
      text: 'Sidebar',
      textStyle: 'title3',
      fontSize: textStyleToFontSize('title3'),
      fontWeight: 'bold',
      textAlign: 'left',
      widthMode: 'fill',
      colorToken: 'primary',
      color: '#000000'
    })
    const navLabels = ['Inbox', 'Starred', 'Drafts', 'Archive']
    const navIcons  = ['tray',  'star',    'doc',    'archivebox']
    const navRows = navLabels.map((label, i) => makePanel('button', {
      parentId: sidebar.id,
      name: label,
      text: label,
      textStyle: 'body',
      fontSize: textStyleToFontSize('body'),
      fontWeight: 'regular',
      size: [ptToUnits(sideW - 32), ptToUnits(40)],
      cornerRadius: ptToUnits(10),
      buttonStyle: 'plain',
      color: '#ffffff',
      colorToken: null,
      textColor: '#000000',
      textColorToken: 'primary',
      textAlign: 'left',
      symbolName: navIcons[i] || null,
      symbolRenderingMode: 'monochrome'
    }))

    // Detail column: if the window already had content we reparent it into
    // the detail column (that's what the user expects — the split view
    // "wraps" their existing layout). Otherwise show a large title + body
    // placeholder so the column isn't empty.
    let detailChildren = []
    let reparentedIds = new Set()
    let remainingItems = s.items
    if (existingContent.length > 0) {
      reparentedIds = new Set(existingContent.map((it) => it.id))
      // Remove them from the outer items array — they'll be re-added with
      // updated parentId below so child order stays deterministic.
      remainingItems = s.items.filter((it) => !reparentedIds.has(it.id))
      detailChildren = existingContent.map((it) => ({ ...it, parentId: detail.id }))
    } else {
      const detailTitle = makePanel('text', {
        parentId: detail.id,
        name: 'Title',
        text: 'Select an Item',
        textStyle: 'largeTitle',
        fontSize: textStyleToFontSize('largeTitle'),
        fontWeight: 'bold',
        textAlign: 'center',
        widthMode: 'fill'
      })
      const detailBody = makePanel('text', {
        parentId: detail.id,
        name: 'Body',
        text: 'Choose an item from the sidebar to see its details here.',
        textStyle: 'body',
        fontSize: textStyleToFontSize('body'),
        colorToken: 'secondary',
        color: '#8e8e93',
        textAlign: 'center',
        widthMode: 'fill'
      })
      detailChildren = [detailTitle, detailBody]
    }

    return {
      items: [
        ...remainingItems,
        root, sidebar, detail,
        sidebarHeader, ...navRows,
        ...detailChildren
      ],
      selectedId: root.id
    }
  }),

  // Swap a NavigationSplitView between joined/separated at runtime. Updates
  // the root's splitStyle and re-tunes the sidebar's width + corner radius.
  setSplitStyle: (rootId, style) => undoable(set, get, (s) => {
    const root = s.items.find((it) => it.id === rootId)
    if (!root || !root.splitStyle) return s
    const separated = style === 'separated'
    const sideW = separated ? SPLIT_SEPARATED_WIDTH : 320
    const sidebar = s.items.find(
      (it) => it.parentId === root.id && it.type === 'stack' && it.name === 'Sidebar'
    )
    return {
      items: s.items.map((it) => {
        if (it.id === root.id) {
          return {
            ...it,
            splitStyle: style,
            spacing: separated ? 16 : 0,
            name: separated ? 'NavigationSplitView (Separated)' : 'NavigationSplitView'
          }
        }
        if (sidebar && it.id === sidebar.id) {
          return {
            ...it,
            fixedWidth: sideW,
            cornerRadius: separated ? ptToUnits(SPLIT_SEPARATED_RADIUS) : undefined
          }
        }
        // Resize nav-row buttons so their 16pt-inset width matches the
        // new sidebar width.
        if (sidebar && it.parentId === sidebar.id && it.type === 'panel' && it.panelType === 'button') {
          return { ...it, size: [ptToUnits(sideW - 32), it.size[1]] }
        }
        return it
      })
    }
  }),

  // NavigationSplitView → columnVisibility toggle. 'detailOnly' hides the
  // sidebar (via `visible: false`) and lets the detail column's fill sizing
  // take over the whole window; 'all'/'doubleColumn' restore the sidebar.
  setSplitColumnVisibility: (rootId, visibility) => undoable(set, get, (s) => {
    const root = s.items.find((it) => it.id === rootId)
    if (!root || !root.splitStyle) return s
    const sidebar = s.items.find(
      (it) => it.parentId === root.id && it.type === 'stack' && it.name === 'Sidebar'
    )
    const sidebarVisible = visibility !== 'detailOnly'
    return {
      items: s.items.map((it) => {
        if (it.id === root.id) return { ...it, columnVisibility: visibility }
        if (sidebar && it.id === sidebar.id) return { ...it, visible: sidebarVisible }
        return it
      })
    }
  }),

  // NavigationSplitView → toggle `.searchable(...)`. Inserts or removes a
  // search panel at the top of the sidebar. 'toolbar' placement only marks
  // intent (for future code export) — visually the field is still drawn in
  // the sidebar to keep the on-screen layout simple.
  setSplitSearchable: (rootId, placement) => undoable(set, get, (s) => {
    const root = s.items.find((it) => it.id === rootId)
    if (!root || !root.splitStyle) return s
    const sidebar = s.items.find(
      (it) => it.parentId === root.id && it.type === 'stack' && it.name === 'Sidebar'
    )
    if (!sidebar) return s
    const existing = s.items.find(
      (it) => it.parentId === sidebar.id && it.type === 'panel' && it.panelType === 'search'
    )
    // Toggle off → drop the search panel, update the root flag.
    if (placement === 'none') {
      return {
        items: s.items
          .filter((it) => !(existing && it.id === existing.id))
          .map((it) => (it.id === root.id ? { ...it, searchable: 'none' } : it))
      }
    }
    // Toggle on → ensure a search panel exists as the first sidebar child.
    const nextItems = existing
      ? s.items
      : (() => {
          const search = makePanel('search', {
            parentId: sidebar.id,
            name: 'Search',
            text: root.searchPrompt || 'Search',
            widthMode: 'fill',
            size: [ptToUnits(sidebar.fixedWidth ? sidebar.fixedWidth - 32 : 288), ptToUnits(36)]
          })
          // Put the search panel immediately after the sidebar so it renders
          // as the first child visually (layout is insertion-order driven).
          const sidebarIdx = s.items.findIndex((it) => it.id === sidebar.id)
          const before = s.items.slice(0, sidebarIdx + 1)
          const after  = s.items.slice(sidebarIdx + 1)
          return [...before, search, ...after]
        })()
    return {
      items: nextItems.map((it) =>
        it.id === root.id ? { ...it, searchable: placement } : it
      )
    }
  })
})
