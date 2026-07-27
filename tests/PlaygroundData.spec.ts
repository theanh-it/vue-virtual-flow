import { describe, expect, it } from 'vitest'
import { feedItems } from '../playground/data'

describe('playground Faker data', () => {
  it('creates deterministic feed items with all required fields', () => {
    expect(feedItems).toHaveLength(2_000)
    expect(new Set(feedItems.map((item) => item.id)).size).toBe(2_000)

    for (const item of feedItems.slice(0, 20)) {
      expect(item.title).not.toBe('')
      expect(item.image).toMatch(/^https:\/\//)
      expect(item.description).not.toBe('')
    }
  })
})
