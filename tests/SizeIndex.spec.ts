import { describe, expect, it } from 'vitest'
import { createSizeIndex } from '../src/utils/sizeIndex'

describe('createSizeIndex', () => {
  it('supports an empty list', () => {
    const index = createSizeIndex([])

    expect(index.length).toBe(0)
    expect(index.total).toBe(0)
    expect(index.getOffset(0)).toBe(0)
    expect(index.findIndex(-100)).toBe(0)
    expect(index.findIndex(0)).toBe(0)
    expect(index.findIndex(100)).toBe(0)
  })

  it('builds row offsets without retaining or changing the input array', () => {
    const sizes = [30, 70, 15, 85, 50]
    const index = createSizeIndex(sizes)
    sizes[0] = 900

    expect(index.length).toBe(5)
    expect(index.total).toBe(250)
    expect(Array.from({ length: 6 }, (_, row) => index.getOffset(row)))
      .toEqual([0, 30, 100, 115, 200, 250])
    expect(index.getSize(0)).toBe(30)
    expect(index.getSize(4)).toBe(50)

    index.setSize(1, 60)
    expect(sizes).toEqual([900, 70, 15, 85, 50])
  })

  it('selects the row covering an offset and the following row at boundaries', () => {
    const index = createSizeIndex([30, 70, 15, 85, 50])
    const cases = [
      [-Infinity, 0], [-1, 0], [0, 0], [29.75, 0],
      [30, 1], [99.75, 1], [100, 2], [114.75, 2],
      [115, 3], [199.75, 3], [200, 4], [250, 4], [Infinity, 4],
    ]

    for (const [offset, expected] of cases) {
      expect(index.findIndex(offset), `offset ${offset}`).toBe(expected)
    }
  })

  it('keeps the only row selected after its size changes', () => {
    const index = createSizeIndex([30])
    index.setSize(0, 12.5)

    expect(index.getOffset(1)).toBe(12.5)
    expect(index.total).toBe(12.5)
    for (const offset of [-1, 0, 12, 12.5, 100]) {
      expect(index.findIndex(offset)).toBe(0)
    }
  })

  it('updates first, middle, and last row sizes including fractional heights', () => {
    const index = createSizeIndex([10, 20, 30, 40, 50])
    index.setSize(0, 12.25)
    index.setSize(2, 3.5)
    index.setSize(4, 60.75)
    index.setSize(4, 60.75)

    expect(index.total).toBe(136.5)
    expect(Array.from({ length: 6 }, (_, row) => index.getOffset(row)))
      .toEqual([0, 12.25, 32.25, 35.75, 75.75, 136.5])
    expect(index.getSize(2)).toBe(3.5)
    expect(index.findIndex(35.5)).toBe(2)
    expect(index.findIndex(35.75)).toBe(3)
    expect(index.findIndex(75.75)).toBe(4)
  })

  it('stays consistent with cumulative sizes through repeated measurement batches', () => {
    const sizes = Array.from({ length: 257 }, (_, row) => 20 + (row * 17) % 81)
    const index = createSizeIndex(sizes)

    for (let batch = 0; batch < 12; batch += 1) {
      for (let update = 0; update < 19; update += 1) {
        const row = (batch * 31 + update * 13) % sizes.length
        sizes[row] = 1 + ((batch + update) * 23) % 193 + 0.25
        index.setSize(row, sizes[row])
      }

      let offset = 0
      for (let row = 0; row < sizes.length; row += 1) {
        expect(index.getSize(row)).toBe(sizes[row])
        expect(index.getOffset(row)).toBe(offset)
        expect(index.findIndex(offset)).toBe(row)
        expect(index.findIndex(offset + sizes[row] / 2)).toBe(row)
        if (row > 0) expect(index.findIndex(offset - 0.125)).toBe(row - 1)
        offset += sizes[row]
      }

      expect(index.total).toBe(offset)
      expect(index.getOffset(sizes.length)).toBe(offset)
      expect(index.findIndex(offset)).toBe(sizes.length - 1)
    }
  })
})
