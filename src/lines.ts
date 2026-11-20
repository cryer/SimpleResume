export type LineStyle = {line:number; indent?:number; after?:number; leading?:number}
type Settings=Omit<LineStyle,'line'>
const bounds={indent:[0,144,0], after:[0,72,0], leading:[80,250,140]} as const
const keys=Object.keys(bounds) as (keyof Settings)[]
function starts(text:string) {
  const indexes=[0]; for(const match of text.matchAll(/\r\n|[\r\n]/g)) indexes.push(match.index!+match[0].length)
  return indexes
}
function lineAt(offsets:number[], pos:number) {
  let lo=0,hi=offsets.length
  while(lo+1<hi){const mid=(lo+hi)>>>1; if(offsets[mid]<=pos)lo=mid;else hi=mid}
  return lo
}
export function selectedLines(text:string,start:number,end:number):[number,number]{
  const offsets=starts(text);return [lineAt(offsets,start),lineAt(offsets,Math.max(start,end-1))]
}
export function validateLines(text:string,input:unknown):LineStyle[]{
  const count=starts(text).length
  if(!Array.isArray(input)||input.length>count)throw Error('无效的行格式列表')
  let prev=-1
  return input.map(raw=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||!Number.isInteger(raw.line)||raw.line<=prev||raw.line>=count||Object.keys(raw).some(k=>k!=='line'&&!keys.includes(k as keyof Settings)))throw Error('行格式位置无效')
    prev=raw.line; const item:LineStyle={line:prev};let used=false
    for(const k of keys)if(Object.hasOwn(raw,k)){const v=raw[k];if(!Number.isInteger(v)||v<bounds[k][0]||v>bounds[k][1])throw Error('行格式数值超出范围');item[k]=v;used=true}
    if(!used)throw Error('空的行格式');return item
  })
}
export function setLines(text:string,lines:LineStyle[],from:number,to:number,patch:Partial<Settings>|null):LineStyle[]{
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<from||to>=starts(text).length)throw Error('请选择有效行')
  const byLine=new Map(lines.map(x=>[x.line,x]))
  for(let n=from;n<=to;n++){
    if(!patch){byLine.delete(n);continue}
    const merged={...byLine.get(n),...patch,line:n};for(const k of keys)if(merged[k]===bounds[k][2])delete merged[k]
    if(Object.keys(merged).length===1)byLine.delete(n);else byLine.set(n,merged)
  }
  return validateLines(text,[...byLine.values()].sort((a,b)=>a.line-b.line))
}
export function rebaseLines(oldText:string,newText:string,lines:LineStyle[],range?:{start:number,end:number}):LineStyle[]{
  if(oldText===newText||!lines.length)return lines
  let start=range?.start??-1,end=range?.end??-1
  if(start<0||end<start||end>oldText.length||newText.length<start+oldText.length-end||!newText.startsWith(oldText.slice(0,start))||!newText.endsWith(oldText.slice(end))){
    start=0;while(start<oldText.length&&start<newText.length&&oldText[start]===newText[start])start++
    end=oldText.length;let tail=newText.length;while(end>start&&tail>start&&oldText[end-1]===newText[tail-1]){end--;tail--}
  }
  const old=starts(oldText),next=starts(newText),first=lineAt(old,start),last=lineAt(old,end),shift=next.length-old.length
  if(first===last&&!shift)return lines
  const lastNew=Math.min(next.length-1,last+shift),result:LineStyle[]=[]
  const atFirst=lines.find(x=>x.line===first), atLast=lines.find(x=>x.line===last)
  // Deleting a complete prefix of a line range leaves the surviving line's own layout.
  const survivingRight=start===old[first] && end===old[last] && first!==last
  for(const x of lines)if(x.line<first)result.push(x)
  for(let n=first;n<=lastNew;n++){
    const style=n===lastNew && (survivingRight || (first!==last && n!==first && end<oldText.length)) ? atLast:atFirst
    if(style)result.push({...style,line:n})
  }
  for(const x of lines)if(x.line>last)result.push({...x,line:x.line+shift})
  return result
}
