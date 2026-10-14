import VueVirtualScroll, {
  DynamicVirtualScroll,
  type ChatVirtualScrollExpose,
  type ChatVirtualScrollProps,
  VirtualList,
  VirtualScroll,
  VirtualCarousel,
  WindowGirdVirtualScroll,
  type VirtualListProps,
  type VirtualCarouselProps,
  type VirtualScrollExpose,
  type VirtualScrollProps,
  type WindowGirdVirtualScrollProps,
} from 'vue-virtual-flow'
import type { Plugin } from 'vue'

interface Row {
  id: number
  label: string
}

const plugin: Plugin = VueVirtualScroll
const props: VirtualScrollProps<Row> = {
  items: [{ id: 1, label: 'one' }],
  itemSize: 40,
  height: 400,
  itemKey: 'id',
}
const exposed: VirtualScrollExpose | undefined = undefined
const carouselProps: VirtualCarouselProps<Row> = {
  items: props.items,
  autoWidth: true,
  estimatedItemWidth: 240,
  rtl: true,
  loop: true,
  keepAlive: true,
  maxCachedItems: 5,
  pinnedIndexes: [0],
  dragThreshold: 8,
  momentum: true,
  settleDuration: 250,
  nativeSnap: false,
}
const simpleProps: VirtualListProps<Row> = {
  items: [{ id: 1, label: 'one' }],
}
const chatProps: ChatVirtualScrollProps<Row> = {
  items: props.items,
  itemsVersion: 1,
  itemKey: 'id',
  estimateItemSize: () => 48,
  pinnedKeys: [1],
  newItemsLabel: (count) => `${count} new`,
  forceStickToBottom: (item) => item.id === 1,
}
const inspectChat = (chat: ChatVirtualScrollExpose) => {
  chat.refresh()
  chat.scrollToKey(1)
  return [chat.getScrollPosition(), chat.newItemsCount, chat.isScrolling]
}
const restorePosition = (list: VirtualScrollExpose) => list.scrollTo(320)
const gridProps: WindowGirdVirtualScrollProps<Row> = {
  items: [{ id: 1, label: 'one' }],
  itemSize: 240,
  columns: 4,
  gap: 16,
}

void [
  plugin,
  carouselProps,
  VirtualCarousel,
  props,
  simpleProps,
  exposed,
  restorePosition,
  gridProps,
  VirtualList,
  VirtualScroll,
  DynamicVirtualScroll,
  WindowGirdVirtualScroll,
  chatProps,
  inspectChat,
]
