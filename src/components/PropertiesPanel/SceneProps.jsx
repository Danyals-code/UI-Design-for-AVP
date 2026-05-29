// Scene tab — global scene-level controls (viewport, design, export trigger).
//
// Scene type (Window/Volume) and preset live on the splash screen — that's
// where the user picks them at project start. Re-opening the splash via the
// topbar title lets them swap modes without cluttering this panel.

import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { Row, Section, ColorRow, Select, NumField, Slider, IntField } from './primitives'
import {
  HDRI_PRESETS, HDRI_ORDER, IMMERSION_STYLES,
  SCENE_COLOR_GROUPS, SCENE_COLOR_LABELS, DEFAULT_SCENE_COLORS,
  MATERIALS, MATERIAL_ORDER
} from '../../appleSystem'
import SwiftExportDialog from '../SwiftExportDialog'

// System-colour wheel tokens (the "Colors" group). Kept as a Set so the
// selection-sync helper can tell a plain colour token from a material one.
const SYSTEM_COLOR_TOKENS = new Set(
  SCENE_COLOR_GROUPS.find((g) => g.key === 'colors')?.tokens || []
)

// Map a selected canvas item to the Materials & Colors focus key its
// detail editor should jump to. Windows / stacks / segmented controls
// carry a material tier on `item.material`; search fields and similar
// store a view-tier token on `item.colorToken`. Returns null when the
// item has no editable material/colour we can surface.
function focusKeyForItem(item) {
  if (!item) return null
  if (item.material && MATERIALS[item.material]) return `mat:${item.material}`
  const tok = item.colorToken
  if (tok && SCENE_COLOR_LABELS[tok]) {
    return SYSTEM_COLOR_TOKENS.has(tok) ? `color:${tok}` : `mat:${tok}`
  }
  return null
}

// drei <Environment> built-in presets. None of these need an asset
// download — drei ships pre-baked cubemaps for each. "None" disables
// the IBL fallback so only the explicit ambient/key lights apply.
const ENV_PRESETS = [
  { value: 'none',      label: 'None (lights only)' },
  { value: 'apartment', label: 'Apartment (default)' },
  { value: 'studio',    label: 'Studio' },
  { value: 'city',      label: 'City' },
  { value: 'park',      label: 'Park' },
  { value: 'sunset',    label: 'Sunset' },
  { value: 'dawn',      label: 'Dawn' },
  { value: 'night',     label: 'Night' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'forest',    label: 'Forest' },
  { value: 'lobby',     label: 'Lobby' }
]

// visionOS spec §3.1 — `.upperLimbVisibility(_:)` and
// `.preferredSurroundingsEffect(_:)`. The latter accepts `nil`,
// `.systemDark`, or `.colorMultiply(_)`; we model the third as a
// dedicated colour picker that surfaces when the mode is selected.
const UPPER_LIMB = [
  { value: 'automatic', label: 'Automatic (default)' },
  { value: 'visible',   label: 'Visible' },
  { value: 'hidden',    label: 'Hidden' }
]
const SURROUNDINGS_EFFECT = [
  { value: 'none',          label: 'None (default)' },
  { value: 'systemDark',    label: 'System Dark' },
  { value: 'colorMultiply', label: 'Color Multiply' }
]
const ENVIRONMENT_BEHAVIOR = [
  { value: 'automatic', label: 'Automatic (default)' },
  { value: 'coexist',   label: 'Coexist (visionOS 26)' }
]

export function SceneProps({ scene, updateScene }) {
  const [exportOpen, setExportOpen] = useState(false)
  return (
    <div className="flex-1 overflow-y-auto scrollbar">
      {exportOpen && <SwiftExportDialog onClose={() => setExportOpen(false)} />}
      <Section title="Viewport">
        <Row label="Background">
          <div className="segmented flex-1">
            <button className={scene.colorScheme === 'light' ? 'active' : ''} onClick={() => updateScene({ colorScheme: 'light' })}>Light</button>
            <button className={scene.colorScheme === 'dark' ? 'active' : ''} onClick={() => updateScene({ colorScheme: 'dark' })}>Dark</button>
            <button
              className={scene.colorScheme === 'image' ? 'active' : ''}
              onClick={() => {
                if (!scene.backgroundImage) {
                  document.getElementById('viewport-bg-image-input')?.click()
                } else {
                  updateScene({ colorScheme: 'image' })
                }
              }}
            >Image</button>
          </div>
        </Row>
        {scene.colorScheme === 'image' && (
          <>
            <Row label="Image">
              <label className="btn flex-1 justify-center cursor-pointer">
                {scene.backgroundImage ? 'Change…' : 'Choose…'}
                <input
                  id="viewport-bg-image-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                      updateScene({ backgroundImage: ev.target.result, colorScheme: 'image' })
                    }
                    reader.readAsDataURL(file)
                    e.target.value = ''
                  }}
                />
              </label>
              {scene.backgroundImage && (
                <button
                  className="btn btn-ghost"
                  onClick={() => updateScene({ backgroundImage: null, colorScheme: 'dark' })}
                  title="Remove image"
                >×</button>
              )}
            </Row>
            <div className="text-[10px] text-textMute leading-relaxed">
              The image wraps the scene as a 360° HDRI: it surrounds the
              camera and lights PBR materials. Equirectangular panoramas
              read best; regular photos work but won't tile seamlessly.
            </div>
          </>
        )}
        {scene.colorScheme !== 'image' && (
          <input
            id="viewport-bg-image-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = (ev) => {
                updateScene({ backgroundImage: ev.target.result, colorScheme: 'image' })
              }
              reader.readAsDataURL(file)
              e.target.value = ''
            }}
          />
        )}
        <div className="text-[10px] text-textMute">Only the viewport background. Your design stays on its own scheme.</div>

        {/* HDRI environment \u2014 wraps the scene with image-based lighting,
            which also shades any 3D primitives in the canvas. Bundled with
            the app so it works offline; flips the viewport background to a
            blurred copy of the HDRI when active. */}
        <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-1">HDRI Environment</div>
        <Row label="Preset">
          <Select
            value={
              HDRI_ORDER.find((k) => HDRI_PRESETS[k].file === scene.hdri) || 'none'
            }
            options={HDRI_ORDER.map((k) => ({ value: k, label: HDRI_PRESETS[k].label }))}
            onChange={(v) => updateScene({ hdri: HDRI_PRESETS[v].file })}
          />
        </Row>
        <div className="text-[10px] text-textMute leading-relaxed">
          Lights and reflects 3D primitives. Replaces the flat background while active.
        </div>
      </Section>

      <Section title="Lighting" defaultOpen={true}>
        {/*
          Designer-controllable scene lighting. The defaults are tuned
          to read bright on every device, but users sometimes want to
          turn the scene down for moody dark UIs. Ambient is the
          flat-fill, Key is the angled directional that gives 3D
          primitives shading.
        */}
        <Row label="Ambient">
          <Slider
            value={scene.ambientLightIntensity ?? 1.4}
            min={0} max={3} step={0.05}
            onChange={(v) => updateScene({ ambientLightIntensity: v })}
          />
        </Row>
        <Row label="Key">
          <Slider
            value={scene.keyLightIntensity ?? 0.9}
            min={0} max={3} step={0.05}
            onChange={(v) => updateScene({ keyLightIntensity: v })}
          />
        </Row>
        {/*
          Key-light position in world space. The light always targets the
          stage centre (the wooden stool at 0, 1.2, 0) — moving the
          position changes the angle of the cast shadow without ever
          pointing the rim away from the hero object. X swings the light
          left/right, Y lifts it overhead, Z pushes it forward or behind
          the wearer. Ranges are tuned to the studio's metres-scale bbox
          so the slider sweep maps to "useful" angles.
        */}
        <Row label="Key X">
          <Slider
            value={scene.keyLightPosition?.[0] ?? 0}
            min={-6} max={6} step={0.1}
            onChange={(v) => updateScene({
              keyLightPosition: [v, scene.keyLightPosition?.[1] ?? 4.5, scene.keyLightPosition?.[2] ?? 1.5]
            })}
          />
        </Row>
        <Row label="Key Y">
          <Slider
            value={scene.keyLightPosition?.[1] ?? 4.5}
            min={0.5} max={8} step={0.1}
            onChange={(v) => updateScene({
              keyLightPosition: [scene.keyLightPosition?.[0] ?? 0, v, scene.keyLightPosition?.[2] ?? 1.5]
            })}
          />
        </Row>
        <Row label="Key Z">
          <Slider
            value={scene.keyLightPosition?.[2] ?? 1.5}
            min={-6} max={6} step={0.1}
            onChange={(v) => updateScene({
              keyLightPosition: [scene.keyLightPosition?.[0] ?? 0, scene.keyLightPosition?.[1] ?? 4.5, v]
            })}
          />
        </Row>
        <Row label="Environment">
          <Select
            value={scene.environmentPreset || 'none'}
            options={ENV_PRESETS}
            onChange={(v) => updateScene({ environmentPreset: v === 'none' ? null : v })}
          />
        </Row>
        <div className="text-[10px] text-textMute leading-snug mt-1">
          The key light always points at the stage centre. Environment
          provides PBR reflections without an HDRI; an HDRI or Image
          background from <code>Viewport</code> takes precedence when set.
        </div>
      </Section>

      {/*
        visionOS has no global light/dark switch — the system runs in
        a single perceptual palette and individual views opt into a
        scheme via `.preferredColorScheme(_:)`. The old global "Scheme"
        toggle was misleading because it implied a wider system
        setting. We keep the accent tint, which maps to SwiftUI's
        `.tint(_:)` modifier and does affect the actual export.
      */}
      <Section title="Design">
        <Row label="Tint">
          <ColorRow value={scene.tintColor} onChange={(v) => updateScene({ tintColor: v })} />
        </Row>
      </Section>

      {/*
        Project-wide colour palette. Mirrors the visionOS Figma kit's
        "Color styles" panel (Text / Controls / Views / Windows /
        Separators / Colors). Editing a token here re-themes every
        item in the scene that references that token — text panels
        bound to `primary`, controls bound to `controlSelected`, etc.
        Per-panel pickers (Layout → Fill, Text → Color, …) select
        which token an item points at; this section owns the actual
        hex values.
      */}
      <SceneColorsSection scene={scene} updateScene={updateScene} />

      {/*
        Window / Volume picker lives in the viewport overlay (top-right)
        so it sits next to 2D/3D and Zoom — the controls users reach for
        in the same workflow. Immersive Space is a less-frequent choice
        and stays here as an opt-in section.
      */}
      <Section title="Immersive Space">
        <Row label="Mode">
          <div className="segmented flex-1">
            <button
              className={scene.sceneMode !== 'immersive' ? 'active' : ''}
              onClick={() => updateScene({ sceneMode: 'window' })}
              title="Drop back to Window/Volume — set those from the viewport toggle"
            >Off</button>
            <button
              className={scene.sceneMode === 'immersive' ? 'active' : ''}
              onClick={() => updateScene({ sceneMode: 'immersive' })}
              title="Export as a top-level ImmersiveSpace scene"
            >Immersive</button>
          </div>
        </Row>
        {scene.sceneMode === 'immersive' && (
          <>
            <Row label="Style">
              <Select value={scene.immersionStyle || 'mixed'} options={IMMERSION_STYLES} onChange={(v) => updateScene({ immersionStyle: v })} />
            </Row>
            {scene.immersionStyle === 'progressive' && (
              <>
                <div className="text-[9px] text-textMute uppercase tracking-wider mt-2 mb-1">Progressive Range</div>
                <Row label="Min">
                  <NumField value={scene.progressiveRange?.[0] ?? 0.5} step={0.05} onChange={(v) => updateScene({ progressiveRange: [Math.max(0.2, Math.min(v, scene.progressiveRange?.[1] ?? 1)), scene.progressiveRange?.[1] ?? 1] })} />
                </Row>
                <Row label="Max">
                  <NumField value={scene.progressiveRange?.[1] ?? 1.0} step={0.05} onChange={(v) => updateScene({ progressiveRange: [scene.progressiveRange?.[0] ?? 0.5, Math.min(1, Math.max(v, scene.progressiveRange?.[0] ?? 0.5))] })} />
                </Row>
                <Row label="Initial">
                  <NumField value={scene.progressiveInitial ?? 0.5} step={0.05} onChange={(v) => updateScene({ progressiveInitial: v })} />
                </Row>
              </>
            )}
            <Row label="Limbs">
              <Select value={scene.upperLimbVisibility || 'automatic'} options={UPPER_LIMB} onChange={(v) => updateScene({ upperLimbVisibility: v })} />
            </Row>
            <Row label="Surroundings">
              <Select value={scene.preferredSurroundingsEffect || 'none'} options={SURROUNDINGS_EFFECT} onChange={(v) => updateScene({ preferredSurroundingsEffect: v })} />
            </Row>
            {scene.preferredSurroundingsEffect === 'colorMultiply' && (
              <Row label="Multiply">
                <ColorRow value={scene.surroundingsColorMultiply || '#000000'} onChange={(v) => updateScene({ surroundingsColorMultiply: v })} />
              </Row>
            )}
            <Row label="Behavior">
              <Select value={scene.immersiveEnvironmentBehavior || 'automatic'} options={ENVIRONMENT_BEHAVIOR} onChange={(v) => updateScene({ immersiveEnvironmentBehavior: v })} />
            </Row>
            <div className="text-[10px] text-textMute leading-snug mt-1">
              Immersive scenes export as <code>ImmersiveSpace(id:)</code> with the modifiers above. Only one ImmersiveSpace can be open at a time.
            </div>
          </>
        )}
      </Section>

      <Section title="Export">
        <button
          className="btn w-full justify-center"
          onClick={() => setExportOpen(true)}
        >
          Export SwiftUI Code
        </button>
        <div className="text-[10px] text-textMute mt-1 leading-relaxed">
          Produces one view file per Tab plus an App.swift with `@main` and
          the top-level <code>TabView</code> / <code>WindowGroup</code>.
        </div>
      </Section>
    </div>
  )
}

// Project-wide colour palette editor. The first group — the
// visionOS "Colors" wheel — renders as a compact swatch grid: every
// token is a 24pt chip, name + hex revealed on hover, click opens the
// native colour picker. The remaining groups (Text / Controls / Views
// / Windows / Separators) keep their per-token Row layout because
// each one represents a single named slot rather than a free-pick
// palette. The section header is renamed "Materials & Colors" — the
// Views + Windows tiers in here are the visionOS material library,
// so calling the whole panel just "Colors" was undersell.
// Only the system-colour wheel stays a plain colour; every other token
// (Text / Controls / Views / Windows / Separators) and the liquid-glass
// tiers are materials with the full editor. Selection key encodes the
// focus: "color:<token>" for a system colour, "mat:<key>" for a material
// (token or tier). Shared between the clickable browser and the dropdown.
const swatchOfColor = (scene, token) =>
  (scene.colors || {})[token] || DEFAULT_SCENE_COLORS[token] || '#000000'
// Representative swatch for any material key — a stored material-colour
// override wins, then the tier's stock colour, then the token's palette
// colour, then the default.
const swatchOfMaterial = (scene, key) => {
  const stored = (scene.materialProps || {})[key]
  if (stored?.color) return stored.color
  if (MATERIALS[key]?.color) return MATERIALS[key].color
  return (scene.colors || {})[key] || DEFAULT_SCENE_COLORS[key] || '#808080'
}

// One clickable swatch+label chip used throughout the browser.
function TokenChip({ color, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 px-1.5 py-1 rounded border text-left transition-colors min-w-0 ${
        active
          ? 'border-accent bg-accent/15 text-text'
          : 'border-border bg-surface3/40 text-textDim hover:text-text hover:bg-surface3'
      }`}
    >
      <span
        className="w-3.5 h-3.5 rounded-[3px] border border-black/25 flex-shrink-0"
        style={{ background: color }}
      />
      <span className="text-[10px] truncate">{label}</span>
    </button>
  )
}

function SceneColorsSection({ scene, updateScene }) {
  // Default focus = the Glass material tier. It's the first entry in the
  // dropdown (system colours were pulled out of it), so a fresh panel
  // opens on something the picker can actually display.
  const [selected, setSelected] = useState('mat:glass')
  // Follow the canvas selection: when the user picks a window / stack /
  // control in the viewport, jump the detail editor to that item's
  // material so it lands in the dropdown instead of staying pinned to
  // whatever was last focused.
  const selectedId = useStore((s) => s.selectedId)
  const selectedItem = useStore((s) => s.items.find((it) => it.id === s.selectedId))
  const focusKey = focusKeyForItem(selectedItem)
  useEffect(() => {
    if (focusKey) setSelected(focusKey)
  }, [selectedId, focusKey])
  const resetAll = () =>
    updateScene({ colors: { ...DEFAULT_SCENE_COLORS }, materialProps: {} })
  return (
    <Section
      title="Materials & Colors"
      action={
        <button
          className="text-[9px] text-textMute hover:text-text uppercase tracking-wider"
          onClick={resetAll}
          title="Reset every token and material to the visionOS defaults"
        >Reset All</button>
      }
    >
      {/* Browser — every palette token and material tier as a clickable
          chip. Picking one focuses it in the detail editor below; the
          two stay in sync. */}
      <div className="space-y-2.5">
        {SCENE_COLOR_GROUPS.map((group) => {
          // Only the system-colour wheel is plain colour; every other
          // group's tokens are materials (focus key `mat:<token>`).
          const isSystemColors = group.key === 'colors'
          const groupLabel = isSystemColors ? 'System Colors' : group.label
          return (
            <div key={group.key}>
              <div className="text-[9px] text-textMute uppercase tracking-wider mb-1.5">
                {groupLabel}
              </div>
              {isSystemColors ? (
                <div className="grid grid-cols-8 gap-1">
                  {group.tokens.map((token) => {
                    const hex = swatchOfColor(scene, token)
                    const active = selected === `color:${token}`
                    return (
                      <button
                        key={token}
                        onClick={() => setSelected(`color:${token}`)}
                        title={`${SCENE_COLOR_LABELS[token] || token} · ${hex.toUpperCase()}`}
                        className={`w-6 h-6 rounded border cursor-pointer transition-shadow ${
                          active ? 'border-accent ring-2 ring-accent' : 'border-border hover:ring-1 hover:ring-accent'
                        }`}
                        style={{ background: hex }}
                      />
                    )
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1">
                  {group.tokens.map((token) => (
                    <TokenChip
                      key={token}
                      color={swatchOfMaterial(scene, token)}
                      label={SCENE_COLOR_LABELS[token] || token}
                      active={selected === `mat:${token}`}
                      onClick={() => setSelected(`mat:${token}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {/* Liquid-glass material tiers. */}
        <div>
          <div className="text-[9px] text-textMute uppercase tracking-wider mb-1.5">
            Materials
          </div>
          <div className="grid grid-cols-2 gap-1">
            {MATERIAL_ORDER.map((key) => (
              <TokenChip
                key={key}
                color={swatchOfMaterial(scene, key)}
                label={MATERIALS[key]?.label || key}
                active={selected === `mat:${key}`}
                onClick={() => setSelected(`mat:${key}`)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Detail editor — dropdown mirrors the browser selection, with a
          per-item Reset and the controls for the focused token/material. */}
      <DetailEditor selected={selected} setSelected={setSelected} scene={scene} updateScene={updateScene} />
    </Section>
  )
}

// Detail panel for the focused token/material. The dropdown lists every
// token (grouped) plus the material tiers, so it doubles as the picker
// the browser syncs with.
function DetailEditor({ selected, setSelected, scene, updateScene }) {
  const [kind, key] = selected.split(':')
  const palette = scene.colors || {}
  const materialProps = scene.materialProps || {}
  const title = MATERIALS[key]?.label || SCENE_COLOR_LABELS[key] || key
  const resetItem = () => {
    if (kind === 'mat') {
      const next = { ...materialProps }
      delete next[key]
      const patch = { materialProps: next }
      // Token-materials also carry a legacy palette colour — clear it back
      // to the default so the reset is complete. Tier keys (glass, …) have
      // no palette entry, so leave `colors` untouched.
      if (DEFAULT_SCENE_COLORS[key] !== undefined) {
        patch.colors = { ...palette, [key]: DEFAULT_SCENE_COLORS[key] }
      }
      updateScene(patch)
    } else {
      updateScene({ colors: { ...palette, [key]: DEFAULT_SCENE_COLORS[key] || '#000000' } })
    }
  }
  return (
    <div className="mt-3 pt-3 border-t border-border space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="field flex-1 cursor-pointer"
        >
          {/* System colours are picked from the swatch grid above — listing
              all of them here just bloated the dropdown. We only surface a
              single entry for the one currently in focus so the controlled
              select still mirrors a grid pick. */}
          {kind === 'color' && (
            <option value={selected}>{SCENE_COLOR_LABELS[key] || key}</option>
          )}
          {SCENE_COLOR_GROUPS.filter((g) => g.key !== 'colors').map((g) => (
            <optgroup key={g.key} label={g.label}>
              {g.tokens.map((t) => (
                <option key={t} value={`mat:${t}`}>{SCENE_COLOR_LABELS[t] || t}</option>
              ))}
            </optgroup>
          ))}
          <optgroup label="Materials">
            {MATERIAL_ORDER.map((k) => (
              <option key={k} value={`mat:${k}`}>{MATERIALS[k]?.label || k}</option>
            ))}
          </optgroup>
        </select>
        <button
          className="btn btn-ghost text-[9px] flex-shrink-0"
          onClick={resetItem}
          title={`Reset ${title} to its default`}
        >Reset</button>
      </div>
      {kind === 'mat'
        ? <MaterialDetail materialKey={key} scene={scene} updateScene={updateScene} />
        : <ColorDetail token={key} scene={scene} updateScene={updateScene} />}
    </div>
  )
}

// Color-token editor — a large swatch that opens the native picker plus a
// hex field, for the one selected palette token.
function ColorDetail({ token, scene, updateScene }) {
  const palette = scene.colors || {}
  const hex = palette[token] || DEFAULT_SCENE_COLORS[token] || '#000000'
  const setColor = (v) => updateScene({ colors: { ...palette, [token]: v } })
  return (
    <div className="border border-border rounded px-2 py-2 bg-surface3/40">
      <div className="flex items-center gap-2">
        <label
          className="relative w-9 h-9 rounded border border-border cursor-pointer block flex-shrink-0"
          style={{ background: hex }}
          title="Pick a color"
        >
          <input
            type="color"
            value={hex}
            onChange={(e) => setColor(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </label>
        <input
          value={hex}
          onChange={(e) => setColor(e.target.value)}
          spellCheck={false}
          className="field font-mono uppercase"
        />
      </div>
    </div>
  )
}

// Material-tier editor — color / fill type / opacity / blur / shadow
// controls for one tier. `materialKey` is controlled by DetailEditor; edits
// go to `scene.materialProps[key]`.
function MaterialDetail({ materialKey, scene, updateScene }) {
  // Resolve the material. Tier keys (glass, …) get their stock spec from
  // MATERIALS; token-materials (primary, viewRecessed, …) get a generic
  // base with their colour seeded from the palette / defaults. Stored
  // overrides in materialProps win.
  const stored = (scene.materialProps || {})[materialKey] || {}
  const base = MATERIALS[materialKey] || { fillType: 'solid', opacity: 1, blur: false, blurAmount: 12 }
  const seedColor = base.color
    || (scene.colors || {})[materialKey]
    || DEFAULT_SCENE_COLORS[materialKey]
    || '#808080'
  const mat = { ...base, color: seedColor, ...stored }
  const setProp = (key, value) => {
    const current = (scene.materialProps || {})[materialKey] || {}
    updateScene({
      materialProps: {
        ...(scene.materialProps || {}),
        [materialKey]: { ...current, [key]: value }
      }
    })
  }
  const setShadow = (which, patch) => {
    const cur = mat[which] || { offsetX: 0, offsetY: 8, blur: 12, color: '#000000', opacity: 0.2 }
    setProp(which, { ...cur, ...patch })
  }
  const toggleShadow = (which) => {
    if (mat[which]) setProp(which, null)
    else setProp(which, which === 'innerShadow'
      ? { offsetX: 0, offsetY: 0, blur: 6, color: '#000000', opacity: 0.25 }
      : { offsetX: 0, offsetY: 8, blur: 24, color: '#000000', opacity: 0.20 })
  }
  // Stacked layers — extra translucent colour passes painted over the
  // base fill (the renderer reads `materialSpec.layers`). Blur and the
  // shadows below stay shared across the whole material. Writing an empty
  // array back as `null` keeps the override clean (and lets a tier with
  // built-in layers, e.g. Views Regular, fall back to flat when cleared).
  const layers = Array.isArray(mat.layers) ? mat.layers : []
  const setLayers = (next) => setProp('layers', next.length ? next : null)
  const addLayer = () => setLayers([...layers, { color: mat.color || '#808080', opacity: 0.5 }])
  const updateLayer = (i, patch) => setLayers(layers.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const removeLayer = (i) => setLayers(layers.filter((_, idx) => idx !== i))
  const fillType = mat.fillType || 'solid'
  const LW = 88
  return (
      <div className="border border-border rounded-md bg-surface3/40 divide-y divide-border/60 overflow-hidden">
        {/* Base fill — the bottom-most plate colour. */}
        <div className="px-2.5 py-2 space-y-1.5">
          <GroupLabel>Base Fill</GroupLabel>
          <Row label="Type" labelWidth={LW}>
            <div className="segmented flex-1">
              <button className={fillType === 'solid' ? 'active' : ''} onClick={() => setProp('fillType', 'solid')}>Solid</button>
              <button className={fillType === 'gradient' ? 'active' : ''} onClick={() => setProp('fillType', 'gradient')}>Gradient</button>
            </div>
          </Row>
          {fillType === 'solid' ? (
            <Row label="Color" labelWidth={LW}>
              <ColorRow value={mat.color || '#808080'} onChange={(v) => setProp('color', v)} />
            </Row>
          ) : (
            <>
              <Row label="From" labelWidth={LW}>
                <ColorRow value={mat.gradientFrom || mat.color || '#808080'} onChange={(v) => setProp('gradientFrom', v)} />
              </Row>
              <Row label="To" labelWidth={LW}>
                <ColorRow value={mat.gradientTo || '#cccccc'} onChange={(v) => setProp('gradientTo', v)} />
              </Row>
              <Row label="Angle" labelWidth={LW}>
                <Slider
                  value={mat.gradientAngle ?? 180}
                  min={0} max={360} step={1} suffix="°"
                  onChange={(v) => setProp('gradientAngle', v)}
                />
              </Row>
            </>
          )}
          <Row label="Opacity" labelWidth={LW}>
            <Slider
              value={mat.opacity ?? 1}
              min={0} max={1} step={0.01}
              onChange={(v) => setProp('opacity', v)}
            />
          </Row>
        </div>

        {/* Stacked layers — extra translucent colour passes painted over
            the base fill. Each is its own colour + opacity. */}
        <div className="px-2.5 py-2 space-y-1.5">
          <GroupLabel>
            Layers
            {layers.length > 0 && <span className="ml-1 text-textMute/70 normal-case tracking-normal">({layers.length})</span>}
          </GroupLabel>
          {layers.map((layer, i) => (
            <div key={i} className="rounded border border-border/70 bg-surface2/50 px-2 py-1.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-semibold text-textDim uppercase tracking-wider">Layer {i + 1}</span>
                <button
                  className="w-4 h-4 flex items-center justify-center rounded text-textMute hover:text-text hover:bg-surface3 text-[13px] leading-none"
                  onClick={() => removeLayer(i)}
                  title="Remove this layer"
                >×</button>
              </div>
              <Row label="Color" labelWidth={72}>
                <ColorRow value={layer.color || '#808080'} onChange={(v) => updateLayer(i, { color: v })} />
              </Row>
              <Row label="Opacity" labelWidth={72}>
                <Slider
                  value={layer.opacity ?? 0.5}
                  min={0} max={1} step={0.01}
                  onChange={(v) => updateLayer(i, { opacity: v })}
                />
              </Row>
            </div>
          ))}
          <button
            className="btn w-full justify-center border-dashed text-textDim hover:text-text"
            onClick={addLayer}
            title="Stack another translucent colour over the base fill"
          >
            <span className="text-[13px] leading-none -mt-px">+</span> Add Layer
          </button>
        </div>

        {/* Effects — applied to the whole material stack. */}
        <div className="px-2.5 py-2 space-y-1.5">
          <GroupLabel>Effects</GroupLabel>
          <Row label="Bg Blur" labelWidth={LW}>
            <div className="segmented flex-1">
              <button className={mat.blur ? 'active' : ''} onClick={() => setProp('blur', true)}>On</button>
              <button className={!mat.blur ? 'active' : ''} onClick={() => setProp('blur', false)}>Off</button>
            </div>
          </Row>
          {mat.blur && (
            <Row label="Blur Amt" labelWidth={LW}>
              <Slider
                value={mat.blurAmount ?? 12}
                min={0} max={40} step={1} suffix="pt"
                onChange={(v) => setProp('blurAmount', v)}
              />
            </Row>
          )}
          <Row label="Inner Shadow" labelWidth={LW}>
            <div className="segmented flex-1">
              <button className={mat.innerShadow ? 'active' : ''} onClick={() => { if (!mat.innerShadow) toggleShadow('innerShadow') }}>On</button>
              <button className={!mat.innerShadow ? 'active' : ''} onClick={() => { if (mat.innerShadow) toggleShadow('innerShadow') }}>Off</button>
            </div>
          </Row>
          {mat.innerShadow && (
            <ShadowSubFields shadow={mat.innerShadow} onPatch={(p) => setShadow('innerShadow', p)} />
          )}
          <Row label="Drop Shadow" labelWidth={LW}>
            <div className="segmented flex-1">
              <button className={mat.dropShadow ? 'active' : ''} onClick={() => { if (!mat.dropShadow) toggleShadow('dropShadow') }}>On</button>
              <button className={!mat.dropShadow ? 'active' : ''} onClick={() => { if (mat.dropShadow) toggleShadow('dropShadow') }}>Off</button>
            </div>
          </Row>
          {mat.dropShadow && (
            <ShadowSubFields shadow={mat.dropShadow} onPatch={(p) => setShadow('dropShadow', p)} />
          )}
        </div>
      </div>
  )
}

// Small uppercase sub-section heading used to separate the material
// editor's Base Fill / Layers / Effects groups.
function GroupLabel({ children }) {
  return (
    <div className="text-[9px] font-semibold text-textMute uppercase tracking-wider">
      {children}
    </div>
  )
}

// Shadow sub-settings — shown as a tidy nested card under the shadow's
// On/Off toggle. Offset X/Y share one row; Blur / Color / Opacity follow
// with the same label column as the rest of the material editor.
function ShadowSubFields({ shadow, onPatch }) {
  return (
    <div className="rounded border border-border/70 bg-surface2/40 px-2 py-1.5 mt-1 mb-1 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-textDim text-[10px]" style={{ minWidth: 92 }}>Offset</span>
        <div className="flex-1 flex items-center gap-1.5">
          <span className="text-[9px] text-textMute">X</span>
          <IntField value={shadow.offsetX ?? 0} onChange={(v) => onPatch({ offsetX: v })} />
          <span className="text-[9px] text-textMute">Y</span>
          <IntField value={shadow.offsetY ?? 0} onChange={(v) => onPatch({ offsetY: v })} />
        </div>
      </div>
      <Row label="Blur" labelWidth={92}>
        <IntField value={shadow.blur ?? 12} min={0} onChange={(v) => onPatch({ blur: v })} />
      </Row>
      <Row label="Color" labelWidth={92}>
        <ColorRow value={shadow.color || '#000000'} onChange={(v) => onPatch({ color: v })} />
      </Row>
      <Row label="Opacity" labelWidth={92}>
        <Slider
          value={shadow.opacity ?? 0.2}
          min={0} max={1} step={0.01}
          onChange={(v) => onPatch({ opacity: v })}
        />
      </Row>
    </div>
  )
}
