import { describe, expect, it } from 'vitest'
import {
  createCarouselSettleMotion,
  projectCarouselMomentum,
} from '../src/utils/carouselMotion'

function position(frame: Keyframe) {
  return Number(String(frame.transform).match(/translate3d\(([-\d.e+]+)px/)?.[1])
}

describe('carousel release motion', () => {
  it('projects faster swipes farther with a two-slide limit', () => {
    expect(projectCarouselMomentum(2, 320)).toBeGreaterThan(
      projectCarouselMomentum(1, 320),
    )
    expect(projectCarouselMomentum(10, 320)).toBe(640)
    expect(projectCarouselMomentum(-10, 320)).toBe(-640)
  })

  it.each([1, -1])('continues release velocity and decelerates to rest (direction %s)', (direction) => {
    const motion = createCarouselSettleMotion(0, direction * 320, direction * 2)
    const positions = motion.keyframes.map(position)
    const duration = Number(motion.options.duration)
    const interval = duration / (positions.length - 1)
    const speeds = positions.slice(1).map((value, index) =>
      direction * (value - positions[index]) / interval,
    )

    expect(speeds[0]).toBeCloseTo(2, 1)
    expect(speeds.at(-1)).toBeLessThan(0.1)
    for (let index = 1; index < speeds.length; index += 1) {
      expect(speeds[index]).toBeGreaterThanOrEqual(0)
      expect(speeds[index]).toBeLessThanOrEqual(speeds[index - 1])
    }
    expect(positions.at(-1)).toBe(direction * 320)
  })

  it('does not overshoot a nearby boundary even with a high release speed', () => {
    const motion = createCarouselSettleMotion(-300, -320, -2.5)
    for (const frame of motion.keyframes) {
      expect(position(frame)).toBeGreaterThanOrEqual(-320)
      expect(position(frame)).toBeLessThanOrEqual(-300)
    }
  })

  it.each([0, 1])('uses normal settling for a stopped or outward release (%s)', (velocity) => {
    const motion = createCarouselSettleMotion(30, 0, velocity)
    expect(motion.options.easing).toBe('cubic-bezier(0.22, 1, 0.36, 1)')
    expect(position(motion.keyframes.at(-1)!)).toBe(0)
  })
})
