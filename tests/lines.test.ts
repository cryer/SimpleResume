import {strict as assert} from 'node:assert'
import test from 'node:test'
import {rebaseLines,selectedLines,setLines,validateLines} from '../src/lines.ts'
import {initialDoc,parseDoc} from '../src/model.ts'

test('selected logical lines exclude a trailing unselected line and support CRLF',()=>{
  assert.deepEqual(selectedLines('a\r\nb\nc',0,3),[0,0]); assert.deepEqual(selectedLines('a\r\nb\nc',3,5),[1,1]);assert.deepEqual(selectedLines('a\n',2,2),[1,1])
})
test('adjusting multiple lines changes only requested properties; default reset is sparse',()=>{
  const text='a\nb\nc',base=setLines(text,[],0,1,{indent:18});const result=setLines(text,base,1,2,{after:10,leading:120})
  assert.deepEqual(result,[{line:0,indent:18},{line:1,indent:18,after:10,leading:120},{line:2,after:10,leading:120}]);assert.deepEqual(setLines(text,setLines(text,result,0,0,{indent:0}),1,2,null),[])
})
test('inserting newlines inherits active layout; deleting a complete earlier line preserves following style',()=>{
  const base=[{line:0,indent:10},{line:1,after:20},{line:2,leading:80}]
  assert.deepEqual(rebaseLines('a\nb\nc','a\nb\n\nc',base,{start:3,end:3}),[base[0],base[1],{line:2,after:20},{line:3,leading:80}]);assert.deepEqual(rebaseLines('a\nb\nc','b\nc',base,{start:0,end:2}),[{line:0,after:20},{line:1,leading:80}]);assert.deepEqual(rebaseLines('a\nb\nc','ab\nc',base,{start:1,end:2}),[base[0],{line:1,leading:80}])
})
test('line settings survive project round trip; reject bad offsets, numeric types and ranges',()=>{
  const doc={...initialDoc,nameLines:[{line:0,indent:12}],sections:[{...initialDoc.sections[1],bodyLines:[{line:1,after:10,leading:155}]}]};assert.deepEqual(parseDoc(JSON.parse(JSON.stringify(doc))),doc)
  for(const value of [[{line:1,after:1}],[{line:0,indent:-1}],[{line:0,leading:79}],[{line:0,after:73}],[{line:0,indent:'12'}],[{line:0,foo:1}],[{line:0}]])assert.throws(()=>validateLines('one line',value))
})
