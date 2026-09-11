import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { Component } from 'vue'
import WindowGirdVirtualScroll from '../src/components/WindowGirdVirtualScroll.vue'

interface TestItem {
  id: number
  label: string
}

class MockResizeObserver {
  readonly observe = vi.fn()
  readonly disconnect = vi.fn()
}

const items: TestItem[] = Array.from({ length: 100 }, (_, index) => ({
  id: index,
  label: `Item ${index}`,
}))
const TestWindowGirdVirtualScroll = WindowGirdVirtualScroll as Component

describe('WindowGirdVirtualScroll', () => {
  beforeEach(() => {
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

  it('renders visible rows and calculates the grid height', async () => {
    const wrapper = mount(TestWindowGirdVirtualScroll, {
      props: {
        items,
        itemSize: 40,
        columns: 4,
        gap: 8,
        overscan: 1,
        itemKey: 'id',
      },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
    })
    await nextTick()

    expect(
      wrapper.findAll('.vue-window-gird-virtual-scroll__item'),
    ).toHaveLength(16)
    expect(
      wrapper.get('.vue-window-gird-virtual-scroll__spacer').attributes(
        'style',
      ),
    ).toContain('height: 1192px')
    expect(
      wrapper.get('.vue-window-gird-virtual-scroll__content').attributes(
        'style',
      ),
    ).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))')
  })

  it('passes grid coordinates to the item slot', async () => {
    const coordinates: string[] = []
    mount(TestWindowGirdVirtualScroll, {
      props: {
        items: items.slice(0, 6),
        itemSize: 40,
        columns: 3,
      },
      slots: {
        default: ({
          rowIndex,
          columnIndex,
        }: {
          rowIndex: number
          columnIndex: number
        }) => coordinates.push(`${rowIndex}:${columnIndex}`),
      },
    })
    await nextTick()

    expect(coordinates).toEqual([
      '0:0',
      '0:1',
      '0:2',
      '1:0',
      '1:1',
      '1:2',
    ])
  })

  it('scrolls to the row containing a requested item', async () => {
    const wrapper = mount(TestWindowGirdVirtualScroll, {
      props: {
        items,
        itemSize: 40,
        columns: 4,
        gap: 8,
      },
      attachTo: document.body,
    })
    await nextTick()

    wrapper.vm.scrollToIndex(41, { behavior: 'auto' })

    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 480,
      behavior: 'auto',
    })
    wrapper.unmount()
  })

  it('emits load-more when the window approaches the grid end', async () => {
    const wrapper = mount(TestWindowGirdVirtualScroll, {
      props: {
        items,
        itemSize: 40,
        columns: 4,
        gap: 8,
        hasMore: true,
        loadMoreThreshold: 100,
      },
    })
    const root = wrapper.get('.vue-window-gird-virtual-scroll').element
    vi.spyOn(root, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          top: -window.scrollY,
        }) as DOMRect,
    )

    window.scrollY = 1_050
    window.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(wrapper.emitted('loadMore')).toHaveLength(1)
  })
})
