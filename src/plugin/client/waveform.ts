/** Live waveform drawn on a <canvas> from the analyser's frequency data,
 *  fading right-to-left like ChatGPT's voice mode. */

import { getVoiceState } from './state.ts'

const WAVE_COLOR_DEFAULT = '#ffffff'

export function drawWaveform(canvas: HTMLCanvasElement): void {
  const g = canvas.getContext('2d')
  if (!g) return
  const w = canvas.width
  const h = canvas.height
  g.clearRect(0, 0, w, h)
  const st = getVoiceState()
  if (!st.waveColor) {
    try { st.waveColor = getComputedStyle(canvas).color || WAVE_COLOR_DEFAULT } catch { st.waveColor = WAVE_COLOR_DEFAULT }
  }
  const levels = st.levels
  if (!levels.length) return
  const step = 7
  const bw = 3.5
  const midY = h / 2
  for (let i = 0; i < levels.length && i * step < w; i++) {
    const level = levels[levels.length - 1 - i]!
    const age = i / levels.length
    const x = w - 10 - i * step
    if (age > 0.72) {
      g.globalAlpha = 0.22
      g.fillStyle = st.waveColor!
      g.fillRect(x, midY - 1.5, 2, 3)
    } else {
      const alpha = 1 - age * 0.75
      const hh = Math.max(2.5, level * (h - 6) * 0.5 * (1 - age * 0.35))
      g.globalAlpha = alpha
      g.fillStyle = st.waveColor!
      g.fillRect(x, midY - hh, bw, hh * 2)
    }
  }
  g.globalAlpha = 1
}
