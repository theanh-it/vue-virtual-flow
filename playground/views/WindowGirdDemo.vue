<script setup lang="ts">
import { ref } from 'vue'
import WindowGirdVirtualScroll from '../../src/components/WindowGirdVirtualScroll.vue'
import type { VirtualScrollExpose } from '../../src/types'
import { feedItems } from '../data'

const grid = ref<VirtualScrollExpose>()
const targetIndex = ref(1)
const columns = ref(3)

function scrollToItem() {
  const safeIndex = Math.min(
    feedItems.length - 1,
    Math.max(0, Math.floor(targetIndex.value) - 1),
  )

  targetIndex.value = safeIndex + 1
  grid.value?.scrollToIndex(safeIndex, {
    align: 'start',
    behavior: 'auto',
  })
}
</script>

<template>
  <section>
    <div class="heading dynamic-heading">
      <div>
        <p class="eyebrow">Window grid viewport</p>
        <h1>Window Grid Scroll</h1>
        <p>
          The page virtualizes 2,000 fixed-height cards by complete grid rows.
        </p>
      </div>

      <div class="window-grid-controls">
        <label class="column-control" for="window-grid-columns">
          Columns
          <select id="window-grid-columns" v-model.number="columns">
            <option :value="1">1</option>
            <option :value="2">2</option>
            <option :value="3">3</option>
            <option :value="4">4</option>
          </select>
        </label>

        <form class="scroll-control" @submit.prevent="scrollToItem">
          <label for="window-grid-target-index">Item index</label>
          <div>
            <input
              id="window-grid-target-index"
              v-model.number="targetIndex"
              type="number"
              min="1"
              :max="feedItems.length"
            />
            <button type="submit">Scroll</button>
          </div>
        </form>
      </div>
    </div>

    <WindowGirdVirtualScroll
      ref="grid"
      :items="feedItems"
      :item-size="280"
      :columns="columns"
      :gap="12"
      :overscan="1"
      item-key="id"
      aria-label="Window-scrolled card grid"
    >
      <template #default="{ item, index, rowIndex, columnIndex }">
        <article class="window-grid-card">
          <img
            :src="item.image"
            :alt="item.title"
            width="320"
            height="150"
            loading="lazy"
          />
          <div>
            <small>
              #{{ index + 1 }} · Row {{ rowIndex + 1 }} · Column
              {{ columnIndex + 1 }}
            </small>
            <h3>{{ item.title }}</h3>
          </div>
        </article>
      </template>
    </WindowGirdVirtualScroll>
  </section>
</template>
