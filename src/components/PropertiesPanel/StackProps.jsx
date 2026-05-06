// Stack inspector. Geometry kind (V/H/Z), layout, frame, sections,
// disclosure, navigation/TabView/Tab metadata, ornament attachment,
// environment, modifiers — and the NavigationSplitView controls when
// `splitStyle` is set on the stack.

import { useStore } from '../../store'
import { VStackIcon, HStackIcon, ZStackIcon } from '../icons'
import {
  STACK_TYPES, MATERIALS, MATERIAL_ORDER,
  TEXT_STYLES, TEXT_STYLE_ORDER
} from '../../appleSystem'
import {
  Row, Section, IntField, PtField, Select, SemanticColorPicker, StackAlignmentPicker
} from './primitives'
import { ModifierStack } from './ModifierStack'

export function StackProps({ item }) {
  const updateItem = useStore((s) => s.updateItem)
  const renameItem = useStore((s) => s.renameItem)
  const setSplitStyle = useStore((s) => s.setSplitStyle)
  const setSplitColumnVisibility = useStore((s) => s.setSplitColumnVisibility)
  const setSplitSearchable = useStore((s) => s.setSplitSearchable)
  const isSplit = !!item.splitStyle
  return (
    <div className="flex-1 overflow-y-auto scrollbar">
      <Section title={isSplit ? 'Navigation Split View' : 'Stack'}>
        <Row label="Name">
          <input value={item.name} onChange={(e) => renameItem(item.id, e.target.value)} className="field flex-1" />
        </Row>
        {isSplit ? (
          <>
            <Row label="Style">
              <div className="segmented flex-1">
                <button
                  className={item.splitStyle === 'joined' ? 'active' : ''}
                  onClick={() => setSplitStyle(item.id, 'joined')}
                >Joined</button>
                <button
                  className={item.splitStyle === 'separated' ? 'active' : ''}
                  onClick={() => setSplitStyle(item.id, 'separated')}
                >Separated</button>
              </div>
            </Row>
            <div className="text-[10px] text-textMute leading-relaxed mt-1">
              {item.splitStyle === 'joined'
                ? 'Flush two-column layout — sidebar attached, 320pt wide.'
                : 'Sidebar as a 370pt floating dialogue (r=30) inside the window.'}
            </div>
            <Row label="Columns">
              <div className="segmented flex-1">
                <button
                  className={(item.columnVisibility || 'all') === 'all' ? 'active' : ''}
                  onClick={() => setSplitColumnVisibility(item.id, 'all')}
                >All</button>
                <button
                  className={item.columnVisibility === 'doubleColumn' ? 'active' : ''}
                  onClick={() => setSplitColumnVisibility(item.id, 'doubleColumn')}
                >Double</button>
                <button
                  className={item.columnVisibility === 'detailOnly' ? 'active' : ''}
                  onClick={() => setSplitColumnVisibility(item.id, 'detailOnly')}
                >Detail</button>
              </div>
            </Row>
            <Row label="Search">
              <div className="segmented flex-1">
                <button
                  className={(item.searchable || 'none') === 'none' ? 'active' : ''}
                  onClick={() => setSplitSearchable(item.id, 'none')}
                >Off</button>
                <button
                  className={item.searchable === 'sidebar' ? 'active' : ''}
                  onClick={() => setSplitSearchable(item.id, 'sidebar')}
                >Sidebar</button>
                <button
                  className={item.searchable === 'toolbar' ? 'active' : ''}
                  onClick={() => setSplitSearchable(item.id, 'toolbar')}
                >Toolbar</button>
              </div>
            </Row>
          </>
        ) : (
          <Row label="Kind">
            <div className="segmented flex-1">
              <button
                className={item.stackType === 'vstack' ? 'active' : ''}
                onClick={() => updateItem(item.id, { stackType: 'vstack', alignment: 'center' })}
              ><VStackIcon /> VStack</button>
              <button
                className={item.stackType === 'hstack' ? 'active' : ''}
                onClick={() => updateItem(item.id, { stackType: 'hstack', alignment: 'center' })}
              ><HStackIcon /> HStack</button>
              <button
                className={item.stackType === 'zstack' ? 'active' : ''}
                onClick={() => updateItem(item.id, { stackType: 'zstack', alignment: 'center' })}
              ><ZStackIcon /> ZStack</button>
            </div>
          </Row>
        )}
      </Section>

      <Section title="Layout">
        <Row label="Align">
          <StackAlignmentPicker
            stackType={item.stackType}
            value={item.alignment}
            onChange={(v) => updateItem(item.id, { alignment: v })}
          />
        </Row>
        {item.stackType !== 'zstack' && (
          <Row label="Spacing">
            {/*
              SwiftUI default for VStack/HStack `spacing` is `nil` — the system
              picks a context-adaptive value at layout time. We model that as
              `spacing === null` and let the user explicitly opt into a fixed
              point value. The ⨯ button clears the override and returns to
              system spacing (matches SwiftUI's `VStack { ... }` zero-arg form).
            */}
            <IntField
              value={item.spacing == null ? 0 : item.spacing}
              min={0}
              onChange={(v) => updateItem(item.id, { spacing: v })}
            />
            <span className="text-[9px] text-textMute">
              {item.spacing == null ? 'pt · auto' : 'pt'}
            </span>
            <button
              className={`btn btn-ghost text-[9px] ${item.spacing == null ? 'text-accent' : ''}`}
              title="Use SwiftUI's system-adaptive spacing (`spacing: nil`)"
              onClick={() =>
                updateItem(item.id, { spacing: item.spacing == null ? 8 : null })
              }
            >Auto</button>
          </Row>
        )}
        <Row label="Padding">
          <IntField value={item.paddingEdges ? -1 : item.padding} min={0} onChange={(v) => updateItem(item.id, { padding: v, paddingEdges: null })} />
          <span className="text-[9px] text-textMute">pt</span>
          <button
            className={`btn btn-ghost text-[9px] ${item.paddingEdges ? 'text-accent' : ''}`}
            onClick={() => {
              if (item.paddingEdges) {
                updateItem(item.id, { paddingEdges: null })
              } else {
                const p = item.padding || 0
                updateItem(item.id, { paddingEdges: { top: p, bottom: p, leading: p, trailing: p } })
              }
            }}
            title="Per-edge padding"
          >4-edge</button>
        </Row>
        {item.paddingEdges && (
          <div className="grid grid-cols-2 gap-1 mt-1">
            <Row label="Top"><IntField value={item.paddingEdges.top ?? 0} min={0} onChange={(v) => updateItem(item.id, { paddingEdges: { ...item.paddingEdges, top: v } })} /></Row>
            <Row label="Bottom"><IntField value={item.paddingEdges.bottom ?? 0} min={0} onChange={(v) => updateItem(item.id, { paddingEdges: { ...item.paddingEdges, bottom: v } })} /></Row>
            <Row label="Leading"><IntField value={item.paddingEdges.leading ?? 0} min={0} onChange={(v) => updateItem(item.id, { paddingEdges: { ...item.paddingEdges, leading: v } })} /></Row>
            <Row label="Trailing"><IntField value={item.paddingEdges.trailing ?? 0} min={0} onChange={(v) => updateItem(item.id, { paddingEdges: { ...item.paddingEdges, trailing: v } })} /></Row>
          </div>
        )}
        {(item.stackType === 'grid' || item.stackType === 'lazyVGrid' || item.stackType === 'lazyHGrid') && (
          <>
            <Row label="Sizing">
              <div className="segmented flex-1">
                <button
                  className={(item.gridMode || 'fixed') === 'fixed' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { gridMode: 'fixed' })}
                >Fixed</button>
                <button
                  className={item.gridMode === 'adaptive' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { gridMode: 'adaptive' })}
                >Adaptive</button>
              </div>
            </Row>
            {(item.gridMode || 'fixed') === 'fixed' ? (
              <Row label={item.stackType === 'lazyHGrid' ? 'Rows' : 'Columns'}>
                <IntField value={item.columns || 2} min={1} max={12} onChange={(v) => updateItem(item.id, { columns: v })} />
              </Row>
            ) : (
              <Row label="Min">
                <IntField value={item.minColumnWidth ?? 140} min={40} max={600} onChange={(v) => updateItem(item.id, { minColumnWidth: v })} />
                <span className="text-[9px] text-textMute">pt</span>
              </Row>
            )}
          </>
        )}
        {item.stackType === 'scrollView' && (
          <>
            {/*
              Spec §1.24 — `ScrollView(_ axes:, showsIndicators:)`. Default
              axis is `.vertical`; indicators default to true. Both fields
              feed the SwiftUI exporter so the generated code matches.
            */}
            <Row label="Axis">
              <div className="segmented flex-1">
                <button className={(item.scrollAxis || 'vertical') === 'vertical' ? 'active' : ''} onClick={() => updateItem(item.id, { scrollAxis: 'vertical' })}>Vertical</button>
                <button className={item.scrollAxis === 'horizontal' ? 'active' : ''} onClick={() => updateItem(item.id, { scrollAxis: 'horizontal' })}>Horizontal</button>
                <button className={item.scrollAxis === 'both' ? 'active' : ''} onClick={() => updateItem(item.id, { scrollAxis: 'both' })}>Both</button>
              </div>
            </Row>
            <Row label="Indicators">
              <div className="segmented flex-1">
                <button className={(item.scrollShowsIndicators ?? true) ? 'active' : ''} onClick={() => updateItem(item.id, { scrollShowsIndicators: true })}>Show</button>
                <button className={!(item.scrollShowsIndicators ?? true) ? 'active' : ''} onClick={() => updateItem(item.id, { scrollShowsIndicators: false })}>Hide</button>
              </div>
            </Row>
          </>
        )}
        {item.stackType === 'viewThatFits' && (
          <Row label="Fits Axes">
            {/*
              `in:` defaults to `[.horizontal, .vertical]`. Spec §1.24 —
              the runtime evaluates each child against the available space
              along these axes and picks the first that fits.
            */}
            <div className="segmented flex-1">
              <button className={(item.fitsAxes || 'both') === 'both' ? 'active' : ''} onClick={() => updateItem(item.id, { fitsAxes: 'both' })}>Both</button>
              <button className={item.fitsAxes === 'horizontal' ? 'active' : ''} onClick={() => updateItem(item.id, { fitsAxes: 'horizontal' })}>H Only</button>
              <button className={item.fitsAxes === 'vertical' ? 'active' : ''} onClick={() => updateItem(item.id, { fitsAxes: 'vertical' })}>V Only</button>
            </div>
          </Row>
        )}
        <div className="text-[10px] text-textMute leading-relaxed mt-1">
          {STACK_TYPES[item.stackType]?.description}
        </div>
      </Section>

      {item.stackType === 'section' && (
        <Section title="Section">
          <Row label="Header">
            <input value={item.sectionHeader || ''} onChange={(e) => updateItem(item.id, { sectionHeader: e.target.value })} className="field flex-1" placeholder="Section Title" />
          </Row>
          <Row label="Footer">
            <input value={item.sectionFooter || ''} onChange={(e) => updateItem(item.id, { sectionFooter: e.target.value })} className="field flex-1" placeholder="Optional footnote" />
          </Row>
        </Section>
      )}

      {item.stackType === 'disclosure' && (
        <Section title="Disclosure">
          <Row label="Label">
            <input value={item.disclosureLabel || ''} onChange={(e) => updateItem(item.id, { disclosureLabel: e.target.value })} className="field flex-1" />
          </Row>
          <Row label="Expanded">
            <div className="segmented flex-1">
              <button className={item.expanded ? 'active' : ''} onClick={() => updateItem(item.id, { expanded: true })}>Open</button>
              <button className={!item.expanded ? 'active' : ''} onClick={() => updateItem(item.id, { expanded: false })}>Closed</button>
            </div>
          </Row>
        </Section>
      )}

      {item.stackType === 'navigationStack' && (
        <Section title="Navigation">
          <Row label="Title">
            <input value={item.navTitle || ''} onChange={(e) => updateItem(item.id, { navTitle: e.target.value })} className="field flex-1" placeholder="Navigation Title" />
          </Row>
          <Row label="Active">
            <IntField value={item.activeChild ?? 0} min={0} onChange={(v) => updateItem(item.id, { activeChild: v })} />
          </Row>
        </Section>
      )}

      {item.stackType === 'tabView' && (
        <Section title="Navigation Stack (TabView)">
          <div className="text-[10px] text-textMute mb-2">
            Only the active Tab is visible at a time. Add Tab children in the layers panel.
          </div>
          <Row label="Active Tab">
            <IntField value={item.activeTab ?? 0} min={0} onChange={(v) => updateItem(item.id, { activeTab: v })} />
            <span className="text-[9px] text-textMute">index</span>
          </Row>
        </Section>
      )}

      {/* Spec §1.26 — Toolbar items declare a placement (.principal,
          .topBarLeading, .bottomOrnament, etc.). On visionOS the
          .bottomOrnament placement materialises the bottom-edge ornament
          look. */}
      {(item.stackType === 'toolbarItem' || item.stackType === 'toolbarItemGroup') && (
        <Section title="Toolbar Placement">
          <Row label="Placement">
            <select
              value={item.toolbarPlacement || 'automatic'}
              onChange={(e) => updateItem(item.id, { toolbarPlacement: e.target.value })}
              className="field flex-1 cursor-pointer"
            >
              <option value="automatic">Automatic</option>
              <option value="principal">Principal (center)</option>
              <option value="topBarLeading">Top Bar Leading</option>
              <option value="topBarTrailing">Top Bar Trailing</option>
              <option value="navigation">Navigation</option>
              <option value="bottomBar">Bottom Bar</option>
              <option value="bottomOrnament">Bottom Ornament</option>
              <option value="primaryAction">Primary Action</option>
              <option value="secondaryAction">Secondary Action</option>
              <option value="confirmationAction">Confirmation Action</option>
              <option value="cancellationAction">Cancellation Action</option>
              <option value="destructiveAction">Destructive Action</option>
              <option value="status">Status</option>
              <option value="title">Title</option>
              <option value="subtitle">Subtitle</option>
              <option value="keyboard">Keyboard</option>
            </select>
          </Row>
          <div className="text-[10px] text-textMute leading-snug mt-1">
            Drop interactive children inside this placement; the exporter wraps them in <code>ToolbarItem(placement:)</code>.
          </div>
        </Section>
      )}

      {item.stackType === 'tab' && (
        <Section title="Tab">
          <Row label="Label">
            <input
              value={item.tabLabel || ''}
              onChange={(e) => updateItem(item.id, { tabLabel: e.target.value })}
              className="field flex-1"
              placeholder="Tab name"
            />
          </Row>
          <Row label="Icon">
            <input
              value={item.tabIcon || ''}
              onChange={(e) => updateItem(item.id, { tabIcon: e.target.value || null })}
              className="field flex-1"
              placeholder="SF Symbol name (e.g. star)"
            />
          </Row>
          <div className="text-[10px] text-textMute mt-1">
            Use any SF Symbol name. The parent TabView controls which tab is active.
          </div>
        </Section>
      )}

      <Section title="Frame">
        {(() => {
          const wMode = item.widthMode || (item.fixedWidth != null ? 'fixed' : 'fit')
          return (
            <Row label="Width">
              <div className="segmented flex-1">
                <button
                  className={wMode === 'fit' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { widthMode: 'fit', fixedWidth: null })}
                  title="Hug contents"
                >Fit</button>
                <button
                  className={wMode === 'fixed' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { widthMode: 'fixed', fixedWidth: item.fixedWidth ?? 300 })}
                  title=".frame(width:)"
                >Fixed</button>
                <button
                  className={wMode === 'fill' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { widthMode: 'fill' })}
                  title=".frame(maxWidth: .infinity)"
                >Fill</button>
              </div>
            </Row>
          )
        })()}
        {(item.widthMode || (item.fixedWidth != null ? 'fixed' : 'fit')) === 'fixed' && (
          <Row label="W">
            <div className="flex-1">
              <input
                type="number"
                step={1}
                min={0}
                placeholder="pt"
                value={item.fixedWidth ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : parseFloat(e.target.value)
                  updateItem(item.id, { fixedWidth: isNaN(v) ? null : Math.max(0, v) })
                }}
                className="field"
              />
            </div>
            <span className="text-[9px] text-textMute">pt</span>
          </Row>
        )}
        {(() => {
          const hMode = item.heightMode || (item.fixedHeight != null ? 'fixed' : 'fit')
          return (
            <Row label="Height">
              <div className="segmented flex-1">
                <button
                  className={hMode === 'fit' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { heightMode: 'fit', fixedHeight: null })}
                  title="Hug contents"
                >Fit</button>
                <button
                  className={hMode === 'fixed' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { heightMode: 'fixed', fixedHeight: item.fixedHeight ?? 200 })}
                  title=".frame(height:)"
                >Fixed</button>
                <button
                  className={hMode === 'fill' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { heightMode: 'fill' })}
                  title=".frame(maxHeight: .infinity)"
                >Fill</button>
              </div>
            </Row>
          )
        })()}
        {(item.heightMode || (item.fixedHeight != null ? 'fixed' : 'fit')) === 'fixed' && (
          <Row label="H">
            <div className="flex-1">
              <input
                type="number"
                step={1}
                min={0}
                placeholder="pt"
                value={item.fixedHeight ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : parseFloat(e.target.value)
                  updateItem(item.id, { fixedHeight: isNaN(v) ? null : Math.max(0, v) })
                }}
                className="field"
              />
            </div>
            <span className="text-[9px] text-textMute">pt</span>
          </Row>
        )}
      </Section>

      <Section title=".ornament()">
        <div className="text-[9px] text-textMute mb-1">attachmentAnchor — required (spec §1.26)</div>
        {/*
          Spec §1.26 / §3.4 — `OrnamentAttachmentAnchor` factories are
          `.scene(UnitPoint3D)` (the visionOS default; renders in the
          scene-relative coordinate space) or `.parent(_:)` (visionOS 26+;
          anchored to the owning view). Both share the same UnitPoint3D
          values, so we expose the mode separately from the anchor edge.
        */}
        <Row label="Mode">
          <div className="segmented flex-1">
            <button
              className={(item.ornamentAnchorMode || 'scene') === 'scene' ? 'active' : ''}
              onClick={() => updateItem(item.id, { ornamentAnchorMode: 'scene' })}
            >.scene</button>
            <button
              className={item.ornamentAnchorMode === 'parent' ? 'active' : ''}
              onClick={() => updateItem(item.id, { ornamentAnchorMode: 'parent' })}
              title="visionOS 26+ — anchors to the owning view"
            >.parent</button>
          </div>
        </Row>
        <Row label="Anchor">
          <Select
            value={item.ornament || ''}
            options={[
              { value: '',                label: '— None —' },
              { value: 'leading',         label: '.leading' },
              { value: 'trailing',        label: '.trailing' },
              { value: 'top',             label: '.top' },
              { value: 'bottom',          label: '.bottom' },
              { value: 'topLeading',      label: '.topLeading' },
              { value: 'topTrailing',     label: '.topTrailing' },
              { value: 'bottomLeading',   label: '.bottomLeading' },
              { value: 'bottomTrailing',  label: '.bottomTrailing' },
              { value: 'center',          label: '.center' }
            ]}
            onChange={(v) => updateItem(item.id, { ornament: v || null })}
          />
        </Row>
        <div className="text-[9px] text-textMute mt-2 mb-1">contentAlignment — ornament's own alignment</div>
        <Row label="Alignment">
          <Select
            value={item.ornamentContentAlignment || 'center'}
            options={[
              { value: 'center',        label: '.center' },
              { value: 'leading',       label: '.leading' },
              { value: 'trailing',      label: '.trailing' },
              { value: 'top',           label: '.top' },
              { value: 'bottom',        label: '.bottom' },
              { value: 'topLeading',    label: '.topLeading' },
              { value: 'topTrailing',   label: '.topTrailing' },
              { value: 'bottomLeading', label: '.bottomLeading' },
              { value: 'bottomTrailing',label: '.bottomTrailing' }
            ]}
            onChange={(v) => updateItem(item.id, { ornamentContentAlignment: v })}
          />
        </Row>
        <div className="text-[9px] text-textMute mt-2 mb-1">visibility</div>
        <Row label="Visibility">
          <div className="segmented flex-1">
            {['automatic', 'visible', 'hidden'].map((v) => (
              <button
                key={v}
                className={(item.ornamentVisibility || 'automatic') === v ? 'active' : ''}
                onClick={() => updateItem(item.id, { ornamentVisibility: v })}
              >{v}</button>
            ))}
          </div>
        </Row>
        <div className="text-[9px] text-textMute mt-2 mb-1">offsetFromBoundary</div>
        <Row label="Offset">
          <IntField value={item.ornamentOffset ?? 0} onChange={(v) => updateItem(item.id, { ornamentOffset: v })} />
          <span className="text-[9px] text-textMute">pt</span>
        </Row>
        <div className="text-[9px] text-textMute mt-2 mb-1">Background &amp; Material</div>
        <Row label="Background">
          <SemanticColorPicker
            token={item.background}
            onChange={(t) => updateItem(item.id, { background: t })}
          />
        </Row>
        <Row label="Material">
          <Select
            value={item.material || 'regular'}
            options={MATERIAL_ORDER.map((k) => ({ value: k, label: `${MATERIALS[k].label} · ${Math.round(MATERIALS[k].opacity * 100)}%` }))}
            onChange={(v) => updateItem(item.id, { material: v })}
          />
        </Row>
      </Section>

      <Section title="Scroll View">
        <Row label="Scrollable">
          <div className="segmented flex-1">
            <button className={item.scrollable ? 'active' : ''} onClick={() => updateItem(item.id, { scrollable: true })}>On</button>
            <button className={!item.scrollable ? 'active' : ''} onClick={() => updateItem(item.id, { scrollable: false })}>Off</button>
          </div>
        </Row>
        <div className="text-[10px] text-textMute">Draws a scroll indicator along the trailing edge.</div>
      </Section>

      <Section title="Environment" defaultOpen={false}>
        <Row label="Font"><Select value={item.environment?.font || ''} options={[{ value: '', label: '— Inherit —' }, ...TEXT_STYLE_ORDER.map((k) => ({ value: k, label: TEXT_STYLES[k].label }))]} onChange={(v) => updateItem(item.id, { environment: { ...item.environment, font: v || null } })} /></Row>
        <Row label="Foreground"><SemanticColorPicker token={item.environment?.foregroundStyle} onChange={(t) => updateItem(item.id, { environment: { ...item.environment, foregroundStyle: t } })} /></Row>
        <Row label="Direction">
          <div className="segmented flex-1">
            <button className={(item.environment?.layoutDirection || 'leftToRight') === 'leftToRight' ? 'active' : ''} onClick={() => updateItem(item.id, { environment: { ...item.environment, layoutDirection: 'leftToRight' } })}>LTR</button>
            <button className={(item.environment?.layoutDirection) === 'rightToLeft' ? 'active' : ''} onClick={() => updateItem(item.id, { environment: { ...item.environment, layoutDirection: 'rightToLeft' } })}>RTL</button>
          </div>
        </Row>
        <Row label="Locale"><input value={item.environment?.locale || ''} onChange={(e) => updateItem(item.id, { environment: { ...item.environment, locale: e.target.value } })} className="field flex-1" placeholder="en-US" /></Row>
      </Section>

      <ModifierStack item={item} updateItem={updateItem} />

      <Section title="Info" defaultOpen={false}>
        <div className="text-[10px] text-textMute font-mono">ID: {item.id}</div>
      </Section>
    </div>
  )
}
