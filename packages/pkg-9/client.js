// dsh-voice — Client half (pkg-6)
// Body for cordis_define code.client. Runtime: browser page of DSH Web GUI.
// UI: mic button in conversation.input.right, recording pill in
// conversation.input.dock, settings page "Voice" (providers, engine, models).
return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    styles.insert(`
.voice-mic { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--dsw-alias-border-l1); background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; padding: 0; box-sizing: border-box; }
.voice-mic:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.voice-pill { display: flex; align-items: center; gap: 10px; height: 52px; border-radius: 26px; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); padding: 0 14px; width: 100%; max-width: 720px; margin: 0 auto; box-shadow: 0 8px 24px rgba(0,0,0,0.18); box-sizing: border-box; }
.voice-pill-btn { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; padding: 0; flex: none; box-sizing: border-box; }
.voice-pill-cancel { border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary); }
.voice-pill-cancel:hover { background: var(--dsw-alias-bg-layer-2); }
.voice-pill-stop { border: none; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.voice-pill-stop:hover { filter: brightness(1.15); }
.voice-pill-send { border: none; background: var(--dsw-alias-label-primary); color: var(--dsw-alias-bg-base); }
.voice-pill-send:hover { opacity: 0.9; }
.voice-wave { flex: 1; height: 40px; width: 100%; color: var(--dsw-alias-label-primary); }
.voice-status { display: flex; align-items: center; gap: 10px; color: var(--dsw-alias-label-secondary); font-size: 13px; }
.voice-status-err { color: var(--dsw-alias-state-error-primary); }
.voice-err-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.voice-spin { animation: voice-spin 1s linear infinite; }
@keyframes voice-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.voice-settings { display: flex; flex-direction: column; gap: 12px; max-width: 560px; padding: 8px 0; }
.voice-settings .voice-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.voice-settings input, .voice-settings select { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-primary); border-radius: 6px; padding: 6px 8px; font-size: 13px; }
.voice-save { align-self: flex-start; background: var(--dsw-alias-brand-primary); color: #fff; border: none; border-radius: 6px; padding: 7px 14px; font-size: 13px; cursor: pointer; }
.voice-hint { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.voice-saved { font-size: 12px; color: var(--dsw-alias-state-success-primary); }
.voice-row { display: flex; gap: 8px; align-items: center; }
.voice-row select { flex: 1; }
.voice-action { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-primary); border-radius: 6px; padding: 6px 10px; font-size: 12px; cursor: pointer; white-space: nowrap; }
.voice-action:disabled { opacity: 0.5; cursor: default; }
.voice-bar { height: 6px; border-radius: 3px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.voice-bar > div { height: 100%; background: var(--dsw-alias-brand-primary); transition: width 0.4s; }
.voice-dl-info { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.voice-advanced { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.voice-advanced-body { display: flex; flex-direction: column; gap: 12px; }
`)

    const voice = {
      phase: 'idle',
      error: '',
      rec: null,
      levels: [],
      inputActions: null,
      input: null,
      listeners: new Set(),
      notify() { this.listeners.forEach((l) => l()) },
      set(patch) { Object.assign(this, patch); this.notify() },
      subscribe(l) { this.listeners.add(l); return () => { this.listeners.delete(l) } },
    }

    function useVoice() {
      const [, force] = React.useReducer((x) => x + 1, 0)
      React.useEffect(() => voice.subscribe(force), [])
      return voice
    }

    const ic = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
    const micIcon = () => React.createElement('svg', ic,
      React.createElement('path', { d: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z' }),
      React.createElement('path', { d: 'M19 10v2a7 7 0 0 1-14 0v-2' }),
      React.createElement('line', { x1: 12, y1: 19, x2: 12, y2: 23 }),
    )
    const xIcon = () => React.createElement('svg', ic,
      React.createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
      React.createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18 }),
    )
    const arrowIcon = () => React.createElement('svg', Object.assign({}, ic, { strokeWidth: 2.5 }),
      React.createElement('line', { x1: 12, y1: 19, x2: 12, y2: 5 }),
      React.createElement('polyline', { points: '5 12 12 5 19 12' }),
    )
    const stopIcon = () => React.createElement('svg', ic,
      React.createElement('rect', { x: 7, y: 7, width: 10, height: 10, rx: 2.5, fill: 'currentColor', stroke: 'none' }),
    )
    const warnIcon = () => React.createElement('svg', ic,
      React.createElement('path', { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }),
      React.createElement('line', { x1: 12, y1: 9, x2: 12, y2: 13 }),
      React.createElement('line', { x1: 12, y1: 17, x2: 12.01, y2: 17 }),
    )
    const spinnerIcon = () => React.createElement('svg', Object.assign({}, ic, { className: 'voice-spin' }),
      React.createElement('path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' }),
    )

    function teardown(rec) {
      if (!rec) return
      try { rec.stream.getTracks().forEach((t) => t.stop()) } catch (e) {}
      if (rec.audioCtx) { try { rec.audioCtx.close() } catch (e) {} }
    }

    function waitStop(rec) {
      return new Promise((resolve) => {
        rec.recorder.addEventListener('stop', () => resolve(), { once: true })
      })
    }

    function start() {
      voice.set({ phase: 'starting', error: '' })
      voice.levels = []
      const run = (async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Browser has no microphone access (HTTPS or localhost required)')
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
        if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder is not supported by this browser')
        let mimeType = 'audio/webm;codecs=opus'
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = ''
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType: mimeType }) : new MediaRecorder(stream)
        const chunks = []
        recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data) }
        let audioCtx = null
        let analyser = null
        const AC = typeof AudioContext !== 'undefined' ? AudioContext : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null)
        if (AC) {
          audioCtx = new AC()
          const src = audioCtx.createMediaStreamSource(stream)
          analyser = audioCtx.createAnalyser()
          analyser.fftSize = 128
          src.connect(analyser)
        }
        voice.rec = { recorder: recorder, stream: stream, chunks: chunks, audioCtx: audioCtx, analyser: analyser, stopping: false, startedAt: Date.now(), mime: mimeType || recorder.mimeType || 'audio/webm' }
        recorder.start(250)
        voice.set({ phase: 'recording' })
      })()
      run.catch((err) => { voice.set({ phase: 'error', error: String(err && err.message ? err.message : err) }) })
    }

    function cancel() {
      const rec = voice.rec
      if (!rec || rec.stopping) return
      rec.stopping = true
      const stopped = waitStop(rec)
      try { rec.recorder.stop() } catch (e) {}
      stopped.then(() => {
        teardown(rec)
        voice.rec = null
        voice.set({ phase: 'idle' })
      })
    }

    function stopWith(mode) {
      const rec = voice.rec
      if (!rec || rec.stopping) return
      rec.stopping = true
      const stopped = waitStop(rec)
      try { rec.recorder.stop() } catch (e) {}
      stopped.then(() => finish(rec, mode))
    }

    async function finish(rec, mode) {
      teardown(rec)
      voice.rec = null
      voice.set({ phase: 'processing' })
      try {
        const blob = new Blob(rec.chunks, { type: rec.mime })
        const dataBase64 = await new Promise((resolve, reject) => {
          if (typeof FileReader === 'undefined') { reject(new Error('FileReader is not supported')); return }
          const fr = new FileReader()
          fr.onload = () => { const s = String(fr.result || ''); resolve(s.indexOf(',') >= 0 ? s.slice(s.indexOf(',') + 1) : s) }
          fr.onerror = () => reject(new Error('failed to read audio'))
          fr.readAsDataURL(blob)
        })
        const result = await host.call('voice/transcribe', { dataBase64: dataBase64, mimeType: rec.mime })
        if (!result || !result.ok) {
          voice.set({ phase: 'error', error: result && result.error ? result.error : 'Transcription failed' })
          return
        }
        const text = String(result.text || '').trim()
        if (!text) { voice.set({ phase: 'error', error: 'No speech recognized' }); return }
        const actions = voice.inputActions
        if (!actions || typeof actions.setDraft !== 'function') {
          voice.set({ phase: 'error', error: 'Composer is unavailable' })
          return
        }
        const draft = voice.input && typeof voice.input.draft === 'string' ? voice.input.draft : ''
        actions.setDraft(draft ? draft + ' ' + text : text)
        if (mode === 'send' && typeof actions.submit === 'function') actions.submit()
        voice.set({ phase: 'idle' })
      } catch (err) {
        voice.set({ phase: 'error', error: String(err && err.message ? err.message : err) })
      }
    }

    function MicButton(props) {
      const v = useVoice()
      voice.inputActions = props.inputActions
      voice.input = props.input
      if (v.phase !== 'idle') return null
      return React.createElement('button', { type: 'button', className: 'voice-mic', title: 'Voice input', onClick: start }, micIcon())
    }

    function RecordPill(props) {
      const v = useVoice()
      const canvasRef = React.useRef(null)
      voice.inputActions = props.inputActions
      voice.input = props.input

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
            const level = Math.min(1, (sum / data.length / 255) * 2.2)
            voice.levels.push(level)
            if (voice.levels.length > 150) voice.levels.shift()
          }
          if (elapsed >= 300) stopWith('insert')
        }, 50)
        return () => dispose()
      }, [v.phase])

      React.useEffect(() => {
        if (v.phase !== 'recording') return
        const dispose = ctx.interval(() => {
          const canvas = canvasRef.current
          if (!canvas) return
          const g = canvas.getContext('2d')
          const w = canvas.width
          const h = canvas.height
          g.clearRect(0, 0, w, h)
          if (!voice.waveColor) {
            try { voice.waveColor = getComputedStyle(canvas).color || '#ffffff' } catch (e) { voice.waveColor = '#ffffff' }
          }
          const levels = voice.levels
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
        }, 50)
        return () => dispose()
      }, [v.phase])

      if (v.phase === 'idle' || v.phase === 'starting') return null

      if (v.phase === 'recording') {
        return React.createElement('div', { className: 'voice-pill' },
          React.createElement('button', { type: 'button', className: 'voice-pill-btn voice-pill-cancel', title: 'Cancel recording', onClick: cancel }, xIcon()),
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

    function fmtSize(b) {
      if (!b || b <= 0) return ''
      if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB'
      return Math.max(1, Math.round(b / 1e6)) + ' MB'
    }

    function VoiceSettings() {
      const [cfg, setCfg] = React.useState(null)
      const [models, setModels] = React.useState(null)
      const [platform, setPlatform] = React.useState(null)
      const [downloads, setDownloads] = React.useState({})
      const [saved, setSaved] = React.useState('')
      const [showAdvanced, setShowAdvanced] = React.useState(false)

      function refreshModels() {
        host.call('voice/models').then((r) => { if (r && r.ok) { setModels(r.models); setPlatform(r.platform) } }).catch(() => {})
      }

      React.useEffect(() => {
        let alive = true
        host.call('voice/config').then((c) => { if (alive && c) setCfg(c) }).catch(() => {})
        refreshModels()
        return () => { alive = false }
      }, [])

      React.useEffect(() => {
        const dispose = ctx.interval(() => {
          host.call('voice/download-status', {}).then((r) => {
            if (r && r.ok) setDownloads(r.downloads || {})
          }).catch(() => {})
        }, 700)
        return () => dispose()
      }, [])

      if (!cfg) return React.createElement('div', { className: 'voice-settings' }, 'Loading…')
      const set = (path, value) => {
        const next = JSON.parse(JSON.stringify(cfg))
        const parts = path.split('.')
        let node = next
        for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]]
        node[parts[parts.length - 1]] = value
        setCfg(next)
      }
      const save = () => {
        host.call('voice/config', cfg).then(() => {
          setSaved('Saved ✓')
          ctx.timeout(() => setSaved(''), 2000)
        }).catch(() => setSaved('Save failed'))
      }
      const nestedField = (label, group, path, type) => React.createElement('label', { className: 'voice-field' },
        label,
        React.createElement('input', { type: type || 'text', value: cfg[group][path], onChange: (e) => set(group + '.' + path, e.target.value) }),
      )

      const dlEngine = downloads['engine'] || null
      const selModel = cfg.tcpp && cfg.tcpp.modelId ? cfg.tcpp.modelId : ''
      const dlModel = downloads['model:' + selModel] || null
      const modelMeta = (models || []).find((m) => m.id === selModel) || null
      const modelReady = modelMeta ? modelMeta.downloaded : false

      const bar = (dl, info) => {
        const pct = dl && dl.total > 0 ? Math.min(100, Math.round((dl.bytes / dl.total) * 100)) : 0
        return React.createElement('div', null,
          React.createElement('div', { className: 'voice-bar' }, React.createElement('div', { style: { width: pct + '%' } })),
          React.createElement('div', { className: 'voice-dl-info' }, info),
        )
      }

      const modelOptions = (models || []).map((m) => React.createElement('option', { key: m.id, value: m.id },
        (m.downloaded ? '✓ ' : '  ') + m.name + ' · ' + fmtSize(m.size) + (m.downloaded ? '' : ' — not downloaded'),
      ))

      const advancedToggle = React.createElement('button', { type: 'button', className: 'voice-action', onClick: () => setShowAdvanced((s) => !s) },
        (showAdvanced ? '▾ ' : '▸ ') + 'Advanced',
      )

      return React.createElement('div', { className: 'voice-settings' },
        React.createElement('label', { className: 'voice-field' },
          'Transcription provider',
          React.createElement('select', { value: cfg.provider, onChange: (e) => set('provider', e.target.value) },
            React.createElement('option', { value: 'tcpp' }, 'transcribe.cpp — Handy model catalog (GigaAM, Voxtral, Whisper…)'),
            React.createElement('option', { value: 'local' }, 'whisper.cpp (single GGML model)'),
            React.createElement('option', { value: 'api' }, 'HTTP API (OpenAI-compatible)'),
          ),
        ),
        cfg.provider === 'tcpp' ? React.createElement('div', null,
          React.createElement('div', { className: 'voice-field' },
            'Transcription engine (transcribe-cli)',
            React.createElement('div', { className: 'voice-row' },
              React.createElement('span', { className: 'voice-hint', style: { flex: 1 } },
                platform && platform.exists ? '✓ installed' : (platform ? 'not installed' : '…'),
              ),
              React.createElement('button', {
                type: 'button', className: 'voice-action',
                disabled: !!(dlEngine && dlEngine.status === 'downloading'),
                onClick: () => { host.call('voice/engine-download', {}).then(refreshModels) },
              }, dlEngine && dlEngine.status === 'downloading' ? 'Downloading…' : 'Download engine'),
            ),
            platform && platform.path ? React.createElement('div', { className: 'voice-hint' }, 'path: ' + platform.path) : null,
            dlEngine && dlEngine.status === 'downloading' ? bar(dlEngine, fmtSize(dlEngine.bytes) + ' / ' + fmtSize(dlEngine.total)) : null,
            dlEngine && dlEngine.status === 'error' ? React.createElement('div', { className: 'voice-hint' }, 'Error: ' + dlEngine.error) : null,
          ),
          React.createElement('label', { className: 'voice-field' },
            'Model',
            React.createElement('div', { className: 'voice-row' },
              React.createElement('select', { value: selModel, onChange: (e) => set('tcpp.modelId', e.target.value) },
                models === null ? React.createElement('option', { value: selModel }, 'Loading catalog…') : modelOptions,
              ),
            ),
            React.createElement('div', { className: 'voice-row' },
              React.createElement('button', {
                type: 'button', className: 'voice-action',
                disabled: !modelMeta || modelReady || !!(dlModel && dlModel.status === 'downloading'),
                onClick: () => { host.call('voice/download', { modelId: selModel }).then(refreshModels) },
              }, dlModel && dlModel.status === 'downloading' ? 'Downloading…' : (modelReady ? 'Downloaded' : 'Download ' + (modelMeta ? fmtSize(modelMeta.size) : ''))),
              React.createElement('button', { type: 'button', className: 'voice-action', title: 'Refresh catalog', onClick: refreshModels }, '⟳'),
            ),
            dlModel && dlModel.status === 'downloading' ? bar(dlModel, fmtSize(dlModel.bytes) + ' / ' + fmtSize(dlModel.total)) : null,
            dlModel && dlModel.status === 'error' ? React.createElement('div', { className: 'voice-hint' }, 'Error: ' + dlModel.error) : null,
          ),
          React.createElement('div', { className: 'voice-advanced' },
            advancedToggle,
            showAdvanced ? React.createElement('div', { className: 'voice-advanced-body' },
              nestedField('Engine path (transcribe-cli)', 'tcpp', 'binary'),
              nestedField('Models directory', 'tcpp', 'modelsDir'),
              nestedField('Engine download URL ({platform}/{arch})', 'tcpp', 'engineUrl'),
            ) : null,
          ),
          React.createElement('div', { className: 'voice-hint' }, 'Same model catalog as Handy: GigaAM, Voxtral, Whisper, Qwen3-ASR, Parakeet, Canary, Moonshine and more. Models are downloaded from Hugging Face.'),
        ) : null,
        cfg.provider === 'local' ? React.createElement('div', null,
          React.createElement('div', { className: 'voice-advanced' },
            advancedToggle,
            showAdvanced ? React.createElement('div', { className: 'voice-advanced-body' },
              nestedField('whisper-cli path', 'local', 'binary'),
              nestedField('GGML model path', 'local', 'model'),
            ) : null,
          ),
          React.createElement('div', { className: 'voice-hint' }, 'Standard whisper.cpp models: tiny, base, small, medium, large-v3, turbo.'),
        ) : null,
        cfg.provider === 'api' ? React.createElement('div', null,
          nestedField('Endpoint URL', 'api', 'url'),
          nestedField('API key', 'api', 'key', 'password'),
          nestedField('Model (gpt-4o-transcribe, whisper-1, …)', 'api', 'model'),
          React.createElement('div', { className: 'voice-hint' }, 'OpenAI API, Groq, Deepgram-compatible or a local faster-whisper server.'),
        ) : null,
        React.createElement('label', { className: 'voice-field' },
          'Language (Whisper models & API)',
          React.createElement('select', { value: cfg.language, onChange: (e) => set('language', e.target.value) },
            React.createElement('option', { value: 'auto' }, 'Auto'),
            React.createElement('option', { value: 'ru' }, 'Russian'),
            React.createElement('option', { value: 'en' }, 'English'),
            React.createElement('option', { value: 'uk' }, 'Ukrainian'),
            React.createElement('option', { value: 'de' }, 'German'),
          ),
        ),
        React.createElement('div', { className: 'voice-row' },
          React.createElement('button', { type: 'button', className: 'voice-save', onClick: save }, 'Save'),
          saved ? React.createElement('span', { className: 'voice-saved' }, saved) : null,
        ),
      )
    }

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
  },
}
