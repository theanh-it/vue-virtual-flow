import VueVirtualScroll, {
  DynamicVirtualScroll,
  VirtualList,
  VirtualScroll,
  WindowGirdVirtualScroll,
  type VirtualListProps,
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
const simpleProps: VirtualListProps<Row> = {
  items: [{ id: 1, label: 'one' }],
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
  props,
  simpleProps,
  exposed,
  restorePosition,
  gridProps,
  VirtualList,
  VirtualScroll,
  DynamicVirtualScroll,
  WindowGirdVirtualScroll,
]
