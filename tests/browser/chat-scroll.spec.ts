import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

async function dispatchTouch(chat: Locator, type: 'touchstart' | 'touchend') {
  // Synthetic lifecycle events exercise compensation; they do not emulate
  // native iOS momentum. Cross-engine geometry assertions remain useful.
  await chat.evaluate((element, eventType) => {
    const event = new Event(eventType)
    Object.defineProperty(event, 'touches', { value: eventType === 'touchstart' ? [{}] : [] })
    element.dispatchEvent(event)
  }, type)
}

async function settleLayout(page: Page) {
  await page.evaluate(async () => {
    for (let frame = 0; frame < 6; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
  })
}

async function openChat(page: Page, fixedHeight = true) {
  await page.setViewportSize({ width: 390, height: 844 })
  // Isolate virtual layout from unrelated image/video network timing.
  await page.route(/https:\/\//, (route) => route.abort())
  await page.goto('/#/chat')
  const chat = page.getByRole('log', { name: 'Community chat' })
  await expect(chat.locator('[aria-posinset="20"]')).toBeAttached()
  if (fixedHeight) {
    await page.addStyleTag({ content: '.chat-message { height: 180px; overflow: hidden; }' })
  }
  await settleLayout(page)
  return chat
}

async function visibleAnchor(chat: Locator) {
  return chat.evaluateHandle((element) => {
    const top = element.getBoundingClientRect().top + element.clientTop
    return Array.from(element.querySelectorAll<HTMLElement>('.vue-chat-virtual-scroll__item'))
      .find((row) => row.getBoundingClientRect().bottom > top)!
  })
}

async function scrollToIndex(chat: Locator, index: number, align: 'start' | 'center' | 'end') {
  await chat.evaluate((element, options) => {
    const instance = (element as HTMLElement & {
      __vueParentComponent: {
        exposed: {
          scrollToIndex(index: number, options: { align: 'start' | 'center' | 'end'; behavior: 'auto' }): void
        }
      }
    }).__vueParentComponent
    instance.exposed.scrollToIndex(options.index, { align: options.align, behavior: 'auto' })
  }, { index, align })
}

for (const touching of [false, true]) {
  test(`prepend preserves the anchor and immediately extends upward scrolling (touch ${touching})`, async ({ page }) => {
    const chat = await openChat(page)
    await chat.evaluate((element) => {
      element.scrollTop = -(element.scrollHeight - element.clientHeight) + 60
    })
    await expect(chat.getByRole('status')).toBeAttached()
    await settleLayout(page)
    expect(await chat.getByRole('status').evaluate((element) => {
      const viewport = element.closest('.vue-chat-virtual-scroll')!
      return Math.abs(element.getBoundingClientRect().top - viewport.getBoundingClientRect().top - viewport.clientTop)
    })).toBeLessThan(1)

    const anchor = await visibleAnchor(chat)
    const before = await anchor.evaluate((element) => element.getBoundingClientRect().top)
    const previousPosition = await anchor.evaluate((element) => Number(element.getAttribute('aria-posinset')))
    const nativeTop = await chat.evaluate((element) => element.scrollTop)
    const oldMinimum = await chat.evaluate((element) => element.clientHeight - element.scrollHeight)
    if (touching) await dispatchTouch(chat, 'touchstart')

    await expect(chat.locator(`[aria-posinset="${previousPosition + 20}"]`)).toHaveAttribute('aria-setsize', '40')
    await settleLayout(page)
    expect(await anchor.evaluate((element) => element.isConnected)).toBe(true)
    expect(Math.abs(await anchor.evaluate((element) => element.getBoundingClientRect().top) - before)).toBeLessThan(1)
    expect(await chat.evaluate((element) => element.scrollTop)).toBeCloseTo(nativeTop, 0)
    expect(await chat.evaluate((element) => element.clientHeight - element.scrollHeight)).toBeLessThan(oldMinimum - 1000)

    // Continue the same active touch past the old native limit. Previously this
    // required touchend before any of the newly prepended history was reachable.
    await chat.evaluate((element, previousMinimum) => {
      element.scrollTop = previousMinimum - 400
    }, oldMinimum)
    await settleLayout(page)
    expect(await chat.evaluate((element) => element.scrollTop)).toBeLessThan(oldMinimum)
    const currentAnchor = await visibleAnchor(chat)
    expect(await currentAnchor.evaluate((element) => Number(element.getAttribute('aria-posinset')))).toBeLessThanOrEqual(20)

    if (touching) {
      const continuedTop = await chat.evaluate((element) => element.scrollTop)
      await dispatchTouch(chat, 'touchend')
      await chat.dispatchEvent('scrollend')
      await settleLayout(page)
      expect(await chat.evaluate((element) => element.scrollTop)).toBeCloseTo(continuedTop, 0)
    }
    expect(await chat.locator('.vue-chat-virtual-scroll__item').count()).toBeLessThanOrEqual(12)
  })
}

for (const [height, nearBottom] of [[300, false], [60, false], [60, true]] as const) {
  test(`resize above the viewport to ${height}px never rebases native scrolling (near bottom ${nearBottom})`, async ({ page }) => {
    const chat = await openChat(page)
    await chat.evaluate((element, atBottom) => {
      element.scrollTop = atBottom ? -20 : -(element.scrollHeight - element.clientHeight) / 2
    }, nearBottom)
    await settleLayout(page)
    const anchor = await visibleAnchor(chat)
    const above = await anchor.evaluateHandle((element) => element.previousElementSibling as HTMLElement)
    const before = await anchor.evaluate((element) => element.getBoundingClientRect().top)
    const nativeTop = await chat.evaluate((element) => element.scrollTop)
    const scrollHeight = await chat.evaluate((element) => element.scrollHeight)
    await dispatchTouch(chat, 'touchstart')
    await above.evaluate((element, nextHeight) => {
      element.querySelector<HTMLElement>('.chat-message')!.style.height = `${nextHeight}px`
    }, height)
    await settleLayout(page)

    expect(await chat.evaluate((element) => element.scrollTop)).toBeCloseTo(nativeTop, 0)
    expect(await chat.evaluate((element) => element.scrollHeight)).toBeCloseTo(scrollHeight + height - 180, 0)
    expect(await anchor.evaluate((element) => element.isConnected)).toBe(true)
    expect(Math.abs(await anchor.evaluate((element) => element.getBoundingClientRect().top) - before)).toBeLessThan(1)

    await dispatchTouch(chat, 'touchend')
    await chat.dispatchEvent('scrollend')
    await settleLayout(page)
    expect(await chat.evaluate((element) => element.scrollTop)).toBeCloseTo(nativeTop, 0)
    expect(Math.abs(await anchor.evaluate((element) => element.getBoundingClientRect().top) - before)).toBeLessThan(1)
  })
}

for (const touching of [false, true]) {
  test(`new messages preserve the reader position away from the bottom (touch ${touching})`, async ({ page }) => {
    const chat = await openChat(page)
    await chat.evaluate((element) => { element.scrollTop = -1000 })
    await settleLayout(page)
    const anchor = await visibleAnchor(chat)
    const before = await anchor.evaluate((element) => element.getBoundingClientRect().top)
    if (touching) await dispatchTouch(chat, 'touchstart')
    await page.getByRole('button', { name: 'New message' }).evaluate((element) => (element as HTMLButtonElement).click())
    await expect(chat.locator('.vue-chat-virtual-scroll__item').first()).toHaveAttribute('aria-setsize', '21')
    await settleLayout(page)
    expect(await anchor.evaluate((element) => element.isConnected)).toBe(true)
    expect(Math.abs(await anchor.evaluate((element) => element.getBoundingClientRect().top) - before)).toBeLessThan(1)
    if (touching) {
      await dispatchTouch(chat, 'touchend')
      await chat.dispatchEvent('scrollend')
      await settleLayout(page)
      expect(Math.abs(await anchor.evaluate((element) => element.getBoundingClientRect().top) - before)).toBeLessThan(1)
    }
  })
}

for (const height of [300, 60]) {
  test(`an asynchronous resize below the viewport to ${height}px preserves the active reader`, async ({ page }) => {
    const chat = await openChat(page)
    await chat.evaluate((element) => {
      element.scrollTop = -(element.scrollHeight - element.clientHeight) / 2
    })
    await settleLayout(page)
    const anchor = await visibleAnchor(chat)
    const below = chat.locator('.vue-chat-virtual-scroll__item').last()
    expect(await below.evaluate((element) => {
      const viewport = element.closest('.vue-chat-virtual-scroll')!
      return element.getBoundingClientRect().top >= viewport.getBoundingClientRect().top + viewport.clientHeight
    })).toBe(true)
    const before = await anchor.evaluate((element) => element.getBoundingClientRect().top)
    const nativeTop = await chat.evaluate((element) => element.scrollTop)
    await dispatchTouch(chat, 'touchstart')
    await below.evaluate((element, nextHeight) => {
      element.querySelector<HTMLElement>('.chat-message')!.style.height = `${nextHeight}px`
    }, height)
    await settleLayout(page)
    expect(await chat.evaluate((element) => element.scrollTop)).toBeCloseTo(nativeTop, 0)
    expect(Math.abs(await anchor.evaluate((element) => element.getBoundingClientRect().top) - before)).toBeLessThan(1)
    await dispatchTouch(chat, 'touchend')
    await chat.dispatchEvent('scrollend')
    await settleLayout(page)
    expect(await chat.evaluate((element) => element.scrollTop)).toBeCloseTo(nativeTop - (height - 180), 0)
    expect(Math.abs(await anchor.evaluate((element) => element.getBoundingClientRect().top) - before)).toBeLessThan(1)
  })
}

test('cold variable-height history fills the viewport throughout upward traversal', async ({ page }) => {
  const chat = await openChat(page, false)
  await dispatchTouch(chat, 'touchstart')
  for (let step = 0; step < 12; step += 1) {
    await chat.evaluate((element) => { element.scrollTop -= 220 })
    await settleLayout(page)
    const geometry = await chat.evaluate((element) => {
      const viewportTop = element.getBoundingClientRect().top + element.clientTop
      const rows = Array.from(element.querySelectorAll<HTMLElement>('.vue-chat-virtual-scroll__item'))
      const rectangles = rows.map((row) => row.getBoundingClientRect())
      return {
        count: rows.length,
        coversTop: rectangles[0]!.top <= viewportTop + 1,
        coversBottom: rectangles.at(-1)!.bottom >= viewportTop + element.clientHeight - 1,
        contiguous: rectangles.every((rectangle, index) => index === 0 || Math.abs(rectangle.top - rectangles[index - 1]!.bottom) < 1),
      }
    })
    expect(geometry).toEqual({ count: expect.any(Number), coversTop: true, coversBottom: true, contiguous: true })
    expect(geometry.count).toBeLessThanOrEqual(12)
  }
  await dispatchTouch(chat, 'touchend')
  await chat.dispatchEvent('scrollend')
})

for (const [index, align] of [[7, 'start'], [3, 'center'], [6, 'end'], [10, 'end']] as const) {
  test(`public scrollToIndex(${index}, ${align}) retains alignment after first measurement`, async ({ page }) => {
    const chat = await openChat(page, false)
    const target = chat.locator(`[aria-posinset="${index + 1}"]`)
    if (index !== 10) await expect(target).toHaveCount(0)
    await scrollToIndex(chat, index, align)
    await expect(target).toBeAttached()
    await settleLayout(page)
    await expect(target).toBeAttached()
    const alignmentError = await target.evaluate((element, alignment) => {
      const viewport = element.closest('.vue-chat-virtual-scroll')!
      const viewportTop = viewport.getBoundingClientRect().top + viewport.clientTop
      const row = element.getBoundingClientRect()
      if (alignment === 'center') return row.top + row.height / 2 - viewportTop - viewport.clientHeight / 2
      if (alignment === 'end') return row.bottom - viewportTop - viewport.clientHeight
      return row.top - viewportTop
    }, align)
    expect(Math.abs(alignmentError)).toBeLessThan(1)
  })
}

test('explicit index alignment follows late resize and releases when the user starts scrolling', async ({ page }) => {
  const chat = await openChat(page)
  await scrollToIndex(chat, 10, 'start')
  const target = chat.locator('[aria-posinset="11"]')
  await expect(target).toBeAttached()
  await settleLayout(page)
  const targetTop = () => target.evaluate((element) => {
    const viewport = element.closest('.vue-chat-virtual-scroll')!
    return element.getBoundingClientRect().top - viewport.getBoundingClientRect().top - viewport.clientTop
  })
  expect(Math.abs(await targetTop())).toBeLessThan(1)

  await target.evaluate((element) => {
    element.previousElementSibling!.querySelector<HTMLElement>('.chat-message')!.style.height = '300px'
  })
  await settleLayout(page)
  expect(Math.abs(await targetTop())).toBeLessThan(1)
  await target.evaluate((element) => {
    element.querySelector<HTMLElement>('.chat-message')!.style.height = '300px'
  })
  await settleLayout(page)
  expect(Math.abs(await targetTop())).toBeLessThan(1)

  await dispatchTouch(chat, 'touchstart')
  const previousNative = await chat.evaluate((element) => element.scrollTop)
  await chat.evaluate((element) => { element.scrollTop -= 90 })
  await settleLayout(page)
  expect(await chat.evaluate((element) => element.scrollTop)).toBeCloseTo(previousNative - 90, 0)
  expect(await targetTop()).toBeCloseTo(90, 0)

  // Once the user takes over, resizing this message follows the reading anchor
  // instead of pulling the explicitly selected index back to the viewport top.
  await target.evaluate((element) => {
    element.querySelector<HTMLElement>('.chat-message')!.style.height = '420px'
  })
  await settleLayout(page)
  expect(await targetTop()).toBeCloseTo(-30, 0)
  await dispatchTouch(chat, 'touchend')
  await chat.dispatchEvent('scrollend')
  await settleLayout(page)
  expect(await targetTop()).toBeCloseTo(-30, 0)
})

test('smooth scrollToTop reaches the measured start of cold history', async ({ page }) => {
  const chat = await openChat(page, false)
  await chat.evaluate((element) => {
    const instance = (element as HTMLElement & {
      __vueParentComponent: { exposed: { scrollToTop(behavior: ScrollBehavior): void } }
    }).__vueParentComponent
    instance.exposed.scrollToTop('smooth')
  })
  // Observe the original history's top before the demo prepends another page.
  await expect.poll(() => chat.evaluate((element) =>
    element.scrollHeight - element.clientHeight + element.scrollTop,
  ), { timeout: 4000, intervals: [20, 50] }).toBeLessThanOrEqual(1)
})

test('user touch cancels a pending smooth destination', async ({ page }) => {
  const chat = await openChat(page, false)
  await chat.evaluate((element) => {
    const instance = (element as HTMLElement & {
      __vueParentComponent: { exposed: { scrollToTop(behavior: ScrollBehavior): void } }
    }).__vueParentComponent
    instance.exposed.scrollToTop('smooth')
  })
  await page.waitForTimeout(40)
  await dispatchTouch(chat, 'touchstart')
  // Simulate the native offset after user input takes over the animation.
  await chat.evaluate((element) => { element.scrollTop = -500 })
  await settleLayout(page)
  const readerTop = await chat.evaluate((element) => element.scrollTop)
  await dispatchTouch(chat, 'touchend')
  await chat.dispatchEvent('scrollend')
  await page.waitForTimeout(200)
  expect(await chat.evaluate((element) => element.scrollTop)).toBeCloseTo(readerTop, 0)
  expect(await chat.evaluate((element) => element.scrollHeight - element.clientHeight + element.scrollTop)).toBeGreaterThan(1000)
})

test('Chromium native touch can discover older rows without programmatic scroll writes', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP touch input is Chromium-specific')
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  try {
    const page = await context.newPage()
    const chat = await openChat(page, false)
    await chat.scrollIntoViewIfNeeded()
    await settleLayout(page)
    const initialFirst = Number(await chat.locator('.vue-chat-virtual-scroll__item').first().getAttribute('aria-posinset'))
    await chat.evaluate((element) => {
      const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop')!
      ;(element as HTMLElement).dataset.scrollWrites = '0'
      Object.defineProperty(element, 'scrollTop', {
        configurable: true,
        get() { return descriptor.get!.call(this) },
        set(value: number) {
          this.dataset.scrollWrites = String(Number(this.dataset.scrollWrites) + 1)
          descriptor.set!.call(this, value)
        },
      })
    })
    const session = await context.newCDPSession(page)
    const box = (await chat.boundingBox())!
    const x = Math.round(box.x + box.width / 2)
    const y = Math.round(Math.max(0, box.y) + 80)
    for (let gesture = 0; gesture < 5; gesture += 1) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      for (let distance = 30; distance <= 360; distance += 30) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + distance }] })
        await page.waitForTimeout(16)
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await settleLayout(page)
    }
    expect(await chat.evaluate((element) => element.scrollTop)).toBeLessThan(-1000)
    expect(Number(await chat.locator('.vue-chat-virtual-scroll__item').first().getAttribute('aria-posinset'))).toBeLessThan(initialFirst)
    expect(await chat.getAttribute('data-scroll-writes')).toBe('0')
  } finally {
    await context.close()
  }
})
