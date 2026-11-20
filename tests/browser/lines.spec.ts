import { test, expect, type Locator } from '@playwright/test'

async function select(field: Locator, start: number, end = start) {
  await field.focus()
  await field.evaluate((el: HTMLTextAreaElement, [a,b]) => el.setSelectionRange(a,b), [start,end])
}

test('cursor and selection layout work in all four fields without losing spaces or marks', async ({page}) => {
  await page.goto('/')
  const indent = page.getByRole('spinbutton', {name:'左缩进'}), after = page.getByLabel('段后'), leading = page.getByLabel('行距')
  for (const label of ['姓名','副标题','第 1 节标题','第 1 节正文']) {
    const field = page.getByLabel(label, {exact:true}), lines = page.locator('.reading-line')
    await field.fill('  甲  A\n  乙  B\n')
    await select(field, 2, 10)
    await page.getByRole('button',{name:'指标强调'}).click()
    await expect(lines.nth(1).locator('.metric')).toHaveText('乙')
    expect(await lines.nth(1).textContent()).toBe('  乙  B')
    await expect(lines.nth(1)).toHaveCSS('white-space','break-spaces')
    await expect(lines.nth(2).locator('br')).toHaveCount(1)
    await select(field, 8)
    await expect(page.getByRole('button',{name:'指标强调'})).toBeDisabled()
    await expect(leading).toHaveValue('140')
    await indent.fill('144'); await after.fill('72'); await leading.fill('250')
    await expect(lines.nth(1)).toHaveCSS('padding-inline-start','192px')
    await expect(lines.nth(1)).toHaveCSS('margin-bottom','96px')
    expect(await lines.nth(1).evaluate(el => (el as HTMLElement).style.lineHeight)).toBe('2.5')
    await select(field, 0, 14) // End at the next line's start excludes that line.
    await expect(indent).toHaveValue(''); await expect(indent).toHaveAttribute('placeholder','混合')
    await indent.fill('12')
    for (const n of [0,1]) await expect(lines.nth(n)).toHaveCSS('padding-inline-start','16px')
    await expect(lines.nth(2)).toHaveCSS('padding-inline-start','0px')
    await select(field, 8)
    await expect(after).toHaveValue('72')
    await leading.fill('79'); await leading.press('Tab'); await expect(leading).toHaveValue('250')
    await page.getByRole('button',{name:'恢复默认行布局'}).click()
    await expect(indent).toHaveValue('0'); await expect(after).toHaveValue('0'); await expect(leading).toHaveValue('140')
    await expect(lines.nth(1).locator('.metric')).toHaveCount(1)
    await expect(lines.first()).toHaveCSS('padding-inline-start','16px')
  }
})

test('line identity follows Enter, deletion and multiline symbol replacement through reload', async ({page}) => {
  await page.goto('/')
  const field = page.getByLabel('第 1 节正文'), lines = page.locator('.reading-line')
  await field.fill('甲\n乙\n丙\n丁')
  await select(field, 6); await page.getByLabel('左缩进').fill('24')
  await select(field, 1); await field.press('Enter')
  await expect(lines.nth(4)).toHaveCSS('padding-inline-start','32px')
  await field.press('Backspace'); await expect(lines.nth(3)).toHaveCSS('padding-inline-start','32px')
  await select(field, 0, 4); await page.getByRole('button',{name:'插入 ★'}).click()
  await expect(field).toHaveValue('★丙\n丁'); await expect(lines.nth(1)).toHaveCSS('padding-inline-start','32px')
  await expect(page.getByText('已保存到本机')).toBeVisible(); await page.reload()
  await select(field, 3); await expect(page.getByLabel('左缩进')).toHaveValue('24')
})

test('CRLF imports keep mark and line offsets aligned with textarea selections', async ({page}) => {
  await page.goto('/')
  const doc = {name:'甲\r\n  乙', subtitle:'', font:'serif', size:11, bold:true, divider:false, sections:[],
    nameLines:[{line:1,indent:12}], nameMarks:[{start:5,end:6,bold:true}]}
  await page.locator('input[type=file]').setInputFiles({name:'crlf.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))})
  const field = page.getByLabel('姓名',{exact:true})
  await select(field,4,5); await expect(page.getByLabel('左缩进')).toHaveValue('12')
  await expect(page.locator('.reading-line span')).toHaveText('乙')
  await page.getByRole('button',{name:'插入 ✓'}).click()
  await expect(field).toHaveValue('甲\n  ✓'); await expect(page.locator('.reading-line span')).toHaveText('✓')
  await expect(page.locator('.reading-line').nth(1)).toHaveCSS('padding-inline-start','16px')
})
