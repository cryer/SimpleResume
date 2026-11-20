import {cpSync, mkdirSync, rmSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {createRequire} from 'node:module'
import {defineConfig} from 'vite'

// PDF.js constructs filenames at runtime: keep its packed assets (and license
// notices) together at stable local URLs in both Vite dev and Tauri builds.
const pdfjs = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'))
export default defineConfig({
  plugins: [{
    name: 'local-pdfjs-resources',
    configResolved({publicDir}) {
      const dest = join(publicDir, 'pdfjs-resources')
      rmSync(dest, {recursive:true, force:true})
      mkdirSync(dest, {recursive:true})
      for (const name of ['cmaps','standard_fonts','wasm','iccs','LICENSE']) {
        cpSync(join(pdfjs, name), join(dest, name), {recursive:true})
      }
    },
  }],
})
