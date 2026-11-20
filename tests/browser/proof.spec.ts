import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'

test('PDF.js paints both Chinese glyphs above the divider; export matches the proof',async({page})=>{
  const bytes = [...await readFile('tests/fixtures/chinese-proof.pdf')]
  await page.addInitScript((bytes) => Object.assign(window,{isTauri:true,__TAURI_INTERNALS__:{invoke: async (cmd:string,args:any,options:any) => {
    if(cmd==='render_pdf') { if(args.doc.name==='失败') throw Error('编译失败'); return bytes }
    if(cmd!=='download_pdf') throw Error(`unexpected IPC: ${cmd}`)
    Object.assign(window,{saved:{bytes:Array.from(new Uint8Array(args)),name:decodeURIComponent(options.headers['x-resume-name'])}})
    return {path:'Downloads/证明.pdf',revealed:false}
  }}}), bytes)
  await page.goto('/')
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible({timeout:20000})
  // The XeLaTeX fixture contains just “中文” and a horizontal rule. Sample
  // each glyph independently, in page coordinates that exclude the rule.
  const ink = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')!
    return [12,34].map(left => {
      const scale = el.width / 120
      const {data} = ctx.getImageData(Math.round(left*scale),Math.round(12*scale),Math.round(22*scale),Math.round(28*scale))
      let dark = 0
      for (let i=0;i<data.length;i+=4) if (data[i]<128 && data[i+3]>200) dark++
      return dark
    })
  })
  for (const dark of ink) expect(dark).toBeGreaterThan(70)
  const button=page.getByRole('button',{name:'下载 PDF'})
  await button.click()
  await expect(page.getByText('已保存，未能打开文件管理器：Downloads/证明.pdf')).toBeVisible()
  expect(await page.evaluate(()=>(window as any).saved)).toEqual({bytes,name:await page.getByLabel('姓名',{exact:true}).inputValue()})
  // Hold the blob read across an edit: the old export must never reach native IPC.
  await page.evaluate(()=>{
    const original=window.fetch
    Object.assign(window,{saved:null,fetch:async (...args:Parameters<typeof fetch>)=>{
      const response=await original(...args)
      await new Promise(resolve=>Object.assign(window,{releaseRead:resolve}))
      return response
    }})
  })
  await button.click()
  await page.waitForFunction(()=>!!(window as any).releaseRead)
  await page.getByLabel('姓名',{exact:true}).fill('失败'); await expect(page.getByRole('button',{name:'下载 PDF'})).toBeDisabled()
  await page.evaluate(()=>(window as any).releaseRead())
  await expect(page.getByText(/排版失败/)).toBeVisible();await expect(canvas).toBeVisible()
  expect(await page.evaluate(()=>(window as any).saved)).toBeNull()
})

test('browser fallback downloads the current blob via its anchor',async({page})=>{
  const bytes=[...await readFile('tests/fixtures/chinese-proof.pdf')]
  // Supply a renderer once, then present its completed result without a native host.
  await page.addInitScript(bytes=>Object.assign(window,{isTauri:true,__TAURI_INTERNALS__:{invoke:async()=>{Object.assign(window,{isTauri:false});return bytes}}}),bytes)
  await page.goto('/')
  const downloading=page.waitForEvent('download');await page.getByRole('link',{name:'下载 PDF'}).click()
  expect(await readFile((await (await downloading).path())!)).toEqual(Buffer.from(bytes))
})
