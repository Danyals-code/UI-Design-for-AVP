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
