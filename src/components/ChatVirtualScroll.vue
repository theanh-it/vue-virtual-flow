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
import type {
  ItemKey,
  ScrollAlignment,
  VirtualScrollEvent,
} from '../types'
import { createZeroHeightWarning, toCssHeight } from '../utils/layout'

defineOptions({
  name: 'ChatVirtualScroll',
})

const props = withDefaults(
  defineProps<{
    items: readonly T[]
    estimatedItemSize?: number
    height?: number | string
    overscan?: number
    /** Render budget including overscan; always keeps the viewport filled. */
    size?: number
    itemKey?: ItemKey<T> extends infer Key ? Key : never
    ariaLabel?: string
    stickToBottom?: boolean
    bottomThreshold?: number
    initialScroll?: 'top' | 'bottom'
    hasOlder?: boolean
    loadingOlder?: boolean
    loadOlderThreshold?: number
  }>(),
  {
    estimatedItemSize: 48,
    height: 400,
    overscan: 5,
    size: undefined,
    itemKey: undefined,
    ariaLabel: 'Chat messages',
    stickToBottom: true,
    bottomThreshold: 80,
    initialScroll: 'bottom',
    hasOlder: false,
    loadingOlder: false,
    loadOlderThreshold: 120,
  },
)

const emit = defineEmits<{
  scroll: [event: VirtualScrollEvent]
  loadOlder: []
  bottomChange: [isAtBottom: boolean]
}>()

defineSlots<{
  default(props: { item: T; index: number }): unknown
  empty?(): unknown
  loadingOlder?(): unknown
}>()

const viewport = ref<HTMLElement>()
const scrollTop = ref(0)
const scrollCompensation = ref(0)
const measuredHeight = ref(0)
const measurementVersion = ref(0)
const isAtBottom = ref(true)
const measuredSizes = new Map<PropertyKey, number>()
const observedElements = new Map<HTMLElement, PropertyKey>()
let viewportResizeObserver: ResizeObserver | undefined
let itemResizeObserver: ResizeObserver | undefined
let lastLoadOlderItemCount = -1
let mounted = false
let touching = false
let touchScrolling = false
let scrollIdleTimer: ReturnType<typeof setTimeout> | undefined
let pendingScrollAdjustment = 0
let adjustmentScheduled = false
let scrollRequestVersion = 0
const warnIfZeroHeight = createZeroHeightWarning('ChatVirtualScroll')
const { getItemKey } = useItemKey<T>({
  componentName: 'ChatVirtualScroll',
  items: () => props.items,
  itemKey: () => props.itemKey as ItemKey<T> | undefined,
})

const normalizedEstimate = computed(() =>
  Math.max(1, props.estimatedItemSize),
)
const normalizedOverscan = computed(() => Math.max(0, Math.floor(props.overscan)))
const normalizedSize = computed(() =>
  props.size !== undefined && Number.isFinite(props.size) && props.size > 0
    ? Math.max(1, Math.floor(props.size))
    : undefined,
)
const viewportHeight = computed(() => {
  if (measuredHeight.value > 0) return measuredHeight.value
  if (typeof props.height === 'number') return Math.max(0, props.height)
  return normalizedEstimate.value
})

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

const indexByKey = computed(() => {
  const indexes = new Map<PropertyKey, number>()
  props.items.forEach((item, index) => {
    indexes.set(getItemKey(item, index), index)
  })
  return indexes
})

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

const renderRange = computed(() => {
  if (props.items.length === 0) return { start: 0, end: 0 }

  const firstVisible = findIndexAtOffset(scrollTop.value)
  const visibleEnd =
    findIndexAtOffset(scrollTop.value + viewportHeight.value) + 1
  const start = Math.max(0, firstVisible - normalizedOverscan.value)
  const end = Math.min(
    props.items.length,
    visibleEnd + normalizedOverscan.value,
  )
  const size = normalizedSize.value
  if (size === undefined || end - start <= size) return { start, end }

  // Trim only overscan so a small budget cannot leave gaps in the viewport.
  const budget = Math.max(0, size - (visibleEnd - firstVisible))
  const availableBefore = firstVisible - start
  const availableAfter = end - visibleEnd
  let before = Math.min(availableBefore, Math.ceil(budget / 2))
  const after = Math.min(availableAfter, budget - before)
  before = Math.min(availableBefore, budget - after)

  return { start: firstVisible - before, end: visibleEnd + after }
})

const startIndex = computed(() => renderRange.value.start)
const endIndex = computed(() => renderRange.value.end)

const visibleItems = computed(() =>
  props.items
    .slice(startIndex.value, endIndex.value)
    .map((item, offset) => {
      const index = startIndex.value + offset
      return {
        item,
        index,
        key: getItemKey(item, index),
        top: metrics.value.offsets[index] - scrollCompensation.value,
      }
    }),
)

const containerStyle = computed(() => ({
  height: toCssHeight(props.height),
}))

function getScrollTop() {
  return (viewport.value?.scrollTop ?? 0) + pendingScrollAdjustment
}

function scheduleScrollAdjustment() {
  if (adjustmentScheduled) return
  adjustmentScheduled = true

  nextTick(() => {
    adjustmentScheduled = false
    const element = viewport.value
    if (!element || touchScrolling || pendingScrollAdjustment === 0) return

    // The new spacer and render range must exist before changing native scrollTop.
    pendingScrollAdjustment = 0
    // Use the logical target: a shorter spacer may already have clamped native
    // scrollTop, so adding the delta again would move the anchor twice.
    element.scrollTop = scrollTop.value
    scrollTop.value = element.scrollTop
    updateBottomState()
    maybeEmitLoadOlder()
  })
}

function adjustScrollPosition(adjustment: number) {
  if (!viewport.value || adjustment === 0) return

  pendingScrollAdjustment += adjustment
  // Update the range before Vue patches the rows, preserving their keyed DOM.
  scrollTop.value = getScrollTop()
  if (touchScrolling) {
    // Keep the anchor in place without interrupting native touch momentum.
    scrollCompensation.value = pendingScrollAdjustment
  } else {
    scheduleScrollAdjustment()
  }
}

function clearScrollIdleTimer() {
  clearTimeout(scrollIdleTimer)
  scrollIdleTimer = undefined
}

function handleScrollEnd() {
  if (touching) return
  clearScrollIdleTimer()
  touchScrolling = false
  scrollTop.value = getScrollTop()
  scrollCompensation.value = 0
  scheduleScrollAdjustment()
}

function scheduleScrollEnd() {
  clearScrollIdleTimer()
  // Also covers browsers without scrollend and taps that produce no scroll event.
  if (touchScrolling && !touching) {
    scrollIdleTimer = setTimeout(handleScrollEnd, 150)
  }
}

function handleTouchStart() {
  clearScrollIdleTimer()
  touching = true
  touchScrolling = true
  scrollCompensation.value = pendingScrollAdjustment
}

function handleTouchEnd(event: TouchEvent) {
  touching = event.touches.length > 0
  scheduleScrollEnd()
}

function updateBottomState() {
  const element = viewport.value
  if (!element) return

  const distance = Math.max(
    0,
    metrics.value.total - getScrollTop() - element.clientHeight,
  )
  const nextIsAtBottom = distance <= Math.max(0, props.bottomThreshold)
  if (nextIsAtBottom !== isAtBottom.value) {
    isAtBottom.value = nextIsAtBottom
    if (mounted) emit('bottomChange', nextIsAtBottom)
  }
}

function updateMeasuredHeight() {
  measuredHeight.value = viewport.value?.clientHeight ?? 0
  warnIfZeroHeight(viewport.value, props.height)
  nextTick(() => {
    updateBottomState()
    maybeEmitLoadOlder()
  })
}

function handleScroll() {
  if (pendingScrollAdjustment < 0 && getScrollTop() < 0) {
    // Shrinking rows can move the logical start below the native scroll origin.
    // Consume that offset at the boundary instead of exposing an empty gap.
    pendingScrollAdjustment = -Math.max(0, viewport.value?.scrollTop ?? 0)
    if (touchScrolling) scrollCompensation.value = pendingScrollAdjustment
  }
  scrollTop.value = getScrollTop()
  scheduleScrollEnd()
  updateBottomState()
  emit('scroll', {
    scrollTop: scrollTop.value,
    startIndex: startIndex.value,
    endIndex: endIndex.value,
  })
  maybeEmitLoadOlder()
}

function maybeEmitLoadOlder() {
  const element = viewport.value
  if (
    !mounted ||
    !element ||
    !props.hasOlder ||
    props.loadingOlder ||
    lastLoadOlderItemCount === props.items.length
  ) {
    return
  }

  if (getScrollTop() <= Math.max(0, props.loadOlderThreshold)) {
    lastLoadOlderItemCount = props.items.length
    emit('loadOlder')
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

function handleItemResize(entries: ResizeObserverEntry[]) {
  const previousMetrics = metrics.value
  const previousScrollTop = getScrollTop()
  const keepAtBottom = !touchScrolling && isAtBottom.value && props.stickToBottom
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
      previousMetrics.offsets[index + 1] <= previousScrollTop
    ) {
      adjustmentAboveViewport += height - previous
    }

    measuredSizes.set(key, height)
    changed = true
  }

  if (!changed) return
  measurementVersion.value += 1

  const element = viewport.value
  if (!element) return
  adjustScrollPosition(keepAtBottom
    ? Math.max(0, metrics.value.total - element.clientHeight) - previousScrollTop
    : adjustmentAboveViewport)
  nextTick(updateBottomState)
}

function setItemElement(
  value: Element | ComponentPublicInstance | null,
  key: PropertyKey,
) {
  if (!(value instanceof HTMLElement)) return
  if (observedElements.get(value) === key) return

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

function applyScrollPosition(top: number, options: ScrollToOptions, direct = false) {
  const element = viewport.value
  if (!element) return

  const previousScrollTop = getScrollTop()
  const wasCompensating = scrollCompensation.value !== 0
  const version = ++scrollRequestVersion
  const behavior = options.behavior ?? 'auto'
  pendingScrollAdjustment = 0
  scrollCompensation.value = 0
  touchScrolling = false
  clearScrollIdleTimer()
  if (behavior === 'auto') scrollTop.value = top

  const apply = () => {
    if (viewport.value !== element || version !== scrollRequestVersion) return
    if (wasCompensating && behavior !== 'auto') element.scrollTop = previousScrollTop
    if (direct && behavior === 'auto') {
      element.scrollTop = top
    } else {
      element.scrollTo({ ...options, top, behavior })
    }
    nextTick(updateBottomState)
  }

  if (wasCompensating) nextTick(apply)
  else apply()
}

function scrollTo(position: number, options: ScrollToOptions = {}) {
  const element = viewport.value
  if (!element) return

  const maximum = Math.max(0, metrics.value.total - element.clientHeight)
  const top = Math.min(
    Math.max(0, Number.isFinite(position) ? position : 0),
    maximum,
  )
  applyScrollPosition(top, options)
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
  const itemSize = metrics.value.sizes[safeIndex]
  let top = metrics.value.offsets[safeIndex]

  if (align === 'center') {
    top -= (element.clientHeight - itemSize) / 2
  } else if (align === 'end') {
    top -= element.clientHeight - itemSize
  }

  const targetTop = Math.max(
    0,
    Math.min(top, metrics.value.total - element.clientHeight),
  )
  applyScrollPosition(targetTop, scrollOptions)
}

function scrollToTop(behavior: ScrollBehavior = 'auto') {
  applyScrollPosition(0, { behavior })
}

function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  const element = viewport.value
  if (!element) return

  const top = Math.max(0, metrics.value.total - element.clientHeight)
  applyScrollPosition(top, { behavior }, true)
}

let previousKeys = props.items.map((item, index) => getItemKey(item, index))

watch(
  () => props.items.map((item, index) => getItemKey(item, index)),
  async (nextKeys) => {
    const oldKeys = previousKeys
    previousKeys = nextKeys
    const element = viewport.value
    const keepAtBottom = !touchScrolling && isAtBottom.value && props.stickToBottom
    const previousFirstKey = oldKeys[0]
    const prependedCount =
      previousFirstKey === undefined ? 0 : nextKeys.indexOf(previousFirstKey)
    const prependedHeight =
      prependedCount > 0
        ? nextKeys
            .slice(0, prependedCount)
            .reduce<number>(
              (total, key) =>
                total + (measuredSizes.get(key) ?? normalizedEstimate.value),
              0,
            )
        : 0

    const currentKeys = new Set(nextKeys)
    for (const key of measuredSizes.keys()) {
      if (!currentKeys.has(key)) measuredSizes.delete(key)
    }
    measurementVersion.value += 1

    if (prependedHeight > 0) {
      adjustScrollPosition(prependedHeight)
    } else if (element && nextKeys.length > oldKeys.length && keepAtBottom) {
      adjustScrollPosition(
        Math.max(0, metrics.value.total - element.clientHeight) - getScrollTop(),
      )
    } else if (nextKeys.length === 0 || prependedCount < 0) {
      pendingScrollAdjustment = 0
      scrollCompensation.value = 0
    }

    await nextTick()
    if (!viewport.value) return
    scrollTop.value = getScrollTop()
    updateBottomState()
    maybeEmitLoadOlder()
  },
)

watch(
  () => [props.hasOlder, props.loadingOlder],
  async ([hasOlder]) => {
    if (!hasOlder) lastLoadOlderItemCount = -1
    await nextTick()
    maybeEmitLoadOlder()
  },
)

onMounted(() => {
  updateMeasuredHeight()

  if (typeof ResizeObserver !== 'undefined') {
    viewportResizeObserver = new ResizeObserver(updateMeasuredHeight)
    itemResizeObserver = new ResizeObserver(handleItemResize)

    if (viewport.value) viewportResizeObserver.observe(viewport.value)
    for (const [element] of observedElements) {
      itemResizeObserver.observe(element)
    }
  }

  nextTick(() => {
    if (props.initialScroll === 'bottom') {
      scrollToBottom('auto')
    }
    mounted = true
    updateBottomState()
    maybeEmitLoadOlder()
  })
})

onUpdated(removeDisconnectedElements)

onBeforeUnmount(() => {
  mounted = false
  clearScrollIdleTimer()
  pendingScrollAdjustment = 0
  scrollRequestVersion += 1
  if (viewportResizeObserver) {
    viewportResizeObserver.disconnect()
    viewportResizeObserver = undefined
  }
  if (itemResizeObserver) {
    itemResizeObserver.disconnect()
    itemResizeObserver = undefined
  }
  observedElements.clear()
})

defineExpose({
  isAtBottom,
  scrollTo,
  scrollToIndex,
  scrollToTop,
  scrollToBottom,
})
</script>

<template>
  <div
    ref="viewport"
    class="vue-chat-virtual-scroll"
    :style="containerStyle"
    role="log"
    :aria-label="ariaLabel"
    aria-live="polite"
    tabindex="0"
    @scroll.passive="handleScroll"
    @scrollend.passive="handleScrollEnd"
    @touchstart.passive="handleTouchStart"
    @touchend.passive="handleTouchEnd"
    @touchcancel.passive="handleTouchEnd"
  >
    <div
      v-if="loadingOlder"
      class="vue-chat-virtual-scroll__loading-older"
      role="status"
      aria-live="polite"
    >
      <div>
        <slot name="loadingOlder">Loading older messages…</slot>
      </div>
    </div>

    <div
      v-if="items.length"
      class="vue-chat-virtual-scroll__spacer"
      :style="{ height: `${Math.max(0, metrics.total - scrollCompensation)}px` }"
    >
      <div
        v-for="{ item, index, key, top } in visibleItems"
        :key="key"
        :ref="(element) => setItemElement(element, key)"
        class="vue-chat-virtual-scroll__item"
        :style="{ transform: `translateY(${top}px)` }"
        role="article"
        :aria-posinset="index + 1"
        :aria-setsize="items.length"
      >
        <slot :item="item" :index="index" />
      </div>
    </div>

    <slot v-else name="empty" />
  </div>
</template>
