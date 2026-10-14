export type ItemKey<T> = keyof T | ((item: T, index: number) => PropertyKey)

export interface SkeletonLoaderProps {
  /** Numeric dimensions are pixels; strings accept CSS lengths. */
  width?: number | string
  height?: number | string
  /** Use equal width and height for a circle. */
  variant?: 'rectangle' | 'rounded' | 'circle'
  animated?: boolean
  ariaLabel?: string
}

export interface VirtualScrollProps<T> {
  items: readonly T[]
  itemSize: number
  height?: number | string
  overscan?: number
  itemKey?: ItemKey<T>
  ariaLabel?: string
  hasMore?: boolean
  loading?: boolean
  loadingItemSize?: number
  loadMoreThreshold?: number
  pullToRefresh?: boolean
  refreshing?: boolean
  pullRefreshThreshold?: number
}

export interface DynamicVirtualScrollProps<T> {
  items: readonly T[]
  estimatedItemSize?: number
  height?: number | string
  overscan?: number
  itemKey?: ItemKey<T>
  ariaLabel?: string
  hasMore?: boolean
  loading?: boolean
  loadingItemSize?: number
  loadMoreThreshold?: number
  pullToRefresh?: boolean
  refreshing?: boolean
  pullRefreshThreshold?: number
}

export interface WindowDynamicVirtualScrollProps<T> {
  items: readonly T[]
  estimatedItemSize?: number
  overscan?: number
  itemKey?: ItemKey<T>
  ariaLabel?: string
  hasMore?: boolean
  loading?: boolean
  loadingItemSize?: number
  loadMoreThreshold?: number
  pullToRefresh?: boolean
  refreshing?: boolean
  pullRefreshThreshold?: number
}

export interface WindowGirdVirtualScrollProps<T> {
  items: readonly T[]
  itemSize: number
  columns?: number
  gap?: number
  overscan?: number
  itemKey?: ItemKey<T>
  ariaLabel?: string
  hasMore?: boolean
  loading?: boolean
  loadingItemSize?: number
  loadMoreThreshold?: number
  pullToRefresh?: boolean
  refreshing?: boolean
  pullRefreshThreshold?: number
}

export interface ChatVirtualScrollProps<T> {
  items: readonly T[]
  /** Increment after mutating/reordering the same array instance in place. */
  itemsVersion?: PropertyKey
  estimatedItemSize?: number
  /** Optional per-message estimate used before the message is measured. */
  estimateItemSize?: (item: T, index: number) => number
  height?: number | string
  overscan?: number
  /** Render budget including overscan; always keeps the viewport filled. */
  size?: number
  itemKey?: ItemKey<T>
  ariaLabel?: string
  stickToBottom?: boolean
  bottomThreshold?: number
  initialScroll?: 'top' | 'bottom'
  hasOlder?: boolean
  loadingOlder?: boolean
  loadOlderThreshold?: number
  /** Idle delay used when the browser does not provide a reliable scrollend event. */
  scrollEndDelay?: number
  /** Measure newly mounted messages synchronously before paint. */
  syncMeasurement?: boolean
  /** Message keys that must remain mounted outside the visible range. */
  pinnedKeys?: readonly PropertyKey[]
  maxPinnedItems?: number
  /** Retain the message containing keyboard focus while it is off-screen. */
  keepFocusedItem?: boolean
  showNewItemsIndicator?: boolean
  /** Localizes the built-in new-message control. */
  newItemsLabel?: (count: number) => string
  /** Return true for appended items that should always move the conversation to the bottom. */
  forceStickToBottom?: (item: T, index: number) => boolean
  /** Enable layout/paint containment. Disable when non-teleported overlays may escape. */
  contain?: boolean
}

export interface ShortMediaFeedProps<T> {
  items: readonly T[]
  activeIndex?: number
  buffer?: number
  height?: number | string
  itemKey?: ItemKey<T>
  ariaLabel?: string
  hasMore?: boolean
  loading?: boolean
  loadMoreThreshold?: number
}

export interface ShortMediaFeedChangeEvent<T> {
  index: number
  item: T
}

export interface VirtualCarouselProps<T> {
  items: readonly T[]
  activeIndex?: number
  slidesPerView?: number
  slidesToScroll?: number
  gap?: number
  buffer?: number
  height?: number | string
  itemKey?: ItemKey<T>
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
  /** Disable native snap for nested snap containers; the motion controller settles instead. */
  nativeSnap?: boolean
  autoWidth?: boolean
  estimatedItemWidth?: number
  rtl?: boolean
  /** Continuous looping; distinct from autoplayLoop's rewind behavior. */
  loop?: boolean
  keepAlive?: boolean
  /** Maximum additional off-screen slides retained by keepAlive. */
  maxCachedItems?: number
  /** Slides to retain, capped by maxCachedItems. */
  pinnedIndexes?: readonly number[]
  responsive?: ResponsiveBreakpoint[]
}

export type CarouselInteractionPhase = 'idle' | 'pending' | 'dragging' | 'settling' | 'committing'

export interface ResponsiveBreakpoint {
  breakpoint: number
  slidesPerView?: number
  slidesToScroll?: number
  gap?: number
}

export interface VirtualCarouselChangeEvent<T> {
  index: number
  item: T
}

export interface VirtualScrollEvent {
  scrollTop: number
  startIndex: number
  endIndex: number
}

export type ScrollAlignment = 'start' | 'center' | 'end'

export interface VirtualScrollExpose {
  scrollTo: (position: number, options?: ScrollToOptions) => void
  scrollToIndex: (
    index: number,
    options?: ScrollToOptions & { align?: ScrollAlignment },
  ) => void
  scrollToTop: (behavior?: ScrollBehavior) => void
}

export interface ChatVirtualScrollExpose extends VirtualScrollExpose {
  readonly isAtBottom: boolean
  readonly isScrolling: boolean
  readonly newItemsCount: number
  clearNewItems: () => void
  /** Reconcile keys and measurements after an in-place items mutation. */
  refresh: () => void
  getScrollPosition: () => number
  scrollToKey: (
    key: PropertyKey,
    options?: ScrollToOptions & { align?: ScrollAlignment },
  ) => void
  scrollToBottom: (behavior?: ScrollBehavior) => void
}

export interface ShortMediaFeedExpose {
  scrollToIndex: (index: number, options?: ScrollToOptions) => void
}

export interface VirtualCarouselExpose {
  next: (behavior?: ScrollBehavior) => void
  previous: (behavior?: ScrollBehavior) => void
  scrollToIndex: (index: number, options?: ScrollToOptions) => void
  startAutoplay: () => void
  stopAutoplay: () => void
}

export type VirtualListProps<T> = DynamicVirtualScrollProps<T>
export type VirtualListExpose = VirtualScrollExpose
