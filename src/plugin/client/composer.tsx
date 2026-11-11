/**
 * The composer takeover: while a recording runs, register a `conversation.composer`
 * chain entry so the resident composer is replaced by a card of our own — the
 * draft text on top, and the composer's toolbar row turned into the voice
 * controls (✕ / waveform / ⏹ / ↑), the way Codex does it.
 *
 * The entry exists only while the voice state needs it: `index.ts` registers and
 * disposes it on every phase change, and a registration change bumps the slot's
 * version, which makes the chain re-elect immediately. That avoids depending on
 * a re-render we do not own.
 *
 * The takeover unmounts the regular composer bar, so the composer bridge that
 * `components.tsx` keeps in the voice store is gone — this component re-installs
 * it, otherwise `finish()` would have nowhere to insert. `send` is deferred
 * until the bar is back: `finish()` sets `pendingSubmit` and the bridge fires it
 * on the next mount.
 *
 * @module dsh-voice/client/composer
 */

import * as React from 'react'
import { getVoiceState, setVoiceState, subscribeVoice } from './state.ts'
import { cancelRecording, stopWith } from './recorder.ts'
import { drawWaveform } from './waveform.ts'
import { XIcon, StopIcon, ArrowIcon, SpinnerIcon, WarnIcon, MicIcon } from './icons.tsx'
import styles from './voice.module.css'

interface InputActionsLike {
  setDraft(text: string): void
  submit?(): void
}

export interface VoiceComposerProps {
  matched?: unknown
  inputActions?: InputActionsLike | null
  /** Standard seat hook: selector over the live composer draft. */
  useInput?: (selector: (state: { draft?: string }) => unknown) => unknown
}

/** Stable stand-in so the selector hook is called on every render regardless. */
const NO_SELECTOR = (): undefined => undefined

/** Subscribe to the shared voice store (phase + error). */
function useVoicePhase(): { phase: string; error: string } {
  const [, force] = React.useReducer((x: number) => x + 1, 0)
  React.useEffect(() => subscribeVoice(force), [])
  const state = getVoiceState()
  return { phase: state.phase, error: state.error }
}

/**
 * The takeover card.
 * @param props - standard slot seat: `inputActions` and the `useInput` selector hook.
 * @returns the replacement composer, or null before the seat is usable.
 */
export function VoiceComposer(props: VoiceComposerProps): React.JSX.Element | null {
  const { phase, error } = useVoicePhase()
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const useDraft = props.useInput ?? NO_SELECTOR
  const draft = String(useDraft((state) => state.draft) ?? '')

  // The regular composer bar is unmounted in this presentation: keep the facade
  // available for finish() and drop it when the takeover goes away.
  React.useEffect(() => {
    const actions = props.inputActions ?? null
    const state = getVoiceState()
    state.inputActions = actions
    return () => {
      const current = getVoiceState()
      if (current.inputActions === actions) current.inputActions = null
    }
  }, [props.inputActions])

  // An error is reported here because the pill is not mounted either.
  React.useEffect(() => {
    if (phase !== 'error') return
    const id = window.setTimeout(() => setVoiceState({ phase: 'idle', error: '', target: null }), 6000)
    return () => window.clearTimeout(id)
  }, [phase])

  // Waveform sampling.
  React.useEffect(() => {
    if (phase !== 'recording') return
    const id = window.setInterval(() => {
      if (canvasRef.current) drawWaveform(canvasRef.current)
    }, 50)
    return () => window.clearInterval(id)
  }, [phase])

  if (phase === 'idle') return null

  const busy = phase === 'processing' || phase === 'starting'
  const showDraft = draft !== ''

  return React.createElement('div', { className: styles.voiceComposerFrame },
    React.createElement('div', { className: styles.voiceComposerCard },
      showDraft || busy
        ? React.createElement('div', {
          className: showDraft ? styles.voiceComposerDraft : styles.voiceComposerHint,
        }, showDraft ? draft : 'Transcribing…')
        : React.createElement('div', { className: styles.voiceComposerHint },
          React.createElement(MicIcon), ' Listening…'),

      phase === 'error'
        ? React.createElement('div', { className: styles.voiceComposerErr },
          React.createElement(WarnIcon), React.createElement('span', null, error))
        : null,

      React.createElement('div', { className: styles.voiceComposerRow },
        phase === 'recording'
          ? React.createElement('button', {
            type: 'button',
            className: styles.voiceComposerBtn,
            title: 'Cancel recording',
            onClick: cancelRecording,
          }, React.createElement(XIcon))
          : React.createElement('span', { className: styles.voiceComposerBtnGhost }),

        React.createElement('div', { className: styles.voiceComposerWaveSlot },
          busy
            ? React.createElement('span', { className: styles.voiceComposerBusy },
              React.createElement(SpinnerIcon), ' Transcribing…')
            : React.createElement('canvas', {
              ref: canvasRef,
              className: styles.voiceComposerWave,
              width: 900,
              height: 24,
            }),
        ),

        phase === 'recording'
          ? React.createElement(React.Fragment, null,
            React.createElement('button', {
              type: 'button',
              className: styles.voiceComposerBtn,
              title: 'Stop and insert text',
              onClick: () => stopWith('insert'),
            }, React.createElement(StopIcon)),
            React.createElement('button', {
              type: 'button',
              className: styles.voiceComposerSend,
              title: 'Send',
              onClick: () => stopWith('send'),
            }, React.createElement(ArrowIcon)),
          )
          : null,
      ),
    ),
  )
}