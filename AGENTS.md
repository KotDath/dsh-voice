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

When the profile runs the `hmr` row the install applies in the running process
(see "Restart vs live reload" below); a profile without that row picks the new
composition up only at the next `dsh web`. The patch layer
(`cordis.patch.yml`) inserts one row `id: voice, name: dsh-voice`; the host
Loader mounts `lib/index.js` (registers `/api/voice/*` HTTP endpoints) and the
`dsh.client` declaration serves `lib/client.js` into the browser boot graph.

To remove:

```sh
dsh plugin --profile web remove dsh-voice
```

### Restart vs live reload

The "restart" in the install snippet is not a property of plugins — it is a
property of the **profile**: live composition reloads need the `hmr` row
mounted in the running process (`dsh-base` enables it wherever a profile
context exists, and this machine's profile pins it explicitly with a module
watch root). With that row live, the running `dsh web` watches

- the profile patch layer (`<profile>/cordis.patch.yml`, "hot-reloaded on
  long-lived surfaces"),
- the user patch layer in the DSH home (`~/.dsh/cordis.patch.yml`),
- the profile manifest (`<profile>/package.json` — i.e. the bundle list),

and reconciles any change into the live Loader (`dsh-hmr` →
`reconcileProfilePatches`). That is the whole mechanism behind "install without
a restart": both `dsh plugin --profile web add …` and the in-process plugin
manager (`plugin_manager` / the GUI) rewrite exactly those files, so the new row
mounts in the running process — and because the change also lands on disk, it is
still there after the next start. `PluginManager` reports the outcome as
`application: 'applied'` while `ctx.hmr` exists, and `'restart-required'` only
on a profile that never enabled that row. Enabling/disabling the `hmr` row
itself is the one change that still needs a restart.

What is genuinely *not* live is code that never reaches the mounted path. A
`github:` install is a frozen tarball of one commit, so `npm run build` here
writes to `<repo>/lib` and never touches the copy the Loader mounts
(`<profile>/node_modules/dsh-voice/lib`, the HMR module root): it only looks
like the plugin "needs a restart", because nothing was ever delivered. Install
the repo itself (`dsh plugin --profile web add file:<repo>`, or the plugin
manager with the absolute path) and `node_modules/dsh-voice` links to this
checkout — from then on every `npm run build` re-mounts the host half live and
`client-hmr` re-serves the browser half. `/api/voice/config` reports the mounted
module's version (Settings shows `dsh-voice vX.Y.Z`), so the swap is visible.

Two gaps bite when *updating* an install that already exists:

- `plugin_manager install_bundle` with the same `github:` spec refreshes the
  package on disk and then answers `application: 'failed'` with
  `ambiguous-install`: the dependency spec did not change, so the manager
  cannot tell which bundle to activate and never runs its reconcile step.
- the `dsh-hmr` module watcher watches the module root, but pnpm replaces the
  package directory wholesale (remove + extract), which can leave that watch
  attached to the removed inode.

Either way the files on disk are current while the row keeps executing the OLD
module. Re-mount the row and the new code takes over live: `plugin_manager`
`set_plugin` (disable, then enable) on `include:voice` — that is the no-restart
swap this checkout's dev loop uses, visible as the changed
`/api/voice/config` version. Provider, language and the API key survive that
re-mount (they live in `.dsh-voice/state.json`), so nothing has to be re-entered.
The marker reads `package.json` from disk each time the module is evaluated, not
through `require`, whose process-wide cache would keep reporting the previous
build after a live re-mount.

## Building

```
npm install          # dev deps; uses local .npm-cache if ~/.npm is EROFS
npm run build        # scripts/gen-catalog.mjs → src/plugin/generated-catalog.ts
                     # tsc → typecheck, tsdown → lib/index.js + lib/client.js
npm test             # three Node suites: run.mjs + codex.mjs + hotkey.mjs
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
src/plugin/client/{state,recorder,waveform,components,settings,hotkey,
                       questionTarget,questionOverlay,submitSeat,
                       composerDom}.ts(x)
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

## Keyboard activation (Ctrl+E)

The layer lives in `src/plugin/client/hotkey.ts` and is installed from the
client `apply()` inside `ctx.effect()`. Semantics: the first press calls
`startRecording()`, the second one finishes it exactly like a press on the
composer's own submit button — splice at the caret, then send; `starting` defers
the finish until the recorder exists, `processing` is ignored, `error` restarts.
`action: 'insert'` (Settings → Voice → Second press) switches the finish to
insert-only, i.e. the `⏹` path.

Why it does not use `ctx.shortcuts`: the Harness command registry validates
defaults with `isWebBindingAllowed`/`bindingIssue`, and on **Web/Linux** only
`Ctrl+/`, `Ctrl+Shift+,` and `Ctrl+Shift+.` are admitted — `Ctrl+E` answers
`unsupported-browser` and `register()` throws. Do not "fix" this by adding
`ctx.shortcuts`; the raw listener is deliberate. It hangs on `window` in the
bubble phase, so an event the application already consumed
(`event.defaultPrevented`) is left alone.

Guards, in order: `repeat`, IME (`isComposing`/`keyCode 229`), suspended
(Settings records a new combination), `.xterm` target (Ctrl+E is end-of-line in
a readline terminal), a visible modal/dialog, missing composer actions, and
`processing`. Matching uses the physical `event.code`, so a Russian layout needs
no second binding.

**In-row recording strip.** The controls live inside the composer's own tool
row instead of a separate pill or a composer takeover: `conversation.input.left`
holds `✕` plus the live waveform, and the mic entry in
`conversation.input.right` turns into `⏹` (then a spinner) in place. Nothing
changes the card height, which is why the ambient stats row below the composer
and the mic button's position survive a recording (the composer draft itself is
never touched until the transcript arrives; `processing` keeps the same row with
just a centered "Transcribing" label) — a full
`conversation.composer` takeover was tried and rejected: it unmounted the
`conversation.composer.dock` row, so the seat shrank and the stop button slid
down out from under the microphone. The model select is hidden with
`html[data-dsh-voice-recording] [data-slot="conversation.input.model"]`
(`VoiceRow` sets the attribute), and `VoiceRow` also owns the analyser sampling
and the `MAX_RECORDING_SECS` auto-stop that used to live in the pill. `⏹` stays
"stop and insert".

**Sending is the composer's own button.** No second send affordance is
registered (a `conversation.input.activity` seat occupant was tried and
rejected: two arrows side by side): `submitSeat.ts` enables the resident submit
in place while a recording is live and swallows its press in a capture-phase
`click` listener, so the transcript is what goes out — always as a send: the
text is spliced in at the caret and the resulting draft (which may already hold
what the user typed) is submitted. "Insert without sending" belongs to `⏹`
alone; when both buttons only inserted, the word "send" on the arrow was a lie
(and the two were indistinguishable). Borrowing it is a DOM-level job
because the composer disables that button for an empty draft, which is exactly
the state in which someone dictates; `disabled` is only ever rewritten by React
when its own prop flips, so the flip has to be undone by hand and put back
afterwards (`releaseNativeSubmit`).

Every DOM question lives in `composerDom.ts` and reads the elements, never the
voice store: the store's mirror of the draft arrives a beat after an edit, and
a wrong guess leaves the button — or the splice — in the wrong state. That is
also how the padding around a transcript is computed. Two pitfalls that cost a
debugging round each: the submit is the **last** button of the row outside
`[data-composer-dock]` (the model select carries `aria-busy` as well, so
`button[aria-busy]` matched the model seat and left the arrow disabled), and
the slot anchors are `display: contents`, so their `getBoundingClientRect()` is
empty even when visible — measure the seat's button, not the anchor.

Two layout traps: a
`flex-basis: auto` strip lets the canvas' intrinsic width inflate the row (use
`flex-basis: 0` plus a width-synced canvas), and the tool cluster sizes to its
content, so it needs the `:has()` rule to grow while recording.

**Question cards take precedence.** An `ask_user_question` card is registered
into the `conversation.composer` chain, so it replaces the whole composer stack
(`conversation.composer.bar` + `conversation.input.dock`): the mic button and
the pill unmount, and `inputActions` goes null. The hotkey layer therefore
resolves a target before deciding: `questionAnswerField()` looks for a
`[data-composer-seat]` whose `[data-question-key]` card holds a visible,
enabled `textarea`. That pairing is unambiguous because the chat composer is a
Lexical `contenteditable`, while the card's "your own answer" field is a real
textarea. With a target, the transcript is inserted at the caret through the
prototype `value` setter plus a synthetic `input` event (the field is React
controlled), and the recording's mode then decides exactly what it decides in
the composer: `insert` leaves the answer for the user, `send` hands it to the
card's own primary action. That action is the **last button of the card** —
Submit on the final question, Next before it, which is the one rule that avoids
depending on a localized label — and it is still `disabled` for one render
because `answered(draft)` has not caught up with the synthetic `input` event, so
`submitAnswer()` retries the click on animation frames. `Ctrl+E` follows
`hotkey.action` here too (it used to be forced to `insert`). Recording feedback
comes from `questionOverlay.ts`, a plain-DOM pill (no React root, no new bundle
externals) with the same trio as the composer — `✕`, `⏹` (`data-dsh-voice-action="insert"`)
and `↑` (`…="send"`) — positioned above the seat; it is destroyed as soon as the
target clears. `spliceAtCaret()` is the pure, tested half of the insertion.

Config: `hotkey.combo` / `hotkey.altCombo` / `hotkey.action` in
`.dsh-voice/state.json`. The host canonicalizes both combinations
(`normalizeHotkeyCombo`) and rejects anything that is not one physical key plus
1–4 known modifiers; a rejected value leaves the previous one in place. Both
combinations are live at once because browsers reserve plenty of
`Ctrl+<letter>` combinations — the Settings **Test** button reports whether a
press actually reached the page. `test/hotkey.mjs` covers the pure helpers
(unbound `altCombo` is the empty string, not `null`).

## Verifying UI changes in a browser

The pieces above are layout- and event-driven, so `npm test` cannot see them.
The loop that does:

1. An **isolated** instance, so no test message lands in the real sessions:
   `DSH_HOME=/tmp/dsh-e2e-home` (copy `~/.dsh/.credentials.yaml` into it),
   `dsh --profile e2e --from-default-profile web --dump-config`,
   `dsh plugin --profile e2e add file:<repo>`,
   then `dsh --profile e2e --port 3099 --no-open` and take the `?token=` URL
   from its log. A `file:` install into a second profile is a **snapshot
   copy**, so re-copy `lib/*.js` after every build (or hardlink them).
   Its patch layer must hold a provider row and `agent-default-model`, otherwise
   the composer cannot send and the press-path checks are meaningless.
2. `test/ui-e2e.mjs` (`npm run test:ui`), which drives that instance with
   Playwright and Google Chrome, stubs `POST /api/voice/transcribe` with
   `page.route`, and reports 28 checks plus screenshots: the resident submit is
   borrowed and enabled while recording, an empty draft sends, a non-empty
   draft is spliced **at the caret** with the right spacing, `⏹` inserts
   without sending, cancel hands the button back and leaves the model seat
   interactive, and `Ctrl+E` twice behaves like the submit press. It needs
   `playwright-core` (`npm i -D playwright-core`) — or point
   `DSH_VOICE_E2E_PLAYWRIGHT` at a scratch install and keep the dependency out
   of the package.

## Security rules (do not regress)

- `provider` and `language` are strict enums (`src/plugin/index.ts`); free-form
  values never reach a shell command unquoted — all shell arguments go through
  `q()`.
- The API key is host-only: set via `/api/voice/api-key`, never returned to
  the page (`hasKey` only), travels to the provider via the `DSHVOICE_API_KEY`
  environment variable, never argv. It is persisted only in the host-side
  settings file (`<workspaceRoot>/.dsh-voice/state.json`), written through
  `umask 077` so the directory is 0700 and the file 0600.
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

- Plugin data (engine binary, models, temp files, settings) lives in the DSH
  process launch directory (`<launch-dir>/.engine`, `/.models`, `/.tmp`,
  `/.dsh-voice`) — `sandboxPolicy.workspaceRoot` is the deployment default, not
  the session workspace. `<launch-dir>/.dsh-voice/state.json` holds the
  provider/language/paths plus the host-only API key, so it outlives both a
  `dsh web` restart and a plugin re-mount; delete it to reset the plugin.
- The host half drives a POSIX shell (`uname`, `test -f`, `base64 -d`,
  `mkdir -p`, `rm -rf`, `ffmpeg`, `sha256sum`). On Windows `ctx.shell` is the
  PowerShell executor, so `apply()` logs one warning and registers nothing —
  Windows hosts are unsupported until the command layer has a pwsh dialect.
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
| `/api/voice/*` 404 on a live server | The row is not mounted in the running process. With the `hmr` row enabled (this profile) an install/reinstall applies live — check the manager's `application` field; without that row the composition is boot-time only, so restart `dsh web`. |
| Mic button missing after install | Check `dsh plugin --profile web` reconcile added `dsh-voice` to `dsh.profile.bundles` and that the client bundle is served; with `hmr` enabled no restart is needed, otherwise restart. |
| Engine download → 404 | No release yet: push a `v*` tag (CI builds engines). Or point **Advanced → Engine path** at an existing `transcribe-cli`. |
| Model download error | Verify the model id in `models.json`/catalog; HF `resolve/main/<file>` must return 200. Gated models may need a Hugging Face token. |
| Long dictation loses text | Fixed by 20 s chunking. Models have ~25 s windows; do not remove the chunking branch in `transcribeWithTcpp`. Not applicable to `codex` (single request up to 5 min). |
| Codex provider: 401 "login rejected" | The token in `$CODEX_HOME/auth.json` expired: run any `codex` command to refresh it (the plugin never writes the file). |
| Codex provider: 403 or an HTML body | Cloudflare: the request had no browser-like `User-Agent`. Keep `CODEX_USER_AGENT`. |
| Codex provider: 500 "Error in ASR API" | An unsupported `language` value was sent — `auto` is rejected, so it must be omitted (the code already does). |
| `lib/*` looks stale | Rebuild with `npm run build`; committed artifacts must match `src/`. |
| Ctrl+E does nothing | The browser reserved the combination (it never reaches the page) — press the fallback `Ctrl+Alt+E`, or Settings → Voice → **Test** to check, then **Record** another combination. If a stale bundle is mounted, rebuild and re-mount (see "Restart vs live reload"). Never route this through `ctx.shortcuts`: on Web/Linux the registry rejects it. |
| `deps.shell.run is not a function` | The `ctx.shell` seam was renamed in harness 0.2: 0.1 was `resolve()` + `run(spec)` + `start(spec)`, 0.2 is `resolve()` + `execute(spec)` → `await handle.result()`. `runShell()` in `src/plugin/index.ts` speaks both, so this error means the mounted bundle is older than the fix. The devDependencies still pin the 0.1-era `@deepseek-ai/*` types, where `run` exists — `tsc` therefore cannot catch this drift; the shell doubles in `test/codex.mjs` implement the live 0.2 shape (`execute`/`result`, no `run`) plus one legacy-change case for that reason. |

## Repository conventions

- The installable artifact is the npm package at the repo root (built `lib/`
  committed). Released versions are pinned by git tags (`v0.4.0`, …).
- `models.json` is the human-readable model catalog; the build injects it into
  `generated-catalog.ts` — never hand-edit the generated file.
- Tests live in `test/` and run on Node only (`npm test` runs all three suites;
  the `codex` suite mounts the built host half on a fake Cordis context and is
  offline unless `DSH_VOICE_LIVE=1`; `hotkey.mjs` imports the TypeScript
  hotkey module straight from `src/`, relying on Node's type stripping). The CI
  job `plugin-tests` runs the build + `npm test`.
- UI strings and comments in code are English.
