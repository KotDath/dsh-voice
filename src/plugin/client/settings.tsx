/** Settings page: provider, engine, model catalog + downloads, language, and an
 *  Advanced section. The API key is set through its own endpoint and only
 *  surfaced as hasKey — the key value never reaches the browser. */

import * as React from 'react'
import { apiCall } from './recorder.ts'
import { fmtSize } from './state.ts'
import styles from './voice.module.css'

interface ConfigView {
  provider: 'tcpp' | 'local' | 'api'
  language: string
  tcpp: { binary: string; modelsDir: string; modelId: string; engineUrl: string }
  local: { binary: string; model: string }
  api: { url: string; model: string; hasKey: boolean }
}

interface ModelView {
  id: string
  name: string
  repo: string
  file: string
  size: number
  recommended: boolean
  windowSec: number
  streaming: boolean
  downloaded: boolean
}

interface PlatformView {
  os: string
  arch: string
  exists: boolean
  path: string
  adoptedFrom: string | null
  modelsDir: string
}

interface ModelsView {
  ok: boolean
  models?: ModelView[]
  platform?: PlatformView
  error?: string
}

interface DownloadView {
  status?: 'done' | 'downloading' | 'error'
  error?: string
}

export function VoiceSettings(): React.JSX.Element {
  const [cfg, setCfg] = React.useState<ConfigView | null>(null)
  const [models, setModels] = React.useState<ModelView[] | null>(null)
  const [platform, setPlatform] = React.useState<PlatformView | null>(null)
  const [downloads, setDownloads] = React.useState<Record<string, DownloadView>>({})
  const [apiKeyDraft, setApiKeyDraft] = React.useState('')
  const [saved, setSaved] = React.useState('')
  const [showAdvanced, setShowAdvanced] = React.useState(false)

  function refreshModels(): void {
    void apiCall<ModelsView>('/api/voice/models').then((r) => {
      if (r.ok) {
        setModels(r.models ?? null)
        setPlatform(r.platform ?? null)
      }
    }).catch(() => {})
  }

  React.useEffect(() => {
    let alive = true
    void apiCall<Record<string, unknown>>('/api/voice/config').then((c) => {
      if (alive) setCfg(c as unknown as ConfigView)
    }).catch(() => {})
    refreshModels()
    return () => { alive = false }
  }, [])

  React.useEffect(() => {
    const id = window.setInterval(() => {
      void apiCall<{ ok: boolean; downloads?: Record<string, DownloadView> }>('/api/voice/download-status').then((r) => {
        if (r.ok) setDownloads(r.downloads ?? {})
      }).catch(() => {})
    }, 700)
    return () => window.clearInterval(id)
  }, [])

  if (!cfg) return React.createElement('div', { className: styles.voiceSettings }, 'Loading…')

  const set = (path: string, value: string): void => {
    const next = JSON.parse(JSON.stringify(cfg)) as Record<string, unknown>
    const parts = path.split('.')
    let node = next
    for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]!] as Record<string, unknown>
    node[parts[parts.length - 1]!] = value
    setCfg(next as unknown as ConfigView)
  }
  const save = (): void => {
    void apiCall('/api/voice/config', cfg).then(() => {
      setSaved('Saved ✓')
      window.setTimeout(() => setSaved(''), 2000)
    }).catch(() => setSaved('Save failed'))
  }
  const saveApiKey = (): void => {
    void apiCall('/api/voice/api-key', { key: apiKeyDraft }).then(() => {
      setApiKeyDraft('')
      setSaved('Saved ✓')
      window.setTimeout(() => setSaved(''), 2000)
    }).catch(() => setSaved('Save failed'))
  }

  const nestedField = (label: string, group: 'tcpp' | 'local' | 'api', path: 'binary' | 'modelsDir' | 'engineUrl' | 'modelId' | 'model' | 'url', type?: string) => React.createElement('label', { className: styles.voiceField },
    label,
    React.createElement('input', {
      type: type ?? 'text',
      value: (cfg[group] as unknown as Record<string, string>)[path] ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(group + '.' + path, e.target.value),
    }),
  )

  const dlEngine = downloads['engine'] ?? null
  const selModel = cfg.tcpp.modelId ?? ''
  const dlModel = downloads['model:' + selModel] ?? null
  const modelMeta = (models ?? []).find((m) => m.id === selModel) ?? null
  const modelReady = modelMeta ? modelMeta.downloaded : false

  const bar = (dl: DownloadView, info: string): React.JSX.Element => {
    const pct = dl && (dl as { total?: number; bytes?: number }).total ? Math.min(100, Math.round(((dl as { bytes?: number }).bytes ?? 0) / (dl as { total: number }).total * 100)) : 0
    return React.createElement('div', null,
      React.createElement('div', { className: styles.voiceBar }, React.createElement('div', { style: { width: pct + '%' } })),
      React.createElement('div', { className: styles.voiceDlInfo }, info),
    )
  }

  const modelOptions = (models ?? []).map((m) => React.createElement('option', { key: m.id, value: m.id },
    (m.downloaded ? '✓ ' : '  ') + m.name + ' · ' + fmtSize(m.size) + (m.downloaded ? '' : ' — not downloaded'),
  ))

  const advancedToggle = React.createElement('button', { type: 'button', className: styles.voiceAction, onClick: () => setShowAdvanced((s) => !s) },
    (showAdvanced ? '▾ ' : '▸ ') + 'Advanced',
  )

  return React.createElement('div', { className: styles.voiceSettings },
    React.createElement('label', { className: styles.voiceField },
      'Transcription provider',
      React.createElement('select', { value: cfg.provider, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set('provider', e.target.value) },
        React.createElement('option', { value: 'tcpp' }, 'transcribe.cpp — Handy model catalog (GigaAM, Voxtral, Whisper…)'),
        React.createElement('option', { value: 'local' }, 'whisper.cpp (single GGML model)'),
        React.createElement('option', { value: 'api' }, 'HTTP API (OpenAI-compatible)'),
      ),
    ),

    cfg.provider === 'tcpp' ? React.createElement('div', null,
      React.createElement('div', { className: styles.voiceField },
        'Transcription engine (transcribe-cli)',
        React.createElement('div', { className: styles.voiceRow },
          React.createElement('span', { className: styles.voiceHint, style: { flex: 1 } },
            platform && platform.exists ? '✓ installed' : (platform ? 'not installed' : '…'),
          ),
          React.createElement('button', {
            type: 'button',
            className: styles.voiceAction,
            disabled: !!(dlEngine && dlEngine.status === 'downloading'),
            onClick: () => { void apiCall('/api/voice/engine-download', {}).then(refreshModels) },
          }, dlEngine && dlEngine.status === 'downloading' ? 'Downloading…' : 'Download engine'),
        ),
        platform && platform.path ? React.createElement('div', { className: styles.voiceHint }, 'path: ' + platform.path) : null,
        dlEngine && dlEngine.status === 'downloading' ? bar(dlEngine, fmtSize((dlEngine as { bytes?: number }).bytes ?? 0) + ' / ' + fmtSize((dlEngine as { total?: number }).total ?? 0)) : null,
        dlEngine && dlEngine.status === 'error' ? React.createElement('div', { className: styles.voiceHint }, 'Error: ' + dlEngine.error) : null,
      ),
      React.createElement('label', { className: styles.voiceField },
        'Model',
        React.createElement('div', { className: styles.voiceRow },
          React.createElement('select', { value: selModel, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set('tcpp.modelId', e.target.value) },
            models === null ? React.createElement('option', { value: selModel }, 'Loading catalog…') : modelOptions,
          ),
        ),
        React.createElement('div', { className: styles.voiceRow },
          React.createElement('button', {
            type: 'button',
            className: styles.voiceAction,
            disabled: !modelMeta || modelReady || !!(dlModel && dlModel.status === 'downloading'),
            onClick: () => { void apiCall('/api/voice/download', { modelId: selModel }).then(refreshModels) },
          }, dlModel && dlModel.status === 'downloading' ? 'Downloading…' : (modelReady ? 'Downloaded' : 'Download ' + (modelMeta ? fmtSize(modelMeta.size) : ''))),
          React.createElement('button', { type: 'button', className: styles.voiceAction, title: 'Refresh catalog', onClick: refreshModels }, '⟳'),
        ),
        dlModel && dlModel.status === 'downloading' ? bar(dlModel, fmtSize((dlModel as { bytes?: number }).bytes ?? 0) + ' / ' + fmtSize((dlModel as { total?: number }).total ?? 0)) : null,
        dlModel && dlModel.status === 'error' ? React.createElement('div', { className: styles.voiceHint }, 'Error: ' + dlModel.error) : null,
      ),
      React.createElement('div', { className: styles.voiceAdvanced },
        advancedToggle,
        showAdvanced ? React.createElement('div', { className: styles.voiceAdvancedBody },
          nestedField('Engine path (transcribe-cli)', 'tcpp', 'binary'),
          nestedField('Models directory', 'tcpp', 'modelsDir'),
          nestedField('Engine download URL ({platform}/{arch})', 'tcpp', 'engineUrl'),
        ) : null,
      ),
      React.createElement('div', { className: styles.voiceHint }, 'Same model catalog as Handy: GigaAM, Voxtral, Whisper, Qwen3-ASR, Parakeet, Canary, Moonshine and more. Models are downloaded from Hugging Face.'),
    ) : null,

    cfg.provider === 'local' ? React.createElement('div', null,
      React.createElement('div', { className: styles.voiceAdvanced },
        advancedToggle,
        showAdvanced ? React.createElement('div', { className: styles.voiceAdvancedBody },
          nestedField('whisper-cli path', 'local', 'binary'),
          nestedField('GGML model path', 'local', 'model'),
        ) : null,
      ),
      React.createElement('div', { className: styles.voiceHint }, 'Standard whisper.cpp models: tiny, base, small, medium, large-v3, turbo.'),
    ) : null,

    cfg.provider === 'api' ? React.createElement('div', null,
      nestedField('Endpoint URL', 'api', 'url'),
      nestedField('Model (gpt-4o-transcribe, whisper-1, …)', 'api', 'model'),
      React.createElement('label', { className: styles.voiceField },
        cfg.api.hasKey ? 'API key — saved' : 'API key (host-only, never stored in the browser)',
        React.createElement('div', { className: styles.voiceRow },
          React.createElement('input', { type: 'password', placeholder: cfg.api.hasKey ? '••••••••' : '', value: apiKeyDraft, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setApiKeyDraft(e.target.value) }),
          React.createElement('button', { type: 'button', className: styles.voiceAction, onClick: saveApiKey, disabled: !apiKeyDraft }, 'Set'),
        ),
      ),
      React.createElement('div', { className: styles.voiceHint }, 'OpenAI API, Groq, Deepgram-compatible or a local faster-whisper server. The key is sent to the host and never returned to the page.'),
    ) : null,

    React.createElement('label', { className: styles.voiceField },
      'Language (Whisper models & API)',
      React.createElement('select', { value: cfg.language, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set('language', e.target.value) },
        React.createElement('option', { value: 'auto' }, 'Auto'),
        React.createElement('option', { value: 'ru' }, 'Russian'),
        React.createElement('option', { value: 'en' }, 'English'),
        React.createElement('option', { value: 'uk' }, 'Ukrainian'),
        React.createElement('option', { value: 'de' }, 'German'),
      ),
    ),
    React.createElement('div', { className: styles.voiceRow },
      React.createElement('button', { type: 'button', className: styles.voiceSave, onClick: save }, 'Save'),
      saved ? React.createElement('span', { className: styles.voiceSaved }, saved) : null,
    ),
  )
}
