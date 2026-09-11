<script setup lang="ts" generic="T">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { useItemKey } from '../composables/useItemKey'
import { usePullToRefresh } from '../composables/usePullToRefresh'
import type {
  ItemKey,
  ScrollAlignment,
  VirtualScrollEvent,
} from '../types'

defineOptions({
  name: 'WindowGirdVirtualScroll',
})

const props = withDefaults(
  defineProps<{
    items: readonly T[]
    itemSize: number
    columns?: number
    gap?: number
    overscan?: number
    itemKey?: ItemKey<T> extends infer Key ? Key : never
    ariaLabel?: string
    hasMore?: boolean
    loading?: boolean
    loadingItemSize?: number
    loadMoreThreshold?: number
    pullToRefresh?: boolean
    refreshing?: boolean
    pullRefreshThreshold?: number
  }>(),
  {
    columns: 2,
    gap: 0,
    overscan: 1,
    itemKey: undefined,
    ariaLabel: 'Window virtual grid',
    hasMore: false,
    loading: false,
    loadingItemSize: undefined,
    loadMoreThreshold: 200,
    pullToRefresh: false,
    refreshing: false,
    pullRefreshThreshold: 64,
  },
)

const emit = defineEmits<{
  scroll: [event: VirtualScrollEvent]
  loadMore: []
  refresh: []
}>()

defineSlots<{
  default(props: {
    item: T
    index: number
    rowIndex: number
    columnIndex: number
  }): unknown
  empty?(): unknown
  loading?(): unknown
  refresh?(props: {
    pullDistance: number
    progress: number
    refreshing: boolean
  }): unknown
}>()

const root = ref<HTMLElement>()
const windowScrollTop = ref(0)
const viewportHeight = ref(0)
const componentTop = ref(0)
let rootResizeObserver: ResizeObserver | undefined
let lastLoadMoreItemCount = -1

const { getItemKey } = useItemKey<T>({
  componentName: 'WindowGirdVirtualScroll',
  items: () => props.items,
  itemKey: () => props.itemKey as ItemKey<T> | undefined,
})

const {
  pulling,
  pullDistance,
  pullOffset,
  pullProgress,
  refreshMessage,
  refreshThreshold,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleTouchCancel,
} = usePullToRefresh({
  enabled: () => props.pullToRefresh,
  refreshing: () => props.refreshing,
  threshold: () => props.pullRefreshThreshold,
  onRefresh: () => emit('refresh'),
  scrollTop: () =>
    typeof window === 'undefined' ? 0 : Math.max(0, window.scrollY),
})

const normalizedItemSize = computed(() => Math.max(1, props.itemSize))
const normalizedColumns = computed(() =>
  Math.max(1, Math.floor(props.columns)),
)
const normalizedGap = computed(() => Math.max(0, props.gap))
const normalizedOverscan = computed(() => Math.max(0, Math.floor(props.overscan)))
const normalizedLoadingItemSize = computed(() =>
  Math.max(1, props.loadingItemSize ?? normalizedItemSize.value),
)
const rowStride = computed(
  () => normalizedItemSize.value + normalizedGap.value,
)
const rowCount = computed(() =>
  Math.ceil(props.items.length / normalizedColumns.value),
)
const itemsHeight = computed(() => {
  if (rowCount.value === 0) return 0
  return (
    rowCount.value * normalizedItemSize.value +
    (rowCount.value - 1) * normalizedGap.value
  )
})
const loadingTop = computed(
  () => itemsHeight.value + (props.items.length ? normalizedGap.value : 0),
)
const totalHeight = computed(
  () =>
    itemsHeight.value +
    (props.loading
      ? normalizedLoadingItemSize.value +
        (props.items.length ? normalizedGap.value : 0)
      : 0),
)

const relativeScrollTop = computed(() =>
  Math.max(0, windowScrollTop.value - componentTop.value),
)
const startRow = computed(() =>
  Math.max(
    0,
    Math.floor(relativeScrollTop.value / rowStride.value) -
      normalizedOverscan.value,
  ),
)
const endRow = computed(() => {
  if (rowCount.value === 0) return 0

  const relativeViewportBottom = Math.max(
    normalizedItemSize.value,
    windowScrollTop.value + viewportHeight.value - componentTop.value,
  )
  const visibleEnd = Math.ceil(
    (relativeViewportBottom + normalizedGap.value) / rowStride.value,
  )
  return Math.min(
    rowCount.value,
    visibleEnd + normalizedOverscan.value,
  )
})
const startIndex = computed(() =>
  Math.min(props.items.length, startRow.value * normalizedColumns.value),
)
const endIndex = computed(() =>
  Math.min(props.items.length, endRow.value * normalizedColumns.value),
)
const visibleItems = computed(() =>
  props.items.slice(startIndex.value, endIndex.value).map((item, offset) => {
    const index = startIndex.value + offset
    return {
      item,
      index,
      key: getItemKey(item, index),
      rowIndex: Math.floor(index / normalizedColumns.value),
      columnIndex: index % normalizedColumns.value,
    }
  }),
)
const contentStyle = computed(() => ({
  gridTemplateColumns: `repeat(${normalizedColumns.value}, minmax(0, 1fr))`,
  columnGap: `${normalizedGap.value}px`,
  rowGap: `${normalizedGap.value}px`,
  transform: `translateY(${startRow.value * rowStride.value}px)`,
}))

function updateWindowMetrics() {
  if (typeof window === 'undefined') return

  windowScrollTop.value = Math.max(0, window.scrollY)
  viewportHeight.value = window.innerHeight
  if (root.value) {
    componentTop.value =
      root.value.getBoundingClientRect().top + windowScrollTop.value
  }
}

function emitScroll() {
  emit('scroll', {
    scrollTop: relativeScrollTop.value,
    startIndex: startIndex.value,
    endIndex: endIndex.value,
  })
}

function handleWindowScroll() {
  updateWindowMetrics()
  emitScroll()
  maybeEmitLoadMore()
}

function maybeEmitLoadMore() {
  if (
    typeof window === 'undefined' ||
    !props.hasMore ||
    props.loading ||
    lastLoadMoreItemCount === props.items.length
  ) {
    return
  }

  const threshold = Math.max(0, props.loadMoreThreshold)
  const componentBottom = componentTop.value + totalHeight.value
  const viewportBottom = windowScrollTop.value + viewportHeight.value

  if (componentBottom - viewportBottom <= threshold) {
    lastLoadMoreItemCount = props.items.length
    emit('loadMore')
  }
}

function scrollTo(position: number, options: ScrollToOptions = {}) {
  if (typeof window === 'undefined') return

  updateWindowMetrics()
  const maximum = Math.max(0, totalHeight.value - viewportHeight.value)
  const relativeTop = Math.min(
    Math.max(0, Number.isFinite(position) ? position : 0),
    maximum,
  )
  const top = Math.max(0, componentTop.value + relativeTop)
  const behavior = options.behavior ?? 'auto'

  if (behavior === 'auto') windowScrollTop.value = top
  window.scrollTo({ ...options, top, behavior })
}

function scrollToIndex(
  index: number,
  options: ScrollToOptions & { align?: ScrollAlignment } = {},
) {
  if (typeof window === 'undefined' || props.items.length === 0) return

  updateWindowMetrics()
  const safeIndex = Math.min(
    props.items.length - 1,
    Math.max(0, Math.floor(index)),
  )
  const rowIndex = Math.floor(safeIndex / normalizedColumns.value)
  const { align = 'start', ...scrollOptions } = options
  let top = componentTop.value + rowIndex * rowStride.value

  if (align === 'center') {
    top -= (viewportHeight.value - normalizedItemSize.value) / 2
  } else if (align === 'end') {
    top -= viewportHeight.value - normalizedItemSize.value
  }

  const maximum = Math.max(
    componentTop.value,
    componentTop.value + totalHeight.value - viewportHeight.value,
  )
  const targetTop = Math.max(0, Math.min(top, maximum))
  const behavior = scrollOptions.behavior ?? 'auto'

  if (behavior === 'auto') windowScrollTop.value = targetTop
  window.scrollTo({
    ...scrollOptions,
    top: targetTop,
    behavior,
  })
}

function scrollToTop(behavior: ScrollBehavior = 'auto') {
  if (typeof window === 'undefined') return
  updateWindowMetrics()
  window.scrollTo({ top: Math.max(0, componentTop.value), behavior })
}

watch(
  () => [
    props.items.length,
    props.itemSize,
    props.columns,
    props.gap,
  ],
  async () => {
    await nextTick()
    updateWindowMetrics()
    maybeEmitLoadMore()
  },
)

watch(
  () => [props.hasMore, props.loading],
  async ([hasMore]) => {
    if (!hasMore) lastLoadMoreItemCount = -1
    await nextTick()
    updateWindowMetrics()
    maybeEmitLoadMore()
  },
)

onMounted(() => {
  updateWindowMetrics()
  window.addEventListener('scroll', handleWindowScroll, { passive: true })
  window.addEventListener('resize', handleWindowScroll, { passive: true })

  if (typeof ResizeObserver !== 'undefined') {
    rootResizeObserver = new ResizeObserver(() => {
      updateWindowMetrics()
      maybeEmitLoadMore()
    })
    if (root.value) rootResizeObserver.observe(root.value)
  }

  nextTick(maybeEmitLoadMore)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleWindowScroll)
  window.removeEventListener('resize', handleWindowScroll)
  if (rootResizeObserver) {
    rootResizeObserver.disconnect()
    rootResizeObserver = undefined
  }
})

defineExpose({
  scrollTo,
  scrollToIndex,
  scrollToTop,
})
</script>

<template>
  <div
    ref="root"
    class="vue-window-gird-virtual-scroll"
    :class="{ 'vue-window-gird-virtual-scroll--pulling': pulling }"
    role="list"
    :aria-label="ariaLabel"
    @touchstart.passive="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel"
  >
    <div
      v-if="pullToRefresh || refreshing"
      class="vue-window-gird-virtual-scroll__refresh"
      :style="{
        height: `${refreshThreshold}px`,
        transform: `translateY(${pullOffset - refreshThreshold}px)`,
      }"
      role="status"
      aria-live="polite"
    >
      <slot
        name="refresh"
        :pull-distance="pullDistance"
        :progress="pullProgress"
        :refreshing="refreshing"
      >
        {{ refreshMessage }}
      </slot>
    </div>

    <div
      v-if="items.length || loading"
      class="vue-window-gird-virtual-scroll__spacer"
      :style="{
        height: `${totalHeight}px`,
        transform: `translateY(${pullOffset}px)`,
      }"
    >
      <div
        class="vue-window-gird-virtual-scroll__content"
        :style="contentStyle"
      >
        <div
          v-for="{ item, index, key, rowIndex, columnIndex } in visibleItems"
          :key="key"
          class="vue-window-gird-virtual-scroll__item"
          :style="{ height: `${normalizedItemSize}px` }"
          role="listitem"
          :aria-posinset="index + 1"
          :aria-setsize="items.length"
        >
          <slot
            :item="item"
            :index="index"
            :row-index="rowIndex"
            :column-index="columnIndex"
          />
        </div>
      </div>

      <div
        v-if="loading"
        class="vue-window-gird-virtual-scroll__loading"
        :style="{
          height: `${normalizedLoadingItemSize}px`,
          transform: `translateY(${loadingTop}px)`,
        }"
        role="status"
        aria-live="polite"
      >
        <slot name="loading">Loading more…</slot>
      </div>
    </div>

    <div
      v-else
      class="vue-window-gird-virtual-scroll__empty"
      :style="{ transform: `translateY(${pullOffset}px)` }"
    >
      <slot name="empty" />
    </div>
  </div>
</template>
