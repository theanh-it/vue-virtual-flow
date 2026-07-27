# vue-virtual-flow

[English](./README.md) | [Tiếng Việt](./README.vi.md)

A small, typed, and accessible collection of virtual scrolling components for
Vue 3. It covers fixed and variable-height lists, window scrolling, chat,
short-media feeds, and horizontal carousels.

Only the items needed for the current viewport are mounted, keeping large data
sets responsive without prescribing how an item should look.

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Choose a component](#choose-a-component)
- [Component guides](#component-guides)
  - [VirtualList and DynamicVirtualScroll](#virtuallist-and-dynamicvirtualscroll)
  - [VirtualScroll](#virtualscroll)
  - [WindowDynamicVirtualScroll](#windowdynamicvirtualscroll)
  - [ChatVirtualScroll](#chatvirtualscroll)
  - [ShortMediaFeed](#shortmediafeed)
  - [VirtualCarousel](#virtualcarousel)
- [Shared recipes](#shared-recipes)
  - [Viewport height](#viewport-height)
  - [Stable item keys](#stable-item-keys)
  - [Load more](#load-more)
  - [Pull to refresh](#pull-to-refresh)
- [TypeScript exports](#typescript-exports)
- [Development and release](#development-and-release)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install vue-virtual-flow
```

Import the library stylesheet once in your application entry point:

```ts
import 'vue-virtual-flow/style.css'
```

The package requires Vue `^3.4.0` and Node.js `>=18`.

## Quick start

Import components locally:

```vue
<script setup lang="ts">
import { VirtualList } from 'vue-virtual-flow'
import 'vue-virtual-flow/style.css'

const users = Array.from({ length: 10_000 }, (_, id) => ({
  id,
  name: `User ${id + 1}`,
}))
</script>

<template>
  <VirtualList :items="users" item-key="id">
    <template #default="{ item, index }">
      <div>{{ index + 1 }}. {{ item.name }}</div>
    </template>

    <template #empty>No users found.</template>
  </VirtualList>
</template>
```

Or install every component globally:

```ts
import { createApp } from 'vue'
import VueVirtualScroll from 'vue-virtual-flow'
import 'vue-virtual-flow/style.css'
import App from './App.vue'

createApp(App).use(VueVirtualScroll).mount('#app')
```

The plugin registers `VirtualList`, `DynamicVirtualScroll`, `VirtualScroll`,
`WindowDynamicVirtualScroll`, `ChatVirtualScroll`, `ShortMediaFeed`, and
`VirtualCarousel`.

## Choose a component

| Component | Use it when | Scroll viewport | Item size |
| --- | --- | --- | --- |
| `VirtualList` | You want the simplest general-purpose list. | Component container | Variable, measured automatically |
| `DynamicVirtualScroll` | Same behavior as `VirtualList`, with an explicit name. | Component container | Variable, measured automatically |
| `VirtualScroll` | Every row has the same known height. | Component container | Fixed |
| `WindowDynamicVirtualScroll` | The page itself should scroll instead of a nested container. | Browser window | Variable, measured automatically |
| `ChatVirtualScroll` | Messages are appended at the bottom and older history is prepended. | Component container | Variable, measured automatically |
| `ShortMediaFeed` | One full-height item should snap into view at a time. | Component container | One viewport per item |
| `VirtualCarousel` | Several horizontal slides should snap and virtualize. | Component container | Calculated from container width |

## Component guides

### VirtualList and DynamicVirtualScroll

`VirtualList` is an alias of `DynamicVirtualScroll`. Both names render the same
component and share the same API. Use it for cards, search results, activity
feeds, or any list whose rows can have different heights.

Rows initially use `estimatedItemSize`. `ResizeObserver` then replaces each
estimate with the measured height. Measurement changes above the viewport are
compensated to avoid visible jumps.

#### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  VirtualList,
  type VirtualScrollEvent,
  type VirtualListExpose,
} from 'vue-virtual-flow'

const list = ref<VirtualListExpose>()
const posts = ref([
  { id: 'p1', title: 'Short post', body: 'One line.' },
  {
    id: 'p2',
    title: 'Long post',
    body: 'Content that wraps and gives this row a different height.',
  },
])

function onScroll(event: VirtualScrollEvent) {
  console.log(event.scrollTop, event.startIndex, event.endIndex)
}
</script>

<template>
  <VirtualList
    ref="list"
    :items="posts"
    :estimated-item-size="96"
    :height="500"
    :overscan="4"
    item-key="id"
    aria-label="Posts"
    @scroll="onScroll"
  >
    <template #default="{ item, index }">
      <article>
        <small>#{{ index + 1 }}</small>
        <h2>{{ item.title }}</h2>
        <p>{{ item.body }}</p>
      </article>
    </template>

    <template #empty>No posts yet.</template>
  </VirtualList>

  <button @click="list?.scrollToIndex(1, { align: 'center' })">
    Go to the second post
  </button>
</template>
```

Choose an estimate close to the average rendered row height. Rows do not need
to match it; a good estimate mainly improves the initial scrollbar and jumps
to items that have not been measured.

#### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | required | Data passed to the default slot. |
| `estimatedItemSize` | `number` | `48` | Initial average row height in pixels. |
| `height` | `number \| string` | `400` | Viewport height. A number is pixels; `"fill"` maps to `100%`. |
| `overscan` | `number` | `3` | Extra rows mounted before and after the visible range. |
| `itemKey` | `keyof T \| (item, index) => PropertyKey` | `id`, `key`, or index | Stable identity used for keys and measurements. |
| `ariaLabel` | `string` | `"Dynamic virtual list"` | Accessible label for the list. |
| `hasMore` | `boolean` | `false` | Indicates that another page can be loaded. |
| `loading` | `boolean` | `false` | Prevents duplicate requests and shows the loading row. |
| `loadingItemSize` | `number` | `estimatedItemSize` | Reserved loading-row height in pixels. |
| `loadMoreThreshold` | `number` | `200` | Distance from the end, in pixels, that triggers `load-more`. |
| `pullToRefresh` | `boolean` | `false` | Enables the touch pull-down gesture at the top. |
| `refreshing` | `boolean` | `false` | Keeps the refresh indicator open during async work. |
| `pullRefreshThreshold` | `number` | `64` | Pull distance required to emit `refresh`, in pixels. |

#### Slots

| Slot | Scope | Description |
| --- | --- | --- |
| `default` | `{ item, index }` | Renders each mounted row. |
| `empty` | none | Rendered when `items` is empty and `loading` is false. |
| `loading` | none | Loading row; defaults to “Loading more…”. |
| `refresh` | `{ pullDistance, progress, refreshing }` | Pull-to-refresh indicator. `progress` is clamped from `0` to `1`. |

#### Events

| Event | Payload | When it fires |
| --- | --- | --- |
| `scroll` | `{ scrollTop, startIndex, endIndex }` | On container scroll. `endIndex` is exclusive. |
| `load-more` | none | Near the end when `hasMore` is true and `loading` is false. |
| `refresh` | none | After pulling past the refresh threshold and releasing. |

#### Exposed API

| Method | Description |
| --- | --- |
| `scrollTo(position, options?)` | Scrolls to a pixel offset inside the list. |
| `scrollToIndex(index, { align?, behavior? })` | Scrolls to a zero-based index. `align` is `start`, `center`, or `end`. |
| `scrollToTop(behavior?)` | Scrolls to the start of the list. |

Long-distance smooth jumps automatically become immediate jumps because
unmeasured rows can change the target offset while scrolling.

### VirtualScroll

Use `VirtualScroll` when every row has exactly the same height. It does not
need to measure rows, making it the most predictable option for tables, menus,
logs, and dense result lists.

#### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { VirtualScroll, type VirtualScrollExpose } from 'vue-virtual-flow'

const list = ref<VirtualScrollExpose>()
const rows = Array.from({ length: 50_000 }, (_, id) => ({
  id,
  label: `Row ${id + 1}`,
}))
</script>

<template>
  <VirtualScroll
    ref="list"
    :items="rows"
    :item-size="44"
    :height="480"
    :overscan="5"
    item-key="id"
    aria-label="Results"
  >
    <template #default="{ item }">
      <div class="result-row">{{ item.label }}</div>
    </template>
  </VirtualScroll>

  <button @click="list?.scrollToIndex(999, { align: 'center' })">
    Go to row 1,000
  </button>
</template>

<style scoped>
.result-row {
  height: 44px;
  box-sizing: border-box;
}
</style>
```

The rendered row must stay at `itemSize`. If content can wrap or resize, use
`VirtualList` instead.

#### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | required | Data passed to the default slot. |
| `itemSize` | `number` | required | Exact height of every row in pixels. |
| `height` | `number \| string` | `400` | Viewport height. A number is pixels; `"fill"` maps to `100%`. |
| `overscan` | `number` | `3` | Extra rows mounted before and after the visible range. |
| `itemKey` | `keyof T \| (item, index) => PropertyKey` | `id`, `key`, or index | Stable identity for each row. |
| `ariaLabel` | `string` | `"Virtual list"` | Accessible label for the list. |
| `hasMore` | `boolean` | `false` | Indicates that another page can be loaded. |
| `loading` | `boolean` | `false` | Prevents duplicate requests and shows the loading row. |
| `loadingItemSize` | `number` | `itemSize` | Reserved loading-row height in pixels. |
| `loadMoreThreshold` | `number` | `200` | Distance from the end, in pixels, that triggers `load-more`. |
| `pullToRefresh` | `boolean` | `false` | Enables the touch pull-down gesture at the top. |
| `refreshing` | `boolean` | `false` | Keeps the refresh indicator open during async work. |
| `pullRefreshThreshold` | `number` | `64` | Pull distance required to emit `refresh`, in pixels. |

#### Slots, events, and exposed API

- Slots: `default({ item, index })`, `empty`, `loading`, and
  `refresh({ pullDistance, progress, refreshing })`.
- Events: `scroll({ scrollTop, startIndex, endIndex })`, `load-more`, and
  `refresh`.
- Methods: `scrollTo`, `scrollToIndex`, and `scrollToTop`.

### WindowDynamicVirtualScroll

Use `WindowDynamicVirtualScroll` for a long page or feed where the browser
window—not an inner element—is the scrolling viewport. It measures
variable-height rows and listens to `window.scrollY` and `window.innerHeight`.
There is no `height` prop.

#### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  WindowDynamicVirtualScroll,
  type VirtualScrollExpose,
} from 'vue-virtual-flow'

const feed = ref(loadInitialFeed())
const list = ref<VirtualScrollExpose>()
</script>

<template>
  <header>Content before the virtual list</header>

  <WindowDynamicVirtualScroll
    ref="list"
    :items="feed"
    :estimated-item-size="320"
    :overscan="3"
    item-key="id"
    aria-label="Article feed"
  >
    <template #default="{ item, index }">
      <article>
        <small>{{ index + 1 }}</small>
        <h2>{{ item.title }}</h2>
        <p>{{ item.summary }}</p>
      </article>
    </template>
  </WindowDynamicVirtualScroll>

  <footer>Content after the virtual list</footer>
</template>
```

#### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | required | Data passed to the default slot. |
| `estimatedItemSize` | `number` | `48` | Initial average row height in pixels. |
| `overscan` | `number` | `3` | Extra rows mounted before and after the visible range. |
| `itemKey` | `keyof T \| (item, index) => PropertyKey` | `id`, `key`, or index | Stable identity used for keys and measurements. |
| `ariaLabel` | `string` | `"Window dynamic virtual list"` | Accessible label for the list. |
| `hasMore` | `boolean` | `false` | Indicates that another page can be loaded. |
| `loading` | `boolean` | `false` | Prevents duplicate requests and shows the loading row. |
| `loadingItemSize` | `number` | `estimatedItemSize` | Reserved loading-row height in pixels. |
| `loadMoreThreshold` | `number` | `200` | Distance between the window bottom and list end that triggers `load-more`. |
| `pullToRefresh` | `boolean` | `false` | Enables refresh while the page is at `window.scrollY = 0`. |
| `refreshing` | `boolean` | `false` | Keeps the refresh indicator open during async work. |
| `pullRefreshThreshold` | `number` | `64` | Pull distance required to emit `refresh`, in pixels. |

#### Slots, events, and exposed API

- Slots: `default({ item, index })`, `empty`, `loading`, and
  `refresh({ pullDistance, progress, refreshing })`.
- Events: `scroll({ scrollTop, startIndex, endIndex })`, `load-more`, and
  `refresh`. `scrollTop` is relative to the component start.
- Methods: `scrollTo`, `scrollToIndex`, and `scrollToTop`. They scroll the
  browser window; `scrollTo` accepts an offset relative to the list.

### ChatVirtualScroll

`ChatVirtualScroll` is designed for variable-height conversations. It opens at
the newest message by default, follows appended messages only while the user
is near the bottom, and preserves the visible message when older items are
prepended.

#### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  ChatVirtualScroll,
  type ChatVirtualScrollExpose,
} from 'vue-virtual-flow'

const chat = ref<ChatVirtualScrollExpose>()
const loadingOlder = ref(false)
const messages = ref(loadLatestMessages())
const hasOlder = ref(true)

async function loadOlder() {
  if (loadingOlder.value || !hasOlder.value) return
  loadingOlder.value = true
  const page = await fetchOlderPage(messages.value[0]?.id)
  messages.value.unshift(...page.items)
  hasOlder.value = page.hasMore
  loadingOlder.value = false
}
</script>

<template>
  <ChatVirtualScroll
    ref="chat"
    :items="messages"
    :estimated-item-size="72"
    :height="600"
    :has-older="hasOlder"
    :loading-older="loadingOlder"
    :load-older-threshold="120"
    item-key="id"
    aria-label="Support conversation"
    @load-older="loadOlder"
  >
    <template #default="{ item }">
      <MessageBubble :message="item" />
    </template>

    <template #loadingOlder>Loading older messages…</template>
    <template #empty>No messages.</template>
  </ChatVirtualScroll>

  <button v-if="!chat?.isAtBottom" @click="chat?.scrollToBottom('smooth')">
    Newest messages
  </button>
</template>
```

Prepend older data to the same keyed collection. The component calculates the
height added above the viewport and restores the reader's position.

#### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | required | Messages ordered from oldest to newest. |
| `estimatedItemSize` | `number` | `48` | Initial average message height in pixels. |
| `height` | `number \| string` | `400` | Viewport height. A number is pixels; `"fill"` maps to `100%`. |
| `overscan` | `number` | `5` | Extra messages mounted before and after the visible range. |
| `itemKey` | `keyof T \| (item, index) => PropertyKey` | `id`, `key`, or index | Stable identity; especially important when prepending. |
| `ariaLabel` | `string` | `"Chat messages"` | Accessible label for the live log. |
| `stickToBottom` | `boolean` | `true` | Follows appended messages while currently near the bottom. |
| `bottomThreshold` | `number` | `80` | Distance still considered “at bottom”, in pixels. |
| `initialScroll` | `"top" \| "bottom"` | `"bottom"` | Initial position after mount. |
| `hasOlder` | `boolean` | `false` | Indicates that older history is available. |
| `loadingOlder` | `boolean` | `false` | Prevents duplicate requests and shows the top indicator. |
| `loadOlderThreshold` | `number` | `120` | Distance from the top that triggers `load-older`, in pixels. |

#### Slots

| Slot | Scope | Description |
| --- | --- | --- |
| `default` | `{ item, index }` | Renders each mounted message. |
| `empty` | none | Rendered when there are no messages. |
| `loadingOlder` | none | Sticky top status; defaults to “Loading older messages…”. |

#### Events

| Event | Payload | When it fires |
| --- | --- | --- |
| `scroll` | `{ scrollTop, startIndex, endIndex }` | On container scroll. |
| `load-older` | none | Near the top when `hasOlder` is true and `loadingOlder` is false. |
| `bottom-change` | `boolean` | When the viewport enters or leaves the bottom threshold. |

#### Exposed API

| Member | Description |
| --- | --- |
| `isAtBottom` | Readonly boolean indicating whether the user is near the bottom. |
| `scrollTo(position, options?)` | Scrolls to a pixel offset. |
| `scrollToIndex(index, { align?, behavior? })` | Scrolls to a zero-based message index. |
| `scrollToTop(behavior?)` | Scrolls to the oldest loaded message. |
| `scrollToBottom(behavior?)` | Scrolls to the newest loaded message. |

### ShortMediaFeed

`ShortMediaFeed` is a headless, vertically snapping viewport for reels,
stories, or short-form media. Each item occupies one complete viewport. The
component manages mounting and navigation; the slot owns video, images,
playback, audio, and controls.

#### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ShortMediaFeed, type ShortMediaFeedExpose } from 'vue-virtual-flow'

const feed = ref<ShortMediaFeedExpose>()
const activeIndex = ref(0)
const media = ref([
  { id: 1, src: '/media/one.mp4' },
  { id: 2, src: '/media/two.mp4' },
  { id: 3, src: '/media/three.mp4' },
])
</script>

<template>
  <ShortMediaFeed
    ref="feed"
    v-model:active-index="activeIndex"
    :items="media"
    :buffer="1"
    height="100dvh"
    item-key="id"
    aria-label="Video feed"
  >
    <template #default="{ item, active }">
      <video
        :src="item.src"
        :autoplay="active"
        :muted="!active"
        playsinline
        controls
      />
    </template>

    <template #empty>No media found.</template>
  </ShortMediaFeed>
</template>
```

With `buffer="1"`, at most the active item, one previous item, and one next
item are mounted. Slot-local state is lost when an item leaves the buffer, so
keep persistent playback state in the parent.

#### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | required | Media data passed to the default slot. |
| `activeIndex` | `number` | `0` | Active zero-based index; supports `v-model:active-index`. |
| `buffer` | `number` | `1` | Extra mounted items before and after the active item. |
| `height` | `number \| string` | `"100dvh"` | Feed viewport height. |
| `itemKey` | `keyof T \| (item, index) => PropertyKey` | `id`, `key`, or index | Stable identity for each item. |
| `ariaLabel` | `string` | `"Short media feed"` | Accessible label for the feed. |
| `hasMore` | `boolean` | `false` | Indicates that another page can be loaded. |
| `loading` | `boolean` | `false` | Prevents duplicate `load-more` requests. |
| `loadMoreThreshold` | `number` | `2` | Remaining item count that triggers `load-more`. |

#### Slots and events

| Kind | Name | Payload/scope | Description |
| --- | --- | --- | --- |
| Slot | `default` | `{ item, index, active }` | Renders a mounted item; `active` marks the snapped item. |
| Slot | `empty` | none | Rendered when `items` is empty. |
| Event | `update:activeIndex` | `number` | Supports `v-model:active-index`. |
| Event | `change` | `{ index, item }` | The active item changes. |
| Event | `reach-start` | none | Navigation changes to the first item. |
| Event | `reach-end` | none | Navigation changes to the last item. |
| Event | `load-more` | none | Remaining items reach `loadMoreThreshold`. |

#### Exposed API and keyboard controls

`scrollToIndex(index, options?)` scrolls to an item using standard
`ScrollToOptions`. The viewport supports Arrow Up/Down, Page Up/Down, Home,
and End.

For an unbounded feed, page data with `load-more` and keep a reasonable item
window in the parent. Virtualization limits mounted DOM and media elements,
but it does not remove objects from `items`.

### VirtualCarousel

`VirtualCarousel` is a headless horizontal carousel with scroll snapping and
virtualized slides. `activeIndex` represents the first slide in the current
view.

#### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { VirtualCarousel, type VirtualCarouselExpose } from 'vue-virtual-flow'

const carousel = ref<VirtualCarouselExpose>()
const activeIndex = ref(0)
const products = ref(loadProducts())
</script>

<template>
  <VirtualCarousel
    ref="carousel"
    v-model:active-index="activeIndex"
    :items="products"
    :slides-per-view="3"
    :slides-to-scroll="1"
    :gap="16"
    :buffer="1"
    :height="320"
    item-key="id"
    aria-label="Featured products"
  >
    <template #default="{ item, index, active, visible }">
      <ProductCard
        :product="item"
        :position="index"
        :active="active"
        :visible="visible"
      />
    </template>

    <template #empty>No products.</template>
  </VirtualCarousel>

  <button @click="carousel?.previous()">Previous</button>
  <button @click="carousel?.next()">Next</button>
</template>
```

Slide width is calculated as:

```text
(viewport width - (slidesPerView - 1) × gap) / slidesPerView
```

`active` is true only for the first slide in the view. `visible` is true for
every slide in that view. With three visible slides and a buffer of one, up to
five slides are normally mounted in the middle of the collection.

#### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | required | Slide data passed to the default slot. |
| `activeIndex` | `number` | `0` | First visible slide; supports `v-model:active-index`. |
| `slidesPerView` | `number` | `1` | Number of slides displayed at once. |
| `slidesToScroll` | `number` | `1` | Slides moved by `next()` and `previous()`. |
| `gap` | `number` | `0` | Gap between slides in pixels. |
| `buffer` | `number` | `1` | Extra mounted slides before and after the visible group. |
| `height` | `number \| string` | `"auto"` | Carousel height. |
| `itemKey` | `keyof T \| (item, index) => PropertyKey` | `id`, `key`, or index | Stable identity for each slide. |
| `ariaLabel` | `string` | `"Carousel"` | Accessible carousel label. |
| `hasMore` | `boolean` | `false` | Indicates that another page can be loaded. |
| `loading` | `boolean` | `false` | Prevents duplicate `load-more` requests. |
| `loadMoreThreshold` | `number` | `2` | Remaining slides after the visible group that trigger `load-more`. |

#### Slots and events

| Kind | Name | Payload/scope | Description |
| --- | --- | --- | --- |
| Slot | `default` | `{ item, index, active, visible }` | Renders each mounted slide. |
| Slot | `empty` | none | Rendered when `items` is empty. |
| Event | `update:activeIndex` | `number` | Supports `v-model:active-index`. |
| Event | `change` | `{ index, item }` | The first visible slide changes. |
| Event | `reach-start` | none | Navigation changes to the first position. |
| Event | `reach-end` | none | Navigation changes to the final valid position. |
| Event | `load-more` | none | Remaining slides reach `loadMoreThreshold`. |

#### Exposed API and keyboard controls

| Method | Description |
| --- | --- |
| `next(behavior?)` | Advances by `slidesToScroll`; defaults to smooth scrolling. |
| `previous(behavior?)` | Moves back by `slidesToScroll`. |
| `scrollToIndex(index, options?)` | Makes the index the first visible slide. |

The viewport supports Arrow Left/Right, Page Up/Down, Home, and End. A
long-distance smooth jump becomes immediate so virtualized gaps are not shown.

## Shared recipes

### Viewport height

Container-based components accept a number or CSS height string. Numbers are
converted to pixels. `height="fill"` is shorthand for `height="100%"`:

```vue
<div class="list-container">
  <VirtualList :items="items" height="fill">
    <template #default="{ item }"><ResultRow :item="item" /></template>
  </VirtualList>
</div>
```

```css
.list-container {
  height: 100%;
  min-height: 0;
}
```

A percentage height only works when its parent has an explicit height.
Development builds warn when it resolves to `0px`.
`WindowDynamicVirtualScroll` uses the browser window and has no `height` prop.

### Stable item keys

For object items, components try `item.id` and then `item.key`. Primitive items
fall back to their index. Provide `itemKey` when the identifier has another
name:

```vue
<VirtualList :items="users" item-key="uuid" />

<VirtualList
  :items="rows"
  :item-key="(row) => `${row.accountId}:${row.sequence}`"
/>
```

Stable unique keys are essential when inserting, deleting, prepending, or
reordering. They also associate saved height measurements with the correct
variable-height item.

### Load more

List components use a pixel distance threshold. `ShortMediaFeed` and
`VirtualCarousel` use a remaining-item threshold.

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

const items = ref(loadFirstPage())
const loading = ref(false)
const hasMore = computed(() => items.value.length < 1_000)

async function loadMore() {
  if (loading.value || !hasMore.value) return
  loading.value = true
  items.value.push(...(await fetchNextPage()))
  loading.value = false
}
</script>

<template>
  <VirtualList
    :items="items"
    :has-more="hasMore"
    :loading="loading"
    :load-more-threshold="400"
    @load-more="loadMore"
  >
    <template #default="{ item }"><FeedCard :item="item" /></template>
    <template #loading>Loading the next page…</template>
  </VirtualList>
</template>
```

The event fires at most once for the current item count. Appending items allows
the next request. Keep `loading` true for the entire request and set `hasMore`
to false after the final page.

### Pull to refresh

Pull-to-refresh is available on `VirtualList`, `DynamicVirtualScroll`,
`VirtualScroll`, and `WindowDynamicVirtualScroll`:

```vue
<VirtualList
  :items="items"
  pull-to-refresh
  :refreshing="refreshing"
  :pull-refresh-threshold="72"
  @refresh="refreshFirstPage"
>
  <template #default="{ item }"><FeedCard :item="item" /></template>
  <template #refresh="{ progress, refreshing: busy }">
    {{ busy ? 'Refreshing…' : progress >= 1 ? 'Release' : 'Pull down' }}
  </template>
</VirtualList>
```

The single-touch gesture begins only at the top. Set `refreshing` to true while
the async refresh runs, then return it to false to close the indicator.

## TypeScript exports

```ts
import type {
  ChatVirtualScrollExpose,
  ChatVirtualScrollProps,
  DynamicVirtualScrollProps,
  ItemKey,
  ScrollAlignment,
  ShortMediaFeedChangeEvent,
  ShortMediaFeedExpose,
  ShortMediaFeedProps,
  VirtualCarouselChangeEvent,
  VirtualCarouselExpose,
  VirtualCarouselProps,
  VirtualListExpose,
  VirtualListProps,
  VirtualScrollEvent,
  VirtualScrollExpose,
  VirtualScrollProps,
  WindowDynamicVirtualScrollProps,
} from 'vue-virtual-flow'
```

## Development and release

```bash
bun install
bunx playwright install chromium firefox webkit
bun run dev
bun run check
```

The playground includes fixed-height, variable-height, window, chat,
load-more, short-media, and carousel demos. Before publishing, also run
`npm pack --dry-run`. GitHub releases are published through
`.github/workflows/publish.yml`.

## Contributing

Issues and pull requests are welcome. Read
[CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a change.

## License

[MIT](./LICENSE)
