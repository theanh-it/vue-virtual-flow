import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

function failOnPageErrors(page: Page) {
  const errors: string[] = []

  page.on('pageerror', (error) => {
    const isResizeObserverDeliveryNotice = error.message.includes(
      'ResizeObserver loop completed with undelivered notifications',
    )

    if (!isResizeObserverDeliveryNotice) errors.push(error.message)
  })
  page.on('console', (message) => {
    const text = message.text()
    const isFirefoxScrollLinkedNotice = text.includes(
      'This site appears to use a scroll-linked positioning effect',
    )

    if (message.type() === 'error' || message.type() === 'warning') {
      if (!isFirefoxScrollLinkedNotice) errors.push(text)
    }
  })

  return errors
}

test('fixed list stays virtualized and can jump to the final row', async ({
  page,
}) => {
  const errors = failOnPageErrors(page)

  await page.goto('/#/fixed')
  const rows = page.locator('.vue-virtual-scroll__item')

  await expect(rows).toHaveCount(11)
  await page.getByRole('button', { name: 'Jump to the last row' }).click()
  await expect(page.getByText('Community member 10000')).toBeVisible()
  expect(errors).toEqual([])
})

test('dynamic list measures rows and jumps without mounting the full list', async ({
  page,
}) => {
  const errors = failOnPageErrors(page)

  await page.goto('/#/dynamic')
  await page.getByLabel('Item index').fill('2000')
  await page.getByRole('button', { name: 'Scroll to item' }).click()

  await expect(
    page.locator('.update-row .index').filter({ hasText: '2000' }),
  ).toBeVisible()
  expect(
    await page.locator('.vue-dynamic-virtual-scroll__item').count(),
  ).toBeLessThan(20)
  expect(errors).toEqual([])
})

test('carousel and short feed respond to keyboard navigation', async ({
  page,
}) => {
  const errors = failOnPageErrors(page)

  await page.goto('/#/carousel')
  await page
    .getByRole('region', { name: 'Product carousel demo' })
    .press('ArrowRight')
  await expect(page.getByText('Active 2', { exact: true })).toBeVisible()

  await page.goto('/#/short-media')
  await page.getByRole('list', { name: 'Short media demo' }).press('ArrowDown')
  await expect(page.getByText(/Item 2 of 20 loaded/)).toBeVisible()
  expect(errors).toEqual([])
})

test('carousel drag animates the track and commits after release', async ({
  page,
}) => {
  const errors = failOnPageErrors(page)

  await page.goto('/#/carousel')
  const carousel = page.getByRole('region', {
    name: 'Product carousel demo',
  })
  const track = carousel.locator('.vue-virtual-carousel__track')
  const box = await carousel.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return

  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX - 24, startY, { steps: 4 })

  await expect(page.getByText('Active 1', { exact: true })).toBeVisible()
  await expect
    .poll(() => track.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe('none')
  expect(await carousel.evaluate((element) => element.scrollLeft)).toBe(0)

  await page.mouse.up()
  await expect(page.getByText('Active 2', { exact: true })).toBeVisible()
  await expect
    .poll(() => track.evaluate((element) => getComputedStyle(element).transform))
    .toBe('none')
  expect(await carousel.getByRole('listitem').count()).toBeLessThanOrEqual(7)
  expect(errors).toEqual([])
})

test('carousel keeps animating on consecutive swipes', async ({ page }) => {
  const errors = failOnPageErrors(page)
  await page.goto('/#/carousel')
  const carousel = page.getByRole('region', { name: 'Product carousel demo' })
  const track = carousel.locator('.vue-virtual-carousel__track')
  const box = await carousel.boundingBox()
  if (!box) throw new Error('Carousel viewport missing')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2

  for (let index = 1; index <= 3; index += 1) {
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 24, y, { steps: 4 })
    await page.mouse.up()
    await expect.poll(() => track.evaluate((element) =>
      element.getAnimations().filter((animation) => animation.playState === 'running').length,
    )).toBe(1)
    await expect(page.getByText(`Active ${index + 1}`, { exact: true })).toBeVisible()
    await expect.poll(() => track.evaluate((element) =>
      getComputedStyle(element).transform,
    )).toBe('none')
  }
  expect(errors).toEqual([])
})

test('starting another drag preserves the current animated position', async ({ page }) => {
  await page.goto('/#/carousel')
  const carousel = page.getByRole('region', { name: 'Product carousel demo' })
  const track = carousel.locator('.vue-virtual-carousel__track')
  const box = await carousel.boundingBox()
  if (!box) throw new Error('Carousel viewport missing')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 24, y, { steps: 4 })
  await page.mouse.up()
  const before = await track.evaluate((element) => {
    const animation = element.getAnimations()[0]
    animation.pause()
    animation.currentTime = Number(animation.effect!.getTiming().duration) * 0.2
    return element.getBoundingClientRect().left
  })

  await page.mouse.down()
  const after = await track.evaluate((element) => element.getBoundingClientRect().left)
  expect(Math.abs(after - before)).toBeLessThan(2)
  await page.mouse.move(x - 48, y, { steps: 4 })
  await page.mouse.up()
  await expect.poll(() => track.evaluate((element) => getComputedStyle(element).transform)).toBe('none')
})

test('vertical touch over the carousel scrolls the page without horizontal drift', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CDP touch input is Chromium-specific')
  const errors = failOnPageErrors(page)

  await page.setViewportSize({ width: 390, height: 600 })
  await page.goto('/#/carousel')
  const carousel = page.getByRole('region', {
    name: 'Product carousel demo',
  })
  await carousel.scrollIntoViewIfNeeded()
  const track = carousel.locator('.vue-virtual-carousel__track')
  const box = await carousel.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return

  const initialScrollY = await page.evaluate(() => window.scrollY)
  const session = await page.context().newCDPSession(page)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  })
  for (const distance of [20, 45, 75, 110]) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + 2, y: y - distance }],
    })
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(
    initialScrollY,
  )
  await expect(page.getByText('Active 1', { exact: true })).toBeVisible()
  await expect
    .poll(() => track.evaluate((element) => getComputedStyle(element).transform))
    .toBe('none')
  expect(errors).toEqual([])
})

test('full-page demo navigates sections and stays virtualized', async ({
  page,
}) => {
  const errors = failOnPageErrors(page)

  await page.goto('/#/full-page')
  const feed = page.getByRole('list', { name: 'Full-page product story' })
  const carousel = page.getByRole('region', { name: 'Featured process' })

  await expect(page.getByText('Section 1 of 4')).toBeVisible()
  await expect(page.getByText(/01\s*\/\s*04/)).toBeVisible()
  await carousel.press('ArrowRight')
  await expect(page.getByText(/02\s*\/\s*04/)).toBeVisible()
  await expect.poll(() => carousel.locator('.vue-virtual-carousel__track').evaluate((el) => el.getAnimations().length)).toBe(0)
  expect(await carousel.getByRole('listitem').count()).toBeLessThanOrEqual(3)
  await page.mouse.wheel(0, 120)
  await expect(page.getByText('Section 2 of 4')).toBeVisible()
  await expect
    .poll(() =>
      feed.evaluate((element) =>
        Math.abs(element.scrollTop - element.clientHeight),
      ),
    )
    .toBeLessThan(2)
  await page
    .getByRole('button', { name: 'Go to section 3: scale' })
    .click()
  await expect(page.getByText('Section 3 of 4')).toBeVisible()
  await expect(page.getByText('A tiny DOM, even at scale.')).toBeVisible()
  expect(
    await feed.locator(':scope > .vue-short-media-feed__item').count(),
  ).toBeLessThanOrEqual(3)
  expect(errors).toEqual([])
})

test('window list jumps directly and chat remains pinned after append', async ({
  page,
}) => {
  const errors = failOnPageErrors(page)

  await page.goto('/#/window-dynamic')
  await page.getByLabel('Item index').fill('2000')
  await page.getByRole('button', { name: 'Scroll to item' }).click()
  await expect(
    page.locator('.update-row .index').filter({ hasText: '2000' }),
  ).toBeVisible()
  expect(
    await page.locator('.vue-window-dynamic-virtual-scroll__item').count(),
  ).toBeLessThan(20)

  await page.goto('/#/chat')
  const chat = page.getByRole('log', { name: 'Community chat' })
  await page.getByRole('button', { name: 'New message' }).click()
  await expect
    .poll(() =>
      chat.evaluate(
        (element) => Math.abs(element.scrollTop),
      ),
    )
    .toBeLessThanOrEqual(1)
  expect(errors).toEqual([])
})

test('chat respects size while scrolling up on a portrait mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/chat')
  const chat = page.getByRole('log', { name: 'Community chat' })
  const rows = chat.locator('.vue-chat-virtual-scroll__item')
  await expect(rows.last()).toHaveAttribute('aria-posinset', '20')

  for (const fraction of [0.75, 0.5, 0.25, 0]) {
    await chat.evaluate((element, value) => {
      element.scrollTop = (element.scrollHeight - element.clientHeight) * (value - 1)
    }, fraction)
    await expect.poll(() => chat.evaluate((element) => {
      const mounted = Array.from(element.querySelectorAll('.vue-chat-virtual-scroll__item'))
      const viewportTop = element.getBoundingClientRect().top + element.clientTop
      const first = mounted[0]?.getBoundingClientRect()
      const last = mounted.at(-1)?.getBoundingClientRect()
      return mounted.length <= 12 && !!first && !!last
        && first.top <= viewportTop + 1
        && last.bottom >= viewportTop + element.clientHeight - 1
    })).toBe(true)
  }

  await expect(rows.first()).toHaveAttribute('aria-setsize', '40')
  expect(await rows.count()).toBeLessThanOrEqual(12)
})
