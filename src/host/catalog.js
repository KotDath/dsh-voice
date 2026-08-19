// Model catalog helpers. The CATALOG array literal is generated at build time
// from models.json (single source of truth) and injected into the CATALOG
// declaration below by scripts/build-plugin.mjs.
const CATALOG = [/* __CATALOG__ */]

function catalogEntry(modelId) {
  for (let i = 0; i < CATALOG.length; i++) {
    if (CATALOG[i][0] === modelId) return CATALOG[i]
  }
  return null
}

function isWhisperFamily(entry) {
  return Boolean(entry[1] && entry[1].toLowerCase().indexOf('whisper') >= 0)
}

const CHUNK_SECS = 20
const CHUNK_THRESHOLD_SECS = 22
