# AGENTS.md — dsh-voice

Instructions for AI agents (and humans) working with this repository.

## What this is

`dsh-voice` is a **DeepSeek Harness plugin bundle** (npm package): a
ChatGPT-style voice input button in the Web GUI composer with transcription by

- the **transcribe.cpp** engine (same engine as the Handy app; 67-model catalog:
  GigaAM, Voxtral, Whisper, Qwen3-ASR, Parakeet, Canary, Moonshine, Nemotron…),
- whisper.cpp (single GGML model),
- the **ChatGPT subscription** behind a local Codex CLI login (`codex`
  provider, no API key and no download), or
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

### Restart vs live reload

The restart above is about the **composition**, not about code: the bundle list
(`dsh.profile.bundles`), the profile's `node_modules` tree and the bundle's
`cordis.patch.yml` row are read while the process boots, so installing,
removing or re-pointing a bundle needs a fresh `dsh web`.

Code changes to an already-mounted plugin are hot, but only inside the HMR
row's watch root. This machine's `~/.dsh/profiles/web/cordis.patch.yml` sets it
to `node_modules/dsh-voice/lib`. A `github:` install is a frozen tarball of one
commit, so `npm run build` here writes to `<repo>/lib` and never touches the
watched copy — it looks like the plugin "needs a restart", but nothing was ever
delivered. Install the repo itself (`dsh plugin --profile web add file:<repo>`)
for the live loop: after that one restart, every `npm run build` re-mounts the
host half and `client-hmr` re-serves the browser half. Without a link, copying
the built `lib/` into the installed package hot-swaps it too. `/api/voice/config`
reports the mounted module's version, so the swap is visible.

## Building

```
npm install          # dev deps; uses local .npm-cache if ~/.npm is EROFS
npm run build        # scripts/gen-catalog.mjs → src/plugin/generated-catalog.ts
                     # tsc → typecheck, tsdown → lib/index.js + lib/client.js
npm test             # both Node suites: run.mjs + codex.mjs (offline)
npm run test:live    # codex.mjs against the real ChatGPT backend (needs a login)
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
| GET `/api/voice/codex-status` | Codex login state (account/plan/expiry — never tokens) |
| POST `/api/voice/codex-check` | live 1 s smoke test of the Codex path |
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
- The Codex access token follows the same rule: read from
  `$CODEX_HOME/auth.json`, handed to curl as `DSHVOICE_CODEX_TOKEN` (never
  argv), and never returned to the page — `/api/voice/codex-status` exposes
  only state/account/plan/expiry. **Never write or refresh that file**: ChatGPT
  refresh tokens rotate, and a second writer would break the Codex CLI login.
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
- The `codex` provider talks to `https://chatgpt.com/backend-api/transcribe`
  (the ChatGPT backend behind the Codex CLI login), **not** the OpenAI API:
  no API key works there, the `model` form field is ignored by the endpoint,
  `language=auto` is rejected (500) so Auto is simply omitted, and requests
  without a browser-like `User-Agent` get a Cloudflare 403. A 5-minute
  recording (~9.6 MB 16 kHz WAV) is accepted in one request, so this provider
  deliberately skips the 20 s chunking used by `tcpp`.

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
| Long dictation loses text | Fixed by 20 s chunking. Models have ~25 s windows; do not remove the chunking branch in `transcribeWithTcpp`. Not applicable to `codex` (single request up to 5 min). |
| Codex provider: 401 "login rejected" | The token in `$CODEX_HOME/auth.json` expired: run any `codex` command to refresh it (the plugin never writes the file). |
| Codex provider: 403 or an HTML body | Cloudflare: the request had no browser-like `User-Agent`. Keep `CODEX_USER_AGENT`. |
| Codex provider: 500 "Error in ASR API" | An unsupported `language` value was sent — `auto` is rejected, so it must be omitted (the code already does). |
| `lib/*` looks stale | Rebuild with `npm run build`; committed artifacts must match `src/`. |

## Repository conventions

- The installable artifact is the npm package at the repo root (built `lib/`
  committed). Released versions are pinned by git tags (`v0.4.0`, …).
- `models.json` is the human-readable model catalog; the build injects it into
  `generated-catalog.ts` — never hand-edit the generated file.
- Tests live in `test/` and run on Node only (`npm test` runs both suites; the
  `codex` suite mounts the built host half on a fake Cordis context and is
  offline unless `DSH_VOICE_LIVE=1`). The CI job `plugin-tests` runs the build
  + `npm test`.
- UI strings and comments in code are English.
