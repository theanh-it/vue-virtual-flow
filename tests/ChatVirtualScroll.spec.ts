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
})
