<script setup lang="ts">
import { ref } from 'vue'
import WindowDynamicVirtualScroll from '../../src/components/WindowDynamicVirtualScroll.vue'
import type { VirtualScrollExpose } from '../../src/types'
import { feedItems } from '../data'

const list = ref<VirtualScrollExpose>()
const targetIndex = ref(1)

function scrollToItem() {
  const safeIndex = Math.min(
    feedItems.length - 1,
    Math.max(0, Math.floor(targetIndex.value) - 1),
  )

  targetIndex.value = safeIndex + 1
  list.value?.scrollToIndex(safeIndex, {
    align: 'start',
    behavior: 'auto',
  })
}
</script>

<template>
  <section>
    <div class="heading dynamic-heading">
      <div>
        <p class="eyebrow">Window viewport</p>
        <h1>Window Dynamic Scroll</h1>
        <p>
          The page window virtualizes 2,000 variable-height Faker items.
        </p>
      </div>

      <form class="scroll-control" @submit.prevent="scrollToItem">
        <label for="window-target-index">Item index</label>
        <div>
          <input
            id="window-target-index"
            v-model.number="targetIndex"
            type="number"
            min="1"
            :max="feedItems.length"
          />
          <button type="submit">Scroll to item</button>
        </div>
      </form>
    </div>

    <WindowDynamicVirtualScroll
      ref="list"
      :items="feedItems"
      :estimated-item-size="420"
      :overscan="3"
      item-key="id"
      aria-label="Window-scrolled community feed"
    >
      <template #default="{ item, index }">
        <article class="update-row">
          <span class="index">{{ index + 1 }}</span>
          <div>
            <h3>{{ item.title }}</h3>
            <img
              :src="item.image"
              :alt="item.title"
              width="720"
              loading="lazy"
            />
            <p>{{ item.description }}</p>
          </div>
        </article>
      </template>
    </WindowDynamicVirtualScroll>
  </section>
</template>
