// Build the two-glyph regression input locally; do not redistribute embedded TeX fonts.
import {execFileSync} from 'node:child_process'
import {copyFileSync, mkdtempSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'
const dir=mkdtempSync(join(tmpdir(),'simpleresume-proof-'))
try {
  copyFileSync(fileURLToPath(new URL('chinese-proof.tex',import.meta.url)),join(dir,'chinese-proof.tex'))
  execFileSync('xelatex',['-no-shell-escape','-interaction=nonstopmode','-halt-on-error','chinese-proof.tex'],{cwd:dir,timeout:60000,stdio:'inherit'})
  copyFileSync(join(dir,'chinese-proof.pdf'),fileURLToPath(new URL('chinese-proof.pdf',import.meta.url)))
} finally { rmSync(dir,{recursive:true,force:true}) }
