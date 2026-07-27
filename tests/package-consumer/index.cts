import VueVirtualScroll, {
  VirtualScroll,
  type VirtualScrollProps,
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

void [plugin, props, VirtualScroll]
