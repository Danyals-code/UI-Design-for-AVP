// Module-level pub/sub used for two preview-runtime concerns:
//   1. broadcast events (the "broadcast event" action posts here, the
//      "event received" trigger subscribes here). One wire across the
//      whole scene — Swift export becomes NotificationCenter.
//   2. lifecycle ticks (preview enter / exit), for triggers that need
//      to wake up or tear down.
//
// Listeners are stored by name in a Map<name, Set<fn>>. The bus is
// reset whenever preview mode exits so nothing leaks between sessions.

const listeners = new Map()

export function on(name, fn) {
  let set = listeners.get(name)
  if (!set) { set = new Set(); listeners.set(name, set) }
  set.add(fn)
  return () => off(name, fn)
}

export function off(name, fn) {
  const set = listeners.get(name)
  if (set) { set.delete(fn); if (!set.size) listeners.delete(name) }
}

export function emit(name, payload) {
  const set = listeners.get(name)
  if (!set) return
  // Snapshot in case a handler unsubscribes during iteration.
  for (const fn of [...set]) {
    try { fn(payload) } catch (e) { console.warn('[behaviors] handler threw', e) }
  }
}

export function reset() {
  listeners.clear()
}

// Reserved lifecycle event names the runtime publishes.
export const LIFE = {
  PREVIEW_START: '__preview_start__',
  PREVIEW_END:   '__preview_end__'
}
