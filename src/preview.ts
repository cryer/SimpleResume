import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { invoke, isTauri } from '@tauri-apps/api/core'
import type { Doc } from './model'
import { LatestQueue } from './queue'

export function usePreview(doc: Doc) {
  const [preview, setPreview] = useState<{ doc: Doc; url: string } | null>(null)
  const [status, setStatus] = useState('等待排版')
  const urlRef = useRef<string | null>(null)
  const queue = useMemo(() => new LatestQueue<Doc, number[]>(
    input => invoke('render_pdf', {doc: input}),
    (input, bytes) => {
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], {type: 'application/pdf'}))
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = url; setPreview({doc: input, url}); setStatus('预览已同步')
    }, error => setStatus(`排版失败：${String(error)}`)
  ), [])
  useLayoutEffect(() => {
    const rev = queue.invalidate()
    if (!isTauri()) { setStatus('浏览器编辑模式 · 请启动桌面版生成 PDF'); return }
    setStatus('等待排版')
    const timer = setTimeout(() => {setStatus('正在排版'); void queue.submit(doc, rev)}, 250)
    return () => {clearTimeout(timer); queue.invalidate()}
  }, [doc, queue])
  useLayoutEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])
  return {url: preview?.url ?? null, ready: preview?.doc === doc, status}
}
