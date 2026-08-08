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
import type {
  ItemKey,
  ShortMediaFeedChangeEvent,
  ShortMediaFeedExpose,
} from '../types'
import { createZeroHeightWarning, toCssHeight } from '../utils/layout'

defineOptions({
  name: 'ShortMediaFeed',
})

const props = withDefaults(
  defineProps<{
    items: readonly T[]
    activeIndex?: number
    buffer?: number
    height?: number | string
    itemKey?: ItemKey<T> extends infer Key ? Key : never
    ariaLabel?: string
    hasMore?: boolean
    loading?: boolean
    loadMoreThreshold?: number
  }>(),
  {
    activeIndex: 0,
    buffer: 1,
    height: '100dvh',
    itemKey: undefined,
    ariaLabel: 'Short media feed',
    hasMore: false,
    loading: false,
    loadMoreThreshold: 2,
  },
)

const emit = defineEmits<{
  'update:activeIndex': [index: number]
  change: [event: ShortMediaFeedChangeEvent<T>]
  reachStart: []
  reachEnd: []
  loadMore: []
}>()

defineSlots<{
  default(props: { item: T; index: number; active: boolean }): unknown
  empty?(): unknown
}>()

const viewport = ref<HTMLElement>()
const measuredHeight = ref(0)
const currentIndex = ref(normalizeIndex(props.activeIndex))
let resizeObserver: ResizeObserver | undefined
let lastLoadMoreItemCount = -1
const warnIfZeroHeight = createZeroHeightWarning('ShortMediaFeed')
const { getItemKey } = useItemKey<T>({
  componentName: 'ShortMediaFeed',
  items: () => props.items,
  itemKey: () => props.itemKey as ItemKey<T> | undefined,
})

const normalizedBuffer = computed(() =>
  Math.max(0, Math.floor(props.buffer)),
)
const normalizedLoadMoreThreshold = computed(() =>
  Math.max(
    0,
    Math.floor(
      Number.isFinite(props.loadMoreThreshold)
        ? props.loadMoreThreshold
        : 0,
    ),
  ),
)
const viewportHeight = computed(() => {
  if (measuredHeight.value > 0) return measuredHeight.value
  return typeof props.height === 'number' ? Math.max(1, props.height) : 0
})
const startIndex = computed(() =>
  Math.max(0, currentIndex.value - normalizedBuffer.value),
)
const endIndex = computed(() =>
  Math.min(
    props.items.length,
    currentIndex.value + normalizedBuffer.value + 1,
  ),
)
const visibleItems = computed(() =>
  props.items
    .slice(startIndex.value, endIndex.value)
    .map((item, offset) => ({
      item,
      index: startIndex.value + offset,
    })),
)
const beforeSize = computed(() => startIndex.value * viewportHeight.value)
const afterSize = computed(
  () => (props.items.length - endIndex.value) * viewportHeight.value,
)
const containerStyle = computed(() => ({
  height: toCssHeight(props.height),
}))

function normalizeIndex(index: number): number {
  if (props.items.length === 0) return 0
  return Math.min(
    props.items.length - 1,
    Math.max(0, Math.floor(Number.isFinite(index) ? index : 0)),
  )
}

function maybeEmitLoadMore() {
  if (
    !props.hasMore ||
    props.loading ||
    lastLoadMoreItemCount === props.items.length
  ) {
    return
  }

  const remainingItems =
    props.items.length === 0
      ? 0
      : props.items.length - 1 - currentIndex.value

  if (remainingItems <= normalizedLoadMoreThreshold.value) {
    lastLoadMoreItemCount = props.items.length
    emit('loadMore')
  }
}

function updateCurrentIndex(index: number) {
  const nextIndex = normalizeIndex(index)
  if (nextIndex === currentIndex.value || props.items.length === 0) return

  currentIndex.value = nextIndex
  emit('update:activeIndex', nextIndex)
  emit('change', {
    index: nextIndex,
    item: props.items[nextIndex],
  })

  if (nextIndex === 0) emit('reachStart')
  if (nextIndex === props.items.length - 1) emit('reachEnd')
  maybeEmitLoadMore()
}

function setNativeScrollPosition(
  top: number,
  options: ScrollToOptions = {},
) {
  const element = viewport.value
  if (!element) return

  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ ...options, top })
  } else {
    element.scrollTop = top
  }
}

function scrollToIndex(
  index: number,
  options: ScrollToOptions = {},
) {
  if (props.items.length === 0) return

  const nextIndex = normalizeIndex(index)
  updateCurrentIndex(nextIndex)
  setNativeScrollPosition(nextIndex * viewportHeight.value, options)
}

function handleScroll(event: Event) {
  if (viewportHeight.value <= 0) return

  const scrollTop = (event.currentTarget as HTMLElement).scrollTop
  updateCurrentIndex(Math.round(scrollTop / viewportHeight.value))
}

function handleKeydown(event: KeyboardEvent) {
  let nextIndex: number | undefined

  if (event.key === 'ArrowDown' || event.key === 'PageDown') {
    nextIndex = currentIndex.value + 1
  } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
    nextIndex = currentIndex.value - 1
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = props.items.length - 1
  }

  if (nextIndex === undefined) return

  event.preventDefault()
  scrollToIndex(nextIndex, { behavior: 'smooth' })
}

function updateMeasuredHeight() {
  const nextHeight = viewport.value?.clientHeight ?? 0
  warnIfZeroHeight(viewport.value, props.height)
  if (nextHeight <= 0 || nextHeight === measuredHeight.value) return

  measuredHeight.value = nextHeight
  nextTick(() => {
    setNativeScrollPosition(currentIndex.value * nextHeight)
  })
}

watch(
  () => props.activeIndex,
  async (index) => {
    const nextIndex = normalizeIndex(index)
    if (nextIndex === currentIndex.value) return

    currentIndex.value = nextIndex
    await nextTick()
    setNativeScrollPosition(nextIndex * viewportHeight.value)
    maybeEmitLoadMore()
  },
)

watch(
  () => [
    props.hasMore,
    props.loading,
    props.loadMoreThreshold,
  ] as const,
  async ([hasMore]) => {
    if (!hasMore) lastLoadMoreItemCount = -1
    await nextTick()
    maybeEmitLoadMore()
  },
)

watch(
  () => props.items.length,
  async () => {
    const nextIndex = normalizeIndex(currentIndex.value)

    if (props.items.length === 0) {
      if (currentIndex.value !== 0) {
        currentIndex.value = 0
        emit('update:activeIndex', 0)
      }
    } else {
      updateCurrentIndex(nextIndex)
    }

    await nextTick()
    setNativeScrollPosition(nextIndex * viewportHeight.value)
    maybeEmitLoadMore()
  },
)

onMounted(async () => {
  updateMeasuredHeight()

  if (typeof ResizeObserver !== 'undefined' && viewport.value) {
    resizeObserver = new ResizeObserver(updateMeasuredHeight)
    resizeObserver.observe(viewport.value)
  }

  await nextTick()
  setNativeScrollPosition(currentIndex.value * viewportHeight.value)
  maybeEmitLoadMore()
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = undefined
  }
})

defineExpose<ShortMediaFeedExpose>({
  scrollToIndex,
})
</script>

<template>
  <div
    ref="viewport"
    class="vue-short-media-feed"
    :style="containerStyle"
    role="list"
    aria-orientation="vertical"
    :aria-label="ariaLabel"
    tabindex="0"
    @scroll.passive="handleScroll"
    @keydown="handleKeydown"
  >
    <template v-if="items.length">
      <div
        v-if="beforeSize > 0"
        class="vue-short-media-feed__spacer"
        :style="{ height: `${beforeSize}px` }"
        aria-hidden="true"
      />

      <div
        v-for="{ item, index } in visibleItems"
        :key="getItemKey(item, index)"
        class="vue-short-media-feed__item"
        :style="{ height: `${viewportHeight}px` }"
        role="listitem"
        :aria-current="index === currentIndex ? 'true' : undefined"
        :aria-posinset="index + 1"
        :aria-setsize="items.length"
      >
        <slot
          :item="item"
          :index="index"
          :active="index === currentIndex"
        />
      </div>

      <div
        v-if="afterSize > 0"
        class="vue-short-media-feed__spacer"
        :style="{ height: `${afterSize}px` }"
        aria-hidden="true"
      />
    </template>

    <div v-else class="vue-short-media-feed__empty">
      <slot name="empty" />
    </div>
  </div>
</template>
