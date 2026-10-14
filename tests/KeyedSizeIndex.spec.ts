import { describe, expect, it } from 'vitest'
import { createKeyedSizeIndex } from '../src/utils/keyedSizeIndex'

function entries(start: number, sizes: readonly number[]) {
  return sizes.map((size, offset) => ({ key: start + offset, size }))
}

describe('createKeyedSizeIndex', () => {
  it('supports logarithmic keyed append and prepend operations', () => {
    const index = createKeyedSizeIndex(entries(2, [20, 30, 40]))
    index.prepend(entries(0, [5, 10]))
    index.append(entries(5, [50, 60]))

    expect(index.length).toBe(7)
    expect(index.total).toBe(215)
    expect(Array.from({ length: 8 }, (_, row) => index.getOffset(row)))
      .toEqual([0, 5, 15, 35, 65, 105, 155, 215])
    expect(Array.from({ length: 7 }, (_, row) => index.getKey(row)))
      .toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(Array.from({ length: 7 }, (_, key) => index.getIndex(key)))
      .toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('keeps offsets, key ranks and offset lookup correct through measurements', () => {
    const sizes = Array.from({ length: 200 }, (_, row) => 10 + (row * 13) % 71)
    const index = createKeyedSizeIndex(entries(0, sizes))
    index.prepend(entries(-25, Array.from({ length: 25 }, () => 17)))
    sizes.unshift(...Array.from({ length: 25 }, () => 17))

    for (let update = 0; update < 80; update += 1) {
      const row = (update * 47) % sizes.length
      sizes[row] = 5 + (update * 19) % 123
      index.setSize(row, sizes[row])
    }

    let offset = 0
    for (let row = 0; row < sizes.length; row += 1) {
      expect(index.getOffset(row)).toBe(offset)
      expect(index.getSize(row)).toBe(sizes[row])
      expect(index.findIndex(offset)).toBe(row)
      expect(index.findIndex(offset + sizes[row] / 2)).toBe(row)
      expect(index.getIndex(index.getKey(row)!)).toBe(row)
      offset += sizes[row]
    }
    expect(index.total).toBe(offset)
  })

  it('rejects duplicate keys atomically', () => {
    expect(() => createKeyedSizeIndex([
      { key: 'same', size: 10 },
      { key: 'same', size: 20 },
    ])).toThrow('Duplicate item key `same`')

    const index = createKeyedSizeIndex([{ key: 1, size: 10 }])
    expect(() => index.append([
      { key: 2, size: 20 },
      { key: 1, size: 30 },
    ])).toThrow('Duplicate item key `1`')
    expect(index.length).toBe(1)
    expect(index.total).toBe(10)
  })
})
