// Project persistence — serialize, autosave, save to file, open from file.
//
// Everything a project needs lives in plain serialisable state already:
// `items` is one flat array of plain objects, `scene` is a flat settings
// bag, `assets` inlines its payloads as base64 data URLs. The only values
// that are NOT in the store are the two module-scoped counters in
// factories.js, so we capture and restore those explicitly — exactly as
// `undo` does, and for the same reason: reopening a file whose ids run to
// `panel-83` with the counter back at 1 would mint colliding ids on the
// next add.
//
// Two save paths, deliberately different:
//
//   • Autosave writes to localStorage on a debounce so a refresh or a
//     crash does not lose work. localStorage caps around 5 MB, and a
//     single imported asset may be up to 25 MB, so a project with media
//     can exceed quota. Rather than failing silently we retry without
//     `assets` and set `autosaveDegraded`, which the Topbar surfaces:
//     the layout is still recovered, and the user is told that images
//     need an explicit Save. Moving autosave to IndexedDB would lift
//     the cap and is the natural follow-up.
//
//   • Save to file writes the complete project, assets included, as
//     JSON the user owns.

import {
  getIdCounter, setIdCounter,
  getWindowGroupCounter, setWindowGroupCounter,
  seedScene, DEFAULT_SCENE
} from './factories'
import { buildTemplate } from '../templates'
import { normalizeButton } from '../appleSystem'

// Bump when a field changes shape in a way older files cannot satisfy, and
// add a branch to `migrate`. Additive fields do not need a bump: unknown
// keys are preserved and missing ones fall back to defaults.
export const PROJECT_SCHEMA_VERSION = 1

export const AUTOSAVE_KEY = 'visionos-designer:autosave-v1'
export const AUTOSAVE_DEBOUNCE_MS = 800

// ---- serialize / deserialize ----------------------------------------

// Snapshot the whole document. `includeAssets: false` drops asset payloads
// for the degraded autosave path; the folder rows are kept so the library
// tree survives even when the bytes do not.
export function serializeProject(state, { includeAssets = true } = {}) {
  const assets = includeAssets
    ? state.assets
    : (state.assets || []).filter((a) => a.kind === 'folder')
  return {
    format: 'visionos-designer-project',
    version: PROJECT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    assetsOmitted: !includeAssets,
    projectName: state.projectName || 'Untitled',
    idCounter: getIdCounter(),
    windowGroupCounter: getWindowGroupCounter(),
    activeTabId: state.activeTabId,
    items: state.items,
    scene: state.scene,
    assets
  }
}

// Bring an older payload up to the current shape.
//
// Migrations are keyed off content rather than a version bump when the old
// shape is unambiguously wrong: a project saved with
// `buttonStyle: 'destructive'` predates that value being removed from
// BUTTON_STYLES, and exporting it produced `.buttonStyle(.destructive)` —
// which is not a SwiftUI ButtonStyle and does not compile. The designer's
// intent was the destructive ROLE, so that is where it lands. Doing it on
// load (as well as in the emitter) means the inspector shows the corrected
// value rather than an option that no longer exists.
// Control size used to live in TWO places: the top-level `controlSize` that
// phase 2.3 settled buttons on, and a copy inside the `styles` bag that only
// the toggle emitter read. Phase 2.4-era projects can carry either, so the
// copy is lifted onto the field that survived — and only when the top-level
// one is still at its default, so a project that set both keeps the one the
// button path was already using. AUDIT #31.
function migrateStyles(it) {
  const legacy = it?.styles?.controlSize
  if (!legacy) return it
  const { controlSize: _drop, ...styles } = it.styles
  const next = { ...it, styles }
  if (!it.controlSize || it.controlSize === 'regular') next.controlSize = legacy
  return next
}

// A Label's glyph used to be stored twice: `symbolName`, which the canvas drew,
// and `iconName`, which only the exporter read and only when `symbolName` was
// missing. Projects saved before #34 can carry either, so the dead one is
// lifted onto the one that survived — and only when `symbolName` is unset, so
// a project that set both keeps the glyph it was already drawing. AUDIT #34.
function migrateLabelIcon(it) {
  if (!it?.iconName) return it
  const { iconName, ...rest } = it
  return rest.symbolName ? rest : { ...rest, symbolName: iconName }
}

function migrate(raw) {
  if (!Array.isArray(raw.items)) return raw
  let changed = false
  const items = raw.items.map((it) => {
    if (!it || it.type !== 'panel') return it
    let next = migrateLabelIcon(migrateStyles(it))
    if (it.panelType === 'button') next = normalizeButton(next)
    if (next !== it) changed = true
    return next
  })
  return changed ? { ...raw, items } : raw
}

export class ProjectLoadError extends Error {}

// Validate and normalise a parsed payload into the state patch the store
// applies. Throws ProjectLoadError with a message meant for the user.
export function deserializeProject(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new ProjectLoadError('That file is not a project file.')
  }
  if (raw.format !== 'visionos-designer-project') {
    throw new ProjectLoadError('That file is not a visionOS Designer project.')
  }
  if (typeof raw.version !== 'number' || raw.version > PROJECT_SCHEMA_VERSION) {
    throw new ProjectLoadError(
      `That project was saved by a newer version of the app (format ${raw.version}). Update, then open it again.`
    )
  }
  const data = migrate(raw)
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new ProjectLoadError('That project file has no layers in it.')
  }
  const tabs = data.items.filter((it) => it && it.type === 'tab')
  if (tabs.length === 0) {
    throw new ProjectLoadError('That project file is missing its tab structure.')
  }
  // An activeTabId pointing at a tab that is not in the file would render
  // an empty canvas, so fall back to the first real tab.
  const activeTabId = tabs.some((t) => t.id === data.activeTabId)
    ? data.activeTabId
    : tabs[0].id

  return {
    items: data.items,
    activeTabId,
    scene: { ...DEFAULT_SCENE, ...(data.scene || {}) },
    assets: Array.isArray(data.assets) ? data.assets : [],
    idCounter: Number.isFinite(data.idCounter) ? data.idCounter : highestIdSuffix(data.items) + 1,
    windowGroupCounter: Number.isFinite(data.windowGroupCounter)
      ? data.windowGroupCounter
      : highestWindowGroupNumber(data.items) + 1,
    assetsOmitted: !!data.assetsOmitted,
    projectName: typeof data.projectName === 'string' && data.projectName
      ? data.projectName
      : 'Untitled',
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : null
  }
}

// Recovery for files written before the counters were captured: derive a
// safe floor from the ids already in use so the next mint cannot collide.
function highestIdSuffix(items) {
  let max = 0
  for (const it of items) {
    const m = /-(\d+)$/.exec(String(it?.id || ''))
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max
}

function highestWindowGroupNumber(items) {
  let max = 0
  for (const it of items) {
    const m = /^Window(\d+)$/.exec(String(it?.windowGroupId || ''))
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max
}

// ---- slice -----------------------------------------------------------

export const PERSISTENCE_INITIAL_STATE = {
  // Filename shown in the Topbar and used as the download name.
  projectName: 'Untitled',
  // ISO timestamp of the last successful autosave, or null.
  lastSavedAt: null,
  // True when the last autosave had to drop asset payloads to fit quota.
  autosaveDegraded: false,
  // Transient user-facing message from the last open/save attempt.
  projectError: null
}

let autosaveTimer = null

export function createPersistenceSlice(set, get) {
  // Write the current project to localStorage. Falls back to an
  // assets-free payload on quota errors rather than losing the layout too.
  const writeAutosave = () => {
    const state = get()
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeProject(state)))
      set({ lastSavedAt: new Date().toISOString(), autosaveDegraded: false })
      return true
    } catch {
      try {
        localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify(serializeProject(state, { includeAssets: false }))
        )
        set({ lastSavedAt: new Date().toISOString(), autosaveDegraded: true })
        return true
      } catch {
        // Private-browsing or a full disk. Not fatal: the user can still
        // Save to a file.
        set({ autosaveDegraded: true })
        return false
      }
    }
  }

  const applyProject = (patch, { projectName } = {}) => {
    setIdCounter(patch.idCounter)
    setWindowGroupCounter(patch.windowGroupCounter)
    set({
      items: patch.items,
      activeTabId: patch.activeTabId,
      scene: patch.scene,
      assets: patch.assets,
      selectedId: null,
      editingId: null,
      // A freshly-opened project is not an unsaved edit, and its history
      // belongs to the file, not to this session.
      sceneIsDirty: false,
      _past: [],
      _future: [],
      projectError: null,
      autosaveDegraded: patch.assetsOmitted,
      lastSavedAt: patch.savedAt,
      // An explicit name (from the opened filename) wins over the one
      // stored in the payload; autosave restore has no override and keeps
      // whatever the project was called when it was saved.
      projectName: patch.projectName,
      ...(projectName ? { projectName } : {})
    })
  }

  return {
    ...PERSISTENCE_INITIAL_STATE,

    setProjectName: (name) => set({ projectName: name || 'Untitled' }),
    clearProjectError: () => set({ projectError: null }),

    // Debounced autosave. Every mutating action funnels here via the
    // subscription wired in App.jsx, so edits coalesce into one write.
    scheduleAutosave: () => {
      if (typeof localStorage === 'undefined') return
      if (autosaveTimer) clearTimeout(autosaveTimer)
      autosaveTimer = setTimeout(() => {
        autosaveTimer = null
        writeAutosave()
      }, AUTOSAVE_DEBOUNCE_MS)
    },

    // Force a write now, skipping the debounce (used on tab close).
    flushAutosave: () => {
      if (autosaveTimer) { clearTimeout(autosaveTimer); autosaveTimer = null }
      return writeAutosave()
    },

    hasAutosave: () => {
      try { return !!localStorage.getItem(AUTOSAVE_KEY) } catch { return false }
    },

    // Restore the autosaved project. Returns true when something was
    // applied. A corrupt payload is discarded rather than left to block
    // every future launch.
    restoreAutosave: () => {
      let text = null
      try { text = localStorage.getItem(AUTOSAVE_KEY) } catch { return false }
      if (!text) return false
      try {
        const patch = deserializeProject(JSON.parse(text))
        applyProject(patch)
        return true
      } catch {
        try { localStorage.removeItem(AUTOSAVE_KEY) } catch {}
        return false
      }
    },

    clearAutosave: () => {
      if (autosaveTimer) { clearTimeout(autosaveTimer); autosaveTimer = null }
      try { localStorage.removeItem(AUTOSAVE_KEY) } catch {}
    },

    // Reset to a blank project of the current scene mode.
    newProject: () => {
      const mode = get().scene?.sceneMode === 'volume' ? 'emptyVolume' : 'blank'
      const seed = buildTemplate(mode) || seedScene()
      set({
        items: seed.items,
        activeTabId: seed.activeTabId,
        scene: { ...DEFAULT_SCENE, sceneMode: get().scene?.sceneMode || 'window' },
        assets: [],
        selectedId: null,
        editingId: null,
        sceneIsDirty: false,
        _past: [],
        _future: [],
        projectName: 'Untitled',
        lastSavedAt: null,
        autosaveDegraded: false,
        projectError: null
      })
    },

    // Download the full project, assets included.
    saveProjectToFile: () => {
      const state = get()
      const payload = JSON.stringify(serializeProject(state), null, 2)
      const safe = (state.projectName || 'Untitled').replace(/[^A-Za-z0-9._-]+/g, '-')
      const blob = new Blob([payload], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safe}.vosproj.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Revoke on the next tick so the download has started.
      setTimeout(() => URL.revokeObjectURL(url), 0)
      set({ lastSavedAt: new Date().toISOString() })
    },

    // Read a user-picked File and replace the current project with it.
    openProjectFromFile: async (file) => {
      if (!file) return false
      try {
        const text = await file.text()
        const patch = deserializeProject(JSON.parse(text))
        const name = String(file.name || 'Untitled')
          .replace(/\.vosproj\.json$/i, '')
          .replace(/\.json$/i, '')
        applyProject(patch, { projectName: name })
        return true
      } catch (err) {
        set({
          projectError: err instanceof ProjectLoadError
            ? err.message
            : 'That file could not be read as a project.'
        })
        return false
      }
    }
  }
}
