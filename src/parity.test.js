// Canvas ↔ export parity.
//
// The app has two renderers for one document. `components/` draws it with
// three.js; `export/` writes it as SwiftUI. Both read the same store, and
// nothing has ever checked that they read the SAME PARTS of it. They have
// drifted apart in ~120 places: fields the canvas honours and the exporter
// drops (a 640 pt column that exports as intrinsic width), modifiers that
// emit correct Swift and draw nothing (`.background`, `.overlay`), and
// fields the inspector writes that neither side reads at all.
//
// This file is the contract. It does not reimplement either side — it asks,
// of the live source, which fields each side actually mentions, and requires
// every asymmetry to be declared in `parity.baseline.js` with a tier and a
// reason. That gives two properties worth having:
//
//   • a new field wired into one side only fails here immediately
//   • a divergence that gets closed fails here until its entry is deleted,
//     so the ledger cannot claim debt that no longer exists
//
// The field scan is a coverage heuristic, not a proof: it asks whether a
// side's source contains `.someField`, which can say "wired" about a field
// that is read and then ignored. It errs toward leniency on purpose — the
// failures it does produce are real, and it has no false alarms to train
// anyone to skip. Everything else here (modifier visibility, enum validity,
// ScrollView emission, containment) runs the real code and is exact.
//
// Companion doc: AUDIT.md, whose §8 defect index the baseline references.

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import {
  STACK, WINDOW, PANEL, MODIFIER_VISIBILITY, KNOWN_INVALID_EMISSIONS,
  KNOWN_MISSING_SCROLLVIEWS, DEBT_CEILING, EXEMPT, DEBT, MIRROR
} from './parity.baseline'
import { makeTab, makeWindow, makeStack, makePanel } from './store/factories'
import {
  BUTTON_STYLES, BUTTON_BORDER_SHAPES, LIST_STYLES, TABLE_STYLES, MENU_STYLES,
  PROGRESS_VIEW_STYLES, GAUGE_STYLES, PICKER_STYLES, DATE_PICKER_STYLES,
  FORM_STYLES, GROUP_BOX_STYLES, TOGGLE_STYLES, LABEL_STYLES,
  TEXTFIELD_STYLES, CONTROL_SIZES
} from './appleSystem'
import { panelTypes } from './panels/registry'
import { MODIFIERS, makeModifier } from './modifiers/registry'
import { exportSwiftUI } from './export/swiftui'
import { computeSize } from './layout'
import { TEMPLATES } from './templates'
import { unitsToPt } from './appleSystem'

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8')

// The two sides, as source text.
//
// Shared token modules (appleSystem.js) sit deliberately in neither set:
// both sides import them, so counting them would report every token as
// wired to both. The store is excluded for the same reason — it is the
// document, not a reader of it. The inspector is excluded because it is a
// third surface; a field only IT reads shows up here as read by neither,
// which is exactly how dead controls surface.
const CANVAS = [
  './components/Panel3D.jsx',
  './components/SceneTree.jsx',
  './components/Entity3D.jsx',
  './layout.js',
  './text.js',
  // Renderer-side resolution that happens to live in the store folder:
  // `resolveHoverEffect` walks up to the owning window for its
  // `spatial.hoverEffect` default and is imported by Panel3D alone. Without
  // it the scan reported `spatial` as export-only the moment the exporter
  // started emitting `.windowResizability` — which would have been false,
  // and would have had someone 'fix' a field the canvas already honours.
  './store/helpers.js'
].map(read).join('\n')

const EXPORT = [
  './export/swiftui.js',
  './export/realitykit.js',
  './export/behaviors.js',
  './panels/registry.js',
  './modifiers/registry.js'
].map(read).join('\n')

// Identity and structure — carried by every node, meaningful to neither
// renderer as a visual property.
const IDENTITY = new Set(['id', 'type', 'name', 'parentId', 'visible', 'panelType', 'modifiers'])

const readsField = (src, field) => src.includes('.' + field)

// Fields read by exactly one side, sorted.
function asymmetricFields(fields) {
  return [...new Set(fields)]
    .filter((f) => !IDENTITY.has(f))
    .filter((f) => readsField(CANVAS, f) !== readsField(EXPORT, f) ||
                   (!readsField(CANVAS, f) && !readsField(EXPORT, f)))
    .sort()
}

// Render a set difference as something a maintainer can act on.
function explain(missing, stale, ledgerName) {
  const parts = []
  if (missing.length) {
    parts.push(
      `${missing.length} divergence(s) not declared in ${ledgerName}:\n` +
      missing.map((f) => `    ${f}`).join('\n') +
      `\n  Either wire the missing side, or add an entry saying why it stays one-sided.`
    )
  }
  if (stale.length) {
    parts.push(
      `${stale.length} stale entr(y/ies) in ${ledgerName} — these now agree, ` +
      `so delete them (and lower DEBT_CEILING):\n` +
      stale.map((f) => `    ${f}`).join('\n')
    )
  }
  return '\n  ' + parts.join('\n\n  ')
}

function checkLedger(fields, ledger, ledgerName) {
  const actual = asymmetricFields(fields)
  const declared = Object.keys(ledger)
  const missing = actual.filter((f) => !declared.includes(f))
  const stale = declared.filter((f) => !actual.includes(f))
  expect(missing.length + stale.length, explain(missing, stale, ledgerName)).toBe(0)
}

const allPanelFields = () => {
  const out = new Set()
  for (const t of panelTypes()) for (const k of Object.keys(makePanel(t))) out.add(k)
  return [...out]
}

describe('field parity', () => {
  it('every stack divergence is declared', () => {
    checkLedger(Object.keys(makeStack()), STACK, 'parity.baseline.js → STACK')
  })

  it('every window divergence is declared', () => {
    checkLedger(Object.keys(makeWindow()), WINDOW, 'parity.baseline.js → WINDOW')
  })

  it('every panel divergence is declared', () => {
    checkLedger(allPanelFields(), PANEL, 'parity.baseline.js → PANEL')
  })

  it('every ledger entry carries a tier and a reason', () => {
    for (const [name, ledger] of [['STACK', STACK], ['WINDOW', WINDOW], ['PANEL', PANEL],
      ['MODIFIER_VISIBILITY', MODIFIER_VISIBILITY]]) {
      for (const [field, entry] of Object.entries(ledger)) {
        expect([EXEMPT, DEBT, MIRROR], `${name}.${field} has no valid tier`).toContain(entry.tier)
        expect(entry.why?.length, `${name}.${field} has no reason`).toBeGreaterThan(10)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Modifier visibility
//
// `summarizeModifiers` reduces the ordered modifier stack to a flat struct
// the renderer reads. A modifier is visible on the canvas only if at least
// one field it writes is a field a renderer reads. This runs the real
// summarize functions against a recording Proxy, so it is exact.
// ---------------------------------------------------------------------------

// The two accessor names the renderers bind the summary to. If either is
// renamed, this test fails loudly rather than silently reporting everything
// as invisible.
const SUMMARY_ACCESSORS = ['modSummary', 'mod']

// Force every declared argument to a non-null, truthy value so summarize
// functions that guard on `!= null` still write. Probing at defaults alone
// under-reports: `.frame()` writes only frameAlignment until a width is set.
const probeValue = (v) => {
  if (v === null || v === undefined) return 42
  if (typeof v === 'boolean') return true
  if (typeof v === 'number') return v || 42
  return v
}

function summaryWrites(type) {
  const seen = new Set()
  const run = (entry) => {
    const acc = new Proxy({ opacity: 1, scaleX: 1, scaleY: 1 }, {
      set(target, key, value) { seen.add(String(key)); target[key] = value; return true }
    })
    try { MODIFIERS[type].summarize?.(entry, acc) } catch { /* a throw is simply no write */ }
  }
  const base = makeModifier(type)
  run(base)
  const forced = { ...base }
  for (const k of Object.keys(MODIFIERS[type].defaults || {})) forced[k] = probeValue(base[k])
  run(forced)
  return [...seen]
}

const summaryFieldIsRead = (field) =>
  SUMMARY_ACCESSORS.some((a) => CANVAS.includes(`${a}.${field}`))

const invisibleModifiers = () =>
  Object.keys(MODIFIERS)
    .filter((type) => !summaryWrites(type).some(summaryFieldIsRead))
    .sort()

describe('modifier visibility', () => {
  it('the renderers still bind the modifier summary under a known name', () => {
    // Guards the scan above: if both accessors vanish, every modifier would
    // look invisible and the ledger check below would fail for the wrong
    // reason. Fail here instead, with the real cause.
    const bound = SUMMARY_ACCESSORS.filter((a) => CANVAS.includes(`${a}.`))
    expect(bound.length,
      `no renderer binds summarizeModifiers() as any of ${SUMMARY_ACCESSORS.join(', ')} — ` +
      'update SUMMARY_ACCESSORS to match the new name').toBeGreaterThan(0)
  })

  it('every modifier that draws nothing is declared', () => {
    const actual = invisibleModifiers()
    const declared = Object.keys(MODIFIER_VISIBILITY)
    const missing = actual.filter((m) => !declared.includes(m))
    const stale = declared.filter((m) => !actual.includes(m))
    expect(missing.length + stale.length,
      explain(missing, stale, 'parity.baseline.js → MODIFIER_VISIBILITY')).toBe(0)
  })

  it('every modifier emits Swift, whether or not it draws', () => {
    // The other half of the contract: a modifier may be invisible on the
    // canvas, but it may never be silently absent from the export.
    for (const type of Object.keys(MODIFIERS)) {
      expect(typeof MODIFIERS[type].emit, `modifier "${type}" has no emit()`).toBe('function')
    }
  })
})

// ---------------------------------------------------------------------------
// Emission sanity
//
// Structural validity is already covered by export/swiftui.test.js (braces
// balance, no line comment eats a line). This adds the check that would have
// caught `.buttonStyle(.destructive)`: that every bare enum case the exporter
// can produce is a case that exists in the real API.
// ---------------------------------------------------------------------------

// Valid cases per SwiftUI modifier, for the modifiers the exporter emits with
// a bare `.case` argument. Extend when the exporter learns a new one — an
// unlisted modifier is reported rather than skipped, so this cannot rot into
// a no-op.
const COLORS = ['red', 'orange', 'yellow', 'green', 'mint', 'teal', 'cyan', 'blue',
  'indigo', 'purple', 'pink', 'brown', 'white', 'gray', 'black', 'clear',
  'primary', 'secondary', 'tertiary', 'quaternary', 'accentColor']
const MATERIALS = ['ultraThinMaterial', 'thinMaterial', 'regularMaterial',
  'thickMaterial', 'ultraThickMaterial', 'bar']
const ALIGNMENTS = ['top', 'bottom', 'leading', 'trailing', 'center',
  'topLeading', 'topTrailing', 'bottomLeading', 'bottomTrailing']

const SWIFT_ENUMS = {
  background: [...MATERIALS, ...COLORS],
  fill: [...COLORS, ...MATERIALS],
  foregroundStyle: [...COLORS, ...MATERIALS],
  buttonStyle: ['automatic', 'plain', 'bordered', 'borderedProminent', 'borderless',
    'glass', 'glassProminent'],
  font: ['largeTitle', 'title', 'title2', 'title3', 'headline', 'subheadline', 'body',
    'callout', 'footnote', 'caption', 'caption2', 'extraLargeTitle', 'extraLargeTitle2'],
  fontWeight: ['ultraLight', 'thin', 'light', 'regular', 'medium', 'semibold', 'bold',
    'heavy', 'black'],
  weight: ['ultraLight', 'thin', 'light', 'regular', 'medium', 'semibold', 'bold',
    'heavy', 'black'],
  labelStyle: ['automatic', 'iconOnly', 'titleOnly', 'titleAndIcon'],
  listStyle: ['automatic', 'plain', 'inset', 'insetGrouped', 'grouped', 'sidebar'],
  multilineTextAlignment: ['leading', 'center', 'trailing'],
  padding: ['top', 'bottom', 'leading', 'trailing', 'horizontal', 'vertical', 'all'],
  pickerStyle: ['automatic', 'inline', 'menu', 'navigationLink', 'palette', 'segmented', 'wheel'],
  preferredColorScheme: ['light', 'dark'],
  scene: ALIGNMENTS,
  parent: ALIGNMENTS,
  submitLabel: ['done', 'go', 'send', 'join', 'route', 'search', 'return', 'next', 'continue'],
  symbolRenderingMode: ['monochrome', 'hierarchical', 'palette', 'multicolor'],
  tabViewStyle: ['automatic', 'page', 'tabBarOnly', 'sidebarAdaptable', 'grouped', 'verticalPage'],
  windowStyle: ['automatic', 'plain', 'volumetric', 'hsbVolumetric'],

  // Reached through the vocabulary sweep below rather than through any
  // template, so these carry the real weight of that check.
  buttonBorderShape: ['automatic', 'capsule', 'circle', 'roundedRectangle'],
  controlSize: ['mini', 'small', 'regular', 'large', 'extraLarge'],
  toggleStyle: ['automatic', 'switch', 'button'],
  tableStyle: ['automatic', 'inset', 'bordered'],
  menuStyle: ['automatic', 'button', 'borderlessButton', 'bordered'],
  menuOrder: ['automatic', 'priority', 'fixed'],
  menuIndicator: ['automatic', 'visible', 'hidden'],
  listRowSeparator: ['automatic', 'visible', 'hidden'],
  headerProminence: ['standard', 'increased'],
  progressViewStyle: ['automatic', 'linear', 'circular'],
  gaugeStyle: ['automatic', 'accessoryCircular', 'accessoryCircularCapacity',
    'accessoryLinear', 'accessoryLinearCapacity', 'linearCapacity'],
  datePickerStyle: ['automatic', 'compact', 'graphical', 'wheel', 'field', 'stepperField'],
  formStyle: ['automatic', 'columns', 'grouped'],
  groupBoxStyle: ['automatic'],
  textFieldStyle: ['automatic', 'plain', 'roundedBorder', 'squareBorder'],
  imageScale: ['small', 'medium', 'large'],
  textInputAutocapitalization: ['never', 'words', 'sentences', 'characters']
}

// ---------------------------------------------------------------------------
// Vocabulary sweep
//
// The `.buttonStyle(.destructive)` defect was not one bad value — it was a
// whole shape of bug. Roughly 30 modifiers are emitted verbatim as
// `.someModifier(.${someField})`, where the field's value comes from a
// vocabulary in `appleSystem.js` that the inspector renders as a dropdown.
// Nothing checked that those vocabularies only contain cases SwiftUI
// actually has, so any entry in any of them could emit a file that does not
// compile — and only the values a template happened to use were ever
// exercised.
//
// This sweep builds one panel per value of every appearance vocabulary, so
// the enum check above sees all of them, not just the defaults. `default` in
// LIST_STYLES was a second live instance, found by exactly this.
// ---------------------------------------------------------------------------

// Both vocabulary shapes in appleSystem.js: an object keyed by the emitted
// case, and an array of `{ value, label }`.
const valuesOf = (vocab) =>
  Array.isArray(vocab) ? vocab.map((v) => v.value) : Object.keys(vocab)

// panelType, the field the emitter reads, and the vocabulary behind it.
// `styles.` prefixes the fields that live in the shared styles bag.
const VOCABULARIES = [
  ['button', 'buttonStyle', BUTTON_STYLES],
  ['button', 'buttonBorderShape', BUTTON_BORDER_SHAPES],
  ['list', 'listStyle', LIST_STYLES],
  ['table', 'tableStyle', TABLE_STYLES],
  ['menu', 'menuStyle', MENU_STYLES],
  ['progress', 'progressViewStyle', PROGRESS_VIEW_STYLES],
  ['gauge', 'gaugeStyle', GAUGE_STYLES],
  ['picker', 'pickerStyle', PICKER_STYLES],
  ['datepicker', 'dateStyle', DATE_PICKER_STYLES],
  ['form', 'formStyle', FORM_STYLES],
  ['groupbox', 'groupBoxStyle', GROUP_BOX_STYLES],
  ['toggle', 'styles.toggleStyle', TOGGLE_STYLES],
  ['label', 'styles.labelStyle', LABEL_STYLES],
  ['textfield', 'styles.textFieldStyle', TEXTFIELD_STYLES],
  ['button', 'styles.controlSize', CONTROL_SIZES]
]

function vocabularySweepScene() {
  const tab = makeTab({ name: 'Vocab' })
  const win = makeWindow({ name: 'Vocab', parentId: tab.id })
  const panels = []
  for (const [panelType, field, vocab] of VOCABULARIES) {
    for (const value of valuesOf(vocab)) {
      const base = makePanel(panelType, { parentId: win.id })
      if (field.startsWith('styles.')) {
        const key = field.slice('styles.'.length)
        panels.push({ ...base, styles: { ...base.styles, [key]: value } })
      } else {
        panels.push({ ...base, [field]: value })
      }
    }
  }
  return [tab, win, ...panels]
}

// One window holding one panel of every registered type, so the scan covers
// emitters no template happens to exercise.
function everyPanelTypeScene() {
  const tab = makeTab({ name: 'All' })
  const win = makeWindow({ name: 'All', parentId: tab.id })
  return [tab, win, ...panelTypes().map((t) => makePanel(t, { parentId: win.id }))]
}

function allGeneratedSwift() {
  const chunks = [
    { key: 'every-panel-type', items: everyPanelTypeScene() },
    { key: 'vocabulary-sweep', items: vocabularySweepScene() }
  ]
  for (const [key, t] of Object.entries(TEMPLATES)) chunks.push({ key, items: t.build().items })
  return chunks.map(({ key, items }) => ({
    key,
    src: exportSwiftUI(items, 'App', {}).map((f) => f.content).join('\n')
  }))
}

describe('emission sanity', () => {
  it('every emitted enum case exists in the real API', () => {
    const bad = new Map()   // 'modifier(.case)' → Set(template)
    const unknown = new Set()
    for (const { key, src } of allGeneratedSwift()) {
      for (const m of src.matchAll(/\.([a-zA-Z][a-zA-Z0-9]*)\(\s*\.([a-zA-Z][a-zA-Z0-9]*)\s*[,)]/g)) {
        const [, modifier, enumCase] = m
        const valid = SWIFT_ENUMS[modifier]
        if (!valid) { unknown.add(modifier); continue }
        if (valid.includes(enumCase)) continue
        const sig = `${modifier}(.${enumCase})`
        if (!bad.has(sig)) bad.set(sig, new Set())
        bad.get(sig).add(key)
      }
    }

    expect([...unknown],
      'the exporter emits a bare enum case for a modifier SWIFT_ENUMS does not cover — ' +
      'add its valid cases so this check keeps its teeth').toEqual([])

    const declared = Object.keys(KNOWN_INVALID_EMISSIONS)
    const undeclared = [...bad.keys()].filter((s) => !declared.includes(s))
    const fixed = declared.filter((s) => !bad.has(s))

    expect(undeclared.map((s) => `${s}  (in: ${[...bad.get(s)].join(', ')})`),
      'the exporter emits an enum case that does not exist in SwiftUI — this will not compile')
      .toEqual([])
    expect(fixed,
      'KNOWN_INVALID_EMISSIONS lists an emission that no longer happens — delete the entry')
      .toEqual([])
  })

  it('a scrollable stack exports a real ScrollView', () => {
    const actual = {}
    for (const { key, src } of allGeneratedSwift()) {
      const n = src.split('// wrap in ScrollView').length - 1
      if (n > 0) actual[key] = n
    }
    expect(actual,
      'a stack marked scrollable emits a comment instead of a ScrollView, so the ' +
      'exported layout cannot scroll (AUDIT #3). Update KNOWN_MISSING_SCROLLVIEWS ' +
      'when this changes.')
      .toEqual(KNOWN_MISSING_SCROLLVIEWS)
  })
})

// ---------------------------------------------------------------------------
// Containment
//
// Overflow is legitimate exactly when the container scrolls. Anything else
// that exceeds its window is clipped on the canvas and clipped on device,
// with no way for the user to reach it.
//
// Scope, deliberately narrow so this never cries wolf: an axis the child
// FILLS is clamped to the window by the renderer, and `computeSize` reports
// the intrinsic extent rather than that clamp — for a split view whose detail
// pane fills, the intrinsic width is a phantom the renderer never draws. So
// filled axes are skipped and only explicit / hug sizing is checked.
//
// What this does not cover: content that overflows INSIDE a fill-sized
// container (the settings and article templates, AUDIT #4). That is a canvas
// scrolling bug, not a sizing one, and the export half of it is pinned by
// 'a scrollable stack exports a real ScrollView' above.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Presentation routing
//
// Five panel types attach to their PARENT as a modifier instead of flowing
// inside it. That list was hand-maintained in three places and two of them
// disagreed — the canvas knew about three types, the exporter about five — so
// a `confirmationdialog` sat inline on screen and presented modally in the
// code. The fix was a single set, and these two guard the property that makes
// it a fix rather than a patch: nobody keeps a private copy.
// ---------------------------------------------------------------------------
describe('presentation routing', () => {
  it('both sides ask the same function which views present', () => {
    for (const [name, src] of [['canvas', CANVAS], ['export', EXPORT]]) {
      expect(src.includes('isPresentationPanel'),
        `the ${name} side no longer consults isPresentationPanel — if the ` +
        'routing moved, point this test at the new seam rather than deleting it'
      ).toBe(true)
    }
  })

  it('neither side keeps its own copy of the list', () => {
    // The original bug in one regex: an inline array or Set carrying the
    // presentation vocabulary, maintained by hand alongside the real one.
    const ownList = /\[[^\]]*'sheet'[^\]]*'alert'[^\]]*\]/
    for (const [name, src] of [['canvas', CANVAS], ['export', EXPORT]]) {
      expect(ownList.test(src),
        `the ${name} side declares its own presentation-type list; there is ` +
        'one set in appleSystem.js and a second copy is how these drifted apart'
      ).toBe(false)
    }
  })
})

describe('containment', () => {
  it('no non-scrollable content exceeds its window', () => {
    const overflows = []
    for (const [key, t] of Object.entries(TEMPLATES)) {
      const { items } = t.build()
      for (const win of items.filter((i) => i.type === 'window')) {
        if (win.scrollable) continue
        const [ww, wh] = win.size || [0, 0]
        for (const child of items.filter((c) => c.parentId === win.id)) {
          if (child.type !== 'stack' && child.type !== 'panel') continue
          if (child.scrollable) continue
          const [cw, ch] = computeSize(child, items)
          const wide = child.widthMode !== 'fill' && cw > ww + 1e-6
          const tall = child.heightMode !== 'fill' && ch > wh + 1e-6
          if (wide || tall) {
            overflows.push(
              `${key} / "${win.name}" ${Math.round(unitsToPt(ww))}×${Math.round(unitsToPt(wh))}pt ` +
              `← "${child.name}" ${Math.round(unitsToPt(cw))}×${Math.round(unitsToPt(ch))}pt` +
              ` (${wide ? 'too wide' : ''}${wide && tall ? ', ' : ''}${tall ? 'too tall' : ''})`
            )
          }
        }
      }
    }
    expect(overflows,
      'content larger than its window with nothing marked scrollable is unreachable ' +
      'in the canvas and clipped on device').toEqual([])
  })
})

// ---------------------------------------------------------------------------
// The ratchet
// ---------------------------------------------------------------------------

function debtInventory() {
  const rows = []
  const collect = (label, ledger) => {
    for (const [field, entry] of Object.entries(ledger)) {
      if (entry.tier === EXEMPT) continue
      rows.push({
        group: label,
        field,
        tier: entry.tier,
        defect: entry.defect ?? null,
        why: entry.why
      })
    }
  }
  collect('stack', STACK)
  collect('window', WINDOW)
  collect('panel', PANEL)
  collect('modifier', MODIFIER_VISIBILITY)
  collect('emission', KNOWN_INVALID_EMISSIONS)
  for (const [tpl, n] of Object.entries(KNOWN_MISSING_SCROLLVIEWS)) {
    rows.push({ group: 'scrollview', field: tpl, tier: DEBT, defect: 3, why: `${n} stack(s) emit a comment instead of a ScrollView` })
  }
  return rows
}

describe('parity debt', () => {
  it('never exceeds the ceiling', () => {
    const total = debtInventory().length
    expect(total,
      `parity debt rose to ${total}, above the ceiling of ${DEBT_CEILING}. ` +
      'Wire the new field into both sides rather than raising the ceiling.')
      .toBeLessThanOrEqual(DEBT_CEILING)
  })

  it('keeps the ceiling tight', () => {
    const total = debtInventory().length
    // Not a failure — closing debt should never break the build. But the
    // ceiling has to come down with it, or it stops ratcheting.
    if (total < DEBT_CEILING) {
      console.warn(
        `\n  parity debt is ${total}, ceiling is ${DEBT_CEILING}. ` +
        `Lower DEBT_CEILING to ${total} in src/parity.baseline.js to lock the gain in.\n`
      )
    }
    expect(total).toBeLessThanOrEqual(DEBT_CEILING)
  })

  it('prints the inventory', () => {
    const rows = debtInventory()
    const byDefect = new Map()
    for (const r of rows) {
      const k = r.defect ? `AUDIT #${r.defect}` : 'unfiled'
      byDefect.set(k, (byDefect.get(k) || 0) + 1)
    }
    const lines = [
      '',
      `  parity debt: ${rows.length} open (ceiling ${DEBT_CEILING})`,
      `    ${rows.filter((r) => r.tier === DEBT).length} divergences, ` +
      `${rows.filter((r) => r.tier === MIRROR).length} duplicate sources of truth`,
      '',
      ...[...byDefect].sort((a, b) => b[1] - a[1]).map(([k, n]) => `    ${String(n).padStart(3)}  ${k}`),
      ''
    ]
    console.log(lines.join('\n'))
    expect(rows.length).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// The styles bag (AUDIT #31)
//
// The ledger keys this bag as one field, so a single surviving read keeps it
// looking symmetric while the others quietly stop drawing. That is how these
// three got to export-only in the first place. Check each by name.
// ---------------------------------------------------------------------------
describe('per-control style fields', () => {
  const BAG = ['toggleStyle', 'labelStyle', 'textFieldStyle']
  // Match the READ, not the name: `styles?.labelStyle`. The bare name appears
  // in the comments beside each of these, so a looser check passes on prose
  // while the code that used to do the reading is gone — which is exactly
  // what happened the first time this test was written.
  const reads = (src, key) => src.includes(`styles?.${key}`) || src.includes(`styles.${key}`)

  it('the canvas reads every field the bag still carries', () => {
    for (const key of BAG) {
      expect(
        reads(CANVAS, key),
        `the canvas no longer reads styles.${key} — the ledger keys the whole ` +
        'bag as one field, so a surviving read of its siblings hides this'
      ).toBe(true)
    }
  })

  it('and the export still emits each of them', () => {
    for (const key of BAG) {
      expect(reads(EXPORT, key), `the export no longer emits styles.${key}`).toBe(true)
    }
  })
})
