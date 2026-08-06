import { mount, type VueWrapper } from '@vue/test-utils'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { h, nextTick, type Component } from 'vue'
import VirtualCarousel from '../src/components/VirtualCarousel.vue'

interface TestItem {
  id: number
  label: string
}

const items: TestItem[] = Array.from({ length: 100 }, (_, index) => ({
  id: index,
  label: `Slide ${index}`,
}))
const TestVirtualCarousel = VirtualCarousel as Component
let resizeCallback: ResizeObserverCallback | undefined

beforeEach(() => {
  class ResizeObserverMock {
    constructor(callback: ResizeObserverCallback) {
      resizeCallback = callback
    }

    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})

afterEach(() => {
  vi.useRealTimers()
  resizeCallback = undefined
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function setViewportWidth(
  wrapper: VueWrapper,
  width: number,
) {
  const viewport = wrapper.get('.vue-virtual-carousel').element
  Object.defineProperty(viewport, 'clientWidth', {
    configurable: true,
    value: width,
  })
  resizeCallback?.([], {} as ResizeObserver)
  await nextTick()
  await nextTick()
}

describe('VirtualCarousel', () => {
  it('calculates item width and only mounts the visible range plus buffer', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items,
        activeIndex: 10,
        slidesPerView: 3,
        gap: 20,
        buffer: 1,
        height: 300,
        itemKey: 'id',
      },
      slots: {
        default: ({ item }: { item: TestItem }) => item.label,
      },
    })

    await setViewportWidth(wrapper, 940)

    const renderedItems = wrapper.findAll('.vue-virtual-carousel__item')
    expect(renderedItems).toHaveLength(5)
    expect(renderedItems.map((item) => item.text())).toEqual([
      'Slide 9',
      'Slide 10',
      'Slide 11',
      'Slide 12',
      'Slide 13',
    ])
    expect(renderedItems[0].attributes('style')).toContain(
      'flex-basis: 300px',
    )
    expect(renderedItems[0].attributes('style')).toContain(
      'margin-right: 20px',
    )
    expect(
      wrapper.findAll('.vue-virtual-carousel__spacer')[0].attributes('style'),
    ).toContain('flex-basis: 2880px')
  })

  it('marks the first slide active and every on-screen slide visible', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items,
        activeIndex: 10,
        slidesPerView: 3,
        gap: 20,
        height: 300,
        itemKey: 'id',
      },
      slots: {
        default: ({
          item,
          active,
          visible,
        }: {
          item: TestItem
          active: boolean
          visible: boolean
        }) =>
          h('span', {
            class: {
              active,
              visible,
            },
          }, item.label),
      },
    })

    await setViewportWidth(wrapper, 940)

    expect(wrapper.get('.active').text()).toBe('Slide 10')
    expect(
      wrapper.findAll('.visible').map((slide) => slide.text()),
    ).toEqual(['Slide 10', 'Slide 11', 'Slide 12'])
  })

  it('updates activeIndex from horizontal scrolling', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items,
        slidesPerView: 3,
        gap: 20,
        height: 300,
        itemKey: 'id',
      },
    })
    await setViewportWidth(wrapper, 940)
    const viewport = wrapper.get('.vue-virtual-carousel')

    viewport.element.scrollLeft = 960
    await viewport.trigger('scroll')

    expect(wrapper.emitted('update:activeIndex')?.at(-1)).toEqual([3])
    expect(wrapper.emitted('change')?.at(-1)).toEqual([
      { index: 3, item: items[3] },
    ])
    expect(
      wrapper.get('[aria-current="true"]').attributes('aria-label'),
    ).toBe('4 of 100')
  })

  it('clamps scrollToIndex and disables unsafe long smooth scrolling', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items: items.slice(0, 10),
        slidesPerView: 3,
        gap: 20,
        height: 300,
        itemKey: 'id',
      },
    })
    await setViewportWidth(wrapper, 940)
    const viewport = wrapper.get('.vue-virtual-carousel').element
    const scrollTo = vi.fn()
    viewport.scrollTo = scrollTo

    wrapper.vm.scrollToIndex(999, { behavior: 'smooth' })

    expect(scrollTo).toHaveBeenCalledWith({
      left: 2_240,
      behavior: 'auto',
    })
    expect(wrapper.emitted('update:activeIndex')?.at(-1)).toEqual([7])
    expect(wrapper.emitted('reachEnd')).toHaveLength(1)
  })

  it('supports next and previous with slidesToScroll', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items,
        activeIndex: 2,
        slidesPerView: 3,
        slidesToScroll: 2,
        gap: 20,
        buffer: 2,
        height: 300,
        itemKey: 'id',
      },
    })
    await setViewportWidth(wrapper, 940)
    const viewport = wrapper.get('.vue-virtual-carousel').element
    const scrollTo = vi.fn()
    viewport.scrollTo = scrollTo

    wrapper.vm.next()
    wrapper.vm.previous('auto')

    expect(wrapper.emitted('update:activeIndex')).toEqual([[4], [2]])
    expect(scrollTo).toHaveBeenNthCalledWith(1, {
      left: 1_280,
      behavior: 'smooth',
    })
    expect(scrollTo).toHaveBeenNthCalledWith(2, {
      left: 640,
      behavior: 'auto',
    })
  })

  it('ignores intermediate events from programmatic smooth scrolling', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items,
        slidesPerView: 3,
        gap: 20,
        buffer: 2,
        height: 300,
        itemKey: 'id',
      },
    })
    await setViewportWidth(wrapper, 940)
    const viewport = wrapper.get('.vue-virtual-carousel')
    viewport.element.scrollTo = vi.fn()

    wrapper.vm.next()
    expect(wrapper.emitted('update:activeIndex')).toEqual([[1]])

    viewport.element.scrollLeft = 0
    await viewport.trigger('scroll')
    expect(wrapper.emitted('update:activeIndex')).toEqual([[1]])

    viewport.element.scrollLeft = 320
    await viewport.trigger('scroll')
    expect(wrapper.emitted('update:activeIndex')).toEqual([[1]])
  })

  it('keeps the active slide aligned when the viewport is resized', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items,
        activeIndex: 2,
        slidesPerView: 2,
        gap: 10,
        height: 300,
        itemKey: 'id',
      },
    })
    await setViewportWidth(wrapper, 810)
    const viewport = wrapper.get('.vue-virtual-carousel').element
    const scrollTo = vi.fn()
    viewport.scrollTo = scrollTo

    await setViewportWidth(wrapper, 1_010)

    expect(
      wrapper.get('[aria-current="true"]').attributes('style'),
    ).toContain('flex-basis: 500px')
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 1_020 })
  })

  it('clamps activeIndex when slidesPerView or item count changes', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items: items.slice(0, 10),
        activeIndex: 7,
        slidesPerView: 3,
        height: 300,
        itemKey: 'id',
      },
    })
    await setViewportWidth(wrapper, 900)

    await wrapper.setProps({
      items: items.slice(0, 6),
      slidesPerView: 4,
    })
    await nextTick()

    expect(wrapper.emitted('update:activeIndex')?.at(-1)).toEqual([2])
    expect(wrapper.get('[aria-current="true"]').attributes('aria-label')).toBe(
      '3 of 6',
    )
  })

  it('emits load-more based on the final visible slide', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items: items.slice(0, 10),
        slidesPerView: 3,
        gap: 20,
        height: 300,
        itemKey: 'id',
        hasMore: true,
        loadMoreThreshold: 1,
      },
    })
    await setViewportWidth(wrapper, 940)
    const viewport = wrapper.get('.vue-virtual-carousel')

    viewport.element.scrollLeft = 1_920
    await viewport.trigger('scroll')
    viewport.element.scrollLeft = 2_240
    await viewport.trigger('scroll')

    expect(wrapper.emitted('loadMore')).toHaveLength(1)
  })

  it('keeps the DOM bounded while navigating a large collection', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items,
        slidesPerView: 4,
        gap: 10,
        buffer: 2,
        height: 300,
        itemKey: 'id',
      },
    })
    await setViewportWidth(wrapper, 830)
    const viewport = wrapper.get('.vue-virtual-carousel')

    for (let index = 1; index <= 20; index += 1) {
      viewport.element.scrollLeft = index * 210
      await viewport.trigger('scroll')

      expect(
        wrapper.findAll('.vue-virtual-carousel__item').length,
      ).toBeLessThanOrEqual(8)
    }
  })

  it('starts autoplay when items are loaded after mount', async () => {
    vi.useFakeTimers()
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items: [],
        autoplay: true,
        autoplayDelay: 100,
      },
    })

    await setViewportWidth(wrapper, 900)
    await wrapper.setProps({ items: items.slice(0, 3) })
    await nextTick()
    await nextTick()

    vi.advanceTimersByTime(100)
    await nextTick()

    expect(wrapper.emitted('update:activeIndex')).toEqual([[1]])
  })

  it('reacts when pause-on-hover is disabled while hovered', async () => {
    vi.useFakeTimers()
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items: items.slice(0, 3),
        autoplay: true,
        autoplayDelay: 100,
        pauseOnHover: true,
      },
    })

    await setViewportWidth(wrapper, 900)
    await wrapper.get('.vue-virtual-carousel').trigger('mouseenter')
    vi.advanceTimersByTime(200)
    expect(wrapper.emitted('update:activeIndex')).toBeUndefined()

    await wrapper.setProps({ pauseOnHover: false })
    vi.advanceTimersByTime(100)
    await nextTick()

    expect(wrapper.emitted('update:activeIndex')).toEqual([[1]])
  })

  it('restarts autoplay when looping is enabled at the end', async () => {
    vi.useFakeTimers()
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items: items.slice(0, 3),
        autoplay: true,
        autoplayDelay: 100,
        autoplayLoop: false,
      },
    })

    await setViewportWidth(wrapper, 900)
    vi.advanceTimersByTime(300)
    await nextTick()
    expect(wrapper.emitted('update:activeIndex')).toEqual([[1], [2]])

    await wrapper.setProps({ autoplayLoop: true })
    vi.advanceTimersByTime(100)
    await nextTick()

    expect(wrapper.emitted('update:activeIndex')).toEqual([[1], [2], [0]])
  })

  it('renders the empty slot', () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items: [],
        height: 300,
      },
      slots: {
        empty: 'No slides',
      },
    })

    expect(wrapper.get('.vue-virtual-carousel__empty').text()).toBe(
      'No slides',
    )
    expect(wrapper.find('.vue-virtual-carousel__track').exists()).toBe(false)
  })
})
