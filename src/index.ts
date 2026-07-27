import type { App, Component, Plugin } from 'vue'
import ChatVirtualScroll from './components/ChatVirtualScroll.vue'
import DynamicVirtualScroll from './components/DynamicVirtualScroll.vue'
import ShortMediaFeed from './components/ShortMediaFeed.vue'
import VirtualCarousel from './components/VirtualCarousel.vue'
import VirtualScroll from './components/VirtualScroll.vue'
import WindowDynamicVirtualScroll from './components/WindowDynamicVirtualScroll.vue'
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
}
export type {
  ChatVirtualScrollExpose,
  ChatVirtualScrollProps,
  DynamicVirtualScrollProps,
  ItemKey,
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
  },
}

export default VueVirtualScroll
