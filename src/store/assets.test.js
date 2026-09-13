// Asset pipeline contract.
//
// Two rules this suite exists to hold:
//
//   1. Nothing in a saved project may point at a `blob:` URL. Those are
//      scoped to the page session, so they die on reload and mean
//      nothing to the SwiftUI exporter. Imported bytes are inlined as
//      base64 data URLs precisely so a project survives a restart.
//
//   2. `isLoadableMeshUrl` must accept what `importAssets` produces.
//      It previously only matched paths ending .glb/.gltf, so a data
//      URL from an imported mesh was rejected and every dropped GLB
//      fell through to the wireframe placeholder.

import { describe, it, expect } from 'vitest'
import { isLoadableMeshUrl, classifyFile, ASSET_LIMITS } from './assets'
import { panelDefaults } from '../panels/registry'
import { TEMPLATES } from '../templates'

// Stand-in for a browser File. `classifyFile` only reads name/type/size.
const file = (name, type = '', size = 1024) => ({ name, type, size })

describe('isLoadableMeshUrl', () => {
  it('accepts glTF paths, with or without query and hash', () => {
    expect(isLoadableMeshUrl('/models/demo-scene.glb')).toBe(true)
    expect(isLoadableMeshUrl('/models/demo.gltf')).toBe(true)
    expect(isLoadableMeshUrl('https://cdn.example.com/a.glb?v=2')).toBe(true)
    expect(isLoadableMeshUrl('/a.glb#node')).toBe(true)
    expect(isLoadableMeshUrl('/MODELS/DEMO.GLB')).toBe(true)
  })

  it('accepts the glTF data URLs importAssets produces', () => {
    // This is the case the old path-only check rejected.
    expect(isLoadableMeshUrl('data:model/gltf-binary;base64,Z2xURgIAAAA')).toBe(true)
    expect(isLoadableMeshUrl('data:model/gltf+json;base64,eyJhc3NldCI6e319')).toBe(true)
  })

  it('rejects formats the canvas has no loader for', () => {
    // Browsers cannot decode USDZ, and no OBJLoader is wired up. Both
    // fall through to the wireframe placeholder by design.
    expect(isLoadableMeshUrl('/models/thing.usdz')).toBe(false)
    expect(isLoadableMeshUrl('data:model/vnd.usdz+zip;base64,AAAA')).toBe(false)
    expect(isLoadableMeshUrl('/models/thing.obj')).toBe(false)
    expect(isLoadableMeshUrl('data:image/png;base64,AAAA')).toBe(false)
  })

  it('rejects empty and non-string input', () => {
    // '' is what meshDefaults('usdz') seeds, so this branch is hot.
    expect(isLoadableMeshUrl('')).toBe(false)
    expect(isLoadableMeshUrl(null)).toBe(false)
    expect(isLoadableMeshUrl(undefined)).toBe(false)
    expect(isLoadableMeshUrl(42)).toBe(false)
  })

  it('does not treat a bare bundle name as loadable', () => {
    // The inspector lets users type a bundle resource name for export;
    // the canvas cannot load one, so it must show the placeholder.
    expect(isLoadableMeshUrl('Earth')).toBe(false)
  })
})

describe('classifyFile', () => {
  it('routes images by mime type', () => {
    expect(classifyFile(file('shot.png', 'image/png'))).toEqual({
      assetType: 'image', mimeType: 'image/png'
    })
  })

  it('routes mesh formats by extension', () => {
    expect(classifyFile(file('a.glb')).assetType).toBe('mesh')
    expect(classifyFile(file('a.gltf')).assetType).toBe('mesh')
    expect(classifyFile(file('a.usdz')).assetType).toBe('mesh')
    expect(classifyFile(file('a.obj')).assetType).toBe('mesh')
  })

  it('is case-insensitive on the extension', () => {
    expect(classifyFile(file('A.GLB')).assetType).toBe('mesh')
  })

  it('rejects anything else', () => {
    expect(classifyFile(file('notes.txt', 'text/plain'))).toBe(null)
    expect(classifyFile(file('archive.zip'))).toBe(null)
  })

  it('pairs a loadable mime with a loadable data URL', () => {
    // classifyFile decides the mime that importAssets stamps onto the
    // data URL, so the two helpers have to agree about glTF.
    const { mimeType } = classifyFile(file('a.glb'))
    expect(isLoadableMeshUrl(`data:${mimeType};base64,AAAA`)).toBe(true)
  })
})

describe('no blob: URLs anywhere in project data', () => {
  it('image panels default to a null source, not a blob', () => {
    const d = panelDefaults('image')
    expect(d.imageUrl).toBe(null)
    expect('imageAssetId' in d).toBe(true)
  })

  it('no template ships a blob: or session-scoped URL', () => {
    for (const [key, t] of Object.entries(TEMPLATES)) {
      for (const item of t.build().items) {
        for (const field of ['imageUrl', 'usdzAsset', 'meshAsset', 'backgroundImage']) {
          const v = item[field]
          if (typeof v !== 'string') continue
          expect(v.startsWith('blob:'), `${key}/${item.name}.${field} is a blob URL`).toBe(false)
        }
      }
    }
  })

  it('caps imports so a project stays serialisable', () => {
    expect(ASSET_LIMITS.MAX_BYTES).toBe(25 * 1024 * 1024)
  })
})
