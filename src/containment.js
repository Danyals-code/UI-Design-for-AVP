// SwiftUI containment rules — visionOS spec §1.27 + §3.10.
//
// SwiftUI restricts where certain views and modifiers may appear. The rules
// here mirror Apple's docs verbatim so the inspector can warn the designer
// (and a future Step 3b can use the same table to gate drag-drop). Rules
// are intentionally non-blocking right now: violations surface as a yellow
// warning chip in the SceneTree row and an inline note in the inspector,
// but the designer can still author the invalid hierarchy if they want.
//
// Each entry is keyed by the *child* item shape (panel.panelType or
// stack.stackType) and lists the parent shapes that legally contain it.
// Special parent tokens:
//   '*'         — any parent (default; usually omitted)
//   'list'      — any panel with panelType='list'
//   'form'      — panelType='form'
//   'picker'    — panelType='picker'/'datepicker'/'colorpicker'
//   'menu'      — panelType='menu'
//   'tabView'   — stack with stackType='tabView'
//   'navigationStack' — stack with stackType='navigationStack'
//   'grid'      — stackType='grid' / 'lazyVGrid' / 'lazyHGrid'
//   'table'     — panelType='table'
//   'window'    — type='window'
//   'toolbar'   — *not yet a node* (Step 3b); included for completeness

export const CONTAINMENT = {
  // Stack-typed children
  section:          ['list', 'form', 'picker', 'menu', 'tabView'],
  tab:              ['tabView'],
  // Toolbar items are only valid inside a `.toolbar { ... }` builder;
  // we model that as the 'toolbar' stackType.
  toolbarItem:      ['toolbar'],
  toolbarItemGroup: ['toolbar']
}

// Identifies a "shape" string for an item — what containment cares about.
// Returns one of: 'list', 'form', 'picker', 'menu', 'tabView', 'window',
// 'navigationStack', 'grid', 'table', or null when no rule applies.
export function shapeOf(item) {
  if (!item) return null
  if (item.type === 'window') return 'window'
  if (item.type === 'stack') {
    if (item.stackType === 'tabView') return 'tabView'
    if (item.stackType === 'navigationStack') return 'navigationStack'
    if (item.stackType === 'toolbar') return 'toolbar'
    if (item.stackType === 'grid' || item.stackType === 'lazyVGrid' || item.stackType === 'lazyHGrid') return 'grid'
    return null   // generic stacks impose no restriction on children
  }
  if (item.type === 'panel') {
    const t = item.panelType
    if (t === 'list') return 'list'
    if (t === 'form') return 'form'
    if (t === 'picker' || t === 'datepicker' || t === 'colorpicker') return 'picker'
    if (t === 'menu') return 'menu'
    if (t === 'table') return 'table'
  }
  return null
}

// childKey is the rules key — preferring stackType for stacks, panelType for
// panels. Mirrors the keys in CONTAINMENT above.
function childKey(item) {
  if (!item) return null
  if (item.type === 'stack') return item.stackType
  if (item.type === 'panel') return item.panelType
  return null
}

// Returns null when the placement is legal, or a warning string explaining
// the violation. Caller decides whether to block, warn, or ignore.
export function validateContainment(child, parent) {
  const key = childKey(child)
  if (!key) return null
  const allowed = CONTAINMENT[key]
  if (!allowed) return null
  const parentShape = shapeOf(parent)
  if (parentShape && allowed.includes(parentShape)) return null
  // Build a friendly explanation referencing SwiftUI's docs.
  const niceAllowed = allowed.map((p) => `'${p}'`).join(', ')
  return `'${key}' is only valid inside ${niceAllowed} (SwiftUI §1.27). It will export but may not compile.`
}
