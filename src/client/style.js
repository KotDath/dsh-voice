// Package stylesheet, keyed off the DSH theme tokens so light/dark themes work
// without touching product DOM.
styles.insert(`
.voice-mic { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--dsw-alias-border-l1); background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; padding: 0; box-sizing: border-box; }
.voice-mic:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.voice-pill { display: flex; align-items: center; gap: 10px; height: 52px; border-radius: 26px; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); padding: 0 14px; width: 100%; max-width: 720px; margin: 0 auto; box-shadow: 0 8px 24px rgba(0,0,0,0.18); box-sizing: border-box; }
.voice-pill-btn { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; padding: 0; flex: none; box-sizing: border-box; }
.voice-pill-cancel { border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary); }
.voice-pill-cancel:hover { background: var(--dsw-alias-bg-layer-2); }
.voice-pill-stop { border: none; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.voice-pill-stop:hover { filter: brightness(1.15); }
.voice-pill-send { border: none; background: var(--dsw-alias-label-primary); color: var(--dsw-alias-bg-base); }
.voice-pill-send:hover { opacity: 0.9; }
.voice-wave { flex: 1; height: 40px; width: 100%; color: var(--dsw-alias-label-primary); }
.voice-status { display: flex; align-items: center; gap: 10px; color: var(--dsw-alias-label-secondary); font-size: 13px; }
.voice-status-err { color: var(--dsw-alias-state-error-primary); }
.voice-err-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.voice-spin { animation: voice-spin 1s linear infinite; }
@keyframes voice-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.voice-settings { display: flex; flex-direction: column; gap: 12px; max-width: 560px; padding: 8px 0; }
.voice-settings .voice-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.voice-settings input, .voice-settings select { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-primary); border-radius: 6px; padding: 6px 8px; font-size: 13px; }
.voice-save { align-self: flex-start; background: var(--dsw-alias-brand-primary); color: #fff; border: none; border-radius: 6px; padding: 7px 14px; font-size: 13px; cursor: pointer; }
.voice-hint { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.voice-saved { font-size: 12px; color: var(--dsw-alias-state-success-primary); }
.voice-row { display: flex; gap: 8px; align-items: center; }
.voice-row select { flex: 1; }
.voice-action { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-primary); border-radius: 6px; padding: 6px 10px; font-size: 12px; cursor: pointer; white-space: nowrap; }
.voice-action:disabled { opacity: 0.5; cursor: default; }
.voice-bar { height: 6px; border-radius: 3px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.voice-bar > div { height: 100%; background: var(--dsw-alias-brand-primary); transition: width 0.4s; }
.voice-dl-info { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.voice-advanced { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.voice-advanced-body { display: flex; flex-direction: column; gap: 12px; }
`)
