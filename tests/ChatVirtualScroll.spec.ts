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
  readonly observe = vi.fn()
  readonly unobserve = vi.fn()
  readonly disconnect = vi.fn()

  constructor(readonly callback: ResizeObserverCallback) {}
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
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
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

  it('follows appended messages only while the user is at the bottom', async () => {
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items: messages,
        estimatedItemSize: 40,
        height: 100,
        itemKey: 'id',
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

  it('preserves the visible conversation when older messages are prepended', async () => {
    const currentMessages = createMessages(10, 10)
    const wrapper = mount(TestChatVirtualScroll, {
      props: {
        items: currentMessages,
        estimatedItemSize: 40,
        height: 100,
        itemKey: 'id',
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
