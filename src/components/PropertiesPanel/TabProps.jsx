// Tab (page) inspector. Tabs are top-level pages — name + SF Symbol icon,
// no geometry/material of their own.

import { useStore } from '../../store'
import { Row, Section } from './primitives'

export function TabProps({ item }) {
  const renameTab   = useStore((s) => s.renameTab)
  const setTabIcon  = useStore((s) => s.setTabIcon)
  const removeTab   = useStore((s) => s.removeTab)
  const tabCount    = useStore((s) => s.items.filter((it) => it.type === 'tab').length)
  return (
    <div className="flex-1 overflow-y-auto scrollbar">
      <Section title="Tab">
        <Row label="Name">
          <input
            value={item.name}
            onChange={(e) => renameTab(item.id, e.target.value)}
            className="field flex-1"
          />
        </Row>
        <Row label="Icon">
          <input
            value={item.icon || ''}
            onChange={(e) => setTabIcon(item.id, e.target.value)}
            placeholder="SF Symbol name"
            className="field flex-1"
          />
        </Row>
      </Section>
      {tabCount > 1 && (
        <Section title="Actions">
          <button
            className="btn btn-ghost text-danger w-full"
            onClick={() => removeTab(item.id)}
          >
            Delete Tab
          </button>
        </Section>
      )}
    </div>
  )
}
