/** Mic button (idle) and the recording pill (recording/processing/error). */

import * as React from 'react'
import { getVoiceState, setVoiceState, subscribeVoice, MAX_RECORDING_SECS } from './state.ts'
import { startRecording, cancelRecording, stopWith } from './recorder.ts'
import { drawWaveform } from './waveform.ts'
import { MicIcon, XIcon, StopIcon, ArrowIcon, WarnIcon, SpinnerIcon } from './icons.tsx'
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

/** The mic button next to the send button. */
export function MicButton(props: VoiceSlotProps): React.JSX.Element | null {
  const v = useVoiceState()
  const st = getVoiceState()
  if (props.inputActions) st.inputActions = props.inputActions
  if (props.input) st.input = props.input
  if (v.phase !== 'idle') return null
  return React.createElement('button', {
    type: 'button',
    className: styles.voiceMic,
    title: 'Voice input',
    onClick: startRecording,
  }, React.createElement(MicIcon))
}

/** The recording pill above the composer. */
export function RecordPill(props: VoiceSlotProps): React.JSX.Element | null {
  const v = useVoiceState()
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const st = getVoiceState()
  if (props.inputActions) st.inputActions = props.inputActions
  if (props.input) st.input = props.input

  // Level sampling + auto-stop at MAX_RECORDING_SECS.
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
        const s = getVoiceState()
        s.levels.push(Math.min(1, (sum / data.length / 255) * 2.2))
        if (s.levels.length > 150) s.levels.shift()
      }
      if (elapsed >= MAX_RECORDING_SECS) stopWith('insert')
    }, 50)
    return () => window.clearInterval(id)
  }, [v.phase])

  // Waveform draw loop.
  React.useEffect(() => {
    if (v.phase !== 'recording') return
    const id = window.setInterval(() => {
      if (canvasRef.current) drawWaveform(canvasRef.current)
    }, 50)
    return () => window.clearInterval(id)
  }, [v.phase])

  if (v.phase === 'idle' || v.phase === 'starting') return null

  if (v.phase === 'recording') {
    return React.createElement('div', { className: styles.voicePill },
      React.createElement('button', { type: 'button', className: styles.voicePillBtn + ' ' + styles.voicePillCancel, title: 'Cancel recording', onClick: cancelRecording }, React.createElement(XIcon)),
      React.createElement('canvas', { className: styles.voiceWave, ref: canvasRef, width: 720, height: 40 }),
      React.createElement('button', { type: 'button', className: styles.voicePillBtn + ' ' + styles.voicePillStop, title: 'Stop and insert text', onClick: () => stopWith('insert') }, React.createElement(StopIcon)),
      React.createElement('button', { type: 'button', className: styles.voicePillBtn + ' ' + styles.voicePillSend, title: 'Send', onClick: () => stopWith('send') }, React.createElement(ArrowIcon)),
    )
  }
  if (v.phase === 'processing') {
    return React.createElement('div', { className: styles.voicePill },
      React.createElement('span', { className: styles.voiceStatus }, React.createElement(SpinnerIcon), 'Transcribing…'),
    )
  }
  return React.createElement('div', { className: styles.voicePill },
    React.createElement('span', { className: styles.voiceStatus + ' ' + styles.voiceStatusErr }, React.createElement(WarnIcon)),
    React.createElement('span', { className: styles.voiceErrText }, v.error),
    React.createElement('button', { type: 'button', className: styles.voicePillBtn + ' ' + styles.voicePillCancel, title: 'Dismiss', onClick: () => setVoiceState({ phase: 'idle', error: '' }) }, React.createElement(XIcon)),
  )
}
