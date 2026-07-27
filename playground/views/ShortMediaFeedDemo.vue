<script setup lang="ts">
import { faker } from '@faker-js/faker/locale/vi'
import { computed, ref } from 'vue'
import ShortMediaFeed from '../../src/components/ShortMediaFeed.vue'

const totalItems = 10_000
const pageSize = 20
const activeIndex = ref(0)
const loading = ref(false)

faker.seed(20260728)

function createMediaItems(count: number) {
  return Array.from({ length: count }, () => ({
    id: faker.string.uuid(),
    title: faker.lorem.sentence({ min: 3, max: 7 }),
    author: faker.person.fullName(),
    description: faker.lorem.sentence({ min: 5, max: 12 }),
    hue: faker.number.int({ min: 0, max: 359 }),
  }))
}

const mediaItems = ref(createMediaItems(pageSize))
const hasMore = computed(() => mediaItems.value.length < totalItems)

async function loadMore() {
  if (loading.value || !hasMore.value) return

  loading.value = true
  await new Promise((resolve) => setTimeout(resolve, 3_000))
  mediaItems.value.push(...createMediaItems(pageSize))
  loading.value = false
}
</script>

<template>
  <section>
    <div class="heading">
      <div>
        <p class="eyebrow">Full-screen snap feed</p>
        <h1>Short Media Feed</h1>
        <p>
          Item {{ activeIndex + 1 }} of {{ mediaItems.length }} loaded. Only
          the active item and its neighbors are mounted.
          {{ loading ? 'Loading the next page…' : '' }}
        </p>
      </div>
    </div>

    <ShortMediaFeed
      v-model:active-index="activeIndex"
      class="short-media-demo"
      :items="mediaItems"
      :height="600"
      :buffer="1"
      item-key="id"
      aria-label="Short media demo"
      :has-more="hasMore"
      :loading="loading"
      :load-more-threshold="3"
      @load-more="loadMore"
    >
      <template #default="{ item, index, active }">
        <article
          class="short-media-card"
          :style="{
            background: `linear-gradient(145deg, hsl(${item.hue} 72% 48%), hsl(${(item.hue + 55) % 360} 78% 20%))`,
          }"
        >
          <span>{{ active ? 'Active' : 'Buffered' }}</span>
          <strong>{{ item.title }}</strong>
          <small>{{ item.author }} · Index {{ index }}</small>
          <p>{{ item.description }}</p>
        </article>
      </template>
    </ShortMediaFeed>
  </section>
</template>
