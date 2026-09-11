import VueVirtualScroll, {
  VirtualScroll,
  WindowGirdVirtualScroll,
  type VirtualScrollProps,
  type WindowGirdVirtualScrollProps,
} from 'vue-virtual-flow'
import type { Plugin } from 'vue'

interface Row {
  id: number
}

const plugin: Plugin = VueVirtualScroll
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

void [plugin, props, gridProps, VirtualScroll, WindowGirdVirtualScroll]
