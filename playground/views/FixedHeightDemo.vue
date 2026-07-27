<script setup lang="ts">
import { ref } from 'vue'
import VirtualScroll from '../../src/components/VirtualScroll.vue'
import type { VirtualScrollExpose } from '../../src/types'

const list = ref<VirtualScrollExpose>()
const users = Array.from({ length: 10_000 }, (_, index) => ({
  id: index + 1,
  name: `Community member ${index + 1}`,
  email: `member${index + 1}@example.com`,
}))
</script>

<template>
  <section>
    <div class="heading">
      <div>
        <p class="eyebrow">Fixed-height rows</p>
        <h1>Virtual Scroll</h1>
        <p>Rendering 10,000 rows while keeping the DOM small.</p>
      </div>

      <button type="button" @click="list?.scrollToIndex(9_999)">
        Jump to the last row
      </button>
    </div>

    <VirtualScroll
      ref="list"
      :items="users"
      :item-size="64"
      :height="480"
      item-key="id"
      aria-label="Community members"
    >
      <template #default="{ item, index }">
        <article class="user-row">
          <span class="index">{{ index + 1 }}</span>
          <div>
            <strong>{{ item.name }}</strong>
            <small>{{ item.email }}</small>
          </div>
        </article>
      </template>
    </VirtualScroll>
  </section>
</template>
