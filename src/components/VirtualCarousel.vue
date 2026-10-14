<script setup lang="ts" generic="T">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type ComponentPublicInstance } from 'vue'
import { useItemKey } from '../composables/useItemKey'
import { useCarouselInteraction } from '../composables/useCarouselInteraction'
import { useCarouselAutoplay } from '../composables/useCarouselAutoplay'
import { createCarouselLayout, wrapCarouselIndex } from '../utils/carouselLayout'
import { toCssHeight } from '../utils/layout'
import type { ItemKey, ResponsiveBreakpoint, VirtualCarouselChangeEvent, VirtualCarouselExpose } from '../types'

defineOptions({ name: 'VirtualCarousel' })
const props = withDefaults(defineProps<{
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
  mouseDrag?: boolean
  dragThreshold?: number
  momentum?: boolean
  settleDuration?: number
  nativeSnap?: boolean
  autoWidth?: boolean
  estimatedItemWidth?: number
  rtl?: boolean
  loop?: boolean
  keepAlive?: boolean
  maxCachedItems?: number
  pinnedIndexes?: readonly number[]
  responsive?: ResponsiveBreakpoint[]
}>(), {
  activeIndex: 0, slidesPerView: 1, slidesToScroll: 1, gap: 0, buffer: 1,
  height: 'auto', itemKey: undefined, ariaLabel: 'Carousel', hasMore: false,
  loading: false, loadMoreThreshold: 2, autoplay: false, autoplayDelay: 3000,
  autoplayLoop: true, pauseOnHover: true, mouseDrag: true, dragThreshold: 8,
  momentum: true, settleDuration: 250, nativeSnap: true, autoWidth: false, estimatedItemWidth: 240,
  rtl: false, loop: false, keepAlive: false, maxCachedItems: 20,
  pinnedIndexes: () => [], responsive: undefined,
})
const emit = defineEmits<{
  'update:activeIndex': [index: number]
  change: [event: VirtualCarouselChangeEvent<T>]
  reachStart: []
  reachEnd: []
  loadMore: []
}>()
defineSlots<{
  default(props: { item: T; index: number; active: boolean; visible: boolean; inViewport: boolean }): unknown
  empty?(): unknown
}>()

const viewport = ref<HTMLElement>()
const track = ref<HTMLElement>()
const measuredWidth = ref(0)
const measuredContentHeight = ref(0)
const currentIndex = ref(0)
const hovering = ref(false)
const mounted = ref(false)
const focusedIndex = ref<number>()
const physicalVisible = shallowRef<number[]>([])
const visualRange = shallowRef<[number, number]>([0, 1])
const measuredWidths = shallowRef(new Map<PropertyKey, number>())
const retainedKeys = shallowRef<PropertyKey[]>([])
let viewportObserver: ResizeObserver | undefined
let itemObserver: ResizeObserver | undefined
let lastLoadMoreCount = -1
let disposed = false
const itemElements = new Map<number, HTMLElement>()
const pendingWidths = new Map<PropertyKey, number>()
const { getItemKey } = useItemKey<T>({
  componentName: 'VirtualCarousel', items: () => props.items,
  itemKey: () => props.itemKey as ItemKey<T> | undefined,
})
const keys = computed(() => props.items.map((item, index) => getItemKey(item, index)))
const keyIndexes = computed(() => new Map(keys.value.map((key, index) => [key, index])))
const integer = (value: number, minimum: number, fallback: number) =>
  Math.max(minimum, Math.floor(Number.isFinite(value) ? value : fallback))
const responsive = computed(() => {
  const breakpoint = [...(props.responsive ?? [])].sort((a, b) => b.breakpoint - a.breakpoint)
    .find((entry) => measuredWidth.value >= entry.breakpoint)
  return {
    slidesPerView: integer(breakpoint?.slidesPerView ?? props.slidesPerView, 1, 1),
    slidesToScroll: integer(breakpoint?.slidesToScroll ?? props.slidesToScroll, 1, 1),
    gap: Math.max(0, Number.isFinite(breakpoint?.gap ?? props.gap) ? (breakpoint?.gap ?? props.gap) : 0),
  }
})
const buffer = computed(() => integer(props.buffer, 0, 1))
const cacheBudget = computed(() => integer(props.maxCachedItems, 0, 20))
const fixedWidth = computed(() => measuredWidth.value > 0 ? Math.max(1,
  (measuredWidth.value - (responsive.value.slidesPerView - 1) * responsive.value.gap) / responsive.value.slidesPerView,
) : 0)
const widths = computed(() => props.items.map((_, index) => props.autoWidth
  ? measuredWidths.value.get(keys.value[index]) ?? Math.max(1, Number.isFinite(props.estimatedItemWidth) ? props.estimatedItemWidth : 240)
  : fixedWidth.value))
const layout = computed(() => createCarouselLayout(widths.value, responsive.value.gap))
const looping = computed(() => props.loop && props.items.length > 1 && layout.value.totalWidth > measuredWidth.value)
const maximumLeft = computed(() => Math.max(0, layout.value.totalWidth - measuredWidth.value))
const maximumIndex = computed(() => {
  if (looping.value) return props.items.length - 1
  if (!props.autoWidth) return Math.max(0, props.items.length - responsive.value.slidesPerView)
  if (maximumLeft.value <= 0) return 0
  const coveringIndex = layout.value.indexAt(maximumLeft.value)
  const next = layout.value.offsets[coveringIndex] < maximumLeft.value - 0.01 ? coveringIndex + 1 : coveringIndex
  return Math.min(props.items.length - 1, next)
})
const trackWidth = computed(() => looping.value ? layout.value.cycleWidth * 3 : layout.value.totalWidth)
const containerStyle = computed(() => ({ height: toCssHeight(props.height) }))
const trackStyle = computed(() => ({
  width: `${trackWidth.value}px`,
  height: props.height === 'auto' ? `${Math.max(1, measuredContentHeight.value)}px` : '100%',
}))

function normalizeIndex(index: number) {
  const safe = Math.floor(Number.isFinite(index) ? index : 0)
  return looping.value ? wrapCarouselIndex(safe, props.items.length) : Math.max(0, Math.min(maximumIndex.value, safe))
}
currentIndex.value = normalizeIndex(props.activeIndex)
function canonicalPosition(index: number) {
  const offset = layout.value.offsets[normalizeIndex(index)] ?? 0
  return looping.value ? layout.value.cycleWidth + offset : Math.min(maximumLeft.value, offset)
}
function localPosition(position: number) {
  const cycle = layout.value.cycleWidth
  return looping.value && cycle > 0 ? ((position % cycle) + cycle) % cycle : Math.max(0, position)
}
function indexAt(position: number) {
  if (!looping.value && position >= maximumLeft.value - 1 && maximumLeft.value > 0) return maximumIndex.value
  const local = localPosition(position)
  if (looping.value && local > (layout.value.offsets[props.items.length - 1] + layout.value.cycleWidth) / 2) return 0
  return normalizeIndex(layout.value.nearestIndex(local))
}
function targetPosition(index: number, from: number, direction = 0) {
  const canonical = canonicalPosition(index)
  if (!looping.value) return canonical
  const cycle = layout.value.cycleWidth
  const candidates = [canonical - cycle, canonical, canonical + cycle]
  const ordered = candidates.filter((value) => direction > 0 ? value > from + 0.5 : direction < 0 ? value < from - 0.5 : true)
  return (ordered.length ? ordered : candidates).sort((a, b) => Math.abs(a - from) - Math.abs(b - from))[0]
}
function virtualIndexAt(position: number) {
  if (!looping.value) return layout.value.indexAt(Math.max(0, position))
  const cycle = layout.value.cycleWidth
  const cycleIndex = Math.floor(position / cycle)
  return cycleIndex * props.items.length + layout.value.indexAt(position - cycleIndex * cycle)
}
function virtualOffset(index: number) {
  if (!looping.value) return layout.value.offsets[index] ?? 0
  const cycle = Math.floor(index / props.items.length)
  return cycle * layout.value.cycleWidth + layout.value.offsets[wrapCarouselIndex(index, props.items.length)]
}
function updatePosition(position: number) {
  if (props.items.length === 0) {
    physicalVisible.value = []
    visualRange.value = [0, 0]
    return
  }
  if (measuredWidth.value <= 0) return
  const first = virtualIndexAt(position)
  const last = virtualIndexAt(position + measuredWidth.value - 0.01)
  if (visualRange.value[0] !== first || visualRange.value[1] !== last + 1) visualRange.value = [first, last + 1]
  const visible: number[] = []
  for (let virtual = first; virtual <= last; virtual += 1) {
    const index = looping.value ? wrapCarouselIndex(virtual, props.items.length) : virtual
    if (index < 0 || index >= props.items.length) continue
    const left = virtualOffset(virtual)
    if (left + widths.value[index] > position + 0.01 && left < position + measuredWidth.value - 0.01 && !visible.includes(index)) visible.push(index)
  }
  if (visible.join(',') !== physicalVisible.value.join(',')) physicalVisible.value = visible
}
function isVisible(index: number) {
  if (props.autoWidth) {
    const start = canonicalPosition(currentIndex.value)
    const position = targetPosition(index, start)
    return position + widths.value[index] > start && position < start + measuredWidth.value
  }
  return looping.value ? wrapCarouselIndex(index - currentIndex.value, props.items.length) < responsive.value.slidesPerView
    : index >= currentIndex.value && index < currentIndex.value + responsive.value.slidesPerView
}
function maybeEmitLoadMore() {
  if (!props.hasMore || props.loading || lastLoadMoreCount === props.items.length) return
  const visibleCount = props.autoWidth ? physicalVisible.value.length : responsive.value.slidesPerView
  const remaining = props.items.length - currentIndex.value - Math.max(1, visibleCount)
  if (remaining <= integer(props.loadMoreThreshold, 0, 2)) {
    lastLoadMoreCount = props.items.length
    emit('loadMore')
  }
}
function updateCurrentIndex(index: number) {
  const next = normalizeIndex(index)
  if (!props.items.length || next === currentIndex.value) return
  currentIndex.value = next
  emit('update:activeIndex', next)
  emit('change', { index: next, item: props.items[next] })
  if (next === 0) emit('reachStart')
  if (next === maximumIndex.value) emit('reachEnd')
  maybeEmitLoadMore()
}

const interaction = useCarouselInteraction({
  viewport: () => viewport.value, track: () => track.value,
  rtl: () => props.rtl, mouseDrag: () => props.mouseDrag,
  nativeSnap: () => props.nativeSnap && !looping.value,
  dragThreshold: () => Math.max(1, Number.isFinite(props.dragThreshold) ? props.dragThreshold : 8),
  momentum: () => props.momentum,
  settleDuration: () => Math.max(0, Number.isFinite(props.settleDuration) ? props.settleDuration : 250),
  limits: () => [0, looping.value ? Math.max(0, trackWidth.value - measuredWidth.value) : maximumLeft.value],
  step: () => widths.value[currentIndex.value] + responsive.value.gap || 1,
  indexAt, target: targetPosition, canonical: canonicalPosition,
  onPosition: updatePosition, onCommit: updateCurrentIndex,
})
const { phase, dragging } = interaction
const autoplay = useCarouselAutoplay({
  enabled: () => mounted.value && props.autoplay,
  paused: () => phase.value === 'pending' || phase.value === 'dragging' || phase.value === 'committing' ||
    (looping.value && phase.value === 'settling') || (hovering.value && props.pauseOnHover),
  delay: () => props.autoplayDelay, count: () => props.items.length,
  atEnd: () => !looping.value && currentIndex.value >= maximumIndex.value,
  loop: () => looping.value || props.autoplayLoop,
  advance: () => next(), rewind: () => scrollToIndex(0, { behavior: 'smooth' }),
})

const windowRecords = computed(() => {
  const active = dragging.value || interaction.transformed.value
  const extra = buffer.value + (active ? responsive.value.slidesPerView + 2 : 0)
  let first: number
  let end: number
  if (!props.autoWidth && !looping.value && !active) {
    first = Math.max(0, currentIndex.value - extra)
    end = Math.min(props.items.length, currentIndex.value + responsive.value.slidesPerView + extra)
  } else {
    first = Math.max(0, visualRange.value[0] - extra)
    end = Math.min(looping.value ? props.items.length * 3 : props.items.length, visualRange.value[1] + extra)
  }
  const center = (visualRange.value[0] + visualRange.value[1] - 1) / 2
  const records = new Map<number, { index: number; virtual: number; cached: boolean }>()
  for (let virtual = first; virtual < end; virtual += 1) {
    const index = looping.value ? wrapCarouselIndex(virtual, props.items.length) : virtual
    const old = records.get(index)
    if (!old || Math.abs(virtual - center) < Math.abs(old.virtual - center)) records.set(index, { index, virtual, cached: false })
  }
  return [...records.values()].sort((a, b) => a.virtual - b.virtual)
})
watch([physicalVisible, phase, keys], () => {
  if (phase.value !== 'idle') return
  const windowKeys = physicalVisible.value.filter((index) => index < props.items.length).map((index) => keys.value[index])
  if (!props.keepAlive) { retainedKeys.value = []; return }
  const existing = retainedKeys.value.filter((key) => keyIndexes.value.has(key) && !windowKeys.includes(key))
  retainedKeys.value = [...existing, ...windowKeys].slice(-(cacheBudget.value + windowKeys.length))
}, { immediate: true })
const mountedItems = computed(() => {
  const records = [...windowRecords.value]
  const present = new Set(records.map((record) => record.index))
  const extras = new Set<number>()
  for (const index of props.pinnedIndexes.slice(0, cacheBudget.value)) {
    if (Number.isInteger(index) && index >= 0 && index < props.items.length) extras.add(index)
  }
  if (focusedIndex.value !== undefined && focusedIndex.value < props.items.length) extras.add(focusedIndex.value)
  if (props.keepAlive) {
    for (const key of [...retainedKeys.value].reverse()) {
      const index = keyIndexes.value.get(key)
      if (index !== undefined && !present.has(index) && extras.size < cacheBudget.value) extras.add(index)
    }
  }
  for (const index of extras) {
    if (present.has(index)) continue
    records.push({ index, virtual: looping.value ? props.items.length + index : index, cached: index !== focusedIndex.value })
  }
  return records.sort((a, b) => a.virtual - b.virtual).map((record) => ({
    ...record, item: props.items[record.index], key: keys.value[record.index],
  }))
})
const beforeSize = computed(() => windowRecords.value.length ? virtualOffset(windowRecords.value[0].virtual) : 0)
const flexLayout = computed(() => !props.autoWidth && !looping.value && !props.keepAlive &&
  !props.pinnedIndexes.length && (focusedIndex.value === undefined ||
    windowRecords.value.some((record) => record.index === focusedIndex.value)))
const afterSize = computed(() => {
  const last = windowRecords.value[windowRecords.value.length - 1]
  return last ? Math.max(0, trackWidth.value - virtualOffset(last.virtual) - widths.value[last.index] - responsive.value.gap) : 0
})
function itemStyle(record: { index: number; virtual: number; cached: boolean }) {
  const width = widths.value[record.index]
  return {
    position: flexLayout.value ? 'relative' as const : 'absolute' as const,
    [props.rtl ? 'right' : 'left']: flexLayout.value ? undefined : `${virtualOffset(record.virtual)}px`,
    width: props.autoWidth ? 'max-content' : `${width}px`,
    flexBasis: props.autoWidth ? 'auto' : `${width}px`,
    marginRight: !props.rtl && record.index < props.items.length - 1 ? `${responsive.value.gap}px` : '0px',
    marginLeft: props.rtl && record.index < props.items.length - 1 ? `${responsive.value.gap}px` : '0px',
    height: props.height === 'auto' ? 'auto' : '100%',
    visibility: record.cached ? 'hidden' as const : undefined,
    scrollSnapAlign: props.nativeSnap && !looping.value && measuredWidth.value > 0 ? 'start' : 'none',
  }
}
function applyWidths() {
  if (!pendingWidths.size || phase.value !== 'idle') return
  const next = new Map(measuredWidths.value)
  for (const [key, width] of pendingWidths) next.set(key, width)
  pendingWidths.clear()
  measuredWidths.value = next
}
function measureItem(element: HTMLElement, index: number) {
  if (index < 0 || index >= props.items.length) return
  const { width, height } = element.getBoundingClientRect()
  if (height > measuredContentHeight.value) measuredContentHeight.value = height
  const key = keys.value[index]
  if (props.autoWidth && width > 0 && Math.abs((measuredWidths.value.get(key) ?? 0) - width) > 0.5) pendingWidths.set(key, width)
}
function updateContentHeight() {
  if (disposed || props.height !== 'auto') return
  let height = 0
  for (const record of windowRecords.value) {
    height = Math.max(height, itemElements.get(record.index)?.getBoundingClientRect().height ?? 0)
  }
  if (Math.abs(measuredContentHeight.value - height) > 0.5) measuredContentHeight.value = height
}
function setItemElement(value: Element | ComponentPublicInstance | null, index: number) {
  const old = itemElements.get(index)
  if (old) itemObserver?.unobserve(old)
  if (!(value instanceof HTMLElement)) { itemElements.delete(index); return }
  itemElements.set(index, value)
  if (props.autoWidth || props.height === 'auto') {
    itemObserver?.observe(value)
    measureItem(value, index)
    nextTick(applyWidths)
    nextTick(updateContentHeight)
  }
}
function scrollToIndex(index: number, options: ScrollToOptions = {}) {
  if (!props.items.length || measuredWidth.value <= 0) return
  interaction.navigate(normalizeIndex(index), options.behavior ?? 'auto', 0, looping.value || !props.nativeSnap)
}
function next(behavior: ScrollBehavior = 'smooth') {
  if (!props.items.length || measuredWidth.value <= 0) return
  interaction.navigate(normalizeIndex(currentIndex.value + responsive.value.slidesToScroll), behavior, 1, looping.value || !props.nativeSnap)
}
function previous(behavior: ScrollBehavior = 'smooth') {
  if (!props.items.length || measuredWidth.value <= 0) return
  interaction.navigate(normalizeIndex(currentIndex.value - responsive.value.slidesToScroll), behavior, -1, looping.value || !props.nativeSnap)
}
function handleKeydown(event: KeyboardEvent) {
  if ((event.target as Element)?.closest?.('input, textarea, select, [contenteditable="true"]')) return
  const forward = props.rtl ? 'ArrowLeft' : 'ArrowRight'
  const backward = props.rtl ? 'ArrowRight' : 'ArrowLeft'
  if (event.key === forward || event.key === 'PageDown') { event.preventDefault(); next() }
  else if (event.key === backward || event.key === 'PageUp') { event.preventDefault(); previous() }
  else if (event.key === 'Home') { event.preventDefault(); scrollToIndex(0, { behavior: 'smooth' }) }
  else if (event.key === 'End') { event.preventDefault(); scrollToIndex(maximumIndex.value) }
}
function handleFocusIn(event: FocusEvent) {
  const element = (event.target as Element)?.closest?.('[data-carousel-index]')
  focusedIndex.value = element ? Number(element.getAttribute('data-carousel-index')) : undefined
}
function handleFocusOut() {
  nextTick(() => {
    if (!viewport.value?.contains(document.activeElement)) focusedIndex.value = undefined
  })
}
function synchronize() {
  interaction.cancel(false)
  if (!props.items.length) {
    if (currentIndex.value !== 0) { currentIndex.value = 0; emit('update:activeIndex', 0) }
  } else updateCurrentIndex(normalizeIndex(currentIndex.value))
  if (!disposed) interaction.commit(currentIndex.value)
  nextTick(maybeEmitLoadMore)
}
function updateMeasuredWidth() {
  const width = viewport.value?.clientWidth ?? 0
  if (width <= 0 || width === measuredWidth.value) return
  measuredWidth.value = width
}
watch(() => [props.items.length, measuredWidth.value, responsive.value.slidesPerView,
  responsive.value.gap, props.rtl, looping.value, props.autoWidth, props.nativeSnap, measuredWidths.value] as const, synchronize)
watch(() => props.activeIndex, (index) => {
  const next = normalizeIndex(index)
  if (next === currentIndex.value) return
  interaction.cancel(false)
  currentIndex.value = next
  interaction.commit(next)
  nextTick(maybeEmitLoadMore)
})
watch(() => [props.hasMore, props.loading, props.loadMoreThreshold] as const, () => {
  if (!props.hasMore) lastLoadMoreCount = -1
  nextTick(maybeEmitLoadMore)
})
watch(() => keys.value, (nextKeys) => {
  const valid = new Set(nextKeys)
  measuredWidths.value = new Map([...measuredWidths.value].filter(([key]) => valid.has(key)))
  retainedKeys.value = retainedKeys.value.filter((key) => valid.has(key))
})
watch(phase, (value) => { if (value === 'idle') nextTick(applyWidths) })
watch(() => [props.keepAlive, props.maxCachedItems], () => {
  const visibleKeys = physicalVisible.value.map((index) => keys.value[index])
  retainedKeys.value = props.keepAlive
    ? [...retainedKeys.value.filter((key) => !visibleKeys.includes(key)), ...visibleKeys].slice(-(cacheBudget.value + visibleKeys.length))
    : []
})
onMounted(async () => {
  updateMeasuredWidth()
  if (typeof ResizeObserver !== 'undefined') {
    viewportObserver = new ResizeObserver(updateMeasuredWidth)
    if (viewport.value) viewportObserver.observe(viewport.value)
    itemObserver = new ResizeObserver((entries) => {
      for (const entry of entries) measureItem(entry.target as HTMLElement, Number((entry.target as HTMLElement).dataset.carouselIndex))
      applyWidths()
      updateContentHeight()
    })
    if (props.autoWidth || props.height === 'auto') {
      for (const [index, element] of itemElements) { itemObserver.observe(element); measureItem(element, index) }
    }
  }
  await nextTick()
  synchronize()
  mounted.value = true
})
onBeforeUnmount(() => {
  disposed = true
  viewportObserver?.disconnect()
  itemObserver?.disconnect()
})
defineExpose<VirtualCarouselExpose>({ next, previous, scrollToIndex, startAutoplay: autoplay.start, stopAutoplay: autoplay.stop })
</script>

<template>
  <div ref="viewport" class="vue-virtual-carousel"
    :class="{ 'vue-virtual-carousel--mouse-drag': mouseDrag, 'vue-virtual-carousel--dragging': dragging, 'vue-virtual-carousel--controlled': looping || !nativeSnap }"
    :style="containerStyle" :dir="rtl ? 'rtl' : 'ltr'"
    role="region" aria-roledescription="carousel" :aria-label="ariaLabel" tabindex="0"
    @scroll.passive="interaction.handleScroll"
    @pointerdown="interaction.handlePointerDown" @pointermove="interaction.handlePointerMove"
    @pointerup="interaction.handlePointerUp" @pointercancel="interaction.handlePointerCancel"
    @lostpointercapture="interaction.handleLostPointerCapture"
    @click.capture="interaction.handleClick" @dragstart="interaction.handleDragStart"
    @wheel.passive="interaction.handleWheel" @keydown="handleKeydown"
    @mouseenter="hovering = true" @mouseleave="hovering = false"
    @focusin="handleFocusIn" @focusout="handleFocusOut"
  >
    <div v-if="items.length" ref="track" class="vue-virtual-carousel__track" :style="trackStyle" role="list">
      <div v-if="beforeSize > 0" class="vue-virtual-carousel__spacer" :style="{ flexBasis: `${beforeSize}px`, position: flexLayout ? 'relative' : 'absolute' }" aria-hidden="true" />
      <div v-for="record in mountedItems" :key="record.key" :ref="(element) => setItemElement(element, record.index)"
        class="vue-virtual-carousel__item" :data-carousel-index="record.index" :style="itemStyle(record)"
        role="listitem" aria-roledescription="slide" :aria-label="`${record.index + 1} of ${items.length}`"
        :aria-current="record.index === currentIndex ? 'true' : undefined"
        :aria-hidden="record.cached ? 'true' : undefined" :inert="record.cached ? true : undefined"
      >
        <slot :item="record.item" :index="record.index" :active="record.index === currentIndex"
          :visible="isVisible(record.index)" :in-viewport="physicalVisible.includes(record.index)" />
      </div>
      <div v-if="afterSize > 0" class="vue-virtual-carousel__spacer" :style="{ flexBasis: `${afterSize}px`, position: flexLayout ? 'relative' : 'absolute' }" aria-hidden="true" />
    </div>
    <div v-else class="vue-virtual-carousel__empty"><slot name="empty" /></div>
  </div>
</template>
