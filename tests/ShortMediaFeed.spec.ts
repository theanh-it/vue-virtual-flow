import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h, nextTick, type Component } from 'vue'
import ShortMediaFeed from '../src/components/ShortMediaFeed.vue'

interface TestItem {
  id: number
  label: string
}

const items: TestItem[] = Array.from({ length: 100 }, (_, index) => ({
  id: index,
  label: `Media ${index}`,
}))
const TestShortMediaFeed = ShortMediaFeed as Component

describe('ShortMediaFeed', () => {
  it('only mounts the active item and its buffer', () => {
    const wrapper = mount(TestShortMediaFeed, {
      props: {
        items,
        activeIndex: 50,
        buffer: 1,
        height: 600,
        itemKey: 'id',
      },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
    })

    const renderedItems = wrapper.findAll('.vue-short-media-feed__item')

    expect(renderedItems).toHaveLength(3)
    expect(renderedItems.map((item) => item.text())).toEqual([
      'Media 49',
      'Media 50',
      'Media 51',
    ])
    expect(
      wrapper.findAll('.vue-short-media-feed__spacer')[0].attributes('style'),
    ).toContain('height: 29400px')
  })

  it('updates the active item and emits change events while scrolling', async () => {
    const wrapper = mount(TestShortMediaFeed, {
      props: {
        items,
        height: 600,
        itemKey: 'id',
      },
      slots: {
        default: ({
          item,
          active,
        }: {
          item: TestItem
          active: boolean
        }) =>
          h(
            'span',
            { class: active ? 'is-active' : undefined },
            item.label,
          ),
      },
    })
    const viewport = wrapper.get('.vue-short-media-feed')
    Object.defineProperty(viewport.element, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 600,
    })

    await viewport.trigger('scroll')

    expect(wrapper.emitted('update:activeIndex')?.at(-1)).toEqual([1])
    expect(wrapper.emitted('change')?.at(-1)).toEqual([
      { index: 1, item: items[1] },
    ])
    expect(wrapper.get('.is-active').text()).toBe('Media 1')
    expect(
      wrapper
        .get('[aria-current="true"]')
        .attributes('aria-posinset'),
    ).toBe('2')
  })

  it('reacts to v-model changes without emitting a second update', async () => {
    const wrapper = mount(TestShortMediaFeed, {
      props: {
        items,
        activeIndex: 0,
        height: 600,
        itemKey: 'id',
      },
    })
    const viewport = wrapper.get('.vue-short-media-feed').element
    const scrollTo = vi.fn()
    viewport.scrollTo = scrollTo

    await wrapper.setProps({ activeIndex: 10 })
    await nextTick()

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 6_000 })
    expect(wrapper.emitted('update:activeIndex')).toBeUndefined()
    expect(
      wrapper.get('[aria-current="true"]').attributes('aria-posinset'),
    ).toBe('11')
  })

  it('emits reach-end when the last item becomes active', async () => {
    const shortItems = items.slice(0, 3)
    const wrapper = mount(TestShortMediaFeed, {
      props: {
        items: shortItems,
        height: 400,
        itemKey: 'id',
      },
    })
    const viewport = wrapper.get('.vue-short-media-feed')
    Object.defineProperty(viewport.element, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 800,
    })

    await viewport.trigger('scroll')

    expect(wrapper.emitted('reachEnd')).toHaveLength(1)
    expect(wrapper.emitted('update:activeIndex')?.at(-1)).toEqual([2])
  })

  it('exposes scrollToIndex and clamps invalid indexes', () => {
    const wrapper = mount(TestShortMediaFeed, {
      props: {
        items,
        height: 500,
        itemKey: 'id',
      },
    })
    const viewport = wrapper.get('.vue-short-media-feed').element
    const scrollTo = vi.fn()
    viewport.scrollTo = scrollTo

    wrapper.vm.scrollToIndex(999, { behavior: 'smooth' })

    expect(scrollTo).toHaveBeenCalledWith({
      top: 49_500,
      behavior: 'smooth',
    })
    expect(wrapper.emitted('update:activeIndex')?.at(-1)).toEqual([99])
  })

  it('renders the empty slot when there are no items', () => {
    const wrapper = mount(TestShortMediaFeed, {
      props: {
        items: [],
        height: 600,
      },
      slots: {
        empty: 'No media',
      },
    })

    expect(wrapper.get('.vue-short-media-feed__empty').text()).toBe(
      'No media',
    )
    expect(wrapper.find('.vue-short-media-feed__item').exists()).toBe(false)
  })

  it('keeps the active item aligned when the viewport is resized', async () => {
    let resizeCallback: ResizeObserverCallback | undefined
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)

    const wrapper = mount(TestShortMediaFeed, {
      props: {
        items,
        activeIndex: 2,
        height: 600,
        itemKey: 'id',
      },
    })
    const viewport = wrapper.get('.vue-short-media-feed').element
    const scrollTo = vi.fn()
    viewport.scrollTo = scrollTo
    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: 400,
    })

    resizeCallback?.([], {} as ResizeObserver)
    await nextTick()
    await nextTick()

    expect(
      wrapper.get('[aria-current="true"]').attributes('style'),
    ).toContain('height: 400px')
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 800 })

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('clamps the active index when the active last item is removed', async () => {
    const wrapper = mount(TestShortMediaFeed, {
      props: {
        items: items.slice(0, 3),
        activeIndex: 2,
        height: 400,
        itemKey: 'id',
      },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
    })

    await wrapper.setProps({ items: items.slice(0, 2) })
    await nextTick()

    expect(wrapper.emitted('update:activeIndex')?.at(-1)).toEqual([1])
    expect(wrapper.emitted('change')?.at(-1)).toEqual([
      { index: 1, item: items[1] },
    ])
    expect(wrapper.emitted('reachEnd')).toHaveLength(1)
    expect(wrapper.get('[aria-current="true"]').text()).toBe('Media 1')
  })

  it('renders replacement items when the array length stays the same', async () => {
    const replacementItems: TestItem[] = Array.from(
      { length: 3 },
      (_, index) => ({
        id: index + 100,
        label: `Replacement ${index}`,
      }),
    )
    const wrapper = mount(TestShortMediaFeed, {
      props: {
        items: items.slice(0, 3),
        activeIndex: 1,
        height: 400,
        itemKey: 'id',
      },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
    })

    await wrapper.setProps({ items: replacementItems })

    expect(wrapper.findAll('.vue-short-media-feed__item')).toHaveLength(3)
    expect(wrapper.get('[aria-current="true"]').text()).toBe('Replacement 1')
    expect(wrapper.text()).not.toContain('Media 1')
  })

  it('keeps a bounded DOM while scrolling through many items', async () => {
    const wrapper = mount(TestShortMediaFeed, {
      props: {
        items,
        height: 100,
        buffer: 1,
        itemKey: 'id',
      },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
    })
    const viewport = wrapper.get('.vue-short-media-feed')

    for (let index = 1; index <= 20; index += 1) {
      viewport.element.scrollTop = index * 100
      await viewport.trigger('scroll')

      expect(
        wrapper.findAll('.vue-short-media-feed__item').length,
      ).toBeLessThanOrEqual(3)
      expect(wrapper.get('[aria-current="true"]').text()).toBe(
        `Media ${index}`,
      )
    }

    expect(
      wrapper
        .emitted('update:activeIndex')
        ?.map(([index]) => index),
    ).toEqual(Array.from({ length: 20 }, (_, index) => index + 1))
  })

  it('emits load-more once when the active item reaches the threshold', async () => {
    const wrapper = mount(TestShortMediaFeed, {
      props: {
        items: items.slice(0, 5),
        height: 100,
        itemKey: 'id',
        hasMore: true,
        loadMoreThreshold: 1,
      },
    })
    const viewport = wrapper.get('.vue-short-media-feed')

    viewport.element.scrollTop = 300
    await viewport.trigger('scroll')
    viewport.element.scrollTop = 400
    await viewport.trigger('scroll')

    expect(wrapper.emitted('loadMore')).toHaveLength(1)
  })

  it('waits while loading and allows another load after items are appended', async () => {
    const wrapper = mount(TestShortMediaFeed, {
      props: {
        items: items.slice(0, 3),
        activeIndex: 2,
        height: 100,
        itemKey: 'id',
        hasMore: true,
        loading: true,
        loadMoreThreshold: 0,
      },
    })

    await nextTick()
    expect(wrapper.emitted('loadMore')).toBeUndefined()

    await wrapper.setProps({ loading: false })
    await nextTick()
    expect(wrapper.emitted('loadMore')).toHaveLength(1)

    await wrapper.setProps({ loading: true })
    await wrapper.setProps({ items: items.slice(0, 5) })
    await wrapper.setProps({ loading: false })

    const viewport = wrapper.get('.vue-short-media-feed')
    viewport.element.scrollTop = 400
    await viewport.trigger('scroll')

    expect(wrapper.emitted('loadMore')).toHaveLength(2)
  })

  it('can request the initial page when the feed is empty', async () => {
    const wrapper = mount(TestShortMediaFeed, {
      props: {
        items: [],
        height: 400,
        hasMore: true,
      },
    })

    await nextTick()

    expect(wrapper.emitted('loadMore')).toHaveLength(1)
  })

  it('warns once in development when object items have no itemKey', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const wrapper = mount(TestShortMediaFeed, {
      props: {
        items: [{ label: 'one' }, { label: 'two' }, { label: 'three' }],
        height: 400,
      },
    })

    await wrapper.setProps({
      items: [{ label: 'two' }, { label: 'three' }, { label: 'four' }],
    })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Missing `itemKey`'),
    )

    wrapper.unmount()
    warn.mockRestore()
  })
})
