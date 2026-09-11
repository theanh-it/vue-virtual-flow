<script setup lang="ts" generic="T">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  watch,
} from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useItemKey } from '../composables/useItemKey'
import { usePullToRefresh } from '../composables/usePullToRefresh'
import type {
  ItemKey,
  ScrollAlignment,
  VirtualScrollEvent,
} from '../types'

defineOptions({
  name: 'WindowDynamicVirtualScroll',
})

const props = withDefaults(
  defineProps<{
    items: readonly T[]
    estimatedItemSize?: number
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
    estimatedItemSize: 48,
    overscan: 3,
    itemKey: undefined,
    ariaLabel: 'Window dynamic virtual list',
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

const root = ref<HTMLElement>()
const windowScrollTop = ref(0)
const viewportHeight = ref(0)
const componentTop = ref(0)
const measurementVersion = ref(0)
const measuredSizes = new Map<PropertyKey, number>()
const observedElements = new Map<HTMLElement, PropertyKey>()
const pendingResizeEntries = new Map<Element, ResizeObserverEntry>()
let rootResizeObserver: ResizeObserver | undefined
let itemResizeObserver: ResizeObserver | undefined
let windowFrame: ScheduledFrame | undefined
let itemResizeFrame: ScheduledFrame | undefined
let shouldEmitScroll = false
let isMounted = false
let lastLoadMoreItemCount = -1
const { getItemKey } = useItemKey<T>({
  componentName: 'WindowDynamicVirtualScroll',
  items: () => props.items,
  itemKey: () => props.itemKey as ItemKey<T> | undefined,
})

interface ScheduledFrame {
  id: number
  type: 'animation' | 'timeout'
}

function scheduleFrame(callback: () => void): ScheduledFrame {
  if (typeof window.requestAnimationFrame === 'function') {
    return {
      id: window.requestAnimationFrame(callback),
      type: 'animation',
    }
  }

  return {
    id: window.setTimeout(callback, 0),
    type: 'timeout',
  }
}

function cancelFrame(frame: ScheduledFrame | undefined) {
  if (!frame) return
  if (frame.type === 'animation') {
    window.cancelAnimationFrame(frame.id)
  } else {
    window.clearTimeout(frame.id)
  }
}

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

const normalizedEstimate = computed(() =>
  Math.max(1, props.estimatedItemSize),
)
const normalizedLoadingItemSize = computed(() =>
  Math.max(1, props.loadingItemSize ?? normalizedEstimate.value),
)
const normalizedOverscan = computed(() => Math.max(0, Math.floor(props.overscan)))

const metrics = computed(() => {
  measurementVersion.value

  const offsets = new Array<number>(props.items.length + 1)
  const sizes = new Array<number>(props.items.length)
  offsets[0] = 0

  for (let index = 0; index < props.items.length; index += 1) {
    const key = getItemKey(props.items[index], index)
    const size = measuredSizes.get(key) ?? normalizedEstimate.value
    sizes[index] = size
    offsets[index + 1] = offsets[index] + size
  }

  return {
    offsets,
    sizes,
    total: offsets[props.items.length] ?? 0,
  }
})

const totalHeight = computed(
  () =>
    metrics.value.total +
    (props.loading ? normalizedLoadingItemSize.value : 0),
)

const indexByKey = computed(() => {
  const indexes = new Map<PropertyKey, number>()
  props.items.forEach((item, index) => {
    indexes.set(getItemKey(item, index), index)
  })
  return indexes
})

const relativeScrollTop = computed(() =>
  Math.max(0, windowScrollTop.value - componentTop.value),
)

function findIndexAtOffset(offset: number) {
  if (props.items.length === 0) return 0

  const offsets = metrics.value.offsets
  let low = 0
  let high = props.items.length

  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (offsets[middle + 1] <= offset) {
      low = middle + 1
    } else {
      high = middle
    }
  }

  return Math.min(low, props.items.length - 1)
}

const startIndex = computed(() =>
  Math.max(
    0,
    findIndexAtOffset(relativeScrollTop.value) - normalizedOverscan.value,
  ),
)

const endIndex = computed(() => {
  if (props.items.length === 0) return 0

  const relativeViewportBottom =
    windowScrollTop.value + viewportHeight.value - componentTop.value
  const visibleBottom = Math.max(
    normalizedEstimate.value,
    relativeViewportBottom,
  )
  const lastVisible = findIndexAtOffset(visibleBottom) + 1
  return Math.min(
    props.items.length,
    lastVisible + normalizedOverscan.value,
  )
})

const visibleItems = computed(() =>
  props.items
    .slice(startIndex.value, endIndex.value)
    .map((item, offset) => {
      const index = startIndex.value + offset
      return {
        item,
        index,
        key: getItemKey(item, index),
        top: metrics.value.offsets[index],
      }
    }),
)

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

function scheduleWindowUpdate(emitScrollEvent = false) {
  if (!isMounted) return
  shouldEmitScroll ||= emitScrollEvent
  if (windowFrame) return

  windowFrame = scheduleFrame(() => {
    windowFrame = undefined
    updateWindowMetrics()
    if (shouldEmitScroll) {
      shouldEmitScroll = false
      emitScroll()
    }
    maybeEmitLoadMore()
  })
}

function handleWindowScroll() {
  scheduleWindowUpdate(true)
}

function handleWindowResize() {
  scheduleWindowUpdate()
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

function getEntryHeight(entry: ResizeObserverEntry) {
  const borderBox = entry.borderBoxSize
  if (borderBox) {
    const box = Array.isArray(borderBox) ? borderBox[0] : borderBox
    if (box?.blockSize) return box.blockSize
  }
  return entry.contentRect.height
}

function applyItemResize(entries: ResizeObserverEntry[]) {
  const previousMetrics = metrics.value
  let adjustmentAboveViewport = 0
  let changed = false

  for (const entry of entries) {
    const element = entry.target as HTMLElement
    const key = observedElements.get(element)
    const height = getEntryHeight(entry)
    if (key === undefined || height <= 0) continue

    const previous = measuredSizes.get(key) ?? normalizedEstimate.value
    if (Math.abs(previous - height) < 0.5) continue

    const index = indexByKey.value.get(key)
    if (
      index !== undefined &&
      previousMetrics.offsets[index + 1] <= relativeScrollTop.value
    ) {
      adjustmentAboveViewport += height - previous
    }

    measuredSizes.set(key, height)
    changed = true
  }

  if (!changed) return
  measurementVersion.value += 1

  nextTick(() => {
    if (!isMounted) return
    if (adjustmentAboveViewport !== 0 && typeof window !== 'undefined') {
      const targetTop = Math.max(
        0,
        windowScrollTop.value + adjustmentAboveViewport,
      )
      windowScrollTop.value = targetTop
      window.scrollTo({ top: targetTop, behavior: 'auto' })
    }
    updateWindowMetrics()
    maybeEmitLoadMore()
  })
}

function handleItemResize(entries: ResizeObserverEntry[]) {
  if (!isMounted) return
  for (const entry of entries) {
    pendingResizeEntries.set(entry.target, entry)
  }
  if (itemResizeFrame) return

  itemResizeFrame = scheduleFrame(() => {
    itemResizeFrame = undefined
    const pendingEntries = Array.from(pendingResizeEntries.values())
    pendingResizeEntries.clear()
    applyItemResize(pendingEntries)
  })
}

function setItemElement(
  value: Element | ComponentPublicInstance | null,
  key: PropertyKey,
) {
  if (!(value instanceof HTMLElement)) return

  observedElements.set(value, key)
  itemResizeObserver?.observe(value)
}

function removeDisconnectedElements() {
  for (const [element] of observedElements) {
    if (!element.isConnected) {
      itemResizeObserver?.unobserve(element)
      observedElements.delete(element)
    }
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
  const { align = 'start', ...scrollOptions } = options
  const itemSize = metrics.value.sizes[safeIndex]
  let top = componentTop.value + metrics.value.offsets[safeIndex]

  if (align === 'center') {
    top -= (viewportHeight.value - itemSize) / 2
  } else if (align === 'end') {
    top -= viewportHeight.value - itemSize
  }

  const maximum = Math.max(
    componentTop.value,
    componentTop.value + totalHeight.value - viewportHeight.value,
  )
  const targetTop = Math.max(0, Math.min(top, maximum))
  const behavior = scrollOptions.behavior ?? 'auto'

  if (behavior === 'auto') {
    windowScrollTop.value = targetTop
  }

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
  () => props.itemKey,
  () => {
    measuredSizes.clear()
    measurementVersion.value += 1
    lastLoadMoreItemCount = -1
  },
)

watch(
  () => props.items.map((item, index) => getItemKey(item, index)),
  async (currentItemKeys, previousItemKeys) => {
    const dataSetChanged =
      currentItemKeys.length !== previousItemKeys.length ||
      currentItemKeys.some((key, index) => key !== previousItemKeys[index])
    const currentKeys = new Set(currentItemKeys)

    for (const key of measuredSizes.keys()) {
      if (!currentKeys.has(key)) measuredSizes.delete(key)
    }
    if (dataSetChanged) lastLoadMoreItemCount = -1
    measurementVersion.value += 1

    await nextTick()
    if (!isMounted) return
    updateWindowMetrics()
    maybeEmitLoadMore()
  },
)

watch(
  () => [props.hasMore, props.loading],
  async ([hasMore]) => {
    if (!hasMore) lastLoadMoreItemCount = -1
    await nextTick()
    if (!isMounted) return
    updateWindowMetrics()
    maybeEmitLoadMore()
  },
)

onMounted(() => {
  isMounted = true
  updateWindowMetrics()
  window.addEventListener('scroll', handleWindowScroll, { passive: true })
  window.addEventListener('resize', handleWindowResize, { passive: true })

  if (typeof ResizeObserver !== 'undefined') {
    rootResizeObserver = new ResizeObserver(() => {
      scheduleWindowUpdate()
    })
    itemResizeObserver = new ResizeObserver(handleItemResize)

    if (root.value) rootResizeObserver.observe(root.value)
    for (const [element] of observedElements) {
      itemResizeObserver.observe(element)
    }
  }

  nextTick(() => {
    if (isMounted) maybeEmitLoadMore()
  })
})

onUpdated(removeDisconnectedElements)

onBeforeUnmount(() => {
  isMounted = false
  window.removeEventListener('scroll', handleWindowScroll)
  window.removeEventListener('resize', handleWindowResize)
  cancelFrame(windowFrame)
  cancelFrame(itemResizeFrame)
  windowFrame = undefined
  itemResizeFrame = undefined
  shouldEmitScroll = false
  pendingResizeEntries.clear()
  if (rootResizeObserver) {
    rootResizeObserver.disconnect()
    rootResizeObserver = undefined
  }
  if (itemResizeObserver) {
    itemResizeObserver.disconnect()
    itemResizeObserver = undefined
  }
  observedElements.clear()
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
    class="vue-window-dynamic-virtual-scroll"
    :class="{ 'vue-window-dynamic-virtual-scroll--pulling': pulling }"
    role="list"
    :aria-label="ariaLabel"
    @touchstart.passive="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel"
  >
    <div
      v-if="pullToRefresh || refreshing"
      class="vue-window-dynamic-virtual-scroll__refresh"
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
      class="vue-window-dynamic-virtual-scroll__spacer"
      :style="{
        height: `${totalHeight}px`,
        transform: `translateY(${pullOffset}px)`,
      }"
    >
      <div
        v-for="{ item, index, key, top } in visibleItems"
        :key="key"
        :ref="(element) => setItemElement(element, key)"
        class="vue-window-dynamic-virtual-scroll__item"
        :style="{ transform: `translateY(${top}px)` }"
        role="listitem"
        :aria-posinset="index + 1"
        :aria-setsize="items.length"
      >
        <slot :item="item" :index="index" />
      </div>

      <div
        v-if="loading"
        class="vue-window-dynamic-virtual-scroll__loading"
        :style="{
          height: `${normalizedLoadingItemSize}px`,
          transform: `translateY(${metrics.total}px)`,
        }"
        role="status"
        aria-live="polite"
      >
        <slot name="loading">Loading more…</slot>
      </div>
    </div>

    <div
      v-else
      class="vue-window-dynamic-virtual-scroll__empty"
      :style="{ transform: `translateY(${pullOffset}px)` }"
    >
      <slot name="empty" />
    </div>
  </div>
</template>
