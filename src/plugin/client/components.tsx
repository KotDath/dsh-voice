/** Composer-seat controls: the mic/stop button and the in-row recording strip. */

import * as React from 'react'
import { getVoiceState, setVoiceState, subscribeVoice, MAX_RECORDING_SECS } from './state.ts'
import { startRecording, cancelRecording, stopWith } from './recorder.ts'
import { getHotkeyConfig, getHotkeyLabel, subscribeHotkeyConfig } from './hotkey.ts'
import { drawWaveform } from './waveform.ts'
import { MicIcon, XIcon, StopIcon, WarnIcon, SpinnerIcon } from './icons.tsx'
import styles from './voice.module.css'

interface InputActionsLike {
  setDraft(text: string): void
  submit?(): void
}

export interface VoiceSlotProps {
  input?: { draft?: string } | null
  inputActions?: InputActionsLike | null
}

function useVoiceState(): { phase: string; error: string } {
  const [, force] = React.useReducer((x: number) => x + 1, 0)
  React.useEffect(() => subscribeVoice(force), [])
  const st = getVoiceState()
  return { phase: st.phase, error: st.error }
}

/**
 * Mirror the composer actions into the shared voice store. The cleanup drops
 * them when this slot unmounts, so a hotkey cannot finish into a composer that
 * is no longer on screen (and stale references never outlive their session).
 */
function useComposerBridge(props: VoiceSlotProps): void {
  React.useEffect(() => {
    const actions = props.inputActions ?? null
    const input = props.input ?? null
    const st = getVoiceState()
    st.inputActions = actions
    st.input = input
    return () => {
      const current = getVoiceState()
      if (current.inputActions === actions) current.inputActions = null
      if (current.input === input) current.input = null
    }
  }, [props.inputActions, props.input])
}

/** The configured combination, kept in sync with Settings → Voice. */
function useHotkeyLabel(): string {
  const [label, setLabel] = React.useState(getHotkeyLabel())
  React.useEffect(() => subscribeHotkeyConfig(() => setLabel(getHotkeyLabel())), [])
  return label
}

/**
 * The right-hand control beside the send button. It turns into the stop button
 * in place, so the click position never moves when a recording starts.
 */
export function MicButton(props: VoiceSlotProps): React.JSX.Element | null {
  const v = useVoiceState()
  const hotkey = useHotkeyLabel()
  useComposerBridge(props)

  if (v.phase === 'starting' || v.phase === 'processing') {
    return React.createElement('button', {
      type: 'button',
      className: styles.voiceMic,
      title: 'Transcribing…',
      disabled: true,
    }, React.createElement(SpinnerIcon))
  }
  if (v.phase === 'recording') {
    // Same choice as the shortcut's second press: send by default, insert when
    // Settings → Voice → Second press says so. The composer's own send button
    // stays disabled while the draft is empty, so this one carries the action.
    const finish = getHotkeyConfig().action
    return React.createElement('button', {
      type: 'button',
      className: styles.voiceMic,
      title: finish === 'send' ? 'Stop and send' : 'Stop and insert text',
      onClick: () => stopWith(finish),
    }, React.createElement(StopIcon))
  }
  return React.createElement('button', {
    type: 'button',
    className: styles.voiceMic,
    title: hotkey === '' ? 'Voice input' : 'Voice input (' + hotkey + ')',
    onClick: startRecording,
  }, React.createElement(MicIcon))
}

/**
 * The in-row recording strip, rendered into `conversation.input.left`: cancel,
 * the live waveform, and a status word. It adds no height of its own — the
 * composer's row and the ambient stats row below it stay exactly where they
 * were, which keeps the stop button under the microphone.
 */
export function VoiceRow(): React.JSX.Element | null {
  const v = useVoiceState()
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  // Sample the analyser into the shared level history (the pill used to do it).
  React.useEffect(() => {
    if (v.phase !== 'recording') return
    let elapsed = 0
    const id = window.setInterval(() => {
      elapsed += 0.05
      const rec = getVoiceState().rec
      if (rec && rec.analyser) {
        const data = new Uint8Array(rec.analyser.frequencyBinCount)
        rec.analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]!
        const state = getVoiceState()
        state.levels.push(Math.min(1, (sum / data.length / 255) * 2.2))
        if (state.levels.length > 150) state.levels.shift()
      }
      if (elapsed >= MAX_RECORDING_SECS) stopWith('insert')
    }, 50)
    return () => window.clearInterval(id)
  }, [v.phase])

  // Waveform draw loop.
  React.useEffect(() => {
    if (v.phase !== 'recording') return
    const id = window.setInterval(() => {
      const canvas = canvasRef.current
      if (canvas === null) return
      // Draw at CSS pixel density: a stretched 1200px canvas turns the bars
      // into a dotted line and, worse, its intrinsic width inflates the row.
      const width = Math.round(canvas.clientWidth)
      if (width > 0 && canvas.width !== width) canvas.width = width
      drawWaveform(canvas)
    }, 50)
    return () => window.clearInterval(id)
  }, [v.phase])

  // Codex-style row: the model select steps aside while dictating, so the
  // strip owns the free space of the row it already lives in.
  React.useEffect(() => {
    const root = document.documentElement
    const active = v.phase === 'starting' || v.phase === 'recording' || v.phase === 'processing'
    if (active) root.setAttribute('data-dsh-voice-recording', '')
    else root.removeAttribute('data-dsh-voice-recording')
    return () => root.removeAttribute('data-dsh-voice-recording')
  }, [v.phase])

  if (v.phase === 'idle') return null

  if (v.phase === 'processing') {
    // Same row, same height as the recording state: only the word in the middle
    // changes (the composer draft above stays exactly as the user left it).
    return React.createElement('div', { className: styles.voiceStrip + ' ' + styles.voiceStripCentered },
      React.createElement('span', { className: styles.voiceStripStatus }, 'Transcribing'),
    )
  }

  if (v.phase === 'error') {
    return React.createElement('div', { className: styles.voiceStrip },
      React.createElement('span', { className: styles.voiceStripError },
        React.createElement(WarnIcon), React.createElement('span', null, v.error)),
      React.createElement('button', {
        type: 'button',
        className: styles.voiceStripBtn,
        title: 'Dismiss',
        onClick: () => setVoiceState({ phase: 'idle', error: '', target: null }),
      }, React.createElement(XIcon)),
    )
  }

  return React.createElement('div', { className: styles.voiceStrip },
    React.createElement('button', {
      type: 'button',
      className: styles.voiceStripBtn,
      title: 'Cancel recording',
      onClick: cancelRecording,
    }, React.createElement(XIcon)),
    React.createElement('canvas', {
      ref: canvasRef,
      className: styles.voiceStripWave,
      width: 720,
      height: 24,
    }),
  )
}