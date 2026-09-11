import type { App, Component, Plugin } from 'vue'
import ChatVirtualScroll from './components/ChatVirtualScroll.vue'
import DynamicVirtualScroll from './components/DynamicVirtualScroll.vue'
import ShortMediaFeed from './components/ShortMediaFeed.vue'
import VirtualCarousel from './components/VirtualCarousel.vue'
import VirtualScroll from './components/VirtualScroll.vue'
import WindowDynamicVirtualScroll from './components/WindowDynamicVirtualScroll.vue'
import WindowGirdVirtualScroll from './components/WindowGirdVirtualScroll.vue'
import './style.css'

declare module 'vue' {
  export interface GlobalComponents {
    ChatVirtualScroll: typeof ChatVirtualScroll
    DynamicVirtualScroll: typeof DynamicVirtualScroll
    ShortMediaFeed: typeof ShortMediaFeed
    VirtualCarousel: typeof VirtualCarousel
    VirtualList: typeof DynamicVirtualScroll
    VirtualScroll: typeof VirtualScroll
    WindowDynamicVirtualScroll: typeof WindowDynamicVirtualScroll
    WindowGirdVirtualScroll: typeof WindowGirdVirtualScroll
  }
}

const VirtualList: typeof DynamicVirtualScroll = DynamicVirtualScroll

export {
  ChatVirtualScroll,
  DynamicVirtualScroll,
  ShortMediaFeed,
  VirtualCarousel,
  VirtualList,
  VirtualScroll,
  WindowDynamicVirtualScroll,
  WindowGirdVirtualScroll,
}
export type {
  ChatVirtualScrollExpose,
  ChatVirtualScrollProps,
  DynamicVirtualScrollProps,
  ItemKey,
  ResponsiveBreakpoint,
  ScrollAlignment,
  ShortMediaFeedChangeEvent,
  ShortMediaFeedExpose,
  ShortMediaFeedProps,
  VirtualCarouselChangeEvent,
  VirtualCarouselExpose,
  VirtualCarouselProps,
  VirtualListExpose,
  VirtualListProps,
  VirtualScrollEvent,
  VirtualScrollExpose,
  VirtualScrollProps,
  WindowDynamicVirtualScrollProps,
  WindowGirdVirtualScrollProps,
} from './types'

export const VueVirtualScroll: Plugin = {
  install(app: App) {
    app.component('ChatVirtualScroll', ChatVirtualScroll as Component)
    app.component('DynamicVirtualScroll', DynamicVirtualScroll as Component)
    app.component('ShortMediaFeed', ShortMediaFeed as Component)
    app.component('VirtualCarousel', VirtualCarousel as Component)
    app.component('VirtualList', VirtualList as Component)
    app.component('VirtualScroll', VirtualScroll as Component)
    app.component(
      'WindowDynamicVirtualScroll',
      WindowDynamicVirtualScroll as Component,
    )
    app.component(
      'WindowGirdVirtualScroll',
      WindowGirdVirtualScroll as Component,
    )
  },
}

export default VueVirtualScroll
