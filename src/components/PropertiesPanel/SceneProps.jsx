// Scene tab — global scene-level controls (mode, preset, viewport, design,
// export trigger).

import { useState } from 'react'
import { WINDOW_PRESETS, VOLUME_PRESETS } from '../../appleSystem'
import { Row, Section, ColorRow, Select } from './primitives'
import SwiftExportDialog from '../SwiftExportDialog'

export function SceneProps({ scene, updateScene }) {
  const [exportOpen, setExportOpen] = useState(false)
  return (
    <div className="flex-1 overflow-y-auto scrollbar">
      {exportOpen && <SwiftExportDialog onClose={() => setExportOpen(false)} />}
      <Section title="Scene">
        <Row label="Mode">
          <div className="segmented flex-1">
            <button className={scene.sceneMode === 'window' ? 'active' : ''} onClick={() => updateScene({ sceneMode: 'window' })}>Window</button>
            <button className={scene.sceneMode === 'volume' ? 'active' : ''} onClick={() => updateScene({ sceneMode: 'volume' })}>Volume</button>
          </div>
        </Row>
      </Section>

      <Section title={scene.sceneMode === 'window' ? 'Window Preset' : 'Volume Preset'}>
        {scene.sceneMode === 'window' ? (
          <Row label="Preset">
            <Select
              value={scene.windowPreset}
              options={Object.entries(WINDOW_PRESETS).map(([k, v]) => ({
                value: k,
                label: `${v.label} (${v.width}×${v.height})`
              }))}
              onChange={(v) => updateScene({ windowPreset: v })}
            />
          </Row>
        ) : (
          <Row label="Preset">
            <Select
              value={scene.volumePreset}
              options={Object.entries(VOLUME_PRESETS).map(([k, v]) => ({
                value: k,
                label: `${v.label} (${v.width}×${v.height}×${v.depth})`
              }))}
              onChange={(v) => updateScene({ volumePreset: v })}
            />
          </Row>
        )}
      </Section>

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
