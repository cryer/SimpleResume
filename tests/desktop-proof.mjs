// Release WebView2 and real XeLaTeX, with an isolated draft (Windows only).
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve, delimiter } from 'node:path'
import { setTimeout as wait } from 'node:timers/promises'
import { createServer } from 'node:net'
import assert from 'node:assert/strict'
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs'

const socket = createServer()
await new Promise(r => socket.listen(0, '127.0.0.1', r))
const port = socket.address().port
await new Promise(r => socket.close(r))
await mkdir('test-results', { recursive: true })
const profile = await mkdtemp(resolve('test-results', 'desktop-'))
const app = spawn(resolve(process.env.RESUME_PROOF_EXE || 'src-tauri/target/release/resume-studio.exe'), [], {env: {
  ...process.env, PATH:resolve('.local-tex/TinyTeX/bin/windows') + delimiter + process.env.PATH,
  WEBVIEW2_USER_DATA_FOLDER:profile, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`
}})
let browser
try {
  for (let i=0;i<60 && !browser;i++) {
    try {browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{timeout:700})} catch {await wait(250)}
  }
  assert(browser, 'WebView2 did not start')
  const ctx=browser.contexts()[0], page=ctx.pages()[0] || await ctx.waitForEvent('page')
  page.on('console', msg => {if(/warn|error/.test(msg.type())) console.warn(msg.text())})
  const canvas=page.locator('canvas'); await canvas.waitFor({timeout:35000})
  // Reach the real ACL-gated download command without creating a file or revealing it.
  const rejected=await page.evaluate(async()=>{
    try {await window.__TAURI_INTERNALS__.invoke('download_pdf',new Uint8Array([0]),{headers:{'x-resume-name':'proof'}}); return ''}
    catch(e){return String(e)}
  })
  assert.match(rejected,/PDF 数据无效或过大/)
  const original=await canvas.elementHandle()
  await page.getByLabel('全局字体').selectOption('kai')
  await page.getByLabel('第 1 节图标').selectOption('portfolio')
  const name=page.getByLabel('姓名',{exact:true})
  await name.fill('林一 张明 王小雨'); await name.press('End')
  await page.getByRole('button',{name:'插入 ★',exact:true}).click()
  assert.match(await name.inputValue(),/★$/)
  const lines=page.getByLabel('分隔线',{exact:true}); await lines.uncheck()
  // Wait for replacement, not just the previous successful page.
  await page.waitForFunction(old=>document.querySelector('canvas') && document.querySelector('canvas')!==old,original,{timeout:35000})
  // No dividers. Even a successfully painted, blank white canvas must fail.
  const subtitle=page.getByLabel('副标题',{exact:true}), dest='https://example.org/demo?v=1&lang=zh#work'
  await subtitle.fill('作品集 42%'); await subtitle.focus()
  await subtitle.evaluate(el=>el.setSelectionRange(4,7)); await page.getByRole('button',{name:'指标强调'}).click()
  await subtitle.evaluate(el=>el.setSelectionRange(0,3)); await page.getByLabel('选区链接地址').fill(dest)
  await page.getByRole('button',{name:'设置链接'}).click()
  const body=page.getByLabel('第 1 节正文',{exact:true})
  await body.fill('Baseline\nIndented'); await body.press('Control+End')
  await page.getByRole('spinbutton',{name:'左缩进',exact:true}).fill('40')
  await page.waitForFunction(() => document.querySelector('.preview-state.ready'))
  // Read the current export source; never write to Downloads or launch Explorer in CI.
  const exportButton=page.getByRole('button',{name:'下载 PDF',disabled:false})
  await exportButton.waitFor({timeout:12000}).catch(async err=>{throw Error(`${err.message}\n${await page.locator('body').innerText()}`)})
  const bytes=await exportButton.evaluate(async el=>Array.from(new Uint8Array(await (await fetch(el.dataset.previewUrl)).arrayBuffer())))
  const pdf=await getDocument({data:Uint8Array.from(bytes),cMapUrl:resolve('node_modules/pdfjs-dist/cmaps').replaceAll('\\','/')+'/',cMapPacked:true}).promise
  try {
    const sheet=await pdf.getPage(1)
    assert.ok((await sheet.getAnnotations()).some(a=>a.subtype==='Link' && a.url===dest),'exported PDF should contain the exact clickable URL')
    const items=(await sheet.getTextContent()).items
    const position=text=>items.find(item=>item.str?.trim()===text)?.transform[4]
    assert.ok(Math.abs(position('Indented')-position('Baseline')-40*72/72.27)<0.5,'exported second line should be indented by 40 pt')
  } finally {await pdf.destroy()}
  const ink=await page.waitForFunction(() => {
    const c=document.querySelector('canvas');if(!c) return false
    const {data}=c.getContext('2d').getImageData(0,0,c.width,c.height)
    let rows=0, pixels=0
    for(let y=0;y<c.height;y++) {
      let row=0;for(let x=0;x<c.width;x++) {const i=(y*c.width+x)*4;if(data[i+3]>200 && data[i]<120)row++}
      if(row>=4 && row<c.width/2){rows++;pixels+=row}
    }
    return rows>=35 && pixels>=350 ? {rows,pixels} : false
  },null,{timeout:10000,polling:250})
  console.log('Chinese text visible in release PDF canvas:',await ink.jsonValue())
} finally {
  if(browser) await browser.close()
  app.kill();await rm(profile,{recursive:true,force:true,maxRetries:15,retryDelay:300})
}
