// PropertiesPanel — top-level inspector router. Picks the right per-domain
// inspector (Tab / Window / Stack / Panel) based on the selected item, plus
// a Scene tab for global controls.

import { useState } from 'react'
import { useStore } from '../../store'
import { TabButton } from './primitives'
import { TabProps } from './TabProps'
import { WindowProps } from './WindowProps'
import { StackProps } from './StackProps'
import { PanelProps } from './PanelProps'
import { SceneProps } from './SceneProps'
import { EntityProps } from './EntityProps'

function Empty() {
  return (
    <div className="p-6 text-center text-textMute text-[11px] leading-relaxed">
      Select an item in the canvas or layers list to edit its properties.
    </div>
  )
}

export default function PropertiesPanel({ width = 280 }) {
  const [tab, setTab] = useState('object')
  const selectedId = useStore((s) => s.selectedId)
  const item = useStore((s) => s.items.find((p) => p.id === selectedId))
  const scene = useStore((s) => s.scene)
  const updateScene = useStore((s) => s.updateScene)

  return (
    <div
      style={{ width }}
      className="bg-surface border-l border-border flex flex-col h-full flex-shrink-0"
    >
      <div className="tab-strip">
        <TabButton active={tab === 'object'} onClick={() => setTab('object')}>Object</TabButton>
        <TabButton active={tab === 'scene'} onClick={() => setTab('scene')}>Scene</TabButton>
      </div>

      {tab === 'object'
        ? !item
          ? <Empty />
          : item.type === 'tab'      ? <TabProps item={item} />
          : item.type === 'window'   ? <WindowProps item={item} />
          : item.type === 'stack'    ? <StackProps item={item} />
          : item.type === 'entity'   ? <EntityProps item={item} />
          : <PanelProps item={item} scene={scene} />
        : <SceneProps scene={scene} updateScene={updateScene} />}
    </div>
  )
}
