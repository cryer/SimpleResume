// Real-engine integration check: inspect PDF objects, not TeX source or PDF byte patterns.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

const [file, target] = process.argv.slice(2);
const cMapUrl = fileURLToPath(new URL('../../cmaps/', import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs'))).replaceAll('\\', '/');
const doc = await getDocument({data: new Uint8Array(await readFile(file)), cMapUrl, cMapPacked: true}).promise;
try {
  const page = await doc.getPage(1);
  const links = (await page.getAnnotations()).filter(a => a.subtype === 'Link');
  assert.ok(links.length, 'missing link annotation');
  for (const link of links) {
    assert.equal(link.unsafeUrl, target);
    const [x0, y0, x1, y1] = link.rect;
    assert.ok(x1 > x0 && y1 > y0, 'link has no clickable area');
  }
  const text = (await page.getTextContent()).items.map(i => i.str).join('').replace(/\s/g, '');
  assert.ok(text.includes('产出42%'), text);
  const {fnArray, argsArray} = await page.getOperatorList();
  for (const color of ['#165a73','#235fa3']) assert.ok(fnArray.some((f, i) => f === OPS.setFillRGBColor && argsArray[i][0] === color), `missing emphasis color ${color}`);
} finally {
  await doc.destroy();
}
