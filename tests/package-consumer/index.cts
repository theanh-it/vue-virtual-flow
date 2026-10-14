import VueVirtualScroll, {
  VirtualScroll,
  VirtualCarousel,
  type VirtualCarouselProps,
  WindowGirdVirtualScroll,
  type VirtualScrollProps,
  type WindowGirdVirtualScrollProps,
} from 'vue-virtual-flow'
import type { Plugin } from 'vue'

interface Row {
  id: number
}

const plugin: Plugin = VueVirtualScroll
const carouselProps: VirtualCarouselProps<Row> = {
  items: [{ id: 1 }], loop: true, rtl: true, autoWidth: true,
  keepAlive: true, maxCachedItems: 4, pinnedIndexes: [0],
  dragThreshold: 8, momentum: false, settleDuration: 0,
  nativeSnap: false,
}
const props: VirtualScrollProps<Row> = {
  items: [{ id: 1 }],
  itemSize: 40,
  height: '20rem',
  itemKey: (item) => item.id,
}
const gridProps: WindowGirdVirtualScrollProps<Row> = {
  items: [{ id: 1 }],
  itemSize: 160,
  columns: 2,
}

void [plugin, props, gridProps, carouselProps, VirtualCarousel, VirtualScroll, WindowGirdVirtualScroll]
