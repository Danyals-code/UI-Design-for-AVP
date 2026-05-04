// Thin trigger for the global Add Palette (the same search-driven palette
// that opens with Shift+A). Keeps both entry points wired to one UI so the
// user has a single mental model for "add something". Dispatches an
// `open-add-palette` event that CommandPalette listens for.

import { PlusIcon, ChevronRight } from './icons'

export default function AddDropdown({ variant = 'compact' }) {
  const open = () => window.dispatchEvent(new CustomEvent('open-add-palette'))

  if (variant === 'compact') {
    return (
      <button
        onClick={open}
        className="btn btn-icon"
        title="Add element (Shift+A)"
      >
        <PlusIcon />
      </button>
    )
  }
  return (
    <button onClick={open} className="btn btn-primary" title="Add element (Shift+A)">
      <PlusIcon /> Add <ChevronRight size={8} />
    </button>
  )
}
