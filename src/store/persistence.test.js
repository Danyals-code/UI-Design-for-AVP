// Project persistence round-trip.
//
// The promise this suite holds is simple: whatever you had on screen when
// you saved is what you get back when you open. That covers the layers,
// the scene settings, the asset library, and the two module-scoped
// counters in factories.js that are not part of the store but would
// otherwise mint colliding ids on the next edit after a load.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  serializeProject, deserializeProject, ProjectLoadError,
  PROJECT_SCHEMA_VERSION
} from './persistence'
import {
  setIdCounter,
  setWindowGroupCounter,
  DEFAULT_SCENE
} from './factories'
import { TEMPLATES } from '../templates'

// A store-shaped object is all serializeProject reads.
function stateFor(templateKey) {
  const { items, activeTabId } = TEMPLATES[templateKey].build()
  return {
    items,
    activeTabId,
    scene: { ...DEFAULT_SCENE, sceneMode: TEMPLATES[templateKey].mode },
    assets: []
  }
}

const roundTrip = (state, opts) =>
  deserializeProject(JSON.parse(JSON.stringify(serializeProject(state, opts))))

describe('round-trip', () => {
  it('preserves every template exactly', () => {
    for (const key of Object.keys(TEMPLATES)) {
      const state = stateFor(key)
      const back = roundTrip(state)
      expect(back.items, `${key} lost items`).toEqual(state.items)
      expect(back.activeTabId, `${key} lost its active tab`).toBe(state.activeTabId)
      expect(back.scene.sceneMode, `${key} lost its scene mode`).toBe(state.scene.sceneMode)
    }
  })

  it('preserves asset records including their payloads', () => {
    const state = stateFor('welcome')
    state.assets = [
      { id: 'asset-1', kind: 'folder', name: 'Art', parentId: null },
      {
        id: 'asset-2', kind: 'asset', name: 'pixel.png', parentId: 'asset-1',
        assetType: 'image', mimeType: 'image/png', fileName: 'pixel.png',
        fileSize: 70, dataUrl: 'data:image/png;base64,AAAA', thumbnailUrl: 'data:image/png;base64,AAAA'
      }
    ]
    expect(roundTrip(state).assets).toEqual(state.assets)
  })

  it('preserves the project name', () => {
    // Without this the Topbar showed "Untitled" after every restore, even
    // for a project the user had named.
    const state = { ...stateFor('welcome'), projectName: 'Thesis Demo' }
    expect(roundTrip(state).projectName).toBe('Thesis Demo')
  })

  it('falls back to Untitled when a file carries no name', () => {
    const saved = serializeProject(stateFor('welcome'))
    delete saved.projectName
    expect(deserializeProject(saved).projectName).toBe('Untitled')
  })

  it('survives JSON, so nothing depends on a live object reference', () => {
    const state = stateFor('browse')
    const text = JSON.stringify(serializeProject(state))
    expect(() => JSON.parse(text)).not.toThrow()
    expect(deserializeProject(JSON.parse(text)).items.length).toBe(state.items.length)
  })
})

describe('id counters', () => {
  beforeEach(() => {
    setIdCounter(1)
    setWindowGroupCounter(1)
  })

  it('captures and restores both counters', () => {
    // Build first: constructing a template mints ids, which advances the
    // counters. Setting them afterwards is what pins the values we assert.
    const state = stateFor('welcome')
    setIdCounter(84)
    setWindowGroupCounter(7)
    const saved = serializeProject(state)
    expect(saved.idCounter).toBe(84)
    expect(saved.windowGroupCounter).toBe(7)

    setIdCounter(1)
    setWindowGroupCounter(1)
    const back = deserializeProject(JSON.parse(JSON.stringify(saved)))
    expect(back.idCounter).toBe(84)
    expect(back.windowGroupCounter).toBe(7)
  })

  it('derives a safe floor when a file predates counter capture', () => {
    // Without this, opening an older file and adding one panel would mint
    // an id that already exists in the document.
    const state = stateFor('welcome')
    state.items = [
      ...state.items,
      { id: 'panel-97', type: 'panel', panelType: 'text', parentId: null, windowGroupId: 'Window12' }
    ]
    const payload = JSON.parse(JSON.stringify(serializeProject(state)))
    delete payload.idCounter
    delete payload.windowGroupCounter

    const back = deserializeProject(payload)
    expect(back.idCounter).toBeGreaterThan(97)
    expect(back.windowGroupCounter).toBeGreaterThan(12)
  })
})

describe('degraded autosave', () => {
  it('keeps folders but drops payloads when assets are excluded', () => {
    const state = stateFor('welcome')
    state.assets = [
      { id: 'f1', kind: 'folder', name: 'Art', parentId: null },
      { id: 'a1', kind: 'asset', name: 'big.png', parentId: 'f1', dataUrl: 'data:image/png;base64,AAAA' }
    ]
    const saved = serializeProject(state, { includeAssets: false })
    expect(saved.assetsOmitted).toBe(true)
    expect(saved.assets).toHaveLength(1)
    expect(saved.assets[0].kind).toBe('folder')

    // The flag survives the trip so the UI can tell the user their images
    // are not in the autosave.
    expect(deserializeProject(JSON.parse(JSON.stringify(saved))).assetsOmitted).toBe(true)
  })
})

describe('rejecting bad input', () => {
  const rejects = (payload, match) => {
    expect(() => deserializeProject(payload)).toThrow(ProjectLoadError)
    if (match) expect(() => deserializeProject(payload)).toThrow(match)
  }

  it('rejects non-objects and foreign JSON', () => {
    rejects(null)
    rejects('nope')
    rejects({ hello: 'world' }, /not a visionOS Designer project/)
  })

  it('rejects a file from a newer app version', () => {
    const saved = serializeProject(stateFor('welcome'))
    rejects({ ...saved, version: PROJECT_SCHEMA_VERSION + 1 }, /newer version/)
  })

  it('rejects a structurally empty project', () => {
    const saved = serializeProject(stateFor('welcome'))
    rejects({ ...saved, items: [] }, /no layers/)
    rejects({ ...saved, items: saved.items.filter((i) => i.type !== 'tab') }, /missing its tab structure/)
  })

  it('repairs an activeTabId that points nowhere instead of throwing', () => {
    // A dangling tab id would render an empty canvas, which reads as data
    // loss even though every layer is intact.
    const saved = serializeProject(stateFor('welcome'))
    const back = deserializeProject({ ...saved, activeTabId: 'tab-does-not-exist' })
    expect(back.items.some((it) => it.id === back.activeTabId && it.type === 'tab')).toBe(true)
  })

  it('fills in scene defaults a file is missing', () => {
    const saved = serializeProject(stateFor('welcome'))
    const back = deserializeProject({ ...saved, scene: { sceneMode: 'window' } })
    expect(back.scene.colors).toBeDefined()
    expect(back.scene.ambientLightIntensity).toBe(DEFAULT_SCENE.ambientLightIntensity)
  })
})

// A project saved before `destructive` was removed from BUTTON_STYLES still
// carries `buttonStyle: 'destructive'`. Exporting that produced
// `.buttonStyle(.destructive)`, which is not a SwiftUI ButtonStyle and does
// not compile. The designer meant the destructive ROLE, so that is where the
// loader puts it — the inspector then shows a value that still exists.
describe('migrating a pre-buttonRole project', () => {
  const projectWith = (button) => ({
    format: 'visionos-designer-project',
    version: PROJECT_SCHEMA_VERSION,
    items: [
      { id: 'tab-1', type: 'tab', name: 'Main', parentId: null, visible: true },
      { id: 'win-1', type: 'window', name: 'W', parentId: 'tab-1', visible: true },
      { id: 'btn-1', type: 'panel', panelType: 'button', name: 'Delete',
        parentId: 'win-1', visible: true, ...button }
    ],
    activeTabId: 'tab-1',
    scene: {},
    assets: []
  })

  const buttonFrom = (raw) =>
    deserializeProject(raw).items.find((it) => it.id === 'btn-1')

  it('moves the old style value onto buttonRole', () => {
    const btn = buttonFrom(projectWith({ buttonStyle: 'destructive' }))
    expect(btn.buttonRole).toBe('destructive')
    expect(btn.buttonStyle).toBe('automatic')
  })

  it('keeps a role the project already had', () => {
    const btn = buttonFrom(projectWith({ buttonStyle: 'destructive', buttonRole: 'cancel' }))
    expect(btn.buttonRole).toBe('cancel')
    expect(btn.buttonStyle).toBe('automatic')
  })

  it('leaves every other button untouched', () => {
    const btn = buttonFrom(projectWith({ buttonStyle: 'borderedProminent' }))
    expect(btn.buttonStyle).toBe('borderedProminent')
    expect(btn.buttonRole).toBeUndefined()
  })

  it('does not disturb a project that has nothing to migrate', () => {
    const raw = projectWith({ buttonStyle: 'plain' })
    const before = JSON.stringify(raw.items)
    deserializeProject(raw)
    expect(JSON.stringify(raw.items)).toBe(before)
  })
})

// ---------------------------------------------------------------------------
// The `styles` bag (AUDIT #31)
//
// Control size used to live in two places: the top-level `controlSize` phase
// 2.3 settled buttons on, and a copy inside `styles` that only the toggle
// emitter read. The copy is gone; projects saved before that carry it, so it
// is lifted onto the field that survived.
// ---------------------------------------------------------------------------
describe('the styles bag migration', () => {
  // Build a real saved file, then splice the legacy panel into it, so the
  // migration is exercised through the same door a user's project comes in.
  const load = (panel) => {
    const saved = serializeProject(stateFor('welcome'))
    const tab = saved.items.find((i) => i.type === 'tab')
    const back = deserializeProject({ ...saved, items: [...saved.items, { ...panel, parentId: tab.id }] })
    return back.items.find((i) => i.id === panel.id)
  }

  it('lifts a legacy styles.controlSize onto the top-level field', () => {
    const out = load({ id: 'p1', type: 'panel', panelType: 'toggle', name: 'T', styles: { controlSize: 'large' } })
    expect(out.controlSize).toBe('large')
    expect(out.styles.controlSize).toBeUndefined()
  })

  it('keeps the top-level value when a project set both', () => {
    // The button path was already reading the top-level one, so it wins.
    const out = load({
      id: 'p2', type: 'panel', panelType: 'button', name: 'B',
      controlSize: 'small', styles: { controlSize: 'large' }
    })
    expect(out.controlSize).toBe('small')
    expect(out.styles.controlSize).toBeUndefined()
  })

  it('leaves the three surviving style fields alone', () => {
    const out = load({
      id: 'p3', type: 'panel', panelType: 'label', name: 'L',
      styles: { labelStyle: 'iconOnly', toggleStyle: 'button', textFieldStyle: 'plain' }
    })
    expect(out.styles).toEqual({ labelStyle: 'iconOnly', toggleStyle: 'button', textFieldStyle: 'plain' })
  })

  it('touches nothing when there is no legacy copy', () => {
    const panel = { id: 'p4', type: 'panel', panelType: 'toggle', name: 'T', controlSize: 'regular' }
    const out = load(panel)
    expect(out.controlSize).toBe('regular')
    expect(out.styles).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// The Label glyph migration (AUDIT #34)
//
// A Label's glyph was stored twice: `symbolName`, which the canvas drew, and
// `iconName`, which only the exporter read and only as a fallback. The dead
// one is gone; projects saved before that carry it, so it is lifted onto the
// field that survived.
// ---------------------------------------------------------------------------
describe('the Label glyph migration', () => {
  const load = (panel) => {
    const saved = serializeProject(stateFor('welcome'))
    const tab = saved.items.find((i) => i.type === 'tab')
    const back = deserializeProject({ ...saved, items: [...saved.items, { ...panel, parentId: tab.id }] })
    return back.items.find((i) => i.id === panel.id)
  }
  const label = (extra) => ({ id: 'l1', type: 'panel', panelType: 'label', name: 'L', ...extra })

  it('lifts a legacy iconName onto symbolName', () => {
    const out = load(label({ iconName: 'wifi' }))
    expect(out.symbolName).toBe('wifi')
    expect(out.iconName).toBeUndefined()
  })

  it('keeps the glyph the canvas was already drawing when both are set', () => {
    // `symbolName` is what was on screen, so it wins — the same rule the
    // controlSize migration follows.
    const out = load(label({ iconName: 'wifi', symbolName: 'bolt.fill' }))
    expect(out.symbolName).toBe('bolt.fill')
    expect(out.iconName).toBeUndefined()
  })

  it('drops the dead field even when it has nowhere to go', () => {
    expect(load(label({ iconName: 'star', symbolName: 'star' })).iconName).toBeUndefined()
  })

  it('leaves a panel that never had one alone', () => {
    const out = load(label({ symbolName: 'gear' }))
    expect(out.symbolName).toBe('gear')
    expect(out.iconName).toBeUndefined()
  })

  it('does not invent a glyph for a panel with neither', () => {
    expect(load(label({})).symbolName).toBeUndefined()
  })
})
