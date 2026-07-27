import { computed, nextTick, ref, watch } from 'vue'

interface PullToRefreshOptions {
  enabled: () => boolean
  refreshing: () => boolean
  threshold: () => number
  onRefresh: () => void
  scrollTop?: () => number
}

export function usePullToRefresh(options: PullToRefreshOptions) {
  const startY = ref<number>()
  const pullDistance = ref(0)
  const pulling = ref(false)
  const refreshRequested = ref(false)
  const threshold = computed(() => Math.max(1, options.threshold()))

  const pullOffset = computed(() =>
    options.refreshing() || refreshRequested.value
      ? threshold.value
      : pullDistance.value,
  )
  const pullProgress = computed(() =>
    Math.min(1, pullDistance.value / threshold.value),
  )
  const refreshMessage = computed(() => {
    if (options.refreshing() || refreshRequested.value) return 'Refreshing…'
    if (pullProgress.value >= 1) return 'Release to refresh'
    return 'Pull to refresh'
  })

  function reset() {
    startY.value = undefined
    pulling.value = false
    pullDistance.value = 0
  }

  function handleTouchStart(event: TouchEvent) {
    const element = event.currentTarget as HTMLElement
    const scrollTop = options.scrollTop?.() ?? element.scrollTop
    if (
      !options.enabled() ||
      options.refreshing() ||
      scrollTop > 0 ||
      event.touches.length !== 1
    ) {
      return
    }

    startY.value = event.touches[0].clientY
    pulling.value = true
  }

  function handleTouchMove(event: TouchEvent) {
    if (startY.value === undefined || !pulling.value) return

    const element = event.currentTarget as HTMLElement
    const scrollTop = options.scrollTop?.() ?? element.scrollTop
    if (scrollTop > 0 || event.touches.length !== 1) {
      reset()
      return
    }

    const delta = event.touches[0].clientY - startY.value
    if (delta <= 0) {
      pullDistance.value = 0
      return
    }

    event.preventDefault()
    pullDistance.value = Math.min(delta * 0.5, threshold.value * 2)
  }

  function handleTouchEnd() {
    if (startY.value === undefined) return

    const shouldRefresh =
      pullDistance.value >= threshold.value &&
      options.enabled() &&
      !options.refreshing()

    startY.value = undefined
    pulling.value = false

    if (!shouldRefresh) {
      pullDistance.value = 0
      return
    }

    pullDistance.value = threshold.value
    refreshRequested.value = true
    options.onRefresh()

    nextTick(() => {
      if (!options.refreshing()) {
        refreshRequested.value = false
        pullDistance.value = 0
      }
    })
  }

  watch(
    () => options.refreshing(),
    (refreshing, wasRefreshing) => {
      if (refreshing) {
        refreshRequested.value = false
        pullDistance.value = threshold.value
      } else if (wasRefreshing) {
        refreshRequested.value = false
        pullDistance.value = 0
      }
    },
  )

  return {
    pulling,
    pullDistance,
    pullOffset,
    pullProgress,
    refreshMessage,
    refreshThreshold: threshold,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel: reset,
  }
}
