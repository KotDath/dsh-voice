// Config schema and validation. All user-controllable strings that reach a
// shell command are constrained here: language is a fixed enum, provider is
// restricted, and free-form fields (paths/models) are passed through q() and
// validated before use. The API secret NEVER leaves the host (see RPC).

const LANGUAGE_CODES = { auto: 1, ru: 1, en: 1, uk: 1, de: 1 }
const PROVIDERS = { tcpp: 1, local: 1, api: 1 }

// Default paths are the DSH process launch directory (the sandbox's writable
// root) — NOT the session workspace. See AGENTS.md.
const config = {
  provider: 'tcpp',
  language: 'auto',
  tcpp: {
    binary: wsRoot + '/.engine/transcribe-cli',
    modelsDir: wsRoot + '/.models',
    modelId: 'handy-computer/gigaam-v3-e2e-rnnt-gguf/gigaam-v3-e2e-rnnt-Q8_0.gguf',
    engineUrl: 'https://github.com/KotDath/dsh-voice/releases/latest/download/transcribe-cli-{platform}-{arch}',
  },
  local: {
    binary: '',
    model: '',
  },
  api: {
    url: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'gpt-4o-transcribe',
    key: '', // host-only; never returned to the client
  },
}

// Validate + apply a sanitized patch. Unknown/invalid values are ignored so a
// hostile RPC cannot smuggle shell syntax through language/model/provider.
function applyConfigPatch(patch) {
  if (!patch || typeof patch !== 'object') return
  if (typeof patch.provider === 'string' && PROVIDERS[patch.provider]) config.provider = patch.provider
  if (typeof patch.language === 'string' && LANGUAGE_CODES[patch.language]) config.language = patch.language
  const groups = ['tcpp', 'local', 'api']
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi]
    if (patch[g] && typeof patch[g] === 'object') {
      // tcpp.modelId must match the catalog (validated before use in transcribe).
      if (typeof patch[g].binary === 'string' && g !== 'api') config[g].binary = String(patch[g].binary).trim()
      if (g === 'tcpp' && typeof patch[g].modelsDir === 'string') config.tcpp.modelsDir = String(patch[g].modelsDir).trim()
      if (g === 'tcpp' && typeof patch[g].engineUrl === 'string') config.tcpp.engineUrl = String(patch[g].engineUrl).trim()
      if (g === 'tcpp' && typeof patch[g].modelId === 'string') config.tcpp.modelId = String(patch[g].modelId).trim()
      if (g === 'local' && typeof patch[g].model === 'string') config.local.model = String(patch[g].model).trim()
      if (g === 'api') {
        if (typeof patch[g].url === 'string') config.api.url = String(patch[g].url).trim()
        if (typeof patch[g].model === 'string') config.api.model = String(patch[g].model).trim()
      }
    }
  }
}

// Client-safe projection: the API key is replaced with hasKey only.
function publicConfig() {
  return {
    provider: config.provider,
    language: config.language,
    tcpp: {
      binary: config.tcpp.binary,
      modelsDir: config.tcpp.modelsDir,
      modelId: config.tcpp.modelId,
      engineUrl: config.tcpp.engineUrl,
    },
    local: { binary: config.local.binary, model: config.local.model },
    api: { url: config.api.url, model: config.api.model, hasKey: !!config.api.key },
  }
}
