<template>
  <div class="app-shell">
    <header class="app-header">
      <RouterLink class="brand" to="/dynamic">Vue Virtual Scroll</RouterLink>

      <nav aria-label="Playground demos">
        <RouterLink to="/fixed">Fixed height</RouterLink>
        <RouterLink to="/dynamic">Dynamic height</RouterLink>
        <RouterLink to="/window-dynamic">Window</RouterLink>
        <RouterLink to="/chat">Chat</RouterLink>
        <RouterLink to="/load-more">Load more</RouterLink>
        <RouterLink to="/short-media">Short media</RouterLink>
        <RouterLink to="/carousel">Carousel</RouterLink>
        <RouterLink to="/responsive-carousel">Responsive</RouterLink>
      </nav>
    </header>

    <main>
      <RouterView />
    </main>
  </div>
</template>
