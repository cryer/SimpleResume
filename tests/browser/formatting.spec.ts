import { test, expect, type Locator } from '@playwright/test'

async function select(field: Locator, start: number, end: number) {
  await field.focus()
  await field.evaluate((el: HTMLInputElement | HTMLTextAreaElement, range) => el.setSelectionRange(...range), [start,end] as [number,number])
}

test('each text field has immediate local styling, safe links and a clear action', async ({page}) => {
  await page.goto('/')
  for (const label of ['姓名','副标题','第 2 节标题','第 2 节正文']) {
    const field = page.getByLabel(label, {exact: true}), reading = page.getByLabel('即时样式预览')
    await field.fill('增长42%！')
    const metric = page.getByRole('button', {name:'指标强调'})
    await expect(metric).toBeDisabled()
    await select(field, 2, 5)
    await metric.click()
    await page.getByLabel('选区字号').selectOption('18')
    await page.getByLabel('选区字体').selectOption('kai')
    await page.getByLabel('选区链接地址').fill('javascript:alert(1)')
    await page.getByRole('button', {name:'设置链接'}).click()
    await expect(page.getByRole('alert')).toContainText('链接无效')
    await expect(reading.getByRole('link')).toHaveCount(0)
    await page.getByLabel('选区链接地址').fill('https://example.org/report')
    await page.getByRole('button', {name:'设置链接'}).click()
    const link = reading.getByRole('link', {name:'42%'})
    await expect(link).toHaveAttribute('href','https://example.org/report')
    await expect(link).toHaveCSS('font-size','24px')
    await expect(link).toHaveCSS('font-family',/KaiTi/)
    await expect(link).toHaveCSS('font-weight','700')
    await expect(link).toHaveCSS('color','rgb(22, 90, 115)')
    await page.getByRole('button',{name:'清除格式'}).click()
    await expect(reading.locator('span,a')).toHaveCount(0)
    await expect(reading).toHaveText('增长42%！')
  }
})

test('typing, deleting repeated text, and inserting a symbol preserve the right marked range', async ({page}) => {
  await page.goto('/')
  const field = page.getByLabel('第 1 节正文'), reading = page.getByLabel('即时样式预览')
  await field.fill('1111')
  await select(field, 1, 3)
  await page.getByRole('button', {name:'加粗', exact:true}).click()
  await select(field, 1, 1); await field.press('Backspace')
  await select(field, 1, 1); await field.press('2')
  await expect(reading.locator('span')).toHaveText('121')
  await select(field, 1, 2); await page.getByRole('button',{name:'插入 ✓', exact:true}).click()
  await expect(reading).toHaveText('1✓11')
  await expect(reading.locator('span')).toHaveText('1✓1')
  await expect(page.getByText('已保存到本机')).toBeVisible()
  await page.reload(); await field.focus()
  await expect(reading.locator('span')).toHaveText('1✓1')
})
