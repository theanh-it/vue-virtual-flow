import { expect, test, type Page } from '@playwright/test'

async function openCarousel(page: Page) {
  await page.goto('/#/carousel')
  const carousel = page.getByRole('region', { name: 'Product carousel demo' })
  await expect(carousel.getByRole('listitem').first()).toBeVisible()
  return carousel
}

async function advanced(page: Page) {
  await page.getByText('Advanced options', { exact: true }).click()
}

test('small consecutive horizontal touch drags settle without scrolling the page', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP touch input is Chromium-specific')
  await page.setViewportSize({ width: 390, height: 600 })
  const carousel = await openCarousel(page)
  await carousel.scrollIntoViewIfNeeded()
  const box = await carousel.boundingBox()
  if (!box) throw new Error('Carousel missing')
  const session = await page.context().newCDPSession(page)
  const initialScrollY = await page.evaluate(() => window.scrollY)
  const track = carousel.locator('.vue-virtual-carousel__track')
  const x = box.x + box.width / 2, y = box.y + 30
  for (const expectedIndex of [2, 3]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (const distance of [4, 9, 16]) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - distance, y: y + 1 }] })
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.getByText(`Active ${expectedIndex}`, { exact: true })).toBeVisible()
    await expect.poll(() => track.evaluate((el) => el.getAnimations().length)).toBe(0)
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(initialScrollY)
  await session.detach()
})

test('buttons and inputs remain interactive, while drag does not accidentally click', async ({ page }) => {
  const carousel = await openCarousel(page)
  await page.getByRole('button', { name: 'Select slide 1', exact: true }).click()
  await expect(page.getByText('Selected slide 1', { exact: true })).toBeVisible()
  const input = page.getByLabel('Note for slide 1', { exact: true })
  await input.fill('Retained note')
  await input.press('ArrowRight')
  await expect(page.getByText('Active 1', { exact: true })).toBeVisible()
  const button = page.getByRole('button', { name: 'Select slide 2', exact: true })
  const box = await button.boundingBox()
  if (!box) throw new Error('Button missing')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 24, box.y + box.height / 2, { steps: 4 })
  await page.mouse.up()
  await expect(page.getByText('Selected slide 1', { exact: true })).toBeVisible()
  await expect.poll(() => carousel.locator('.vue-virtual-carousel__track').evaluate((el) => el.getAnimations().length)).toBe(0)
})

test('autoplay continues for multiple steps while hovered when pauseOnHover is off', async ({ page }) => {
  const carousel = await openCarousel(page)
  await page.getByLabel('Autoplay', { exact: true }).check()
  await page.getByLabel('Pause on Hover').uncheck()
  await page.getByLabel('Delay (ms)').fill('150')
  await carousel.hover()
  await expect.poll(async () => Number((await page.locator('.carousel-actions span').textContent())?.replace('Active ', ''))).toBeGreaterThan(3)
})

test('wheel cancels settling instead of returning to the old animation target', async ({ page }) => {
  const carousel = await openCarousel(page)
  const box = await carousel.boundingBox()
  if (!box) throw new Error('Carousel missing')
  const x = box.x + box.width / 2, y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 24, y, { steps: 4 })
  await page.mouse.up()
  const track = carousel.locator('.vue-virtual-carousel__track')
  await track.evaluate((el) => {
    const animation = el.getAnimations()[0]
    animation.pause()
    animation.currentTime = Number(animation.effect!.getTiming().duration) * 0.25
  })
  await page.mouse.wheel(120, 0)
  await expect.poll(() => track.evaluate((el) => el.getAnimations().length)).toBe(0)
})

test('controlled snap settles wheel input and API navigation without native snap', async ({ page }) => {
  const carousel = await openCarousel(page)
  await advanced(page)
  await page.getByLabel('Native snap', { exact: true }).uncheck()
  const track = carousel.locator('.vue-virtual-carousel__track')
  await expect(carousel).toHaveCSS('scroll-snap-type', 'none')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Active 2', { exact: true })).toBeVisible()
  await expect.poll(() => track.evaluate((el) => el.getAnimations().length)).toBe(0)
  await carousel.hover()
  const beforeWheel = await carousel.evaluate((el) => el.scrollLeft)
  await page.mouse.wheel(70, 0)
  await expect.poll(() => carousel.evaluate((el) => el.scrollLeft)).not.toBe(beforeWheel)
  await expect.poll(() => carousel.locator('[data-carousel-index="1"]').evaluate((el) => {
    const slide = el.getBoundingClientRect()
    const viewport = el.closest('.vue-virtual-carousel')!.getBoundingClientRect()
    return Math.abs(slide.left - viewport.left)
  })).toBeLessThan(3)
})

test('keepAlive retains a note across navigation and bounds offscreen DOM', async ({ page }) => {
  const carousel = await openCarousel(page)
  await advanced(page)
  await page.getByLabel('Keep slide state').check()
  await page.getByLabel('Cache budget').fill('4')
  await page.getByLabel('Settle duration (ms)').fill('0')
  await page.getByLabel('Note for slide 1', { exact: true }).fill('Saved locally')
  await carousel.press('End')
  await expect(carousel.locator('[data-carousel-index="0"]')).toHaveCSS('visibility', 'hidden')
  await carousel.press('Home')
  await expect(page.getByText('Active 1', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Note for slide 1', { exact: true })).toHaveValue('Saved locally')
  await expect.poll(() => carousel.getByRole('listitem', { includeHidden: true }).count()).toBeLessThanOrEqual(11)
})

for (const rtl of [false, true]) {
  test(`loop and autoWidth work together with RTL ${rtl}`, async ({ page }) => {
    const carousel = await openCarousel(page)
    await advanced(page)
    await page.getByLabel('Auto width').check()
    if (rtl) await page.getByLabel('RTL', { exact: true }).check()
    await page.getByLabel('Continuous loop').check()
    const track = carousel.locator('.vue-virtual-carousel__track')
    await page.getByRole('button', { name: 'Previous', exact: true }).click()
    await expect(page.getByText('Active 20', { exact: true })).toBeVisible()
    await expect.poll(() => track.evaluate((el) => el.getAnimations().length)).toBe(0)
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByText('Active 1', { exact: true })).toBeVisible()
    await expect.poll(() => track.evaluate((el) => el.getAnimations().length)).toBe(0)
    const first = carousel.locator('[data-carousel-index="0"]')
    await expect.poll(() => first.evaluate((el, isRtl) => {
      const slide = el.getBoundingClientRect()
      const viewport = el.closest('.vue-virtual-carousel')!.getBoundingClientRect()
      return Math.abs(slide[isRtl ? 'right' : 'left'] - viewport[isRtl ? 'right' : 'left'])
    }, rtl)).toBeLessThan(3)
  })
}

test('autoWidth measures mixed slide widths and updates after a late resize', async ({ page }) => {
  const carousel = await openCarousel(page)
  await advanced(page)
  await page.getByLabel('Auto width').check()
  const first = carousel.locator('[data-carousel-index="0"]')
  const second = carousel.locator('[data-carousel-index="1"]')
  await expect.poll(() => first.evaluate((el) => el.getBoundingClientRect().width)).toBe(220)
  await expect.poll(() => second.evaluate((el) => parseFloat((el as HTMLElement).style.left))).toBe(236)
  await page.getByRole('button', { name: 'Grow slide 1', exact: true }).click()
  await expect.poll(() => second.evaluate((el) => parseFloat((el as HTMLElement).style.left))).toBe(296)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Active 2', { exact: true })).toBeVisible()
  await expect.poll(() => carousel.evaluate((el) => el.scrollLeft)).toBeCloseTo(296, 0)
})

test('RTL uses negative native scroll and reverses physical arrow keys', async ({ page }) => {
  const carousel = await openCarousel(page)
  await advanced(page)
  await page.getByLabel('RTL', { exact: true }).check()
  await carousel.press('ArrowLeft')
  await expect(page.getByText('Active 2', { exact: true })).toBeVisible()
  await expect.poll(() => carousel.evaluate((el) => el.scrollLeft)).toBeLessThan(0)
  await carousel.press('ArrowRight')
  await expect(page.getByText('Active 1', { exact: true })).toBeVisible()
})

test('continuous loop crosses both boundaries without duplicated item instances', async ({ page }) => {
  const carousel = await openCarousel(page)
  await advanced(page)
  await page.getByLabel('Continuous loop').check()
  const track = carousel.locator('.vue-virtual-carousel__track')
  await page.getByRole('button', { name: 'Previous', exact: true }).click()
  await expect(page.getByText('Active 20', { exact: true })).toBeVisible()
  await expect.poll(() => track.evaluate((el) => el.getAnimations().length)).toBe(0)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Active 1', { exact: true })).toBeVisible()
  await expect.poll(() => track.evaluate((el) => el.getAnimations().length)).toBe(0)
  const indexes = await carousel.locator('[data-carousel-index]').evaluateAll((els) => els.map((el) => el.getAttribute('data-carousel-index')))
  expect(new Set(indexes).size).toBe(indexes.length)
  const beforeWheel = await carousel.evaluate((el) => el.scrollLeft)
  await carousel.hover()
  await page.mouse.wheel(70, 0)
  await expect.poll(() => carousel.evaluate((el) => el.scrollLeft)).not.toBe(beforeWheel)
  await expect.poll(() => carousel.locator('[data-carousel-index="0"]').evaluate((el) => {
    const slide = el.getBoundingClientRect()
    const viewport = el.closest('.vue-virtual-carousel')!.getBoundingClientRect()
    return Math.abs(slide.left - viewport.left)
  })).toBeLessThan(3)
})

test('inViewport changes during drag before activeIndex commits', async ({ page }) => {
  const carousel = await openCarousel(page)
  const box = await carousel.boundingBox()
  if (!box) throw new Error('Carousel missing')
  const step = await carousel.locator('[data-carousel-index="1"]').evaluate((el) =>
    el.getBoundingClientRect().left - el.parentElement!.querySelector('[data-carousel-index="0"]')!.getBoundingClientRect().left)
  const x = box.x + box.width - 50, y = box.y + 30
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - step - 12, y, { steps: 8 })
  await expect(carousel.locator('[data-carousel-index="0"] article')).toHaveAttribute('data-in-viewport', 'false')
  await expect(carousel.locator('[data-carousel-index="3"] article')).toHaveAttribute('data-in-viewport', 'true')
  await expect(page.getByText('Active 1', { exact: true })).toBeVisible()
  await page.mouse.up()
})
