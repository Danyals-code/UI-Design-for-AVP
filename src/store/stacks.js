// Stacks: generic add-stack and the in-window TabView wizard. Window-attached
// chrome (toolbars, NavigationSplitView, tab-bar ornaments) lives in
// `windows.js`.

import { undoable } from './undo'
import { makeStack } from './factories'

export const createStacksSlice = (set, get) => ({
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
      stackType: 'tabView',
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
  })
})
