// Public store entry point. Slices live under `src/store/`; this file
// re-exports them so existing consumers (`import { useStore } from '../store'`)
// keep working unchanged.

export { useStore, isEffectivelyVisible } from './store/index'
