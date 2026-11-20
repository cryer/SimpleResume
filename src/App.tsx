import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { flushSync } from 'react-dom'
import { fonts, icons, initialDoc, parseDoc, type Font } from './model'
import { usePreview } from './preview'
import PdfDownload from './PdfDownload'
import {lazy, Suspense} from 'react'
import { iconNames, iconPaths, symbols } from './catalog'
import { FormattedField, rangeOf, textareaText, type TextField } from './FormattedField'
import { rebaseMarks, type Mark } from './marks'
import { rebaseLines, type LineStyle } from './lines'
import './app.css'
const PdfProof = lazy(() => import('./PdfProof'))

type Doc = ReturnType<typeof parseDoc>
const draftKey = 'jianli-studio:draft:v1'
const fontNames: Record<Font, string> = { serif: '宋体', sans: '黑体', kai: '楷体' }
function loadDraft(): { doc: Doc; note: string } {
  try {
    const raw = localStorage.getItem(draftKey)
    return raw === null ? { doc: initialDoc, note: '本地草稿' } : { doc: parseDoc(JSON.parse(raw)), note: '已恢复本地草稿' }
  } catch {
    return { doc: initialDoc, note: '无法读取草稿，已打开示例' }
  }
}

export default function App() {
  const [start] = useState(loadDraft)
  const [doc, setDoc] = useState<Doc>(start.doc)
  const [saveNote, setSaveNote] = useState(start.note)
  const [message, setMessage] = useState('')
  const picker = useRef<HTMLInputElement>(null)
  const preview = usePreview(doc)
  const filename = doc.name.trim().replace(/[\\/:*?"<>|]/g, '_') || '我的简历'

  useEffect(() => {
    if (doc === start.doc) return
    const save = () => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(doc))
        setSaveNote('已保存到本机')
      } catch { setSaveNote('自动保存失败，请导出项目') }
    }
    setSaveNote('正在保存…')
    const timeout = window.setTimeout(save, 250)
    window.addEventListener('pagehide', save)
    return () => { window.clearTimeout(timeout); window.removeEventListener('pagehide', save) }
  }, [doc, start.doc])

  const [target, setTarget] = useState<TextField | null>(null)
  const sectionId = target?.closest('article')?.dataset.sectionId
  const canInsert = target?.isConnected && (!sectionId || doc.sections.some(section => section.id === sectionId))

  function insertSymbol(symbol: typeof symbols[number]) {
    if (!target?.isConnected || !canInsert) return
    const start = target.selectionStart, end = target.selectionEnd
    if (start === null || end === null) return
    const value = target.value.slice(0, start) + symbol + target.value.slice(end)
    if (value.length > target.maxLength) { setMessage('已达到此字段的字数上限'); return }
    const field = target.dataset.field
    try {
      const selection = rangeOf(target)
      if (field === 'name' || field === 'subtitle') {
        const prior = textareaText(doc[field], doc[`${field}Marks`])
        const marks = rebaseMarks(prior.value, value, prior.marks, selection)
        const lines = rebaseLines(prior.value, value, doc[`${field}Lines`] ?? [], selection)
        flushSync(() => editHeader(field, value, marks, lines))
      } else if (field === 'title' || field === 'body') {
        const section = doc.sections.find(s => s.id === sectionId)
        if (!section) return
        const prior = textareaText(section[field], section[`${field}Marks`])
        const marks = rebaseMarks(prior.value, value, prior.marks, selection)
        const lines = rebaseLines(prior.value, value, section[`${field}Lines`] ?? [], selection)
        flushSync(() => editSection(section.id, { [field]: value, [`${field}Marks`]: marks, [`${field}Lines`]: lines }))
      } else return
    } catch (err) { setMessage(err instanceof Error ? err.message : '无法插入符号'); return }
    target.focus()
    target.setSelectionRange(start + symbol.length, start + symbol.length)
  }
  function editHeader(field: 'name' | 'subtitle', value: string, marks: Mark[], lines: LineStyle[]) {
    setDoc(d => ({...d, [field]: value, [`${field}Marks`]: marks, [`${field}Lines`]: lines}))
  }
  function editSection(id: string, patch: Partial<Omit<Doc['sections'][number], 'id'>>) {
    setDoc(d => ({ ...d, sections: d.sections.map(s => s.id === id ? { ...s, ...patch } : s) }))
  }
  function move(id: string, delta: number) {
    setDoc(d => {
      const i = d.sections.findIndex(s => s.id === id), j = i + delta
      if (i < 0 || j < 0 || j >= d.sections.length) return d
      const sections = [...d.sections]; [sections[i], sections[j]] = [sections[j], sections[i]]
      return { ...d, sections }
    })
  }
  async function importProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('项目文件超过 10 MB')
      const next = parseDoc(JSON.parse((await file.text()).replace(/^\uFEFF/, '')))
      setTarget(null); setDoc(next); setMessage(`已导入 ${file.name}`)
    } catch (err) { setMessage(`导入失败，原稿未更改：${err instanceof Error ? err.message : '无法读取项目'}`) }
  }
  function exportProject() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({version: 1, document: doc}, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `${filename}.json`
    document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="studio">
    <header className="mast"><div className="brand"><span className="emblem" aria-hidden="true">稿</span><div><strong>简历工坊</strong><small>RÉSUMÉ STUDIO</small></div></div>
      <div className="file-tools"><span className="save-note" role="status">{saveNote}</span><input type="file" accept=".json,application/json" hidden ref={picker} onChange={importProject}/><button onClick={() => picker.current?.click()}>导入项目</button><button onClick={exportProject}>保存 JSON</button></div>
    </header>
    <main><div className="intro"><div className="eyebrow">WORKSPACE <span>/</span> 01</div><h1>简历工作台</h1><p>在左侧编辑内容，在右侧核对最终分页与版式。</p></div>
    {message && <div className="notice" role="status">{message}<button aria-label="关闭提示" onClick={() => setMessage('')}>×</button></div>}
    <div className="workspace"><section className="panel editor"><div className="panel-bar"><h2>内容画布</h2><span className="tag">EDITOR</span></div>
      <div className="settings"><label>全局字体 <select value={doc.font} onChange={e => {
        const font = fonts.find(font => font === e.target.value)
        if (font) setDoc(d => ({ ...d, font }))
      }}>{fonts.map(font => <option key={font} value={font}>{fontNames[font]}</option>)}</select></label><label>字号 <select value={doc.size} onChange={e => setDoc({ ...doc, size: Number(e.target.value) })}>{Array.from({ length: 13 }, (_, i) => i + 8).map(n => <option key={n} value={n}>{n} pt</option>)}</select></label><label><input type="checkbox" checked={doc.bold} onChange={e => setDoc({ ...doc, bold: e.target.checked })}/> 标题加粗</label><label><input type="checkbox" checked={doc.divider} onChange={e => setDoc({ ...doc, divider: e.target.checked })}/> 分隔线</label></div>
      <div className="symbols" role="group" aria-label="插入符号"><span>插入符号</span>{symbols.map(symbol => <button key={symbol} disabled={!canInsert} aria-label={`插入 ${symbol}`} onMouseDown={e => e.preventDefault()} onClick={() => insertSymbol(symbol)}>{symbol}</button>)}{!canInsert && <small>先点击要编辑的文字</small>}</div>
      <div className={`sheet font-${doc.font} ${doc.bold ? 'bold' : ''} ${doc.divider ? 'ruled' : ''}`}><div className="eyebrow">PROFILE <span>/</span> 个人信息</div>{(['name', 'subtitle'] as const).map(field => <FormattedField key={field} field={field} label={field === 'name' ? '姓名' : '副标题'} value={doc[field]} marks={doc[`${field}Marks`]} lines={doc[`${field}Lines`]} size={doc.size} active={target?.dataset.field === field} onFocus={setTarget} onUpdate={(value, marks, lines) => editHeader(field, value, marks, lines)}/>)}
      {doc.sections.map((section, i) => <article data-section-id={section.id} key={section.id} className="entry"><div className="entry-bar"><span className="eyebrow">SECTION {String(i+1).padStart(2,'0')}</span><div className="actions"><button aria-label={`上移第 ${i+1} 节`} title="上移" disabled={i === 0} onClick={() => move(section.id,-1)}>↑</button><button aria-label={`下移第 ${i+1} 节`} title="下移" disabled={i+1 === doc.sections.length} onClick={() => move(section.id,1)}>↓</button><button aria-label={`删除第 ${i+1} 节`} onClick={() => setDoc(d => ({ ...d, sections: d.sections.filter(s => s.id !== section.id) }))}>删除</button></div></div>
        <label className="icon-picker">章节图标 <select aria-label={`第 ${i+1} 节图标`} value={section.icon} onChange={e => {
          const icon = icons.find(icon => icon === e.target.value)
          if (icon) editSection(section.id, { icon })
        }}>{icons.map(icon => <option key={icon} value={icon}>{iconNames[icon]}</option>)}</select></label>
        {(['title', 'body'] as const).map(field => <FormattedField key={field} field={field} label={`第 ${i+1} 节${field === 'title' ? '标题' : '正文'}`} value={section[field]} marks={section[`${field}Marks`]} lines={section[`${field}Lines`]} size={doc.size}
          active={target?.dataset.field === field && sectionId === section.id} onFocus={setTarget}
          onUpdate={(value, marks, lines) => editSection(section.id, { [field]: value, [`${field}Marks`]: marks, [`${field}Lines`]: lines })}
          icon={section.icon !== 'none' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={`${iconNames[section.icon]}图标`}><path d={iconPaths[section.icon]}/></svg>}/>)}</article>)}
      <button className="add" disabled={doc.sections.length >= 64} onClick={() => setDoc(d => ({ ...d, sections: [...d.sections, { id: crypto.randomUUID(), icon: 'none', title: '新章节', body: '' }] }))}>＋ 添加章节</button></div>
    </section><section className="panel proof"><div className="panel-bar"><h2>排版预览</h2><span className="tag">PDF PROOF</span></div><div className="proof-tools"><span className={`preview-state ${preview.ready ? 'ready' : ''}`} role="status">{preview.status}</span><PdfDownload ready={preview.ready} url={preview.url} filename={filename}/></div><div className="viewer">{preview.url ? <Suspense fallback={<p>正在加载校样…</p>}><PdfProof url={preview.url}/></Suspense> : <div className="empty"><div className="page-art" aria-hidden="true"><i/><i/><i/></div><strong>等待 PDF 预览</strong><p>排版成功后将在此显示。</p></div>}</div><footer>校样视图 · 导出以当前 PDF 为准</footer></section></div></main>
  </div>
}
