import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { applyStyle, rebaseMarks, safeLink, type Mark, type Style } from './marks'
import { rebaseLines, selectedLines, setLines, type LineStyle } from './lines'

export type TextField = HTMLInputElement | HTMLTextAreaElement
export type Selection = {start: number; end: number}
export const rangeOf = (el: TextField): Selection => ({ start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 })
export type FieldKey = 'name' | 'subtitle' | 'title' | 'body'
const limits = { name: 160, subtitle: 512, title: 160, body: 20000 }
const placeholders = { name: '你的姓名', subtitle: '求职方向 · 联系方式', title: '章节标题', body: '写下经历、成果或技能…' }
const classes = { name: 'person', subtitle: 'subtitle', title: 'section-title', body: '' }
type Props = {
  field: FieldKey; label: string; value: string; marks?: Mark[]; lines?: LineStyle[]; size: number; icon?: ReactNode
  active: boolean; onFocus: (el: TextField) => void; onUpdate: (value: string, marks: Mark[], lines: LineStyle[]) => void
}
// Textareas expose LF offsets even when a project was saved with CRLF.
export function textareaText(raw: string, marks: Mark[] = []) {
  if (!raw.includes('\r')) return { value: raw, marks }
  const normalize = (s: string) => s.replace(/\r\n?/g, '\n')
  const offset = (n: number) => normalize(raw.slice(0, n)).length
  return { value: normalize(raw), marks: marks.map(m => ({...m, start: offset(m.start), end: offset(m.end)})).filter(m => m.start < m.end) }
}
function markedText(mark: Mark, text: string) {
  const style: CSSProperties = { fontSize: mark.size ? `${mark.size}pt` : undefined,
    fontFamily: mark.font ? 'var(--doc-font)' : undefined, fontWeight: mark.bold === undefined ? undefined : mark.bold ? 700 : 400 }
  const attrs = { style, className: [mark.font && `font-${mark.font}`, mark.metric && 'metric'].filter(Boolean).join(' ') }
  return mark.link && safeLink(mark.link)
    ? <a key={mark.start} {...attrs} href={mark.link} target="_blank" rel="noopener noreferrer">{text}</a>
    : <span key={mark.start} {...attrs}>{text}</span>
}
function Reading({ value, marks, lines }: {value: string; marks: Mark[]; lines: LineStyle[]}) {
  const styles = new Map(lines.map(style => [style.line, style]))
  let offset = 0, m = 0
  return <div className="live-reading" aria-label="即时样式预览">{value.split('\n').map((text, index) => {
    const end = offset + text.length, parts: ReactNode[] = []
    let at = offset
    while (m < marks.length && marks[m].end <= at) m++
    for (let i = m; i < marks.length && marks[i].start < end; i++) {
      const mark = marks[i], start = Math.max(at, mark.start)
      parts.push(value.slice(at, start), markedText(mark, value.slice(start, Math.min(mark.end, end))))
      at = Math.min(mark.end, end)
    }
    parts.push(value.slice(at, end)); offset = end + 1
    const style = styles.get(index)
    return <div className="reading-line" key={index} style={{paddingInlineStart: `${style?.indent ?? 0}pt`,
      marginBottom: `${style?.after ?? 0}pt`, lineHeight: (style?.leading ?? 140) / 100}}>{text ? parts : <br/>}</div>
  })}</div>
}
const lineControls = [
  {key: 'indent', label: '左缩进', unit: 'pt', min: 0, max: 144, base: 0},
  {key: 'after', label: '段后', unit: 'pt', min: 0, max: 72, base: 0},
  {key: 'leading', label: '行距', unit: '%', min: 80, max: 250, base: 140},
] as const

function LineNumber({label, unit, min, max, current, change}: {label: string; unit: string; min: number; max: number; current: number | ''; change: (n: number) => void}) {
  const [draft, setDraft] = useState(String(current))
  useEffect(() => setDraft(String(current)), [current])
  return <label>{label} ({unit})<input type="number" min={min} max={max} aria-label={label} placeholder="混合" value={draft}
    onChange={e => {
      const input = e.currentTarget
      setDraft(input.value)
      if (input.value !== '' && input.validity.valid) change(input.valueAsNumber)
    }} onBlur={() => setDraft(String(current))} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}/></label>
}

export function FormattedField({field, label, value: raw, marks: rawMarks, lines = [], size, icon, active, onFocus, onUpdate}: Props) {
  const {value, marks} = useMemo(() => textareaText(raw, rawMarks), [raw, rawMarks])
  const el = useRef<TextField | null>(null)
  const before = useRef<(Selection & {value: string}) | undefined>(undefined)
  const [range, setRange] = useState<Selection>({start: 0, end: 0})
  const selected = range.start !== range.end
  const [from, to] = selectedLines(value, range.start, range.end)
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const sync = (node: TextField) => {
    const next = rangeOf(node)
    setRange(r => r.start === next.start && r.end === next.end ? r : next)
  }
  useEffect(() => {
    const node = el.current
    if (!active || !node) return
    const update = () => { sync(node); before.current = {...rangeOf(node), value: node.value} }
    node.addEventListener('select', update)
    return () => node.removeEventListener('select', update)
  }, [active])
  const remember = (node: TextField) => { before.current = {...rangeOf(node), value: node.value} }
  function format(patch: Parameters<typeof applyStyle>[4]) {
    if (!el.current || !active) return
    const {start, end} = rangeOf(el.current)
    if (start >= end || end > value.length) { setError('请先选中要设置的文字'); return }
    try {
      if (patch?.link && !safeLink(patch.link)) throw Error('链接无效，请检查地址')
      onUpdate(value, applyStyle(value, marks, start, end, patch), lines)
      setError(''); el.current.focus(); el.current.setSelectionRange(start, end)
    } catch (err) { setError(err instanceof Error ? err.message : '无法设置选区格式') }
  }
  function layout(patch: Parameters<typeof setLines>[4]) {
    if (!el.current || !active) return
    try {
      const {start, end} = rangeOf(el.current)
      const [first, last] = selectedLines(value, start, end)
      onUpdate(value, marks, setLines(value, lines, first, last, patch)); setError('')
    } catch (err) { setError(err instanceof Error ? err.message : '无法设置行布局') }
  }
  const props = {
    ref: (node: TextField | null) => { el.current = node }, 'data-field': field, className: classes[field], maxLength: limits[field],
    'aria-label': label, placeholder: placeholders[field], value,
    onFocus: (e: React.FocusEvent<TextField>) => { onFocus(e.currentTarget); sync(e.currentTarget) },
    onSelect: (e: React.SyntheticEvent<TextField>) => { sync(e.currentTarget); remember(e.currentTarget) },
    onKeyDown: (e: React.KeyboardEvent<TextField>) => remember(e.currentTarget),
    onBeforeInput: (e: React.FormEvent<TextField>) => remember(e.currentTarget),
    onPaste: (e: React.ClipboardEvent<TextField>) => remember(e.currentTarget),
    onCut: (e: React.ClipboardEvent<TextField>) => remember(e.currentTarget),
    onChange: (e: React.ChangeEvent<TextField>) => {
      const next = e.currentTarget.value, prior = before.current
      before.current = undefined
      let range: Selection | undefined = prior?.value === value ? prior : undefined
      const removed = value.length - next.length, operation = (e.nativeEvent as InputEvent).inputType ?? ''
      if (range && range.start === range.end && removed > 0) {
        if (operation.endsWith('Backward')) range = {start: range.start - removed, end: range.end}
        if (operation.endsWith('Forward')) range = {start: range.start, end: range.end + removed}
      }
      try { onUpdate(next, rebaseMarks(value, next, marks, range), rebaseLines(value, next, lines, range)); setError('') }
      catch (err) { setError(err instanceof Error ? err.message : '编辑超出格式限制，原文未变') }
      sync(e.currentTarget)
    }
  }
  return <div className={`format-field field-${field}`}>
    <div className={field === 'title' ? 'entry-heading' : undefined}>{field === 'title' && icon}<textarea {...props}
      style={field === 'body' ? {fontSize: `${size}pt`} : undefined}
      rows={Math.min(10, Math.max(field === 'body' ? 3 : 1, value.split('\n').length))}/></div>
    {active && <div className="format-panel">
      <div className="format-hint">选区格式 · {selected ? '仅作用于选中的文字' : '拖动或使用 Shift + 方向键选择文字'}</div>
      <fieldset className="format-tools" disabled={!selected} aria-label="设置选区格式">
        <button onClick={() => format({bold: true})}>加粗</button>
        <button onClick={() => format({bold: false})}>常规字重</button>
        <select aria-label="选区字体" value="" onChange={e => format({font: e.target.value as Style['font']})}><option value="" disabled>字体</option><option value="serif">宋体</option><option value="sans">黑体</option><option value="kai">楷体</option></select>
        <select aria-label="选区字号" value="" onChange={e => format({size: Number(e.target.value)})}><option value="" disabled>字号</option>{Array.from({length: 25}, (_, i) => i + 8).map(n => <option key={n} value={n}>{n} pt</option>)}</select>
        <button onClick={() => format({metric: true, bold: true})}>指标强调</button>
        <button onClick={() => format(null)}>清除格式</button>
        <input aria-label="选区链接地址" placeholder="https://…" maxLength={512} value={link} onChange={e => setLink(e.target.value)}/>
        <button disabled={!link.trim()} onClick={() => format({link: link.trim()})}>设置链接</button>
        <button onClick={() => format({link: null})}>移除链接</button>
      </fieldset>
      <fieldset className="line-tools"><legend>行布局 · {from === to ? '当前行' : '所选行'}</legend>
        {lineControls.map(({key, label, unit, min, max, base}) => {
          const chosen = lines.filter(line => line.line >= from && line.line <= to)
          const values = new Set(chosen.map(line => line[key] ?? base))
          if (chosen.length < to - from + 1) values.add(base)
          const current = values.size === 1 ? [...values][0] : ''
          return <LineNumber key={[key,from,to].join(':')} {...{label,unit,min,max,current}} change={n => layout({[key]: n})}/>
        })}
        <button onClick={() => layout(null)}>恢复默认行布局</button>
      </fieldset>
      {error && <small role="alert">{error}</small>}
      <div className="reading-label">即时样式</div><div style={field === 'body' ? {fontSize: `${size}pt`} : undefined}><Reading value={value} marks={marks} lines={lines}/></div>
    </div>}
  </div>
}
