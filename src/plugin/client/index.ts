/**
 * dsh-voice — browser half.
 *
 * Slot registrations: the mic/stop button next to the send button
 * (conversation.input.right), the recording strip inside the composer's own
 * tool row (conversation.input.left) and the Voice settings page
 * (settings.section). All host calls go through plain fetch to /api/voice/*
 * (see the Node half).
 *
 * @module dsh-voice/client
 */

import * as React from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls ui-conversation's SlotMap merge (input.dock / input.right entries).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls ui-settings' SlotMap merge (the settings.section entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { MicButton, VoiceRow, type VoiceSlotProps } from './components.tsx'
import { VoiceSettings } from './settings.tsx'
import { installHotkeyLayer, loadHotkeyConfig } from './hotkey.ts'
import { installSubmitLayer } from './submitSeat.ts'

export { MicButton, VoiceRow } from './components.tsx'
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
 * Client plugin body: mic button, in-row recording strip and settings page.
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

  // In-row recording strip: cancel + live waveform, inside the composer's own
  // tool row so the card height (and the ambient stats row below it) never
  // changes — the stop button stays exactly under the microphone.
  slots.inject('conversation.input.left', () => slots.register({
    name: 'conversation.input.left',
    id: 'voice-strip',
    order: 0,
    label: () => 'Voice recording',
  }, () => React.createElement(VoiceRow)))

  // Settings page "Voice".
  slots.inject('settings.section', () => slots.register({
    name: 'settings.section',
    id: 'voice',
    order: 25,
    label: () => 'Voice',
  }, () => React.createElement(VoiceSettings)))

  // Keyboard activation (Ctrl+E by default): the first press starts a
  // recording, the second one finishes it (send). The layer lives on window in
  // the bubble phase and ignores events the Harness commands already handled.
  ctx.effect(() => installHotkeyLayer(), 'dsh-voice: hotkey layer')
  // The composer's own submit button is the dictation's send control: the layer
  // enables it while recording and takes the press (see submitSeat.ts).
  ctx.effect(() => installSubmitLayer(), 'dsh-voice: composer submit seat')
  // Pick up the combination saved by a previous session (the defaults apply
  // while the host half is unmounted).
  void loadHotkeyConfig()
}
