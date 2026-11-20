export type Mark = {start:number; end:number; bold?:boolean; size?:number; font?:'serif'|'sans'|'kai'; metric?:boolean; link?:string}
export type Style = Omit<Mark,'start'|'end'>
type Patch = {[K in keyof Style]?: Style[K] | null}
const keys = ['bold','size','font','metric','link'] as const
export function safeLink(value:string):boolean {
  if(value.length>512 || !/^https?:\/\/[A-Za-z0-9.:/?&=_#%+~\-]+$/.test(value)) return false
  const host = value.match(/^https?:\/\/([^/?#]+)/)?.[1]
  if(!host || !/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*(?::[0-9]{1,5})?$/.test(host)) return false
  const [domain, port] = host.split(':')
  return domain.length <= 253 && domain.split('.').every(label=>label.length<=63 && !label.startsWith('-') && !label.endsWith('-')) && (port===undefined || Number(port)<=65535)
}
function boundary(text:string,i:number){return Number.isInteger(i) && i>=0 && i<=text.length && !(i>0 && i<text.length && /[\uD800-\uDBFF]/.test(text[i-1]) && /[\uDC00-\uDFFF]/.test(text[i]))}
function sameStyle(a:Style,b:Style){return keys.every(k=>a[k]===b[k])}
export function validateMarks(text:string,data:unknown):Mark[]{
  const invalid=():never=>{throw Error('文字格式无效：范围、字体、字号或链接不受支持')}
  if(!Array.isArray(data)||data.length>256)return invalid()
  let last=0
  return data.map((m:Mark)=>{
    if(!m||typeof m!=='object'||!boundary(text,m.start)||!boundary(text,m.end)||m.start<last||m.end<=m.start || Object.keys(m).some(k=>!['start','end',...keys].includes(k)) || !keys.some(k=>m[k]!==undefined))return invalid()
    if(('bold' in m && typeof m.bold!=='boolean')||('metric' in m && typeof m.metric!=='boolean')||('size' in m && (!Number.isInteger(m.size)||m.size!<8||m.size!>32))||('font' in m && !['serif','sans','kai'].includes(m.font!))||('link' in m && (typeof m.link!=='string'||!safeLink(m.link))))return invalid()
    last=m.end;return {...m}
  })
}
function append(list:Mark[],m:Mark){
  if(m.start>=m.end||!keys.some(k=>m[k]!==undefined))return
  const last=list.at(-1)
  if(last && last.end===m.start && sameStyle(last,m)) last.end=m.end
  else list.push(m)
}
export function applyStyle(text:string,marks:Mark[],start:number,end:number,patch:Patch|null):Mark[]{
  if(!boundary(text,start)||!boundary(text,end)||start>=end)throw Error('请先选中完整的文字')
  const points=[...new Set([start,end,...marks.flatMap(m=>[m.start,m.end])])].sort((a,b)=>a-b)
  const result:Mark[]=[];let i=0
  for(let j=1;j<points.length;j++){
    const a=points[j-1],b=points[j];while(i<marks.length && marks[i].end<=a)i++
    const run:Mark={...(marks[i]?.start<=a?marks[i]:{}),start:a,end:b}
    if(a>=start && b<=end){if(!patch)continue;Object.assign(run,patch);for(const key of keys)if(run[key]==null)delete run[key]}
    append(result,run)
  }
  return validateMarks(text,result)
}
// Prefer the actual input selection over a string diff (e.g. deleting one of several identical digits).
export function rebaseMarks(before:string,after:string,marks:Mark[],selection?:{start:number,end:number}):Mark[]{
  if(before===after||!marks.length)return marks
  let a=0,b=before.length,c=after.length
  if(selection && boundary(before,selection.start)&&boundary(before,selection.end)&&selection.start<=selection.end && after.startsWith(before.slice(0,selection.start)) && after.endsWith(before.slice(selection.end)) && selection.start+before.length-selection.end<=after.length){
    a=selection.start;b=selection.end;c=after.length-before.length+b
  }else{
    while(a<b&&a<c&&before[a]===after[a])a++
    while(a>0&&(!boundary(before,a)||!boundary(after,a)))a--
    while(b>a&&c>a&&before[b-1]===after[c-1]){b--;c--}
    while(!boundary(before,b)||!boundary(after,c)){b++;c++}
  }
  const result:Mark[]=[]
  for(const m of marks){
    append(result,{...m,end:Math.min(a,m.end)})
    if(a>=m.start&&((a<m.end&&b>a)||(a>m.start&&a<m.end)))append(result,{...m,start:a,end:c})
    append(result,{...m,start:Math.max(m.start,b)+c-b,end:m.end+c-b})
  }
  return result
}
