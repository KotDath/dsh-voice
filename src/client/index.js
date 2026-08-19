// Client plugin entry. Flat Cordis function body; the BODY marker is replaced
// at build time by scripts/build-plugin.mjs with the concatenated client modules.
return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    /* __BODY__ */
  },
}
