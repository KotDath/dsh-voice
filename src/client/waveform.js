// Live waveform drawn on a <canvas> from the analyser's frequency data,
// fading right-to-left like ChatGPT's voice mode. Runs on ctx.interval so the
// timer service owns the frame loop.
function drawWaveform(canvas) {
  const g = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  g.clearRect(0, 0, w, h)
  if (!voice.waveColor) {
    try { voice.waveColor = getComputedStyle(canvas).color || WAVE_COLOR_DEFAULT } catch (e) { voice.waveColor = WAVE_COLOR_DEFAULT }
  }
  const levels = voice.levels
  if (!levels.length) return
  const step = 7
  const bw = 3.5
  const midY = h / 2
  for (let i = 0; i < levels.length && i * step < w; i++) {
    const level = levels[levels.length - 1 - i]
    const age = i / levels.length
    const x = w - 10 - i * step
    if (age > 0.72) {
      g.globalAlpha = 0.22
      g.fillStyle = voice.waveColor
      g.fillRect(x, midY - 1.5, 2, 3)
    } else {
      const alpha = 1 - age * 0.75
      const hh = Math.max(2.5, level * (h - 6) * 0.5 * (1 - age * 0.35))
      g.globalAlpha = alpha
      g.fillStyle = voice.waveColor
      g.fillRect(x, midY - hh, bw, hh * 2)
    }
  }
  g.globalAlpha = 1
}
