import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { Component } from 'vue'
import WindowDynamicVirtualScroll from '../src/components/WindowDynamicVirtualScroll.vue'

interface TestItem {
  id: number
  label: string
}

class MockResizeObserver {
  static instances: MockResizeObserver[] = []

  readonly observe = vi.fn()
  readonly unobserve = vi.fn()
  readonly disconnect = vi.fn()

  constructor(readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this)
  }
}

const items: TestItem[] = Array.from({ length: 100 }, (_, index) => ({
  id: index,
  label: `Item ${index}`,
}))
const largeItems: TestItem[] = Array.from({ length: 2_000 }, (_, index) => ({
  id: index,
  label: `Item ${index}`,
}))
const TestWindowDynamicVirtualScroll =
  WindowDynamicVirtualScroll as Component
let nextFrameId = 0
let pendingFrames = new Map<number, FrameRequestCallback>()

function flushAnimationFrames() {
  const frames = Array.from(pendingFrames.values())
  pendingFrames.clear()
  frames.forEach((callback) => callback(performance.now()))
}

describe('WindowDynamicVirtualScroll', () => {
  beforeEach(() => {
    nextFrameId = 0
    pendingFrames = new Map()
    MockResizeObserver.instances = []
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        const id = ++nextFrameId
        pendingFrames.set(id, callback)
        return id
      }),
    )
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id: number) => pendingFrames.delete(id)),
    )
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 0,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 100,
    })
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('renders the window-visible range plus overscan', async () => {
    const wrapper = mount(TestWindowDynamicVirtualScroll, {
      props: {
        items,
        estimatedItemSize: 40,
        overscan: 1,
        itemKey: 'id',
      },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
      attachTo: document.body,
    })
    await nextTick()

    expect(
      wrapper.findAll('.vue-window-dynamic-virtual-scroll__item'),
    ).toHaveLength(4)
    expect(
      wrapper.get('.vue-window-dynamic-virtual-scroll__spacer').attributes(
        'style',
      ),
    ).toContain('height: 4000px')
    wrapper.unmount()
  })

  it('jumps directly to a distant index using window scroll', async () => {
    const wrapper = mount(TestWindowDynamicVirtualScroll, {
      props: {
        items: largeItems,
        estimatedItemSize: 40,
        overscan: 2,
        itemKey: 'id',
      },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
      attachTo: document.body,
    })

    await nextTick()

    wrapper.vm.scrollToIndex(999, {
      align: 'start',
      behavior: 'auto',
    })
    await nextTick()

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 39_960,
      behavior: 'auto',
    })

    expect(
      wrapper
        .findAll('.vue-window-dynamic-virtual-scroll__item')
        .some((item) => item.text() === 'Item 999'),
    ).toBe(true)

    wrapper.unmount()
  })

  it('restores a position relative to the start of the list', () => {
    const wrapper = mount(TestWindowDynamicVirtualScroll, {
      props: { items, estimatedItemSize: 40 },
    })
    const root = wrapper.get('.vue-window-dynamic-virtual-scroll').element
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      top: 250,
    } as DOMRect)

    wrapper.vm.scrollTo(600)

    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 850,
      behavior: 'auto',
    })
    wrapper.unmount()
  })

  it('emits load-more when the window approaches the component end', async () => {
    const wrapper = mount(TestWindowDynamicVirtualScroll, {
      props: {
        items,
        estimatedItemSize: 40,
        hasMore: true,
        loadMoreThreshold: 100,
      },
    })
    const root = wrapper.get('.vue-window-dynamic-virtual-scroll').element
    vi.spyOn(root, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          top: -window.scrollY,
        }) as DOMRect,
    )

    window.scrollY = 3_850
    window.dispatchEvent(new Event('scroll'))
    flushAnimationFrames()
    await nextTick()

    expect(wrapper.emitted('loadMore')).toHaveLength(1)
    wrapper.unmount()
  })

  it('coalesces window scroll events into one animation frame', async () => {
    const wrapper = mount(TestWindowDynamicVirtualScroll, {
      props: {
        items,
        estimatedItemSize: 40,
        overscan: 1,
      },
    })
    const root = wrapper.get('.vue-window-dynamic-virtual-scroll').element
    vi.spyOn(root, 'getBoundingClientRect').mockImplementation(
      () => ({ top: -window.scrollY }) as DOMRect,
    )

    window.scrollY = 80
    window.dispatchEvent(new Event('scroll'))
    window.scrollY = 120
    window.dispatchEvent(new Event('scroll'))
    window.scrollY = 160
    window.dispatchEvent(new Event('scroll'))

    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('scroll')).toBeUndefined()

    flushAnimationFrames()
    await nextTick()

    expect(wrapper.emitted('scroll')).toHaveLength(1)
    expect(wrapper.emitted('scroll')?.[0]?.[0]).toMatchObject({
      scrollTop: 160,
      startIndex: 3,
    })
    wrapper.unmount()
  })

  it('measures rows in a frame and preserves the viewport anchor', async () => {
    const wrapper = mount(TestWindowDynamicVirtualScroll, {
      props: {
        items,
        estimatedItemSize: 40,
        overscan: 1,
        itemKey: 'id',
      },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
      attachTo: document.body,
    })
    const root = wrapper.get('.vue-window-dynamic-virtual-scroll').element
    vi.spyOn(root, 'getBoundingClientRect').mockImplementation(
      () => ({ top: -window.scrollY }) as DOMRect,
    )

    window.scrollY = 200
    window.dispatchEvent(new Event('scroll'))
    flushAnimationFrames()
    await nextTick()

    const measuredItem = wrapper
      .findAll('.vue-window-dynamic-virtual-scroll__item')
      .find((item) => item.text() === 'Item 4')
    const itemObserver = MockResizeObserver.instances[1]

    expect(measuredItem).toBeDefined()
    expect(itemObserver.observe).toHaveBeenCalledWith(measuredItem?.element)

    itemObserver.callback(
      [
        {
          target: measuredItem?.element,
          contentRect: { height: 50 },
        } as unknown as ResizeObserverEntry,
      ],
      itemObserver as unknown as ResizeObserver,
    )
    itemObserver.callback(
      [
        {
          target: measuredItem?.element,
          contentRect: { height: 60 },
        } as unknown as ResizeObserverEntry,
      ],
      itemObserver as unknown as ResizeObserver,
    )

    expect(pendingFrames.size).toBe(1)
    expect(window.scrollTo).not.toHaveBeenCalled()
    flushAnimationFrames()
    await nextTick()

    expect(
      wrapper.get('.vue-window-dynamic-virtual-scroll__spacer').attributes(
        'style',
      ),
    ).toContain('height: 4020px')
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 220,
      behavior: 'auto',
    })
    wrapper.unmount()
  })

  it('resets measurements and load-more for a same-size data set', async () => {
    const wrapper = mount(TestWindowDynamicVirtualScroll, {
      props: {
        items,
        estimatedItemSize: 40,
        itemKey: 'id',
        hasMore: true,
        loadMoreThreshold: 100,
      },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
      attachTo: document.body,
    })
    const root = wrapper.get('.vue-window-dynamic-virtual-scroll').element
    vi.spyOn(root, 'getBoundingClientRect').mockImplementation(
      () => ({ top: -window.scrollY }) as DOMRect,
    )
    const firstItem = wrapper.find(
      '.vue-window-dynamic-virtual-scroll__item',
    ).element
    const itemObserver = MockResizeObserver.instances[1]

    itemObserver.callback(
      [
        {
          target: firstItem,
          contentRect: { height: 80 },
        } as unknown as ResizeObserverEntry,
      ],
      itemObserver as unknown as ResizeObserver,
    )
    flushAnimationFrames()
    await nextTick()

    window.scrollY = 3_850
    window.dispatchEvent(new Event('scroll'))
    flushAnimationFrames()
    await nextTick()
    expect(wrapper.emitted('loadMore')).toHaveLength(1)

    const replacementItems = items.map((item) => ({
      id: item.id + 1_000,
      label: `Replacement ${item.id}`,
    }))
    await wrapper.setProps({ items: replacementItems })
    await nextTick()

    expect(wrapper.emitted('loadMore')).toHaveLength(2)
    expect(
      wrapper.get('.vue-window-dynamic-virtual-scroll__spacer').attributes(
        'style',
      ),
    ).toContain('height: 4000px')
    wrapper.unmount()
  })

  it('cleans up observers, listeners, and pending frames', () => {
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const wrapper = mount(TestWindowDynamicVirtualScroll, {
      props: { items, estimatedItemSize: 40 },
    })
    const itemObserver = MockResizeObserver.instances[1]
    const firstItem = wrapper.find(
      '.vue-window-dynamic-virtual-scroll__item',
    ).element

    window.dispatchEvent(new Event('scroll'))
    itemObserver.callback(
      [
        {
          target: firstItem,
          contentRect: { height: 80 },
        } as unknown as ResizeObserverEntry,
      ],
      itemObserver as unknown as ResizeObserver,
    )
    expect(pendingFrames.size).toBe(2)
    wrapper.unmount()

    expect(removeEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
    )
    expect(removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    )
    expect(MockResizeObserver.instances[0]?.disconnect).toHaveBeenCalledOnce()
    expect(MockResizeObserver.instances[1]?.disconnect).toHaveBeenCalledOnce()
    expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(2)
    expect(pendingFrames.size).toBe(0)
  })
})
