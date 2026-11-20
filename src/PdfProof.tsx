import {useEffect, useRef, useState} from 'react'
import {getDocument, GlobalWorkerOptions, type RenderTask} from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
GlobalWorkerOptions.workerSrc = workerUrl

/** Keep the previous canvas visible until the selected new page is painted. */
export default function PdfProof({url}:{url:string}) {
  const surface = useRef<HTMLDivElement>(null)
  const [page,setPage] = useState(1), [count,setCount] = useState(1), [error,setError] = useState('')
  useEffect(() => {
    let live = true, render: RenderTask | undefined
    // Resolve against the app, not the PDF blob or the worker bundle.
    const assets = new URL(`${import.meta.env.BASE_URL}pdfjs-resources/`, document.baseURI).href
    const task = getDocument({
      url, cMapUrl: `${assets}cmaps/`, cMapPacked: true,
      standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/`,
      iccUrl: `${assets}iccs/`, useSystemFonts: false,
    })
    async function paint() {
      const pdf = await task.promise
      if (!live) return
      setCount(pdf.numPages)
      if (page > pdf.numPages) {setPage(pdf.numPages); return}
      const sheet = await pdf.getPage(page)
      if (!live) return
      const viewport = sheet.getViewport({scale: 1.6}), canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
      canvas.style.cssText = 'display:block;width:100%;height:auto;background:white'; canvas.setAttribute('aria-label',`PDF 第 ${page} 页`)
      render = sheet.render({canvas,viewport}); await render.promise
      if (live) {surface.current?.replaceChildren(canvas); setError('')}
    }
    void paint().catch(() => {if(live) setError('校样显示失败，可下载当前 PDF 检查。')})
    return () => {live = false; render?.cancel(); void task.destroy()}
  },[url,page])
  return <div style={{width:'100%',alignSelf:'start'}}><nav aria-label="PDF 翻页"><button disabled={page<=1} onClick={()=>setPage(page-1)}>上一页</button> {page} / {count} <button disabled={page>=count} onClick={()=>setPage(page+1)}>下一页</button></nav>{error && <p role="alert">{error}</p>}<div ref={surface}/></div>
}
