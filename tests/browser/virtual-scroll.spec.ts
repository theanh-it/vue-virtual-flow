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
        (element) =>
          element.scrollHeight - element.scrollTop - element.clientHeight,
      ),
    )
    .toBeLessThanOrEqual(1)
  expect(errors).toEqual([])
})
