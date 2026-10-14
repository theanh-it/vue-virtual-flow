import { describe, expect, it } from 'vitest'
import { createCarouselLayout, wrapCarouselIndex } from '../src/utils/carouselLayout'

describe('carousel variable-width geometry', () => {
  it('locates mixed-width slides and resolves the nearest snap', () => {
    const layout = createCarouselLayout([100, 240, 60], 10)
    expect(layout.offsets).toEqual([0, 110, 360, 430])
    expect(layout.totalWidth).toBe(420)
    expect(layout.indexAt(200)).toBe(1)
    expect(layout.nearestIndex(350)).toBe(2)
    expect(layout.indexAt(-20)).toBe(0)
    expect(layout.indexAt(10_000)).toBe(2)
  })
  it('wraps negative and multi-cycle indices without duplicating data', () => {
    expect(wrapCarouselIndex(-1, 20)).toBe(19)
    expect(wrapCarouselIndex(41, 20)).toBe(1)
    expect(wrapCarouselIndex(8, 0)).toBe(0)
  })
})
