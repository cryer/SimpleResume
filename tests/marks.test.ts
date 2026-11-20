import assert from 'node:assert/strict'
import test from 'node:test'
import {applyStyle,rebaseMarks,safeLink,validateMarks} from '../src/marks.ts'

test('stack formats over intersecting ranges; reset only selected properties or all',()=>{
  const text='增长 42.5%'
  const bold=applyStyle(text,[],1,6,{bold:true})
  const stacked=applyStyle(text,bold,3,8,{size:16,metric:true})
  assert.deepEqual(stacked,[{start:1,end:3,bold:true},{start:3,end:6,bold:true,size:16,metric:true},{start:6,end:8,size:16,metric:true}])
  assert.deepEqual(applyStyle(text,stacked,1,6,{bold:null}),[{start:3,end:8,size:16,metric:true}])
  assert.deepEqual(applyStyle(text,stacked,1,8,null),[])
})
test('edits track repeated digits, interior replacements, Unicode and deletion',()=>{
  const mark={start:1,end:3,font:'kai' as const}
  assert.deepEqual(rebaseMarks('1111','111',[mark],{start:0,end:1}),[{...mark,start:0,end:2}])
  assert.deepEqual(rebaseMarks('a23z','a😀3z',[mark],{start:1,end:2}),[{...mark,end:4}])
  assert.deepEqual(rebaseMarks('a23z','az',[mark]),[])
  assert.deepEqual(rebaseMarks('a😀界','a😁界',[{...mark,start:3,end:4}]),[{...mark,start:3,end:4}])
})
test('rejects split surrogate pairs, overlapping ranges, invalid sizes and unsafe destinations',()=>{
  for(const value of [[{start:0,end:1,bold:true}],[{start:0,end:2,size:7}],[{start:0,end:2}],[{start:0,end:2,bold:1}],[{start:0,end:2,font:'userfont'}],[{start:0,end:2,metric:true},{start:0,end:2,size:9}]])assert.throws(()=>validateMarks('😀',value))
  for(const url of ['file:///C:/a','javascript:alert(1)','https://user@host','https://host/a{b}','https://host/a\\b','https://','https://a:99999','https://a /','https://host\n'])assert.equal(safeLink(url),false,url)
  assert.equal(safeLink('https://example.org/p?a=1&b=2#x'),true)
})
