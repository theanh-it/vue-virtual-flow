// Pixels per millisecond squared. Projection is bounded by the virtual buffer.
const deceleration = 0.006

export function projectCarouselMomentum(velocity: number, itemStep: number) {
  const distance = velocity * Math.abs(velocity) / (2 * deceleration)
  const maximum = itemStep * 2
  return Math.max(-maximum, Math.min(maximum, distance))
}

export function createCarouselSettleMotion(
  startOffset: number,
  targetOffset: number,
  releaseVelocity: number,
  settleDuration = 250,
): { keyframes: Keyframe[]; options: KeyframeAnimationOptions } {
  const distance = targetOffset - startOffset
  const speed = Math.abs(releaseVelocity)
  const kinetic = speed >= 0.1 && distance * releaseVelocity > 0

  if (!kinetic) {
    return {
      keyframes: [
        { transform: `translate3d(${startOffset}px, 0, 0)` },
        { transform: `translate3d(${targetOffset}px, 0, 0)` },
      ],
      options: {
        duration: Math.round(
          Math.max(120, Math.min(650, (190 + Math.abs(distance) * 0.35) * settleDuration / 250)),
        ),
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      },
    }
  }

  const duration = Math.round(
    Math.max(180, Math.min(650, 2 * Math.abs(distance) / speed * settleDuration / 250)),
  )
  // Hermite motion starts with the release velocity and ends at rest. Limit
  // its initial slope to keep the curve monotonic, including near boundaries.
  const initialSlope = Math.min(3, speed * duration / Math.abs(distance))
  const steps = Math.ceil(duration / 8)
  const keyframes: Keyframe[] = Array.from({ length: steps + 1 }, (_, index) => {
    const time = index / steps
    const squared = time * time
    const cubed = squared * time
    const progress =
      initialSlope * (cubed - 2 * squared + time) +
      (-2 * cubed + 3 * squared)
    const offset = startOffset + distance * progress

    return {
      offset: time,
      transform: `translate3d(${offset}px, 0, 0)`,
    }
  })

  return {
    keyframes,
    options: { duration, easing: 'linear', fill: 'forwards' },
  }
}
