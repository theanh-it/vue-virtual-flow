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
import { createZeroHeightWarning, toCssHeight } from '../utils/layout'

defineOptions({
  name: 'VirtualScroll',
})

const props = withDefaults(
  defineProps<{
    items: readonly T[]
    itemSize: number
    height?: number | string
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
    height: 400,
    overscan: 3,
    itemKey: undefined,
    ariaLabel: 'Virtual list',
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
  default(props: { item: T; index: number }): unknown
  empty?(): unknown
  loading?(): unknown
  refresh?(props: {
    pullDistance: number
    progress: number
    refreshing: boolean
  }): unknown
}>()

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
})

const viewport = ref<HTMLElement>()
const scrollTop = ref(0)
const measuredHeight = ref(0)
let resizeObserver: ResizeObserver | undefined
let lastLoadMoreItemCount = -1
const warnIfZeroHeight = createZeroHeightWarning('VirtualScroll')
const { getItemKey } = useItemKey<T>({
  componentName: 'VirtualScroll',
  items: () => props.items,
  itemKey: () => props.itemKey as ItemKey<T> | undefined,
})

const normalizedItemSize = computed(() => Math.max(1, props.itemSize))
const normalizedOverscan = computed(() => Math.max(0, Math.floor(props.overscan)))
const itemsHeight = computed(
  () => props.items.length * normalizedItemSize.value,
)
const normalizedLoadingItemSize = computed(() =>
  Math.max(1, props.loadingItemSize ?? normalizedItemSize.value),
)
const totalHeight = computed(
  () =>
    itemsHeight.value +
    (props.loading ? normalizedLoadingItemSize.value : 0),
)
const viewportHeight = computed(() => {
  if (measuredHeight.value > 0) return measuredHeight.value
  return typeof props.height === 'number' ? props.height : 0
})

const startIndex = computed(() =>
  Math.max(
    0,
    Math.floor(scrollTop.value / normalizedItemSize.value) -
      normalizedOverscan.value,
  ),
)

const endIndex = computed(() => {
  const visibleEnd = Math.ceil(
    (scrollTop.value + viewportHeight.value) / normalizedItemSize.value,
  )
  return Math.min(
    props.items.length,
    visibleEnd + normalizedOverscan.value,
  )
})

const visibleItems = computed(() =>
  props.items
    .slice(startIndex.value, endIndex.value)
    .map((item, offset) => ({
      item,
      index: startIndex.value + offset,
    })),
)

const containerStyle = computed(() => ({
  height: toCssHeight(props.height),
}))

const contentStyle = computed(() => ({
  transform: `translateY(${startIndex.value * normalizedItemSize.value}px)`,
}))

function updateMeasuredHeight() {
  measuredHeight.value = viewport.value?.clientHeight ?? 0
  warnIfZeroHeight(viewport.value, props.height)
  nextTick(maybeEmitLoadMore)
}

function handleScroll(event: Event) {
  scrollTop.value = (event.currentTarget as HTMLElement).scrollTop
  emit('scroll', {
    scrollTop: scrollTop.value,
    startIndex: startIndex.value,
    endIndex: endIndex.value,
  })
  maybeEmitLoadMore()
}

function maybeEmitLoadMore() {
  const element = viewport.value
  if (
    !element ||
    !props.hasMore ||
    props.loading ||
    lastLoadMoreItemCount === props.items.length
  ) {
    return
  }

  const threshold = Math.max(0, props.loadMoreThreshold)
  const distanceToEnd =
    totalHeight.value - element.scrollTop - element.clientHeight

  if (distanceToEnd <= threshold) {
    lastLoadMoreItemCount = props.items.length
    emit('loadMore')
  }
}

function scrollTo(position: number, options: ScrollToOptions = {}) {
  const element = viewport.value
  if (!element) return

  const maximum = Math.max(0, totalHeight.value - element.clientHeight)
  const top = Math.min(
    Math.max(0, Number.isFinite(position) ? position : 0),
    maximum,
  )
  const behavior = options.behavior ?? 'auto'

  if (behavior === 'auto') scrollTop.value = top
  element.scrollTo({ ...options, top, behavior })
}

function scrollToIndex(
  index: number,
  options: ScrollToOptions & { align?: ScrollAlignment } = {},
) {
  const element = viewport.value
  if (!element || props.items.length === 0) return

  const safeIndex = Math.min(
    props.items.length - 1,
    Math.max(0, Math.floor(index)),
  )
  const { align = 'start', ...scrollOptions } = options
  let top = safeIndex * normalizedItemSize.value

  if (align === 'center') {
    top -= (element.clientHeight - normalizedItemSize.value) / 2
  } else if (align === 'end') {
    top -= element.clientHeight - normalizedItemSize.value
  }

  element.scrollTo({
    ...scrollOptions,
    top: Math.max(0, Math.min(top, totalHeight.value - element.clientHeight)),
  })
}

function scrollToTop(behavior: ScrollBehavior = 'auto') {
  viewport.value?.scrollTo({ top: 0, behavior })
}

watch(
  () => [props.items.length, props.itemSize],
  async () => {
    await nextTick()
    const element = viewport.value
    if (!element) return

    const maximum = Math.max(0, totalHeight.value - element.clientHeight)
    if (element.scrollTop > maximum) {
      element.scrollTop = maximum
      scrollTop.value = maximum
    }
    maybeEmitLoadMore()
  },
)

watch(
  () => [props.hasMore, props.loading],
  async ([hasMore]) => {
    if (!hasMore) lastLoadMoreItemCount = -1
    await nextTick()
    maybeEmitLoadMore()
  },
)

onMounted(() => {
  updateMeasuredHeight()
  if (typeof ResizeObserver !== 'undefined' && viewport.value) {
    resizeObserver = new ResizeObserver(updateMeasuredHeight)
    resizeObserver.observe(viewport.value)
  }
  nextTick(maybeEmitLoadMore)
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = undefined
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
    ref="viewport"
    class="vue-virtual-scroll"
    :class="{ 'vue-virtual-scroll--pulling': pulling }"
    :style="containerStyle"
    role="list"
    :aria-label="ariaLabel"
    tabindex="0"
    @scroll.passive="handleScroll"
    @touchstart.passive="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel"
  >
    <div
      v-if="pullToRefresh || refreshing"
      class="vue-virtual-scroll__refresh"
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
      class="vue-virtual-scroll__spacer"
      :style="{
        height: `${totalHeight}px`,
        transform: `translateY(${pullOffset}px)`,
      }"
    >
      <div class="vue-virtual-scroll__content" :style="contentStyle">
        <div
          v-for="{ item, index } in visibleItems"
          :key="getItemKey(item, index)"
          class="vue-virtual-scroll__item"
          :style="{ height: `${normalizedItemSize}px` }"
          role="listitem"
          :aria-posinset="index + 1"
          :aria-setsize="items.length"
        >
          <slot :item="item" :index="index" />
        </div>
      </div>

      <div
        v-if="loading"
        class="vue-virtual-scroll__loading"
        :style="{
          height: `${normalizedLoadingItemSize}px`,
          transform: `translateY(${itemsHeight}px)`,
        }"
        role="status"
        aria-live="polite"
      >
        <slot name="loading">Loading more…</slot>
      </div>
    </div>

    <div
      v-else
      class="vue-virtual-scroll__empty"
      :style="{ transform: `translateY(${pullOffset}px)` }"
    >
      <slot name="empty" />
    </div>
  </div>
</template>
