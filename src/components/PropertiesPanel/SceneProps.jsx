// Scene tab — global scene-level controls (viewport, design, export trigger).
//
// Scene type (Window/Volume) and preset live on the splash screen — that's
// where the user picks them at project start. Re-opening the splash via the
// topbar title lets them swap modes without cluttering this panel.

import { useState } from 'react'
import { Row, Section, ColorRow, Select, NumField, Slider } from './primitives'
import {
  HDRI_PRESETS, HDRI_ORDER, IMMERSION_STYLES,
  SCENE_COLOR_GROUPS, SCENE_COLOR_LABELS, DEFAULT_SCENE_COLORS
} from '../../appleSystem'
import SwiftExportDialog from '../SwiftExportDialog'

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

// Project-wide color palette editor. One sub-section per category from
// SCENE_COLOR_GROUPS — each token shows a swatch + hex field. The
// "Reset" link in the section header restores the visionOS-kit defaults.
function SceneColorsSection({ scene, updateScene }) {
  const palette = scene.colors || {}
  const setColor = (token, hex) =>
    updateScene({ colors: { ...palette, [token]: hex } })
  const resetAll = () =>
    updateScene({ colors: { ...DEFAULT_SCENE_COLORS } })
  return (
    <Section
      title="Colors"
      action={
        <button
          className="text-[9px] text-textMute hover:text-text uppercase tracking-wider"
          onClick={resetAll}
          title="Reset every token to the visionOS defaults"
        >Reset</button>
      }
    >
      <div className="text-[10px] text-textMute leading-relaxed mb-2">
        Project palette. Pickers across the inspector reference these
        tokens — re-tune a value here to re-theme the whole scene.
      </div>
      {SCENE_COLOR_GROUPS.map((group) => (
        <div key={group.key} className="mb-3 last:mb-0">
          <div className="text-[9px] text-textMute uppercase tracking-wider mb-1">
            {group.label}
          </div>
          {group.tokens.map((token) => (
            <Row key={token} label={SCENE_COLOR_LABELS[token] || token} labelWidth={120}>
              <ColorRow
                value={palette[token] || DEFAULT_SCENE_COLORS[token] || '#000000'}
                onChange={(v) => setColor(token, v)}
              />
            </Row>
          ))}
        </div>
      ))}
    </Section>
  )
}
