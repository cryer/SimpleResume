export const fonts = ['serif', 'sans', 'kai'] as const
import { icons } from './catalog.ts'
import {validateMarks, type Mark} from './marks.ts'
import {validateLines, type LineStyle} from './lines.ts'
export {icons}
function lineStyles<K extends string>(obj:Record<string,unknown>,key:K,text:string):Partial<Record<K,LineStyle[]>> {
  return Object.hasOwn(obj,key) ? {[key]:validateLines(text,obj[key])} as Record<K,LineStyle[]> : {}
}
function styles<K extends string>(obj:Record<string,unknown>,key:K,text:string):Partial<Record<K,Mark[]>> {
  return Object.hasOwn(obj,key) ? {[key]:validateMarks(text,obj[key])} as Record<K,Mark[]> : {}
}
export type Font = typeof fonts[number]
export type SectionIcon = typeof icons[number]
export type Section = { id: string; title: string; body: string; titleMarks?:Mark[]; bodyMarks?:Mark[]; titleLines?:LineStyle[]; bodyLines?:LineStyle[]; icon: SectionIcon }
export type Doc = { name: string; subtitle: string; nameMarks?:Mark[]; subtitleMarks?:Mark[]; nameLines?:LineStyle[]; subtitleLines?:LineStyle[]; font: Font; size: number; bold: boolean; divider: boolean; sections: Section[] }

function enumField<T extends string>(obj: Record<string, unknown>, key: string, values: readonly T[], fallback: T): T {
  if (!Object.hasOwn(obj, key)) return fallback
  const value = values.find(option => option === obj[key])
  if (!value) throw new Error(`无效的简历字段：${key}`)
  return value
}
export const initialDoc: Doc = {
  name: '林一', subtitle: '产品设计师 · 上海', font: 'serif', size: 11, bold: true, divider: true,
  sections: [{ id: 'profile', icon: 'none', title: '个人简介', body: '关注复杂产品的信息设计与用户体验。' }, { id: 'experience', icon: 'none', title: '工作经历', body: '产品设计师｜示例科技\n负责核心产品的交互设计，推动设计系统落地。' }]
}
export function parseDoc(input: unknown): Doc {
  const bad = (): never => { throw new Error('无效的简历文件：请检查字段、字号和章节。') }
  const text = (v: unknown, max: number): string => typeof v === 'string' && v.length <= max ? v : bad()
  const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : bad()
  const envelope = record(input)
  if ('version' in envelope && envelope.version !== 1) throw new Error('不支持此项目版本')
  const d = 'version' in envelope ? record(envelope.document) : envelope
  if (typeof d.bold !== 'boolean' || typeof d.divider !== 'boolean' || typeof d.size !== 'number' || !Number.isInteger(d.size) || d.size < 8 || d.size > 20 || !Array.isArray(d.sections) || d.sections.length > 64) return bad()
  const ids = new Set<string>()
  const sections = d.sections.map((item: unknown) => {
    const s = record(item), id = text(s.id, 128)
    if (!id || ids.has(id)) return bad()
    ids.add(id)
    const title=text(s.title,160),body=text(s.body,20000)
    return { id, icon: enumField(s, 'icon', icons, 'none'), title, body, ...styles(s,'titleMarks',title), ...styles(s,'bodyMarks',body), ...lineStyles(s,'titleLines',title), ...lineStyles(s,'bodyLines',body) }
  })
  const name=text(d.name,160),subtitle=text(d.subtitle,512)
  return {font: enumField(d, 'font', fonts, 'serif'), name, subtitle, ...styles(d,'nameMarks',name), ...styles(d,'subtitleMarks',subtitle), ...lineStyles(d,'nameLines',name), ...lineStyles(d,'subtitleLines',subtitle), size: d.size, bold: d.bold, divider: d.divider, sections}
}
