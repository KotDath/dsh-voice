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
			input: null
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
				setVoiceState({ phase: "idle" });
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
		//#region \0dsh-css:/home/kotdath/omp/personal/ai/deepseek_plugins/dsh-voice/src/plugin/client/voice.module.css.mjs
		const css = ".THcKMW_voiceMic{border:1px solid var(--dsw-alias-border-l1);width:30px;height:30px;color:var(--dsw-alias-label-secondary);cursor:pointer;box-sizing:border-box;background:0 0;border-radius:50%;justify-content:center;align-items:center;padding:0;display:flex}.THcKMW_voiceMic:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}.THcKMW_voicePill{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);box-sizing:border-box;border-radius:26px;align-items:center;gap:10px;width:100%;max-width:720px;height:52px;margin:0 auto;padding:0 14px;display:flex;box-shadow:0 8px 24px #0000002e}.THcKMW_voicePillBtn{cursor:pointer;box-sizing:border-box;border-radius:50%;flex:none;justify-content:center;align-items:center;width:34px;height:34px;padding:0;display:flex}.THcKMW_voicePillCancel{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0}.THcKMW_voicePillCancel:hover{background:var(--dsw-alias-bg-layer-2)}.THcKMW_voicePillStop{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:none}.THcKMW_voicePillStop:hover{filter:brightness(1.15)}.THcKMW_voicePillSend{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base);border:none}.THcKMW_voicePillSend:hover{opacity:.9}.THcKMW_voiceWave{width:100%;height:40px;color:var(--dsw-alias-label-primary);flex:1}.THcKMW_voiceStatus{color:var(--dsw-alias-label-secondary);align-items:center;gap:10px;font-size:13px;display:flex}.THcKMW_voiceStatusErr{color:var(--dsw-alias-state-error-primary)}.THcKMW_voiceErrText{text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}.THcKMW_voiceSpin{animation:1s linear infinite THcKMW_voiceSpin}@keyframes THcKMW_voiceSpin{0%{transform:rotate(0)}to{transform:rotate(360deg)}}.THcKMW_voiceSettings{flex-direction:column;gap:12px;max-width:560px;padding:8px 0;display:flex}.THcKMW_voiceField{color:var(--dsw-alias-label-secondary);flex-direction:column;gap:4px;font-size:12px;display:flex}.THcKMW_voiceSettings input,.THcKMW_voiceSettings select{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:6px 8px;font-size:13px}.THcKMW_voiceSave{background:var(--dsw-alias-brand-primary);color:#fff;cursor:pointer;border:none;border-radius:6px;align-self:flex-start;padding:7px 14px;font-size:13px}.THcKMW_voiceHint{color:var(--dsw-alias-label-secondary);font-size:11px}.THcKMW_voiceSaved{color:var(--dsw-alias-state-success-primary);font-size:12px}.THcKMW_voiceRow{align-items:center;gap:8px;display:flex}.THcKMW_voiceRow select{flex:1}.THcKMW_voiceAction{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);cursor:pointer;white-space:nowrap;border-radius:6px;padding:6px 10px;font-size:12px}.THcKMW_voiceAction:disabled{opacity:.5;cursor:default}.THcKMW_voiceBar{background:var(--dsw-alias-bg-layer-2);border-radius:3px;height:6px;overflow:hidden}.THcKMW_voiceBar>div{background:var(--dsw-alias-brand-primary);height:100%;transition:width .4s}.THcKMW_voiceDlInfo{color:var(--dsw-alias-label-secondary);font-size:11px}.THcKMW_voiceAdvanced{flex-direction:column;gap:8px;margin-top:4px;display:flex}.THcKMW_voiceAdvancedBody{flex-direction:column;gap:12px;display:flex}.THcKMW_voiceHintErr{color:var(--dsw-alias-state-error-primary);font-size:11px}";
		const tagId = "dsh-voice/voice.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-voice";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var voice_module_css_default = {
			"voiceSettings": "THcKMW_voiceSettings",
			"voiceSave": "THcKMW_voiceSave",
			"voiceSpin": "THcKMW_voiceSpin",
			"voiceAdvancedBody": "THcKMW_voiceAdvancedBody",
			"voiceHint": "THcKMW_voiceHint",
			"voiceStatusErr": "THcKMW_voiceStatusErr",
			"voicePillBtn": "THcKMW_voicePillBtn",
			"voiceSaved": "THcKMW_voiceSaved",
			"voiceRow": "THcKMW_voiceRow",
			"voiceDlInfo": "THcKMW_voiceDlInfo",
			"voiceHintErr": "THcKMW_voiceHintErr",
			"voiceField": "THcKMW_voiceField",
			"voicePillCancel": "THcKMW_voicePillCancel",
			"voicePillSend": "THcKMW_voicePillSend",
			"voiceAction": "THcKMW_voiceAction",
			"voiceMic": "THcKMW_voiceMic",
			"voiceStatus": "THcKMW_voiceStatus",
			"voiceErrText": "THcKMW_voiceErrText",
			"voiceWave": "THcKMW_voiceWave",
			"voicePill": "THcKMW_voicePill",
			"voicePillStop": "THcKMW_voicePillStop",
			"voiceBar": "THcKMW_voiceBar",
			"voiceAdvanced": "THcKMW_voiceAdvanced"
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
		/** The mic button next to the send button. */
		function MicButton(props) {
			const v = useVoiceState();
			const st = getVoiceState();
			if (props.inputActions) st.inputActions = props.inputActions;
			if (props.input) st.input = props.input;
			if (v.phase !== "idle") return null;
			return react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceMic,
				title: "Voice input",
				onClick: startRecording
			}, react.createElement(MicIcon));
		}
		/** The recording pill above the composer. */
		function RecordPill(props) {
			const v = useVoiceState();
			const canvasRef = react.useRef(null);
			const st = getVoiceState();
			if (props.inputActions) st.inputActions = props.inputActions;
			if (props.input) st.input = props.input;
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
				apiCall("/api/voice/config", cfg).then(() => {
					setSaved("Saved ✓");
					refreshCodex();
					window.setTimeout(() => setSaved(""), 2e3);
				}).catch(() => setSaved("Save failed"));
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
			}, react.createElement("option", { value: "auto" }, "Auto"), react.createElement("option", { value: "ru" }, "Russian"), react.createElement("option", { value: "en" }, "English"), react.createElement("option", { value: "uk" }, "Ukrainian"), react.createElement("option", { value: "de" }, "German"))), react.createElement("div", { className: voice_module_css_default.voiceRow }, react.createElement("button", {
				type: "button",
				className: voice_module_css_default.voiceSave,
				onClick: save
			}, "Save"), saved ? react.createElement("span", { className: voice_module_css_default.voiceSaved }, saved) : null), react.createElement("div", { className: voice_module_css_default.voiceHint }, "dsh-voice v" + (cfg.version ?? "?")));
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
		}
		//#endregion
		exports.MicButton = MicButton;
		exports.RecordPill = RecordPill;
		exports.VoiceSettings = VoiceSettings;
		exports.apply = apply;
		exports.cancelRecording = cancelRecording;
		exports.getVoiceState = getVoiceState;
		exports.inject = inject;
		exports.startRecording = startRecording;
		exports.stopWith = stopWith;
		exports.subscribeVoice = subscribeVoice;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map