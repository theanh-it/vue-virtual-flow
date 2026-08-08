<script setup lang="ts">
import { faker } from '@faker-js/faker/locale/vi'
import { computed, ref } from 'vue'
import VirtualCarousel from '../../src/components/VirtualCarousel.vue'
import type { VirtualCarouselExpose } from '../../src/types'

const totalItems = 200
const pageSize = 20
const carousel = ref<VirtualCarouselExpose>()
const activeIndex = ref(0)
const loading = ref(false)
const viewportWidth = ref(0)

faker.seed(20260808)

function createSlides(count: number) {
  return Array.from({ length: count }, () => ({
    id: faker.string.uuid(),
    title: faker.commerce.productName(),
    price: Number(faker.commerce.price({ min: 100, max: 9999, dec: 0 })),
    category: faker.commerce.department(),
    hue: faker.number.int({ min: 0, max: 359 }),
  }))
}

const slides = ref(createSlides(pageSize))
const hasMore = computed(() => slides.value.length < totalItems)

// Responsive breakpoints configuration
const responsiveBreakpoints = [
  {
    breakpoint: 1280, // Desktop large
    slidesPerView: 5,
    slidesToScroll: 3,
    gap: 24,
  },
  {
    breakpoint: 1024, // Desktop
    slidesPerView: 4,
    slidesToScroll: 2,
    gap: 20,
  },
  {
    breakpoint: 768, // Tablet
    slidesPerView: 3,
    slidesToScroll: 2,
    gap: 16,
  },
  {
    breakpoint: 640, // Mobile large
    slidesPerView: 2,
    slidesToScroll: 1,
    gap: 12,
  },
]

const currentBreakpoint = computed(() => {
  const sorted = [...responsiveBreakpoints].sort((a, b) => b.breakpoint - a.breakpoint)
  for (const config of sorted) {
    if (viewportWidth.value >= config.breakpoint) {
      return config
    }
  }
  return { slidesPerView: 1, slidesToScroll: 1, gap: 8, breakpoint: 0 }
})

async function loadMore() {
  if (loading.value || !hasMore.value) return

  loading.value = true
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  slides.value.push(...createSlides(pageSize))
  loading.value = false
}

function updateViewportWidth() {
  viewportWidth.value = window.innerWidth
}

// Update viewport width on mount and resize
if (typeof window !== 'undefined') {
  updateViewportWidth()
  window.addEventListener('resize', updateViewportWidth)
}
</script>

<template>
  <section>
    <div class="heading">
      <div>
        <p class="eyebrow">Responsive carousel with breakpoints</p>
        <h1>Responsive Virtual Carousel</h1>
        <p>
          Showing from slide {{ activeIndex + 1 }}. {{ slides.length }} items loaded.
          Current viewport: {{ viewportWidth }}px
        </p>
      </div>
    </div>

    <div class="responsive-info">
      <h3>📱 Responsive Configuration</h3>
      <div class="breakpoints-grid">
        <div 
          v-for="bp in responsiveBreakpoints" 
          :key="bp.breakpoint"
          class="breakpoint-card"
          :class="{ active: viewportWidth >= bp.breakpoint && viewportWidth < (responsiveBreakpoints.find(b => b.breakpoint > bp.breakpoint)?.breakpoint || Infinity) }"
        >
          <strong>≥ {{ bp.breakpoint }}px</strong>
          <div class="breakpoint-details">
            <span>Slides: {{ bp.slidesPerView }}</span>
            <span>Scroll: {{ bp.slidesToScroll }}</span>
            <span>Gap: {{ bp.gap }}px</span>
          </div>
        </div>
        <div 
          class="breakpoint-card"
          :class="{ active: viewportWidth < 640 }"
        >
          <strong>&lt; 640px (Mobile)</strong>
          <div class="breakpoint-details">
            <span>Slides: 1</span>
            <span>Scroll: 1</span>
            <span>Gap: 8px</span>
          </div>
        </div>
      </div>
      
      <div class="current-config">
        <strong>🎯 Current Active Config:</strong>
        <span>
          {{ currentBreakpoint.slidesPerView }} slides per view, 
          {{ currentBreakpoint.slidesToScroll }} slides to scroll, 
          {{ currentBreakpoint.gap }}px gap
        </span>
      </div>
    </div>

    <VirtualCarousel
      ref="carousel"
      v-model:active-index="activeIndex"
      :items="slides"
      :slides-per-view="1"
      :slides-to-scroll="1"
      :gap="8"
      :buffer="2"
      :height="280"
      item-key="id"
      aria-label="Responsive product carousel"
      :has-more="hasMore"
      :loading="loading"
      :load-more-threshold="3"
      :responsive="responsiveBreakpoints"
      @load-more="loadMore"
    >
      <template #default="{ item, active }">
        <article
          class="product-card"
          :class="{ 'product-card--active': active }"
          :style="{
            background: `linear-gradient(135deg, hsl(${item.hue} 70% 55%), hsl(${(item.hue + 30) % 360} 65% 45%))`,
          }"
        >
          <div class="product-card__badge">
            <span>{{ item.category }}</span>
          </div>
          <div class="product-card__content">
            <h3>{{ item.title }}</h3>
            <p class="product-card__price">{{ item.price.toLocaleString('vi-VN') }}đ</p>
          </div>
        </article>
      </template>
    </VirtualCarousel>

    <div class="carousel-actions">
      <button type="button" @click="carousel?.previous()">
        ← Previous
      </button>
      <span>
        {{ loading ? 'Loading 20 more…' : `Slide ${activeIndex + 1} / ${slides.length}` }}
      </span>
      <button type="button" @click="carousel?.next()">
        Next →
      </button>
    </div>

    <div class="demo-instructions">
      <h3>💡 How to Test</h3>
      <ol>
        <li><strong>Resize your browser window</strong> to see the carousel adapt to different screen sizes</li>
        <li><strong>Mobile (&lt;640px):</strong> Shows 1 slide at a time with 8px gap</li>
        <li><strong>Mobile Large (≥640px):</strong> Shows 2 slides with 12px gap</li>
        <li><strong>Tablet (≥768px):</strong> Shows 3 slides with 16px gap</li>
        <li><strong>Desktop (≥1024px):</strong> Shows 4 slides with 20px gap</li>
        <li><strong>Desktop Large (≥1280px):</strong> Shows 5 slides with 24px gap</li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.responsive-info {
  margin: 2rem 0;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 12px;
  border: 2px solid #e9ecef;
}

.responsive-info h3 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  color: #212529;
}

.breakpoints-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.breakpoint-card {
  padding: 1rem;
  background: white;
  border-radius: 8px;
  border: 2px solid #dee2e6;
  transition: all 0.3s ease;
}

.breakpoint-card.active {
  border-color: #0d6efd;
  background: #e7f1ff;
  box-shadow: 0 4px 12px rgba(13, 110, 253, 0.15);
  transform: translateY(-2px);
}

.breakpoint-card strong {
  display: block;
  font-size: 1rem;
  color: #495057;
  margin-bottom: 0.5rem;
}

.breakpoint-card.active strong {
  color: #0d6efd;
}

.breakpoint-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: #6c757d;
}

.current-config {
  padding: 1rem;
  background: white;
  border-radius: 8px;
  border: 2px solid #0d6efd;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.current-config strong {
  color: #0d6efd;
  font-size: 1rem;
}

.current-config span {
  color: #495057;
  font-size: 0.95rem;
}

.product-card {
  height: 100%;
  border-radius: 12px;
  padding: 1.5rem;
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.product-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.product-card--active {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  transform: scale(1.02);
}

.product-card__badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(10px);
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.product-card__content h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.3;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.product-card__price {
  margin: 0.5rem 0 0 0;
  font-size: 1.5rem;
  font-weight: 800;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.carousel-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
}

.carousel-actions button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  background: #0d6efd;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.carousel-actions button:hover {
  background: #0b5ed7;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
}

.carousel-actions button:active {
  transform: translateY(0);
}

.carousel-actions span {
  font-weight: 600;
  color: #495057;
}

.demo-instructions {
  margin-top: 3rem;
  padding: 1.5rem;
  background: #fff3cd;
  border-radius: 12px;
  border: 2px solid #ffc107;
}

.demo-instructions h3 {
  margin: 0 0 1rem 0;
  color: #664d03;
}

.demo-instructions ol {
  margin: 0;
  padding-left: 1.5rem;
  color: #664d03;
}

.demo-instructions li {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}

.demo-instructions strong {
  color: #995c00;
}
</style>
