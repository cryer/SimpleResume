import assert from 'node:assert/strict'
import test from 'node:test'
import {parseDoc,initialDoc} from '../src/model.ts'

test('local styling survives a saved project and remains anchored to its field',()=>{
  const doc={...initialDoc,nameMarks:[{start:0,end:1,bold:false}],subtitleMarks:[{start:0,end:3,size:32,font:'kai'}],sections:[{...initialDoc.sections[0],titleMarks:[{start:0,end:1,font:'sans'}],body:'完成 42%：作品',bodyMarks:[{start:3,end:6,metric:true},{start:7,end:9,link:'https://example.org/work?a=1&b=2'}]}]}
  assert.deepEqual(parseDoc(JSON.parse(JSON.stringify({version:1,document:doc}))),doc)
  assert.throws(()=>parseDoc({...doc,sections:[{...doc.sections[0],body:'短'}]}))
  assert.throws(()=>parseDoc({...doc,nameMarks:null}))
})
