import assert from 'node:assert/strict'
import test from 'node:test'
import { icons, iconNames, iconPaths, symbols } from '../src/catalog.ts'

test('icon picker preserves legacy options and labels every distinct drawing', () => {
  assert.deepEqual(icons.slice(0, 5), ['none', 'education', 'work', 'project', 'skills'])
  assert.ok(icons.length >= 20)
  assert.equal(new Set(icons).size, icons.length)
  assert.deepEqual(Object.keys(iconNames).sort(), [...icons].sort())
  assert.deepEqual(Object.keys(iconPaths).sort(), icons.filter(icon => icon !== 'none').sort())
  assert.equal(new Set(Object.values(iconPaths)).size, icons.length - 1)
  for (const icon of icons) {
    assert.match(iconNames[icon], /\p{Script=Han}/u)
    if (icon !== 'none') assert.match(iconPaths[icon], /^M[\dMmLlHhVvCcSsQqTtAaZz.,\s-]+$/)
  }
})

test('symbol picker keeps its legacy prefix and only offers distinct single glyphs', () => {
  assert.equal(symbols.slice(0, 6).join(''), '•→★◆✓±')
  assert.ok(symbols.length >= 30)
  assert.equal(new Set(symbols).size, symbols.length)
  for (const glyph of symbols) assert.match(glyph, /^\p{S}$|^•$/u)
})
