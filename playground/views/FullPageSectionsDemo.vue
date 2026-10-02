<script setup lang="ts">
import { ref } from 'vue'
import ShortMediaFeed from '../../src/components/ShortMediaFeed.vue'
import VirtualCarousel from '../../src/components/VirtualCarousel.vue'
import type {
  ShortMediaFeedExpose,
  VirtualCarouselExpose,
} from '../../src/types'

const feed = ref<ShortMediaFeedExpose>()
const carousel = ref<VirtualCarouselExpose>()
const activeIndex = ref(0)
const activeSlideIndex = ref(0)

const sections = [
  {
    id: 'intro',
    step: '01 / Discover',
    title: 'Small footprint.\nBig journeys.',
    description:
      'A full-page story built with the same virtualized viewport used by ShortMediaFeed.',
    action: 'Start exploring',
    tone: 'sunrise',
  },
  {
    id: 'focus',
    step: '02 / Focus',
    title: 'One clear idea\nat a time.',
    description:
      'Each section owns the viewport, while adjacent sections stay ready for a seamless transition.',
    action: 'See the flow',
    tone: 'midnight',
  },
  {
    id: 'scale',
    step: '03 / Scale',
    title: 'A tiny DOM,\neven at scale.',
    description:
      'Only the active section and its neighbors are mounted. The page can grow without growing the DOM.',
    action: 'Keep going',
    tone: 'forest',
  },
  {
    id: 'finish',
    step: '04 / Build',
    title: 'Your content.\nYour direction.',
    description:
      'Slots keep the layout completely yours; ShortMediaFeed handles snapping, keyboard input and state.',
    action: 'Back to the start',
    tone: 'paper',
  },
] as const

const featuredSlides = [
  {
    id: 'strategy',
    number: '01',
    label: 'Strategy',
    title: 'Start with one clear direction.',
    color: '#ff7657',
  },
  {
    id: 'prototype',
    number: '02',
    label: 'Prototype',
    title: 'Turn the idea into something tangible.',
    color: '#7777f4',
  },
  {
    id: 'measure',
    number: '03',
    label: 'Measure',
    title: 'Learn from every interaction.',
    color: '#27a77a',
  },
  {
    id: 'iterate',
    number: '04',
    label: 'Iterate',
    title: 'Refine the details that matter.',
    color: '#f1bd45',
  },
] as const

function goTo(index: number) {
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  feed.value?.scrollToIndex(index, {
    behavior: reduceMotion ? 'auto' : 'smooth',
  })
}

function goToNext(index: number) {
  goTo(index === sections.length - 1 ? 0 : index + 1)
}

function handleCarouselKeydown(event: KeyboardEvent) {
  if (
    ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(
      event.key,
    )
  ) {
    event.stopPropagation()
  }
}
</script>

<template>
  <div class="full-page-demo">
    <header class="full-page-demo__header">
      <RouterLink class="full-page-demo__brand" to="/dynamic">
        <span aria-hidden="true">V</span>
        Virtual Flow
      </RouterLink>

      <div class="full-page-demo__status" aria-live="polite">
        Section {{ activeIndex + 1 }} of {{ sections.length }}
      </div>
    </header>

    <ShortMediaFeed
      ref="feed"
      v-model:active-index="activeIndex"
      class="full-page-demo__feed"
      :items="sections"
      height="100dvh"
      :buffer="1"
      item-key="id"
      aria-label="Full-page product story"
    >
      <template #default="{ item, index, active }">
        <article
          :id="`full-page-${item.id}`"
          class="full-page-section"
          :class="[
            `full-page-section--${item.tone}`,
            { 'full-page-section--active': active },
          ]"
          :aria-labelledby="`full-page-title-${item.id}`"
        >
          <div
            v-if="index !== 0"
            class="full-page-section__orb"
            aria-hidden="true"
          >
            <span />
            <span />
            <span />
          </div>

          <div class="full-page-section__content">
            <p class="full-page-section__eyebrow">{{ item.step }}</p>
            <h1 :id="`full-page-title-${item.id}`">{{ item.title }}</h1>
            <p class="full-page-section__description">
              {{ item.description }}
            </p>
            <button type="button" @click="goToNext(index)">
              {{ item.action }}
              <span aria-hidden="true">↓</span>
            </button>
          </div>

          <div v-if="index === 0" class="full-page-section__carousel-shell">
            <div class="full-page-section__carousel-meta">
              <span>Featured process</span>
              <span>
                {{ String(activeSlideIndex + 1).padStart(2, '0') }} /
                {{ String(featuredSlides.length).padStart(2, '0') }}
              </span>
            </div>

            <VirtualCarousel
              ref="carousel"
              v-model:active-index="activeSlideIndex"
              class="full-page-section__carousel"
              :items="featuredSlides"
              :slides-per-view="1"
              :slides-to-scroll="1"
              :buffer="1"
              :gap="16"
              height="100%"
              item-key="id"
              aria-label="Featured process"
              @keydown="handleCarouselKeydown"
            >
              <template #default="{ item, active: slideActive }">
                <article
                  class="full-page-carousel-card"
                  :class="{ 'is-active': slideActive }"
                  :style="{ '--slide-color': item.color }"
                >
                  <span class="full-page-carousel-card__number">
                    {{ item.number }}
                  </span>
                  <div>
                    <p>{{ item.label }}</p>
                    <h2>{{ item.title }}</h2>
                  </div>
                </article>
              </template>
            </VirtualCarousel>

            <div class="full-page-section__carousel-actions">
              <button
                type="button"
                aria-label="Previous featured slide"
                @click="carousel?.previous()"
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Next featured slide"
                @click="carousel?.next()"
              >
                →
              </button>
            </div>
          </div>

          <p class="full-page-section__index" aria-hidden="true">
            {{ String(index + 1).padStart(2, '0') }}
          </p>
        </article>
      </template>
    </ShortMediaFeed>

    <nav class="full-page-demo__nav" aria-label="Full-page sections">
      <button
        v-for="(section, index) in sections"
        :key="section.id"
        type="button"
        :class="{ 'is-active': index === activeIndex }"
        :aria-label="`Go to section ${index + 1}: ${section.id}`"
        :aria-current="index === activeIndex ? 'step' : undefined"
        @click="goTo(index)"
      >
        <span />
      </button>
    </nav>

    <p class="full-page-demo__hint">
      Scroll, swipe or use arrow keys
    </p>
  </div>
</template>
