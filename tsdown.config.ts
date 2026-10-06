/**
 * Standalone tsdown config for the dsh-voice external plugin — the
 * browser-half counterpart of the in-repo clientBundle preset, kept
 * self-contained so this package builds outside the dsh workspace.
 *
 * Emits two artifacts:
 *  - lib/index.js + lib/invariant.js: the Node half (ESM) the host Loader
 *    mounts (registers the /api/voice/* HTTP endpoints).
 *  - lib/client.js: the browser half (CJS closure bundle) served by the
 *    modules node half into window.__DSH_BOOT__ — a lazy module-table entry
 *    whose externals are exactly the platform seed modules, answered at
 *    runtime by the shell's loader (react family, cordis, ui-slots,
 *    web-react).
 *
 * CSS Modules are compiled by lightningcss inside the bundle: importing
 * `x.module.css` yields the hashed class map, and the css text auto-injects
 * a <style data-plugin="dsh-voice"> tag at factory execution (the loader
 * removes plugin-owned tags on unload).
 */
import { readFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve as resolvePath, sep } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

const PLUGIN_ID = 'dsh-voice'

/** The browser platform seed modules the shell shares into the frozen module table. */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
] as const

const EXTERNALS: readonly string[] = [...PLATFORM_MODULES]

/** Virtual-id wrapper keeping module CSS away from tsdown's own css pipeline. */
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Absolute source file behind every virtual CSS id, for reading and watching. */
const cssSources = new Map<string, string>()

/**
 * Package-relative posix path of a source file. Both lightningcss's module hash
 * and rolldown's region comment are derived from the name a module is given, so
 * an absolute path would make `lib/client.js` differ between checkouts — and
 * fail the CI "committed bundles match src" check — for byte-identical sources.
 */
function stableModuleName(filename: string): string {
  return relative(process.cwd(), filename).split(sep).join('/')
}

export default [
  {
    name: `${PLUGIN_ID}/node`,
    entry: ['src/plugin/index.ts', 'src/plugin/invariant.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
  {
    name: `${PLUGIN_ID}/client`,
    entry: { client: 'src/plugin/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    external: [...EXTERNALS],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    noExternal: (id: string) => (EXTERNALS.includes(id) ? undefined : true),
    plugins: [{
      name: 'dsh-css-modules-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.module.css')) return null
        const abs = importer !== undefined ? resolvePath(dirname(importer), source) : source
        const id = CSS_VIRTUAL_PREFIX + stableModuleName(abs) + CSS_VIRTUAL_SUFFIX
        cssSources.set(id, abs)
        return id
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
        const fileId = cssSources.get(virtualId)
        if (fileId === undefined) return null
        // The virtual id otherwise hides the physical stylesheet from Rolldown's watch graph.
        this.addWatchFile(fileId)
        const source = await readFile(fileId)
        const { code, exports: cssExports } = transform({
          // Package-relative, so the emitted module hash and the region comment
          // are identical in every checkout (see stableModuleName).
          filename: stableModuleName(fileId),
          code: source,
          cssModules: { pattern: '[hash]_[local]' },
          minify: true,
        })
        const classMap: Record<string, string> = {}
        // lightningcss returns its exports in an unspecified order that varies
        // between runs; sorting keeps lib/client.js byte-identical across
        // builds, so a rebuild never dirties the committed bundle by itself.
        const entries = Object.entries(cssExports ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        for (const [local, exp] of entries) classMap[local] = exp.name
        // One <style data-plugin> per module file; a re-evaluated module (live
        // reload, plugin re-mount) replaces stale rules instead of keeping them.
        return [
          `const css = ${JSON.stringify(code.toString())};`,
          `const tagId = ${JSON.stringify(`${PLUGIN_ID}/${basename(fileId)}`)};`,
          'if (typeof document !== \'undefined\') {',
          '  const existing = document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\');',
          '  if (existing === null) {',
          '    const tag = document.createElement(\'style\');',
          `    tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};`,
          '    tag.dataset.pluginCss = tagId;',
          '    tag.textContent = css;',
          '    document.head.appendChild(tag);',
          '  } else if (existing.textContent !== css) {',
          '    existing.textContent = css;',
          '  }',
          '}',
          `export default ${JSON.stringify(classMap)};`,
        ].join('\n')
      },
    }],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
] satisfies UserConfig[]
