/** Shared wire types for the /api/voice/* endpoints. */

/** Public config view: the API key is replaced with hasKey only. */
export interface VoiceConfigView {
  /** Version of the module that is loaded right now (live-reload build marker). */
  version: string
  provider: 'tcpp' | 'local' | 'api' | 'codex'
  language: string
  tcpp: { binary: string; modelsDir: string; modelId: string; engineUrl: string }
  local: { binary: string; model: string }
  api: { url: string; model: string; hasKey: boolean }
  codex: { authPath: string; endpoint: string; model: string }
}

/**
 * Credential state of the local Codex CLI login (`$CODEX_HOME/auth.json`).
 * Only non-secret fields ever cross the wire — tokens stay in the host.
 */
export interface VoiceCodexStatus {
  state: 'ok' | 'expired' | 'missing' | 'invalid' | 'api_key'
  authPath: string
  email: string | null
  plan: string | null
  expiresAt: number | null
  message: string
}

/** GET /api/voice/codex-status response. */
export interface VoiceCodexStatusView {
  ok: boolean
  status?: VoiceCodexStatus
  error?: string
}

/** POST /api/voice/codex-check response. */
export interface VoiceCodexCheckView {
  ok: boolean
  message?: string
  error?: string
}

/** One catalog model row as served to the client. */
export interface VoiceModelView {
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

/** GET /api/voice/models response. */
export interface VoiceModelsView {
  ok: boolean
  error?: string
  models?: VoiceModelView[]
  platform?: {
    os: string
    arch: string
    exists: boolean
    path: string
    adoptedFrom: string | null
    modelsDir: string
  }
}

/** POST /api/voice/transcribe response. */
export interface VoiceTranscribeView {
  ok: boolean
  text?: string
  empty?: boolean
  error?: string
}

/** POST /api/voice/download | engine-download response. */
export interface VoiceDownloadView {
  ok: boolean
  status?: 'done' | 'downloading'
  error?: string
  adoptedFrom?: string | null
}
