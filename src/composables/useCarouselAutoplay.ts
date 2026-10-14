import { onBeforeUnmount, watch } from 'vue'

interface CarouselAutoplayOptions {
  enabled: () => boolean
  paused: () => boolean
  delay: () => number
  count: () => number
  atEnd: () => boolean
  loop: () => boolean
  advance: () => void
  rewind: () => void
}

export function useCarouselAutoplay(options: CarouselAutoplayOptions) {
  let timer: ReturnType<typeof setTimeout> | undefined

  function stop() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  function start() {
    stop()
    if (!options.enabled() || options.paused() || options.count() < 2) return
    if (options.atEnd() && !options.loop()) return
    const delay = Number.isFinite(options.delay()) ? Math.max(1, options.delay()) : 3000
    timer = setTimeout(() => {
      timer = undefined
      if (options.paused()) return
      if (options.atEnd()) options.rewind()
      else options.advance()
      // Schedule even while hovered when pauseOnHover is disabled.
      start()
    }, delay)
  }

  watch(
    () => [options.enabled(), options.paused(), options.delay(), options.count(), options.loop(), options.atEnd()],
    start,
    { immediate: true },
  )
  onBeforeUnmount(stop)
  return { start, stop }
}
