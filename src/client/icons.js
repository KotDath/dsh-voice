// Inline SVG icon set (Feather-style, 24x24 viewBox, stroke currentColor).
const ic = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

const micIcon = () => React.createElement('svg', ic,
  React.createElement('path', { d: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z' }),
  React.createElement('path', { d: 'M19 10v2a7 7 0 0 1-14 0v-2' }),
  React.createElement('line', { x1: 12, y1: 19, x2: 12, y2: 23 }),
)
const xIcon = () => React.createElement('svg', ic,
  React.createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
  React.createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18 }),
)
const arrowIcon = () => React.createElement('svg', Object.assign({}, ic, { strokeWidth: 2.5 }),
  React.createElement('line', { x1: 12, y1: 19, x2: 12, y2: 5 }),
  React.createElement('polyline', { points: '5 12 12 5 19 12' }),
)
const stopIcon = () => React.createElement('svg', ic,
  React.createElement('rect', { x: 7, y: 7, width: 10, height: 10, rx: 2.5, fill: 'currentColor', stroke: 'none' }),
)
const warnIcon = () => React.createElement('svg', ic,
  React.createElement('path', { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }),
  React.createElement('line', { x1: 12, y1: 9, x2: 12, y2: 13 }),
  React.createElement('line', { x1: 12, y1: 17, x2: 12.01, y2: 17 }),
)
const spinnerIcon = () => React.createElement('svg', Object.assign({}, ic, { className: 'voice-spin' }),
  React.createElement('path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' }),
)
