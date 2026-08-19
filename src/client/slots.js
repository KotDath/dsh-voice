// Slot registrations: mic button, recording pill (dock row) and the settings
// page. All are additive slots; their props carry the session input state.
slots.inject('conversation.input.right', () => slots.register(
  { name: 'conversation.input.right', id: 'voice', order: 5, label: () => 'Voice input' },
  (props) => React.createElement(MicButton, { input: props.input, inputActions: props.inputActions }),
))

slots.inject('conversation.input.dock', () => slots.register(
  { name: 'conversation.input.dock', id: 'voice-rec', order: 0, label: () => 'Voice recording' },
  (props) => React.createElement(RecordPill, { input: props.input, inputActions: props.inputActions }),
))

slots.inject('settings.section', () => slots.register(
  { name: 'settings.section', id: 'voice', order: 25, label: () => 'Voice' },
  () => React.createElement(VoiceSettings),
))
