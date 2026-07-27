<script setup lang="ts">
import { computed, ref } from "vue";
import DynamicVirtualScroll from "../../src/components/DynamicVirtualScroll.vue";
import { feedItems } from "../data";

const pageSize = 20;
const requestDelay = 3_000;
const items = ref(feedItems.slice(0, pageSize));
const loading = ref(false);
const refreshing = ref(false);
const hasMore = computed(() => items.value.length < feedItems.length);

async function loadMore() {
  if (loading.value || !hasMore.value) return;

  loading.value = true;
  await new Promise((resolve) => window.setTimeout(resolve, requestDelay));

  const nextLength = Math.min(items.value.length + pageSize, feedItems.length);
  items.value = feedItems.slice(0, nextLength);
  loading.value = false;
}

async function refreshFeed() {
  if (refreshing.value) return;

  refreshing.value = true;
  await new Promise((resolve) => window.setTimeout(resolve, requestDelay));
  items.value = feedItems.slice(0, pageSize);
  refreshing.value = false;
}
</script>

<template>
  <section>
    <div class="heading">
      <div>
        <p class="eyebrow">Incremental data</p>
        <h1>Load More</h1>
        <p>
          Pull down at the top to refresh, or scroll near the end to append the
          next {{ pageSize }} Faker items.
        </p>
      </div>

      <div class="load-more-status" aria-live="polite">
        <strong>{{ items.length }} / {{ feedItems.length }}</strong>
        <span>{{
          loading ? "Loading…" : hasMore ? "Keep scrolling" : "All loaded"
        }}</span>
      </div>
    </div>

    <DynamicVirtualScroll
      :items="items"
      :estimated-item-size="420"
      :height="560"
      :overscan="2"
      item-key="id"
      :has-more="hasMore"
      :loading="loading"
      pull-to-refresh
      :refreshing="refreshing"
      :pull-refresh-threshold="72"
      :load-more-threshold="500"
      aria-label="Incrementally loaded community feed"
      @load-more="loadMore"
      @refresh="refreshFeed"
    >
      <template #default="{ item, index }">
        <article class="update-row">
          <!-- <span class="index">{{ index + 1 }}</span> -->
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

      <template #loading>
        <div class="inline-loader">
          <span aria-hidden="true" />
          Loading the next {{ pageSize }} items…
        </div>
      </template>

      <template #refresh="{ progress, refreshing: isRefreshing }">
        <div class="inline-loader">
          <span v-if="isRefreshing" aria-hidden="true" />
          {{
            isRefreshing
              ? "Refreshing feed…"
              : progress >= 1
                ? "Release to refresh"
                : "Pull to refresh"
          }}
        </div>
      </template>
    </DynamicVirtualScroll>
  </section>
</template>
