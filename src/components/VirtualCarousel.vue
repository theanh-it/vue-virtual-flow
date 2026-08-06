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
  VirtualCarouselChangeEvent,
  VirtualCarouselExpose,
} from '../types'
import { toCssHeight } from '../utils/layout'

defineOptions({
  name: 'VirtualCarousel',
})

const props = withDefaults(
  defineProps<{
    items: readonly T[]
    activeIndex?: number
    slidesPerView?: number
    slidesToScroll?: number
    gap?: number
    buffer?: number
    height?: number | string
    itemKey?: ItemKey<T> extends infer Key ? Key : never
    ariaLabel?: string
    hasMore?: boolean
    loading?: boolean
    loadMoreThreshold?: number
    autoplay?: boolean
    autoplayDelay?: number
    autoplayLoop?: boolean
    pauseOnHover?: boolean
  }>(),
  {
    activeIndex: 0,
    slidesPerView: 1,
    slidesToScroll: 1,
    gap: 0,
    buffer: 1,
    height: 'auto',
    itemKey: undefined,
    ariaLabel: 'Carousel',
    hasMore: false,
    loading: false,
    loadMoreThreshold: 2,
    autoplay: false,
    autoplayDelay: 3000,
    autoplayLoop: true,
    pauseOnHover: true,
  },
)

const emit = defineEmits<{
  'update:activeIndex': [index: number]
  change: [event: VirtualCarouselChangeEvent<T>]
  reachStart: []
  reachEnd: []
  loadMore: []
}>()

defineSlots<{
  default(props: {
    item: T
    index: number
    active: boolean
    visible: boolean
  }): unknown
  empty?(): unknown
}>()

const viewport = ref<HTMLElement>()
const measuredWidth = ref(0)
const currentIndex = ref(0)
let resizeObserver: ResizeObserver | undefined
let lastLoadMoreItemCount = -1
let autoplayTimer: ReturnType<typeof setTimeout> | undefined
let programmaticScrollTarget: number | undefined
const isHovering = ref(false)
const { getItemKey } = useItemKey<T>({
  componentName: 'VirtualCarousel',
  items: () => props.items,
  itemKey: () => props.itemKey as ItemKey<T> | undefined,
})

const normalizedSlidesPerView = computed(() =>
  Math.max(
    1,
    Math.floor(
      Number.isFinite(props.slidesPerView)
        ? props.slidesPerView
        : 1,
    ),
  ),
)
const normalizedSlidesToScroll = computed(() =>
  Math.max(
    1,
    Math.floor(
      Number.isFinite(props.slidesToScroll)
        ? props.slidesToScroll
        : 1,
    ),
  ),
)
const normalizedGap = computed(() =>
  Math.max(0, Number.isFinite(props.gap) ? props.gap : 0),
)
const normalizedBuffer = computed(() =>
  Math.max(
    0,
    Math.floor(Number.isFinite(props.buffer) ? props.buffer : 0),
  ),
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
const normalizedAutoplayDelay = computed(() => {
  if (!Number.isFinite(props.autoplayDelay)) return 3000
  return Math.max(1, props.autoplayDelay)
})
const viewportWidth = computed(() => Math.max(0, measuredWidth.value))
const itemWidth = computed(() => {
  if (viewportWidth.value <= 0) return 0

  const gapsWidth =
    (normalizedSlidesPerView.value - 1) * normalizedGap.value
  return Math.max(
    1,
    (viewportWidth.value - gapsWidth) /
      normalizedSlidesPerView.value,
  )
})
const itemStep = computed(() => itemWidth.value + normalizedGap.value)
const maximumIndex = computed(() =>
  Math.max(
    0,
    props.items.length - normalizedSlidesPerView.value,
  ),
)
const mountedStartIndex = computed(() =>
  Math.max(0, currentIndex.value - normalizedBuffer.value),
)
const mountedEndIndex = computed(() =>
  Math.min(
    props.items.length,
    currentIndex.value +
      normalizedSlidesPerView.value +
      normalizedBuffer.value,
  ),
)
const mountedItems = computed(() =>
  props.items
    .slice(mountedStartIndex.value, mountedEndIndex.value)
    .map((item, offset) => ({
      item,
      index: mountedStartIndex.value + offset,
    })),
)
const totalWidth = computed(() => {
  if (props.items.length === 0) return 0
  return (
    props.items.length * itemWidth.value +
    (props.items.length - 1) * normalizedGap.value
  )
})
const beforeSize = computed(
  () => mountedStartIndex.value * itemStep.value,
)
const afterSize = computed(() =>
  Math.max(
    0,
    totalWidth.value - mountedEndIndex.value * itemStep.value,
  ),
)
const containerStyle = computed(() => ({
  height: toCssHeight(props.height),
}))

function normalizeIndex(index: number): number {
  return Math.min(
    maximumIndex.value,
    Math.max(0, Math.floor(Number.isFinite(index) ? index : 0)),
  )
}

currentIndex.value = normalizeIndex(props.activeIndex)

function isVisible(index: number): boolean {
  return (
    index >= currentIndex.value &&
    index <
      Math.min(
        props.items.length,
        currentIndex.value + normalizedSlidesPerView.value,
      )
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

  const lastVisibleIndex =
    props.items.length === 0
      ? -1
      : Math.min(
          props.items.length - 1,
          currentIndex.value + normalizedSlidesPerView.value - 1,
        )
  const remainingItems = props.items.length - 1 - lastVisibleIndex

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
  if (nextIndex === maximumIndex.value) emit('reachEnd')
  maybeEmitLoadMore()

  if (props.autoplay && !isHovering.value) {
    startAutoplay()
  }
}

function setNativeScrollPosition(
  left: number,
  options: ScrollToOptions = {},
) {
  const element = viewport.value
  if (!element) return

  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ ...options, left })
  } else {
    element.scrollLeft = left
  }
}

function scrollToIndex(
  index: number,
  options: ScrollToOptions = {},
) {
  if (props.items.length === 0 || itemStep.value <= 0) return

  const nextIndex = normalizeIndex(index)
  const indexDistance = Math.abs(nextIndex - currentIndex.value)
  const behavior =
    options.behavior === 'smooth' &&
    indexDistance > normalizedBuffer.value
      ? 'auto'
      : options.behavior

  programmaticScrollTarget = behavior === 'smooth' ? nextIndex : undefined
  updateCurrentIndex(nextIndex)
  setNativeScrollPosition(nextIndex * itemStep.value, {
    ...options,
    behavior,
  })
}

function next(behavior: ScrollBehavior = 'smooth') {
  scrollToIndex(
    currentIndex.value + normalizedSlidesToScroll.value,
    { behavior },
  )
}

function previous(behavior: ScrollBehavior = 'smooth') {
  scrollToIndex(
    currentIndex.value - normalizedSlidesToScroll.value,
    { behavior },
  )
}

function startAutoplay() {
  stopAutoplay()

  if (!props.autoplay || props.items.length === 0) return

  autoplayTimer = setTimeout(() => {
    const isAtEnd = currentIndex.value >= maximumIndex.value
    if (isAtEnd) {
      if (props.autoplayLoop) {
        scrollToIndex(0, { behavior: 'smooth' })
      } else {
        stopAutoplay()
      }
    } else {
      next('smooth')
    }
  }, normalizedAutoplayDelay.value)
}

function stopAutoplay() {
  if (autoplayTimer !== undefined) {
    clearTimeout(autoplayTimer)
    autoplayTimer = undefined
  }
}

function handleMouseEnter() {
  isHovering.value = true
  if (props.pauseOnHover) stopAutoplay()
}

function handleMouseLeave() {
  isHovering.value = false
  if (props.autoplay) startAutoplay()
}

function cancelProgrammaticScroll() {
  programmaticScrollTarget = undefined
}

function handleScroll(event: Event) {
  if (itemStep.value <= 0) return

  const scrollLeft = (event.currentTarget as HTMLElement).scrollLeft
  if (programmaticScrollTarget !== undefined) {
    const targetLeft = programmaticScrollTarget * itemStep.value
    if (Math.abs(scrollLeft - targetLeft) > 1) return
    programmaticScrollTarget = undefined
  }

  updateCurrentIndex(Math.round(scrollLeft / itemStep.value))
}

function handleKeydown(event: KeyboardEvent) {
  if (
    event.key === 'ArrowRight' ||
    event.key === 'PageDown'
  ) {
    event.preventDefault()
    next()
  } else if (
    event.key === 'ArrowLeft' ||
    event.key === 'PageUp'
  ) {
    event.preventDefault()
    previous()
  } else if (event.key === 'Home') {
    event.preventDefault()
    scrollToIndex(0, { behavior: 'smooth' })
  } else if (event.key === 'End') {
    event.preventDefault()
    scrollToIndex(maximumIndex.value, { behavior: 'auto' })
  }
}

function updateMeasuredWidth() {
  const nextWidth = viewport.value?.clientWidth ?? 0
  if (nextWidth <= 0 || nextWidth === measuredWidth.value) return

  measuredWidth.value = nextWidth
  nextTick(() => {
    setNativeScrollPosition(currentIndex.value * itemStep.value)
  })
}

watch(
  () => props.activeIndex,
  async (index) => {
    const nextIndex = normalizeIndex(index)
    if (nextIndex === currentIndex.value) return

    cancelProgrammaticScroll()
    currentIndex.value = nextIndex
    await nextTick()
    setNativeScrollPosition(nextIndex * itemStep.value)
    maybeEmitLoadMore()
  },
)

watch(
  () => [
    props.items.length,
    props.slidesPerView,
    props.gap,
  ] as const,
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
    setNativeScrollPosition(nextIndex * itemStep.value)
    maybeEmitLoadMore()
    if (props.autoplay && props.items.length > 0 && !isHovering.value) {
      startAutoplay()
    }
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
  () => props.autoplay,
  (enabled) => {
    if (enabled && !isHovering.value) {
      startAutoplay()
    } else {
      stopAutoplay()
    }
  },
)

watch(
  () => props.autoplayDelay,
  () => {
    if (props.autoplay && !isHovering.value) {
      startAutoplay()
    }
  },
)

watch(
  () => props.autoplayLoop,
  (loop) => {
    if (!props.autoplay || isHovering.value) return

    if (!loop && currentIndex.value >= maximumIndex.value) {
      stopAutoplay()
    } else {
      startAutoplay()
    }
  },
)

watch(
  () => props.pauseOnHover,
  (pauseOnHover) => {
    if (pauseOnHover && isHovering.value) {
      stopAutoplay()
    } else if (!pauseOnHover && props.autoplay) {
      startAutoplay()
    }
  },
)

onMounted(async () => {
  updateMeasuredWidth()

  if (typeof ResizeObserver !== 'undefined' && viewport.value) {
    resizeObserver = new ResizeObserver(updateMeasuredWidth)
    resizeObserver.observe(viewport.value)
  }

  await nextTick()
  setNativeScrollPosition(currentIndex.value * itemStep.value)
  maybeEmitLoadMore()

  if (props.autoplay) {
    startAutoplay()
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  stopAutoplay()
})

defineExpose<VirtualCarouselExpose>({
  next,
  previous,
  scrollToIndex,
  startAutoplay,
  stopAutoplay,
})
</script>

<template>
  <div
    ref="viewport"
    class="vue-virtual-carousel"
    :style="containerStyle"
    role="region"
    aria-roledescription="carousel"
    :aria-label="ariaLabel"
    tabindex="0"
    @scroll.passive="handleScroll"
    @pointerdown="cancelProgrammaticScroll"
    @wheel.passive="cancelProgrammaticScroll"
    @keydown="handleKeydown"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div
      v-if="items.length"
      class="vue-virtual-carousel__track"
      role="list"
    >
      <div
        v-if="beforeSize > 0"
        class="vue-virtual-carousel__spacer"
        :style="{ flexBasis: `${beforeSize}px` }"
        aria-hidden="true"
      />

      <div
        v-for="{ item, index } in mountedItems"
        :key="getItemKey(item, index)"
        class="vue-virtual-carousel__item"
        :style="{
          flexBasis: `${itemWidth}px`,
          marginRight:
            index < items.length - 1 ? `${normalizedGap}px` : '0px',
        }"
        role="listitem"
        aria-roledescription="slide"
        :aria-label="`${index + 1} of ${items.length}`"
        :aria-current="index === currentIndex ? 'true' : undefined"
      >
        <slot
          :item="item"
          :index="index"
          :active="index === currentIndex"
          :visible="isVisible(index)"
        />
      </div>

      <div
        v-if="afterSize > 0"
        class="vue-virtual-carousel__spacer"
        :style="{ flexBasis: `${afterSize}px` }"
        aria-hidden="true"
      />
    </div>

    <div v-else class="vue-virtual-carousel__empty">
      <slot name="empty" />
    </div>
  </div>
</template>
