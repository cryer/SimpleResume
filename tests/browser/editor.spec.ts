import {test,expect} from '@playwright/test'

test('edits, reorders, persists and exchanges a local project', async ({page}) => {
  await page.goto('/')
  await page.getByRole('textbox',{name:'姓名',exact:true}).fill('王研')
  await page.getByRole('button',{name:'添加章节'}).click()
  await page.getByLabel('第 3 节标题').fill('开源项目')
  await page.getByLabel('上移第 3 节').click()
  await expect(page.getByLabel('第 2 节标题')).toHaveValue('开源项目')
  await expect(page.getByText('已保存到本机')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('姓名',{exact:true})).toHaveValue('王研')
  await expect(page.getByRole('button',{name:'下载 PDF'})).toBeDisabled()
  const downloading = page.waitForEvent('download'); await page.getByText('保存 JSON').click()
  const download = await downloading; expect(download.suggestedFilename()).toBe('王研.json')
  await page.getByLabel('删除第 2 节').click()
  await page.locator('input[type=file]').setInputFiles((await download.path())!)
  await expect(page.getByLabel('第 2 节标题')).toHaveValue('开源项目')
  await page.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')})
  await expect(page.getByText(/导入失败/)).toBeVisible()
  await expect(page.getByLabel('姓名',{exact:true})).toHaveValue('王研')
})

test('global font and section artwork follow the draft', async ({page}) => {
  await page.goto('/')
  const name = page.getByLabel('姓名', {exact:true}), font = page.getByLabel('全局字体')
  await expect(font).toHaveValue('serif')
  for (const [style, family] of [['sans', /sans-serif/], ['kai', /KaiTi/]] as const) {
    await font.selectOption(style)
    await expect(name).toHaveCSS('font-family', family)
    await expect(page.getByLabel('第 1 节正文')).toHaveCSS('font-family', family)
  }
  const icon = page.getByLabel('第 1 节图标')
  for (const [value, label] of [['work','工作'],['project','项目'],['skills','技能'],['education','教育']]) {
    await icon.selectOption(value)
    await expect(page.getByRole('img', {name:label+'图标'})).toBeVisible()
  }
  await page.getByLabel('下移第 1 节').click()
  await expect(page.getByText('已保存到本机')).toBeVisible()
  await page.reload()
  await expect(font).toHaveValue('kai')
  await expect(page.getByLabel('第 2 节图标')).toHaveValue('education')
  await page.getByLabel('第 2 节图标').selectOption('none')
  await expect(page.getByRole('img', {name:'教育图标'})).toHaveCount(0)
})

test('symbols replace the selection or insert at the caret of the active text field', async ({page}) => {
  await page.goto('/')
  await expect(page.getByRole('button',{name:'插入 •'})).toBeDisabled()
  for (const label of ['姓名','副标题','第 2 节标题','第 2 节正文']) {
    const field = page.getByLabel(label, {exact:true})
    await field.fill('甲替换乙')
    await field.evaluate((el: HTMLInputElement | HTMLTextAreaElement) => el.setSelectionRange(1, 3))
    for (const symbol of ['•','→','★','◆','✓','±']) await page.getByRole('button',{name:`插入 ${symbol}`}).click()
    await expect(field).toBeFocused()
    await field.press('X')
    await expect(field).toHaveValue('甲•→★◆✓±X乙')
  }
  await page.getByLabel('删除第 2 节').click()
  await expect(page.getByRole('button',{name:'插入 ✓'})).toBeDisabled()
})
