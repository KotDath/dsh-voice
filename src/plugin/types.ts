/** Shared wire types for the /api/voice/* endpoints. */

/** Public config view: the API key is replaced with hasKey only. */
export interface VoiceConfigView {
  provider: 'tcpp' | 'local' | 'api'
  language: string
  tcpp: { binary: string; modelsDir: string; modelId: string; engineUrl: string }
  local: { binary: string; model: string }
  api: { url: string; model: string; hasKey: boolean }
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
