<script setup lang="ts">
import { faker } from '@faker-js/faker/locale/vi'
import { computed, ref } from 'vue'
import VirtualCarousel from '../../src/components/VirtualCarousel.vue'
import type { VirtualCarouselExpose } from '../../src/types'

const totalItems = 200
const pageSize = 20
const carousel = ref<VirtualCarouselExpose>()
const activeIndex = ref(0)
const slidesPerView = ref(3)
const gap = ref(16)
const loading = ref(false)
const autoplay = ref(false)
const autoplayDelay = ref(3000)
const autoplayLoop = ref(true)
const pauseOnHover = ref(true)
const mouseDrag = ref(true)
const momentum = ref(true)
const dragThreshold = ref(8)
const settleDuration = ref(250)
const nativeSnap = ref(true)
const autoWidth = ref(false)
const rtl = ref(false)
const loop = ref(false)
const keepAlive = ref(false)
const maxCachedItems = ref(20)
const selectedSlide = ref<number>()

faker.seed(20260729)

function createSlides(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: faker.string.uuid(),
    title: faker.commerce.productName(),
    author: faker.person.fullName(),
    description: faker.commerce.productDescription(),
    hue: faker.number.int({ min: 0, max: 359 }),
    width: 220 + (index % 3) * 90,
  }))
}

const slides = ref(createSlides(pageSize))
const hasMore = computed(() => slides.value.length < totalItems)

async function loadMore() {
  if (loading.value || !hasMore.value) return

  loading.value = true
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  slides.value.push(...createSlides(pageSize))
  loading.value = false
}
</script>

<template>
  <section>
    <div class="heading carousel-heading">
      <div>
        <p class="eyebrow">Horizontal virtualized slides</p>
        <h1>Virtual Carousel</h1>
        <p>
          Showing from slide {{ activeIndex + 1 }}. {{ slides.length }} items
          loaded.
        </p>
      </div>

      <div class="carousel-settings">
        <label>
          Items
          <input v-model.number="slidesPerView" type="number" min="1" max="6" />
        </label>
        <label>
          Gap
          <input v-model.number="gap" type="number" min="0" max="48" />
        </label>
        <label>
          <input v-model="mouseDrag" type="checkbox" />
          Mouse Drag
        </label>
        <label>
          <input v-model="autoplay" type="checkbox" />
          Autoplay
        </label>
        <label v-if="autoplay">
          Delay (ms)
          <input v-model.number="autoplayDelay" type="number" min="1000" max="10000" step="500" />
        </label>
        <label v-if="autoplay">
          <input v-model="autoplayLoop" type="checkbox" />
          Loop
        </label>
        <label v-if="autoplay">
          <input v-model="pauseOnHover" type="checkbox" />
          Pause on Hover
        </label>
      </div>
    </div>

    <details class="carousel-options">
      <summary>Advanced options</summary>
      <div class="carousel-settings">
        <label><input v-model="momentum" type="checkbox" />Momentum</label>
        <label>Drag threshold (px)<input v-model.number="dragThreshold" type="number" min="1" max="50" /></label>
        <label>Settle duration (ms)<input v-model.number="settleDuration" type="number" min="0" max="1000" /></label>
        <label><input v-model="nativeSnap" type="checkbox" />Native snap</label>
        <label><input v-model="autoWidth" type="checkbox" />Auto width</label>
        <label><input v-model="rtl" type="checkbox" />RTL</label>
        <label><input v-model="loop" type="checkbox" />Continuous loop</label>
        <label><input v-model="keepAlive" type="checkbox" />Keep slide state</label>
        <label>Cache budget<input v-model.number="maxCachedItems" type="number" min="0" max="100" /></label>
      </div>
    </details>

    <VirtualCarousel
      ref="carousel"
      v-model:active-index="activeIndex"
      :items="slides"
      :slides-per-view="slidesPerView"
      :slides-to-scroll="1"
      :gap="gap"
      :buffer="2"
      :height="300"
      item-key="id"
      aria-label="Product carousel demo"
      :has-more="hasMore && !loop"
      :loading="loading"
      :load-more-threshold="3"
      :autoplay="autoplay"
      :autoplay-delay="autoplayDelay"
      :autoplay-loop="autoplayLoop"
      :pause-on-hover="pauseOnHover"
      :mouse-drag="mouseDrag"
      :momentum="momentum"
      :drag-threshold="dragThreshold"
      :settle-duration="settleDuration"
      :native-snap="nativeSnap"
      :auto-width="autoWidth"
      :rtl="rtl"
      :loop="loop"
      :keep-alive="keepAlive"
      :max-cached-items="maxCachedItems"
      @load-more="loadMore"
    >
      <template #default="{ item, index, active, inViewport }">
        <article
          class="carousel-card"
          :class="{ 'carousel-card--active': active }"
          :data-in-viewport="inViewport"
          :style="{
            width: autoWidth ? `${item.width}px` : undefined,
            background: `linear-gradient(145deg, hsl(${item.hue} 72% 54%), hsl(${(item.hue + 45) % 360} 68% 28%))`,
          }"
        >
          <span>{{ inViewport ? 'Visible' : 'Buffered' }}</span>
          <strong>{{ item.title }}</strong>
          <small>{{ item.author }}</small>
          <p>{{ item.description }}</p>
          <input :aria-label="`Note for slide ${index + 1}`" placeholder="Write a note to test retained state" />
          <button type="button" @click="selectedSlide = index">Select slide {{ index + 1 }}</button>
          <button v-if="autoWidth" type="button" @click="item.width += 60">Grow slide {{ index + 1 }}</button>
        </article>
      </template>
    </VirtualCarousel>

    <div class="carousel-actions">
      <button type="button" @click="carousel?.previous()">Previous</button>
      <span>{{ loading ? 'Loading 20 more…' : `Active ${activeIndex + 1}` }}</span>
      <button type="button" @click="carousel?.next()">Next</button>
      <button v-if="autoplay" type="button" @click="carousel?.stopAutoplay()">Stop</button>
      <button v-if="autoplay" type="button" @click="carousel?.startAutoplay()">Start</button>
    </div>
    <p v-if="selectedSlide !== undefined">Selected slide {{ selectedSlide + 1 }}</p>
  </section>
</template>
