<script setup lang="ts">
import { ref } from 'vue'
import { VirtualList } from '../../src'
import type { VirtualScrollExpose } from '../../src/types'
import { feedItems } from '../data'

const dynamicList = ref<VirtualScrollExpose>()
const targetIndex = ref(1)

function scrollToFeedItem() {
  const safeIndex = Math.min(
    feedItems.length - 1,
    Math.max(0, Math.floor(targetIndex.value) - 1),
  )

  targetIndex.value = safeIndex + 1
  dynamicList.value?.scrollToIndex(safeIndex, {
    align: 'start',
    behavior: 'auto',
  })
}
</script>

<template>
  <section>
    <div class="heading dynamic-heading">
      <div>
        <p class="eyebrow">Variable-height rows</p>
        <h1>Dynamic Virtual Scroll</h1>
        <p>Rendering 2,000 Faker items with independently measured heights.</p>
      </div>

      <form class="scroll-control" @submit.prevent="scrollToFeedItem">
        <label for="target-index">Item index</label>
        <div>
          <input
            id="target-index"
            v-model.number="targetIndex"
            type="number"
            min="1"
            :max="feedItems.length"
          />
          <button type="submit">Scroll to item</button>
        </div>
      </form>
    </div>

    <VirtualList
      ref="dynamicList"
      :items="feedItems"
      :estimated-item-size="420"
      :overscan="2"
      aria-label="Generated community feed"
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
    </VirtualList>
  </section>
</template>
