import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import type { CarouselInteractionPhase } from '../types'
import { createCarouselSettleMotion, projectCarouselMomentum } from '../utils/carouselMotion'

interface CarouselInteractionOptions {
  viewport: () => HTMLElement | undefined
  track: () => HTMLElement | undefined
  rtl: () => boolean
  mouseDrag: () => boolean
  nativeSnap: () => boolean
  dragThreshold: () => number
  momentum: () => boolean
  settleDuration: () => number
  limits: () => [number, number]
  step: () => number
  indexAt: (position: number) => number
  target: (index: number, from: number, direction?: number) => number
  canonical: (index: number) => number
  onPosition: (position: number) => void
  onCommit: (index: number) => void
}

export function useCarouselInteraction(options: CarouselInteractionOptions) {
  const phase = ref<CarouselInteractionPhase>('idle')
  const busy = computed(() => phase.value !== 'idle')
  const dragging = computed(() => phase.value === 'dragging')
  const transformed = ref(false)
  let pointerId: number | undefined
  let pointerType = ''
  let startX = 0
  let startY = 0
  let startPosition = 0
  let origin = 0
  let offset = 0
  let lastX = 0
  let lastTime = 0
  let velocity = 0
  let velocitySamples = 0
  let animation: Animation | undefined
  let nativeTarget: number | undefined
  let frame: number | undefined
  let epoch = 0
  let suppressClick = false
  let clickTimer: ReturnType<typeof setTimeout> | undefined
  let wheelTimer: ReturnType<typeof setTimeout> | undefined
  let previousSnap = ''
  let snapLocked = false
  let lastMove: PointerEvent | undefined
  let disposed = false

  const direction = () => options.rtl() ? -1 : 1
  const read = () => (options.viewport()?.scrollLeft ?? 0) * direction()
  function write(position: number, behavior?: ScrollBehavior) {
    const element = options.viewport()
    if (!element) return
    const left = position * direction()
    if (element.scrollTo) {
      element.scrollTo(behavior === undefined ? { left } : { left, behavior })
    } else element.scrollLeft = left
  }

  function lockSnap() {
    const element = options.viewport()
    if (!element) return
    if (!snapLocked) previousSnap = element.style.scrollSnapType
    snapLocked = true
    element.style.scrollSnapType = 'none'
  }

  function unlockSnap() {
    const token = epoch
    nextTick(() => {
      if (disposed || token !== epoch || phase.value !== 'idle') return
      if (options.viewport()) options.viewport()!.style.scrollSnapType = previousSnap
      snapLocked = false
    })
  }

  function clearTransform() {
    const track = options.track()
    if (!track) return
    track.style.transform = ''
    track.style.willChange = ''
  }

  function animationOffset() {
    const element = options.track()
    if (!element || !animation) return offset
    const transform = getComputedStyle(element).transform
    const values = transform.slice(transform.indexOf('(') + 1, -1).split(',').map(Number)
    const value = transform.startsWith('matrix3d') ? values[12] : values[4]
    return Number.isFinite(value) ? value : offset
  }

  function displayedPosition() {
    return animation ? origin - animationOffset() * direction() :
      transformed.value ? origin - offset * direction() : read()
  }

  function clearAnimation() {
    const old = animation
    animation = undefined
    if (old) {
      old.onfinish = null
      old.oncancel = null
      old.cancel()
    }
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
  }

  function releasePointer() {
    const id = pointerId
    pointerId = undefined
    const element = options.viewport()
    if (id !== undefined && element?.hasPointerCapture?.(id)) element.releasePointerCapture(id)
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', handlePointerCancel)
    window.removeEventListener('blur', handleBlur)
  }

  function commit(index: number, behavior?: ScrollBehavior) {
    const token = ++epoch
    lockSnap()
    phase.value = 'committing'
    clearAnimation()
    clearTransform()
    transformed.value = false
    offset = 0
    const position = options.canonical(index)
    write(position, behavior)
    options.onPosition(position)
    options.onCommit(index)
    nextTick(() => {
      if (disposed || token !== epoch) return
      write(position)
      phase.value = 'idle'
      unlockSnap()
    })
  }

  function cancel(preservePosition = true) {
    if (wheelTimer !== undefined) clearTimeout(wheelTimer)
    wheelTimer = undefined
    const hadVisualOffset = animation !== undefined || offset !== 0
    const position = preservePosition ? displayedPosition() : read()
    ++epoch
    lockSnap()
    releasePointer()
    clearAnimation()
    clearTransform()
    transformed.value = false
    nativeTarget = undefined
    offset = 0
    phase.value = 'idle'
    if (preservePosition) {
      if (hadVisualOffset) write(position)
      options.onPosition(position)
    }
    unlockSnap()
    return position
  }

  function monitorAnimation() {
    if (!animation) return
    options.onPosition(displayedPosition())
    frame = requestAnimationFrame(monitorAnimation)
  }

  function reducedMotion() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function settle(index: number, targetPosition: number, releaseVelocity: number) {
    const track = options.track()
    const targetOffset = (origin - targetPosition) * direction()
    if (!track?.animate || reducedMotion() || options.settleDuration() === 0 || Math.abs(targetOffset - offset) < 1) {
      clearTransform()
      transformed.value = false
      offset = 0
      phase.value = 'idle'
      // Native fallback for environments without Web Animations.
      if (!track?.animate && !reducedMotion() && options.settleDuration() !== 0) {
        options.onCommit(index)
        nativeTarget = targetPosition
        write(targetPosition, 'smooth')
        unlockSnap()
      } else commit(index)
      return
    }

    ++epoch
    lockSnap()
    phase.value = 'settling'
    transformed.value = true
    const motion = createCarouselSettleMotion(offset, targetOffset, releaseVelocity, options.settleDuration())
    const current = track.animate(motion.keyframes, motion.options)
    animation = current
    current.onfinish = () => { if (animation === current) commit(index) }
    current.oncancel = () => { if (animation === current) cancel() }
    frame = requestAnimationFrame(monitorAnimation)
  }

  function navigate(index: number, behavior: ScrollBehavior = 'smooth', travelDirection = 0, transform = false) {
    const from = cancel()
    const target = options.target(index, from, travelDirection)
    options.onCommit(index)
    if (Math.abs(target - from) < 0.5 || behavior !== 'smooth' || reducedMotion()) {
      commit(index, behavior)
    } else if (transform) {
      origin = read()
      offset = (origin - from) * direction()
      settle(index, target, 0)
    } else {
      phase.value = 'settling'
      nativeTarget = target
      write(target, behavior)
      // Native scroll-snap stays available for ordinary keyboard/API scrolling.
      if (options.viewport()) options.viewport()!.style.scrollSnapType = previousSnap
      snapLocked = false
    }
  }

  function handleScroll(event: Event) {
    const position = (event.currentTarget as HTMLElement).scrollLeft * direction()
    if (animation || phase.value === 'dragging' || phase.value === 'committing') return
    options.onPosition(position)
    if (nativeTarget !== undefined) {
      if (Math.abs(position - nativeTarget) > 1) return
      nativeTarget = undefined
      phase.value = 'idle'
    }
    options.onCommit(options.indexAt(position))
  }

  function handlePointerDown(event: PointerEvent) {
    if (pointerId !== undefined || event.isPrimary === false) return
    if (event.pointerType === 'mouse' && (!options.mouseDrag() || event.button !== 0)) return
    if (!['mouse', 'touch', 'pen'].includes(event.pointerType)) return
    if ((event.target as Element)?.closest?.('input, textarea, select, [contenteditable="true"], [data-carousel-no-drag]')) return

    if (nativeTarget !== undefined) write(read(), 'auto')
    // Hold the current animated frame without retargeting taps on children.
    const from = displayedPosition()
    const interrupted = animation !== undefined
    if (interrupted) {
      offset = animationOffset()
      clearAnimation()
      options.track()!.style.transform = `translate3d(${offset}px, 0, 0)`
      transformed.value = true
    } else {
      offset = 0
      origin = read()
    }
    ++epoch
    nativeTarget = undefined
    phase.value = 'pending'
    pointerId = event.pointerId
    pointerType = event.pointerType
    startX = lastX = event.clientX
    startY = event.clientY
    startPosition = from
    lastTime = event.timeStamp
    velocity = 0
    velocitySamples = 0
    suppressClick = false
    if (clickTimer !== undefined) clearTimeout(clickTimer)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('blur', handleBlur)
  }

  function handlePointerMove(event: PointerEvent) {
    if (pointerId !== event.pointerId || event === lastMove) return
    lastMove = event
    const deltaX = event.clientX - startX
    const deltaY = event.clientY - startY
    const threshold = Number.isFinite(options.dragThreshold()) ? Math.max(1, options.dragThreshold()) : 8
    if (phase.value === 'pending') {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < threshold) return
      if (pointerType !== 'mouse' && Math.abs(deltaY) >= Math.abs(deltaX)) {
        cancel()
        return
      }
      lockSnap()
      phase.value = 'dragging'
      options.viewport()?.setPointerCapture?.(event.pointerId)
    }
    if (phase.value !== 'dragging') return
    if (event.cancelable) event.preventDefault()
    suppressClick = true
    const elapsed = event.timeStamp - lastTime
    if (elapsed > 0 && elapsed <= 80) {
      const speed = Math.max(-2.5, Math.min(2.5, (event.clientX - lastX) / elapsed))
      velocity = velocitySamples === 0 ? speed : velocity * 0.25 + speed * 0.75
      velocitySamples += 1
    } else if (elapsed > 80) {
      velocity = 0
      velocitySamples = 0
    }
    lastX = event.clientX
    lastTime = event.timeStamp
    let position = startPosition - deltaX * direction()
    const [minimum, maximum] = options.limits()
    if (position < minimum) position = minimum + (position - minimum) * 0.35
    if (position > maximum) position = maximum + (position - maximum) * 0.35
    offset = (origin - position) * direction()
    if (frame !== undefined) return
    frame = requestAnimationFrame(() => {
      frame = undefined
      const track = options.track()
      if (!track || phase.value !== 'dragging') return
      track.style.willChange = 'transform'
      track.style.transform = `translate3d(${offset}px, 0, 0)`
      options.onPosition(origin - offset * direction())
    })
  }

  function finishPointer(event?: PointerEvent, cancelled = false) {
    if (pointerId === undefined || (event && pointerId !== event.pointerId)) return
    const wasDragging = phase.value === 'dragging'
    const heldAnimation = offset !== 0
    releasePointer()
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    if (!wasDragging && !heldAnimation) {
      phase.value = 'idle'
      unlockSnap()
      return
    }
    const position = origin - offset * direction()
    const releaseAge = event ? Math.max(0, event.timeStamp - lastTime) : 101
    const releaseVelocity = !cancelled && options.momentum() && releaseAge <= 100
      ? velocity * Math.exp(-releaseAge / 80) : 0
    const distance = position - startPosition
    const activationDistance = Math.min(80, Math.max(40, options.step() * 0.12))
    const momentum = velocitySamples >= 2 && Math.abs(distance) >= activationDistance
      ? projectCarouselMomentum(-releaseVelocity * direction(), options.step()) : 0
    let index = options.indexAt(position + momentum)
    const startIndex = options.indexAt(startPosition)
    const threshold = Math.max(1, options.dragThreshold())
    if (!cancelled && wasDragging && index === startIndex && Math.abs(distance) >= threshold) {
      index = startIndex + Math.sign(distance)
    }
    const target = options.target(index, position)
    options.onPosition(position)
    settle(options.indexAt(target), target, releaseVelocity)
    if (clickTimer !== undefined) clearTimeout(clickTimer)
    clickTimer = setTimeout(() => { suppressClick = false }, 0)
  }

  function handlePointerUp(event: PointerEvent) { finishPointer(event) }
  function handlePointerCancel(event: PointerEvent) { finishPointer(event, true) }
  function handleBlur() { finishPointer(undefined, true) }
  function handleLostPointerCapture(event: PointerEvent) {
    // Touch starts with implicit capture on the touched child. Its bubbled loss
    // when capture transfers to the viewport must not cancel the new drag.
    if (event.target === options.viewport() && pointerId === event.pointerId && phase.value === 'dragging') finishPointer(event, true)
  }
  function handleClick(event: MouseEvent) {
    if (!suppressClick || event.detail === 0) return
    event.preventDefault()
    event.stopPropagation()
    suppressClick = false
  }
  function handleWheel() {
    const interrupted = animation !== undefined || phase.value === 'dragging'
    const position = cancel()
    if (interrupted) options.onCommit(options.indexAt(position))
    if (!options.nativeSnap()) {
      wheelTimer = setTimeout(() => {
        wheelTimer = undefined
        if (disposed || phase.value !== 'idle') return
        origin = read()
        offset = 0
        const index = options.indexAt(origin)
        settle(index, options.target(index, origin), 0)
      }, 120)
    }
  }
  function handleDragStart(event: DragEvent) {
    if (pointerId !== undefined) event.preventDefault()
  }

  onBeforeUnmount(() => {
    cancel(false)
    disposed = true
    if (clickTimer !== undefined) clearTimeout(clickTimer)
    if (options.viewport()) options.viewport()!.style.scrollSnapType = previousSnap
  })

  return {
    phase, busy, dragging, transformed, read, write, cancel, commit, navigate, displayedPosition,
    handleScroll, handlePointerDown, handlePointerMove, handlePointerUp,
    handlePointerCancel, handleLostPointerCapture, handleClick, handleWheel, handleDragStart,
  }
}
