import { describe, expect, it, vi } from 'vitest'
import {
  DynamicVirtualScroll,
  VirtualList,
  VueVirtualScroll,
} from '../src'

describe('public API', () => {
  it('exports VirtualList as the simple dynamic-list entry point', () => {
    expect(VirtualList).toBe(DynamicVirtualScroll)
  })

  it('registers VirtualList through the plugin', () => {
    const component = vi.fn()

    VueVirtualScroll.install?.({ component } as never)

    expect(component).toHaveBeenCalledWith('VirtualList', VirtualList)
  })
})
