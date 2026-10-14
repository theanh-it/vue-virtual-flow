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
    constructor(private callback: ResizeObserverCallback) {}

    observe(element: HTMLElement) {
      if (element.classList.contains('vue-virtual-carousel')) resizeCallback = this.callback
    }
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

async function nextAnimationFrame() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
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

  it('moves to the nearest slide when dragged with the mouse', async () => {
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
    const scrollTo = vi.fn()
    viewport.element.scrollTo = scrollTo

    await viewport.trigger('pointerdown', {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 500,
    })
    await viewport.trigger('pointermove', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 100,
    })
    await nextAnimationFrame()

    expect(viewport.element.scrollLeft).toBe(0)
    expect(
      wrapper.get('.vue-virtual-carousel__track').attributes('style'),
    ).toContain('translate3d(-400px, 0, 0)')
    expect(viewport.classes()).toContain('vue-virtual-carousel--dragging')

    await viewport.trigger('pointerup', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 100,
    })

    expect(wrapper.emitted('update:activeIndex')?.at(-1)).toEqual([1])
    expect(scrollTo).toHaveBeenLastCalledWith({
      left: 320,
      behavior: 'smooth',
    })
    expect(viewport.classes()).not.toContain('vue-virtual-carousel--dragging')
  })

  it('does not drag with the mouse when mouseDrag is disabled', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items,
        slidesPerView: 3,
        gap: 20,
        mouseDrag: false,
      },
    })
    await setViewportWidth(wrapper, 940)
    const viewport = wrapper.get('.vue-virtual-carousel')

    await viewport.trigger('pointerdown', {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 500,
    })
    await viewport.trigger('pointermove', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 100,
    })
    await viewport.trigger('pointerup', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 100,
    })

    expect(viewport.element.scrollLeft).toBe(0)
    expect(wrapper.emitted('update:activeIndex')).toBeUndefined()
    expect(viewport.classes()).not.toContain('vue-virtual-carousel--mouse-drag')
  })

  it('does not move horizontally when a touch gesture is vertical', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items,
        slidesPerView: 3,
        gap: 20,
      },
    })
    await setViewportWidth(wrapper, 940)
    const viewport = wrapper.get('.vue-virtual-carousel')

    await viewport.trigger('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 300,
      clientY: 300,
    })
    await viewport.trigger('pointermove', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 294,
      clientY: 250,
    })
    await viewport.trigger('pointermove', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 100,
      clientY: 240,
    })

    expect(viewport.element.scrollLeft).toBe(0)
    expect(viewport.classes()).not.toContain('vue-virtual-carousel--dragging')
    expect(wrapper.emitted('update:activeIndex')).toBeUndefined()
  })

  it('direction-locks a horizontal touch gesture and snaps on release', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items,
        slidesPerView: 3,
        gap: 20,
      },
    })
    await setViewportWidth(wrapper, 940)
    const viewport = wrapper.get('.vue-virtual-carousel')
    const scrollTo = vi.fn()
    viewport.element.scrollTo = scrollTo

    await viewport.trigger('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 500,
      clientY: 200,
    })
    await viewport.trigger('pointermove', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 100,
      clientY: 205,
    })
    await nextAnimationFrame()

    expect(viewport.element.scrollLeft).toBe(0)
    expect(
      wrapper.get('.vue-virtual-carousel__track').attributes('style'),
    ).toContain('translate3d(-400px, 0, 0)')
    expect(viewport.classes()).toContain('vue-virtual-carousel--dragging')

    await viewport.trigger('pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 100,
      clientY: 205,
    })

    expect(wrapper.emitted('update:activeIndex')?.at(-1)).toEqual([1])
    expect(scrollTo).toHaveBeenLastCalledWith({
      left: 320,
      behavior: 'smooth',
    })
  })

  it('adds bounded momentum to a fast drag before snapping', async () => {
    let eventTime = 0
    vi.spyOn(Event.prototype, 'timeStamp', 'get').mockImplementation(
      () => eventTime,
    )
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items,
        slidesPerView: 3,
        gap: 20,
      },
    })
    await setViewportWidth(wrapper, 940)
    const viewport = wrapper.get('.vue-virtual-carousel')
    const scrollTo = vi.fn()
    viewport.element.scrollTo = scrollTo

    await viewport.trigger('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 500,
      clientY: 200,
    })
    eventTime = 20
    await viewport.trigger('pointermove', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 440,
      clientY: 201,
    })
    eventTime = 40
    await viewport.trigger('pointermove', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 380,
      clientY: 202,
    })
    eventTime = 50
    await viewport.trigger('pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 380,
      clientY: 202,
    })

    expect(wrapper.emitted('update:activeIndex')?.at(-1)).toEqual([2])
    expect(scrollTo).toHaveBeenLastCalledWith({
      left: 640,
      behavior: 'smooth',
    })
  })

  it('commits one slide for a small intentional horizontal swipe', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items,
        slidesPerView: 3,
        gap: 20,
      },
    })
    await setViewportWidth(wrapper, 940)
    const viewport = wrapper.get('.vue-virtual-carousel')
    const scrollTo = vi.fn()
    viewport.element.scrollTo = scrollTo

    await viewport.trigger('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 200,
      clientY: 100,
    })
    await viewport.trigger('pointermove', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 190,
      clientY: 100,
    })
    await viewport.trigger('pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 190,
      clientY: 100,
    })

    expect(wrapper.emitted('update:activeIndex')?.at(-1)).toEqual([1])
    expect(scrollTo).toHaveBeenLastCalledWith({
      left: 320,
      behavior: 'smooth',
    })
  })

  it('ignores a child losing implicit touch capture during transfer to the viewport', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: { items, height: 300, settleDuration: 0 },
      slots: { default: () => h('span', 'Slide content') },
    })
    await setViewportWidth(wrapper, 320)
    const viewport = wrapper.get('.vue-virtual-carousel')
    await viewport.trigger('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 100 })
    await viewport.trigger('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 188, clientY: 100 })
    await wrapper.find('span').trigger('lostpointercapture', { pointerId: 1, pointerType: 'touch' })
    expect(viewport.classes()).toContain('vue-virtual-carousel--dragging')
    expect(wrapper.emitted('update:activeIndex')).toBeUndefined()
    await viewport.trigger('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 188, clientY: 100 })
    expect(wrapper.emitted('update:activeIndex')).toEqual([[1]])
    wrapper.unmount()
  })

  it('keeps virtual state frozen until the track animation finishes', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: {
        items,
        slidesPerView: 3,
        gap: 20,
      },
    })
    await setViewportWidth(wrapper, 940)
    const viewport = wrapper.get('.vue-virtual-carousel')
    const track = wrapper.get('.vue-virtual-carousel__track')
    const scrollTo = vi.fn()
    viewport.element.scrollTo = scrollTo
    const animation = {
      cancel: vi.fn(),
      oncancel: null,
      onfinish: null,
    } as unknown as Animation
    track.element.animate = vi.fn(() => animation)

    await viewport.trigger('pointerdown', {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 200,
      clientY: 100,
    })
    await viewport.trigger('pointermove', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 180,
      clientY: 100,
    })
    await viewport.trigger('pointerup', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 180,
      clientY: 100,
    })

    expect(track.element.animate).toHaveBeenCalledOnce()
    expect(wrapper.emitted('update:activeIndex')).toBeUndefined()
    expect(scrollTo).not.toHaveBeenCalled()

    animation.onfinish?.(new Event('finish') as AnimationPlaybackEvent)
    await nextTick()

    expect(wrapper.emitted('update:activeIndex')?.at(-1)).toEqual([1])
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 320 })
    expect(animation.cancel).toHaveBeenCalledOnce()
    expect(track.attributes('style')).not.toContain('transform')
  })

  it('preserves a held animation frame when wheel interrupts a pending pointer', async () => {
    const wrapper = mount(TestVirtualCarousel, { props: { items, height: 300 } })
    await setViewportWidth(wrapper, 320)
    const viewport = wrapper.get('.vue-virtual-carousel')
    const track = wrapper.get('.vue-virtual-carousel__track')
    const scrollTo = vi.fn()
    viewport.element.scrollTo = scrollTo
    const animation = { cancel: vi.fn(), onfinish: null, oncancel: null } as unknown as Animation
    track.element.animate = vi.fn(() => animation)
    await viewport.trigger('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 200, clientY: 100 })
    await viewport.trigger('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: 180, clientY: 100 })
    await viewport.trigger('pointerup', { pointerId: 1, pointerType: 'mouse', clientX: 180, clientY: 100 })
    vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({ transform: 'matrix(1, 0, 0, 1, -80, 0)' } as CSSStyleDeclaration)
    await viewport.trigger('pointerdown', { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 200, clientY: 100 })
    await viewport.trigger('wheel', { deltaX: 10 })
    expect(scrollTo).toHaveBeenCalledWith({ left: 80 })
    expect(track.attributes('style')).not.toContain('transform')
    wrapper.unmount()
  })

  it.each([false, true])('only carries release velocity when the pointer has not paused (paused %s)', async (paused) => {
    let eventTime = 0
    vi.spyOn(Event.prototype, 'timeStamp', 'get').mockImplementation(() => eventTime)
    const wrapper = mount(TestVirtualCarousel, {
      props: { items, slidesPerView: 3, gap: 20 },
    })
    await setViewportWidth(wrapper, 940)
    const viewport = wrapper.get('.vue-virtual-carousel')
    const track = wrapper.get('.vue-virtual-carousel__track')
    const animation = {
      cancel: vi.fn(), onfinish: null, oncancel: null,
    } as unknown as Animation
    const animate = vi.fn(
      (_frames: Keyframe[], _options: KeyframeAnimationOptions) => animation,
    )
    track.element.animate = animate as typeof track.element.animate
    viewport.element.scrollTo = vi.fn()

    await viewport.trigger('pointerdown', {
      pointerId: 1, pointerType: 'touch', clientX: 500, clientY: 100,
    })
    eventTime = 20
    await viewport.trigger('pointermove', {
      pointerId: 1, pointerType: 'touch', clientX: 440, clientY: 100,
    })
    eventTime = 40
    await viewport.trigger('pointermove', {
      pointerId: 1, pointerType: 'touch', clientX: 380, clientY: 100,
    })
    eventTime = paused ? 240 : 50
    await viewport.trigger('pointerup', {
      pointerId: 1, pointerType: 'touch', clientX: 380, clientY: 100,
    })

    expect(wrapper.emitted('change')).toBeUndefined()
    expect(animate.mock.calls[0][1].easing).toBe(
      paused ? 'cubic-bezier(0.22, 1, 0.36, 1)' : 'linear',
    )
    animation.onfinish?.(new Event('finish') as AnimationPlaybackEvent)
    await nextTick()
    expect(wrapper.emitted('update:activeIndex')).toEqual([[paused ? 1 : 2]])
    wrapper.unmount()
  })

  it('keeps pinned slide instances mounted outside the normal window', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: { items, height: 300, buffer: 0, pinnedIndexes: [0] },
      slots: { default: ({ index }: { index: number }) => h('input', { 'data-note': index }) },
    })
    await setViewportWidth(wrapper, 320)
    const note = wrapper.get('[data-note="0"]').element as HTMLInputElement
    note.value = 'Local state'
    wrapper.vm.scrollToIndex(10)
    await nextTick()
    await nextTick()
    expect(wrapper.get('[data-note="0"]').element).toBe(note)
    expect(wrapper.findAll('.vue-virtual-carousel__item')).toHaveLength(2)
    wrapper.vm.scrollToIndex(0)
    await nextTick()
    expect((wrapper.get('[data-note="0"]').element as HTMLInputElement).value).toBe('Local state')
    wrapper.unmount()
  })

  it('evicts the oldest cached slides while respecting the offscreen budget', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: { items, height: 300, buffer: 0, keepAlive: true, maxCachedItems: 2 },
    })
    await setViewportWidth(wrapper, 320)
    for (const index of [5, 10, 15]) {
      wrapper.vm.scrollToIndex(index)
      await nextTick()
      await nextTick()
      await nextTick()
      expect(wrapper.findAll('.vue-virtual-carousel__item').length).toBeLessThanOrEqual(3)
    }
    expect(wrapper.find('[data-carousel-index="0"]').exists()).toBe(false)
    expect(wrapper.find('[data-carousel-index="5"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('clamps auto-width navigation at the first final viewport snap', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: { items: items.slice(0, 5), height: 300, autoWidth: true, estimatedItemWidth: 100 },
    })
    await setViewportWidth(wrapper, 200)
    const scrollTo = vi.fn()
    wrapper.get('.vue-virtual-carousel').element.scrollTo = scrollTo
    wrapper.vm.scrollToIndex(999)
    expect(wrapper.emitted('update:activeIndex')).toEqual([[3]])
    expect(scrollTo).toHaveBeenCalledWith({ left: 300, behavior: 'auto' })
    wrapper.unmount()
  })

  it('normalizes RTL indices while keeping native coordinates negative', async () => {
    const wrapper = mount(TestVirtualCarousel, { props: { items, rtl: true, height: 300 } })
    await setViewportWidth(wrapper, 320)
    const viewport = wrapper.get('.vue-virtual-carousel')
    const scrollTo = vi.fn()
    viewport.element.scrollTo = scrollTo
    wrapper.vm.next('auto')
    expect(scrollTo).toHaveBeenCalledWith({ left: -320, behavior: 'auto' })
    await nextTick()
    viewport.element.scrollLeft = -640
    await viewport.trigger('scroll')
    expect(wrapper.emitted('update:activeIndex')?.at(-1)).toEqual([2])
    wrapper.unmount()
  })

  it('respects the configured threshold and disables momentum when requested', async () => {
    const wrapper = mount(TestVirtualCarousel, {
      props: { items, height: 300, dragThreshold: 30, momentum: false, settleDuration: 0 },
    })
    await setViewportWidth(wrapper, 320)
    const viewport = wrapper.get('.vue-virtual-carousel')
    const animate = vi.fn()
    wrapper.get('.vue-virtual-carousel__track').element.animate = animate
    await viewport.trigger('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 300, clientY: 100 })
    await viewport.trigger('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: 280, clientY: 100 })
    await viewport.trigger('pointerup', { pointerId: 1, pointerType: 'mouse', clientX: 280, clientY: 100 })
    expect(wrapper.emitted('change')).toBeUndefined()
    await viewport.trigger('pointerdown', { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 300, clientY: 100 })
    await viewport.trigger('pointermove', { pointerId: 2, pointerType: 'mouse', clientX: 240, clientY: 100 })
    await viewport.trigger('pointerup', { pointerId: 2, pointerType: 'mouse', clientX: 240, clientY: 100 })
    expect(animate).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:activeIndex')).toEqual([[1]])
    wrapper.unmount()
  })

  it('clamps scrollToIndex to valid range', async () => {
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
      behavior: 'smooth',
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
