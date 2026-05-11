// In-app help & app guide. Surfaced from the topbar "?" button. Aims
// to give a new user a complete mental model of the designer without
// leaving the app — what each panel does, what window vs volume mode
// is for, the keyboard shortcuts, and where to drop assets.

import { useEffect } from 'react'

function Section({ title, children }) {
  return (
    <section className="mb-5">
      <h3 className="text-[11px] uppercase tracking-wider text-accent font-semibold mb-2">
        {title}
      </h3>
      <div className="text-[12px] text-text leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  )
}

function Shortcut({ keys, label }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-textDim">{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd key={i} className="kbd">{k}</kbd>
        ))}
      </span>
    </div>
  )
}

export default function HelpDialog({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(6px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-[640px] max-w-[94vw] max-h-[88vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <div>
            <div className="text-[13px] font-semibold text-text">Help & App Guide</div>
            <div className="text-[10px] text-textMute mt-0.5">
              A quick tour of every panel, mode, and keyboard shortcut.
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-textMute hover:text-text hover:bg-hover/60"
            title="Close"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto scrollbar px-5 py-4 flex-1">
          <Section title="What is this?">
            <p>
              visionOS Designer is a layout sandbox for Apple Vision Pro apps.
              You compose SwiftUI windows and RealityKit volumes visually,
              preview them in a wearer's-eye view, and export Swift source
              when you're done.
            </p>
          </Section>

          <Section title="Window vs Volume mode">
            <p>
              <b className="text-text">Window mode</b> models a flat 2D
              SwiftUI window that floats in 3D space — think Mail, Settings,
              or a music player. You design with stacks, panels, and controls
              the same way you would in SwiftUI.
            </p>
            <p>
              <b className="text-text">Volume mode</b> models a bounded
              RealityKit stage — depth, anchors, and 3D entities. Use it for
              product showcases, dioramas, or anything that needs to "live in
              space".
            </p>
            <p>
              Switch between modes with the <b className="text-text">Window / Volume</b>
              segmented control at the top-right of the viewport.
            </p>
          </Section>

          <Section title="The viewport">
            <p>
              The 3D canvas always shows the wearer's VR view at the same
              stand-off the Xcode visionOS simulator uses — ~1.4m for a
              window, ~1.5m for a volume. Click <b className="text-text">VR View</b>
              to snap back to that default pose after orbiting around.
            </p>
            <p>
              <b className="text-text">Left-drag</b> rotates the camera,
              <b className="text-text"> right-drag</b> pans,
              <b className="text-text"> scroll</b> zooms. The Zoom slider at
              the top edge mirrors the camera distance.
            </p>
          </Section>

          <Section title="Panels">
            <p>
              <b className="text-text">Layers</b> (top-left) is the document
              outline — every tab, window, stack, panel and entity. Click to
              select; drag to re-parent.
            </p>
            <p>
              <b className="text-text">Assets</b> (bottom-left) holds packaged
              templates plus your own USDZ / GLB / image imports. Drag an
              asset onto the canvas to spawn it.
            </p>
            <p>
              <b className="text-text">Properties</b> (right) edits whatever's
              selected — size, position, modifiers, behaviours.
            </p>
          </Section>

          <Section title="Preview mode">
            <p>
              Hit the blue <b className="text-text">Preview</b> pill at the
              bottom of the viewport (or press <kbd className="kbd">⌘P</kbd>)
              to run your scene as the deployed app. Editing chrome hides,
              the camera resets to the wearer's default VR pose, and your
              UI is locked from drag — clicks behave the way a wearer's
              pinch would.
            </p>
            <p>
              <kbd className="kbd">Esc</kbd> drops back to the editor.
            </p>
          </Section>

          <Section title="Keyboard shortcuts">
            <Shortcut keys={['⇧', 'A']} label="Open the Add / command palette" />
            <Shortcut keys={['⌘', 'Z']} label="Undo" />
            <Shortcut keys={['⇧', '⌘', 'Z']} label="Redo" />
            <Shortcut keys={['⌘', 'C']} label="Copy selection" />
            <Shortcut keys={['⌘', 'V']} label="Paste" />
            <Shortcut keys={['⌘', 'D']} label="Duplicate selection" />
            <Shortcut keys={['Delete']} label="Delete selection" />
            <Shortcut keys={['↑', '↓', '←', '→']} label="Nudge selection" />
            <Shortcut keys={['⇧', '↑', '↓', '←', '→']} label="Nudge by a bigger step" />
            <Shortcut keys={['G']} label="Modal move" />
            <Shortcut keys={['R']} label="Modal rotate" />
            <Shortcut keys={['S']} label="Modal scale" />
            <Shortcut keys={['Esc']} label="Cancel / exit preview" />
          </Section>

          <Section title="Templates">
            <p>
              The Assets panel ships with a Templates folder containing
              six window apps (Music Player, Smart Home, Settings, Mail,
              Tab Bar, Files) and six volumes (Product Showcase, Solar
              System, Mood Lamps, Spinning Showcase, etc.). Single-click
              a template tile to apply it — your current scene moves to
              the undo stack, so <kbd className="kbd">⌘Z</kbd> recovers it.
            </p>
          </Section>

          <Section title="Exporting Swift">
            <p>
              The topbar's project menu has an <b className="text-text">Export Swift</b>
              option that emits a SwiftUI / RealityKit source tree ready to
              drop into Xcode. The export uses the same items and modifiers
              you see in the inspector, so what you authored is what compiles.
            </p>
          </Section>
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end flex-shrink-0">
          <button onClick={onClose} className="btn btn-primary">Got it</button>
        </div>
      </div>
    </div>
  )
}
