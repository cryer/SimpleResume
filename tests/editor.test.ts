import test from 'node:test'
import assert from 'node:assert/strict'
import {initialDoc, parseDoc} from '../src/model.ts'
import {LatestQueue} from '../src/queue.ts'

test('project round trip preserves contents but rejects ambiguous section identities', () => {
  assert.deepEqual(parseDoc(JSON.parse(JSON.stringify(initialDoc))), initialDoc)
  assert.deepEqual(parseDoc({version:1, document: initialDoc}), initialDoc)
  for (const invalid of [null, {version:2,document:initialDoc}, {...initialDoc, size: 99}, {...initialDoc, bold: 1}, {...initialDoc, sections: [initialDoc.sections[0], initialDoc.sections[0]]}]) assert.throws(() => parseDoc(invalid))
})
test('only latest queued revision renders and obsolete result is not published', async () => {
  const starts: number[] = [], results: number[] = []
  let release!: () => void
  const blocked = new Promise<void>(resolve => {release = resolve})
  const q = new LatestQueue<number,number>(async i => { starts.push(i); if (i === 1) await blocked; return i }, (_, value) => results.push(value), assert.fail)
  const first = q.submit(1, q.invalidate()); await q.submit(2, q.invalidate()); await q.submit(3, q.invalidate()); release(); await first
  assert.deepEqual(starts,[1,3]); assert.deepEqual(results,[3])
})
test('obsolete errors are ignored and current errors do not block recovery', async () => {
  const errors: unknown[] = [], values: string[] = []
  const q = new LatestQueue<string,string>(async s => { if (s !== 'ok') throw s; return s }, (_,s) => values.push(s), err => errors.push(err))
  const p = q.submit('stale', q.invalidate()); q.invalidate(); await p
  await q.submit('failed', q.invalidate()); await q.submit('ok', q.invalidate())
  assert.deepEqual(errors,['failed']); assert.deepEqual(values,['ok'])
})

test('missing style fields migrate; only supported font and icon identifiers round trip', () => {
  const { font, sections, ...old } = initialDoc
  const { icon, ...section } = sections[0]
  const legacy = { ...old, sections: [section] }
  assert.deepEqual(parseDoc({ version: 1, document: legacy }), { ...legacy, font: 'serif', sections: [{ ...section, icon: 'none' }] })
  for (const font of ['serif', 'sans', 'kai']) for (const icon of ['none', 'education', 'work', 'project', 'skills']) {
    const styled = { ...legacy, font, sections: [{ ...section, icon }] }
    assert.deepEqual(parseDoc(styled), styled)
  }
  for (const invalid of ['other', '', null, undefined, 1, ['sans'], '__proto__']) {
    assert.throws(() => parseDoc({ ...legacy, font: invalid }))
    assert.throws(() => parseDoc({ ...legacy, sections: [{ ...section, icon: invalid }] }))
  }
})
