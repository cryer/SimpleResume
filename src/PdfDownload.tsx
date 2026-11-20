import {useLayoutEffect, useRef, useState} from 'react'
import {invoke, isTauri} from '@tauri-apps/api/core'

type Props = {ready: boolean; url: string | null; filename: string}
type Receipt = {path: string; revealed: boolean}

export default function PdfDownload({ready, url, filename}: Props) {
  const generation = useRef(0), locked = useRef(false)
  const [busy, setBusy] = useState(false), [note, setNote] = useState('')
  useLayoutEffect(() => () => { generation.current++ }, [ready, url, filename])

  async function download() {
    if (!ready || !url || locked.current) return
    const revision = generation.current
    locked.current = true; setBusy(true); setNote('')
    try {
      const bytes = await (await fetch(url)).arrayBuffer()
      // Reading a blob yields to edits/new previews. Commit only if still current.
      if (revision !== generation.current) return
      const receipt = await invoke<Receipt>('download_pdf', bytes, {
        headers: {'x-resume-name': encodeURIComponent(Array.from(filename).slice(0,64).join(''))},
      })
      setNote(`${receipt.revealed ? '已定位' : '已保存，未能打开文件管理器'}：${receipt.path}`)
    } catch (error) {
      if (revision === generation.current) setNote(`下载失败：${String(error)}`)
    } finally {
      locked.current = false; setBusy(false)
    }
  }

  if (!isTauri() && ready && url) return <a className="download" href={url} download={`${filename}.pdf`}>下载 PDF ↓</a>
  return <><button className="download" data-preview-url={ready ? url : undefined} disabled={!ready || !url || busy} onClick={download}>下载 PDF ↓</button>{note && <span role="status" style={{overflowWrap:'anywhere'}}>{note}</span>}</>
}
