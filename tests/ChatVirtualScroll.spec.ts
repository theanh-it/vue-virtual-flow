import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { Component } from 'vue'
import ChatVirtualScroll from '../src/components/ChatVirtualScroll.vue'

interface Message {
  id: number
  text: string
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

function createMessages(start: number, count: number): Message[] {
  return Array.from({ length: count }, (_, index) => ({
    id: start + index,
    text: `Message ${start + index}`,
  }))
}

const messages = createMessages(0, 100)
const TestChatVirtualScroll = ChatVirtualScroll as Component

function mountMeasuredChat(props: Record<string, unknown> = {}) {
  const wrapper = mount(TestChatVirtualScroll, {
    attachTo: document.body,
    props: {
      items: messages,
      estimatedItemSize: 40,
      height: 100,
      itemKey: 'id',
      initialScroll: 'top',
      ...props,
    },
  })
  const viewport = wrapper.get('.vue-chat-virtual-scroll')
  Object.defineProperty(viewport.element, 'clientHeight', { configurable: true, value: 100 })
  const row = (position: number) => wrapper.get(`[aria-posinset="${position}"]`)
  const resize = (position: number, height: number) => {
    const observer = MockResizeObserver.instances[1]
    observer.callback([{
      target: row(position).element,
      contentRect: { height },
    }] as ResizeObserverEntry[], observer as unknown as ResizeObserver)
  }
  const screenTop = (position: number) => {
    const transform = (row(position).element as HTMLElement).style.transform
    return Number(transform.match(/translateY\(([-\d.]+)px\)/)?.[1])
      - viewport.element.scrollTop
  }
  return { wrapper, viewport, row, resize, screenTop }
}

function trackScrollWrites(element: Element) {
  let top = element.scrollTop
  const writes = vi.fn((value: number) => { top = value })
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: writes,
  })
  return writes
}

describe('ChatVirtualScroll', () => {
  beforeEach(() => {
    MockResizeObserver.instances = []
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
  })

  it('caps mounted messages while scrolling and reports the rendered range', async () => {
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items: messages,
        estimatedItemSize: 40,
        height: 100,
        size: 6,
        initialScroll: 'top',
      },
    })
    const viewport = wrapper.get('.vue-chat-virtual-scroll')
    const rows = () => wrapper.findAll('.vue-chat-virtual-scroll__item')

    for (const [top, first, last] of [[0, 1, 6], [2010, 49, 54], [3900, 95, 100]]) {
      ;(viewport.element as HTMLElement).scrollTop = top
      await viewport.trigger('scroll')

      expect(rows()).toHaveLength(6)
      expect(rows()[0].attributes('aria-posinset')).toBe(String(first))
      expect(rows()[5].attributes('aria-posinset')).toBe(String(last))
      expect(wrapper.emitted('scroll')?.at(-1)).toEqual([{
        scrollTop: top,
        startIndex: first - 1,
        endIndex: last,
      }])
    }
    wrapper.unmount()
  })

  it('keeps the viewport filled when size is too small and height changes', async () => {
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items: messages,
        estimatedItemSize: 40,
        height: 100,
        size: 1,
        initialScroll: 'top',
      },
    })
    expect(wrapper.findAll('.vue-chat-virtual-scroll__item')).toHaveLength(3)
    await wrapper.setProps({ height: 210 })
    expect(wrapper.findAll('.vue-chat-virtual-scroll__item')).toHaveLength(6)
    wrapper.unmount()
  })

  it('updates the render budget reactively without moving the scroll position', async () => {
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items: messages,
        estimatedItemSize: 40,
        height: 100,
        initialScroll: 'top',
      },
    })
    const viewport = wrapper.get('.vue-chat-virtual-scroll')
    ;(viewport.element as HTMLElement).scrollTop = 2010
    await viewport.trigger('scroll')
    expect(wrapper.findAll('.vue-chat-virtual-scroll__item')).toHaveLength(13)
    await wrapper.setProps({ size: 6 })
    expect(wrapper.findAll('.vue-chat-virtual-scroll__item')).toHaveLength(6)
    expect((viewport.element as HTMLElement).scrollTop).toBe(2010)
    await wrapper.setProps({ size: undefined })
    expect(wrapper.findAll('.vue-chat-virtual-scroll__item')).toHaveLength(13)
    wrapper.unmount()
  })

  it.each([0, -1, NaN, Infinity])('ignores invalid size %s', async (size) => {
    const wrapper = mount(TestChatVirtualScroll, {
      props: { items: messages, estimatedItemSize: 40, height: 100, size, initialScroll: 'top' },
    })
    await nextTick()
    expect(wrapper.findAll('.vue-chat-virtual-scroll__item')).toHaveLength(8)
    wrapper.unmount()
  })

  it('normalizes fractional sizes and handles short and empty lists', async () => {
    const wrapper = mount(TestChatVirtualScroll, {
      props: { items: messages, estimatedItemSize: 40, height: 100, size: 6.9, initialScroll: 'top' },
    })
    expect(wrapper.findAll('.vue-chat-virtual-scroll__item')).toHaveLength(6)
    await wrapper.setProps({ overscan: 0 })
    expect(wrapper.findAll('.vue-chat-virtual-scroll__item')).toHaveLength(3)
    await wrapper.setProps({ items: messages.slice(0, 2) })
    expect(wrapper.findAll('.vue-chat-virtual-scroll__item')).toHaveLength(2)
    await wrapper.setProps({ items: [] })
    expect(wrapper.findAll('.vue-chat-virtual-scroll__item')).toHaveLength(0)
    wrapper.unmount()
  })

  it('fills the viewport after measured message heights shrink', async () => {
    const wrapper = mount(TestChatVirtualScroll, {
      attachTo: document.body,
      props: {
        items: messages,
        estimatedItemSize: 40,
        height: 100,
        size: 4,
        initialScroll: 'top',
        stickToBottom: false,
      },
    })
    await nextTick()
    const observer = MockResizeObserver.instances[1]
    const entries = wrapper.findAll('.vue-chat-virtual-scroll__item').map((row) => ({
      target: row.element,
      contentRect: { height: 10 },
    })) as ResizeObserverEntry[]
    observer.callback(entries, observer as unknown as ResizeObserver)
    await nextTick()
    await nextTick()

    // Four measured rows cover 40px; two estimated rows fill the rest.
    expect(wrapper.findAll('.vue-chat-virtual-scroll__item')).toHaveLength(6)
    wrapper.unmount()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('opens at the latest message by default', async () => {
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items: messages,
        estimatedItemSize: 40,
        height: 100,
        itemKey: 'id',
      },
    })
    const viewport = wrapper.get('.vue-chat-virtual-scroll').element
    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: 100,
    })

    await nextTick()
    await nextTick()

    expect((viewport as HTMLElement).scrollTop).toBe(3_900)
    expect(wrapper.vm.isAtBottom).toBe(true)
  })

  it('restores a pixel scroll position', () => {
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items: messages,
        estimatedItemSize: 40,
        height: 100,
        initialScroll: 'top',
      },
    })
    const viewport = wrapper.get('.vue-chat-virtual-scroll').element
    const nativeScrollTo = vi.fn()
    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: 100,
    })
    viewport.scrollTo = nativeScrollTo

    wrapper.vm.scrollTo(1_250)

    expect(nativeScrollTo).toHaveBeenCalledWith({
      top: 1_250,
      behavior: 'auto',
    })
  })

  it.each([undefined, 6])('follows appended messages only while the user is at the bottom (size %s)', async (size) => {
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items: messages,
        estimatedItemSize: 40,
        height: 100,
        itemKey: 'id',
        size,
      },
    })
    const viewport = wrapper.get('.vue-chat-virtual-scroll')
    Object.defineProperty(viewport.element, 'clientHeight', {
      configurable: true,
      value: 100,
    })
    await nextTick()

    await wrapper.setProps({
      items: [...messages, { id: 100, text: 'Message 100' }],
    })
    await nextTick()

    expect((viewport.element as HTMLElement).scrollTop).toBe(3_940)

    ;(viewport.element as HTMLElement).scrollTop = 2_000
    await viewport.trigger('scroll')
    await wrapper.setProps({
      items: [...messages, { id: 100, text: 'Message 100' }, {
        id: 101,
        text: 'Message 101',
      }],
    })
    await nextTick()

    expect((viewport.element as HTMLElement).scrollTop).toBe(2_000)
  })

  it.each([undefined, 6])('preserves the visible conversation when older messages are prepended (size %s)', async (size) => {
    const currentMessages = createMessages(10, 10)
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items: currentMessages,
        estimatedItemSize: 40,
        height: 100,
        itemKey: 'id',
        size,
      },
    })
    const viewport = wrapper.get('.vue-chat-virtual-scroll')
    Object.defineProperty(viewport.element, 'clientHeight', {
      configurable: true,
      value: 100,
    })
    await nextTick()

    ;(viewport.element as HTMLElement).scrollTop = 100
    await viewport.trigger('scroll')
    await wrapper.setProps({
      items: [...createMessages(8, 2), ...currentMessages],
    })
    await nextTick()

    expect((viewport.element as HTMLElement).scrollTop).toBe(180)
  })

  it('requests older messages once when the viewport reaches the top', async () => {
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items: messages,
        estimatedItemSize: 40,
        height: 100,
        itemKey: 'id',
        hasOlder: true,
      },
    })
    const viewport = wrapper.get('.vue-chat-virtual-scroll')
    Object.defineProperty(viewport.element, 'clientHeight', {
      configurable: true,
      value: 100,
    })
    await nextTick()

    ;(viewport.element as HTMLElement).scrollTop = 0
    await viewport.trigger('scroll')
    await viewport.trigger('scroll')

    expect(wrapper.emitted('loadOlder')).toHaveLength(1)
  })

  it('keeps the visible message DOM mounted when a whole page is prepended', async () => {
    const { wrapper, viewport, row } = mountMeasuredChat({ size: 6 })
    await nextTick()
    viewport.element.scrollTop = 100
    await viewport.trigger('scroll')
    const anchor = row(3).element

    await wrapper.setProps({ items: [...createMessages(-20, 20), ...messages] })
    await nextTick()

    expect(row(23).element).toBe(anchor)
    expect(viewport.element.scrollTop).toBe(900)
    wrapper.unmount()
  })

  it.each([80, 20])('preserves the anchor during touch and momentum when a row resizes to %spx', async (height) => {
    vi.useFakeTimers()
    const { wrapper, viewport, row, resize, screenTop } = mountMeasuredChat()
    await nextTick()
    viewport.element.scrollTop = 240
    await viewport.trigger('scroll')
    const anchor = row(7).element
    const writes = trackScrollWrites(viewport.element)
    await viewport.trigger('touchstart')

    resize(3, height)
    await nextTick()
    resize(4, height)
    await nextTick()
    await vi.advanceTimersByTimeAsync(500)

    expect(writes).not.toHaveBeenCalled()
    expect(row(7).element).toBe(anchor)
    expect(screenTop(7)).toBe(0)
    expect(wrapper.get('.vue-chat-virtual-scroll__spacer').attributes('style')).toContain('height: 4000px')

    await viewport.trigger('touchend', { touches: [] })
    await vi.advanceTimersByTimeAsync(100)
    // Native momentum continues after the finger lifts.
    viewport.element.scrollTop = 220
    writes.mockClear()
    await viewport.trigger('scroll')
    await vi.advanceTimersByTimeAsync(100)
    expect(writes).not.toHaveBeenCalled()
    expect(screenTop(7)).toBe(20)
    expect(wrapper.emitted('scroll')?.at(-1)?.[0]).toMatchObject({
      scrollTop: 220 + 2 * (height - 40),
    })

    await vi.advanceTimersByTimeAsync(60)
    expect(writes).toHaveBeenCalledTimes(1)
    expect(viewport.element.scrollTop).toBe(220 + 2 * (height - 40))
    expect(screenTop(7)).toBe(20)
    expect(row(7).element).toBe(anchor)
    wrapper.unmount()
  })

  it('compensates prepend and measurements during a touch without requesting another page', async () => {
    const { wrapper, viewport, row, resize, screenTop } = mountMeasuredChat({ hasOlder: true, size: 6 })
    await nextTick()
    const anchor = row(1).element
    const writes = trackScrollWrites(viewport.element)
    await viewport.trigger('touchstart')
    await wrapper.setProps({ items: [...createMessages(-20, 20), ...messages] })
    resize(20, 100)
    await nextTick()

    expect(writes).not.toHaveBeenCalled()
    expect(row(21).element).toBe(anchor)
    expect(screenTop(21)).toBe(0)
    expect(wrapper.emitted('loadOlder')).toHaveLength(1)
    expect(wrapper.vm.isAtBottom).toBe(false)

    // scrollend cannot commit while a finger is still on the viewport.
    await viewport.trigger('scrollend')
    expect(writes).not.toHaveBeenCalled()
    await viewport.trigger('touchend', { touches: [] })
    await viewport.trigger('scrollend')
    await nextTick()

    expect(writes).toHaveBeenCalledTimes(1)
    expect(viewport.element.scrollTop).toBe(860)
    expect(screenTop(21)).toBe(0)
    expect(row(21).element).toBe(anchor)
    wrapper.unmount()
  })

  it.each(['scrollTo', 'scrollToIndex', 'scrollToTop', 'scrollToBottom'])('lets %s override a pending touch adjustment', async (method) => {
    vi.useFakeTimers()
    const { wrapper, viewport, resize } = mountMeasuredChat()
    await nextTick()
    viewport.element.scrollTop = 240
    await viewport.trigger('scroll')
    viewport.element.scrollTo = vi.fn((options: ScrollToOptions) => {
      viewport.element.scrollTop = options.top ?? 0
    }) as typeof viewport.element.scrollTo
    await viewport.trigger('touchstart')
    resize(3, 100)
    await nextTick()

    const args: Record<string, number[]> = { scrollTo: [600], scrollToIndex: [15], scrollToTop: [], scrollToBottom: [] }
    const expected: Record<string, number> = { scrollTo: 600, scrollToIndex: 660, scrollToTop: 0, scrollToBottom: 3960 }
    wrapper.vm[method](...args[method])
    await nextTick()
    await viewport.trigger('touchend', { touches: [] })
    await vi.advanceTimersByTimeAsync(200)

    expect(viewport.element.scrollTop).toBe(expected[method])
    wrapper.unmount()
  })

  it('does not pin back to the bottom while the user is touching the chat', async () => {
    const { wrapper, viewport, resize } = mountMeasuredChat({ initialScroll: 'bottom' })
    await nextTick()
    await viewport.trigger('touchstart')
    viewport.element.scrollTop = 3860
    await viewport.trigger('scroll')
    const writes = trackScrollWrites(viewport.element)
    resize(100, 100)
    await wrapper.setProps({ items: [...messages, ...createMessages(100, 1)] })
    await nextTick()

    expect(writes).not.toHaveBeenCalled()
    expect(viewport.element.scrollTop).toBe(3860)
    wrapper.unmount()
  })

  it('cleans up a deferred touch adjustment when unmounted', async () => {
    vi.useFakeTimers()
    const { wrapper, viewport, resize } = mountMeasuredChat()
    await nextTick()
    viewport.element.scrollTop = 240
    await viewport.trigger('scroll')
    await viewport.trigger('touchstart')
    resize(3, 100)
    await nextTick()
    await viewport.trigger('touchcancel', { touches: [] })
    const writes = trackScrollWrites(viewport.element)
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(200)

    expect(writes).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('leaves no empty gap when scrolling to the top after rows shrink during a touch', async () => {
    const { wrapper, viewport, resize, screenTop } = mountMeasuredChat()
    await nextTick()
    viewport.element.scrollTop = 240
    await viewport.trigger('scroll')
    await viewport.trigger('touchstart')
    resize(3, 10)
    resize(4, 10)
    await nextTick()
    viewport.element.scrollTop = 20
    const writes = trackScrollWrites(viewport.element)
    await viewport.trigger('scroll')

    expect(writes).not.toHaveBeenCalled()
    expect(screenTop(1)).toBe(0)
    await viewport.trigger('touchend', { touches: [] })
    await viewport.trigger('scrollend')
    await nextTick()
    expect(viewport.element.scrollTop).toBe(0)
    expect(screenTop(1)).toBe(0)
    wrapper.unmount()
  })
})
