// Shared recording state shared between the mic button and the recording pill
// (both live in different slots, so we hold a tiny external store instead of
// relying on React context).
const voice = {
  phase: 'idle', // idle | starting | recording | processing | error
  error: '',
  rec: null,
  levels: [],
  inputActions: null,
  input: null,
  listeners: new Set(),
  notify() { this.listeners.forEach((l) => l()) },
  set(patch) { Object.assign(this, patch); this.notify() },
  subscribe(l) { this.listeners.add(l); return () => { this.listeners.delete(l) } },
}

const MAX_RECORDING_SECS = 300
const WAVE_COLOR_DEFAULT = '#ffffff'

function useVoice() {
  const [, force] = React.useReducer((x) => x + 1, 0)
  React.useEffect(() => voice.subscribe(force), [])
  return voice
}

function fmtSize(b) {
  if (!b || b <= 0) return ''
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB'
  return Math.max(1, Math.round(b / 1e6)) + ' MB'
}

function fmtTime(sec) {
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  return m + ':' + String(s % 60).padStart(2, '0')
}
