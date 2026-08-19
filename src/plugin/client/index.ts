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

export { MicButton, RecordPill } from './components.tsx'
export { VoiceSettings } from './settings.tsx'
export { startRecording, cancelRecording, stopWith } from './recorder.ts'
export { getVoiceState, subscribeVoice } from './state.ts'
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
}
