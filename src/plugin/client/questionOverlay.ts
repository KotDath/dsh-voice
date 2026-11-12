/**
 * A minimal recording indicator for the question-card case.
 *
 * The regular pill lives in `conversation.input.dock`, which belongs to the
 * composer fallback: while an `ask_user_question` card occupies the composer
 * seat the whole composer stack is replaced, so the pill is not mounted. This
 * overlay is a plain DOM element (no React root, no new bundle externals) that
 * floats just above the card and offers the same trio the composer has: cancel,
 * stop-and-insert (`⏹`) and stop-insert-and-send (`↑`).
 *
 * It is only ever created while a recording targets the question card.
 *
 * @module dsh-voice/client/questionOverlay
 */

import { fmtTime, getVoiceState, MAX_RECORDING_SECS, setVoiceState } from './state.ts'
import { cancelRecording, stopWith } from './recorder.ts'

export interface QuestionOverlay {
  refresh(): void
  destroy(): void
}

const FONT_STACK = 'var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", sans-serif)'

/**
 * Build and mount the indicator.
 * @returns handle used by the hotkey layer to refresh and remove it.
 */
export function startQuestionOverlay(): QuestionOverlay {
  let destroyed = false
  const root = document.createElement('div')
  root.setAttribute('data-dsh-voice-overlay', '')
  root.style.cssText = [
    'position:fixed', 'left:50%', 'transform:translateX(-50%)', 'top:80px', 'z-index:80',
    'display:flex', 'align-items:center', 'gap:8px', 'height:40px', 'padding:0 8px 0 12px',
    'border-radius:999px', 'box-sizing:border-box', 'pointer-events:auto',
    'background:var(--dsw-specific-input-major, #1f1f1f)',
    'color:var(--dsw-alias-label-primary, #fff)',
    'border:.5px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))',
    'box-shadow:var(--dsw-elevation-panel, 0 6px 24px rgba(0,0,0,.35))',
    'font:13px/1.2 ' + FONT_STACK,
  ].join(';')

  const button = (glyph: string, title: string): HTMLButtonElement => {
    const element = document.createElement('button')
    element.type = 'button'
    element.textContent = glyph
    element.title = title
    element.setAttribute('aria-label', title)
    element.style.cssText = [
      'width:28px', 'height:28px', 'padding:0', 'border:0', 'border-radius:999px',
      'display:grid', 'place-items:center', 'background:transparent', 'color:inherit',
      'font:inherit', 'font-size:14px', 'cursor:pointer',
    ].join(';')
    element.addEventListener('mouseenter', () => { element.style.background = 'var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.1))' })
    element.addEventListener('mouseleave', () => { element.style.background = 'transparent' })
    return element
  }

  const dot = document.createElement('span')
  dot.style.cssText = 'width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsw-alias-state-error-primary, #e5484d)'
  const label = document.createElement('span')
  label.style.cssText = 'white-space:nowrap;font-weight:500;margin-right:4px'

  const cancel = button('✕', 'Cancel recording')
  const stop = button('⏹', 'Stop and insert into your answer')
  stop.setAttribute('data-dsh-voice-action', 'insert')
  const send = button('↑', 'Stop, insert into your answer and send it')
  send.setAttribute('data-dsh-voice-action', 'send')
  root.append(cancel, dot, label, stop, send)
  document.body.appendChild(root)

  const dismiss = (): void => {
    const phase = getVoiceState().phase
    if (phase === 'recording' || phase === 'starting') cancelRecording()
    else setVoiceState({ phase: 'idle', error: '', target: null })
  }
  cancel.addEventListener('click', dismiss)
  stop.addEventListener('click', () => {
    if (getVoiceState().phase === 'recording') stopWith('insert')
  })
  send.addEventListener('click', () => {
    if (getVoiceState().phase === 'recording') stopWith('send')
  })

  /** Keep the indicator right above the card the question occupies. */
  const place = (): void => {
    const seat = document.querySelector('[data-composer-seat]')
    const top = seat === null ? 80 : seat.getBoundingClientRect().top - 52
    root.style.top = Math.max(8, Math.round(top)) + 'px'
  }

  const refresh = (): void => {
    if (destroyed) return
    const state = getVoiceState()
    const rec = state.rec
    if (state.phase === 'recording' && rec !== null) {
      const elapsed = (Date.now() - rec.startedAt) / 1000
      label.textContent = 'Recording ' + fmtTime(elapsed)
      dot.style.background = 'var(--dsw-alias-state-error-primary, #e5484d)'
      label.style.color = 'inherit'
      if (elapsed >= MAX_RECORDING_SECS) stopWith('insert')
      place()
      return
    }
    if (state.phase === 'processing') {
      label.textContent = 'Transcribing…'
      dot.style.background = 'var(--dsw-alias-state-business-primary, #4c8dff)'
      label.style.color = 'inherit'
      place()
      return
    }
    if (state.phase === 'error') {
      label.textContent = 'Error: ' + state.error.slice(0, 80)
      dot.style.background = 'var(--dsw-alias-state-error-primary, #e5484d)'
      label.style.color = 'var(--dsw-alias-state-error-primary, #e5484d)'
      place()
      return
    }
    label.textContent = 'Starting…'
    place()
  }

  const tick = window.setInterval(refresh, 200)
  refresh()

  return {
    refresh,
    destroy(): void {
      if (destroyed) return
      destroyed = true
      window.clearInterval(tick)
      root.remove()
    },
  }
}