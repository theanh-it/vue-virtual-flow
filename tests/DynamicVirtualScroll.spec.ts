import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { Component } from 'vue'
import DynamicVirtualScroll from '../src/components/DynamicVirtualScroll.vue'

interface TestItem {
  id: number
  label: string
}

class MockResizeObserver {
  static instances: MockResizeObserver[] = []

  readonly observe = vi.fn()
  readonly unobserve = vi.fn()
  readonly disconnect = vi.fn()

  constructor(private readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this)
  }

  trigger(element: Element, height: number) {
    this.callback(
      [
        {
          target: element,
          borderBoxSize: [{ blockSize: height, inlineSize: 0 }],
          contentBoxSize: [{ blockSize: height, inlineSize: 0 }],
          contentRect: { height },
          devicePixelContentBoxSize: [],
        } as unknown as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    )
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
const TestDynamicVirtualScroll = DynamicVirtualScroll as Component

function dispatchTouch(
  element: Element,
  type: 'touchstart' | 'touchmove' | 'touchend',
  clientY?: number,
) {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(event, 'touches', {
    value: clientY === undefined ? [] : [{ clientY }],
  })
  element.dispatchEvent(event)
}

describe('DynamicVirtualScroll', () => {
  beforeEach(() => {
    MockResizeObserver.instances = []
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('works with simple defaults and infers object ids as keys', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const wrapper = mount(TestDynamicVirtualScroll, {
      props: { items },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
    })

    expect(wrapper.attributes('style')).toContain('height: 400px')
    expect(
      wrapper.get('.vue-dynamic-virtual-scroll__spacer').attributes('style'),
    ).toContain('height: 4800px')
    expect(warn).not.toHaveBeenCalled()

    wrapper.unmount()
    warn.mockRestore()
  })

  it('uses the estimated size before item measurements are available', () => {
    const wrapper = mount(TestDynamicVirtualScroll, {
      attachTo: document.body,
      props: {
        items,
        estimatedItemSize: 40,
        height: 100,
        overscan: 1,
        itemKey: 'id',
      },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
    })

    expect(wrapper.findAll('.vue-dynamic-virtual-scroll__item')).toHaveLength(4)
    expect(
      wrapper.find('.vue-dynamic-virtual-scroll__spacer').attributes('style'),
    ).toContain('height: 4000px')
  })

  it('updates total height and item offsets after measuring a row', async () => {
    const wrapper = mount(TestDynamicVirtualScroll, {
      props: {
        items,
        estimatedItemSize: 40,
        height: 100,
        overscan: 1,
        itemKey: 'id',
      },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
    })

    const renderedItems = wrapper.findAll('.vue-dynamic-virtual-scroll__item')
    const itemObserver = MockResizeObserver.instances[1]
    itemObserver.trigger(renderedItems[0].element, 60)
    await nextTick()

    expect(
      wrapper.find('.vue-dynamic-virtual-scroll__spacer').attributes('style'),
    ).toContain('height: 4020px')
    expect(
      wrapper.findAll('.vue-dynamic-virtual-scroll__item')[1].attributes('style'),
    ).toContain('translateY(60px)')
  })

  it('keeps the viewport anchored when a row above it changes height', async () => {
    const wrapper = mount(TestDynamicVirtualScroll, {
      attachTo: document.body,
      props: {
        items,
        estimatedItemSize: 40,
        height: 100,
        overscan: 10,
        itemKey: 'id',
      },
    })
    const viewport = wrapper.get('.vue-dynamic-virtual-scroll')
    const firstItem = wrapper.findAll('.vue-dynamic-virtual-scroll__item')[0]
    const itemObserver = MockResizeObserver.instances[1]

    Object.defineProperty(viewport.element, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 200,
    })
    await viewport.trigger('scroll')

    itemObserver.trigger(firstItem.element, 60)
    await nextTick()
    await nextTick()

    expect((viewport.element as HTMLElement).scrollTop).toBe(220)
  })

  it('scrolls to an index using measured and estimated row sizes', async () => {
    const wrapper = mount(TestDynamicVirtualScroll, {
      props: {
        items,
        estimatedItemSize: 40,
        height: 100,
        itemKey: 'id',
      },
    })
    const viewport = wrapper.get('.vue-dynamic-virtual-scroll').element
    const firstItem = wrapper.findAll('.vue-dynamic-virtual-scroll__item')[0]
    const itemObserver = MockResizeObserver.instances[1]
    const scrollTo = vi.fn()

    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: 100,
    })
    viewport.scrollTo = scrollTo

    itemObserver.trigger(firstItem.element, 60)
    await nextTick()
    wrapper.vm.scrollToIndex(3, {
      align: 'start',
      behavior: 'smooth',
    })

    expect(scrollTo).toHaveBeenCalledWith({
      top: 140,
      behavior: 'smooth',
    })
  })

  it('restores a pixel scroll position', () => {
    const wrapper = mount(TestDynamicVirtualScroll, {
      props: { items, estimatedItemSize: 40, height: 100 },
    })
    const viewport = wrapper.get('.vue-dynamic-virtual-scroll').element
    const nativeScrollTo = vi.fn()
    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: 100,
    })
    viewport.scrollTo = nativeScrollTo

    wrapper.vm.scrollTo(615)

    expect(nativeScrollTo).toHaveBeenCalledWith({
      top: 615,
      behavior: 'auto',
    })
  })

  it('jumps directly to a distant index without measuring intermediate rows', async () => {
    const wrapper = mount(TestDynamicVirtualScroll, {
      props: {
        items: largeItems,
        estimatedItemSize: 40,
        height: 100,
        itemKey: 'id',
      },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
    })
    const viewport = wrapper.get('.vue-dynamic-virtual-scroll').element
    const scrollTo = vi.fn()

    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: 100,
    })
    viewport.scrollTo = scrollTo

    wrapper.vm.scrollToIndex(999, {
      align: 'start',
      behavior: 'smooth',
    })
    await nextTick()

    expect(scrollTo).toHaveBeenCalledWith({
      top: 39_960,
      behavior: 'smooth',
    })
    
    // Manually set scrollTop and trigger scroll event since scrollTo is mocked
    Object.defineProperty(viewport, 'scrollTop', {
      configurable: true,
      value: 39_960,
    })
    viewport.dispatchEvent(new Event('scroll'))
    await nextTick()
    
    expect(
      wrapper.findAll('.vue-dynamic-virtual-scroll__item').some(
        (item) => item.text() === 'Item 999',
      ),
    ).toBe(true)
  })

  it('does not request another page while a load is in progress', async () => {
    const wrapper = mount(TestDynamicVirtualScroll, {
      props: {
        items,
        estimatedItemSize: 40,
        height: 100,
        hasMore: true,
        loading: true,
        loadMoreThreshold: 100,
      },
    })
    const viewport = wrapper.get('.vue-dynamic-virtual-scroll')

    Object.defineProperty(viewport.element, 'clientHeight', {
      configurable: true,
      value: 100,
    })
    Object.defineProperty(viewport.element, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 3_850,
    })

    await viewport.trigger('scroll')

    expect(wrapper.emitted('loadMore')).toBeUndefined()
  })

  it('includes the loading item in the dynamic spacer height', () => {
    const wrapper = mount(TestDynamicVirtualScroll, {
      props: {
        items,
        estimatedItemSize: 40,
        height: 100,
        loading: true,
        loadingItemSize: 60,
      },
      slots: {
        loading: 'Loading more cards',
      },
    })

    expect(wrapper.get('.vue-dynamic-virtual-scroll__loading').text()).toBe(
      'Loading more cards',
    )
    expect(
      wrapper.get('.vue-dynamic-virtual-scroll__spacer').attributes('style'),
    ).toContain('height: 4060px')
  })

  it('emits refresh after pulling past the threshold at scroll top', async () => {
    const wrapper = mount(TestDynamicVirtualScroll, {
      props: {
        items,
        estimatedItemSize: 40,
        height: 100,
        pullToRefresh: true,
        pullRefreshThreshold: 64,
      },
    })
    const viewport = wrapper.get('.vue-dynamic-virtual-scroll')

    Object.defineProperty(viewport.element, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0,
    })

    dispatchTouch(viewport.element, 'touchstart', 100)
    dispatchTouch(viewport.element, 'touchmove', 260)
    await nextTick()

    expect(viewport.classes()).toContain(
      'vue-dynamic-virtual-scroll--pulling',
    )
    expect(
      wrapper.get('.vue-dynamic-virtual-scroll__spacer').attributes('style'),
    ).toContain('translateY(80px)')
    expect(wrapper.get('.vue-dynamic-virtual-scroll__refresh').text()).toBe(
      'Release to refresh',
    )

    dispatchTouch(viewport.element, 'touchend')
    expect(wrapper.emitted('refresh')).toHaveLength(1)

    await wrapper.setProps({ refreshing: true })
    expect(wrapper.get('.vue-dynamic-virtual-scroll__refresh').text()).toBe(
      'Refreshing…',
    )
  })
})
