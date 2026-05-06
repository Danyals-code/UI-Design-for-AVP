// Scene tab — global scene-level controls (viewport, design, export trigger).
//
// Scene type (Window/Volume) and preset live on the splash screen — that's
// where the user picks them at project start. Re-opening the splash via the
// topbar title lets them swap modes without cluttering this panel.

import { useState } from 'react'
import { Row, Section, ColorRow, Select, NumField } from './primitives'
import { HDRI_PRESETS, HDRI_ORDER, IMMERSION_STYLES } from '../../appleSystem'
import SwiftExportDialog from '../SwiftExportDialog'

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

      <Section title="Design">
        <Row label="Scheme">
          <div className="segmented flex-1">
            <button className={scene.designScheme === 'light' ? 'active' : ''} onClick={() => updateScene({ designScheme: 'light' })}>Light</button>
            <button className={scene.designScheme === 'dark' ? 'active' : ''} onClick={() => updateScene({ designScheme: 'dark' })}>Dark</button>
          </div>
        </Row>
        <Row label="Tint">
          <ColorRow value={scene.tintColor} onChange={(v) => updateScene({ tintColor: v })} />
        </Row>
      </Section>

      <Section title="Scene Type">
        {/*
          visionOS apps host one of three scene types: WindowGroup
          (2D plate), volumetric WindowGroup, or ImmersiveSpace. The
          mode here drives which top-level `Scene` the SwiftUI exporter
          emits, plus which inspector fields apply.
        */}
        <Row label="Mode">
          <div className="segmented flex-1">
            <button className={scene.sceneMode === 'window' ? 'active' : ''} onClick={() => updateScene({ sceneMode: 'window' })}>Window</button>
            <button className={scene.sceneMode === 'volume' ? 'active' : ''} onClick={() => updateScene({ sceneMode: 'volume' })}>Volume</button>
            <button className={scene.sceneMode === 'immersive' ? 'active' : ''} onClick={() => updateScene({ sceneMode: 'immersive' })}>Immersive</button>
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
