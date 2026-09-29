<script setup lang="ts">
import { computed } from 'vue'
import type { SkeletonLoaderProps } from '../types'

const props = withDefaults(defineProps<SkeletonLoaderProps>(), {
  width: '100%',
  height: 16,
  variant: 'rounded',
  animated: true,
  ariaLabel: 'Loading…',
})

function toCssSize(value: number | string): string {
  return typeof value === 'number' ? `${Math.max(0, value)}px` : value
}

const style = computed(() => ({
  width: toCssSize(props.width),
  height: toCssSize(props.height),
}))
</script>

<template>
  <div
    class="vue-skeleton-loader"
    :class="[
      `vue-skeleton-loader--${variant}`,
      { 'vue-skeleton-loader--animated': animated },
    ]"
    :style="style"
    role="status"
    :aria-label="ariaLabel"
  />
</template>

<style scoped>
.vue-skeleton-loader {
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
  box-sizing: border-box;
  background: var(--skeleton-background, #e2e8f0);
}

.vue-skeleton-loader--rounded {
  border-radius: var(--skeleton-radius, 8px);
}

.vue-skeleton-loader--circle {
  border-radius: 50%;
}

.vue-skeleton-loader--animated::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    var(--skeleton-highlight, rgb(255 255 255 / 60%)),
    transparent
  );
  transform: translateX(-100%);
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  content: '';
}

@keyframes skeleton-shimmer {
  to {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .vue-skeleton-loader--animated::after {
    animation: none;
    content: none;
  }
}
</style>
