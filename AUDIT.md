# Round-trip Audit — Code ↔ Visual

**Date:** 2026-09-14 · **Branch:** `feat/inspector-materials-overhaul` · **Working tree:** clean

*Audited at `5b294cb`. **Every phase in §6 has landed since** — 2.1–2.6 and
1.1–1.9 — and each is marked where it changed a finding.*

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
divergences**; **every phase in the plan has landed, the unnumbered tail has
been sorted, and the count is now 20 — every one of them filed**.

| Shape | At the audit | Now |
| ----- | ------------ | --- |
| Canvas honours a field, exporter drops it | 28 fields | 2 |
| Exporter emits a property, canvas ignores it | 83 fields + modifiers | 19 |
| Neither side reads a field the inspector writes | 7 fields | **0** |
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
compile-clean enum surface. **Stage 1 (code → visual) has closed its filed
work bar two blocked entries** — 1.4, 1.7, 1.1, 1.3 and 1.2 have landed, so
scrollable stacks scroll, every control honours its declared range, the
modifier stack draws what it emits, presentations are presented rather than
laid out inline, and Form and OutlineGroup draw their rows. Of the remaining
54, **46 carry no defect number at all**: #19 (13) and #20 (10) plus the
ornament / volume / presentation-metric tail. The filed remainder is just #5
(4, all blocked on font assets — see 1.1), #13 (3) and #14 (1), and #13 is
a question about dead controls rather than a rendering gap.

**A scoping correction, found while planning Stage 1.** Phases 1.1–1.6 as
originally written retire exactly the 35 divergences that carry a defect
number — 100 → 65. The other 65 had no phase at all: **#17 (18), #19 (13) and
#20 (10)** accounted for 41 of them and the ornament / volume /
presentation-metric tail for the rest. So the plan as drafted closed about a
third of what was left. #17 was the clearest omission — filed High, never
scheduled, the largest single block after #5, and a *wrong-pixels* bug rather
than an unread field — so it became phase **1.7** and shipped ahead of 1.1.
**#19 and #20 are now scheduled as 1.8 and 1.9.**

Estimate for Stage 1 as originally scoped ≈ 4–6 working days; with #19 and
#20 still to come, roughly 7–9 in total.

---

## 2. What exists, and how solid it is

Measured on the commit above: **33,857 lines** across 78 source files.

| Subsystem | Size | Status | Notes |
| --------- | ---- | ------ | ----- |
| **Store** (`src/store/`) | 2,400 ln | ✅ Solid | 8 slices over one flat `items` array. Undo/redo, clipboard, persistence all covered by tests (51 assertions). |
| **Layout engine** (`layout.js`) | 807 ln → 900 | ✅ Solid | `layoutStack` / `resolvedChildSizes` agreement is pinned across every stack in every template. 44 tests, covering scroll anchoring (1.4) and the two geometry modifiers (1.1). |
| **Text pipeline** (`text.js`, `textMeasure.js`) | 410 ln | ✅ Solid | Full tighten → scale → wrap → truncate, on real Inter advance widths. 41 tests. Best-tested part of the app. |
| **Panel registry** (`panels/registry.js`) | 1,840 ln | ✅ Solid | 56 view types, every one with `defaults` + `emit()`. No gaps. |
| **Modifier registry** (`modifiers/registry.js`) | 887 ln | ✅ Wired *(was: half-wired)* | 43 modifiers, all 43 emit Swift, **39 reach the canvas** (23 before 1.4). The 4 that don't are `contentShape` and `customModifier`, which correctly draw nothing, plus `fontDesign` and `monospacedDigit`, blocked on font assets. See §4.1. |
| **SwiftUI exporter** (`export/swiftui.js`) | 1,081 ln → 1,400 | ✅ Solid *(was: good, lossy)* | Idiomatic output — real `ZStack` / `.toolbar` / `.ornament` / `.sheet`. Since Stage 2 it also carries frames, per-edge padding, ScrollViews and free placement. See §5. |
| **RealityKit exporter** (`export/realitykit.js`) | 595 ln | ✅ Strongest | Real `ModelEntity`, `PhysicallyBasedMaterial`, `AnchorEntity`, attachments, collision shapes. Output is production-grade. |
| **Behaviour codegen** (`export/behaviors.js`) | 680 ln | ✅ Honest | 8/12 triggers and 11/15 actions generate real Swift; the remaining 8 are emitted as a documented “still to wire up” block naming the real API. Deliberate and clearly marked. |
| **Behaviour runtime** (`behaviors/runtime.js`) | 973 ln → 1,020 | ✅ Complete *(was: near-complete)* | 15/15 actions, **12/12 triggers** since 1.6 gave `rotateGesture` a stand-in. 10 tests. See §4.4. |
| **Canvas renderer** (`Panel3D.jsx`, `SceneTree.jsx`, `Entity3D.jsx`) | 5,476 ln → 6,100 | ✅ Solid *(was: good, uneven)* | 55/56 view types have a dedicated renderer, up from 48: 1.3 gave `confirmationdialog` and `inspector` real presentations and 1.2 gave `form` and `outlinegroup` their rows. Only `canvas` falls back to a plate, and the exporter draws a placeholder `Rectangle()` for it too — the two agree. See §4.2. |
| **Templates** (`templates/index.js`) | 3,102 ln | ✅ Re-seeded in 2.3 *(was: stale)* | 6 window + 6 volume + 2 blanks + 6 legacy. The two that overflow are scrollable and now export a real ScrollView. See §5.3. |

### Quality gates — all green

```bash
npm run check
```

- **Tests:** 668 passing, 11 files (365 at the audit; +89 from the harness and
  the Stage 2 phases, then +9 from 1.4, +20 from 1.7, +17 from 1.1, +12 from
  1.3, +14 from 1.2, +10 from 1.6 — the first tests the behaviour runtime has
  had — +11 from 1.8, +9 from 1.9 and +14 from 1.5, then +15 from #31 and
  +32 from #33 and +16 from #30 and +13 from #29 and +15 from #34 and +7 from #35).
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

### 4.1 Twenty modifiers export Swift but change nothing on the canvas ✅ **mostly fixed in 1.1**

*Original finding.* `summarizeModifiers()` reduces the ordered modifier stack
to a flat struct the renderer reads. All 43 modifiers write into that struct;
the renderer only ever reads **23** of the fields. The other 20 are silently
inert:

| Modifier | Should it be visible? | Why it matters |
| -------- | --------------------- | -------------- |
| ~~`background`~~ | **Wired in 1.1** | A user adds `.background(.blue)` and the canvas stays unchanged. Most-reached-for modifier in the list. |
| ~~`overlay`~~ | **Wired in 1.1** | Same. |
| ~~`foregroundStyle`~~ | **Wired in 1.1** | Canvas colours text from `panel.textColor` instead; the modifier is ignored, so the two disagree the moment the user uses the stack. |
| ~~`clipShape`~~ | **Wired in 1.1** | Corner/circle clipping is invisible until export. |
| ~~`glassBackgroundEffect`~~ | **Wired in 1.1** | The app's signature material — inert as a modifier. |
| ~~`containerBackground`~~ | **Wired in 1.1** | |
| ~~`tint`~~ | **Wired in 1.1** | Control accent colour. |
| ~~`aspectRatio`~~ | **Wired in 1.1** | Changes the frame; the canvas keeps the old one. |
| ~~`zIndex`~~ | **Wired in 1.1** | Draw order — currently tree order only. |
| `fontDesign` | **Yes**, but blocked | `.rounded` / `.serif` / `.monospaced` never swap the rendered face - and cannot until the app ships those faces. |
| `monospacedDigit` | Minor, blocked | Tabular figures, same blocker. |
| ~~`navigationTitle`~~ | **Wired in 1.1** | Canvas reads `stack.navTitle` instead — two sources for one thing. |
| ~~`toolbarBackground`~~ | **Wired in 1.1** | |
| ~~`scrollIndicators`~~ | **Wired in 1.4** | Was meaningless until stack scrolling worked; now hides the scroll thumb. |
| ~~`scrollDisabled`~~ | **Wired in 1.4** | Now refuses the wheel, as it does on device. |
| ~~`layoutPriority`~~ | **Wired in 1.1** | Writes nothing to the summary at all — affects neither side's layout. |
| ~~`hoverEffect`~~ | **Wired in 1.1** | Canvas has its own hover path off `panel.hoverEffect`; the modifier is a second, ignored source. |
| ~~`hoverEffectDisabled`~~ | **Wired in 1.1** | Same. |
| `contentShape` | No | Hit-testing only — correctly invisible. |
| `customModifier` | No | Raw Swift, uninterpretable by design. |

So **17 of 20 were real gaps**; `contentShape` and `customModifier` are correct
as-is, and `layoutPriority` was a distinct bug (a no-op on both sides).

**Where it stands.** 1.4 wired the two scroll modifiers and 1.1 wired thirteen
more plus `layoutPriority`. **Two remain, and the blocker is assets rather
than wiring:** `fontDesign` and `monospacedDigit` need a rounded, serif or
monospaced face, and the app bundles Inter alone — troika needs a real font
file to shape 3D text. Nudging the weight or faking advance widths would put a
guess on the canvas, and drawing a *different* wrong thing from the device is
worse than drawing nothing, so they stay declared. Closing them means shipping
the faces (an `@fontsource` mono + serif) and mapping `.rounded` / `.serif` /
`.monospaced` onto them; tabular figures then follow.

> `src/modifiers/registry.js:867` — `summarizeModifiers`
> `src/components/Panel3D.jsx:467` — the only consumer

### 4.2 Eight view types fall through to a generic plate

48 of 56 types have a dedicated branch in `Panel3D.jsx`. The rest render as a
plain rounded rectangle with a text label:

| Type | Exports | Canvas draws | Severity |
| ---- | ------- | ------------ | -------- |
| ~~`form`~~ | A real `Form { … }` with every row | **Fixed in 1.2** — draws its rows | — |
| ~~`outlinegroup`~~ | A generated `OutlineNode` tree with every row | **Fixed in 1.2** — draws its rows, collapsed subtrees hidden | — |
| ~~`confirmationdialog`~~ | `.confirmationDialog(…)` modifier on the parent | **Fixed in 1.3** — presents as a modal dialog | — |
| ~~`inspector`~~ | `.inspector(…)` modifier on the parent | **Fixed in 1.3** — presents as a trailing column | — |
| `navigationlink` | `NavigationLink(…)` | Plain text, no chevron / link affordance | Medium |
| ~~`popover`~~ | `.popover(…)` | **Fixed in 1.3** — anchored to its arrow edge, with an arrow | — |
| `sheet` | `.sheet(…)` | Plate (positioned correctly, detents honoured) | Low |
| `canvas` | Placeholder `Rectangle()` | Plain plate | **None** — the two already agree |

`confirmationdialog` and `inspector` were the sharp ones. `SceneTree.jsx:784`
listed only `['sheet', 'popover', 'alert']` as presentation types, while
`swiftui.js:747` listed five. The two extra types were therefore laid out as
ordinary children on screen and emitted as modal modifiers in the code.

**Fixed in 1.3**, and the list is now one set in `appleSystem.js` that all
three readers — canvas, exporter and modifier registry — import, so it cannot
drift again. `form` and `outlinegroup` followed in **1.2**. Of the eight, only
`canvas` still falls through — and the exporter emits a placeholder
`Rectangle()` for it, so the two sides agree about drawing nothing much.

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

### 4.4 `rotateGesture` has no preview runtime ✅ **fixed in 1.6**

*Original finding.* It is in the trigger vocabulary, appears in the inspector,
and **generates real Swift**, but `behaviors/runtime.js` matches only `'drag'`
(line 901) and `'pinch'` (line 910) among the pointer triggers. Authoring a
rotate behaviour produces a preview that does nothing and code that works.

See phase **1.6** below for what shipped, including a second dead control the
fix uncovered.

### 4.5 Dead inspector controls ✅ **fixed in 1.5**

*Original finding.* `WindowProps.jsx:139–152` exposes Immersion Style, Window
Resizability and Gestures. Only `spatial.hoverEffect` is ever read
(`store/helpers.js:93`). The other three reach neither the canvas nor the
export — they are controls that do nothing at all.

Same class, lower stakes: `blur` / `blurAmount` on stacks and windows are
canvas-only, and `ornamentOffset` is read by neither side.

Phase **1.5** wired what had an API and removed what did not; `ornamentOffset`
went with it (#14). `blur` / `blurAmount` remain canvas-only and are still in
the ledger — they are a material question rather than a dead control.

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
| **Triggers (12)** | **12** since 1.6 *(was 11 — `rotateGesture` missing)* | 8 — `proximity`, `inView`, `animationFinished`, `hover` documented, not generated |
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

**1.1 — Wire the inert modifiers into the renderer** ✅ **done**

Fourteen of them now draw: `background`, `overlay`, `foregroundStyle`,
`clipShape`, `glassBackgroundEffect`, `containerBackground`, `tint`,
`aspectRatio`, `zIndex`, `navigationTitle`, `toolbarBackground`,
`hoverEffect`, `hoverEffectDisabled` and `layoutPriority`. Parity debt
79 → 65, closing defect #15 outright and all of #5 except the two below.

Three of them wrote **nothing at all** into the summary — `navigationTitle`,
`toolbarBackground` and `layoutPriority` had an empty `summarize()`, so there
was no value for any renderer to read even in principle. The rest were the
easier shape: the accumulator already carried them and nobody looked.

Four are worth knowing about:

- **`layoutPriority` was a no-op on BOTH sides (#15).** It now decides who
  receives a stack's slack: among the children that want to grow, the highest
  priority present takes it and the rest fall back to intrinsic — which is
  what happens on device when one of two Spacers carries
  `.layoutPriority(1)`. One helper, called from `layoutStack` and
  `resolvedChildSizes` alike, so the space one reserves is the space the
  other draws into.
- **`aspectRatio` reshapes a frame, so it belongs to the layout engine.**
  `computeSize` is now a thin wrapper that applies it once, after the
  type-specific measurement, and the renderer runs the same helper on the
  free-placed path. Putting it in only one of them would have been a new
  instance of exactly the divergence this audit is about.
- **`navigationTitle` was the "two sources for one thing" case.** The canvas
  read `stack.navTitle`; the modifier is the SwiftUI spelling, so it wins and
  the stored field remains the fallback.
- **`tint` needed nine call sites, not one.** Every control that fills with an
  accent read `scene.tintColor` unconditionally. They route through one
  `accentColor` now — while the selection halos and gizmo wireframes keep
  reading the scene tint, because those are editor chrome and a designer's
  `.tint(.red)` should not repaint them.

**Two are deliberately left.** `fontDesign` and `monospacedDigit` are blocked
on assets, not wiring — see §4.1.

*Acceptance:* 17 new tests — `applyAspectRatio` in isolation, the ratio
reaching `computeSize`, and the priority allocation measured by where a row
lands between two Spacers. Verified by perturbation: making either modifier a
no-op again fails 9. The renderer half is covered by the harness, which runs
the real `summarize` functions and checks a renderer reads what they write.
Confirmed in the running app: `.background` paints a plate behind a Text that
was previously unchanged, and `.foregroundStyle` recolours it over the top.

*One bug the tests could not have caught.* Hoisting the tint resolution next
to the modifier summary put it above the component's `scene` binding, and the
canvas went blank on a temporal-dead-zone error. The suite has no React
renderer, so nothing failed — only running the app did. Worth remembering
before the next renderer-side phase.

**1.2 — Give `form` and `outlinegroup` real row rendering** ✅ **done**

Both exported their row data faithfully — a real `Form { … }` with every row,
and a generated recursive `OutlineNode` model — while the canvas drew an empty
plate. So rows the designer typed into the inspector were invisible until
export. Parity debt 56 → 54, closing defect #6.

- **`form`** draws the grouped card with hairline separators, title leading
  and value trailing. `formStyle` picks between that and `.columns`, which is
  the two-column layout with trailing-aligned labels in a leading gutter.
- **`outlinegroup`** draws the disclosure tree, indented by `indent`, with a
  chevron on rows that have children. A collapsed row hides its whole
  subtree, not just its immediate children.
- **`rowHeight` reached NEITHER side.** It lays the rows out on the canvas now
  and rides along as `.frame(minHeight:)` on each generated row — `minHeight`
  rather than `height` because a Form row grows for its content, so the
  authored number is a floor.

**Two near-misses worth recording, because they are the same mistake.** The
parity scan asks whether a side's source text contains `.someField`, and both
times a *local* name collided with a real field:

- the outline walk called its nesting level `depth`, which is also
  `.frame(depth:)` on a 3D view — so the canvas looked like it had started
  reading that field;
- extracting the walk into `panels/registry.js` put `r.expanded` into the
  **export** side's source, which made `STACK.expanded` — a live,
  export-side-only divergence about DisclosureGroup seeding — look closed.

Both would have quietly retired a real entry, which is worse than a false
alarm: the harness would have been *lying* rather than nagging. The level is
called `level` now and the helper lives in `appleSystem.js`, which sits in
neither side's file set precisely so shared code cannot vote in this scan.
Anyone adding renderer code should expect this and check what a new local name
shadows.

*Acceptance:* 14 new tests. Eight pin `outlineVisibleRows` — the piece with
real logic in it — including that a collapsed row hides grandchildren and not
just children, and that the walk resumes at the first row back at or above the
collapsed level. Six check the export carries `rowHeight` and `formStyle`, and
that the tree the exporter nests by `indent` is the tree the canvas walks.
Verified by perturbation: stop hiding descendants and three fail. Confirmed in
the running app with both types seeded into a scene — rows, values and
separators all draw, where the plate was blank before.

**1.3 — Route `confirmationdialog` and `inspector` as presentations** ✅ **done**

Five panel types attach to their PARENT as a modifier instead of flowing
inside it. The canvas knew about three of them and the exporter about five, so
a `confirmationdialog` or an `inspector` was laid out as an ordinary child on
screen while the generated code presented it over the view — the wrong
*place*, not merely the wrong pixels. Parity debt 65 → 56, closing defect #7
outright.

**The fix was not the one-line alignment the plan called for.** Copying the
exporter's five types into the canvas would have fixed today's drift and left
tomorrow's: the list was hand-maintained in *three* places (the third being
`modifiers/registry.js`, which uses it to decide that presentations take no
modifier chain). It is one set in `appleSystem.js` now — the vocabulary module
every side already imports, and the one layer with no cycle to worry about —
and `parity.test.js` gained two tests that fail if either side stops consulting
it or starts keeping a private copy.

Then the chrome, which is where the remaining seven fields lived:

- **They are not presented the same way, so they are not placed the same
  way.** Modals sit centred over a dimmed plate; a popover hangs off the edge
  its arrow points from, with an arrow drawn there; an inspector is a trailing
  column in a split, with a divider and *no* dimming, because it is not modal.
  The inspector column also narrows the body the modals centre in, the way a
  real split does.
- **`confirmationdialog` draws the dialog furniture** — title, message, roled
  buttons — sharing the alert's renderer, because SwiftUI presents the two the
  same way. `titleVisibility` is honoured, including `.automatic`'s rule that
  the title shows only when there is a message to caption it.
- **`dialogIcon` / `dialogSeverity`** put a glyph above the title, tinted red
  when the dialog is critical.
- **The four `.inspectorColumnWidth(…)` inputs** size the column, through a
  shared helper that mirrors the exporter's precedence: an exact width wins
  outright, otherwise the ideal is clamped between min and max.
- **`popoverAnchor` was read by *neither* side** — a live control wired to
  nothing. The canvas now draws a narrower arrow for a point anchor, and the
  exporter emits the matching `attachmentAnchor: .point(.center)`.

*Acceptance:* 12 new tests. The routing one sweeps all 56 panel types and
compares `isPresentationPanel` against whether the generator actually attaches
a presentation modifier — not against the list the predicate is built from.
The width tests read the emitted `.inspectorColumnWidth(…)` back out of the
Swift and check the canvas helper resolves the same number. Verified by
perturbation: restoring the drifted three-type list fails 5, including the
guard against a private copy. Confirmed in the running app — a confirmation
dialog presents as a centred modal over a dimmed backdrop instead of landing
in the Settings column, and adding an inspector shifts it left to make room
for the column.

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

**1.5 — Clean up the dead controls** ✅ **done**

Four sections were editable and read by NOBODY, on either side. The plan said
"implement or remove"; each turned out to answer that question for itself once
you asked what SwiftUI API it would be translated into. Parity debt 31 → 27,
closing #13 and #14 — and with them the last of the "neither side reads it"
tier, which stood at seven fields when the audit was written.

**Implemented** — these had an API and simply were not wired:

- **`windowResizability`** emits `.windowResizability(.contentSize)` on the
  WindowGroup. It is a *Scene* modifier, which is also why it has no preview:
  there is no window chrome on a design surface to drag. The inspector says
  that now instead of implying one.
- **The whole Environment section** — Font, Foreground, Tint, Direction,
  Locale — emits, each as its real modifier. `layoutDirection` is previewed
  too: leading and trailing swap, which is the bulk of what a designer is
  checking when they flip to RTL. *One limit stated rather than left to be
  found:* SwiftUI inherits the value down the whole subtree while the canvas
  mirrors it at the container that declares it.
- **`ornamentOffset`** (#14) pushes the ornament out along the edge it hangs
  from, and emits the matching `.offset` on the ornament content — `.ornament`
  itself has no offset parameter.

**Removed** — these had nowhere to go, so a renderer would have been invention:

- **`spatial.immersionStyle`** is a *scene* property. The Scene tab already
  owns it and the exporter already emits it from there, so the per-window copy
  was a second source for one concept — the shape phase 2.3 spent itself
  removing — and it happened to be the dead one.
- **`spatial.gestures`** was a list of gesture names with no SwiftUI API
  behind it: there is no window-level "these gestures are allowed"
  declaration to emit it as.

Stale keys in older saved projects are simply ignored, so no migration.

**One scan correction.** Once the exporter started reading `spatial`, the
parity scan reported the field as export-only — because the canvas reads it
through `resolveHoverEffect`, which lives in `store/helpers.js`, a file the
scan did not look at. That would have been a false report inviting someone to
"fix" a field the canvas already honours, so the file is now in the canvas
set, with a comment saying why a store file is there.

*Acceptance:* 14 new tests. Six pin `mirroredAlignment` and the RTL layout,
and the rest read the generated Swift for the environment modifiers, the Scene
resizability and the ornament offset. Two pin the **removals** — a fresh
window declares exactly `hoverEffect` and `windowResizability`, and immersion
still reaches the file from the Scene where it belongs — because a dead
control coming back is the defect returning. Verified by perturbation:
reverting any of the four fails 8, the parity harness among them. Confirmed in
the running app: the window's Behaviour section now shows Hover and Resize and
nothing else.

**1.6 — Add `rotateGesture` to the preview runtime** ✅ **done**

A mouse has neither two-handed gesture, so the wheel now carries both: plain
wheel magnifies, **shift + wheel twists**. Shift is the discriminator because
the two have to be mutually exclusive — one wheel event must not advance a
pinch behaviour and a rotate behaviour at once. Closes defect #12. No parity
debt moves: this is a preview-runtime gap, not a field divergence.

**A second dead control turned up in the same handler.** Both gestures declare
begin / change / end, all three sit in the inspector's "When" picker, and the
old handler read:

```js
const mode = e.deltaY > 0 ? 'change' : 'change'
```

— a ternary whose branches are identical. So a behaviour wired to *Begins* or
*Ends* could never run on the canvas. A wheel stream has no phases of its own,
being discrete where the gestures are continuous, so they are synthesised: the
first tick of a burst opens the gesture and changes it, later ticks change it,
and an idle timeout closes it. The timer is cleared on unmount, since a burst
left open would fire its `end` into a dead action context.

**And the inspector was claiming something untrue.** The device-only note said
"preview maps it to a pointer fallback" for `rotateGesture`, which had no
fallback at all. It names the actual gesture per trigger now.

*Acceptance:* 10 tests — the first the behaviour runtime has had. One derives
the pointer triggers from the registry the inspector renders from and checks
the runtime matches each, so a trigger the designer can pick and the preview
ignores fails here rather than shipping. The rest pin the phase pump: the
burst opens once, closes on idle, restarts after closing, keeps pinch and
rotate on separate bursts, and stays quiet once the entity is gone. Verified
by perturbation — removing the rotate matcher and restoring the hard-coded
`change` fails 5.

**1.7 — Honour control ranges (#17)** ✅ **done** — *added after 1.4; see the
scoping correction in §1.*

Slider, Gauge, Stepper and ProgressView each carried a value inside a range the
designer declares, and the canvas clamped that value to `0…1` and painted the
result — right only when the range happens to BE `0…1`. `controlFraction` in
`appleSystem.js` is now the single conversion every fill width and ring sweep
goes through, and it reads the bounds with the same `?? 0` / `?? 1` fallbacks
the exporter uses, so a half-specified control lands in the same place in both
outputs. Parity debt 97 → 79, retiring all 18 entries and defect #17.

What each control gained: the **Slider** maps its value through its range,
writes drag-to-set back *in* that range snapped to `sliderStep`, and draws the
`minimumValueLabel` / `maximumValueLabel` slots. The **Gauge** honours
`gaugeMin/Max`, switches to a dial for the `accessoryCircular` styles, and
samples a two-stop `gaugeTintFrom/To` gradient at the value's own position.
The **Stepper** steps by `stepperStep` instead of ±1, stops at both bounds,
and dims the button that can no longer do anything. **ProgressView** measures
`value` against `total`, draws `.circular` as a ring, and gives
`indeterminate` the position-unknown treatment rather than a full bar.

**One shipped default was internally inconsistent.** The Gauge seeded
`value: 0.7` alongside `gaugeMin: 0, gaugeMax: 100` and a `"70"` label — so it
*looked* right only because the canvas clamped everything to `0…1`, while the
exporter wrote `Gauge(value: 0.7, in: 0...100)`, which reads as 0.7%. The seed
is now `70`, and a test asserts the emitted value, the emitted bounds and the
printed label agree.

*Acceptance:* 13 unit tests on the conversion plus 7 that read the value and
bounds back out of the **real emitted Swift** and feed them to the canvas
helper — so if either side starts reading a different field, or the fallbacks
drift apart, the fraction stops matching. Verified by perturbation: restoring
the old clamp fails 8 of them. Confirmed in the running app — setting a
slider's Max to 100 moves the thumb from the midpoint to the far left, which
is where `Slider(value: .constant(0.5), in: 0...100)` puts it.

**1.8 — Per-type style pickers (#19)** ✅ **done**

Thirteen style fields exported correctly and changed nothing on screen.
Eleven now draw; the other two turned out not to be rendering gaps at all.
Parity debt 54 → 41.

Wired: the **list** row family (`listRowSeparator` hides the hairlines,
`listRowSeparatorTint` recolours them, `listItemTint` is the row's accent,
`listRowSpacing` adds to the style preset's gap); **menu** (`menuStyle`
collapses `.button` / `.borderlessButton` to a label, `menuIndicator` decides
whether that carries a chevron); **table** (`.inset` drops the grid rules for
alternating row fills); **picker** (`pickerOptions` are laid out by the styles
that lay them out); **date picker** (`.graphical` is a month grid, `.wheel` is
drum columns, and `displayedComponents` decides which halves of the value
show); and the **text field**'s `axis`, where `.vertical` grows the field down
to `lineLimit` instead of clipping one line.

**Two are inert on BOTH sides, so wiring a renderer would have been theatre:**

- `groupBoxStyle` — SwiftUI ships exactly one `GroupBoxStyle`, `.automatic`.
  `GROUP_BOX_STYLES` has a single option and the emitter elides it at that
  value, so the field can never hold anything else and never reaches the
  file. The honest fix is to drop the one-option picker from the inspector,
  not to invent a second treatment.
- `headerProminence` — it styles **Section** headers, and the list panel does
  not model sections, so the emitted modifier lands on a `List` with no
  `Section` in it and does nothing on device either. It belongs on the
  `section` stack type, which has a real header.

Both are recorded as EXEMPT with those reasons rather than counted as closed
work.

*Acceptance:* 11 new tests. The renderer branches on style names as string
literals, which is the shape that rots quietly — a misspelled case never
matches, the canvas keeps its default, and nothing fails — so the sets it
branches on live in `appleSystem.js` and are pinned against the real
vocabularies. The date components are checked against the **emitted**
`displayedComponents:` argument, value by value, so the two halves of that one
decision cannot drift. Verified by perturbation: typo a style name or let a
time-only picker show a date and three fail. Confirmed in the running app with
one of each type seeded at a non-default style.

**1.9 — Canvas-only visuals the export drops (#20)** ✅ **done**

The last filed group, and the only one that runs the other way: the canvas
drew these and the **export** dropped them, so the work was in the emitters
rather than the renderer. Parity debt 41 → 31.

Eight now reach the file:

- **`symbolVariant`** as `.symbolVariant(.fill)`, emitted once in
  `renderPanel` rather than inside each symbol-bearing emitter — the field is
  universal — and guarded on the panel actually having a symbol, so it never
  lands on a view with no glyph to vary.
- **`imageUrl`** says what the source is instead of emitting a `photo`
  placeholder whatever the designer had put in the frame: an `AsyncImage` for
  a remote URL, a named `Image("…")` for a bundled path or an imported asset,
  and an honest `// no image set` for an empty frame.
- **`fieldShape`** as `.clipShape(Capsule())` or a rounded rectangle at the
  panel's own radius — a field the designer squared off used to come back
  round.
- **`lineCount`** as `.lineLimit(n)` on the TextEditor.
- **The Label's icon tile** — `iconColor`, `iconTileColor`, `iconTileSize`,
  `iconTileRadius`. `Label(_:systemImage:)` has nowhere to put any of it, so a
  tile switches the emitter to the explicit `Label { } icon: { }` form.

**Two have no SwiftUI API behind them, so emitting anything would have been
invention rather than translation:**

- `selectedColorToken` — the raised pill in a segmented control is drawn by
  `.pickerStyle(.segmented)` itself and SwiftUI exposes no way to re-material
  it. The canvas has to paint something there; the export has nowhere to put
  it. *(An `.environment` hack was written and then removed: it compiled and
  meant nothing.)*
- `dotCount` — how many bullets the editor draws in an **empty** SecureField,
  so it reads as a password field before anything is typed. On device
  SecureField masks the real value and there is no placeholder-dot API; the
  placeholder is the prompt string, which is already emitted.

*Acceptance:* 9 new tests reading the generated Swift, including that the
short `Label` form is still used when there is no tile — emitting it *with*
one would silently drop every part of the tile, which is the original defect.
Verified by perturbation: reverting the tile, the image source or the symbol
variant fails 5, the parity harness among them.

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

### Post-plan — the defects the triage left

Every numbered phase above has landed, so what follows is the triaged tail
being worked worst-first. Same rules: no emission that means nothing, and a
field only leaves the ledger when both sides really carry it.

**#31 — the `styles` bag** ✅ **done**
`toggleStyle`, `labelStyle` and `textFieldStyle` now draw on the canvas. Four
more keys in the bag turned out to be duplicates of top-level fields and were
deleted rather than wired, with a migration lifting any saved value onto the
field that survived.

*A correction to this audit's own filing.* #31 was recorded as High on the
strength of a claim that “18 labels across the shipped templates set
`labelStyle: iconOnly` … every one draws its text on screen and hides it on
device.” That was wrong. All 25 such labels also have empty text, which the
canvas's existing `!panel.text` rule already drew icon-only, so **nothing
shipped diverged**. The field was genuinely unwired; the templates were not
the evidence.

**#33 — container chrome** ✅ **done**
Three fields, and the reason this one went first: each was *wrong* on screen or
in the file rather than merely absent.

- **`expanded`.** `DisclosureGroup(isExpanded:)` was bound to a `@State`
  seeded `= false` no matter what the designer did, so a group opened on the
  canvas — children laid out, sized, visible — shipped closed and its whole
  section was missing from the app's first screen. The state now seeds from
  the authored value. The fix is three words; the stateBag consumer already
  understood the typed form, so nothing else had to move.
- **`toolbarPlacement`.** The canvas had no toolbar layout at all: a `toolbar`
  stack fell through to the VStack path and drew its items in a **vertical
  column in creation order**, so a Cancel authored after a Done sat below it
  here and to its left on device. Placements now name a zone and the bar fills
  leading | principal | trailing, out of tree order, from one table that the
  inspector's dropdown is also generated from — a placement cannot be offered
  without somewhere to draw it. `ToolbarItem` and `ToolbarItemGroup` bodies
  lay out across the bar too, for the same reason.
  *Where honesty ran out:* `.bottomBar`, `.bottomOrnament` and `.keyboard`
  name a surface a single bar is not. The canvas has one bar, so it gives them
  a row beneath it. That is an approximation, not a match — but it keeps them
  out of the top bar, which is the part that was plainly wrong.
- **`fitsAxes`.** *Also a correction:* the defect index said the canvas
  “picks a branch from the `activeChild` selector”. It did not — it Z-stacked
  **every** candidate, so a container built to show one of three layouts drew
  all three on top of each other and answered nothing. `ViewThatFits` now
  measures: first candidate whose ideal size fits, axes limited to the `in:`
  set, last one as the fallback when none fit — and its own size is the
  branch it chose rather than the union of them all.

*Acceptance:* 32 new tests — 12 on the fit rule and what the canvas draws, 10
on the zone table and the bar, 5 on the disclosure state, plus the two
cross-side checks that matter (the axis set the canvas measures is the one the
exporter emits; the placement it zones is the one the generator spells). Each
of the three fixes was reverted in turn to confirm the new tests fail without
it. Verified in the running app: a bar authored Done → Library → Cancel draws
**Cancel | Library | Done** with the ornament item on its own row, and a
`ViewThatFits` boxed at 260 pt draws its medium branch and only that one,
swapping to the narrow branch at 120 pt. Parity debt 20 → 17.

**#30 — presentation metrics** ✅ **done**
Four fields that reached the generated Swift and nothing on screen.

- **`sheetFraction` / `sheetHeight`.** A detent is a *height* — where the sheet
  rests, measured from the bottom of what it is presented over. The canvas
  treated it as a nudge: every sheet drew at its own stored size and `.medium`
  alone was pushed downward, so `.fraction(0.3)` and `.height(200)` were the
  same box on screen and two different sheets on device. The detent now decides
  the height, with the exporter's own fallbacks (`?? 0.5`, `?? 320`) so a sheet
  missing the field resolves to the same number on both sides, and every sheet
  bottom-anchors at the same margin — which leaves a `.large` sheet exactly
  where it was drawn before.
- **`presentationDragIndicator`.** The grabber now draws, at the 36×5pt metric
  iOS uses. `.automatic` draws none: what the system decides from is the number
  of detents, and every sheet here carries one — which is also why the exporter
  emits nothing for it.
- **`presentationCornerRadius`.** The plate rounds by it. `0` means "no
  override" on both sides.

*A note on the harness.* The parity scan matches `.fieldName` as plain text, so
a comment naming a modifier passes for the code that reads it — the first pass
of this fix could have been deleted whole and the scan would still have called
the field canvas-side. The two comments involved are now written without the
leading dot, and say why. This is the second time that trap has cost something
(see #31), and it is a property of the scan rather than of any one fix.

*Acceptance:* 16 new tests — 11 on the detent and grabber rules, 5 on the seam
(the number the canvas sizes from is the number in `.presentationDetents`, and
the two chrome modifiers are emitted exactly when the canvas draws them). The
canvas wiring was ripped out to confirm the harness flags all five sheet fields
as undeclared without it. Verified in the app: three sheets at `.large`,
`.fraction(0.3)` and `.height(200)` draw at three visibly different heights,
bottom-aligned, each with a grabber and a 44pt corner. Parity debt 17 → 13.

**#29 — ornament chrome** ✅ **done**
Two of the three were real, and the third turned out to be an exemption.

- **`ornamentVisibility`.** `.hidden` takes the ornament off the device and
  took nothing off the canvas. It is now gone from the canvas too, and gone
  from the edge's stacking order — a hidden ornament should not push the one
  below it outward. It stays in the layer tree, the way anything else switched
  off does.
- **`ornamentContentAlignment`.** The nine alignments drew one picture. They
  align the content against the anchor *point*, the way every SwiftUI alignment
  does — the named edge of the content is the edge that lands on the point — so
  a bottom ornament aligned `.leading` starts at the window's bottom centre and
  runs right rather than straddling it. The offset is half the ornament's own
  size in the named direction, which is what that works out to. The inspector's
  dropdown is generated from the same list the canvas offsets by.
- **`ornamentAnchorMode` is an exemption, not a fix.** `.scene(…)` and
  `.parent(…)` name the same rectangle here. Both sides only ever hang an
  ornament off a *window* — `renderWindow`'s `ornamentKids` and `Window3D`'s
  `ornamentChildren` are the only two places either looks — and a window's root
  view fills its scene, so the two anchors resolve to one box. There is no
  second rect for the canvas to draw the difference against. Moved to EXEMPT
  with that reason rather than left as debt nobody can pay.

*Acceptance:* 13 new tests, including one that asserts a content alignment is
emitted exactly when the canvas moves the ornament, and one that keeps the
exempt field's two anchors emitting distinctly. The canvas wiring was ripped
out to confirm the harness flags both fields. Verified in the app: an ornament
marked hidden sits in the layer tree and draws nothing at its edge, while two
top ornaments aligned `.leading` and `.trailing` offset in opposite directions
from each other. Parity debt 13 → 10.

**#34 — three canvas gaps with no common cause** ✅ **done**
They had nothing in common except being small, and one of them was not what
this audit said it was.

- **`boxCornerRadius`.** `MeshResource.generateBox(size:cornerRadius:)` rounds
  every edge; the canvas drew a hard cube whatever the radius said, with a
  comment saying so. It now builds a `RoundedBoxGeometry` — from `three`'s own
  examples, no new dependency — for both the `box` panel primitive and the
  entity mesh. The clamp is the part worth sharing: a radius past half the
  shortest side has no cube left to round, and three.js does not stop you
  asking, it hands back inside-out geometry. One helper, both callers.
- **`depth`.** *A correction:* the defect index called this "2D panels draw
  flat". It is not a 2D-panel field at all — it is the `.frame(depth:)` of the
  3D primitives (sphere, box, plane, cone, cylinder) and of a RealityView. And
  a frame paints nothing, on device or here; it reserves space. So the canvas
  now draws the box it reserves **while the object is selected**, which is the
  one moment a frame is a thing anyone looks at. Drawing it always would be a
  wireframe that exists nowhere on device.
- **`iconName`.** *A second correction, and the interesting one.* The index
  filed this against `contentUnavailable`, which never read the field. It is a
  `label` field, and it was a **second home for `symbolName`** — the canvas
  drew one, the exporter fell back to the other, the two sides disagreed about
  the final fallback (`info.circle` here, `circle.fill` there), the default was
  the letter `A`, which is not an SF Symbol, and no inspector ever wrote it. So
  this is a §5.3 duplicate-field case, not a missing drawing: the dead field is
  gone, `label` starts on a real symbol, both sides fall back to the same one,
  and `migrateLabelIcon` lifts a stored `iconName` onto `symbolName` — keeping
  `symbolName` when both are set, because that is the glyph that was on screen.

*Acceptance:* 15 new tests — 5 on the radius clamp, 5 on the label's one glyph
field, 5 on the migration. Both box reads were ripped out to confirm the
harness flags the field, and the depth read separately. Verified in the app: a
box with a 60pt radius draws visibly rounded beside an identical sharp one, and
a selected box with `.frame(depth: 400)` shows a wireframe reaching well past
the 160pt object. Parity debt 10 → 7.

**#35 — an unfrosted stack exported a frosted plate** ✅ **done**
SwiftUI has no unfrosted Material: `.thickMaterial` is blurred by definition.
So a stack whose blur toggle was off — a flat plate on the canvas — exported as
a frosted one. With the toggle off the exporter now emits the colour the canvas
resolved the token to, through the same `resolveSemantic` the canvas calls, so
the plate in the file is the plate on screen. A token with a first-party
SwiftUI spelling (`systemBackground`) still emits that rather than a literal,
because resolving it would throw away the system's own light/dark behaviour.
The blur *radius* stays exempt — Materials are fixed tiers and carry no radius
anywhere in SwiftUI.

**The ledger gained a tier over this.** A window's `blur` is genuinely
canvas-only, for a different and still-valid reason: the shell draws the window
surface and there is no toggle to emit. But the parity scan matches `.blur` as
text across one corpus and cannot tell `win.blur` from `stack.blur`, so the
moment a stack's blur became two-sided the window's entry looked stale and the
test demanded its deletion — which would have quietly dropped a true exemption
off the record. `SHADOWED` says exactly that: still one-sided, but the scan
cannot see it because another item type shares the name. It does not count as
debt, and a separate test asserts the name really is read on both sides, so the
tier cannot become the drawer inconvenient entries get put in. That test earned
its place immediately by rejecting `blurAmount`, which I had marked SHADOWED
out of symmetry and which nothing emits on either item type.

*Acceptance:* 6 new exporter tests plus the shadowed-entry check; the fix was
reverted to confirm three of them fail without it. Parity debt 7 → 6.

---

## 7. Suggested sequencing

```
Week 1   6.0 parity harness  →  2.1 emit frames  →  2.2 wrong emissions   ✅
Week 2   1.4 real scrolling ✅  →  1.7 control ranges ✅  →  1.1 inert modifiers ✅
Week 3   1.3 presentations ✅ · 1.2 form/outlinegroup ✅ · 1.6 ✅ · 1.5 ✅
Week 4   1.8 style pickers (#19) ✅ · 1.9 canvas-only visuals (#20) ✅
```

*Revised after 1.4.* Stage 2's phases are done. **1.7 moved ahead of 1.1**: it
is half a day against 1.1's two, it retires 18 divergences against 17, and
unlike most of Stage 1 it fixes pixels that are actively wrong rather than
absent. Weeks 3–4 pick up the three defect groups the original plan left
unscheduled — see the scoping correction in §1.

*After the tail was sorted.* Every phase above has landed, so what follows is
not a plan but an ordering of what the triage left, worst first:

```
✅ #31 the styles bag        — done.
✅ #33 container chrome      — done.
✅ #30 presentation metrics  — done.
✅ #29 ornament chrome       — done.
✅ #34 three unrelated gaps  — done.
✅ #35 unblurred stack exports a Material — done.
1  #32 volume geometry. Half a day.
—  #5  fontDesign / monospacedDigit — blocked on shipping font assets.
```

#33 led not because it was large — it was the smallest — but because it was
*wrong* rather than absent: a disclosure the designer opened exported closed.

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
| 5 | ~~17 modifiers emit Swift but draw nothing~~ — **13 wired in 1.1**, 2 in 1.4. The last 2 (`fontDesign`, `monospacedDigit`) are blocked on font assets, not wiring — see §4.1. | `modifiers/registry.js`, `Panel3D.jsx`, `SceneTree.jsx` | Low |
| 6 | ~~`form` / `outlinegroup` rows invisible on canvas~~ — **fixed in 1.2.** Both draw their rows; `rowHeight`, which reached neither side, now lays them out and rides along as `.frame(minHeight:)`. | `Panel3D.jsx`, `panels/registry.js` | — |
| 7 | ~~`confirmationdialog` / `inspector` inline on canvas, modal in code~~ — **fixed in 1.3.** One presentation set, imported by all three readers. | `appleSystem.js`, `SceneTree.jsx` | — |
| 8 | ~~Window `.frame` / `.padding` order inverts the inset~~ — **fixed in 2.1** | `export/swiftui.js` | — |
| 9 | ~~`paddingEdges` canvas-only~~ — **fixed in 2.1** | `export/swiftui.js` | — |
| 10 | ~~`buttonSize`/`buttonShape` vs `controlSize`/`buttonBorderShape`~~ — **fixed in 2.3** | `appleSystem.js`, `inspectors.jsx` | — |
| 11 | ~~Free panel position not exported~~ — **fixed in 2.4** | `export/swiftui.js` | — |
| 12 | ~~`rotateGesture` dead in preview~~ — **fixed in 1.6.** Shift + wheel stands in for the two-handed twist, and the wheel stream now produces all three gesture phases rather than only `change`. | `behaviors/runtime.js` | — |
| 13 | ~~`spatial.immersionStyle` / `windowResizability` / `gestures` dead both sides~~ — **fixed in 1.5.** Resizability emits as a Scene modifier; the other two were removed, having nowhere to go. | `WindowProps.jsx`, `store/factories.js` | — |
| 14 | ~~`ornamentOffset` unread by both sides~~ — **fixed in 1.5**; it offsets the ornament on the canvas and emits `.offset` on the ornament content. `blur` / `blurAmount` remain canvas-only, in the unfiled tail. | `store/factories.js` | — |
| 15 | ~~`layoutPriority` is a no-op on both sides~~ — **fixed in 1.1.** It wrote nothing into the summary, so it emitted real Swift and moved neither the canvas nor the layout engine. It now allocates a stack's slack to the highest priority among the children that want to grow, which is what SwiftUI does. | `modifiers/registry.js`, `layout.js` | — |
| 16 | ~~README counts stale (55→56, 42→43)~~ — **fixed** alongside the harness | `README.md` | — |

Found by the parity harness after the first pass, so not in the narrative above:

| # | Defect | Where | Sev |
| - | ------ | ----- | --- |
| 17 | ~~**Control ranges are ignored by the canvas.**~~ — **fixed in 1.7.** Original text: Slider, Gauge and Stepper all treat their value as already normalised `0…1`: `sliderMin/Max/Step`, `gaugeMin/Max`, `stepperMin/Max/Step` reach the export only. A slider set to `0…100` with value `50` draws hard right on the canvas and centred on device. 18 fields. | `appleSystem.js` (`controlFraction`), `Panel3D.jsx` | — |
| 18 | **The whole `environment` section is dead.** Font, Foreground, Locale and LTR/RTL are editable on every stack and window, and read by neither side — five more controls in the same class as #13. | `StackProps.jsx:574–582` | Medium |
| 19 | ~~**Per-type style pickers do not reach the canvas.**~~ — **fixed in 1.8**; 11 wired, 2 shown to be inert on both sides. Original text: `menuStyle`, `tableStyle`, `groupBoxStyle`, `progressViewStyle`, `formStyle`, `listRowSeparator`/`Tint`/`Spacing`, `headerProminence`, `dateStyle`, `displayedComponents` and friends all export correctly and change nothing on screen. ~20 fields. | `Panel3D.jsx` | Medium |
| 20 | ~~**Canvas-only visuals dropped on export.**~~ — **fixed in 1.9**; 8 emitted, 2 shown to have no SwiftUI API. Original text: `symbolVariant` (`.fill` / `.circle` is drawn but not emitted), `imageUrl` (export substitutes `Image(systemName:)`), `fieldShape`, `dotCount`, `lineCount`, and the label icon-tile fields. | `export/swiftui.js` | Medium |
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

Filed when the unnumbered tail was triaged, after every phase in §6 had
landed. Twenty-three entries had reached the end of the plan without a defect
number — they were never findings, just whatever the harness turned up that no
phase had claimed. Sorting them moved **six to EXEMPT** (the other side has
nowhere to put them, and never will) and left **seventeen as real debt**, now
grouped below. Nothing was fixed in the sort; the count fell 27 → 21 because
six entries were shown not to be work.

| # | Defect | Where | Sev |
| - | ------ | ----- | --- |
| 29 | ~~**Ornament chrome is export-only.**~~ — **fixed, two of three.** A hidden ornament no longer draws and no longer takes a slot on its edge, and `ornamentContentAlignment` slides the ornament along its anchor point instead of nine values drawing one picture. `ornamentAnchorMode` is now an exemption rather than debt: both anchors name the window frame, the only place either side puts an ornament. 3 fields. | `appleSystem.js`, `SceneTree.jsx` | Medium |
| 30 | ~~**Presentation metrics are export-only.**~~ — **fixed.** A detent is now the sheet's height rather than a nudge, so `.fraction(0.3)` and `.height(200)` draw at the heights they ship at; the grabber draws when `presentationDragIndicator` asks for it, and `presentationCornerRadius` rounds the plate. 4 fields. | `appleSystem.js`, `SceneTree.jsx`, `Panel3D.jsx` | Medium |
| 31 | ~~**The `styles` bag never reaches the canvas.**~~ — **fixed.** `toggleStyle`, `labelStyle` and `textFieldStyle` draw now; four more keys were second homes for concepts that already had one and were removed. **Correction to this row as first written:** it claimed 18 shipped labels diverge. They do not — all 25 `iconOnly` labels in the templates also have empty text, which the canvas's own long-standing rule already draws icon-only, so the two mechanisms happen to agree in shipped content. The divergence was real but *latent*: a label carrying text and asking for `.iconOnly` drew the text here and hid it on device. Medium, not High. | `Panel3D.jsx`, `store/factories.js` | — |
| 32 | **Volume geometry is export-only.** `volumeDepthMeters` is a dimension the canvas could draw and it sizes the volume from the window instead; `supportedVolumeViewpoints` could bound the orbit in Preview, where the camera is the wearer's (editor mode must stay free). 2 fields. | `SceneTree.jsx`, `Canvas3D.jsx` | Low |
| 33 | ~~**Container chrome the canvas ignores.**~~ — **fixed.** `expanded` now seeds the `@State` from the authored value, so a disclosure the designer opened exports open. `toolbarPlacement` now zones the bar leading \| principal \| trailing instead of stacking items in tree order down a column; the three placements that name another surface get a row of their own. `fitsAxes` now measures: the canvas draws the one branch the runtime would keep rather than every candidate on top of each other. 3 fields. | `layout.js`, `appleSystem.js`, `export/swiftui.js` | Medium |
| 34 | ~~**Three canvas gaps with no common cause.**~~ — **fixed.** `boxCornerRadius` rounds the box on the canvas as `generateBox(cornerRadius:)` does on device; `depth` draws the Z-box `.frame(depth:)` reserves while the object is selected; `iconName` turned out to be a second home for `symbolName` and was deleted, with a migration. 3 fields. | `Panel3D.jsx`, `Entity3D.jsx`, `panels/registry.js` | Low |
| 35 | ~~**A stack with blur OFF still exports a frosted Material.**~~ — **fixed.** With the toggle off the exporter emits the colour the canvas resolved the token to, because SwiftUI has no unfrosted Material. The blur *radius* stays exempt: Materials carry no radius anywhere in SwiftUI. 1 field. | `export/swiftui.js` | Low |

### Sorted to EXEMPT

Six entries were shown to have no counterpart, rather than a missing one. They
are recorded in `parity.baseline.js` with these reasons and no longer count as
debt:

| Field | Why it can never round-trip |
| ----- | --------------------------- |
| `window.fillOpacity`, `window.blur`, `window.blurAmount` | The window plate is **system glass**: the shell draws a WindowGroup's surface and the exporter emits no background for it at all. `.windowStyle(.plain)` removes the plate and that is the whole API — there is nothing to set its opacity or blur to. The canvas paints one because it has to draw something. |
| `stack.blurAmount` | SwiftUI Materials are fixed tiers with no radius control. The tier is the only granularity that round-trips; the canvas exposes a continuous knob because three.js can render one. |
| `window.worldScalingBehavior`, `window.volumeWorldAlignment` | Runtime behaviours, not geometry: how a volume rescales as the wearer walks toward it, and how it re-orients to gravity. The canvas has a fixed world and a camera the designer drives, so it always renders at true scale in a world that never re-orients. |


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

When the audit was written that yielded:

```
stack   CANVAS ONLY : paddingEdges, fixedWidth, fixedHeight, widthMode,
                      heightMode, blur, blurAmount, expanded, activeChild, activeTab
        EXPORT ONLY : ornamentAnchorMode, ornamentContentAlignment,
                      ornamentVisibility, toolbarPlacement, scrollShowsIndicators, fitsAxes
window  CANVAS ONLY : fillOpacity, blur, blurAmount, scrollY
        EXPORT ONLY : volumeDepthMeters, worldScalingBehavior,
                      volumeWorldAlignment, supportedVolumeViewpoints
```

What is left of those two lists today — the rest either closed or was ruled an
honest exemption, each one declared with its reason in the ledger:

```
stack   CANVAS ONLY : blur (#35)
        EXPORT ONLY : ornamentAnchorMode, ornamentContentAlignment,
                      ornamentVisibility (#29)
window  EXPORT ONLY : volumeDepthMeters, supportedVolumeViewpoints (#32)
```

This exact computation is what `src/parity.test.js` runs, with the results
declared in `src/parity.baseline.js`.
