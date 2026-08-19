// Host plugin entry. Flat Cordis function body; the BODY marker is replaced at
// build time by scripts/build-plugin.mjs with the concatenated host modules.
return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const shell = ctx.get('shell')
    const sandboxPolicy = ctx.get('sandboxPolicy')
    if (!fs || !shell || !sandboxPolicy) return

    /* __BODY__ */
  },
}
