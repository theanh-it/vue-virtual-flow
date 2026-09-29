import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

async function dispatchTouch(chat: Locator, type: 'touchstart' | 'touchend') {
  // Desktop Firefox has no TouchEvent constructor, but can exercise the handlers.
  await chat.evaluate((element, eventType) => {
    const event = new Event(eventType)
    Object.defineProperty(event, 'touches', { value: [] })
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

async function openChat(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  // Isolate scroll anchoring from external image/video downloads.
  await page.route(/https:\/\//, (route) => route.abort())
  await page.goto('/#/chat')
  const chat = page.getByRole('log', { name: 'Community chat' })
  await expect(chat.locator('[aria-posinset="20"]')).toBeAttached()
  await page.addStyleTag({ content: '.chat-message { height: 180px; overflow: hidden; }' })
  await settleLayout(page)
  return chat
}

for (const touching of [false, true]) {
  test(`prepend keeps the same visible DOM and anchor (touch ${touching})`, async ({ page }) => {
    const chat = await openChat(page)
    await chat.evaluate((element) => { element.scrollTop = 100 })
    await expect(chat.getByRole('status')).toBeAttached()
    await settleLayout(page)

    const anchor = await chat.locator('[aria-posinset="1"]').elementHandle()
    expect(anchor).not.toBeNull()
    const before = await anchor!.boundingBox()
    const nativeTop = await chat.evaluate((element) => element.scrollTop)
    if (touching) await dispatchTouch(chat, 'touchstart')

    await expect(chat.locator('[aria-posinset="21"]')).toHaveAttribute('aria-setsize', '40')
    await settleLayout(page)
    expect(await anchor!.evaluate((element) => element.isConnected)).toBe(true)
    expect(Math.abs((await anchor!.boundingBox())!.y - before!.y)).toBeLessThan(1)

    if (touching) {
      expect(await chat.evaluate((element) => element.scrollTop)).toBe(nativeTop)
      await dispatchTouch(chat, 'touchend')
      await chat.dispatchEvent('scrollend')
      await settleLayout(page)
      expect(await chat.evaluate((element) => element.scrollTop)).toBeGreaterThan(nativeTop)
      expect(Math.abs((await anchor!.boundingBox())!.y - before!.y)).toBeLessThan(1)
    }
    expect(await chat.locator('.vue-chat-virtual-scroll__item').count()).toBeLessThanOrEqual(12)
  })
}

for (const [height, nearBottom] of [[300, false], [60, false], [60, true]] as const) {
  test(`touch resize to ${height}px preserves the visual anchor until scrollend (near bottom ${nearBottom})`, async ({ page }) => {
    const chat = await openChat(page)
    await chat.evaluate((element, atBottom) => {
      const maximum = element.scrollHeight - element.clientHeight
      element.scrollTop = atBottom ? maximum - 20 : maximum / 2
    }, nearBottom)
    await settleLayout(page)
    const anchor = await chat.evaluateHandle((element) => {
      const top = element.getBoundingClientRect().top + element.clientTop
      return Array.from(element.querySelectorAll<HTMLElement>('.vue-chat-virtual-scroll__item'))
        .find((row) => row.getBoundingClientRect().bottom > top)!
    })
    const above = await anchor.evaluateHandle((element) => element.previousElementSibling as HTMLElement)
    const before = await anchor.evaluate((element) => element.getBoundingClientRect().top)
    const nativeTop = await chat.evaluate((element) => element.scrollTop)
    const scrollHeight = await chat.evaluate((element) => element.scrollHeight)
    await dispatchTouch(chat, 'touchstart')
    await above.evaluate((element, nextHeight) => {
      element.querySelector<HTMLElement>('.chat-message')!.style.height = `${nextHeight}px`
    }, height)
    await settleLayout(page)

    expect(await chat.evaluate((element) => element.scrollTop)).toBe(nativeTop)
    expect(await chat.evaluate((element) => element.scrollHeight)).toBe(scrollHeight)
    expect(await anchor.evaluate((element) => element.isConnected)).toBe(true)
    expect(Math.abs(await anchor.evaluate((element) => element.getBoundingClientRect().top) - before)).toBeLessThan(1)

    await dispatchTouch(chat, 'touchend')
    await chat.dispatchEvent('scrollend')
    await settleLayout(page)
    expect(await chat.evaluate((element) => element.scrollTop)).toBeCloseTo(nativeTop + height - 180, 0)
    expect(Math.abs(await anchor.evaluate((element) => element.getBoundingClientRect().top) - before)).toBeLessThan(1)
  })
}
