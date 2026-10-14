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
  const measuredRows = new Map<Element, number>()
  const row = (position: number) => wrapper.get(`[aria-posinset="${position}"]`)
  const resize = (position: number, height: number) => {
    const observer = MockResizeObserver.instances[1]
    const element = row(position).element
    measuredRows.set(element, height)
    observer.callback([{
      target: element,
      contentRect: { height },
    }] as ResizeObserverEntry[], observer as unknown as ResizeObserver)
  }
  const screenTop = (position: number) => {
    const transform = (row(position).element as HTMLElement).style.transform
    return viewport.element.clientHeight - viewport.element.scrollTop
      + Number(transform.match(/translateY\(([-\d.]+)px\)/)?.[1])
      - (measuredRows.get(row(position).element) ?? Number(props.estimatedItemSize ?? 40))
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
      ;(viewport.element as HTMLElement).scrollTop = top - 3900
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
    ;(viewport.element as HTMLElement).scrollTop = -1890
    await viewport.trigger('scroll')
    expect(wrapper.findAll('.vue-chat-virtual-scroll__item')).toHaveLength(13)
    await wrapper.setProps({ size: 6 })
    expect(wrapper.findAll('.vue-chat-virtual-scroll__item')).toHaveLength(6)
    expect((viewport.element as HTMLElement).scrollTop).toBe(-1890)
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

  it('fails fast for duplicate message keys instead of corrupting anchors', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => mount(TestChatVirtualScroll, {
      props: {
        items: [{ id: 1, text: 'one' }, { id: 1, text: 'duplicate' }],
        itemKey: 'id',
      },
    })).toThrow('Duplicate item key `1`')

    expect(warning).toHaveBeenCalledWith(expect.stringContaining('Duplicate item key `1`'))
    warning.mockRestore()
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

  it('measures first-time rows before ResizeObserver delivers their heights', async () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect
    const measuredRows = vi.fn()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (!this.classList.contains('vue-chat-virtual-scroll__item')) return originalRect.call(this)
      measuredRows(this)
      return { ...originalRect.call(this), height: 70 } as DOMRect
    })
    const { wrapper, viewport } = mountMeasuredChat({ items: messages.slice(0, 2) })
    await nextTick()
    await nextTick()

    // Both 40px estimates become 70px synchronously; the top stays visible
    // even though those measurements turn a short list into a scrollable one.
    expect(measuredRows).toHaveBeenCalledTimes(2)
    expect(wrapper.get('.vue-chat-virtual-scroll__spacer').attributes('style')).toContain('height: 140px')
    expect(viewport.element.scrollTop).toBe(-40)
    await viewport.trigger('scroll')
    expect(wrapper.emitted('scroll')?.at(-1)?.[0]).toMatchObject({ scrollTop: 0 })

    await wrapper.setProps({ size: 6 })
    expect(measuredRows).toHaveBeenCalledTimes(2)
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

    expect((viewport as HTMLElement).scrollTop).toBe(0)
    expect(wrapper.vm.isAtBottom).toBe(true)
  })

  it('supports per-message estimates for cold heterogeneous content', async () => {
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items: messages.slice(0, 3),
        estimatedItemSize: 40,
        estimateItemSize: (_item: Message, index: number) => (index + 1) * 10,
        height: 20,
        itemKey: 'id',
        syncMeasurement: false,
      },
    })
    await nextTick()

    expect(wrapper.get('.vue-chat-virtual-scroll__spacer').attributes('style'))
      .toContain('height: 60px')
    wrapper.unmount()
  })

  it('indexes common append and prepend mutations incrementally', async () => {
    const estimate = vi.fn(() => 40)
    const current = createMessages(10, 100)
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items: current,
        estimateItemSize: estimate,
        height: 100,
        itemKey: 'id',
        syncMeasurement: false,
      },
    })
    expect(estimate).toHaveBeenCalledTimes(100)

    estimate.mockClear()
    const appended = [...current, ...createMessages(110, 2)]
    await wrapper.setProps({ items: appended })
    expect(estimate).toHaveBeenCalledTimes(2)

    estimate.mockClear()
    await wrapper.setProps({ items: [...createMessages(8, 2), ...appended] })
    expect(estimate).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('can rely on ResizeObserver without forcing a synchronous layout read', async () => {
    const measurement = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items: messages.slice(0, 3),
        estimatedItemSize: 40,
        height: 100,
        itemKey: 'id',
        syncMeasurement: false,
      },
    })
    await nextTick()

    expect(measurement).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('keeps pinned and keyboard-focused messages mounted outside the render range', async () => {
    const wrapper = mount(TestChatVirtualScroll, {
      attachTo: document.body,
      props: {
        items: messages,
        estimatedItemSize: 40,
        height: 100,
        size: 4,
        itemKey: 'id',
        initialScroll: 'top',
        pinnedKeys: [90],
      },
      slots: {
        default: '<input class="message-input" />',
      },
    })
    const viewport = wrapper.get('.vue-chat-virtual-scroll')
    const focused = wrapper.get('[aria-posinset="1"] .message-input').element as HTMLInputElement
    focused.focus()
    await viewport.trigger('focusin')
    viewport.element.scrollTop = -1_900
    await viewport.trigger('scroll')

    expect(wrapper.find('[aria-posinset="1"]').exists()).toBe(true)
    expect(wrapper.find('[aria-posinset="91"]').exists()).toBe(true)
    expect(document.activeElement).toBe(focused)
    wrapper.unmount()
  })

  it('exposes logical scrolling by key without leaking the negative native offset', async () => {
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items: messages,
        estimatedItemSize: 40,
        height: 100,
        itemKey: 'id',
        initialScroll: 'top',
      },
    })
    const viewport = wrapper.get('.vue-chat-virtual-scroll')
    Object.defineProperty(viewport.element, 'clientHeight', { configurable: true, value: 100 })
    const scrollTo = vi.fn()
    viewport.element.scrollTo = scrollTo

    wrapper.vm.scrollToKey(50, { align: 'start' })
    expect(scrollTo).toHaveBeenCalledWith({ top: -1_900, behavior: 'auto' })
    viewport.element.scrollTop = -1_900
    expect(wrapper.vm.getScrollPosition()).toBe(2_000)
    wrapper.unmount()
  })

  it('counts appended messages while reading history and clears at the bottom', async () => {
    const { wrapper, viewport } = mountMeasuredChat({ showNewItemsIndicator: true })
    await nextTick()
    viewport.element.scrollTop = -2_000
    await viewport.trigger('scroll')

    await wrapper.setProps({ items: [...messages, ...createMessages(100, 2)] })
    await nextTick()
    expect(wrapper.vm.newItemsCount).toBe(2)
    expect(wrapper.get('.vue-chat-virtual-scroll__new-items').text()).toContain('2 new messages')
    expect(wrapper.emitted('newItemsChange')?.at(-1)).toEqual([2])

    viewport.element.scrollTop = 0
    await viewport.trigger('scroll')
    expect(wrapper.vm.newItemsCount).toBe(0)
    expect(wrapper.find('.vue-chat-virtual-scroll__new-items').exists()).toBe(false)
    wrapper.unmount()
  })

  it('localizes the built-in new-message label', async () => {
    const { wrapper, viewport } = mountMeasuredChat({
      newItemsLabel: (count: number) => `${count} tin nhắn mới`,
    })
    await nextTick()
    viewport.element.scrollTop = -2_000
    await viewport.trigger('scroll')
    await wrapper.setProps({ items: [...messages, ...createMessages(100, 2)] })

    expect(wrapper.get('.vue-chat-virtual-scroll__new-items').text()).toBe('2 tin nhắn mới')
    wrapper.unmount()
  })

  it('reconciles an arbitrary in-place reorder through itemsVersion or refresh()', async () => {
    const items = createMessages(0, 12)
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items,
        itemsVersion: 0,
        itemKey: 'id',
        estimatedItemSize: 40,
        height: 480,
        overscan: 0,
        initialScroll: 'top',
      },
      slots: {
        default: '<template #default="{ item }"><span class="message-id">{{ item.id }}</span></template>',
      },
    })
    const renderedIds = () => wrapper.findAll('.message-id').map((row) => Number(row.text()))

    ;[items[2], items[3]] = [items[3], items[2]]
    await wrapper.setProps({ items, itemsVersion: 1 })
    expect(renderedIds().slice(0, 5)).toEqual([0, 1, 3, 2, 4])

    ;[items[7], items[8]] = [items[8], items[7]]
    wrapper.vm.refresh()
    await nextTick()
    expect(renderedIds().slice(6, 10)).toEqual([6, 8, 7, 9])
    wrapper.unmount()
  })

  it('forces a rebuild when an invalidated reorder and append happen together', async () => {
    const items = createMessages(0, 12)
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items,
        itemsVersion: 0,
        itemKey: 'id',
        estimatedItemSize: 40,
        height: 80,
        initialScroll: 'top',
      },
    })
    const viewport = wrapper.get('.vue-chat-virtual-scroll')
    const scrollTo = vi.fn()
    viewport.element.scrollTo = scrollTo

    ;[items[2], items[3]] = [items[3], items[2]]
    items.push({ id: 12, text: 'Message 12' })
    await wrapper.setProps({ items, itemsVersion: 1 })
    wrapper.vm.scrollToKey(3)

    // Key 3 moved to index 2: logical top 80 in a 520px list/80px viewport.
    expect(scrollTo).toHaveBeenLastCalledWith({ top: -360, behavior: 'auto' })
    wrapper.unmount()
  })

  it('can force-follow selected appended messages such as the local sender', async () => {
    const { wrapper, viewport } = mountMeasuredChat({
      forceStickToBottom: (item: Message) => item.id === 100,
    })
    await nextTick()
    viewport.element.scrollTop = -2_000
    await viewport.trigger('scroll')

    await wrapper.setProps({ items: [...messages, ...createMessages(100, 1)] })
    await nextTick()
    await nextTick()

    expect(viewport.element.scrollTop).toBe(0)
    expect(wrapper.vm.newItemsCount).toBe(0)
    wrapper.unmount()
  })

  it('allows paint containment to be disabled for non-teleported overlays', async () => {
    const wrapper = mount(TestChatVirtualScroll, {
      props: { items: messages, contain: false },
    })
    expect(wrapper.get('.vue-chat-virtual-scroll').classes())
      .not.toContain('vue-chat-virtual-scroll--contained')
    await wrapper.setProps({ contain: true })
    expect(wrapper.get('.vue-chat-virtual-scroll').classes())
      .toContain('vue-chat-virtual-scroll--contained')
    wrapper.unmount()
  })

  it('reports the actual visible range separately from overscan for read tracking', async () => {
    const { wrapper, viewport } = mountMeasuredChat({ overscan: 5 })
    await nextTick()
    expect(wrapper.emitted('visibleChange')?.at(-1)).toEqual([{
      scrollTop: 0,
      startIndex: 0,
      endIndex: 3,
    }])

    viewport.element.scrollTop = -3_700
    await viewport.trigger('scroll')
    await nextTick()
    expect(wrapper.emitted('visibleChange')?.at(-1)).toEqual([{
      scrollTop: 200,
      startIndex: 5,
      endIndex: 8,
    }])
    wrapper.unmount()
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
      top: -2_650,
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

    expect((viewport.element as HTMLElement).scrollTop).toBe(0)

    ;(viewport.element as HTMLElement).scrollTop = -1_940
    await viewport.trigger('scroll')
    await wrapper.setProps({
      items: [...messages, { id: 100, text: 'Message 100' }, {
        id: 101,
        text: 'Message 101',
      }],
    })
    await nextTick()

    expect((viewport.element as HTMLElement).scrollTop).toBe(-1_980)
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

    ;(viewport.element as HTMLElement).scrollTop = -200
    await viewport.trigger('scroll')
    await wrapper.setProps({
      items: [...createMessages(8, 2), ...currentMessages],
    })
    await nextTick()

    expect((viewport.element as HTMLElement).scrollTop).toBe(-200)
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

    ;(viewport.element as HTMLElement).scrollTop = -3900
    await viewport.trigger('scroll')
    await viewport.trigger('scroll')

    expect(wrapper.emitted('loadOlder')).toHaveLength(1)
  })

  it('keeps the visible message DOM mounted when a whole page is prepended', async () => {
    const { wrapper, viewport, row } = mountMeasuredChat({ size: 6 })
    await nextTick()
    viewport.element.scrollTop = -3800
    await viewport.trigger('scroll')
    const anchor = row(3).element

    await wrapper.setProps({ items: [...createMessages(-20, 20), ...messages] })
    await nextTick()

    expect(row(23).element).toBe(anchor)
    expect(viewport.element.scrollTop).toBe(-3800)
    wrapper.unmount()
  })

  it.each([80, 20])('preserves the anchor without native writes when rows above resize to %spx', async (height) => {
    vi.useFakeTimers()
    const { wrapper, viewport, row, resize, screenTop } = mountMeasuredChat()
    await nextTick()
    viewport.element.scrollTop = -3660
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
    expect(wrapper.get('.vue-chat-virtual-scroll__spacer').attributes('style'))
      .toContain(`height: ${4000 + 2 * (height - 40)}px`)

    await viewport.trigger('touchend', { touches: [] })
    await vi.advanceTimersByTimeAsync(100)
    // Native momentum continues after the finger lifts.
    viewport.element.scrollTop = -3680
    writes.mockClear()
    await viewport.trigger('scroll')
    await vi.advanceTimersByTimeAsync(100)
    expect(writes).not.toHaveBeenCalled()
    expect(screenTop(7)).toBe(20)
    expect(wrapper.emitted('scroll')?.at(-1)?.[0]).toMatchObject({
      scrollTop: 220 + 2 * (height - 40),
    })

    await vi.advanceTimersByTimeAsync(60)
    expect(writes).not.toHaveBeenCalled()
    expect(viewport.element.scrollTop).toBe(-3680)
    expect(screenTop(7)).toBe(20)
    expect(row(7).element).toBe(anchor)
    wrapper.unmount()
  })

  it.each([80, 20])('defers native corrections when rows below resize to %spx during touch and momentum', async (height) => {
    vi.useFakeTimers()
    const { wrapper, viewport, row, resize, screenTop } = mountMeasuredChat()
    await nextTick()
    viewport.element.scrollTop = -3660
    await viewport.trigger('scroll')
    const anchor = row(7).element
    const writes = trackScrollWrites(viewport.element)
    await viewport.trigger('touchstart')

    resize(12, height)
    await nextTick()
    resize(13, height)
    await nextTick()
    expect(writes).not.toHaveBeenCalled()
    expect(screenTop(7)).toBe(0)
    expect(row(7).element).toBe(anchor)
    expect(wrapper.get('.vue-chat-virtual-scroll__spacer').attributes('style')).toContain('height: 4000px')

    // Ending native scroll while the finger remains down cannot commit.
    await viewport.trigger('scrollend')
    expect(writes).not.toHaveBeenCalled()
    await viewport.trigger('touchend', { touches: [] })
    await vi.advanceTimersByTimeAsync(100)
    viewport.element.scrollTop = -3680
    writes.mockClear()
    await viewport.trigger('scroll')
    await vi.advanceTimersByTimeAsync(100)

    expect(writes).not.toHaveBeenCalled()
    expect(screenTop(7)).toBe(20)
    expect(wrapper.emitted('scroll')?.at(-1)?.[0]).toMatchObject({ scrollTop: 220 })

    await vi.advanceTimersByTimeAsync(60)
    expect(writes).toHaveBeenCalledTimes(1)
    expect(viewport.element.scrollTop).toBe(-3680 - 2 * (height - 40))
    expect(screenTop(7)).toBe(20)
    expect(row(7).element).toBe(anchor)
    wrapper.unmount()
  })

  it.each([
    ['wheel', () => ({})],
    ['keyboard', () => ({ key: 'PageUp' })],
  ])('defers native corrections during active %s scrolling', async (eventName, eventInit) => {
    vi.useFakeTimers()
    const { wrapper, viewport, resize } = mountMeasuredChat()
    await nextTick()
    viewport.element.scrollTop = -3660
    await viewport.trigger('scroll')
    const writes = trackScrollWrites(viewport.element)

    await viewport.trigger(eventName === 'wheel' ? 'wheel' : 'keydown', eventInit())
    resize(12, 80)
    await nextTick()

    expect(writes).not.toHaveBeenCalled()
    expect(wrapper.get('.vue-chat-virtual-scroll__spacer').attributes('style'))
      .toContain('height: 4000px')

    await vi.advanceTimersByTimeAsync(149)
    expect(writes).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(writes).toHaveBeenCalledTimes(1)
    expect(viewport.element.scrollTop).toBe(-3700)
    wrapper.unmount()
  })

  it('exposes scrolling state, pauses live announcements, and honors scrollEndDelay', async () => {
    vi.useFakeTimers()
    const { wrapper, viewport } = mountMeasuredChat({
      scrollEndDelay: 75,
      initialScroll: 'bottom',
    })
    await nextTick()

    await viewport.trigger('wheel')
    expect(wrapper.vm.isScrolling).toBe(true)
    expect(viewport.attributes('aria-live')).toBe('off')
    expect(wrapper.emitted('scrollingChange')?.at(-1)).toEqual([true])

    await vi.advanceTimersByTimeAsync(74)
    expect(wrapper.vm.isScrolling).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.vm.isScrolling).toBe(false)
    expect(viewport.attributes('aria-live')).toBe('polite')
    expect(wrapper.emitted('scrollingChange')?.at(-1)).toEqual([false])
    wrapper.unmount()
  })

  it('defers native corrections until a scrollbar drag is released', async () => {
    vi.useFakeTimers()
    const { wrapper, viewport, resize } = mountMeasuredChat()
    await nextTick()
    viewport.element.scrollTop = -3660
    await viewport.trigger('scroll')
    const writes = trackScrollWrites(viewport.element)

    await viewport.trigger('pointerdown', { pointerType: 'mouse' })
    resize(12, 80)
    await nextTick()
    await vi.advanceTimersByTimeAsync(500)
    expect(writes).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('pointerup'))
    await vi.advanceTimersByTimeAsync(150)
    expect(writes).toHaveBeenCalledTimes(1)
    expect(viewport.element.scrollTop).toBe(-3700)
    wrapper.unmount()
  })

  it('preserves prepend and measurements during a touch without requesting another page', async () => {
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

    await viewport.trigger('scrollend')
    expect(writes).not.toHaveBeenCalled()
    await viewport.trigger('touchend', { touches: [] })
    await viewport.trigger('scrollend')
    await nextTick()

    expect(writes).not.toHaveBeenCalled()
    expect(viewport.element.scrollTop).toBe(-3900)
    expect(screenTop(21)).toBe(0)
    expect(row(21).element).toBe(anchor)
    wrapper.unmount()
  })

  it('makes the newly prepended top reachable before the current touch ends', async () => {
    const { wrapper, viewport, resize, screenTop } = mountMeasuredChat({ size: 6 })
    await nextTick()
    await viewport.trigger('touchstart')
    await wrapper.setProps({ items: [...createMessages(-20, 20), ...messages] })
    resize(20, 100)
    await nextTick()

    // The browser can immediately use the added scroll extent in this gesture.
    expect(wrapper.get('.vue-chat-virtual-scroll__spacer').attributes('style')).toContain('height: 4860px')
    viewport.element.scrollTop = -4760
    const writes = trackScrollWrites(viewport.element)
    await viewport.trigger('scroll')

    expect(screenTop(1)).toBe(0)
    expect(wrapper.emitted('scroll')?.at(-1)?.[0]).toMatchObject({ scrollTop: 0, startIndex: 0 })
    expect(writes).not.toHaveBeenCalled()
    await viewport.trigger('touchend', { touches: [] })
    await viewport.trigger('scrollend')
    await nextTick()
    expect(writes).not.toHaveBeenCalled()
    expect(screenTop(1)).toBe(0)
    wrapper.unmount()
  })

  it('keeps the visible message still when new messages arrive during a touch', async () => {
    const { wrapper, viewport, row, screenTop } = mountMeasuredChat()
    await nextTick()
    viewport.element.scrollTop = -3660
    await viewport.trigger('scroll')
    const anchor = row(7).element
    const writes = trackScrollWrites(viewport.element)
    await viewport.trigger('touchstart')
    await wrapper.setProps({ items: [...messages, ...createMessages(100, 2)] })
    await nextTick()

    expect(writes).not.toHaveBeenCalled()
    expect(screenTop(7)).toBe(0)
    expect(row(7).element).toBe(anchor)
    await viewport.trigger('scroll')
    expect(wrapper.emitted('scroll')?.at(-1)?.[0]).toMatchObject({ scrollTop: 240 })

    await viewport.trigger('touchend', { touches: [] })
    await viewport.trigger('scrollend')
    await nextTick()
    expect(viewport.element.scrollTop).toBe(-3740)
    expect(screenTop(7)).toBe(0)
    expect(row(7).element).toBe(anchor)
    wrapper.unmount()
  })

  it('clears visual compensation when below-viewport measurements cancel during a touch', async () => {
    const { wrapper, viewport, resize, screenTop } = mountMeasuredChat()
    await nextTick()
    viewport.element.scrollTop = -3660
    await viewport.trigger('scroll')
    const writes = trackScrollWrites(viewport.element)
    await viewport.trigger('touchstart')
    resize(12, 100)
    await nextTick()
    expect(screenTop(7)).toBe(0)

    resize(12, 40)
    await nextTick()
    expect(screenTop(7)).toBe(0)
    expect(wrapper.get('.vue-chat-virtual-scroll__spacer').attributes('style')).toContain('height: 4000px')
    await viewport.trigger('touchend', { touches: [] })
    await viewport.trigger('scrollend')
    await nextTick()
    expect(writes).not.toHaveBeenCalled()
    expect(viewport.element.scrollTop).toBe(-3660)
    expect(screenTop(7)).toBe(0)
    wrapper.unmount()
  })

  it('does not let replacement restoration overwrite a newer explicit scroll request', async () => {
    const { wrapper, viewport } = mountMeasuredChat()
    await nextTick()
    viewport.element.scrollTop = -3660
    await viewport.trigger('scroll')

    await wrapper.setProps({ items: createMessages(1000, 100) })
    wrapper.vm.scrollToBottom()
    await nextTick()
    await nextTick()

    expect(viewport.element.scrollTop).toBe(0)
    expect(wrapper.vm.isAtBottom).toBe(true)
    wrapper.unmount()
  })

  it('commits fresh measurements after a newer scroll request invalidates a scheduled correction', async () => {
    const { wrapper, viewport, resize, screenTop } = mountMeasuredChat()
    await nextTick()
    viewport.element.scrollTop = -3660
    await viewport.trigger('scroll')
    viewport.element.scrollTo = vi.fn((options: ScrollToOptions) => {
      viewport.element.scrollTop = options.top ?? 0
    }) as typeof viewport.element.scrollTo

    resize(12, 100)
    wrapper.vm.scrollTo(240)
    resize(13, 100)
    await nextTick()
    await nextTick()

    expect(viewport.element.scrollTop).toBe(-3780)
    expect(screenTop(7)).toBe(0)
    await viewport.trigger('scroll')
    expect(wrapper.emitted('scroll')?.at(-1)?.[0]).toMatchObject({ scrollTop: 240 })
    wrapper.unmount()
  })

  it.each(['scrollTo', 'scrollToIndex', 'scrollToTop', 'scrollToBottom'])('lets %s override a pending touch adjustment', async (method) => {
    vi.useFakeTimers()
    const { wrapper, viewport, resize } = mountMeasuredChat()
    await nextTick()
    viewport.element.scrollTop = -3660
    await viewport.trigger('scroll')
    viewport.element.scrollTo = vi.fn((options: ScrollToOptions) => {
      viewport.element.scrollTop = options.top ?? 0
    }) as typeof viewport.element.scrollTo
    await viewport.trigger('touchstart')
    resize(12, 100)
    await nextTick()

    const args: Record<string, number[]> = { scrollTo: [600], scrollToIndex: [15], scrollToTop: [], scrollToBottom: [] }
    const expected: Record<string, number> = { scrollTo: -3360, scrollToIndex: -3300, scrollToTop: -3960, scrollToBottom: 0 }
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
    viewport.element.scrollTop = -40
    await viewport.trigger('scroll')
    const writes = trackScrollWrites(viewport.element)
    resize(100, 100)
    await wrapper.setProps({ items: [...messages, ...createMessages(100, 1)] })
    await nextTick()

    expect(writes).not.toHaveBeenCalled()
    expect(viewport.element.scrollTop).toBe(-40)
    wrapper.unmount()
  })

  it('cleans up a deferred touch adjustment when unmounted', async () => {
    vi.useFakeTimers()
    const { wrapper, viewport, resize } = mountMeasuredChat()
    await nextTick()
    viewport.element.scrollTop = -3660
    await viewport.trigger('scroll')
    await viewport.trigger('touchstart')
    resize(12, 100)
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
    viewport.element.scrollTop = -3660
    await viewport.trigger('scroll')
    await viewport.trigger('touchstart')
    resize(3, 10)
    resize(4, 10)
    await nextTick()
    viewport.element.scrollTop = -3840
    const writes = trackScrollWrites(viewport.element)
    await viewport.trigger('scroll')

    expect(writes).not.toHaveBeenCalled()
    expect(screenTop(1)).toBe(0)
    await viewport.trigger('touchend', { touches: [] })
    await viewport.trigger('scrollend')
    await nextTick()
    expect(viewport.element.scrollTop).toBe(-3840)
    expect(screenTop(1)).toBe(0)
    wrapper.unmount()
  })

  it('top-aligns short lists and keeps public offsets at zero when the list becomes empty', async () => {
    const { wrapper, viewport, screenTop } = mountMeasuredChat({ items: messages.slice(0, 2) })
    await nextTick()

    expect(viewport.element.scrollTop).toBeCloseTo(0)
    expect(screenTop(1)).toBe(0)
    expect(screenTop(2)).toBe(40)
    await viewport.trigger('scroll')
    expect(wrapper.emitted('scroll')?.at(-1)?.[0]).toMatchObject({ scrollTop: 0 })

    await wrapper.setProps({ items: [] })
    await nextTick()
    await viewport.trigger('scroll')
    expect(viewport.element.scrollTop).toBeCloseTo(0)
    expect(wrapper.findAll('.vue-chat-virtual-scroll__item')).toHaveLength(0)
    expect(wrapper.emitted('scroll')?.at(-1)?.[0]).toEqual({ scrollTop: 0, startIndex: 0, endIndex: 0 })
    wrapper.unmount()
  })

  it('does not rescan all message keys when an observed row changes height', async () => {
    const itemKey = vi.fn((item: Message) => item.id)
    const { wrapper, viewport, resize, screenTop } = mountMeasuredChat({
      items: createMessages(0, 10_000),
      itemKey,
    })
    await nextTick()
    viewport.element.scrollTop = -399660
    await viewport.trigger('scroll')
    itemKey.mockClear()

    resize(3, 100)
    await nextTick()
    await nextTick()

    expect(screenTop(7)).toBe(0)
    expect(itemKey.mock.calls.length).toBeLessThan(100)
    wrapper.unmount()
  })
})
