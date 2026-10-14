<script setup lang="ts" generic="T">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  shallowRef,
  watch,
} from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useItemKey } from '../composables/useItemKey'
import { useScrollActivity } from '../composables/useScrollActivity'
import type {
  ItemKey,
  ScrollAlignment,
  VirtualScrollEvent,
} from '../types'
import { createZeroHeightWarning, toCssHeight } from '../utils/layout'
import { createKeyedSizeIndex } from '../utils/keyedSizeIndex'

defineOptions({
  name: 'ChatVirtualScroll',
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    items: readonly T[]
    /** Increment after mutating/reordering the same array instance in place. */
    itemsVersion?: PropertyKey
    estimatedItemSize?: number
    estimateItemSize?: (item: T, index: number) => number
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
    scrollEndDelay?: number
    syncMeasurement?: boolean
    pinnedKeys?: readonly PropertyKey[]
    maxPinnedItems?: number
    keepFocusedItem?: boolean
    showNewItemsIndicator?: boolean
    newItemsLabel?: (count: number) => string
    forceStickToBottom?: (item: T, index: number) => boolean
    contain?: boolean
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
    scrollEndDelay: 150,
    syncMeasurement: true,
    pinnedKeys: () => [],
    maxPinnedItems: 20,
    keepFocusedItem: true,
    showNewItemsIndicator: true,
    newItemsLabel: undefined,
    forceStickToBottom: undefined,
    contain: true,
  },
)

const emit = defineEmits<{
  scroll: [event: VirtualScrollEvent]
  loadOlder: []
  bottomChange: [isAtBottom: boolean]
  scrollingChange: [isScrolling: boolean]
  newItemsChange: [count: number]
  visibleChange: [event: VirtualScrollEvent]
}>()

defineSlots<{
  default(props: { item: T; index: number }): unknown
  empty?(): unknown
  loadingOlder?(): unknown
  newItems?(props: {
    count: number
    scrollToBottom: (behavior?: ScrollBehavior) => void
  }): unknown
}>()

const viewport = ref<HTMLElement>()
const scrollTop = ref(0)
const scrollCompensation = ref(0)
const measuredHeight = ref(0)
const measurementVersion = ref(0)
const isAtBottom = ref(true)
const newItemsCount = ref(0)
const focusedKey = ref<PropertyKey>()
// The keyed size tree already owns the numeric measurements. Keep only a set
// of measured identities so rebuilding does not duplicate every size in a
// second Map.
const measuredKeys = new Set<PropertyKey>()
const observedElements = new Map<HTMLElement, PropertyKey>()
const unmeasuredElements = new Set<HTMLElement>()
let viewportResizeObserver: ResizeObserver | undefined
let itemResizeObserver: ResizeObserver | undefined
let lastLoadOlderItemCount = -1
let mounted = false
let pendingScrollAdjustment = 0
let adjustmentScheduled = false
let adjustmentGeneration = 0
let pendingIndexScroll: { key: PropertyKey; align: ScrollAlignment } | undefined
let expectedNativeTop: number | undefined
let finishSmoothScroll: (() => void) | undefined
let scrollRequestVersion = 0
const warnIfZeroHeight = createZeroHeightWarning('ChatVirtualScroll')
const { getItemKey } = useItemKey<T>({
  componentName: 'ChatVirtualScroll',
  items: () => props.items,
  itemKey: () => props.itemKey as ItemKey<T> | undefined,
})

const normalizedEstimate = computed(() =>
  Number.isFinite(props.estimatedItemSize) ? Math.max(1, props.estimatedItemSize) : 48,
)
const normalizedOverscan = computed(() => Math.max(0, Math.floor(props.overscan)))
const normalizedScrollEndDelay = computed(() =>
  Number.isFinite(props.scrollEndDelay) ? Math.max(0, props.scrollEndDelay) : 150,
)
const {
  isScrolling,
  setScrolling,
  scheduleScrollEnd,
  handleScrollEnd,
  handleTouchStart,
  handleTouchEnd,
  handleWheel,
  handleKeyDown,
  handlePointerDown,
  handlePointerUp,
  dispose: disposeScrollActivity,
} = useScrollActivity({
  delay: () => normalizedScrollEndDelay.value,
  viewport: () => viewport.value,
  hasProgrammaticScroll: () => finishSmoothScroll !== undefined,
  onInterrupt: cancelScrollTarget,
  onStart: () => {
    // Delay layout writes throughout native wheel/touch/keyboard/scrollbar
    // momentum so measurement corrections cannot interrupt the gesture.
    scrollCompensation.value = pendingScrollAdjustment
  },
  onSettled: () => {
    const finish = finishSmoothScroll
    finishSmoothScroll = undefined
    if (finish) {
      // Cold rows may be measured during smooth scrolling. Resolve the public
      // destination one last time against the final layout.
      finish()
      return
    }
    scrollTop.value = getScrollTop()
    scheduleScrollAdjustment()
  },
  onChange: (value) => {
    if (mounted) emit('scrollingChange', value)
  },
})
const normalizedMaxPinnedItems = computed(() =>
  Number.isFinite(props.maxPinnedItems) ? Math.max(0, Math.floor(props.maxPinnedItems)) : 20,
)
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

function getEstimatedSize(item: T, index: number) {
  const estimate = props.estimateItemSize?.(item, index)
  return Number.isFinite(estimate) && (estimate ?? 0) > 0
    ? estimate as number
    : normalizedEstimate.value
}

function createLayoutIndex(previous?: ReturnType<typeof createKeyedSizeIndex>) {
  return createKeyedSizeIndex(props.items.map((item, index) => {
    const key = getItemKey(item, index)
    return {
      key,
      size: measuredKeys.has(key)
        ? previous?.getSizeByKey(key) ?? getEstimatedSize(item, index)
        : getEstimatedSize(item, index),
    }
  }))
}

// Common chat mutations append new messages or prepend a history page. The
// keyed treap applies both without rebuilding the full height index.
const layout = shallowRef({ sizes: createLayoutIndex() })
const metrics = computed(() => {
  measurementVersion.value
  return { sizes: layout.value.sizes, total: layout.value.sizes.total }
})

function getMaximum(total = metrics.value.total) {
  return Math.max(0, total - viewportHeight.value)
}

function findIndexAtOffset(offset: number) {
  return metrics.value.sizes.findIndex(offset)
}

// Native scrolling starts at the bottom. Render the initial range there too,
// avoiding a mount/measure/unmount of the oldest page before showing the latest.
scrollTop.value = props.initialScroll === 'bottom' ? getMaximum() : 0

const visibleRange = computed(() => {
  if (props.items.length === 0) return { start: 0, end: 0 }

  const firstVisible = findIndexAtOffset(scrollTop.value)
  const visibleEnd =
    findIndexAtOffset(scrollTop.value + viewportHeight.value) + 1
  return {
    start: firstVisible,
    end: Math.min(props.items.length, visibleEnd),
  }
})

const renderRange = computed(() => {
  if (props.items.length === 0) return { start: 0, end: 0 }

  const firstVisible = visibleRange.value.start
  const visibleEnd = visibleRange.value.end
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

const renderedIndexes = computed(() => {
  const indexes = new Set<number>()
  for (let index = startIndex.value; index < endIndex.value; index += 1) {
    indexes.add(index)
  }
  for (const key of props.pinnedKeys.slice(0, normalizedMaxPinnedItems.value)) {
    const index = layout.value.sizes.getIndex(key)
    if (index !== undefined) indexes.add(index)
  }
  if (props.keepFocusedItem && focusedKey.value !== undefined) {
    const index = layout.value.sizes.getIndex(focusedKey.value)
    if (index !== undefined) indexes.add(index)
  }
  return [...indexes].sort((left, right) => left - right)
})

const visibleItems = computed(() => renderedIndexes.value.map((index) => {
  const item = props.items[index]
  return {
    item,
    index,
    key: getItemKey(item, index),
    bottom: Math.max(metrics.value.total, viewportHeight.value)
      - metrics.value.sizes.getOffset(index + 1) + scrollCompensation.value,
  }
}))

const containerStyle = computed(() => ({
  height: toCssHeight(props.height),
}))
const containerClass = computed(() => ({
  'vue-chat-virtual-scroll--contained': props.contain,
}))
const ariaLive = computed(() => isAtBottom.value && !isScrolling.value ? 'polite' : 'off')

function getNewItemsLabel(count: number) {
  return props.newItemsLabel?.(count)
    ?? `${count} new ${count === 1 ? 'message' : 'messages'}`
}

function getScrollTop(total = metrics.value.total) {
  // Clamp elastic overscroll without writing to the native scroller.
  const maximum = getMaximum(total)
  const nativeTop = Math.min(0, viewport.value?.scrollTop ?? 0)
  return Math.max(0, Math.min(maximum, maximum + nativeTop + pendingScrollAdjustment))
}

function scheduleScrollAdjustment(atBoundary = false) {
  if (adjustmentScheduled || ((isScrolling.value || finishSmoothScroll) && !atBoundary)) return
  if (pendingScrollAdjustment === 0) return
  adjustmentScheduled = true
  const version = scrollRequestVersion
  const generation = ++adjustmentGeneration
  scrollCompensation.value = 0

  nextTick(() => {
    if (generation !== adjustmentGeneration) return
    adjustmentScheduled = false
    const element = viewport.value
    if (!element || version !== scrollRequestVersion || pendingScrollAdjustment === 0) return

    // Commit after the spacer/rows have been patched. Use the logical target
    // because a shrinking spacer may already have clamped the native offset.
    pendingScrollAdjustment = 0
    element.scrollTop = Math.min(0, scrollTop.value - getMaximum())
    expectedNativeTop = element.scrollTop
    scrollTop.value = getScrollTop()
    updateBottomState()
    maybeEmitLoadOlder()
  })
}

function adjustScrollPosition(adjustment: number) {
  const element = viewport.value
  if (!element) return

  pendingScrollAdjustment += adjustment
  scrollTop.value = getScrollTop()
  if (pendingScrollAdjustment === 0 || getMaximum() === 0) {
    pendingScrollAdjustment = 0
    scrollCompensation.value = 0
    return
  }
  if ((isScrolling.value || finishSmoothScroll) && !adjustmentScheduled) {
    // Only changes below the reading anchor need compensation. Prepending and
    // measuring history above it leave native momentum completely untouched.
    scrollCompensation.value = pendingScrollAdjustment
    // At the native bottom there is no further momentum to preserve. Rebase
    // immediately so newly appended content remains reachable in this gesture.
    if (element.scrollTop >= -1) scheduleScrollAdjustment(true)
  } else {
    scheduleScrollAdjustment()
  }
}

function cancelScrollTarget() {
  pendingIndexScroll = undefined
  finishSmoothScroll = undefined
}

function updateFocusedKey() {
  if (!props.keepFocusedItem) {
    focusedKey.value = undefined
    return
  }
  const active = document.activeElement
  const row = active instanceof Element
    ? active.closest<HTMLElement>('.vue-chat-virtual-scroll__item')
    : null
  focusedKey.value = row ? observedElements.get(row) : undefined
}

function handleFocusIn() {
  updateFocusedKey()
}

function handleFocusOut() {
  nextTick(updateFocusedKey)
}

function setNewItemsCount(count: number) {
  const normalized = Math.max(0, Math.floor(count))
  if (normalized === newItemsCount.value) return
  newItemsCount.value = normalized
  if (mounted) emit('newItemsChange', normalized)
}

function clearNewItems() {
  setNewItemsCount(0)
}

function emitVisibleRange() {
  emit('visibleChange', {
    scrollTop: getScrollTop(),
    startIndex: visibleRange.value.start,
    endIndex: visibleRange.value.end,
  })
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
  if (nextIsAtBottom) clearNewItems()
}

function updateMeasuredHeight() {
  measuredHeight.value = viewport.value?.clientHeight ?? 0
  if (mounted) scrollTop.value = getScrollTop()
  warnIfZeroHeight(viewport.value, props.height)
  nextTick(() => {
    updateBottomState()
    maybeEmitLoadOlder()
  })
}

function handleScroll() {
  if (pendingIndexScroll && expectedNativeTop !== undefined
    && Math.abs((viewport.value?.scrollTop ?? 0) - expectedNativeTop) > 1) {
    cancelScrollTarget()
  }
  scrollTop.value = getScrollTop()
  if (pendingScrollAdjustment !== 0 && (viewport.value?.scrollTop ?? 0) >= -1) {
    scheduleScrollAdjustment(true)
  }
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

function updateItemSizes(measurements: { key: PropertyKey; height: number }[]) {
  const previousTotal = metrics.value.total
  const previousScrollTop = getScrollTop()
  const keepAtBottom = !isScrolling.value && !finishSmoothScroll && isAtBottom.value && props.stickToBottom
    && (mounted || props.initialScroll === 'bottom')
  // Anchor the bottom edge of the last visible message. Newly discovered older
  // messages can grow upward without moving the conversation already on screen.
  const anchor = findIndexAtOffset(previousScrollTop + viewportHeight.value - 1)
  const keepAtTop = !keepAtBottom && previousScrollTop <= 0
  let anchorAdjustment = 0
  let changed = false

  for (const { key, height } of measurements) {
    if (!Number.isFinite(height) || height <= 0) continue
    const index = layout.value.sizes.getIndex(key)
    if (index === undefined) continue
    const previous = metrics.value.sizes.getSize(index)
    measuredKeys.add(key)
    if (Math.abs(previous - height) < 0.5) continue

    if (index <= anchor) anchorAdjustment += height - previous
    metrics.value.sizes.setSize(index, height)
    changed = true
  }

  if (!changed) return
  measurementVersion.value += 1
  const maximumDelta = getMaximum() - getMaximum(previousTotal)
  const requestedIndex = pendingIndexScroll && layout.value.sizes.getIndex(pendingIndexScroll.key)
  const desiredTop = requestedIndex !== undefined && pendingIndexScroll
    ? getAlignedTop(requestedIndex, pendingIndexScroll.align)
    : keepAtBottom ? getMaximum()
    : keepAtTop ? 0 : previousScrollTop + anchorAdjustment
  adjustScrollPosition(desiredTop - previousScrollTop - maximumDelta)
  nextTick(updateBottomState)
}

function handleItemResize(entries: ResizeObserverEntry[]) {
  const measurements: { key: PropertyKey; height: number }[] = []
  for (const entry of entries) {
    const key = observedElements.get(entry.target as HTMLElement)
    if (key !== undefined) measurements.push({ key, height: getEntryHeight(entry) })
  }
  updateItemSizes(measurements)
}

function measureNewElements() {
  // Read new rows together after Vue patches, before paint. ResizeObserver
  // remains responsible for later image/font/content changes. Cached rows do
  // not need this synchronous first measurement again.
  const measurements: { key: PropertyKey; height: number }[] = []
  for (const element of unmeasuredElements) {
    const key = observedElements.get(element)
    if (key !== undefined && element.isConnected) {
      measurements.push({ key, height: element.getBoundingClientRect().height })
    }
  }
  unmeasuredElements.clear()
  updateItemSizes(measurements)
}

function setItemElement(
  value: Element | ComponentPublicInstance | null,
  key: PropertyKey,
) {
  if (!(value instanceof HTMLElement)) return
  if (observedElements.get(value) === key) return

  observedElements.set(value, key)
  if (props.syncMeasurement && !measuredKeys.has(key)) unmeasuredElements.add(value)
  itemResizeObserver?.observe(value)
}

function removeDisconnectedElements() {
  for (const [element] of observedElements) {
    if (!element.isConnected) {
      itemResizeObserver?.unobserve(element)
      observedElements.delete(element)
      unmeasuredElements.delete(element)
    }
  }
}

function applyScrollPosition(top: number, options: ScrollToOptions, direct = false) {
  const element = viewport.value
  if (!element) return

  const previousScrollTop = getScrollTop()
  const wasCompensating = scrollCompensation.value !== 0
  const version = ++scrollRequestVersion
  adjustmentGeneration += 1
  adjustmentScheduled = false
  pendingIndexScroll = undefined
  const behavior = options.behavior ?? 'auto'
  finishSmoothScroll = behavior === 'smooth' ? () => scrollTo(top) : undefined
  pendingScrollAdjustment = 0
  scrollCompensation.value = 0
  setScrolling(false)
  disposeScrollActivity()
  if (behavior === 'auto') scrollTop.value = top

  const apply = () => {
    if (viewport.value !== element || version !== scrollRequestVersion) return
    if (wasCompensating && behavior !== 'auto') element.scrollTop = previousScrollTop - getMaximum()
    if (direct && behavior === 'auto') {
      element.scrollTop = top - getMaximum()
    } else {
      element.scrollTo({ ...options, top: top - getMaximum(), behavior })
    }
    expectedNativeTop = element.scrollTop
    if (behavior === 'auto') scrollTop.value = getScrollTop()
    else scheduleScrollEnd()
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

function getAlignedTop(index: number, align: ScrollAlignment) {
  const itemSize = metrics.value.sizes.getSize(index)
  let top = metrics.value.sizes.getOffset(index)
  if (align === 'center') top -= (viewportHeight.value - itemSize) / 2
  else if (align === 'end') top -= viewportHeight.value - itemSize
  return Math.max(0, Math.min(top, getMaximum()))
}

function scrollToIndex(
  index: number,
  options: ScrollToOptions & { align?: ScrollAlignment } = {},
) {
  if (!viewport.value || props.items.length === 0) return
  const safeIndex = Math.min(
    props.items.length - 1,
    Math.max(0, Math.floor(Number.isFinite(index) ? index : 0)),
  )
  const { align = 'start', ...scrollOptions } = options
  applyScrollPosition(getAlignedTop(safeIndex, align), scrollOptions)
  const key = layout.value.sizes.getKey(safeIndex)!
  if (options.behavior === 'smooth') {
    finishSmoothScroll = () => {
      const index = layout.value.sizes.getIndex(key)
      if (index !== undefined) scrollToIndex(index, { align })
    }
  } else {
    // Keep the requested message aligned through asynchronous image/font
    // measurements too. Any user input or subsequent scroll command releases it.
    pendingIndexScroll = { key, align }
  }
}

function scrollToKey(
  key: PropertyKey,
  options: ScrollToOptions & { align?: ScrollAlignment } = {},
) {
  const index = layout.value.sizes.getIndex(key)
  if (index !== undefined) scrollToIndex(index, options)
}

function getScrollPosition() {
  return getScrollTop()
}

function scrollToTop(behavior: ScrollBehavior = 'auto') {
  applyScrollPosition(0, { behavior })
}

function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  const element = viewport.value
  if (!element) return

  const top = Math.max(0, metrics.value.total - element.clientHeight)
  applyScrollPosition(top, { behavior }, true)
  if (behavior === 'smooth') finishSmoothScroll = () => scrollToBottom()
}

const refreshVersion = ref(0)

/** Reconcile after an in-place mutation when replacing `items` is impractical. */
function refresh() {
  refreshVersion.value += 1
}

watch(
  () => {
    const length = props.items.length
    return [
      props.items,
      length,
      length > 0 ? getItemKey(props.items[0], 0) : undefined,
      length > 0
        ? getItemKey(props.items[Math.floor(length / 2)], Math.floor(length / 2))
        : undefined,
      length > 0 ? getItemKey(props.items[length - 1], length - 1) : undefined,
      props.itemKey,
      props.estimatedItemSize,
      props.estimateItemSize,
      props.itemsVersion,
      refreshVersion.value,
    ] as const
  },
  async (source, previousSource) => {
    const previous = layout.value.sizes
    const previousLength = previous.length
    const previousTotal = previous.total
    const previousTop = getScrollTop(previousTotal)
    const anchorIndex = previous.findIndex(previousTop + viewportHeight.value - 1)
    const anchorKey = previous.getKey(anchorIndex)
    const previousAnchorOffset = previous.getOffset(anchorIndex + 1)
    const nextLength = props.items.length
    const estimateChanged = source[5] !== previousSource[5]
      || source[6] !== previousSource[6]
      || source[7] !== previousSource[7]
    const explicitlyInvalidated = source[8] !== previousSource[8]
      || source[9] !== previousSource[9]

    function preservesPreviousSequence(offset: number) {
      if (previousLength === 0) return true
      const samples = new Set([0, Math.floor(previousLength / 2), previousLength - 1])
      for (const previousIndex of samples) {
        const nextIndex = offset + previousIndex
        if (
          nextIndex >= nextLength ||
          previous.getKey(previousIndex) !== getItemKey(props.items[nextIndex], nextIndex)
        ) {
          return false
        }
      }
      return true
    }

    const added = nextLength - previousLength
    let mutation: 'append' | 'prepend' | 'rebuild' = 'rebuild'
    if (!estimateChanged && !explicitlyInvalidated && added > 0) {
      if (preservesPreviousSequence(0)) mutation = 'append'
      else if (preservesPreviousSequence(added)) mutation = 'prepend'
    }

    let next = previous
    if (mutation === 'append') {
      next.append(props.items.slice(previousLength).map((item, offset) => {
        const index = previousLength + offset
        const key = getItemKey(item, index)
        return { key, size: getEstimatedSize(item, index) }
      }))
    } else if (mutation === 'prepend') {
      next.prepend(props.items.slice(0, added).map((item, index) => {
        const key = getItemKey(item, index)
        return { key, size: getEstimatedSize(item, index) }
      }))
    } else {
      next = createLayoutIndex(previous)
    }
    layout.value = { sizes: next }

    const appendedIndexes = mutation === 'append'
      ? Array.from({ length: added }, (_, offset) => previousLength + offset)
      : []
    const forceFollow = appendedIndexes.some((index) =>
      props.forceStickToBottom?.(props.items[index], index) === true,
    )
    const keepAtBottom = forceFollow || (
      !isScrolling.value && !finishSmoothScroll && isAtBottom.value && props.stickToBottom
    )
    if (appendedIndexes.length > 0 && !keepAtBottom) {
      setNewItemsCount(newItemsCount.value + appendedIndexes.length)
    }
    const nextAnchor = anchorKey === undefined ? undefined : next.getIndex(anchorKey)
    const maximumDelta = getMaximum() - getMaximum(previousTotal)

    for (const key of measuredKeys) {
      if (!next.hasKey(key)) measuredKeys.delete(key)
    }

    if (next.length === 0 || nextAnchor === undefined) {
      pendingScrollAdjustment = 0
      scrollCompensation.value = 0
      scrollTop.value = keepAtBottom ? getMaximum() : Math.min(previousTop, getMaximum())
      const target = scrollTop.value
      const version = scrollRequestVersion
      await nextTick()
      if (version === scrollRequestVersion && layout.value.sizes === next) {
        applyScrollPosition(target, {}, true)
      }
    } else {
      const anchorAdjustment = next.getOffset(nextAnchor + 1) - previousAnchorOffset
      const desiredTop = keepAtBottom ? getMaximum() : previousTop + anchorAdjustment
      adjustScrollPosition(desiredTop - previousTop - maximumDelta)
      await nextTick()
    }
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

watch(
  () => props.syncMeasurement,
  (enabled) => {
    unmeasuredElements.clear()
    if (!enabled) return
    for (const [element, key] of observedElements) {
      if (!measuredKeys.has(key)) unmeasuredElements.add(element)
    }
    nextTick(measureNewElements)
  },
)

watch(
  visibleRange,
  () => {
    if (mounted) emitVisibleRange()
  },
  { flush: 'post' },
)

onMounted(() => {
  window.addEventListener('pointerup', handlePointerUp, { passive: true })
  window.addEventListener('pointercancel', handlePointerUp, { passive: true })
  updateMeasuredHeight()
  if (viewport.value) {
    viewport.value.scrollTop = props.initialScroll === 'bottom' ? 0 : -getMaximum()
    scrollTop.value = getScrollTop()
  }
  measureNewElements()

  if (typeof ResizeObserver !== 'undefined') {
    viewportResizeObserver = new ResizeObserver(updateMeasuredHeight)
    itemResizeObserver = new ResizeObserver(handleItemResize)

    if (viewport.value) viewportResizeObserver.observe(viewport.value)
    for (const [element] of observedElements) {
      itemResizeObserver.observe(element)
    }
  }

  nextTick(() => {
    mounted = true
    updateBottomState()
    maybeEmitLoadOlder()
    emitVisibleRange()
  })
})

onUpdated(() => {
  removeDisconnectedElements()
  measureNewElements()
})

onBeforeUnmount(() => {
  mounted = false
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('pointercancel', handlePointerUp)
  disposeScrollActivity()
  cancelScrollTarget()
  pendingScrollAdjustment = 0
  scrollRequestVersion += 1
  adjustmentGeneration += 1
  if (viewportResizeObserver) {
    viewportResizeObserver.disconnect()
    viewportResizeObserver = undefined
  }
  if (itemResizeObserver) {
    itemResizeObserver.disconnect()
    itemResizeObserver = undefined
  }
  observedElements.clear()
  unmeasuredElements.clear()
})

defineExpose({
  isAtBottom,
  isScrolling,
  newItemsCount,
  clearNewItems,
  refresh,
  getScrollPosition,
  scrollTo,
  scrollToIndex,
  scrollToKey,
  scrollToTop,
  scrollToBottom,
})
</script>

<template>
  <div
    class="vue-chat-virtual-scroll__root"
    :style="containerStyle"
  >
    <div
      v-bind="$attrs"
      ref="viewport"
      class="vue-chat-virtual-scroll"
      :class="containerClass"
      role="log"
      :aria-label="ariaLabel"
      :aria-live="ariaLive"
      aria-relevant="additions"
      aria-atomic="false"
      tabindex="0"
      @scroll.passive="handleScroll"
      @scrollend.passive="handleScrollEnd"
      @pointerdown.passive="handlePointerDown"
      @wheel.passive="handleWheel"
      @keydown="handleKeyDown"
      @focusin="handleFocusIn"
      @focusout="handleFocusOut"
      @touchstart.passive="handleTouchStart"
      @touchend.passive="handleTouchEnd"
      @touchcancel.passive="handleTouchEnd"
    >
      <div
        class="vue-chat-virtual-scroll__spacer"
        :style="{ height: `${Math.max(viewportHeight, metrics.total + scrollCompensation)}px` }"
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
          v-for="{ item, index, key, bottom } in visibleItems"
          :key="key"
          :ref="(element) => setItemElement(element, key)"
          class="vue-chat-virtual-scroll__item"
          :style="{ transform: `translateY(${-bottom}px)` }"
          role="article"
          :aria-posinset="index + 1"
          :aria-setsize="items.length"
        >
          <slot :item="item" :index="index" />
        </div>
        <slot v-if="!items.length" name="empty" />
      </div>
    </div>
    <div
      v-if="showNewItemsIndicator && newItemsCount > 0"
      class="vue-chat-virtual-scroll__new-items"
      role="status"
    >
      <slot
        name="newItems"
        :count="newItemsCount"
        :scroll-to-bottom="scrollToBottom"
      >
        <button type="button" @click="scrollToBottom('smooth')">
          {{ getNewItemsLabel(newItemsCount) }}
        </button>
      </slot>
    </div>
  </div>
</template>
