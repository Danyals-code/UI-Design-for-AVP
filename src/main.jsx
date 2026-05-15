import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { useStore } from './store'
import './index.css'

// Dev-only escape hatch for end-to-end tests / browser-console
// debugging. `window.__store.getState()` returns the live zustand
// store; `window.__store.dispatch(actionName, ...args)` runs a store
// action. Removed in production builds via Vite's `import.meta.env`
// guard so it can't leak to released bundles.
if (import.meta.env.DEV) {
  window.__store = useStore
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
