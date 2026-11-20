// Inspect the final PDF in bottom-left coordinates, not the TeX instructions.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const doc = await getDocument({data:new Uint8Array(await readFile(process.argv[2])),cMapPacked:true,cMapUrl:fileURLToPath(new URL('../../../node_modules/pdfjs-dist/cmaps/',import.meta.url)).replaceAll('\\','/')}).promise;
try {
  const page = await doc.getPage(1);
  const items = (await page.getTextContent()).items.filter(i=>i.str?.trim());
  const item = label => {const i=items.find(i=>i.str.trim()===label); assert.ok(i, `missing ${label}: ${items.map(i=>i.str)}`);return i;};
  const x=i=>i.transform[4], y=i=>i.transform[5];
  const origin=x(item('Base')), bp=72/72.27;
  const near=(a,b,msg)=>assert.ok(Math.abs(a-b)<0.6,`${msg}: ${a} vs ${b}`);
  for(const [label,offset] of [['Name',12],['Sub',18],['Title',24+15/bp],['LinkB',36],['End',0]]) near(x(item(label))-origin,offset*bp,label);
  // Two individual spaces, a four-space tab, and a full em survive typesetting.
  const space=x(item('Space'))-origin;
  assert.ok(space>6 && space<8, `two spaces: ${space}`);
  // The second space is bold; compare the tab against four normal spaces.
  near(x(item('Tab'))-origin,4*11*bp/3,'tab'); near(x(item('Wide'))-origin,11*bp,'wide space');
  // Measure from the end of the prefix glyph, not the no-space line:
  // xeCJK adds its own implicit Chinese/Latin glue when no gap was typed.
  const prefix=item('甲'), mid=x(prefix)+prefix.width, sp=11*bp/3;
  for(const [label,width] of [['One',sp],['Three',3*sp],['InnerTab',4*sp],['Full',11*bp]]) near(x(item(label))-mid,width,`inline gap ${label}`);
  const step=15.4*bp;
  near(y(item('Gap'))-y(item('Blank')),2*step+30*bp,'empty line and extra gap');
  // PDF.js may split justified words into separate items on one baseline.
  const wraps=[];
  for (const word of items.filter(i=>i.str.includes('wrap'))) {
    if (!wraps.length || Math.abs(y(wraps.at(-1))-y(word))>0.1) wraps.push(word);
  }
  assert.ok(wraps.length>=3);
  for(const [k,i] of wraps.entries()) {near(x(i)-origin,72*bp,'whole paragraph indent'); if(k)near(y(wraps[k-1])-y(i),22*bp,'wrapped baseline');}
  near(y(item('LinkB'))-y(wraps[0]),step,'leading does not enlarge gap before paragraph');
  near(y(wraps.at(-1))-y(item('End')),step,'leading does not leak to next paragraph');
  const links=(await page.getAnnotations()).filter(a=>a.subtype==='Link');
  for(const label of ['LinkA','LinkB']) { const i=item(label); assert.ok(links.some(a=>a.unsafeUrl==='https://example.org/' && Math.abs(a.rect[0]-x(i))<1 && a.rect[1]<=y(i)+1 && a.rect[3]>y(i)),`missing link at ${label}`); }
} finally { await doc.destroy(); }
