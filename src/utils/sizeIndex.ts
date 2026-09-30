export interface SizeIndex {
  readonly length: number
  readonly total: number
  getSize(index: number): number
  getOffset(index: number): number
  setSize(index: number, size: number): void
  findIndex(offset: number): number
}

/**
 * Indexes row sizes with O(n) construction and O(log n) prefix queries,
 * updates, and offset lookups. The row count is fixed; rebuild when it changes.
 * Callers provide finite, positive sizes and valid integer indices, with
 * getOffset accepting length to query the end of the list.
 */
export function createSizeIndex(initialSizes: readonly number[]): SizeIndex {
  const sizes = Float64Array.from(initialSizes)
  const length = sizes.length
  const tree = new Float64Array(length + 1)
  let total = 0

  for (let index = 1; index <= length; index += 1) {
    const size = sizes[index - 1]
    total += size
    tree[index] += size
    const parent = index + (index & -index)
    if (parent <= length) tree[parent] += tree[index]
  }

  let highestBit = 1
  while (highestBit * 2 <= length) highestBit *= 2

  return {
    length,
    get total() {
      return total
    },
    getSize(index) {
      return sizes[index]
    },
    getOffset(index) {
      let offset = 0
      for (let cursor = index; cursor > 0; cursor -= cursor & -cursor) {
        offset += tree[cursor]
      }
      return offset
    },
    setSize(index, size) {
      const delta = size - sizes[index]
      if (delta === 0) return

      sizes[index] = size
      total += delta
      for (let cursor = index + 1; cursor <= length; cursor += cursor & -cursor) {
        tree[cursor] += delta
      }
    },
    findIndex(offset) {
      if (length === 0 || offset <= 0) return 0
      if (offset >= total) return length - 1

      // Find the largest prefix whose sum is <= offset, so an exact row
      // boundary selects the following row rather than the preceding one.
      let index = 0
      let prefix = 0
      for (let step = highestBit; step > 0; step = Math.floor(step / 2)) {
        const candidate = index + step
        if (candidate <= length && prefix + tree[candidate] <= offset) {
          index = candidate
          prefix += tree[candidate]
        }
      }
      return Math.min(index, length - 1)
    },
  }
}
