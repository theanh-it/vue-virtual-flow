export type ItemKey<T> = keyof T | ((item: T, index: number) => PropertyKey)

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

export interface ChatVirtualScrollProps<T> {
  items: readonly T[]
  estimatedItemSize?: number
  height?: number | string
  overscan?: number
  itemKey?: ItemKey<T>
  ariaLabel?: string
  stickToBottom?: boolean
  bottomThreshold?: number
  initialScroll?: 'top' | 'bottom'
  hasOlder?: boolean
  loadingOlder?: boolean
  loadOlderThreshold?: number
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
  scrollToBottom: (behavior?: ScrollBehavior) => void
}

export interface ShortMediaFeedExpose {
  scrollToIndex: (index: number, options?: ScrollToOptions) => void
}

export interface VirtualCarouselExpose {
  next: (behavior?: ScrollBehavior) => void
  previous: (behavior?: ScrollBehavior) => void
  scrollToIndex: (index: number, options?: ScrollToOptions) => void
}

export type VirtualListProps<T> = DynamicVirtualScrollProps<T>
export type VirtualListExpose = VirtualScrollExpose
