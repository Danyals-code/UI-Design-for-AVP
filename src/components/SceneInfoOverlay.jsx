// Blender-style scene-info HUD. Shows what the designer cares about at a
// glance: total item count, breakdown by kind, and the current selection
// (name + type). Replaces the old <Stats /> FPS/MS/MB readout, which is a
// performance metric rather than scene metadata. Mirrors the corner overlay
// Blender renders ("Verts | Faces | Tris | Objects | Memory | Selection").

import { useStore } from '../store'

export default function SceneInfoOverlay() {
  const show     = useStore((s) => s.showSceneInfo)
  const items    = useStore((s) => s.items)
  const selected = useStore((s) => s.items.find((it) => it.id === s.selectedId))
  if (!show) return null

  const counts = { tab: 0, window: 0, stack: 0, panel: 0 }
  for (const it of items) counts[it.type] = (counts[it.type] || 0) + 1

  // Approximate triangle count for the 3D primitives in the scene. Each
  // generator's segment count is fixed at the render site (Panel3D.jsx), so
  // we hard-code those numbers rather than introspecting three.js geometry.
  // Plain 2D panels are counted as "1 quad → 2 triangles" for a rough total.
  let tris = 0
  for (const it of items) {
    if (it.type !== 'panel') continue
    switch (it.panelType) {
      case 'sphere':   tris += 32 * 32 * 2; break
      case 'box':      tris += 12;          break
      case 'cone':     tris += 32 * 2;      break
      case 'cylinder': tris += 32 * 4;      break
      case 'plane':    tris += 2;           break
      case 'mesh':     tris += 12;          break // wireframe placeholder
      case 'text3d':   tris += 200;         break // troika Text rough estimate
      default:         tris += 2;           break // 2D rounded-rect quad
    }
  }
  const trisStr = tris >= 1000 ? `${(tris / 1000).toFixed(1)}k` : `${tris}`

  const selLabel = selected
    ? `${selected.name || selected.type} · ${selected.type}${selected.panelType ? ` (${selected.panelType})` : ''}`
    : '— none —'

  return (
    <div
      className="absolute top-3 left-3 z-10 pointer-events-none rounded px-2.5 py-1.5"
      style={{
        background: 'rgba(21, 21, 21, 0.88)',
        border: '1px solid #2e2e2e',
        backdropFilter: 'blur(8px)',
        font: '500 10px ui-monospace, SFMono-Regular, Consolas, monospace',
        color: '#cfcfcf',
        lineHeight: 1.55,
        minWidth: 200,
        maxWidth: 320
      }}
    >
      <div><span style={{ color: '#7a7a7a' }}>Items</span>  {items.length}</div>
      <div>
        <span style={{ color: '#7a7a7a' }}>Tabs</span> {counts.tab}
        {'  '}
        <span style={{ color: '#7a7a7a' }}>Windows</span> {counts.window}
      </div>
      <div>
        <span style={{ color: '#7a7a7a' }}>Stacks</span> {counts.stack}
        {'  '}
        <span style={{ color: '#7a7a7a' }}>Panels</span> {counts.panel}
      </div>
      <div><span style={{ color: '#7a7a7a' }}>Tris</span>   ~{trisStr}</div>
      <div className="mt-1 pt-1" style={{ borderTop: '1px solid #2e2e2e' }}>
        <span style={{ color: '#7a7a7a' }}>Sel</span>  <span style={{ color: '#e4e4e4' }}>{selLabel}</span>
      </div>
    </div>
  )
}
