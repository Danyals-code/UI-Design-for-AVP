// Preview runtime — the gesture seam.
//
// `rotateGesture` is in the trigger vocabulary, sits in the inspector, and
// generates real `RotateGesture3D` Swift — but the runtime matched only
// 'drag' and 'pinch', so authoring one gave a preview that did nothing and
// code that worked. AUDIT #12.
//
// A mouse has neither two-handed gesture, so the wheel stands in for both:
// plain wheel magnifies, shift + wheel twists. That makes the wheel stream
// the interesting part — it arrives as discrete ticks while the gestures it
// stands in for are continuous, and all three phases sit in the inspector's
// "When" picker.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pumpWheelGesture } from './runtime'
import { TRIGGERS, getTriggerSchema } from './registry'
import fs from 'fs'

const RUNTIME_SRC = fs.readFileSync(new URL('./runtime.js', import.meta.url), 'utf8')

describe('every pointer gesture in the vocabulary has a preview path', () => {
  // Derived from the registry the inspector renders from, not from a list
  // kept beside the runtime — a trigger the designer can pick and the
  // preview ignores is exactly the defect this covers.
  const pointerTriggers = TRIGGERS.filter((t) => t.kind === 'pointer').map((t) => t.type)

  it('has pointer triggers to check', () => {
    expect(pointerTriggers).toEqual(
      expect.arrayContaining(['tap', 'drag', 'pinch', 'rotateGesture', 'hover'])
    )
  })

  it('matches each one somewhere in the runtime', () => {
    for (const type of pointerTriggers) {
      expect(
        RUNTIME_SRC.includes(`trigger.type !== '${type}'`),
        `the preview runtime never matches '${type}', so authoring one draws nothing`
      ).toBe(true)
    }
  })

  it('offers the same When modes the runtime can produce', () => {
    // Both two-handed gestures declare begin / change / end. The wheel pump
    // is what makes all three reachable; before it, the handler hard-coded
    // 'change' via a ternary whose branches were identical.
    for (const type of ['pinch', 'rotateGesture']) {
      const modes = getTriggerSchema(type).params.find((p) => p.key === 'mode')
      expect(modes.options.map((o) => o.value).sort()).toEqual(['change', 'end', 'start'])
    }
  })
})

describe('pumpWheelGesture', () => {
  let state, fired
  const fire = (mode) => fired.push(mode)

  beforeEach(() => {
    vi.useFakeTimers()
    state = { alive: true, wheelBursts: new Map() }
    fired = []
  })
  afterEach(() => { vi.useRealTimers() })

  it('opens the gesture on the first tick and changes it', () => {
    pumpWheelGesture(state, 'pinch', fire)
    expect(fired).toEqual(['start', 'change'])
  })

  it('only changes on later ticks of the same burst', () => {
    pumpWheelGesture(state, 'pinch', fire)
    pumpWheelGesture(state, 'pinch', fire)
    pumpWheelGesture(state, 'pinch', fire)
    expect(fired).toEqual(['start', 'change', 'change', 'change'])
  })

  it('closes the gesture once the wheel goes quiet', () => {
    pumpWheelGesture(state, 'pinch', fire)
    fired = []
    vi.advanceTimersByTime(500)
    expect(fired).toEqual(['end'])
  })

  it('does not close while the ticks keep coming', () => {
    pumpWheelGesture(state, 'pinch', fire)
    vi.advanceTimersByTime(100)
    pumpWheelGesture(state, 'pinch', fire)
    vi.advanceTimersByTime(100)
    expect(fired).not.toContain('end')
    vi.advanceTimersByTime(500)
    expect(fired).toContain('end')
  })

  it('starts a fresh gesture after the last one ended', () => {
    pumpWheelGesture(state, 'pinch', fire)
    vi.advanceTimersByTime(500)
    fired = []
    pumpWheelGesture(state, 'pinch', fire)
    expect(fired).toEqual(['start', 'change'])
  })

  it('keeps pinch and rotate on separate bursts', () => {
    // Shift is the discriminator between the two, and one wheel event must
    // not advance both gestures.
    const seen = []
    pumpWheelGesture(state, 'pinch', (m) => seen.push(`pinch:${m}`))
    pumpWheelGesture(state, 'rotate', (m) => seen.push(`rotate:${m}`))
    expect(seen).toEqual(['pinch:start', 'pinch:change', 'rotate:start', 'rotate:change'])
    expect(state.wheelBursts.size).toBe(2)
  })

  it('stays quiet once the entity is gone', () => {
    // The burst timer outlives an unmount; firing `end` into a dead action
    // context would run a behaviour against an entity that no longer exists.
    pumpWheelGesture(state, 'pinch', fire)
    fired = []
    state.alive = false
    vi.advanceTimersByTime(500)
    expect(fired).toEqual([])
  })
})
