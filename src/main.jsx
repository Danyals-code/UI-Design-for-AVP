import React from 'react'
import ReactDOM from 'react-dom/client'

// Self-hosted Inter for the DOM. These `.css` entry points are what declare
// `@font-face { font-family: 'Inter' }` — without them the editor chrome
// falls through `font-family: 'Inter', …` in index.css to the system stack
// (Segoe UI on Windows). index.html used to pull the same faces from Google
// Fonts, which meant the UI silently changed typeface whenever the CDN was
// unreachable — offline, on a locked-down network, or behind a proxy.
//
// Weights and subset match `src/fonts.js`, which imports the very same woff
// files as URLs for troika (the 3D canvas needs a file, not a @font-face),
// so the DOM and the 3D text now render from one set of bundled assets.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-400-italic.css'
import '@fontsource/inter/latin-500-italic.css'
import '@fontsource/inter/latin-600-italic.css'
import '@fontsource/inter/latin-700-italic.css'

import App from './App.jsx'
import { useStore } from './store'
import { installTextMeasurer } from './textMeasure'
import './index.css'

// Dev-only escape hatch for end-to-end tests / browser-console
// debugging. `window.__store.getState()` returns the live zustand
// store; `window.__store.dispatch(actionName, ...args)` runs a store
// action. Removed in production builds via Vite's `import.meta.env`
// guard so it can't leak to released bundles.
if (import.meta.env.DEV) {
  window.__store = useStore
}

// Swap the text engine's uniform-advance approximation for real Inter
// metrics before the first layout runs. Awaiting it means the opening frame
// is already measured against the font it renders with, rather than laying
// out once with the fallback and reflowing when the webfont lands.
//
// `installTextMeasurer` has its own timeout, so a font that never loads
// delays startup briefly and then renders on fallback metrics — it cannot
// leave the app waiting.
installTextMeasurer().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
