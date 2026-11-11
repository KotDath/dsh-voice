window.__ModuleLoader__.load({
	id: "dsh-voice",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		//#region src/plugin/client/state.ts
		const state = {
			phase: "idle",
			error: "",
			rec: null,
			levels: [],
			inputActions: null,
			input: null,
			target: null
		};
		const listeners = /* @__PURE__ */ new Set();
		function getVoiceState() {
			return state;
		}
		function setVoiceState(patch) {
			Object.assign(state, patch);
			for (const l of listeners) l();
		}
		function subscribeVoice(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
		function fmtSize(b) {
			if (!b || b <= 0) return "";
			if (b >= 1e9) return (b / 1e9).toFixed(1) + " GB";
			return Math.max(1, Math.round(b / 1e6)) + " MB";
		}
		function fmtTime(sec) {
			const s = Math.floor(sec);
			return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
		}
		//#endregion
		//#region src/plugin/client/recorder.ts
		/** Microphone capture + finishing (stop → transcribe → insert/send). */
		async function apiCall(path, body) {
			let res;
			try {
				res = await fetch(path, {
					method: body === void 0 ? "GET" : "POST",
					headers: { "content-type": "application/json" },
					body: body === void 0 ? void 0 : JSON.stringify(body)
				});
			} catch (e) {
				throw new Error("voice API unreachable: " + (e instanceof Error ? e.message : String(e)));
			}
			const text = await res.text();
			let data;
			try {
				data = JSON.parse(text);
			} catch {
				throw new Error(`voice API ${path} returned ${res.status}: ${text.slice(0, 120) || "(empty)"}`);
			}
			if (!res.ok || data.ok === false) throw new Error(data.error ?? `request failed (${res.status})`);
			return data;
		}
		function teardown(rec) {
			try {
				rec.stream.getTracks().forEach((t) => t.stop());
			} catch {}
			if (rec.audioCtx) try {
				rec.audioCtx.close();
			} catch {}
		}
		function waitStop(rec) {
			return new Promise((resolve) => {
				rec.recorder.addEventListener("stop", () => resolve(), { once: true });
			});
		}
		function startRecording() {
			setVoiceState({
				phase: "starting",
				error: ""
			});
			getVoiceState().levels = [];
			(async () => {
				let stream = null;
				try {
					if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("Browser has no microphone access (HTTPS or localhost required)");
					stream = await navigator.mediaDevices.getUserMedia({ audio: {
						channelCount: 1,
						echoCancellation: true,
						noiseSuppression: true
					} });
					if (typeof MediaRecorder === "undefined") throw new Error("MediaRecorder is not supported by this browser");
					let mimeType = "audio/webm;codecs=opus";
					if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "";
					const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
					const chunks = [];
					recorder.ondataavailable = (e) => {
						if (e.data && e.data.size > 0) chunks.push(e.data);
					};
					let audioCtx = null;
					let analyser = null;
					const win = window;
					const AC = typeof AudioContext !== "undefined" ? AudioContext : win.webkitAudioContext ?? null;
					if (AC) {
						audioCtx = new AC();
						const src = audioCtx.createMediaStreamSource(stream);
						analyser = audioCtx.createAnalyser();
						analyser.fftSize = 128;
						src.connect(analyser);
					}
					const rec = {
						recorder,
						stream,
						chunks,
						audioCtx,
						analyser,
						stopping: false,
						startedAt: Date.now(),
						mime: mimeType || recorder.mimeType || "audio/webm"
					};
					const st = getVoiceState();
					st.rec = rec;
					recorder.start(250);
					setVoiceState({ phase: "recording" });
				} catch (err) {
					if (stream) try {
						stream.getTracks().forEach((t) => t.stop());
					} catch {}
					setVoiceState({
						phase: "error",
						error: err instanceof Error ? err.message : String(err)
					});
				}
			})().catch((err) => setVoiceState({
				phase: "error",
				error: err instanceof Error ? err.message : String(err)
			}));
		}
		function cancelRecording() {
			const rec = getVoiceState().rec;
			if (!rec || rec.stopping) return;
			rec.stopping = true;
			const stopped = waitStop(rec);
			try {
				rec.recorder.stop();
			} catch {}
			stopped.then(() => {
				teardown(rec);
				const st = getVoiceState();
				st.rec = null;
				setVoiceState({
					phase: "idle",
					target: null
				});
			});
		}
		function stopWith(mode) {
			const rec = getVoiceState().rec;
			if (!rec || rec.stopping) return;
			rec.stopping = true;
			const stopped = waitStop(rec);
			try {
				rec.recorder.stop();
			} catch {}
			stopped.then(() => void finish(rec, mode));
		}
		async function finish(rec, mode) {
			teardown(rec);
			const st = getVoiceState();
			st.rec = null;
			setVoiceState({ phase: "processing" });
			try {
				const blob = new Blob(rec.chunks, { type: rec.mime });
				const result = await apiCall("/api/voice/transcribe", {
					dataBase64: await new Promise((resolve, reject) => {
						if (typeof FileReader === "undefined") {
							reject(/* @__PURE__ */ new Error("FileReader is not supported"));
							return;
						}
						const fr = new FileReader();
						fr.onload = () => {
							const s = String(fr.result ?? "");
							resolve(s.indexOf(",") >= 0 ? s.slice(s.indexOf(",") + 1) : s);
						};
						fr.onerror = () => reject(/* @__PURE__ */ new Error("failed to read audio"));
						fr.readAsDataURL(blob);
					}),
					mimeType: rec.mime
				});
				const text = String(result.text ?? "").trim();
				if (!text) {
					setVoiceState({
						phase: "error",
						error: "No speech recognized"
					});
					return;
				}
				const target = getVoiceState().target;
				if (target !== null) {
					target.insert(text);
					setVoiceState({
						phase: "idle",
						target: null
					});
					return;
				}
				const actions = getVoiceState().inputActions;
				if (!actions || typeof actions.setDraft !== "function") {
					setVoiceState({
						phase: "error",
						error: "Composer is unavailable"
					});
					return;
				}
				const input = getVoiceState().input;
				const draft = input && typeof input.draft === "string" ? input.draft : "";
				actions.setDraft(draft ? draft + " " + text : text);
				if (mode === "send" && typeof actions.submit === "function") actions.submit();
				setVoiceState({ phase: "idle" });
			} catch (err) {
				setVoiceState({
					phase: "error",
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
		//#endregion
		//#region src/plugin/client/questionTarget.ts
		/**
		* Splice `text` over the selection and report the new caret.
		* @param value - current field content.
		* @param start - selection start.
		* @param end - selection end.
		* @param text - transcript to insert.
		* @returns the next value and the caret offset after the inserted text.
		*/
		function spliceAtCaret(value, start, end, text) {
			const from = Math.max(0, Math.min(start, value.length));
			const to = Math.max(from, Math.min(end, value.length));
			const separator = text !== "" && from > 0 && !/\s$/u.test(value.slice(0, from)) ? " " : "";
			return {
				next: value.slice(0, from) + separator + text + value.slice(to),
				caret: from + separator.length + text.length
			};
		}
		/**
		* Find the visible, editable answer field of the open question card.
		* @returns the textarea, or null when no question card occupies a composer seat.
		*/
		function questionAnswerField() {
			const seats = document.querySelectorAll("[data-composer-seat]");
			for (const seat of seats) {
				const card = seat.querySelector("[data-question-key]");
				if (card === null) continue;
				for (const candidate of card.querySelectorAll("textarea")) {
					if (!(candidate instanceof HTMLTextAreaElement)) continue;
					if (candidate.disabled || candidate.readOnly) continue;
					const rect = candidate.getBoundingClientRect();
					if (rect.width > 0 && rect.height > 0) return candidate;
				}
			}
			return null;
		}
		/**
		* Insert the transcript at the field's caret (or append when it is not focused)
		* and hand the change to React.
		* @param field - the question card's answer textarea.
		* @param text - transcript to insert.
		* @returns whether the field changed.
		*/
		function insertIntoField(field, text) {
			const focused = document.activeElement === field;
			const value = field.value;
			const start = focused ? field.selectionStart ?? value.length : value.length;
			const { next, caret } = spliceAtCaret(value, start, focused ? field.selectionEnd ?? start : value.length, text);
			if (next === value) return false;
			const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
			if (setter !== void 0) setter.call(field, next);
			else field.value = next;
			field.dispatchEvent(new Event("input", { bubbles: true }));
			field.focus();
			field.setSelectionRange(caret, caret);
			return true;
		}
		/**
		* Build a recording target for the question card, so `finish()` inserts there.
		* @param field - the answer textarea found when the recording started.
		* @returns a target whose insertion re-resolves the field when the card re-rendered.
		*/
		function questionTarget(field) {
			return { insert(text) {
				insertIntoField(questionAnswerField() ?? field, text);
			} };
		}
		//#endregion
		//#region src/plugin/client/questionOverlay.ts
		/**
		* A minimal recording indicator for the question-card case.
		*
		* The regular pill lives in `conversation.input.dock`, which belongs to the
		* composer fallback: while an `ask_user_question` card occupies the composer
		* seat the whole composer stack is replaced, so the pill is not mounted. This
		* overlay is a plain DOM element (no React root, no new bundle externals) that
		* floats just above the card and offers Cancel / Stop.
		*
		* It is only ever created while a recording targets the question card.
		*
		* @module dsh-voice/client/questionOverlay
		*/
		/**
		* Build and mount the indicator.
		* @returns handle used by the hotkey layer to refresh and remove it.
		*/
		function startQuestionOverlay() {
			let destroyed = false;
			const root = document.createElement("div");
			root.setAttribute("data-dsh-voice-overlay", "");
			root.style.cssText = [
				"position:fixed",
				"left:50%",
				"transform:translateX(-50%)",
				"top:80px",
				"z-index:80",
				"display:flex",
				"align-items:center",
				"gap:8px",
				"height:40px",
				"padding:0 8px 0 12px",
				"border-radius:999px",
				"box-sizing:border-box",
				"pointer-events:auto",
				"background:var(--dsw-specific-input-major, #1f1f1f)",
				"color:var(--dsw-alias-label-primary, #fff)",
				"border:.5px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))",
				"box-shadow:var(--dsw-elevation-panel, 0 6px 24px rgba(0,0,0,.35))",
				"font:13px/1.2 var(--dsw-font-family, system-ui, -apple-system, \"Segoe UI\", sans-serif)"
			].join(";");
			const button = (glyph, title) => {
				const element = document.createElement("button");
				element.type = "button";
				element.textContent = glyph;
				element.title = title;
				element.setAttribute("aria-label", title);
				element.style.cssText = [
					"width:28px",
					"height:28px",
					"padding:0",
					"border:0",
					"border-radius:999px",
					"display:grid",
					"place-items:center",
					"background:transparent",
					"color:inherit",
					"font:inherit",
					"font-size:14px",
					"cursor:pointer"
				].join(";");
				return element;
			};
			const dot = document.createElement("span");
			dot.style.cssText = "width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsw-alias-state-error-primary, #e5484d)";
			const label = document.createElement("span");
			label.style.cssText = "white-space:nowrap;font-weight:500;margin-right:4px";
			const cancel = button("✕", "Cancel recording");
			const stop = button("⏹", "Stop and insert into your answer");
			root.append(cancel, dot, label, stop);
			document.body.appendChild(root);
			const dismiss = () => {
				const phase = getVoiceState().phase;
				if (phase === "recording" || phase === "starting") cancelRecording();
				else setVoiceState({
					phase: "idle",
					error: "",
					target: null
				});
			};
			cancel.addEventListener("click", dismiss);
			stop.addEventListener("click", () => {
				if (getVoiceState().phase === "recording") stopWith("insert");
			});
			/** Keep the indicator right above the card the question occupies. */
			const place = () => {
				const seat = document.querySelector("[data-composer-seat]");
				const top = seat === null ? 80 : seat.getBoundingClientRect().top - 52;
				root.style.top = Math.max(8, Math.round(top)) + "px";
			};
			const refresh = () => {
				if (destroyed) return;
				const state = getVoiceState();
				const rec = state.rec;
				if (state.phase === "recording" && rec !== null) {
					const elapsed = (Date.now() - rec.startedAt) / 1e3;
					label.textContent = "Recording " + fmtTime(elapsed);
					dot.style.background = "var(--dsw-alias-state-error-primary, #e5484d)";
					label.style.color = "inherit";
					if (elapsed >= 300) stopWith("insert");
					place();
					return;
				}
				if (state.phase === "processing") {
					label.textContent = "Transcribing…";
					dot.style.background = "var(--dsw-alias-state-business-primary, #4c8dff)";
					label.style.color = "inherit";
					place();
					return;
				}
				if (state.phase === "error") {
					label.textContent = "Error: " + state.error.slice(0, 80);
					dot.style.background = "var(--dsw-alias-state-error-primary, #e5484d)";
					label.style.color = "var(--dsw-alias-state-error-primary, #e5484d)";
					place();
					return;
				}
				label.textContent = "Starting…";
				place();
			};
			const tick = window.setInterval(refresh, 200);
			refresh();
			return {
				refresh,
				destroy() {
					if (destroyed) return;
					destroyed = true;
					window.clearInterval(tick);
					root.remove();
				}
			};
		}
		//#endregion
		//#region src/plugin/client/hotkey.ts
		/**
		* Voice hotkeys — a plugin-owned keyboard layer that starts a recording and
		* finishes it (send or insert) without the mouse.
		*
		* Why not `ctx.shortcuts`? The Harness command registry refuses Web bindings
		* outside its admitted set: on Web/Linux only `Ctrl+/`, `Ctrl+Shift+,` and
		* `Ctrl+Shift+.` pass `bindingIssue()`; `Ctrl+E` is `unsupported-browser` and
		* `register()` throws. This layer therefore listens on `window` in the bubble
		* phase and defers to the application: an already-prevented event means the
		* registry (or a local handler) owns the combination, so we stay out of it.
		*
		* Everything in this module is inert until {@link installHotkeyLayer} runs, and
		* nothing touches `window`/`document` at import time — the pure helpers are
		* imported directly by `test/hotkey.mjs` under Node.
		*
		* @module dsh-voice/client/hotkey
		*/
		const DEFAULT_HOTKEY = {
			combo: "Ctrl+E",
			altCombo: "Ctrl+Alt+E",
			action: "send"
		};
		/** Canonical modifier order for display and persistence. */
		const MODIFIER_ORDER = [
			"ctrl",
			"alt",
			"shift",
			"meta"
		];
		const MODIFIER_LABELS = {
			ctrl: "Ctrl",
			alt: "Alt",
			shift: "Shift",
			meta: "Meta"
		};
		/** Accepted physical keys: Latin letters, top-row digits, F1–F12. */
		const KEY_CODE = /^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2]))$/;
		/** `KeyE` → `E`, `Digit1` → `1`, `F5` → `F5`. */
		function displayCode(code) {
			if (code.startsWith("Key")) return code.slice(3);
			if (code.startsWith("Digit")) return code.slice(5);
			return code;
		}
		/** One key token (`e`, `KeyE`, `1`, `F5`) → canonical code, or null. */
		function codeFromToken(token) {
			const lower = token.toLowerCase();
			const letter = /^(?:key)?([a-z])$/.exec(lower);
			if (letter !== null) return "Key" + letter[1].toUpperCase();
			const digit = /^(?:digit)?([0-9])$/.exec(lower);
			if (digit !== null) return "Digit" + digit[1];
			const fn = /^f([1-9]|1[0-2])$/.exec(lower);
			if (fn !== null) return "F" + fn[1];
			return null;
		}
		/**
		* Parse `Ctrl+E`, `ctrl+shift+e`, `Meta+F5` into a spec.
		* Requires at least one modifier — a bare key would hijack plain typing.
		* @param text - combination as typed in Settings.
		* @returns the normalized spec, or null when the text is not a combination.
		*/
		function parseCombo(text) {
			const raw = String(text ?? "").trim();
			if (raw === "") return null;
			const parts = raw.split("+").map((part) => part.trim());
			if (parts.length < 2 || parts.some((part) => part === "")) return null;
			const spec = {
				code: "",
				ctrl: false,
				alt: false,
				shift: false,
				meta: false
			};
			for (let i = 0; i < parts.length - 1; i++) {
				const modifier = parts[i].toLowerCase();
				if (!MODIFIER_ORDER.includes(modifier)) return null;
				const slot = modifier;
				if (spec[slot]) return null;
				spec[slot] = true;
			}
			const code = codeFromToken(parts[parts.length - 1]);
			if (code === null) return null;
			spec.code = code;
			return spec;
		}
		/**
		* Format a spec the way {@link parseCombo} accepts it (`Ctrl+Alt+E`).
		* @param spec - normalized combination.
		* @returns canonical display and persistence form.
		*/
		function formatCombo(spec) {
			const parts = MODIFIER_ORDER.filter((modifier) => spec[modifier]).map((modifier) => MODIFIER_LABELS[modifier]);
			parts.push(displayCode(spec.code));
			return parts.join("+");
		}
		/**
		* Build a spec from a live event, ignoring bare modifier presses.
		* @param event - keydown event (structurally typed for the Node tests).
		* @returns the spec, or null while only modifiers are held.
		*/
		function specFromEvent(event) {
			const raw = event.code ?? "";
			let code = KEY_CODE.test(raw) ? raw : null;
			if (code === null && typeof event.key === "string" && event.key.length === 1) code = codeFromToken(event.key);
			if (code === null) return null;
			return {
				code,
				ctrl: Boolean(event.ctrlKey),
				alt: Boolean(event.altKey),
				shift: Boolean(event.shiftKey),
				meta: Boolean(event.metaKey)
			};
		}
		/**
		* Compare an event with a spec: same physical key, exactly the same modifiers.
		* @param event - keydown-like event.
		* @param spec - normalized combination.
		* @returns whether this press is the bound combination.
		*/
		function matches(event, spec) {
			return (event.code ?? "") === spec.code && Boolean(event.ctrlKey) === spec.ctrl && Boolean(event.altKey) === spec.alt && Boolean(event.shiftKey) === spec.shift && Boolean(event.metaKey) === spec.meta;
		}
		/**
		* Decide what one press means for the current phase.
		* @param phase - voice recording phase.
		* @param finish - configured second-press behavior.
		* @returns start / pending finish / finish now / ignore.
		*/
		function hotkeyAction(phase, finish = "send") {
			if (phase === "idle" || phase === "error") return "start";
			if (phase === "starting") return "pending";
			if (phase === "recording") return finish === "insert" ? "finish-insert" : "finish-send";
			return "ignore";
		}
		/**
		* First reason this press must not reach the voice state machine.
		* @param input - the pure facts gathered from the event and the app.
		* @returns a stable reason code, or null when the press belongs to voice input.
		*/
		function ignoreReason(input) {
			if (input.repeat) return "repeat";
			if (input.composing) return "composing";
			if (input.prevented) return "prevented";
			if (input.terminal) return "terminal";
			if (input.modal) return "modal";
			if (!input.hasComposer && !input.hasTarget) return "no-target";
			if (input.phase === "processing") return "processing";
			return null;
		}
		let config = { ...DEFAULT_HOTKEY };
		let specs = [];
		let suspended = 0;
		let pendingFinish = null;
		let installed = false;
		const configListeners = /* @__PURE__ */ new Set();
		let testWaiters = [];
		let testTimer = null;
		let overlay = null;
		/** Recompute the parsed specs from the current config. */
		function rebuild() {
			specs = [config.combo, config.altCombo].map((text) => text === "" ? null : parseCombo(text)).filter((spec) => spec !== null);
		}
		/**
		* Apply a partial config, ignoring combinations this module cannot parse.
		* @param next - fields to change.
		*/
		function setHotkeyConfig(next) {
			if (typeof next.combo === "string") {
				const spec = parseCombo(next.combo);
				if (spec !== null) config.combo = formatCombo(spec);
			}
			if (typeof next.altCombo === "string") {
				if (next.altCombo === "") config.altCombo = "";
				else {
					const spec = parseCombo(next.altCombo);
					if (spec !== null) config.altCombo = formatCombo(spec);
				}
			}
			if (next.action === "send" || next.action === "insert") config.action = next.action;
			rebuild();
			for (const listener of configListeners) listener();
		}
		/** Read the live hotkey config (a copy). */
		function getHotkeyConfig() {
			return { ...config };
		}
		/** Human-readable primary combination for tooltips (`Ctrl+E`). */
		function getHotkeyLabel() {
			const spec = config.combo === "" ? null : parseCombo(config.combo);
			return spec === null ? "" : formatCombo(spec);
		}
		/**
		* Subscribe to config changes (tooltip/settings).
		* @param listener - called after every applied change.
		* @returns disposer.
		*/
		function subscribeHotkeyConfig(listener) {
			configListeners.add(listener);
			return () => {
				configListeners.delete(listener);
			};
		}
		/** Read the persisted hotkey config once the host half answers. */
		async function loadHotkeyConfig() {
			try {
				const view = await apiCall("/api/voice/config");
				if (view.hotkey !== void 0) setHotkeyConfig(view.hotkey);
			} catch {}
		}
		/**
		* Pause the layer while the settings page records a new combination.
		* @param active - whether the layer must stay out of the way.
		*/
		function suspendHotkey(active) {
			suspended = Math.max(0, suspended + (active ? 1 : -1));
		}
		/**
		* Watch for the configured combination for a short while (Settings → Test).
		* @param timeoutMs - how long to wait for a press.
		* @returns true when the page received a matching press, false on timeout.
		*/
		function armHotkeyTest(timeoutMs = 5e3) {
			if (typeof window === "undefined") return Promise.resolve(false);
			return new Promise((resolve) => {
				testWaiters.push({ resolve });
				if (testTimer === null) testTimer = window.setTimeout(() => {
					testTimer = null;
					const waiters = testWaiters;
					testWaiters = [];
					for (const waiter of waiters) waiter.resolve(false);
				}, timeoutMs);
			});
		}
		/** Resolve every armed test — a press reached the page. */
		function settleTest() {
			if (testTimer !== null) {
				window.clearTimeout(testTimer);
				testTimer = null;
			}
			const waiters = testWaiters;
			testWaiters = [];
			for (const waiter of waiters) waiter.resolve(true);
		}
		/** True while a visible modal/dialog owns the keyboard. */
		function modalOpen() {
			const nodes = document.querySelectorAll("[aria-modal=\"true\"], [role=\"dialog\"], dialog[open]");
			for (const node of nodes) {
				const rect = node.getBoundingClientRect();
				if (rect.width > 0 && rect.height > 0) return true;
			}
			return false;
		}
		/** True when the event target lives inside an xterm terminal (Ctrl+E = EOL there). */
		function inTerminal(target) {
			return target instanceof Element && target.closest(".xterm") !== null;
		}
		/**
		* Show the floating indicator exactly while a question-card recording is alive
		* (the composer's own pill is not mounted in that presentation).
		*/
		function syncOverlay() {
			const state = getVoiceState();
			if (state.target !== null && state.phase !== "idle") {
				if (overlay === null) overlay = startQuestionOverlay();
				overlay.refresh();
				return;
			}
			if (overlay !== null) {
				overlay.destroy();
				overlay = null;
			}
		}
		/**
		* Attach the keyboard layer.
		* @returns disposer that removes the listener and pending state.
		*/
		function installHotkeyLayer() {
			if (typeof window === "undefined" || installed) return () => {};
			installed = true;
			const onKeyDown = (event) => {
				if (event.repeat || event.isComposing || event.keyCode === 229) return;
				if (suspended > 0) return;
				if (!specs.some((spec) => matches(event, spec))) return;
				if (testWaiters.length > 0) {
					event.preventDefault();
					settleTest();
					return;
				}
				const state = getVoiceState();
				const field = questionAnswerField();
				const finish = field === null ? config.action : "insert";
				if (ignoreReason({
					repeat: event.repeat,
					composing: event.isComposing,
					prevented: event.defaultPrevented,
					terminal: inTerminal(event.target),
					modal: modalOpen(),
					hasComposer: state.inputActions !== null,
					hasTarget: field !== null,
					phase: state.phase
				}) !== null) return;
				const action = hotkeyAction(state.phase, finish);
				if (action === "ignore") return;
				event.preventDefault();
				if (action === "start") {
					if (state.phase === "error") setVoiceState({
						phase: "idle",
						error: ""
					});
					pendingFinish = null;
					setVoiceState({ target: field === null ? null : questionTarget(field) });
					startRecording();
					return;
				}
				if (action === "pending") {
					pendingFinish = finish;
					return;
				}
				pendingFinish = null;
				stopWith(action === "finish-insert" ? "insert" : "send");
			};
			const unsubscribePhase = subscribeVoice(() => {
				const phase = getVoiceState().phase;
				if (phase === "idle" || phase === "error") pendingFinish = null;
				else if (pendingFinish !== null && phase === "recording") {
					const finish = pendingFinish;
					pendingFinish = null;
					stopWith(finish);
				}
				syncOverlay();
			});
			window.addEventListener("keydown", onKeyDown, { passive: false });
			rebuild();
			return () => {
				window.removeEventListener("keydown", onKeyDown);
				unsubscribePhase();
				overlay?.destroy();
				overlay = null;
				installed = false;
				pendingFinish = null;
			};
		}
		//#endregion
		//#region src/plugin/client/waveform.ts
		/** Live waveform drawn on a <canvas> from the analyser's frequency data,
		*  fading right-to-left like ChatGPT's voice mode. */
		const WAVE_COLOR_DEFAULT = "#ffffff";
		function drawWaveform(canvas) {
			const g = canvas.getContext("2d");
			if (!g) return;
			const w = canvas.width;
			const h = canvas.height;
			g.clearRect(0, 0, w, h);
			const st = getVoiceState();
			if (!st.waveColor) try {
				st.waveColor = getComputedStyle(canvas).color || WAVE_COLOR_DEFAULT;
			} catch {
				st.waveColor = WAVE_COLOR_DEFAULT;
			}
			const levels = st.levels;
			if (!levels.length) return;
			const step = 7;
			const bw = 3.5;
			const midY = h / 2;
			for (let i = 0; i < levels.length && i * step < w; i++) {
				const level = levels[levels.length - 1 - i];
				const age = i / levels.length;
				const x = w - 10 - i * step;
				if (age > .72) {
					g.globalAlpha = .22;
					g.fillStyle = st.waveColor;
					g.fillRect(x, midY - 1.5, 2, 3);
				} else {
					const alpha = 1 - age * .75;
					const hh = Math.max(2.5, level * (h - 6) * .5 * (1 - age * .35));
					g.globalAlpha = alpha;
					g.fillStyle = st.waveColor;
					g.fillRect(x, midY - hh, bw, hh * 2);
				}
			}
			g.globalAlpha = 1;
		}
		//#endregion
		//#region src/plugin/client/icons.tsx
		/** Inline SVG icon set (Feather-style, 24x24 viewBox, stroke currentColor). */
		const ic = {
			width: 18,
			height: 18,
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: 2,
			strokeLinecap: "round",
			strokeLinejoin: "round"
		};
		function MicIcon() {
			return react.createElement("svg", ic, react.createElement("path", { d: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" }), react.createElement("path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }), react.createElement("line", {
				x1: 12,
				y1: 19,
				x2: 12,
				y2: 23
			}));
		}
		function XIcon() {
			return react.createElement("svg", ic, react.createElement("line", {
				x1: 18,
				y1: 6,
				x2: 6,
				y2: 18
			}), react.createElement("line", {
				x1: 6,
				y1: 6,
				x2: 18,
				y2: 18
			}));
		}
		function ArrowIcon() {
			return react.createElement("svg", {
				...ic,
				strokeWidth: 2.5
			}, react.createElement("line", {
				x1: 12,
				y1: 19,
				x2: 12,
				y2: 5
			}), react.createElement("polyline", { points: "5 12 12 5 19 12" }));
		}
		function StopIcon() {
			return react.createElement("svg", ic, react.createElement("rect", {
				x: 7,
				y: 7,
				width: 10,
				height: 10,
				rx: 2.5,
				fill: "currentColor",
				stroke: "none"
			}));
		}
		function WarnIcon() {
			return react.createElement("svg", ic, react.createElement("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }), react.createElement("line", {
				x1: 12,
				y1: 9,
				x2: 12,
				y2: 13
			}), react.createElement("line", {
				x1: 12,
				y1: 17,
				x2: 12.01,
				y2: 17
			}));
		}
		function SpinnerIcon() {
			return react.createElement("svg", {
				...ic,
				className: "voice-spin"
			}, react.createElement("path", { d: "M21 12a9 9 0 1 1-6.219-8.56" }));
		}
		//#endregion
		//#region \0dsh-css:src/plugin/client/voice.module.css.mjs
		const css = ".XbCeMa_voiceMic{border:.5px solid var(--dsw-alias-border-l3);width:30px;height:30px;color:var(--dsw-alias-label-secondary);cursor:pointer;box-sizing:border-box;background:0 0;border-radius:50%;justify-content:center;align-items:center;padding:0;display:flex}.XbCeMa_voiceMic:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l4);color:var(--dsw-alias-label-primary)}.XbCeMa_voiceMic:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}.XbCeMa_voiceMic:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.XbCeMa_voiceMic:disabled{opacity:.4;cursor:not-allowed}.XbCeMa_voicePill{background:var(--dsw-alias-bg-overlay);border:.5px solid var(--dsw-alias-border-l2);width:100%;max-width:720px;height:52px;box-shadow:var(--dsw-shadow-lv3);box-sizing:border-box;border-radius:26px;align-items:center;gap:10px;margin:0 auto;padding:0 14px;display:flex}.XbCeMa_voicePillBtn{width:34px;height:34px;color:var(--dsw-alias-label-primary);cursor:pointer;box-sizing:border-box;background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:flex}.XbCeMa_voicePillBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.XbCeMa_voicePillBtn:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}.XbCeMa_voicePillBtn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.XbCeMa_voicePillBtn:disabled{opacity:.4;cursor:not-allowed}.XbCeMa_voicePillCancel{border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary);background:0 0}.XbCeMa_voicePillStop{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary)}.XbCeMa_voicePillSend{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}.XbCeMa_voicePillSend:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.XbCeMa_voiceWave{width:100%;height:40px;color:var(--dsw-alias-label-primary);flex:1}.XbCeMa_voiceStatus{color:var(--dsw-alias-label-secondary);align-items:center;gap:10px;font-size:13px;line-height:1.5;display:flex}.XbCeMa_voiceStatusErr{color:var(--dsw-alias-state-error-primary)}.XbCeMa_voiceErrText{text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}.XbCeMa_voiceSpin{animation:1s linear infinite XbCeMa_voiceSpin}@keyframes XbCeMa_voiceSpin{0%{transform:rotate(0)}to{transform:rotate(360deg)}}.XbCeMa_voiceSettings{flex-direction:column;gap:12px;max-width:560px;padding:4px 0;display:flex}.XbCeMa_voiceField{color:var(--dsw-alias-label-primary);flex-direction:column;gap:6px;padding:8px 0;font-size:13px;font-weight:500;line-height:1.5;display:flex}.XbCeMa_voiceSettings input,.XbCeMa_voiceSettings select{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);padding:0 12px;font-size:13px;font-weight:400;line-height:1.5}.XbCeMa_voiceSettings input:focus-visible,.XbCeMa_voiceSettings select:focus-visible{border-color:var(--dsw-alias-state-business-primary);outline:none}.XbCeMa_voiceSettings input:disabled,.XbCeMa_voiceSettings select:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.XbCeMa_voiceSave{appearance:none;border-radius:var(--dsw-radius-md);font:inherit;cursor:pointer;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border:1px solid #0000;align-self:flex-start;padding:5px 14px;font-size:13px;line-height:1.5}.XbCeMa_voiceSave:hover:not(:disabled){background:var(--dsw-alias-label-secondary)}.XbCeMa_voiceSave:disabled{opacity:.4;cursor:default}.XbCeMa_voiceSave:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.XbCeMa_voiceHint{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:1.5}.XbCeMa_voiceHintErr{color:var(--dsw-alias-state-error-primary);font-size:12px;font-weight:400;line-height:1.5}.XbCeMa_voiceSaved{color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:1.5}.XbCeMa_voiceRow{align-items:center;gap:8px;display:flex}.XbCeMa_voiceRow select{flex:1}.XbCeMa_voiceAction{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);height:28px;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;white-space:nowrap;background:0 0;justify-content:center;align-items:center;gap:4px;padding:0 10px;font-size:12px;font-weight:400;line-height:18px;display:inline-flex}.XbCeMa_voiceAction:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.XbCeMa_voiceAction:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}.XbCeMa_voiceAction:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.XbCeMa_voiceAction:disabled{opacity:.4;cursor:not-allowed}.XbCeMa_voiceBar{border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2);height:6px;overflow:hidden}.XbCeMa_voiceBar>div{background:var(--dsw-alias-state-business-primary);height:100%;transition:width .4s}.XbCeMa_voiceDlInfo{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}.XbCeMa_voiceAdvanced{flex-direction:column;gap:8px;margin-top:4px;display:flex}.XbCeMa_voiceAdvancedBody{border-left:.5px solid var(--dsw-alias-border-l2);flex-direction:column;gap:12px;padding-left:12px;display:flex}.XbCeMa_voiceComposerFrame{padding:6px calc(var(--dsh-composer-side-clearance,16px) + 16px) 10px;justify-content:center;display:flex}.XbCeMa_voiceComposerCard{box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width,920px);border-radius:var(--dsw-radius-panel);background:var(--dsw-specific-input-major);box-shadow:var(--dsw-elevation-soft);color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px));flex-direction:column;gap:10px;padding:10px 10px 8px;display:flex}.XbCeMa_voiceComposerCard,.XbCeMa_voiceComposerCard *{box-sizing:border-box}.XbCeMa_voiceComposerDraft{max-height:var(--dsh-composer-text-max-height,336px);white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;color:var(--dsw-alias-label-primary);padding:4px 8px 0 14px;overflow-y:auto}.XbCeMa_voiceComposerHint{color:var(--dsw-alias-label-tertiary);align-items:center;gap:8px;padding:4px 8px 0 14px;display:flex}.XbCeMa_voiceComposerErr{color:var(--dsw-alias-state-error-primary);align-items:center;gap:8px;padding:0 10px;font-size:13px;line-height:20px;display:flex}.XbCeMa_voiceComposerRow{align-items:center;gap:8px;min-width:0;padding:2px 4px 0;display:flex}.XbCeMa_voiceComposerBtn{appearance:none;width:30px;height:30px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:1px solid #0000;border-radius:999px;flex:none;place-items:center;padding:0;display:grid}.XbCeMa_voiceComposerBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.XbCeMa_voiceComposerBtn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.XbCeMa_voiceComposerBtnGhost{flex:none;width:30px;height:30px}.XbCeMa_voiceComposerSend{appearance:none;background:var(--dsw-alias-button-info-fill);width:32px;height:32px;color:var(--dsw-alias-label-primary-foreground);cursor:pointer;border:none;border-radius:999px;flex:none;place-items:center;padding:0;display:grid}.XbCeMa_voiceComposerSend:hover{background:var(--dsw-alias-button-info-hover)}.XbCeMa_voiceComposerWaveSlot{flex:auto;align-items:center;min-width:0;display:flex}.XbCeMa_voiceComposerWave{width:100%;height:24px;display:block}.XbCeMa_voiceComposerBusy{color:var(--dsw-alias-label-tertiary);align-items:center;gap:6px;font-size:13px;display:inline-flex}";
		const tagId = "dsh-voice/voice.module.css";
		if (typeof document !== "undefined") {
			const existing = document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]");
			if (existing === null) {
				const tag = document.createElement("style");
				tag.dataset.plugin = "dsh-voice";
				tag.dataset.pluginCss = tagId;
				tag.textContent = css;
				document.head.appendChild(tag);
			} else if (existing.textContent !== css) existing.textContent = css;
		}
		var voice_module_css_default = {
			"voiceAction": "XbCeMa_voiceAction",
			"voiceAdvanced": "XbCeMa_voiceAdvanced",
			"voiceAdvancedBody": "XbCeMa_voiceAdvancedBody",
			"voiceBar": "XbCeMa_voiceBar",
			"voiceComposerBtn": "XbCeMa_voiceComposerBtn",
			"voiceComposerBtnGhost": "XbCeMa_voiceComposerBtnGhost",
			"voiceComposerBusy": "XbCeMa_voiceComposerBusy",
			"voiceComposerCard": "XbCeMa_voiceComposerCard",
			"voiceComposerDraft": "XbCeMa_voiceComposerDraft",
			"voiceComposerErr": "XbCeMa_voiceComposerErr",
			"voiceComposerFrame": "XbCeMa_voiceComposerFrame",
			"voiceComposerHint": "XbCeMa_voiceComposerHint",
			"voiceComposerRow": "XbCeMa_voiceComposerRow",
			"voiceComposerSend": "XbCeMa_voiceComposerSend",
			"voiceComposerWave": "XbCeMa_voiceComposerWave",
			"voiceComposerWaveSlot": "XbCeMa_voiceComposerWaveSlot",
			"voiceDlInfo": "XbCeMa_voiceDlInfo",
			"voiceErrText": "XbCeMa_voiceErrText",
			"voiceField": "XbCeMa_voiceField",
			"voiceHint": "XbCeMa_voiceHint",
			"voiceHintErr": "XbCeMa_voiceHintErr",
			"voiceMic": "XbCeMa_voiceMic",
			"voicePill": "XbCeMa_voicePill",
			"voicePillBtn": "XbCeMa_voicePillBtn",
			"voicePillCancel": "XbCeMa_voicePillCancel",
			"voicePillSend": "XbCeMa_voicePillSend",
			"voicePillStop": "XbCeMa_voicePillStop",
			"voiceRow": "XbCeMa_voiceRow",
			"voiceSave": "XbCeMa_voiceSave",
			"voiceSaved": "XbCeMa_voiceSaved",
			"voiceSettings": "XbCeMa_voiceSettings",
			"voiceSpin": "XbCeMa_voiceSpin",
			"voiceStatus": "XbCeMa_voiceStatus",
			"voiceStatusErr": "XbCeMa_voiceStatusErr",
			"voiceWave": "XbCeMa_voiceWave"
		};
		//#endregion
		//#region src/plugin/client/components.tsx
		/** Mic button (idle) and the recording pill (recording/processing/error). */
		function useVoiceState() {
			const [, force] = react.useReducer((x) => x + 1, 0);
			react.useEffect(() => subscribeVoice(force), []);
			const st = getVoiceState();
			return {
				phase: st.phase,
				error: st.error
			};
		}
		/**
		* Mirror the composer actions into the shared voice store. The cleanup drops
		* them when this slot unmounts, so a hotkey cannot finish into a composer that
		* is no longer on screen (and stale references never outlive their session).
		*/
		function useComposerBridge(props) {
			react.useEffect(() => {
				const actions = props.inputActions ?? null;
				const input = props.input ?? null;
				const st = getVoiceState();
				st.inputActions = actions;
				st.input = input;
				return () => {
					const current = getVoiceState();
					if (current.inputActions === actions) current.inputActions = null;
					if (current.input === input) current.input = null;
				};
			}, [props.inputActions, props.input]);
		}
		/** The configured combination, kept in sync with Settings → Voice. */
		function useHotkeyLabel() {
			const [label, setLabel] = react.useState(getHotkeyLabel());
			react.useEffect(() => subscribeHotkeyConfig(() => setLabel(getHotkeyLabel())), []);
			return label;
		}
		/** The mic button next to the send button. */
		function MicButton(props) {
			const v = useVoiceState();
			const hotkey = useHotkeyLabel();
			useComposerBridge(props);
			if (v.phase !== "idle") return null;
			return react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceMic,
				title: hotkey === "" ? "Voice input" : "Voice input (" + hotkey + ")",
				onClick: startRecording
			}, react.createElement(MicIcon));
		}
		/** The recording pill above the composer. */
		function RecordPill(props) {
			const v = useVoiceState();
			const canvasRef = react.useRef(null);
			useComposerBridge(props);
			react.useEffect(() => {
				if (v.phase !== "recording") return;
				let elapsed = 0;
				const id = window.setInterval(() => {
					elapsed += .05;
					const rec = getVoiceState().rec;
					if (rec && rec.analyser) {
						const data = new Uint8Array(rec.analyser.frequencyBinCount);
						rec.analyser.getByteFrequencyData(data);
						let sum = 0;
						for (let i = 0; i < data.length; i++) sum += data[i];
						const s = getVoiceState();
						s.levels.push(Math.min(1, sum / data.length / 255 * 2.2));
						if (s.levels.length > 150) s.levels.shift();
					}
					if (elapsed >= 300) stopWith("insert");
				}, 50);
				return () => window.clearInterval(id);
			}, [v.phase]);
			react.useEffect(() => {
				if (v.phase !== "recording") return;
				const id = window.setInterval(() => {
					if (canvasRef.current) drawWaveform(canvasRef.current);
				}, 50);
				return () => window.clearInterval(id);
			}, [v.phase]);
			if (v.phase === "idle" || v.phase === "starting") return null;
			if (v.phase === "recording") return react.createElement("div", { className: voice_module_css_default.voicePill }, react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voicePillBtn + " " + voice_module_css_default.voicePillCancel,
				title: "Cancel recording",
				onClick: cancelRecording
			}, react.createElement(XIcon)), react.createElement("canvas", {
				className: voice_module_css_default.voiceWave,
				ref: canvasRef,
				width: 720,
				height: 40
			}), react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voicePillBtn + " " + voice_module_css_default.voicePillStop,
				title: "Stop and insert text",
				onClick: () => stopWith("insert")
			}, react.createElement(StopIcon)), react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voicePillBtn + " " + voice_module_css_default.voicePillSend,
				title: "Send",
				onClick: () => stopWith("send")
			}, react.createElement(ArrowIcon)));
			if (v.phase === "processing") return react.createElement("div", { className: voice_module_css_default.voicePill }, react.createElement("span", { className: voice_module_css_default.voiceStatus }, react.createElement(SpinnerIcon), "Transcribing…"));
			return react.createElement("div", { className: voice_module_css_default.voicePill }, react.createElement("span", { className: voice_module_css_default.voiceStatus + " " + voice_module_css_default.voiceStatusErr }, react.createElement(WarnIcon)), react.createElement("span", { className: voice_module_css_default.voiceErrText }, v.error), react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voicePillBtn + " " + voice_module_css_default.voicePillCancel,
				title: "Dismiss",
				onClick: () => setVoiceState({
					phase: "idle",
					error: ""
				})
			}, react.createElement(XIcon)));
		}
		//#endregion
		//#region src/plugin/client/settings.tsx
		/** Settings page: provider, engine, model catalog + downloads, Codex login
		*  status, language, and an Advanced section. The API key is set through its own
		*  endpoint and only surfaced as hasKey, and the Codex tokens never leave the
		*  host — the key value never reaches the browser. */
		function VoiceSettings() {
			const [cfg, setCfg] = react.useState(null);
			const [models, setModels] = react.useState(null);
			const [platform, setPlatform] = react.useState(null);
			const [downloads, setDownloads] = react.useState({});
			const [apiKeyDraft, setApiKeyDraft] = react.useState("");
			const [saved, setSaved] = react.useState("");
			const [showAdvanced, setShowAdvanced] = react.useState(false);
			const [codex, setCodex] = react.useState(null);
			const [codexTest, setCodexTest] = react.useState("");
			const [codexTesting, setCodexTesting] = react.useState(false);
			const [hotkeyCapture, setHotkeyCapture] = react.useState(null);
			const [hotkeyTest, setHotkeyTest] = react.useState("");
			react.useEffect(() => {
				if (hotkeyCapture === null) return;
				suspendHotkey(true);
				const onKeyDown = (event) => {
					event.preventDefault();
					event.stopPropagation();
					if (event.key === "Escape") {
						setHotkeyCapture(null);
						return;
					}
					const spec = specFromEvent(event);
					if (spec === null) return;
					const text = formatCombo(spec);
					setCfg((prev) => prev === null ? prev : {
						...prev,
						hotkey: {
							...prev.hotkey,
							[hotkeyCapture]: text
						}
					});
					setHotkeyCapture(null);
				};
				window.addEventListener("keydown", onKeyDown, true);
				return () => {
					window.removeEventListener("keydown", onKeyDown, true);
					suspendHotkey(false);
				};
			}, [hotkeyCapture]);
			const refreshCodex = () => {
				apiCall("/api/voice/codex-status").then((r) => {
					if (r.ok && r.status) setCodex(r.status);
				}).catch(() => {});
			};
			function refreshModels() {
				apiCall("/api/voice/models").then((r) => {
					if (r.ok) {
						setModels(r.models ?? null);
						setPlatform(r.platform ?? null);
					}
				}).catch(() => {});
			}
			react.useEffect(() => {
				let alive = true;
				apiCall("/api/voice/config").then((c) => {
					if (alive) setCfg(c);
				}).catch(() => {});
				refreshModels();
				refreshCodex();
				return () => {
					alive = false;
				};
			}, []);
			react.useEffect(() => {
				const id = window.setInterval(() => {
					apiCall("/api/voice/download-status").then((r) => {
						if (r.ok) setDownloads(r.downloads ?? {});
					}).catch(() => {});
				}, 700);
				return () => window.clearInterval(id);
			}, []);
			if (!cfg) return react.createElement("div", { className: voice_module_css_default.voiceSettings }, "Loading…");
			const set = (path, value) => {
				const next = JSON.parse(JSON.stringify(cfg));
				const parts = path.split(".");
				let node = next;
				for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]];
				node[parts[parts.length - 1]] = value;
				setCfg(next);
			};
			const save = () => {
				apiCall("/api/voice/config", cfg).then((view) => {
					const stored = view.hotkey;
					if (stored !== void 0) {
						setHotkeyConfig(stored);
						setCfg((prev) => prev === null ? prev : {
							...prev,
							hotkey: stored
						});
					}
					setSaved("Saved ✓");
					refreshCodex();
					window.setTimeout(() => setSaved(""), 2e3);
				}).catch(() => setSaved("Save failed"));
			};
			const updateHotkey = (patch) => {
				setCfg((prev) => prev === null ? prev : {
					...prev,
					hotkey: {
						...prev.hotkey,
						...patch
					}
				});
			};
			const runHotkeyTest = () => {
				setHotkeyTest("Press the shortcut now…");
				armHotkeyTest(5e3).then((delivered) => {
					setHotkeyTest(delivered ? "✓ the page received the shortcut" : "✗ not received — the browser or the system may reserve it; try the fallback");
				});
			};
			const runCodexTest = () => {
				setCodexTesting(true);
				setCodexTest("");
				apiCall("/api/voice/codex-check", {}).then((r) => {
					setCodexTest(r.message ?? "Works");
				}).catch((e) => {
					setCodexTest("Error: " + (e instanceof Error ? e.message : String(e)));
				}).finally(() => {
					setCodexTesting(false);
				});
			};
			const saveApiKey = () => {
				apiCall("/api/voice/api-key", { key: apiKeyDraft }).then(() => {
					setApiKeyDraft("");
					setSaved("Saved ✓");
					window.setTimeout(() => setSaved(""), 2e3);
				}).catch(() => setSaved("Save failed"));
			};
			const nestedField = (label, group, path, type) => react.createElement("label", { className: voice_module_css_default.voiceField }, label, react.createElement("input", {
				type: type ?? "text",
				value: cfg[group][path] ?? "",
				onChange: (e) => set(group + "." + path, e.target.value)
			}));
			const dlEngine = downloads["engine"] ?? null;
			const selModel = cfg.tcpp.modelId ?? "";
			const dlModel = downloads["model:" + selModel] ?? null;
			const modelMeta = (models ?? []).find((m) => m.id === selModel) ?? null;
			const modelReady = modelMeta ? modelMeta.downloaded : false;
			const bar = (dl, info) => {
				const pct = dl && dl.total ? Math.min(100, Math.round((dl.bytes ?? 0) / dl.total * 100)) : 0;
				return react.createElement("div", null, react.createElement("div", { className: voice_module_css_default.voiceBar }, react.createElement("div", { style: { width: pct + "%" } })), react.createElement("div", { className: voice_module_css_default.voiceDlInfo }, info));
			};
			const modelOptions = (models ?? []).map((m) => react.createElement("option", {
				key: m.id,
				value: m.id
			}, (m.downloaded ? "✓ " : "  ") + m.name + " · " + fmtSize(m.size) + (m.downloaded ? "" : " — not downloaded")));
			const advancedToggle = react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceAction,
				onClick: () => setShowAdvanced((s) => !s)
			}, (showAdvanced ? "▾ " : "▸ ") + "Advanced");
			const codexExpiry = codex && codex.expiresAt ? "token valid until " + new Date(codex.expiresAt).toLocaleString() : "";
			const codexTone = codex === null || codex.state === "ok" ? voice_module_css_default.voiceHint : voice_module_css_default.voiceHintErr;
			const codexLine = codex === null ? "…" : (codex.state === "ok" ? "✓ " : "⚠ ") + codex.message;
			return react.createElement("div", { className: voice_module_css_default.voiceSettings }, react.createElement("label", { className: voice_module_css_default.voiceField }, "Transcription provider", react.createElement("select", {
				value: cfg.provider,
				onChange: (e) => set("provider", e.target.value)
			}, react.createElement("option", { value: "tcpp" }, "transcribe.cpp — Handy model catalog (GigaAM, Voxtral, Whisper…)"), react.createElement("option", { value: "codex" }, "Codex — ChatGPT subscription (no API key, no downloads)"), react.createElement("option", { value: "local" }, "whisper.cpp (single GGML model)"), react.createElement("option", { value: "api" }, "HTTP API (OpenAI-compatible)"))), cfg.provider === "codex" ? react.createElement("div", null, react.createElement("div", { className: voice_module_css_default.voiceField }, "Codex login", react.createElement("div", { className: voice_module_css_default.voiceRow }, react.createElement("span", {
				className: codexTone,
				style: { flex: 1 }
			}, codexLine), react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceAction,
				onClick: refreshCodex
			}, "Refresh"), react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceAction,
				disabled: codexTesting,
				onClick: runCodexTest
			}, codexTesting ? "Testing…" : "Test")), codex && codex.authPath ? react.createElement("div", { className: voice_module_css_default.voiceHint }, codex.authPath + (codexExpiry ? " · " + codexExpiry : "")) : null, codexTest ? react.createElement("div", { className: voice_module_css_default.voiceHint }, codexTest) : null), react.createElement("div", { className: voice_module_css_default.voiceAdvanced }, advancedToggle, showAdvanced ? react.createElement("div", { className: voice_module_css_default.voiceAdvancedBody }, nestedField("auth.json path (blank = $CODEX_HOME or ~/.codex)", "codex", "authPath"), nestedField("Endpoint", "codex", "endpoint"), nestedField("Model (optional — the endpoint ignores it today)", "codex", "model")) : null), react.createElement("div", { className: voice_module_css_default.voiceHint }, "Runs on the ChatGPT subscription behind your local Codex CLI login: no API key, no model download, and the whole recording goes in one request. The tokens are read from disk by the host and never reach the page. If the login expires, run any codex command to refresh it.")) : null, cfg.provider === "tcpp" ? react.createElement("div", null, react.createElement("div", { className: voice_module_css_default.voiceField }, "Transcription engine (transcribe-cli)", react.createElement("div", { className: voice_module_css_default.voiceRow }, react.createElement("span", {
				className: voice_module_css_default.voiceHint,
				style: { flex: 1 }
			}, platform && platform.exists ? "✓ installed" : platform ? "not installed" : "…"), react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceAction,
				disabled: !!(dlEngine && dlEngine.status === "downloading"),
				onClick: () => {
					apiCall("/api/voice/engine-download", {}).then(refreshModels);
				}
			}, dlEngine && dlEngine.status === "downloading" ? "Downloading…" : "Download engine")), platform && platform.path ? react.createElement("div", { className: voice_module_css_default.voiceHint }, "path: " + platform.path) : null, dlEngine && dlEngine.status === "downloading" ? bar(dlEngine, fmtSize(dlEngine.bytes ?? 0) + " / " + fmtSize(dlEngine.total ?? 0)) : null, dlEngine && dlEngine.status === "error" ? react.createElement("div", { className: voice_module_css_default.voiceHint }, "Error: " + dlEngine.error) : null), react.createElement("label", { className: voice_module_css_default.voiceField }, "Model", react.createElement("div", { className: voice_module_css_default.voiceRow }, react.createElement("select", {
				value: selModel,
				onChange: (e) => set("tcpp.modelId", e.target.value)
			}, models === null ? react.createElement("option", { value: selModel }, "Loading catalog…") : modelOptions)), react.createElement("div", { className: voice_module_css_default.voiceRow }, react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceAction,
				disabled: !modelMeta || modelReady || !!(dlModel && dlModel.status === "downloading"),
				onClick: () => {
					apiCall("/api/voice/download", { modelId: selModel }).then(refreshModels);
				}
			}, dlModel && dlModel.status === "downloading" ? "Downloading…" : modelReady ? "Downloaded" : "Download " + (modelMeta ? fmtSize(modelMeta.size) : "")), react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceAction,
				title: "Refresh catalog",
				onClick: refreshModels
			}, "⟳")), dlModel && dlModel.status === "downloading" ? bar(dlModel, fmtSize(dlModel.bytes ?? 0) + " / " + fmtSize(dlModel.total ?? 0)) : null, dlModel && dlModel.status === "error" ? react.createElement("div", { className: voice_module_css_default.voiceHint }, "Error: " + dlModel.error) : null), react.createElement("div", { className: voice_module_css_default.voiceAdvanced }, advancedToggle, showAdvanced ? react.createElement("div", { className: voice_module_css_default.voiceAdvancedBody }, nestedField("Engine path (transcribe-cli)", "tcpp", "binary"), nestedField("Models directory", "tcpp", "modelsDir"), nestedField("Engine download URL ({platform}/{arch})", "tcpp", "engineUrl")) : null), react.createElement("div", { className: voice_module_css_default.voiceHint }, "Same model catalog as Handy: GigaAM, Voxtral, Whisper, Qwen3-ASR, Parakeet, Canary, Moonshine and more. Models are downloaded from Hugging Face.")) : null, cfg.provider === "local" ? react.createElement("div", null, react.createElement("div", { className: voice_module_css_default.voiceAdvanced }, advancedToggle, showAdvanced ? react.createElement("div", { className: voice_module_css_default.voiceAdvancedBody }, nestedField("whisper-cli path", "local", "binary"), nestedField("GGML model path", "local", "model")) : null), react.createElement("div", { className: voice_module_css_default.voiceHint }, "Standard whisper.cpp models: tiny, base, small, medium, large-v3, turbo.")) : null, cfg.provider === "api" ? react.createElement("div", null, nestedField("Endpoint URL", "api", "url"), nestedField("Model (gpt-4o-transcribe, whisper-1, …)", "api", "model"), react.createElement("label", { className: voice_module_css_default.voiceField }, cfg.api.hasKey ? "API key — saved" : "API key (host-only, never stored in the browser)", react.createElement("div", { className: voice_module_css_default.voiceRow }, react.createElement("input", {
				type: "password",
				placeholder: cfg.api.hasKey ? "••••••••" : "",
				value: apiKeyDraft,
				onChange: (e) => setApiKeyDraft(e.target.value)
			}), react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceAction,
				onClick: saveApiKey,
				disabled: !apiKeyDraft
			}, "Set"))), react.createElement("div", { className: voice_module_css_default.voiceHint }, "OpenAI API, Groq, Deepgram-compatible or a local faster-whisper server. The key is sent to the host and never returned to the page.")) : null, react.createElement("label", { className: voice_module_css_default.voiceField }, "Language (Whisper models, API and Codex)", react.createElement("select", {
				value: cfg.language,
				onChange: (e) => set("language", e.target.value)
			}, react.createElement("option", { value: "auto" }, "Auto"), react.createElement("option", { value: "ru" }, "Russian"), react.createElement("option", { value: "en" }, "English"), react.createElement("option", { value: "uk" }, "Ukrainian"), react.createElement("option", { value: "de" }, "German"))), react.createElement("div", { className: voice_module_css_default.voiceField }, "Voice input shortcut", react.createElement("div", { className: voice_module_css_default.voiceRow }, react.createElement("input", {
				readOnly: true,
				value: cfg.hotkey.combo,
				placeholder: "not set",
				title: "Primary combination"
			}), react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceAction,
				onClick: () => setHotkeyCapture("combo")
			}, hotkeyCapture === "combo" ? "Press keys… (Esc cancels)" : "Record"), react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceAction,
				onClick: runHotkeyTest
			}, "Test")), react.createElement("div", { className: voice_module_css_default.voiceRow }, react.createElement("input", {
				readOnly: true,
				value: cfg.hotkey.altCombo,
				placeholder: "none",
				title: "Fallback combination, active at the same time"
			}), react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceAction,
				onClick: () => setHotkeyCapture("altCombo")
			}, hotkeyCapture === "altCombo" ? "Press keys… (Esc cancels)" : "Record fallback"), react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceAction,
				onClick: () => updateHotkey({ altCombo: "" })
			}, "Clear")), react.createElement("label", { className: voice_module_css_default.voiceField }, "Second press", react.createElement("select", {
				value: cfg.hotkey.action,
				onChange: (e) => updateHotkey({ action: e.target.value === "insert" ? "insert" : "send" })
			}, react.createElement("option", { value: "send" }, "Send the transcript"), react.createElement("option", { value: "insert" }, "Insert into the draft only"))), react.createElement("div", { className: voice_module_css_default.voiceHint }, "First press starts recording, the second finishes it. The fallback combination is active at the same time — useful when the browser reserves the main one (Ctrl+E opens the address bar in some browsers). Press Save to apply. " + hotkeyTest)), react.createElement("div", { className: voice_module_css_default.voiceRow }, react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceSave,
				onClick: save
			}, "Save"), saved ? react.createElement("span", { className: voice_module_css_default.voiceSaved }, saved) : null), react.createElement("div", { className: voice_module_css_default.voiceHint }, "dsh-voice v" + (cfg.version ?? "?")));
		}
		//#endregion
		//#region src/plugin/client/composer.tsx
		/**
		* The composer takeover: while a recording runs, register a `conversation.composer`
		* chain entry so the resident composer is replaced by a card of our own — the
		* draft text on top, and the composer's toolbar row turned into the voice
		* controls (✕ / waveform / ⏹ / ↑), the way Codex does it.
		*
		* The entry exists only while the voice state needs it: `index.ts` registers and
		* disposes it on every phase change, and a registration change bumps the slot's
		* version, which makes the chain re-elect immediately. That avoids depending on
		* a re-render we do not own.
		*
		* The takeover unmounts the regular composer bar, so the composer bridge that
		* `components.tsx` keeps in the voice store is gone — this component re-installs
		* it, otherwise `finish()` would have nowhere to insert. `send` is deferred
		* until the bar is back: `finish()` sets `pendingSubmit` and the bridge fires it
		* on the next mount.
		*
		* @module dsh-voice/client/composer
		*/
		/** Stable stand-in so the selector hook is called on every render regardless. */
		const NO_SELECTOR = () => void 0;
		/** Subscribe to the shared voice store (phase + error). */
		function useVoicePhase() {
			const [, force] = react.useReducer((x) => x + 1, 0);
			react.useEffect(() => subscribeVoice(force), []);
			const state = getVoiceState();
			return {
				phase: state.phase,
				error: state.error
			};
		}
		/**
		* The takeover card.
		* @param props - standard slot seat: `inputActions` and the `useInput` selector hook.
		* @returns the replacement composer, or null before the seat is usable.
		*/
		function VoiceComposer(props) {
			const { phase, error } = useVoicePhase();
			const canvasRef = react.useRef(null);
			const useDraft = props.useInput ?? NO_SELECTOR;
			const draft = String(useDraft((state) => state.draft) ?? "");
			react.useEffect(() => {
				const actions = props.inputActions ?? null;
				const state = getVoiceState();
				state.inputActions = actions;
				return () => {
					const current = getVoiceState();
					if (current.inputActions === actions) current.inputActions = null;
				};
			}, [props.inputActions]);
			react.useEffect(() => {
				if (phase !== "error") return;
				const id = window.setTimeout(() => setVoiceState({
					phase: "idle",
					error: "",
					target: null
				}), 6e3);
				return () => window.clearTimeout(id);
			}, [phase]);
			react.useEffect(() => {
				if (phase !== "recording") return;
				const id = window.setInterval(() => {
					if (canvasRef.current) drawWaveform(canvasRef.current);
				}, 50);
				return () => window.clearInterval(id);
			}, [phase]);
			if (phase === "idle") return null;
			const busy = phase === "processing" || phase === "starting";
			const showDraft = draft !== "";
			return react.createElement("div", { className: voice_module_css_default.voiceComposerFrame }, react.createElement("div", { className: voice_module_css_default.voiceComposerCard }, showDraft || busy ? react.createElement("div", { className: showDraft ? voice_module_css_default.voiceComposerDraft : voice_module_css_default.voiceComposerHint }, showDraft ? draft : "Transcribing…") : react.createElement("div", { className: voice_module_css_default.voiceComposerHint }, react.createElement(MicIcon), " Listening…"), phase === "error" ? react.createElement("div", { className: voice_module_css_default.voiceComposerErr }, react.createElement(WarnIcon), react.createElement("span", null, error)) : null, react.createElement("div", { className: voice_module_css_default.voiceComposerRow }, phase === "recording" ? react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceComposerBtn,
				title: "Cancel recording",
				onClick: cancelRecording
			}, react.createElement(XIcon)) : react.createElement("span", { className: voice_module_css_default.voiceComposerBtnGhost }), react.createElement("div", { className: voice_module_css_default.voiceComposerWaveSlot }, busy ? react.createElement("span", { className: voice_module_css_default.voiceComposerBusy }, react.createElement(SpinnerIcon), " Transcribing…") : react.createElement("canvas", {
				ref: canvasRef,
				className: voice_module_css_default.voiceComposerWave,
				width: 900,
				height: 24
			})), phase === "recording" ? react.createElement(react.Fragment, null, react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceComposerBtn,
				title: "Stop and insert text",
				onClick: () => stopWith("insert")
			}, react.createElement(StopIcon)), react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceComposerSend,
				title: "Send",
				onClick: () => stopWith("send")
			}, react.createElement(ArrowIcon))) : null)));
		}
		//#endregion
		//#region src/plugin/client/index.ts
		/**
		* dsh-voice — browser half.
		*
		* Slot registrations: mic button next to the send button
		* (conversation.input.right), the recording pill above the composer
		* (conversation.input.dock) and the Voice settings page (settings.section).
		* All host calls go through plain fetch to /api/voice/* (see the Node half).
		*
		* @module dsh-voice/client
		*/
		/** Required services: slot registration (the browser runtime provides slots). */
		const inject = ["slots"];
		/**
		* Client plugin body: register the mic button, recording pill and settings page.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const slots = ctx.get("slots");
			if (slots === void 0) return;
			slots.inject("conversation.input.right", () => slots.register({
				name: "conversation.input.right",
				id: "voice",
				order: 5,
				label: () => "Voice input"
			}, (props) => react.createElement(MicButton, props)));
			slots.inject("conversation.input.dock", () => slots.register({
				name: "conversation.input.dock",
				id: "voice-rec",
				order: 0,
				label: () => "Voice recording"
			}, (props) => react.createElement(RecordPill, props)));
			slots.inject("settings.section", () => slots.register({
				name: "settings.section",
				id: "voice",
				order: 25,
				label: () => "Voice"
			}, () => react.createElement(VoiceSettings)));
			let composerReady = false;
			let disposeComposer = null;
			const syncComposer = () => {
				const phase = getVoiceState().phase;
				const wanted = composerReady && (phase === "starting" || phase === "recording" || phase === "processing" || phase === "error");
				if (wanted && disposeComposer === null) try {
					disposeComposer = slots.register({
						name: "conversation.composer",
						select: () => "voice"
					}, (props) => react.createElement(VoiceComposer, props));
				} catch {
					disposeComposer = null;
				}
				else if (!wanted && disposeComposer !== null) {
					disposeComposer();
					disposeComposer = null;
				}
			};
			ctx.effect(() => slots.inject("conversation.composer", () => {
				composerReady = true;
				syncComposer();
				return () => {
					composerReady = false;
					if (disposeComposer !== null) {
						disposeComposer();
						disposeComposer = null;
					}
				};
			}), "dsh-voice: composer takeover seat");
			ctx.effect(() => {
				const off = subscribeVoice(syncComposer);
				return () => {
					off();
					if (disposeComposer !== null) {
						disposeComposer();
						disposeComposer = null;
					}
				};
			}, "dsh-voice: composer takeover sync");
			ctx.effect(() => installHotkeyLayer(), "dsh-voice: hotkey layer");
			loadHotkeyConfig();
		}
		//#endregion
		exports.MicButton = MicButton;
		exports.RecordPill = RecordPill;
		exports.VoiceComposer = VoiceComposer;
		exports.VoiceSettings = VoiceSettings;
		exports.apply = apply;
		exports.armHotkeyTest = armHotkeyTest;
		exports.cancelRecording = cancelRecording;
		exports.formatCombo = formatCombo;
		exports.getHotkeyConfig = getHotkeyConfig;
		exports.getHotkeyLabel = getHotkeyLabel;
		exports.getVoiceState = getVoiceState;
		exports.inject = inject;
		exports.parseCombo = parseCombo;
		exports.setHotkeyConfig = setHotkeyConfig;
		exports.specFromEvent = specFromEvent;
		exports.startRecording = startRecording;
		exports.stopWith = stopWith;
		exports.subscribeHotkeyConfig = subscribeHotkeyConfig;
		exports.subscribeVoice = subscribeVoice;
		exports.suspendHotkey = suspendHotkey;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map