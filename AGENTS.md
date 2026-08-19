# AGENTS.md — dsh-voice

Instructions for AI agents (and humans) working with this repository.

## What this is

`dsh-voice` is a **DeepSeek Harness plugin bundle** (npm package): a
ChatGPT-style voice input button in the Web GUI composer with transcription by

- the **transcribe.cpp** engine (same engine as the Handy app; 67-model catalog:
  GigaAM, Voxtral, Whisper, Qwen3-ASR, Parakeet, Canary, Moonshine, Nemotron…),
- whisper.cpp (single GGML model), or
- any OpenAI-compatible transcription API.

The package is a Cordis bundle: `package.json` declares
`dsh.bundle.patch` (→ `cordis.patch.yml`) and `dsh.client` (→ the browser
half), so it installs into any profile with the official plugin command and
activates in **every session** of that profile.

## Installing into a profile (all sessions)

The official way — no source edits, no `cordis_define`:

```sh
dsh plugin --profile web add github:KotDath/dsh-voice
# local test build:
dsh plugin --profile web add file:/path/to/dsh-voice
```

Then **restart the web process** (`dsh web`). The patch layer
(`cordis.patch.yml`) inserts one row `id: voice, name: dsh-voice`; the host
Loader mounts `lib/index.js` (registers `/api/voice/*` HTTP endpoints) and the
`dsh.client` declaration serves `lib/client.js` into the browser boot graph.

To remove:

```sh
dsh plugin --profile web remove dsh-voice
```

## Building

```
npm install          # dev deps; uses local .npm-cache if ~/.npm is EROFS
npm run build        # scripts/gen-catalog.mjs → src/plugin/generated-catalog.ts
                     # tsc → typecheck, tsdown → lib/index.js + lib/client.js
npm test             # host + client unit tests (plain Node)
```

`models.json` is the single source of truth for the model catalog; the build
injects it into `generated-catalog.ts` (never hand-edit that file).

## Source layout

```
src/plugin/index.ts            — Node half: apply(ctx), /api/voice/* HTTP endpoints
src/plugin/types.ts            — wire types for the endpoints
src/plugin/invariant.ts
src/plugin/generated-catalog.ts — generated from models.json (do not edit)
src/plugin/client/index.ts     — browser half: apply(ctx), slot registrations
src/plugin/client/{state,recorder,waveform,components,settings}.ts(x)
src/plugin/client/voice.module.css
scripts/gen-catalog.mjs        — catalog generator
tsdown.config.ts               — node ESM + browser CJS-closure bundle
cordis.patch.yml               — the bundle's composition patch
```

## How the two halves talk

No `harness.handle`/`host.call` (that is the dynamic-plugin bridge). The Node
half registers HTTP routes on the host webserver (`ctx.webServer.register`,
kind `exact`, paths `/api/voice/*`); the browser half calls them with plain
`fetch`. See `src/plugin/client/recorder.ts` `apiCall()`.

Endpoints:

| Method/path | Purpose |
|---|---|
| GET/POST `/api/voice/config` | read / apply sanitized config |
| POST `/api/voice/api-key` | set/clear host-only API key (never echoed) |
| GET `/api/voice/models` | catalog + engine/platform state |
| POST `/api/voice/download` | start a model download |
| POST `/api/voice/engine-download` | download + sha256-verify engine |
| GET `/api/voice/download-status` | poll downloads |
| POST `/api/voice/transcribe` | audio base64 → text |

## Security rules (do not regress)

- `provider` and `language` are strict enums (`src/plugin/index.ts`); free-form
  values never reach a shell command unquoted — all shell arguments go through
  `q()`.
- The API key is host-only: set via `/api/voice/api-key`, never returned to
  the page (`hasKey` only), travels to the provider via the `DSHVOICE_API_KEY`
  environment variable, never argv.
- Engine downloads verify a `.sha256` sidecar when published (best-effort).
- Engine discovery is explicit: configured path → `command -v transcribe-cli`
  → sibling `.engine/` dir. No `$HOME` sweep.
- The host-half needs `ctx.webServer`, `ctx.shell`, `ctx.fs`,
  `ctx.sandboxPolicy`; if any is absent `apply` returns without registering
  (additive, safe).

## Environment facts that matter

- Plugin data (engine binary, models, temp files) lives in the DSH process
  launch directory (`<launch-dir>/.engine`, `/.models`, `/.tmp`) —
  `sandboxPolicy.workspaceRoot` is the deployment default, not the session
  workspace.
- Models already in `~/.cache/huggingface/hub/models--handy-computer--*` (e.g.
  downloaded by the Handy app) are auto-detected — no re-download needed.
- Host requirements: `bash`, `curl`, `ffmpeg`.

## Releasing new engine binaries

- Engine binaries are built by `.github/workflows/build-engine.yml` from
  [handy-computer/transcribe.cpp](https://github.com/handy-computer/transcribe.cpp)
  (tag `v0.2.0`) for 5 platforms, on `v*` tags only.
- Assets are named `transcribe-cli-{linux|macos|windows}-{x86_64|arm64}[.exe]`
  plus a `.sha256` sidecar each — the plugin's default `engineUrl` and
  checksum verification rely on both conventions.
- After CI finishes, verify the GitHub Release contains all 5 binaries and
  sidecars.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `/api/voice/*` 404 on a live server | Web process started before install: restart `dsh web`. |
| Mic button missing after install | Check `dsh plugin --profile web` reconcile added `dsh-voice` to `dsh.profile.bundles`; restart. |
| Engine download → 404 | No release yet: push a `v*` tag (CI builds engines). Or point **Advanced → Engine path** at an existing `transcribe-cli`. |
| Model download error | Verify the model id in `models.json`/catalog; HF `resolve/main/<file>` must return 200. Gated models may need a Hugging Face token. |
| Long dictation loses text | Fixed by 20 s chunking. Models have ~25 s windows; do not remove the chunking branch in `transcribeWithTcpp`. |
| `lib/*` looks stale | Rebuild with `npm run build`; committed artifacts must match `src/`. |

## Repository conventions

- The installable artifact is the npm package at the repo root (built `lib/`
  committed). Released versions are pinned by git tags (`v0.3.0`, …).
- `models.json` is the human-readable model catalog; the build injects it into
  `generated-catalog.ts` — never hand-edit the generated file.
- Tests live in `test/` and run on Node only. The CI job `plugin-tests` runs
  the build + both suites.
- UI strings and comments in code are English.
