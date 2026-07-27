import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import VirtualScroll from '../src/components/VirtualScroll.vue'

interface TestItem {
  id: number
  label: string
}

const items: TestItem[] = Array.from({ length: 100 }, (_, index) => ({
  id: index,
  label: `Item ${index}`,
}))
const TestVirtualScroll = VirtualScroll as Component

describe('VirtualScroll', () => {
  it('defaults to a 400px viewport', () => {
    const wrapper = mount(TestVirtualScroll, {
      props: {
        items,
        itemSize: 40,
      },
    })

    expect(wrapper.attributes('style')).toContain('height: 400px')
  })

  it('supports fill height and warns when the parent has no height', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const wrapper = mount(TestVirtualScroll, {
      props: {
        items,
        itemSize: 40,
        height: 'fill',
      },
    })

    expect(wrapper.attributes('style')).toContain('height: 100%')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('viewport resolved to 0px high'),
    )

    wrapper.unmount()
    warn.mockRestore()
  })

  it('only renders items inside the visible range and overscan', () => {
    const wrapper = mount(TestVirtualScroll, {
      props: {
        items,
        itemSize: 40,
        height: 200,
        overscan: 2,
        itemKey: 'id',
      },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
    })

    const renderedItems = wrapper.findAll('.vue-virtual-scroll__item')

    expect(renderedItems).toHaveLength(7)
    expect(renderedItems[0].text()).toBe('Item 0')
    expect(renderedItems.at(-1)?.text()).toBe('Item 6')
    expect(wrapper.find('.vue-virtual-scroll__spacer').attributes('style')).toContain(
      'height: 4000px',
    )
  })

  it('updates the rendered range and emits details when scrolled', async () => {
    const wrapper = mount(TestVirtualScroll, {
      props: {
        items,
        itemSize: 40,
        height: 200,
        overscan: 2,
      },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
    })

    const viewport = wrapper.get('.vue-virtual-scroll')
    Object.defineProperty(viewport.element, 'scrollTop', {
      configurable: true,
      value: 400,
    })
    await viewport.trigger('scroll')

    expect(wrapper.findAll('.vue-virtual-scroll__item')[0].text()).toBe('Item 8')
    expect(wrapper.emitted('scroll')?.[0]).toEqual([
      {
        scrollTop: 400,
        startIndex: 8,
        endIndex: 17,
      },
    ])
  })

  it('exposes an imperative scrollToIndex method', () => {
    const wrapper = mount(TestVirtualScroll, {
      props: {
        items,
        itemSize: 40,
        height: 200,
      },
    })
    const scrollTo = vi.fn()
    const viewport = wrapper.get('.vue-virtual-scroll').element
    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: 200,
    })
    viewport.scrollTo = scrollTo

    wrapper.vm.scrollToIndex(10, { align: 'center', behavior: 'smooth' })

    expect(scrollTo).toHaveBeenCalledWith({
      top: 320,
      behavior: 'smooth',
    })
  })

  it('restores an exact scroll position and clamps it to the list', () => {
    const wrapper = mount(TestVirtualScroll, {
      props: { items, itemSize: 40, height: 200 },
    })
    const viewport = wrapper.get('.vue-virtual-scroll').element
    const nativeScrollTo = vi.fn()
    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: 200,
    })
    viewport.scrollTo = nativeScrollTo

    wrapper.vm.scrollTo(725)
    wrapper.vm.scrollTo(-100)

    expect(nativeScrollTo).toHaveBeenNthCalledWith(1, {
      top: 725,
      behavior: 'auto',
    })
    expect(nativeScrollTo).toHaveBeenNthCalledWith(2, {
      top: 0,
      behavior: 'auto',
    })
  })

  it('renders the empty slot when there are no items', () => {
    const wrapper = mount(TestVirtualScroll, {
      props: {
        items: [],
        itemSize: 40,
        height: 200,
      },
      slots: {
        empty: 'Nothing here',
      },
    })

    expect(wrapper.text()).toContain('Nothing here')
    expect(wrapper.find('.vue-virtual-scroll__spacer').exists()).toBe(false)
  })

  it('emits load-more once when the viewport reaches the threshold', async () => {
    const wrapper = mount(TestVirtualScroll, {
      props: {
        items,
        itemSize: 40,
        height: 200,
        hasMore: true,
        loadMoreThreshold: 100,
      },
    })
    const viewport = wrapper.get('.vue-virtual-scroll')

    Object.defineProperty(viewport.element, 'clientHeight', {
      configurable: true,
      value: 200,
    })
    Object.defineProperty(viewport.element, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 3_750,
    })

    await viewport.trigger('scroll')
    await viewport.trigger('scroll')

    expect(wrapper.emitted('loadMore')).toHaveLength(1)
  })

  it('renders a custom loading item after the data rows', () => {
    const wrapper = mount(TestVirtualScroll, {
      props: {
        items,
        itemSize: 40,
        height: 200,
        loading: true,
        loadingItemSize: 64,
      },
      slots: {
        loading: 'Fetching the next page',
      },
    })

    expect(wrapper.get('.vue-virtual-scroll__loading').text()).toBe(
      'Fetching the next page',
    )
    expect(wrapper.get('.vue-virtual-scroll__spacer').attributes('style')).toContain(
      'height: 4064px',
    )
  })
})
