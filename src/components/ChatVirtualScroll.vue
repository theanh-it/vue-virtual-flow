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
const measuredHeight = ref(0)
const measurementVersion = ref(0)
const isAtBottom = ref(true)
const measuredSizes = new Map<PropertyKey, number>()
const observedElements = new Map<HTMLElement, PropertyKey>()
let viewportResizeObserver: ResizeObserver | undefined
let itemResizeObserver: ResizeObserver | undefined
let lastLoadOlderItemCount = -1
let mounted = false
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

const startIndex = computed(() =>
  Math.max(
    0,
    findIndexAtOffset(scrollTop.value) - normalizedOverscan.value,
  ),
)

const endIndex = computed(() => {
  if (props.items.length === 0) return 0

  const lastVisible =
    findIndexAtOffset(scrollTop.value + viewportHeight.value) + 1
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

const containerStyle = computed(() => ({
  height: toCssHeight(props.height),
}))

function updateBottomState() {
  const element = viewport.value
  if (!element) return

  const distance = Math.max(
    0,
    metrics.value.total - element.scrollTop - element.clientHeight,
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

function handleScroll(event: Event) {
  scrollTop.value = (event.currentTarget as HTMLElement).scrollTop
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

  if (element.scrollTop <= Math.max(0, props.loadOlderThreshold)) {
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
  const keepAtBottom = isAtBottom.value && props.stickToBottom
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
      previousMetrics.offsets[index + 1] <= scrollTop.value
    ) {
      adjustmentAboveViewport += height - previous
    }

    measuredSizes.set(key, height)
    changed = true
  }

  if (!changed) return
  measurementVersion.value += 1

  nextTick(() => {
    const element = viewport.value
    if (!element) return

    if (keepAtBottom) {
      scrollToBottom('auto')
    } else if (adjustmentAboveViewport !== 0) {
      element.scrollTop += adjustmentAboveViewport
      scrollTop.value = element.scrollTop
      updateBottomState()
    }
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
  const element = viewport.value
  if (!element) return

  const maximum = Math.max(0, metrics.value.total - element.clientHeight)
  const top = Math.min(
    Math.max(0, Number.isFinite(position) ? position : 0),
    maximum,
  )
  const behavior = options.behavior ?? 'auto'

  if (behavior === 'auto') scrollTop.value = top
  element.scrollTo({ ...options, top, behavior })
  nextTick(updateBottomState)
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
  const behavior = scrollOptions.behavior ?? 'auto'

  if (behavior === 'auto') scrollTop.value = targetTop
  element.scrollTo({
    ...scrollOptions,
    top: targetTop,
    behavior,
  })
  nextTick(updateBottomState)
}

function scrollToTop(behavior: ScrollBehavior = 'auto') {
  const element = viewport.value
  if (!element) return

  if (behavior === 'auto') scrollTop.value = 0
  element.scrollTo({ top: 0, behavior })
  nextTick(updateBottomState)
}

function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  const element = viewport.value
  if (!element) return

  const top = Math.max(0, metrics.value.total - element.clientHeight)
  if (behavior === 'auto') {
    element.scrollTop = top
    scrollTop.value = top
  } else {
    element.scrollTo({ top, behavior })
  }
  nextTick(updateBottomState)
}

let previousKeys = props.items.map((item, index) => getItemKey(item, index))

watch(
  () => props.items.map((item, index) => getItemKey(item, index)),
  async (nextKeys) => {
    const oldKeys = previousKeys
    previousKeys = nextKeys
    const element = viewport.value
    const previousScrollTop = element?.scrollTop ?? 0
    const keepAtBottom = isAtBottom.value && props.stickToBottom
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

    await nextTick()
    if (!element) return

    if (prependedHeight > 0) {
      element.scrollTop = previousScrollTop + prependedHeight
      scrollTop.value = element.scrollTop
    } else if (nextKeys.length > oldKeys.length && keepAtBottom) {
      scrollToBottom('auto')
    }

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
      :style="{ height: `${metrics.total}px` }"
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
