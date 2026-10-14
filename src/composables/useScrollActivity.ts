import { ref } from 'vue'

interface ScrollActivityOptions {
  delay: () => number
  viewport: () => HTMLElement | undefined
  hasProgrammaticScroll: () => boolean
  onInterrupt: () => void
  onStart: () => void
  onSettled: () => void
  onChange: (isScrolling: boolean) => void
}

const scrollKeys = new Set([
  'ArrowDown',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
  ' ',
])

/**
 * Normalizes wheel, touch, keyboard and scrollbar activity into one lifecycle.
 * The chat layout can defer native scroll corrections until that lifecycle has
 * settled without mixing input-device bookkeeping into measurement logic.
 */
export function useScrollActivity(options: ScrollActivityOptions) {
  const isScrolling = ref(false)
  let touching = false
  let pointerScrolling = false
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  function clearTimer() {
    clearTimeout(idleTimer)
    idleTimer = undefined
  }

  function setScrolling(value: boolean) {
    if (value === isScrolling.value) return
    isScrolling.value = value
    options.onChange(value)
  }

  function handleScrollEnd() {
    if (touching || pointerScrolling) return
    clearTimer()
    setScrolling(false)
    options.onSettled()
  }

  function scheduleScrollEnd() {
    clearTimer()
    // Also covers browsers without scrollend and taps that produce no scroll.
    if ((isScrolling.value || options.hasProgrammaticScroll())
      && !touching && !pointerScrolling) {
      idleTimer = setTimeout(handleScrollEnd, options.delay())
    }
  }

  function startUserScroll() {
    options.onInterrupt()
    clearTimer()
    setScrolling(true)
    options.onStart()
  }

  function handleTouchStart() {
    touching = true
    startUserScroll()
  }

  function handleTouchEnd(event: TouchEvent) {
    touching = event.touches.length > 0
    scheduleScrollEnd()
  }

  function handleWheel() {
    startUserScroll()
    scheduleScrollEnd()
  }

  function handleKeyDown(event: KeyboardEvent) {
    options.onInterrupt()
    if (!scrollKeys.has(event.key)) return
    startUserScroll()
    scheduleScrollEnd()
  }

  function handlePointerDown(event: PointerEvent) {
    options.onInterrupt()
    // A scrollbar drag targets the viewport itself. Pointer events from message
    // content should not postpone unrelated asynchronous measurements.
    if (event.pointerType === 'mouse' && event.target === options.viewport()) {
      pointerScrolling = true
      startUserScroll()
    }
  }

  function handlePointerUp() {
    if (!pointerScrolling) return
    pointerScrolling = false
    scheduleScrollEnd()
  }

  return {
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
    dispose: clearTimer,
  }
}
