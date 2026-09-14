# Round-trip Audit — Code ↔ Visual

**Date:** 2026-09-14 · **Branch:** `feat/inspector-materials-overhaul` · **Working tree:** clean

*Audited at `5b294cb`. Phases 2.1–2.6 and 1.4 have landed since; each is marked
where it changed a finding.*

The goal this document serves, in the project's own framing:

> **Stage 1 —** everything the code can express is *visualised* to produce the
> same visual result.
> **Stage 2 —** reverse the process, so the code made from the visual matches
> what was on screen.

This is an audit of how close the app is to that today, defect by defect, plus
a staged plan to close the distance. Every claim below was verified against the
source on the commit named above; the reproduction is given with each finding.

---

## 1. Verdict

**The system is in good shape and the gap is narrower than it looks.** It is
not missing a subsystem — it has a canvas renderer *and* a SwiftUI generator,
both mature, both driven off the same registries. What it is missing is a
**contract between them**. Nothing in the build fails when a property is read
by one side and ignored by the other, so the two have drifted apart.

That contract now exists: **`src/parity.test.js` (§6.0) is built and green**,
and it measures the drift exactly rather than by sample. It found **114 open
divergences**; **Stage 2 is complete, Stage 1 is under way, and the count is
now 97**.

| Shape | At the audit | Now |
| ----- | ------------ | --- |
| Canvas honours a field, exporter drops it | 28 fields | 16 |
| Exporter emits a property, canvas ignores it | 83 fields + modifiers | 75 |
| Neither side reads a field the inspector writes | 7 fields | 6 |
| Two fields for one concept, kept in sync by hand | 4 fields | **0** |
| Generated lines that do not compile | 1 (shipped in a template) | **0** |

The harness raised the original count from the ~30 this audit first found by
hand, because it sweeps all 56 panel types rather than the containers alone.
Those extra findings are defects #17–#20 in §8; #21–#28 were found while
fixing, several of them user-visible bugs the audit had not reached
(ArrowUp moving a panel down, a split view's detail pane vanishing from the
export, every button sized differently by the layout engine and the renderer).

**Where things stand.** Stage 2 (visual → code) is done: the export now
carries sizing, per-edge padding, real ScrollViews, free placement and a
compile-clean enum surface. **Stage 1 (code → visual) has started** — phase
1.4 landed and scrollable stacks now scroll — and it is where the remaining 97
sit, dominated by defect #5 (17 modifiers that emit correct Swift and draw
nothing) and #7 (8 presentation fields with no canvas equivalent).

**A scoping correction, found while planning Stage 1.** Phases 1.1–1.6 as
written below retire exactly the 35 divergences that carry a defect number —
100 → 65. The other 65 have no phase: **#17 (18), #19 (13) and #20 (10)**
account for 41 of them and the ornament / volume / presentation-metric tail
for the rest. So the plan as drafted closes about a third of what is left, and
#17 in particular deserves a phase of its own: the audit files it as High but
never schedules it, it is the largest single block after #5, and it is a
wrong-pixels bug rather than an unread field — a slider authored `0…100` at
value `50` draws hard right on the canvas and centred on device. Sequenced
below as **1.7**, though it is cheap enough to take before 1.1.

Estimate for Stage 1 as originally scoped ≈ 4–6 working days; adding #17,
#19 and #20 roughly doubles it.

---

## 2. What exists, and how solid it is

Measured on the commit above: **33,857 lines** across 78 source files.

| Subsystem | Size | Status | Notes |
| --------- | ---- | ------ | ----- |
| **Store** (`src/store/`) | 2,400 ln | ✅ Solid | 8 slices over one flat `items` array. Undo/redo, clipboard, persistence all covered by tests (51 assertions). |
| **Layout engine** (`layout.js`) | 807 ln → 850 | ✅ Solid | `layoutStack` / `resolvedChildSizes` agreement is pinned across every stack in every template. 34 tests since 1.4 added scroll anchoring. |
| **Text pipeline** (`text.js`, `textMeasure.js`) | 410 ln | ✅ Solid | Full tighten → scale → wrap → truncate, on real Inter advance widths. 41 tests. Best-tested part of the app. |
| **Panel registry** (`panels/registry.js`) | 1,840 ln | ✅ Solid | 56 view types, every one with `defaults` + `emit()`. No gaps. |
| **Modifier registry** (`modifiers/registry.js`) | 887 ln | 🟡 Half-wired | 43 modifiers, all 43 emit Swift, **25 reach the canvas** (23 before 1.4). See §4.1. |
| **SwiftUI exporter** (`export/swiftui.js`) | 1,081 ln → 1,400 | ✅ Solid *(was: good, lossy)* | Idiomatic output — real `ZStack` / `.toolbar` / `.ornament` / `.sheet`. Since Stage 2 it also carries frames, per-edge padding, ScrollViews and free placement. See §5. |
| **RealityKit exporter** (`export/realitykit.js`) | 595 ln | ✅ Strongest | Real `ModelEntity`, `PhysicallyBasedMaterial`, `AnchorEntity`, attachments, collision shapes. Output is production-grade. |
| **Behaviour codegen** (`export/behaviors.js`) | 680 ln | ✅ Honest | 8/12 triggers and 11/15 actions generate real Swift; the remaining 8 are emitted as a documented “still to wire up” block naming the real API. Deliberate and clearly marked. |
| **Behaviour runtime** (`behaviors/runtime.js`) | 973 ln | 🟡 Near-complete | 15/15 actions, 11/12 triggers. `rotateGesture` is missing. See §4.4. |
| **Canvas renderer** (`Panel3D.jsx`, `SceneTree.jsx`, `Entity3D.jsx`) | 5,476 ln | 🟡 Good, uneven | 48/56 view types have a dedicated renderer; 8 fall back to a generic plate. See §4.2. |
| **Templates** (`templates/index.js`) | 3,102 ln | ✅ Re-seeded in 2.3 *(was: stale)* | 6 window + 6 volume + 2 blanks + 6 legacy. The two that overflow are scrollable and now export a real ScrollView. See §5.3. |

### Quality gates — all green

```bash
npm run check
```

- **Tests:** 463 passing, 10 files (365 at the audit; +89 from the harness and
  the Stage 2 phases, +9 from phase 1.4).
- **Lint:** 0 errors, 55 warnings (all `react-hooks/exhaustive-deps` hygiene in
  `Panel3D.jsx` / `SceneTree.jsx` — no correctness issues).
- **Build:** passes.

The existing suite is genuinely good. Its blind spot was precisely this
audit's subject: it checked that each side is *internally* consistent (the
export is structurally valid Swift; the layout engine agrees with itself) but
never that the two sides agree with *each other*. `src/parity.test.js` now
covers that seam — see §6.0.

---

## 3. Method

Findings were produced by static extraction rather than reading, so they are
exhaustive rather than sampled. Each was then confirmed by running the code.

- Registry keys were sliced out of `PANELS`, `MODIFIERS`, `TRIGGERS`,
  `ACTIONS` and the factory defaults, then cross-referenced against the files
  that consume them (`Panel3D.jsx`, `SceneTree.jsx`, `layout.js` on the canvas
  side; `swiftui.js`, `registry.js`, `realitykit.js` on the export side).
- Overflow and export output were produced by building each template with
  `buildTemplate(key)` and running `computeSize` / `exportSwiftUI` over it.
- The running app was checked at 1180×760 with the `settings` template loaded.

§9 lists the scripts so every number here can be regenerated.

---

## 4. Stage 1 — Code → Visual

*Can everything the system can express be drawn?*

### 4.1 Twenty modifiers export Swift but change nothing on the canvas

`summarizeModifiers()` reduces the ordered modifier stack to a flat struct the
renderer reads. All 43 modifiers write into that struct; the renderer only ever
reads **23** of the fields. The other 20 are silently inert:

| Modifier | Should it be visible? | Why it matters |
| -------- | --------------------- | -------------- |
| `background` | **Yes** | A user adds `.background(.blue)` and the canvas stays unchanged. Most-reached-for modifier in the list. |
| `overlay` | **Yes** | Same. |
| `foregroundStyle` | **Yes** | Canvas colours text from `panel.textColor` instead; the modifier is ignored, so the two disagree the moment the user uses the stack. |
| `clipShape` | **Yes** | Corner/circle clipping is invisible until export. |
| `glassBackgroundEffect` | **Yes** | The app's signature material — inert as a modifier. |
| `containerBackground` | **Yes** | |
| `tint` | **Yes** | Control accent colour. |
| `aspectRatio` | **Yes** | Changes the frame; the canvas keeps the old one. |
| `zIndex` | **Yes** | Draw order — currently tree order only. |
| `fontDesign` | **Yes** | `.rounded` / `.serif` / `.monospaced` never swap the rendered face. |
| `monospacedDigit` | Minor | Tabular figures. |
| `navigationTitle` | **Yes** | Canvas reads `stack.navTitle` instead — two sources for one thing. |
| `toolbarBackground` | **Yes** | |
| ~~`scrollIndicators`~~ | **Wired in 1.4** | Was meaningless until stack scrolling worked; now hides the scroll thumb. |
| ~~`scrollDisabled`~~ | **Wired in 1.4** | Now refuses the wheel, as it does on device. |
| `layoutPriority` | **Yes** (layout) | Writes nothing to the summary at all — affects neither side's layout. |
| `hoverEffect` | Partial | Canvas has its own hover path off `panel.hoverEffect`; the modifier is a second, ignored source. |
| `hoverEffectDisabled` | Partial | Same. |
| `contentShape` | No | Hit-testing only — correctly invisible. |
| `customModifier` | No | Raw Swift, uninterpretable by design. |

So **17 of 20 are real gaps** (15 of them still open after 1.4 wired the two
scroll modifiers); `contentShape` and `customModifier` are correct
as-is, and `layoutPriority` is a distinct bug (it is a no-op on both sides).

> `src/modifiers/registry.js:867` — `summarizeModifiers`
> `src/components/Panel3D.jsx:467` — the only consumer

### 4.2 Eight view types fall through to a generic plate

48 of 56 types have a dedicated branch in `Panel3D.jsx`. The rest render as a
plain rounded rectangle with a text label:

| Type | Exports | Canvas draws | Severity |
| ---- | ------- | ------------ | -------- |
| `form` | A real `Form { … }` with every row | Empty plate — **no rows** | **High** — the row data is authored in the inspector and invisible |
| `outlinegroup` | A generated `OutlineNode` tree with every row | Empty plate — **no rows** | **High** — same |
| `confirmationdialog` | `.confirmationDialog(…)` modifier on the parent | Inline content sitting in the layout | **High** — wrong *place*, not just wrong pixels |
| `inspector` | `.inspector(…)` modifier on the parent | Inline content sitting in the layout | **High** — same |
| `navigationlink` | `NavigationLink(…)` | Plain text, no chevron / link affordance | Medium |
| `popover` | `.popover(…)` | Plate, no arrow or presentation framing | Low |
| `sheet` | `.sheet(…)` | Plate (positioned correctly, detents honoured) | Low |
| `canvas` | Placeholder `Rectangle()` | Plain plate | **None** — the two already agree |

`confirmationdialog` and `inspector` are the sharp ones. `SceneTree.jsx:784`
lists only `['sheet', 'popover', 'alert']` as presentation types, while
`swiftui.js:747` lists five. The two extra types are therefore laid out as
ordinary children on screen and emitted as modal modifiers in the code.

### 4.3 Scrollable stacks draw a scrollbar that does not scroll ✅ **fixed in 1.4**

*Original finding.* `stack.scrollable` renders a decorative bar
(`SceneTree.jsx:529`) and stops there. Only `win.scrollable` wires a wheel
handler (`SceneTree.jsx:1015`). Content is also centred rather than
top-aligned, so an overflowing stack is clipped at *both* ends and its top is
unreachable.

Two shipped templates rely on it:

```
settings : root VStack 688×1325 pt inside an 800 pt window
article  : root VStack 957×1255 pt inside an 800 pt window
```

Loading the `settings` template puts you mid-page with the title off-screen and
no way to scroll to it. This is the most visible “it's broken” moment in the
app. (The exporter does not save it either — §5.2.)

See phase **1.4** below for what shipped.

### 4.4 `rotateGesture` has no preview runtime

It is in the trigger vocabulary, appears in the inspector, and **generates real
Swift**, but `behaviors/runtime.js` matches only `'drag'` (line 901) and
`'pinch'` (line 910) among the pointer triggers. Authoring a rotate behaviour
produces a preview that does nothing and code that works.

### 4.5 Dead inspector controls

`WindowProps.jsx:139–152` exposes Immersion Style, Window Resizability and
Gestures. Only `spatial.hoverEffect` is ever read (`store/helpers.js:93`). The
other three reach neither the canvas nor the export — they are controls that do
nothing at all.

Same class, lower stakes: `blur` / `blurAmount` on stacks and windows are
canvas-only, and `ornamentOffset` is read by neither side.

---

## 5. Stage 2 — Visual → Code

*Does the generated code reproduce what was on screen?*

The exporter's **structure** is right — idiomatic `ZStack` / `VStack`, real
`.toolbar`, `.ornament`, `.sheet`, `.searchable`, and a RealityKit path that is
frankly excellent. The problem is **sizing and a handful of wrong emissions**.

### 5.1 Explicit sizing is dropped entirely — the biggest gap

`renderStack()` (`swiftui.js:492–651`) emits the stack opener, the children,
`.padding`, `.background`, `.clipShape` — and **never a `.frame(…)`**. Panels
are the same. So these five fields are canvas-only:

```
widthMode   heightMode   fixedWidth   fixedHeight   paddingEdges
```

**Correction (found while implementing 2.1).** The example below says the
designer sees a 640 pt column. It does not: `computeSize` reads `fixedWidth`
for stacks, the templates set `size`, and the two are different fields — so
the Account row hugs at 272 pt on the canvas too. The export gap was real,
but so is a second one underneath it (defect #24). The exporter now matches
whatever the canvas resolves, which is the contract that matters.

Concretely, from the `settings` template as it was:

```swift
// Designer shows a 640 pt column.  Export:
Text("Settings").font(.largeTitle).foregroundStyle(.primary)
    .multilineTextAlignment(.leading)          // ← no .frame(width: 640)
HStack(spacing: 14) { … }
    .padding(16)                               // ← no .frame(width: 640, height: 92)
    .background(.thinMaterial)
```

**33 items across the 12 templates** carry an explicit size that never reaches
the generated file. Opened in Xcode, they hug their content instead of holding
the column the designer laid out.

`paddingEdges` (per-edge padding, fully wired in `layout.js:56` and editable in
`StackProps.jsx:164`) collapses to the uniform `.padding(n)` on export.

> Note: the newer *modifier-driven* Fit/Fixed/Fill path **does** export
> correctly — clicking Fixed drops a `frame` entry into `item.modifiers`, and
> `renderModifiers` emits it. The gap is that the store factories, the
> templates and the stack inspector still write the older top-level fields.
> Two mechanisms for one concept; only one of them exports.

### 5.2 Emissions that are wrong, not just lossy

**`.buttonStyle(.destructive)` does not compile.** `destructive` is a
`ButtonRole`, not a `ButtonStyle`. `appleSystem.js:281` says so in a comment —
and `registry.js:243` emits it anyway. The `settings` template sets
`buttonStyle: 'destructive'` (`templates/index.js:1025`), so **a shipped
template produces a file that fails to build**. There is already a correct
`buttonRole` field that emits `Button(role: .destructive)`.

`swiftValidate.js` will not catch this — it checks brace balance and string
termination, not Swift semantics.

**`stack.scrollable` emits a comment instead of code:**

```swift
    .padding(24)
    // wrap in ScrollView { … } for scrollable content
```

> `swiftui.js:643`

**Window padding is applied on the wrong side of the frame:**

```swift
.frame(width: 1200, height: 800)
.padding(14)                       // → 1228 × 828 total, content 1200 × 800
```

The canvas treats `win.padding` as an *inner* inset (`SceneTree.jsx:1046`:
`innerW = w - padU * 2`), giving a 1200 × 800 plate with a 1172 × 772 content
area. Swapping the two lines makes the code match the canvas exactly.

> `swiftui.js:793–794`

**A `List` inside a `VStack` with no height** is ambiguous/greedy in SwiftUI,
while the canvas computes an exact height from the row count
(`computeListHeightPt`). Fixed by §5.1.

### 5.3 Two field names for one concept

Buttons carry duplicate pairs — one drives the canvas, the other the export:

| Concept | Canvas reads | Export reads |
| ------- | ------------ | ------------ |
| Size preset | `buttonSize` | `controlSize` |
| Border shape | `buttonShape` | `buttonBorderShape` |

The inspector writes both together (`inspectors.jsx:428–444`), so
inspector-authored buttons are fine. **The templates set only the canvas pair**,
so every template button exports without its size and shape.

### 5.4 Free panel position is not exported

A panel parented directly to a window is draggable (`Panel3D.jsx:660`) and its
`position` places it on the plate (`SceneTree.jsx:1060`). `renderPanel()` emits
no `.position` / `.offset`, so every free-placed control lands centred in the
exported `ZStack`.

No template does this (verified: 0 of 173 panels), so it only bites
user-authored scenes — but the drag gesture invites exactly that.

### 5.5 Behaviour coverage — deliberate, and correctly signposted

| | Preview runtime | Swift export |
| --- | --- | --- |
| **Triggers (12)** | 11 — missing `rotateGesture` | 8 — `proximity`, `inView`, `animationFinished`, `hover` documented, not generated |
| **Actions (15)** | 15 (`playAnimation` approximated as a 0.4 s no-op) | 11 — `follow`, `orbit`, `shaderEffect`, `repeat` documented, not generated |

The undone ones are emitted as a `// MARK: - Behaviors still to wire up` block
that names the real RealityKit API for each. This is the right call and should
stay; the improvement is to **surface it in the UI** so the designer knows
before export, not after.

### 5.6 Documentation drift

`README.md:197` says 55 panel types (actual: **56**); `:200` says 42 modifiers
(actual: **43**).

---

## 6. Plan

Ordered so each phase makes the next one safe. Phase 0 first — without it the
rest cannot be verified, and every fix can silently regress.

### 6.0 — Parity harness ✅ **done**

`src/parity.test.js` + `src/parity.baseline.js`, 13 tests, green. It mirrors
what `layout.test.js` already does for `layoutStack` vs `resolvedChildSizes`,
one level up: pin two code paths that must agree.

**What it checks**

1. **Field parity.** Reads the factory defaults at runtime, then asks of the
   live source which side mentions each field. Every asymmetry must be
   declared in the baseline with a tier and a reason.
2. **Modifier visibility.** Runs each of the 43 `summarize` functions against
   a recording `Proxy` (with every argument forced non-null, since `.frame()`
   writes nothing at its defaults) and checks whether any field it writes is
   one a renderer reads.
3. **Emission sanity.** Builds a scene holding one panel of *every* registered
   type plus all 20 templates, then validates every `.modifier(.case)` against
   the real SwiftUI API surface. Also pins that a scrollable stack exports a
   real `ScrollView`.
4. **Containment.** No non-scrollable content exceeds its window.

**A ratchet, not a red build.** The plan originally called for four *failing*
tests. Shipping a red CI is worse than useless — it trains people to ignore
it. Instead the baseline ledger records today's 114 divergences, and the test
asserts the computed set matches it **exactly**. That is strictly stronger:

- wire a new field into one side only → fails, naming the field
- close a divergence but leave its entry → fails, telling you to delete it
- debt rises above `DEBT_CEILING` → fails
- debt drops below the ceiling → warns, telling you to lower it

So the ledger can neither grow silently nor lie about work already done, and
`npm test` prints the inventory grouped by defect number on every run.

Verified by perturbation: adding an unwired field, leaving a stale entry, and
removing the `.buttonStyle(.destructive)` declaration each produce a failure
that names the exact cause.

**Where the debt sits today**

| Ledger | Debt | Exempt |
| ------ | ---- | ------ |
| Stack fields | 16 | 3 |
| Window fields | 9 | 2 |
| Panel fields | 68 | 25 |
| Modifier visibility | 18 | 2 |
| Invalid emissions | 1 | — |
| Missing ScrollViews | 2 | — |
| **Total** | **114** | **32** |

One design note for whoever extends it: the field scan is a coverage
heuristic (does this side's source contain `.someField`), not a proof. It errs
toward leniency on purpose, so it has no false alarms to train anyone to skip
it. The other three checks run the real code and are exact.

---

### Stage 1 — Code → Visual *(~4–6 days)*

**1.1 — Wire the 17 inert modifiers into the renderer** *(2 days)*
Order of value: `background`, `overlay`, `foregroundStyle`, `clipShape`,
`tint`, `glassBackgroundEffect`, `containerBackground`, then `aspectRatio`,
`zIndex`, `fontDesign`, and the chrome ones. Fix `layoutPriority` to write into
the summary and be honoured by `layout.js`.
*Acceptance:* parity test 2 passes with only `contentShape` and
`customModifier` exempt.

**1.2 — Give `form` and `outlinegroup` real row rendering** *(1 day)*
Both already carry `rows` and a `rowHeight`; `list` and `table` have working
row overlays to copy from (`Panel3D.jsx:1444`, `:1639`).

**1.3 — Route `confirmationdialog` and `inspector` as presentations** *(½ day)*
Single-line fix: align `SceneTree.jsx:784` with the exporter's list at
`swiftui.js:747`. Then give each a presentation chrome consistent with `alert`.

**1.4 — Make stack scrolling real** ✅ **done**

A scrollable stack is now a real viewport: content is anchored to the leading
edge of the axis it scrolls, the wheel moves it, it is clipped to the stack's
own frame, and the indicator reports position instead of decorating the edge.
`settings` and `article` are usable again. Parity debt 100 → 97, retiring
defect #4.

Four things worth knowing:

- **Which views scroll is now one function, and it mirrors the exporter.**
  `scrollAxesOf` in `layout.js` answers for both sides: the `scrollView` stack
  TYPE always scrolls, any other plain stack scrolls on the `scrollable` FLAG,
  and the containers that bring their own scrolling — toolbars,
  NavigationSplitView, Tab bodies, Section, DisclosureGroup — never do,
  because each returns early in `renderStack` and never receives a ScrollView.
  A test asserts the predicate against **what the generator actually emits**
  for all 18 stack types rather than against the list the predicate is built
  from, since comparing it to its own source would not catch the two drifting.
- **The axis is read literally, not inferred.** An HStack marked scrollable
  with the default `scrollAxis: 'vertical'` exports a *vertical* ScrollView,
  so that is what the canvas draws, however odd it looks. Guessing the
  sensible axis would put the canvas back out of step with its own output.
- **Padding rides with the content, frame sizes the viewport** — the same
  split 2.2 established for the export, now on the canvas, so the top inset
  scrolls away with the first screenful on both sides. The scroll range is
  measured from the boxes the renderer is about to draw rather than from
  `computeSize`, so what is reachable and what is painted cannot disagree.
- **Clip rects compose rather than overwrite.** A scroller inside a window
  must obey both rectangles. `ClipContext` passes the ancestor's planes down
  and each clipper concatenates its own, assigns the combination across its
  subtree, and marks its group `ownsClip` so the ancestor's walk stops there.
  Without the prune the two walks fight and the winner depends on `useFrame`
  registration order.

Two modifiers came unblocked with it. `scrollIndicators` and `scrollDisabled`
both had an empty `summarize()` — they wrote nothing any renderer could read.
Both now write, and the canvas hides the thumb and refuses the wheel
respectively, so they leave the MODIFIER_VISIBILITY ledger too.

*Acceptance:* 9 new layout tests, verified by perturbation — reverting the
anchor change fails three of them, one naming `settings` by name. Confirmed in
the running app: the title is visible at rest, the wheel reaches the footer,
both ends clamp, the thumb tracks position, and the viewport no longer zooms
while you scroll (OrbitControls dollies from its own DOM listener on the same
element that three-fiber uses, so the scroller stops immediate propagation for
exactly the events it consumes).

**1.5 — Clean up the dead controls** *(½ day)*
Implement or remove Immersion / Resizability / Gestures. If they are
export-only concepts, move them under a clearly-labelled “export only” group so
the inspector stops implying a preview.

**1.6 — Add `rotateGesture` to the preview runtime** *(½ day)*
Alongside the existing `drag` and `pinch` handling.

**1.7 — Honour control ranges (#17)** *(½ day)* — *added after 1.4; see the
scoping correction in §1.*
Slider, Gauge, Stepper and ProgressView all treat their value as already
normalised `0…1`, so `sliderMin/Max/Step`, `gaugeMin/Max`, `stepperMin/Max/Step`
and `total` reach the export only. One `(value − min) / (max − min)` helper,
used in four places, closes 18 divergences — the best debt-per-day ratio in
Stage 1, and the only Stage 1 phase that fixes pixels that are *wrong* rather
than missing.
*Acceptance:* a slider authored `0…100` at `50` draws at its midpoint, and a
test pins the canvas fraction against the value the exporter emits.

**1.8 — Per-type style pickers (#19)** *(1–2 days)* · **1.9 — Canvas-only
visuals the export drops (#20)** *(1 day)*
The remaining two filed groups, 23 divergences between them. Both were left
unscheduled by the original plan.

---

### Stage 2 — Visual → Code *(~4–6 days)*

**2.1 — Emit frames** ✅ **done**
`renderStack` / `renderPanel` now emit `.frame(…)` from `widthMode` /
`heightMode` / `fixedWidth` / `fixedHeight`, and per-edge `.padding(.top, …)`
from `paddingEdges`. `fill` → `maxWidth: .infinity`, `fixed` → `width:`,
`fit` → nothing. **171 of 279 items across the templates now carry a frame
that did not exist before**; parity debt fell 114 → 107, retiring defects
#2 and #9.

Three things worth knowing:

- **Modifier order is the load-bearing part.** `.padding(24).frame(width: 640)`
  is a 640 pt box with inset content; `.frame(width: 640).padding(24)` is a
  688 pt box. Every stack branch (plain, Section, Tab body, DisclosureGroup)
  routes through one `closeStackBox` helper so the order cannot drift, and
  the window body's own `.frame`/`.padding` pair was inverted to match —
  closing defect #8.
- **`fixed` with no value still hugs.** Several templates declare
  `widthMode: 'fixed'` while `fixedWidth` is `null`, because they set a
  `size` field that stacks never read. `computeSize` hugs in that case, so
  the exporter hugs too. Inventing the number would make the code disagree
  with the canvas rather than agree with the template's intent — see the
  correction in §5.1.
- **Scope boundary.** Panels whose `size` is set but whose mode is the
  default `fit` (80 across the templates) still export without a frame. That
  field is ambiguous — authored on an Image, derived from a preset on a
  Button — and disambiguating it per type is phase 2.3's job, not the
  exporter's to guess. Recorded as defect #23.

*Acceptance met:* `export/swiftui.test.js` gained 18 tests — the mode
mapping, per-edge padding collapse, modifier order, the no-double-frame
rules, and a cross-template assertion that every fixed-width item exports
the width `computeSize` reserves.

**2.2 — Fix the wrong emissions** ✅ **done**

- **`destructive` is gone from `BUTTON_STYLES`.** It was never a
  `ButtonStyle` — it is a `ButtonRole` — and the `settings` template shipped
  it, so that template exported a file that would not build. It now routes to
  the `buttonRole` field it always belonged in, normalised in three places so
  no path can emit the old line: the loader (`migrate()`, for saved
  projects), the button emitter (for scenes already in memory), and the
  template seed. Closes defect #1.
- **`stack.scrollable` emits a real `ScrollView`**, honouring `scrollAxis`
  and `scrollShowsIndicators`, and sharing one opener with the `scrollView`
  stack type so the two cannot drift. Closes defect #3 — `settings` and
  `article` now export a view that actually scrolls.
  *Where each modifier lands is the point:* the frame sizes the viewport and
  the padding rides with the scrolling content. Frame inside would pin the
  content to the viewport height and nothing would scroll; background inside
  would scroll the fill away with the content. Both are asserted.
- **Window `.frame` / `.padding` order** — already fixed in 2.1 (defect #8).
- **`swiftValidate.js` was deliberately left alone.** See below.

**One plan item not done, on purpose.** The plan said to extend
`swiftValidate.js` from structural to semantic checking. That file validates
*designer-authored* raw Swift, and its own docblock argues against exactly
this: *“Anything beyond these two checks would reject valid code the designer
had every right to write.”* It is correct. `.buttonStyle(.myCustomStyle)` is
legal Swift against a custom `ButtonStyle` conformance, and rejecting it
would be a false positive on the user's own code.

The goal behind that item — *the generator can never emit a non-existent enum
case again* — is better served where we control the whole vocabulary, so it
went into `parity.test.js` instead, and got stronger in the process:

> **Vocabulary sweep.** The defect was never one bad value; it was a shape.
> ~30 modifiers are emitted verbatim as `.someModifier(.${someField})`, where
> the value comes from a dropdown vocabulary in `appleSystem.js`, and only
> the values a template happened to use were ever exercised. The sweep now
> builds one panel per value of all 15 appearance vocabularies and checks
> every emitted case against the real API.

That immediately found a **second live instance**: `LIST_STYLES` carries a
`default` preset (it doubles as the canvas's row-height/inset table), which
emitted `.listStyle(.default)` — not a SwiftUI case. SwiftUI spells that
meaning `.automatic`, and `.automatic` is implicit, so it is now elided.
Recorded as defect #25.

*Acceptance:* 15 new exporter tests plus 4 persistence tests covering the
migration; parity debt 107 → 104.

**2.3 — Collapse the duplicate field pairs** ✅ **done**

Three pairs, each one concept stored twice, with the canvas reading one half
and the exporter the other. All three now have a single field — the one the
exporter already read, since that is the real SwiftUI spelling — and the
canvas *derives* what it needs from it instead of reading a mirrored copy the
inspector had to keep in sync:

| Was | Now | The canvas derives |
| --- | --- | ------------------ |
| `buttonSize` + `controlSize` | `controlSize` | frame + point size, via `buttonSizePreset()` |
| `buttonShape` + `buttonBorderShape` + `cornerRadius` | `buttonBorderShape` | corner radius, via `buttonRadiusPt()` |
| `fontSize` + `textStyle` | `textStyle` | point size (it already won on both sides; `fontSize` was dead weight) |

`normalizeButton()` handles all three legacy shapes plus the `destructive`
role from 2.2, and runs both on project load and at emit time. Templates were
re-seeded: 19 `buttonSize` → `controlSize`, 14 `buttonShape` →
`buttonBorderShape`, 88 redundant `fontSize` seeds removed, 40 stale button
`size` values stripped. **The MIRROR tier is now empty** and debt fell
104 → 100, closing defects #10 and #21.

**This unblocked #23, as predicted.** `size` was ambiguous only because it was
authored on an Image and *derived from a preset* on a Button. With the button
deriving its frame, the ambiguity is gone — and the distinction turned out to
be already encoded in the inspector as `PANEL_META.frameMode`:

- `explicit` → `size` IS the authored box → emit `.frame(width:height:)`
- `figma` → Fit / Fixed / Fill → mode decides, and `fit` means hug
- `none` → the type sizes itself (shapes, gradients, Button, Spacer)

So the exporter now reads that vocabulary rather than guessing. It lives in
`panels/registry.js` (the exporter cannot import the inspector's JSX without
dragging React into the export path) and `registry.test.js` pins the two
copies to agree by parsing PANEL_META out of the inspector source — verified
by perturbation. Frames across the templates went **155 → 192**, and all 52
explicit-frame panels now export exactly the width the canvas draws.

**One latent bug fixed along the way.** Removing the stored `size` from
buttons exposed that `computeSize` had been reserving space from that stored
value while `Panel3D` drew `computeButtonFramePt()` — the layout engine and
the renderer disagreed about every button on the canvas. Both call the same
function now. Recorded as #26.

*Acceptance:* 5 new registry tests for the frame-mode contract; full gate
green at 420 tests. Verified in the running app: changing Size and Shape in
the Button inspector updates the canvas and reaches the export as
`.controlSize(.large)` and `.buttonBorderShape(.roundedRectangle)`.

**Not done, deliberately.** The plan's closing sentence — *“converge on the
modifier stack, since it is the one the user can see and edit”* — would move
`widthMode`/`size` into `frame` modifier entries for every panel. That is a
migration of every template, the inspector, the layout engine and the
renderer, to buy consistency rather than correctness: with `frameMode` driving
the export, both sides now agree about sizing regardless of which field
carries it. It belongs in its own phase, if at all.

**2.4 — Export free panel position** ✅ **done**
A panel parented straight to a window now exports `.offset(x:y:)` from
`panel.position`. Panels inside a stack are positioned by the layout engine,
and their `position` is ignored on both sides, so they emit nothing — an
offset there would fight the stack. Closes defect #11.

**The sign flip turned out to be a live bug.** Scene space is +y UP, SwiftUI's
`.offset(y:)` is +y DOWN. The arrow-key nudge already wrote SwiftUI-signed
values into an `offset` modifier, and the canvas *added* them to a y-up
coordinate — so **pressing ArrowUp moved a panel down**. Confirmed in the
running app (a ‑86 pt offset from ArrowUp pushed a title down through its
subtitle), fixed by negating at the single place the canvas reads it, and
re-confirmed visually. Recorded as #27.

*Also worth knowing:* dragging a panel writes `position` while arrow keys
write an `offset` modifier — two mechanisms for one intent. Both now export
and compose additively, matching the canvas, so it is a consistency wart
rather than a defect. Recorded as #28.

**2.5 — Make the behaviour gap visible before export** ✅ **done**
Choosing a trigger or action that only documents now shows an amber note in
the Behaviors inspector, reading `triggerGeneratesSwift` /
`actionGeneratesSwift` — the same sets the emitter switches on. Verified in
the app in both directions: the notes appear for `proximity` + `orbit` and
disappear for `tap` + `scaleTo`.

27 new tests check the predicates against **what the generator actually
does**, not against the sets they are built from — a tautology would not catch
the emitter and the warning drifting apart. Two things surfaced while writing
them:

- The export is more honest than the audit gave it credit for. An ungenerated
  *action* is not silently dropped: it leaves a `// DO <type>: <what to do
  instead>` note in the generated method body. §5.5's “documented, not
  generated” framing was right; the detail was better than described.
- Whether an action generates can depend on its **params**, not just its type:
  `lookAt` writes a real `entity.look(at:)` call when its target resolves and
  falls back to the documented form when it cannot (its default target is the
  wearer, which is not an entity). The tests point it at a real entity so they
  measure the action rather than an unresolved default.

**2.6 — Refresh the templates and docs** ✅ **done**
Templates were re-seeded in 2.3. The README counts were fixed alongside the
harness. `VIEWS.md` gained a **Round-trip contract** section stating the two
rules the harness enforces (one field per concept; sizing comes from
`frameMode`), the modifier-order rule, and the y-axis sign convention — plus a
sixth entry in its “how to update this file” list so the next person wires
both sides or declares why not.

Three genuine errors were found in the docs while checking them:

- **`FEATURES.md` listed `lookAt`, `orbit` and `follow` as triggers.** They
  are actions. The trigger list had 15 entries for a 12-entry vocabulary and
  the action list was missing three.
- **It pointed at the wrong file for behaviour codegen** (`realityKit/registry.js`
  rather than `export/behaviors.js`).
- **`VIEWS.md` still documented the button fields 2.3 removed**, including a
  stored `cornerRadius` that no longer exists.

Both docs now also describe what the export actually carries after 2.1–2.4
(frames, per-edge padding, real ScrollViews, free placement) and the 8/12 +
11/15 codegen coverage.

---

## 7. Suggested sequencing

```
Week 1   6.0 parity harness  →  2.1 emit frames  →  2.2 wrong emissions   ✅
Week 2   1.4 real scrolling ✅  →  1.7 control ranges  →  1.1 inert modifiers
Week 3   1.2 form/outlinegroup · 1.3 presentations · 1.5 · 1.6
Week 4   1.8 style pickers (#19) · 1.9 canvas-only visuals (#20)
```

*Revised after 1.4.* Stage 2's phases are done. **1.7 moved ahead of 1.1**: it
is half a day against 1.1's two, it retires 18 divergences against 17, and
unlike most of Stage 1 it fixes pixels that are actively wrong rather than
absent. Weeks 3–4 pick up the three defect groups the original plan left
unscheduled — see the scoping correction in §1.

Rationale for putting Stage 2's first two phases before most of Stage 1: 2.1
and 2.2 are where the *credibility* of the export lives — a generated file that
doesn't compile, or that loses every explicit width, undermines the demo more
than an unrendered `.background()` does. They're also small and fully testable.

---

## 8. Defect index

| # | Defect | Where | Sev |
| - | ------ | ----- | --- |
| 1 | ~~`.buttonStyle(.destructive)` does not compile; shipped in `settings`~~ — **fixed in 2.2** | `appleSystem.js`, `store/persistence.js` | — |
| 2 | ~~Explicit sizing never exported~~ — **fixed in 2.1**, 171 items now framed | `export/swiftui.js` | — |
| 3 | ~~`stack.scrollable` exports a comment, not a `ScrollView`~~ — **fixed in 2.2** | `export/swiftui.js` | — |
| 4 | ~~Scrollable stacks don't scroll; content centred not top-anchored~~ — **fixed in 1.4** | `SceneTree.jsx`, `layout.js` | — |
| 5 | 17 modifiers emit Swift but draw nothing | `modifiers/registry.js:867` | **High** |
| 6 | `form` / `outlinegroup` rows invisible on canvas | `Panel3D.jsx` (no branch) | **High** |
| 7 | `confirmationdialog` / `inspector` inline on canvas, modal in code | `SceneTree.jsx:784` | **High** |
| 8 | ~~Window `.frame` / `.padding` order inverts the inset~~ — **fixed in 2.1** | `export/swiftui.js` | — |
| 9 | ~~`paddingEdges` canvas-only~~ — **fixed in 2.1** | `export/swiftui.js` | — |
| 10 | ~~`buttonSize`/`buttonShape` vs `controlSize`/`buttonBorderShape`~~ — **fixed in 2.3** | `appleSystem.js`, `inspectors.jsx` | — |
| 11 | ~~Free panel position not exported~~ — **fixed in 2.4** | `export/swiftui.js` | — |
| 12 | `rotateGesture` dead in preview | `behaviors/runtime.js:901` | Medium |
| 13 | `spatial.immersionStyle` / `windowResizability` / `gestures` dead both sides | `WindowProps.jsx:139` | Low |
| 14 | `blur` / `blurAmount` / `ornamentOffset` canvas-only or unread | `store/factories.js` | Low |
| 15 | `layoutPriority` is a no-op on both sides | `modifiers/registry.js` | Low |
| 16 | ~~README counts stale (55→56, 42→43)~~ — **fixed** alongside the harness | `README.md` | — |

Found by the parity harness after the first pass, so not in the narrative above:

| # | Defect | Where | Sev |
| - | ------ | ----- | --- |
| 17 | **Control ranges are ignored by the canvas.** Slider, Gauge and Stepper all treat their value as already normalised `0…1`: `sliderMin/Max/Step`, `gaugeMin/Max`, `stepperMin/Max/Step` reach the export only. A slider set to `0…100` with value `50` draws hard right on the canvas and centred on device. 18 fields. | `Panel3D.jsx:1757` (slider), `:1851` (gauge), `:1810` (stepper) | **High** |
| 18 | **The whole `environment` section is dead.** Font, Foreground, Locale and LTR/RTL are editable on every stack and window, and read by neither side — five more controls in the same class as #13. | `StackProps.jsx:574–582` | Medium |
| 19 | **Per-type style pickers do not reach the canvas.** `menuStyle`, `tableStyle`, `groupBoxStyle`, `progressViewStyle`, `formStyle`, `listRowSeparator`/`Tint`/`Spacing`, `headerProminence`, `dateStyle`, `displayedComponents` and friends all export correctly and change nothing on screen. ~20 fields. | `Panel3D.jsx` | Medium |
| 20 | **Canvas-only visuals dropped on export.** `symbolVariant` (`.fill` / `.circle` is drawn but not emitted), `imageUrl` (export substitutes `Image(systemName:)`), `fieldShape`, `dotCount`, `lineCount`, and the label icon-tile fields. | `export/swiftui.js` | Medium |
| 21 | ~~`fontSize` is a canvas-side mirror of the exported `textStyle`~~ — **fixed in 2.3**; nothing writes it any more and `textStyle` is the single source. | `store/panels.js` | — |

Found while implementing 2.1:

| # | Defect | Where | Sev |
| - | ------ | ----- | --- |
| 22 | ~~**A NavigationSplitView dropped every child it could not match by name.**~~ — **fixed in 2.1.** The exporter looked for children literally named `Sidebar` and `Detail`; the canvas renders *all* of them. Renaming a pane in the layers panel deleted it from the export, and the `filesApp` template (detail pane named "Main") lost its entire right-hand side — toolbar, breadcrumb and file grid. Now mirrors `layout.js`: explicit `slot` wins, then the wrapper names, then first-child-is-sidebar. | `export/swiftui.js` | — |
| 28 | **Dragging a panel writes `position`; arrow keys write an `offset` modifier.** Two mechanisms for one intent. Both export correctly and compose additively now, so this is a consistency wart rather than a defect — but a user who does both gets two sources for one placement. | `Panel3D.jsx`, `App.jsx` | Low |
| 27 | ~~**ArrowUp moved a panel DOWN on the canvas.**~~ — **fixed in 2.4.** The `offset` modifier stores SwiftUI-signed y (+y down); the canvas added it to a y-up coordinate. The export was right and the canvas was mirrored. | `Panel3D.jsx` | — |
| 26 | ~~**The layout engine and the renderer disagreed about every button.**~~ — **fixed in 2.3.** `computeSize` reserved space from a stored `size` while `Panel3D` drew `computeButtonFramePt()`. Both call the same function now, so what the stack reserves is what gets painted. | `layout.js` | — |
| 23 | ~~**A panel `size` with no sizing mode still does not export.**~~ — **fixed in 2.3** via `panelFrameMode`. Original text:  80 panels across the templates set `size` while `widthMode` stays the default `fit`. The canvas draws them at that size; the export hugs. The field is ambiguous by type — authored on an Image, derived from a preset on a Button — so the fix is to disambiguate it in the registry (phase 2.3), not to guess in the exporter. | `export/swiftui.js`, `panels/registry.js` | Medium |
| 25 | ~~**`.listStyle(.default)` does not compile.**~~ — **fixed in 2.2.** `LIST_STYLES` doubles as the canvas preset table and carries a `default` entry with no SwiftUI case behind it. Found by the vocabulary sweep, not by a user. Now maps to `.automatic` and is elided. | `panels/registry.js` | — |
| 24 | **`widthMode: 'fixed'` silently degrades to `fit` when no `fixedWidth` is set.** Stacks read `fixedWidth`/`fixedHeight`; several templates set `size` instead, which stacks never read. The declared 640 pt column is dead data on both sides — the canvas hugs at 272 pt. Templates need re-seeding (phase 2.6), and the inspector should not offer `fixed` without a value. | `templates/index.js`, `layout.js:218` | Medium |

---

## 9. Reproducing the numbers

Every figure in this document is now computed by `src/parity.test.js` on each
run, and `npm test` prints the inventory grouped by defect number. The
snippets below stay here for ad-hoc investigation of a single question.

Drop a scratch test in `src/` and run `npx vitest run src/<name>.test.js`.

**Template overflow (§4.3):**

```js
import { buildTemplate, TEMPLATE_ORDER } from './templates/index.js'
import { computeSize } from './layout.js'
import { unitsToPt } from './appleSystem.js'

for (const key of TEMPLATE_ORDER) {
  const { items } = buildTemplate(key)
  for (const w of items.filter(i => i.type === 'window')) {
    for (const k of items.filter(c => c.parentId === w.id && c.type !== 'entity')) {
      const sz = computeSize(k, items)
      if (sz[1] > (w.size?.[1] ?? 0)) {
        console.log(key, w.name, k.name,
          Math.round(unitsToPt(sz[0])) + '×' + Math.round(unitsToPt(sz[1])) + 'pt')
      }
    }
  }
}
```

**Export output (§5.1, §5.2):**

```js
import { buildTemplate } from './templates/index.js'
import { exportSwiftUI } from './export/swiftui.js'

const { items } = buildTemplate('settings')
console.log(exportSwiftUI(items, 'MyApp', {}).map(f => f.content).join('\n'))
```

**Modifier visibility (§4.1)** — slice `MODIFIERS` out of
`src/modifiers/registry.js`, collect each entry's `acc.<field>` writes, and
intersect with `modSummary.<field>` reads in `Panel3D.jsx`. The 20 with an
empty intersection are the inert set.

**Field-level canvas/export diff (§5.1)** — collect the keys of `makeStack` /
`makeWindow` in `store/factories.js`, then test `.<key>` membership in
`{SceneTree, layout, Panel3D}` vs `{swiftui, panels/registry, realitykit}`.
Today that yields:

```
stack   CANVAS ONLY : paddingEdges, fixedWidth, fixedHeight, widthMode,
                      heightMode, blur, blurAmount, expanded, activeChild, activeTab
        EXPORT ONLY : ornamentAnchorMode, ornamentContentAlignment,
                      ornamentVisibility, toolbarPlacement, scrollShowsIndicators, fitsAxes
window  CANVAS ONLY : fillOpacity, blur, blurAmount, scrollY
        EXPORT ONLY : volumeDepthMeters, worldScalingBehavior,
                      volumeWorldAlignment, supportedVolumeViewpoints
```

This exact computation is what `src/parity.test.js` runs, with the results
declared in `src/parity.baseline.js`.
