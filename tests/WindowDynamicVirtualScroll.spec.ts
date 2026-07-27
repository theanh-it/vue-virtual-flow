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

describe('WindowDynamicVirtualScroll', () => {
  beforeEach(() => {
    MockResizeObserver.instances = []
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
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
    })

    wrapper.vm.scrollToIndex(999, {
      align: 'start',
      behavior: 'smooth',
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
    await nextTick()

    expect(wrapper.emitted('loadMore')).toHaveLength(1)
  })
})
