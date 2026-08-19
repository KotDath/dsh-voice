// Settings page: provider, engine, model catalog + downloads, language, and an
// Advanced section. The API key is set through its own RPC and only surfaced as
// hasKey — the key value never reaches the browser.
function VoiceSettings() {
  const [cfg, setCfg] = React.useState(null)
  const [models, setModels] = React.useState(null)
  const [platform, setPlatform] = React.useState(null)
  const [downloads, setDownloads] = React.useState({})
  const [apiKeyDraft, setApiKeyDraft] = React.useState('')
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
  const saveApiKey = () => {
    host.call('voice/api-key', { key: apiKeyDraft }).then(() => {
      setApiKeyDraft('')
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
      nestedField('Model (gpt-4o-transcribe, whisper-1, …)', 'api', 'model'),
      React.createElement('label', { className: 'voice-field' },
        cfg.api.hasKey ? 'API key — saved' : 'API key (host-only, never stored in the browser)',
        React.createElement('div', { className: 'voice-row' },
          React.createElement('input', { type: 'password', placeholder: cfg.api.hasKey ? '••••••••' : '', value: apiKeyDraft, onChange: (e) => setApiKeyDraft(e.target.value) }),
          React.createElement('button', { type: 'button', className: 'voice-action', onClick: saveApiKey, disabled: !apiKeyDraft }, 'Set'),
        ),
      ),
      React.createElement('div', { className: 'voice-hint' }, 'OpenAI API, Groq, Deepgram-compatible or a local faster-whisper server. The key is sent to the host and never returned to the page.'),
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
