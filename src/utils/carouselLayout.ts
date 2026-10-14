export function wrapCarouselIndex(index: number, count: number) {
  return count > 0 ? ((index % count) + count) % count : 0
}

export function createCarouselLayout(widths: readonly number[], gap: number) {
  const offsets = new Array<number>(widths.length + 1)
  offsets[0] = 0
  for (let index = 0; index < widths.length; index += 1) {
    offsets[index + 1] = offsets[index] + widths[index] + gap
  }
  const cycleWidth = offsets[widths.length]
  const totalWidth = Math.max(0, cycleWidth - (widths.length ? gap : 0))

  function indexAt(position: number) {
    if (!widths.length) return 0
    let low = 0
    let high = widths.length - 1
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      if (offsets[mid] <= position) low = mid
      else high = mid - 1
    }
    return low
  }

  function nearestIndex(position: number) {
    const index = indexAt(position)
    const next = Math.min(widths.length - 1, index + 1)
    return position - offsets[index] <= offsets[next] - position ? index : next
  }

  return { offsets, cycleWidth, totalWidth, indexAt, nearestIndex }
}
