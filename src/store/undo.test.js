// Undo / redo invariants, exercised against the real composed store.
//
// The asset cases exist because the library used to sit outside history:
// importing, renaming or deleting an asset was the only edit in the app
// that Cmd-Z would not reverse.

import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './index'
import { buildTemplate } from '../templates'

// Reset to a known document between tests. Going through the store's own
// action keeps this honest — no hand-built state the app never produces.
beforeEach(() => {
  const seed = buildTemplate('blank')
  useStore.setState({
    items: seed.items,
    activeTabId: seed.activeTabId,
    assets: [],
    selectedId: null,
    editingId: null,
    isDragging: false,
    // The clipboard survives across actions by design, so it has to be reset
    // here or one test's copy leaks into the next test's paste.
    clipboard: null,
    _past: [],
    _future: []
  })
})

const s = () => useStore.getState()

describe('item history', () => {
  it('undoes and redoes an add', () => {
    const before = s().items.length
    s().addPanel('text')
    expect(s().items.length).toBe(before + 1)

    s().undo()
    expect(s().items.length).toBe(before)

    s().redo()
    expect(s().items.length).toBe(before + 1)
  })

  it('restores the id counter so a redo cannot mint a duplicate id', () => {
    s().addPanel('text')
    s().undo()
    s().addPanel('button')
    const ids = s().items.map((it) => it.id)
    expect(new Set(ids).size, 'duplicate ids after undo + add').toBe(ids.length)
  })

  it('cascades a delete to descendants and restores them together', () => {
    const stack = s().items.find((it) => it.type === 'stack')
    s().select(stack.id)
    s().addPanel('text')
    s().addPanel('button')
    const withChildren = s().items.length

    s().removeItem(stack.id)
    expect(s().items.some((it) => it.parentId === stack.id)).toBe(false)

    s().undo()
    expect(s().items.length).toBe(withChildren)
  })

  it('keeps at least one tab in the document', () => {
    const tab = s().items.find((it) => it.type === 'tab')
    s().removeItem(tab.id)
    expect(s().items.filter((it) => it.type === 'tab').length).toBe(1)
  })
})

describe('copy and paste', () => {
  // Paste has to produce a subtree that is structurally identical but shares
  // no ids with the original, and names have to stay unique within the tab -
  // both are invariants the rest of the app leans on (findEntity by name, and
  // id-keyed lookups everywhere).
  const buildStackWithChildren = () => {
    const win = s().items.find((it) => it.type === 'window')
    const stack = s().items.find((it) => it.type === 'stack')
    s().select(stack.id)
    s().addPanel('text')
    s().addPanel('button')
    return { win, stack }
  }

  it('copies a whole subtree, not just the root', () => {
    const { stack } = buildStackWithChildren()
    const before = s().items.length
    s().copyItem(stack.id)
    s().pasteItem()
    // Stack + its two children came across.
    expect(s().items.length).toBe(before + 3)
  })

  it('gives every pasted item a fresh id', () => {
    const { stack } = buildStackWithChildren()
    s().copyItem(stack.id)
    s().pasteItem()
    const ids = s().items.map((it) => it.id)
    expect(new Set(ids).size, 'paste produced a duplicate id').toBe(ids.length)
  })

  it('rewires pasted children to the pasted parent, not the original', () => {
    const { stack } = buildStackWithChildren()
    s().copyItem(stack.id)
    s().pasteItem()
    const newRootId = s().selectedId
    const originalChildIds = new Set(
      s().items.filter((it) => it.parentId === stack.id).map((it) => it.id)
    )
    const pastedChildren = s().items.filter((it) => it.parentId === newRootId)
    expect(pastedChildren.length).toBe(2)
    for (const c of pastedChildren) {
      expect(originalChildIds.has(c.id), 'a pasted child points at the original parent').toBe(false)
    }
  })

  it('suffixes colliding names within the tab', () => {
    const { stack } = buildStackWithChildren()
    s().renameItem(stack.id, 'Panel Group')
    s().copyItem(stack.id)
    s().pasteItem()
    const names = s().items.filter((it) => it.name?.startsWith('Panel Group')).map((it) => it.name)
    expect(names).toContain('Panel Group')
    expect(names.some((n) => /\.copy\d*$/.test(n)), `no .copy suffix in ${names.join(', ')}`).toBe(true)
  })

  it('keeps suffixing on repeated pastes instead of colliding', () => {
    const { stack } = buildStackWithChildren()
    s().renameItem(stack.id, 'Card')
    s().copyItem(stack.id)
    s().pasteItem()
    s().pasteItem()
    s().pasteItem()
    const names = s().items.filter((it) => it.name?.startsWith('Card')).map((it) => it.name)
    expect(new Set(names).size, `duplicate names: ${names.join(', ')}`).toBe(names.length)
  })

  it('is undoable as one step', () => {
    const { stack } = buildStackWithChildren()
    const before = s().items.length
    s().copyItem(stack.id)
    s().pasteItem()
    expect(s().items.length).toBeGreaterThan(before)
    s().undo()
    expect(s().items.length).toBe(before)
  })

  it('refuses to copy a window or a tab', () => {
    // Those are structural roots; duplicating one via the clipboard would
    // bypass the tab/window invariants the dedicated actions maintain.
    const win = s().items.find((it) => it.type === 'window')
    const tab = s().items.find((it) => it.type === 'tab')
    s().copyItem(win.id)
    expect(s().clipboard).toBe(null)
    s().copyItem(tab.id)
    expect(s().clipboard).toBe(null)
  })

  it('does nothing when the clipboard is empty', () => {
    const before = s().items.length
    s().pasteItem()
    expect(s().items.length).toBe(before)
  })
})

describe('assets are part of history', () => {
  const asset = (id, name) => ({
    id, kind: 'asset', name, parentId: null,
    assetType: 'image', mimeType: 'image/png',
    fileName: name, fileSize: 4, dataUrl: 'data:image/png;base64,AAAA'
  })

  it('undoes a folder create', () => {
    s().createAssetFolder('Textures')
    expect(s().assets).toHaveLength(1)

    s().undo()
    expect(s().assets).toHaveLength(0)

    s().redo()
    expect(s().assets).toHaveLength(1)
  })

  it('undoes a rename', () => {
    useStore.setState({ assets: [asset('a1', 'old.png')] })
    s().renameAsset('a1', 'new.png')
    expect(s().assets[0].name).toBe('new.png')

    s().undo()
    expect(s().assets[0].name).toBe('old.png')
  })

  it('undoes a delete, payload intact', () => {
    useStore.setState({ assets: [asset('a1', 'pixel.png')] })
    s().deleteAsset('a1')
    expect(s().assets).toHaveLength(0)

    s().undo()
    expect(s().assets).toHaveLength(1)
    expect(s().assets[0].dataUrl).toBe('data:image/png;base64,AAAA')
  })

  it('cascades a folder delete and restores the whole subtree', () => {
    useStore.setState({
      assets: [
        { id: 'f1', kind: 'folder', name: 'Art', parentId: null },
        { ...asset('a1', 'one.png'), parentId: 'f1' },
        { ...asset('a2', 'two.png'), parentId: 'f1' }
      ]
    })
    s().deleteAsset('f1')
    expect(s().assets).toHaveLength(0)

    s().undo()
    expect(s().assets).toHaveLength(3)
  })

  it('leaves transient drag state out of history', () => {
    // pendingDropAsset is UI state; undoing into a stale drag would leave
    // the canvas primed to spawn something the user never dropped.
    const past = s()._past.length
    s().setPendingDropAsset('a1')
    expect(s()._past.length).toBe(past)
    s().clearPendingDropAsset()
    expect(s()._past.length).toBe(past)
  })
})
