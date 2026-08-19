// Mic button (idle) and the recording pill (recording/processing/error).
// Both subscribe to the shared `voice` store.

function MicButton(props) {
  const v = useVoice()
  voice.inputActions = props.inputActions
  voice.input = props.input
  if (v.phase !== 'idle') return null
  return React.createElement('button', { type: 'button', className: 'voice-mic', title: 'Voice input', onClick: startRecording }, micIcon())
}

function RecordPill(props) {
  const v = useVoice()
  const canvasRef = React.useRef(null)
  voice.inputActions = props.inputActions
  voice.input = props.input

  // Level sampling + auto-stop at MAX_RECORDING_SECS.
  React.useEffect(() => {
    if (v.phase !== 'recording') return
    let elapsed = 0
    const dispose = ctx.interval(() => {
      elapsed += 0.05
      const rec = voice.rec
      if (rec && rec.analyser) {
        const data = new Uint8Array(rec.analyser.frequencyBinCount)
        rec.analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]
        voice.levels.push(Math.min(1, (sum / data.length / 255) * 2.2))
        if (voice.levels.length > 150) voice.levels.shift()
      }
      if (elapsed >= MAX_RECORDING_SECS) stopWith('insert')
    }, 50)
    return () => dispose()
  }, [v.phase])

  // Waveform draw loop.
  React.useEffect(() => {
    if (v.phase !== 'recording') return
    const dispose = ctx.interval(() => {
      if (canvasRef.current) drawWaveform(canvasRef.current)
    }, 50)
    return () => dispose()
  }, [v.phase])

  if (v.phase === 'idle' || v.phase === 'starting') return null

  if (v.phase === 'recording') {
    return React.createElement('div', { className: 'voice-pill' },
      React.createElement('button', { type: 'button', className: 'voice-pill-btn voice-pill-cancel', title: 'Cancel recording', onClick: cancelRecording }, xIcon()),
      React.createElement('canvas', { className: 'voice-wave', ref: canvasRef, width: 720, height: 40 }),
      React.createElement('button', { type: 'button', className: 'voice-pill-btn voice-pill-stop', title: 'Stop and insert text', onClick: () => stopWith('insert') }, stopIcon()),
      React.createElement('button', { type: 'button', className: 'voice-pill-btn voice-pill-send', title: 'Send', onClick: () => stopWith('send') }, arrowIcon()),
    )
  }
  if (v.phase === 'processing') {
    return React.createElement('div', { className: 'voice-pill' },
      React.createElement('span', { className: 'voice-status' }, spinnerIcon(), 'Transcribing…'),
    )
  }
  return React.createElement('div', { className: 'voice-pill' },
    React.createElement('span', { className: 'voice-status voice-status-err' }, warnIcon()),
    React.createElement('span', { className: 'voice-err-text' }, v.error),
    React.createElement('button', { type: 'button', className: 'voice-pill-btn voice-pill-cancel', title: 'Dismiss', onClick: () => voice.set({ phase: 'idle', error: '' }) }, xIcon()),
  )
}
