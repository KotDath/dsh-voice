# dsh-voice

Voice input for the DeepSeek Harness Web GUI — as an **official plugin bundle**.

A microphone button (SVG icon) sits next to the send button in the composer.
Clicking it brings up a ChatGPT-style recording "pill" above the composer:

```
[ ✕ cancel ] [~~~~~~~~ waveform ~~~~~~~~] [ ⏹ stop ] [ ↑ send ]
```

- **✕** — cancel the recording;
- **⏹** — stop, transcribe and insert the text into the input (without sending);
- **↑** — stop, transcribe and send to the chat immediately.

The waveform is a row of vertical bars: fresh signal arrives on the right,
history fades left into a dim dotted baseline (like ChatGPT's voice mode).

## Installation

### Requirements

- A running DeepSeek Harness with the Web GUI (Node.js quick start:
  `npx @deepseek-ai/dsh web`, default `http://127.0.0.1:3080`).
- A **POSIX host** (Linux/macOS): the host half runs `bash`, `curl` (engine and
  model downloads) and `ffmpeg` (audio conversion). Windows is not supported —
  there `ctx.shell` is PowerShell, so the plugin logs one warning and registers
  nothing. The transcribe.cpp engine is downloaded automatically per
  OS/architecture from this repository's Releases — or adopted from `PATH` / a
  sibling `.engine/` dir if a `transcribe-cli` binary already exists.
- A browser with mic access over HTTPS or localhost.

### Install into a profile (all sessions)

```sh
dsh plugin --profile web add github:KotDath/dsh-voice
```

For a local test build instead:

```sh
npm install && npm run build
dsh plugin --profile web add file:/path/to/dsh-voice
```

The install lands in the **running** process when the profile mounts the `hmr`
row — no restart. A profile without that row reads its composition at boot, so
restart the web process (`dsh web`) there. Either way the plugin is then active
in **every session** of the profile: no per-session `cordis_define`, no source
edits.

Updating an install that already exists is the one case that still needs a
nudge: pnpm replaces the package directory, so the mounted row can keep running
the previous module until it is re-mounted — toggling the plugin in the plugin
manager re-mounts it live (and `/api/voice/config` reports the version that is
actually loaded).

The package declares `dsh.bundle.patch` (→ `cordis.patch.yml`, one row
`id: voice, name: dsh-voice`) and `dsh.client` (→ the browser half
`lib/client.js`). `dsh plugin` installs it with pnpm into the profile and
reconciles `dsh.profile.bundles` automatically.

To remove:

```sh
dsh plugin --profile web remove dsh-voice
```

### First-run flow (for the end user)

1. Open **Settings → Voice** — the engine is either `✓ installed` or
   downloadable with one click ("Download engine", releases built by CI).
2. Pick a model from the catalog and press **Download** if it is not marked ✓.
3. Use the mic button next to the send button in the composer.
4. Record → `✕` cancel / `⏹` insert / `↑` send.

## Architecture

```
[Client: browser]                                [Host: Node]
┌─────────────────────────────────┐  fetch      ┌────────────────────────────────┐
│ slot conversation.input.right   │ ──────────► │ /api/voice/transcribe          │
│  • MediaRecorder (webm/opus)    │ base64+meta │  • base64 -d → file           │
│  • AnalyserNode → waveform      │              │  • ffmpeg → 16 kHz mono wav    │
│  • timers, states               │ ◄─────────── │  • provider:                  │
│ inputActions.setDraft + submit  │   { text }   │     tcpp:  transcribe-cli      │
└─────────────────────────────────┘              │     local: whisper-cli -oj     │
                                                 │     api:   curl multipart     │
                                                 │     codex: ChatGPT backend    │
                                                 │       ($CODEX_HOME auth.json) │
                                                 │  • temp file cleanup           │
                                                 └────────────────────────────────┘
```

Unlike the earlier dynamic-plugin versions, the two halves do **not** use the
`harness.handle`/`host.call` bridge: the Node half registers plain HTTP
endpoints on the harness webserver (`/api/voice/*`), and the browser half
calls them with `fetch`. That is the pattern used by other static bundle
plugins (e.g. dsh-track).

## Transcription providers

Switchable in **Settings → Voice**. The choice (provider, language, paths and
the host-only API key) is persisted on the host in
`<launch-dir>/.dsh-voice/state.json` — directory `0700`, file `0600` — so it
survives both a `dsh web` restart and a plugin re-mount. Delete that file to
reset the plugin to its defaults.

| Provider | How it works | Requirements |
|---|---|---|
| `tcpp` (default) | the **transcribe.cpp** engine (the same one inside Handy) — a static `transcribe-cli` binary (~5 MB). A catalog of **67 models** (GigaAM v3 CTC/RNN-T/E2E, Voxtral Mini 3B/4B/24B, Whisper tiny…large-v3 (+turbo), Qwen3-ASR, Parakeet, Canary, Moonshine, Nemotron, Granite, SenseVoice, Fun-ASR, Cohere, MedASR…). Model picker dropdown, one-click Hugging Face download with progress | engine (self-downloads for Win/macOS/Linux) |
| `codex` | the **ChatGPT subscription** behind your local Codex CLI login: the recording goes to the ChatGPT backend speech-to-text endpoint with the OAuth token from `$CODEX_HOME/auth.json` | a `codex login` on the host; no API key, no model download |
| `local` | whisper.cpp (`whisper-cli`) + one GGML model | paths to the binary and model; offline |
| `api` | OpenAI-compatible `POST /v1/audio/transcriptions` (multipart) | URL, API key, model name (`gpt-4o-transcribe`, `whisper-1`, Groq, a local faster-whisper server, etc.) |

### Codex / ChatGPT subscription

If the host is already signed in to the Codex CLI with a ChatGPT plan, that
subscription can transcribe voice input — nothing to download and no API key:

1. `codex login` on the host (once), then **Settings → Voice → Transcription
   provider → Codex**. The panel shows the account, the plan and the token
   expiry, and **Test** sends one second of silence through the real path to
   prove the login, the endpoint and `ffmpeg` in one click.
2. Record as usual. The whole recording (up to the 5-minute cap) is sent as a
   single 16 kHz WAV request — unlike the local models, this endpoint keeps
   context across several minutes, so long dictations no longer need the 20 s
   chunking used by `tcpp`.

How it behaves:

- **Credentials**: the host reads `$CODEX_HOME/auth.json` (default
  `~/.codex/auth.json`) and passes the access token to `curl` through the
  `DSHVOICE_CODEX_TOKEN` environment variable — never in argv, and the token
  never reaches the page (the settings only ever see the account, plan and
  expiry). The file can be pointed elsewhere in **Advanced**.
- **It is never written to.** The plugin does not refresh or rewrite the
  login: ChatGPT refresh tokens rotate, and a second writer would invalidate
  the login the Codex CLI itself depends on. If the token expires, the panel
  says so — run any `codex` command (or `codex login`) to refresh it.
- **Language**: the endpoint takes a concrete language code (the Language
  setting is forwarded for `ru`/`en`/`uk`/`de`). `Auto` is not a valid value
  there and is simply omitted, which is why auto-detect works.
- **Errors are decoded**, not dumped: an expired login reports the 401 plus
  the fix, a Cloudflare block reports the 403, and a rate limit reports 429.
- An `auth.json` in API-key mode is reported as such — that mode cannot use the
  subscription endpoint.

Measured on this machine: a 5-minute Russian dictation transcribed in one
request in ~68 s, a 50-second one in ~13 s.

### transcribe-cli engine: out of the box, no Handy app needed

- The plugin **does not depend on the Handy application**: the ASR engine is the
  open-source library [handy-computer/transcribe.cpp](https://github.com/handy-computer/transcribe.cpp).
- The binary is downloaded with the "Download engine" button from this
  repository's GitHub Releases for the current OS/architecture
  (`transcribe-cli-{platform}-{arch}`, `.exe` on Windows).
- If a `transcribe-cli` already exists on `PATH` or next to the configured
  engine path, the plugin **adopts it** (copies it into its own directory) — no
  download needed. Discovery is explicit; there is no filesystem sweep.
- Downloads are verified against a `.sha256` sidecar when one is published
  (best-effort integrity check).
- Plugin data (engine, models, temp files) lives in the DSH process launch
  directory (`.engine/`, `.models/`, `.tmp/`) — the sandbox only allows writes
  there. Paths are shown in the settings.
- Release binaries are built by CI (`.github/workflows/build-engine.yml`):
  Linux x86_64/arm64, macOS arm64/x86_64, Windows x86_64.
- Models are GGUF files from Hugging Face (`handy-computer`); the catalog is
  embedded in the plugin (sizes drive the progress bar). Models already
  downloaded by Handy into the HF cache are picked up automatically — no
  re-download required.
- **Long recordings**: many models have a ~25 s window (e.g. GigaAM) and silently
  lose the rest of a long recording. The plugin splits audio longer than 22 s
  into 20 s segments and transcribes them in one batch run (single model load,
  full text concatenated).

Verified on this machine: GigaAM v3 E2E-RNN-T — 30× realtime, Voxtral Mini 4B
Realtime — 1.7× realtime (20 s of Russian audio), excellent quality.

### API key and Codex credential handling

The OpenAI-compatible API key is **host-only**: it is set via its own endpoint
(`POST /api/voice/api-key`), never echoed back to the page (the settings show
only whether a key is set), and is passed to the provider via the
`DSHVOICE_API_KEY` environment variable — never in argv.

The Codex provider applies the same rules to the ChatGPT login: the host reads
`$CODEX_HOME/auth.json`, passes the access token as `DSHVOICE_CODEX_TOKEN`
(again never in argv), surfaces only the account, plan and expiry to the page,
and never writes to the file.

## Development

```
npm install          # dev deps (uses .npm-cache/ if ~/.npm is read-only)
npm run build        # gen-catalog → tsc → tsdown (lib/index.js + lib/client.js)
npm test             # both Node suites (plain Node, no browser)
```

`npm test` runs `test/run.mjs` (bundle/catalog contract) and `test/codex.mjs`
(the Codex provider, mounted on a fake Cordis context — offline by default).
Add `DSH_VOICE_LIVE=1` to also drive the real ChatGPT backend with the Codex
login of this host:

```
DSH_VOICE_LIVE=1 node test/codex.mjs
```

The installable artifact is the npm package at the repository root. See
[AGENTS.md](AGENTS.md) for the full agent instructions (layout, endpoints,
security rules, troubleshooting).

## Repository layout

```
src/plugin/          — Node half (index.ts, HTTP /api/voice/*) + browser half
                       (client/: state, recorder, waveform, components,
                       settings, voice.module.css) + generated catalog
scripts/gen-catalog.mjs — injects models.json into generated-catalog.ts
tsdown.config.ts     — node ESM bundle + browser CJS-closure bundle
cordis.patch.yml     — the bundle's composition patch (one row: id voice)
package.json         — dsh.bundle.patch + dsh.client declarations
models.json          — model catalog (source of truth)
test/                — Node suites: run.mjs (bundle contract) + codex.mjs
                       (Codex provider; DSH_VOICE_LIVE=1 adds real API calls)
.github/workflows/build-engine.yml — CI: plugin tests + 5-platform engine builds
AGENTS.md            — agent install/update instructions
README.md            — this document
```

Released versions are pinned by git tags (`v0.4.0`, …).

## v1 limitations

- Recording uses the browser `MediaRecorder` (HTTPS or localhost required).
- Transcription is batch (after the recording ends); streaming partials are
  planned.
- Upstream whisper.cpp does not support Handy's Qwen3-ASR GGUF (needs the
  transcribe-cpp engine); standard ggml models (tiny…large-v3) work.
