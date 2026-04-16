/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Blender / Figma-inspired palette
        bg:         '#181818',
        surface:    '#1e1e1e',
        surface2:   '#242424',
        surface3:   '#2b2b2b',
        surface4:   '#333333',
        hover:      '#2f2f2f',
        border:     '#2e2e2e',
        borderHi:   '#3a3a3a',
        text:       '#e4e4e4',
        textDim:    '#9a9a9a',
        textMute:   '#6a6a6a',
        accent:     '#0a84ff',
        accentDim:  '#0a5a9c',
        accentBg:   'rgba(10, 132, 255, 0.12)',
        danger:     '#ff453a',
        success:    '#30d158',
        // legacy aliases so existing class names still resolve
        panel:      '#181818',
        panel2:     '#1e1e1e',
        panel3:     '#262626',
        accent2:    '#0a84ff',
        textdim:    '#9a9a9a'
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
      },
      fontSize: {
        '2xs': '10px',
        xs: '11px',
        sm: '12px',
        base: '13px'
      },
      boxShadow: {
        panel: '0 2px 10px rgba(0, 0, 0, 0.3)',
        pop: '0 8px 24px rgba(0, 0, 0, 0.45)'
      },
      transitionDuration: {
        150: '150ms'
      }
    }
  },
  plugins: []
}
