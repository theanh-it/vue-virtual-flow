import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dynamic',
    },
    {
      path: '/fixed',
      name: 'fixed-height',
      component: () => import('./views/FixedHeightDemo.vue'),
    },
    {
      path: '/dynamic',
      name: 'dynamic-height',
      component: () => import('./views/DynamicHeightDemo.vue'),
    },
    {
      path: '/load-more',
      name: 'load-more',
      component: () => import('./views/LoadMoreDemo.vue'),
    },
    {
      path: '/window-dynamic',
      name: 'window-dynamic',
      component: () => import('./views/WindowDynamicDemo.vue'),
    },
    {
      path: '/window-grid',
      name: 'window-grid',
      component: () => import('./views/WindowGirdDemo.vue'),
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('./views/ChatDemo.vue'),
    },
    {
      path: '/short-media',
      name: 'short-media',
      component: () => import('./views/ShortMediaFeedDemo.vue'),
    },
    {
      path: '/carousel',
      name: 'carousel',
      component: () => import('./views/VirtualCarouselDemo.vue'),
    },
    {
      path: '/responsive-carousel',
      name: 'responsive-carousel',
      component: () => import('./views/ResponsiveCarouselDemo.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dynamic',
    },
  ],
})
