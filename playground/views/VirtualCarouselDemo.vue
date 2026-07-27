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

faker.seed(20260729)

function createSlides(count: number) {
  return Array.from({ length: count }, () => ({
    id: faker.string.uuid(),
    title: faker.commerce.productName(),
    author: faker.person.fullName(),
    description: faker.commerce.productDescription(),
    hue: faker.number.int({ min: 0, max: 359 }),
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
      </div>
    </div>

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
      :has-more="hasMore"
      :loading="loading"
      :load-more-threshold="3"
      @load-more="loadMore"
    >
      <template #default="{ item, active, visible }">
        <article
          class="carousel-card"
          :class="{ 'carousel-card--active': active }"
          :style="{
            background: `linear-gradient(145deg, hsl(${item.hue} 72% 54%), hsl(${(item.hue + 45) % 360} 68% 28%))`,
          }"
        >
          <span>{{ visible ? 'Visible' : 'Buffered' }}</span>
          <strong>{{ item.title }}</strong>
          <small>{{ item.author }}</small>
          <p>{{ item.description }}</p>
        </article>
      </template>
    </VirtualCarousel>

    <div class="carousel-actions">
      <button type="button" @click="carousel?.previous()">Previous</button>
      <span>{{ loading ? 'Loading 20 more…' : `Active ${activeIndex + 1}` }}</span>
      <button type="button" @click="carousel?.next()">Next</button>
    </div>
  </section>
</template>
