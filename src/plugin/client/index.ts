/**
 * dsh-voice — browser half.
 *
 * Slot registrations: mic button next to the send button
 * (conversation.input.right), the recording pill above the composer
 * (conversation.input.dock) and the Voice settings page (settings.section).
 * All host calls go through plain fetch to /api/voice/* (see the Node half).
 *
 * @module dsh-voice/client
 */

import * as React from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls ui-conversation's SlotMap merge (input.dock / input.right entries).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls ui-settings' SlotMap merge (the settings.section entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { MicButton, RecordPill, type VoiceSlotProps } from './components.tsx'
import { VoiceSettings } from './settings.tsx'
import { installHotkeyLayer, loadHotkeyConfig } from './hotkey.ts'
import { VoiceComposer, type VoiceComposerProps } from './composer.tsx'
import { getVoiceState, subscribeVoice } from './state.ts'

export { MicButton, RecordPill } from './components.tsx'
export { VoiceComposer } from './composer.tsx'
export { VoiceSettings } from './settings.tsx'
export { startRecording, cancelRecording, stopWith } from './recorder.ts'
export { getVoiceState, subscribeVoice } from './state.ts'
export {
  armHotkeyTest, formatCombo, getHotkeyConfig, getHotkeyLabel, parseCombo,
  setHotkeyConfig, specFromEvent, subscribeHotkeyConfig, suspendHotkey,
} from './hotkey.ts'
export type { HotkeyConfig, HotkeySpec } from './hotkey.ts'
export type { VoiceSlotProps } from './components.tsx'

/** Required services: slot registration (the browser runtime provides slots). */
export const inject = ['slots']

/**
 * Client plugin body: register the mic button, recording pill and settings page.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const slots = ctx.get('slots')
  if (slots === undefined) return

  // Mic button in the composer tool row.
  slots.inject('conversation.input.right', () => slots.register({
    name: 'conversation.input.right',
    id: 'voice',
    order: 5,
    label: () => 'Voice input',
  }, (props: VoiceSlotProps) => React.createElement(MicButton, props)))

  // Recording pill: full-width row above the composer card.
  slots.inject('conversation.input.dock', () => slots.register({
    name: 'conversation.input.dock',
    id: 'voice-rec',
    order: 0,
    label: () => 'Voice recording',
  }, (props: VoiceSlotProps) => React.createElement(RecordPill, props)))

  // Settings page "Voice".
  slots.inject('settings.section', () => slots.register({
    name: 'settings.section',
    id: 'voice',
    order: 25,
    label: () => 'Voice',
  }, () => React.createElement(VoiceSettings)))

  // Composer takeover: while a recording is active the resident composer card is
  // replaced by the voice card (draft on top, ✕ / waveform / ⏹ / ↑ below), the
  // way Codex presents dictation. The chain re-elects on a slot version change,
  // so the entry is registered and disposed with the voice phase — the selector
  // itself stays a pure constant.
  let composerReady = false
  let disposeComposer: (() => void) | null = null
  const syncComposer = (): void => {
    const phase = getVoiceState().phase
    const wanted = composerReady
      && (phase === 'starting' || phase === 'recording' || phase === 'processing' || phase === 'error')
    if (wanted && disposeComposer === null) {
      try {
        disposeComposer = slots.register({
        name: 'conversation.composer',
        select: () => 'voice' as const,
        }, (props) => React.createElement(VoiceComposer, props as unknown as VoiceComposerProps))
      } catch {
        // The takeover is an enhancement: without it the dock pill still shows.
        disposeComposer = null
      }
    } else if (!wanted && disposeComposer !== null) {
      disposeComposer()
      disposeComposer = null
    }
  }
  ctx.effect(() => slots.inject('conversation.composer', () => {
    composerReady = true
    syncComposer()
    return () => {
      composerReady = false
      if (disposeComposer !== null) { disposeComposer(); disposeComposer = null }
    }
  }), 'dsh-voice: composer takeover seat')
  ctx.effect(() => {
    const off = subscribeVoice(syncComposer)
    return () => {
      off()
      if (disposeComposer !== null) { disposeComposer(); disposeComposer = null }
    }
  }, 'dsh-voice: composer takeover sync')

  // Keyboard activation (Ctrl+E by default): the first press starts a
  // recording, the second one finishes it (send). The layer lives on window in
  // the bubble phase and ignores events the Harness commands already handled.
  ctx.effect(() => installHotkeyLayer(), 'dsh-voice: hotkey layer')
  // Pick up the combination saved by a previous session (the defaults apply
  // while the host half is unmounted).
  void loadHotkeyConfig()
}
