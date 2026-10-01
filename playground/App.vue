<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const immersive = computed(() => route.meta.immersive === true)
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--immersive': immersive }">
    <header v-if="!immersive" class="app-header">
      <RouterLink class="brand" to="/dynamic">Vue Virtual Scroll</RouterLink>

      <nav aria-label="Playground demos">
        <RouterLink to="/fixed">Fixed height</RouterLink>
        <RouterLink to="/dynamic">Dynamic height</RouterLink>
        <RouterLink to="/window-dynamic">Window</RouterLink>
        <RouterLink to="/window-grid">Grid</RouterLink>
        <RouterLink to="/chat">Chat</RouterLink>
        <RouterLink to="/load-more">Load more</RouterLink>
        <RouterLink to="/short-media">Short media</RouterLink>
        <RouterLink to="/full-page">Full page</RouterLink>
        <RouterLink to="/carousel">Carousel</RouterLink>
        <RouterLink to="/responsive-carousel">Responsive</RouterLink>
      </nav>
    </header>

    <main :class="{ 'app-main--immersive': immersive }">
      <RouterView />
    </main>
  </div>
</template>
