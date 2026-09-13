// File menu — New / Open / Save, plus the autosave indicator.
//
// Sits in the Topbar next to the project name. Save writes the whole
// project (assets included) as JSON the user keeps; autosave runs on a
// debounce into localStorage so a refresh never costs work. When a project
// carries more media than localStorage will hold, autosave drops the asset
// payloads and keeps the layout, and the indicator says so rather than
// letting the user assume their images are safe.

import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'

function relativeTime(iso) {
  if (!iso) return null
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export default function FileMenu() {
  const [open, setOpen] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  const fileRef = useRef(null)

  const projectName = useStore((s) => s.projectName)
  const lastSavedAt = useStore((s) => s.lastSavedAt)
  const degraded = useStore((s) => s.autosaveDegraded)
  const projectError = useStore((s) => s.projectError)
  const sceneIsDirty = useStore((s) => s.sceneIsDirty)

  const newProject = useStore((s) => s.newProject)
  const saveProjectToFile = useStore((s) => s.saveProjectToFile)
  const openProjectFromFile = useStore((s) => s.openProjectFromFile)
  const setProjectName = useStore((s) => s.setProjectName)
  const clearProjectError = useStore((s) => s.clearProjectError)
  const clearAutosave = useStore((s) => s.clearAutosave)

  // Re-render the "saved 2m ago" label without a timer per keystroke.
  const [, tick] = useState(0)
  useEffect(() => {
    if (!lastSavedAt) return
    const id = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(id)
  }, [lastSavedAt])

  const onOpenFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setOpen(false)
    await openProjectFromFile(file)
  }

  const doNew = () => {
    clearAutosave()
    newProject()
    setConfirmNew(false)
    setOpen(false)
  }

  const saved = relativeTime(lastSavedAt)

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-2 py-1 rounded-md text-[11px] text-textMute hover:text-text hover:bg-hover/60 transition-colors"
        title="New, open and save"
      >
        File
      </button>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={onOpenFile}
      />

      {/* Project name is editable inline — it is also the download name. */}
      <input
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        className="bg-transparent text-[11px] text-text w-28 px-1 py-0.5 rounded border border-transparent hover:border-border focus:border-accent focus:outline-none"
        title="Project name"
      />

      <span
        className={`text-[9px] uppercase tracking-wider ${degraded ? 'text-warn' : 'text-textMute'}`}
        title={degraded
          ? 'Autosave is over the browser storage limit, so imported images are not included. Use File > Save to keep them.'
          : saved ? `Autosaved to this browser ${saved}` : 'Not autosaved yet'}
      >
        {degraded
          ? 'Layout autosaved · images not'
          : saved ? `Saved ${saved}` : (sceneIsDirty ? 'Unsaved' : '')}
      </span>

      {projectError && (
        <span className="flex items-center gap-1.5 text-[9px] text-danger max-w-[260px]">
          <span className="truncate" title={projectError}>{projectError}</span>
          <button onClick={clearProjectError} className="hover:text-text" title="Dismiss">x</button>
        </span>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-30 w-52 bg-panel border border-border rounded-md shadow-xl py-1">
            <MenuItem onClick={() => { setOpen(false); setConfirmNew(true) }}>New project</MenuItem>
            <MenuItem onClick={() => fileRef.current?.click()}>Open project...</MenuItem>
            <MenuItem onClick={() => { saveProjectToFile(); setOpen(false) }}>Save project</MenuItem>
            <div className="h-px bg-border my-1" />
            <div className="px-3 py-1.5 text-[9px] text-textMute leading-relaxed">
              Saves a .vosproj.json you keep. Your work is also autosaved to
              this browser as you edit.
            </div>
          </div>
        </>
      )}

      {confirmNew && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center">
          <div className="bg-panel border border-border rounded-lg p-5 w-[380px] shadow-2xl">
            <div className="text-[13px] font-semibold text-text mb-2">Start a new project?</div>
            <p className="text-[11px] text-textMute leading-relaxed mb-4">
              This clears the current scene and its imported assets, and discards
              the autosave. Save first if you want to keep this one.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost text-[11px]" onClick={() => setConfirmNew(false)}>Cancel</button>
              <button
                className="btn text-[11px]"
                onClick={() => { saveProjectToFile(); setConfirmNew(false) }}
              >Save first</button>
              <button className="btn text-[11px] text-danger" onClick={doNew}>Discard and start new</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-[11px] text-text hover:bg-hover transition-colors"
    >
      {children}
    </button>
  )
}
