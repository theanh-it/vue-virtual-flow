# vue-virtual-flow

[English](./README.md) | [Tiếng Việt](./README.vi.md)

A small, typed, and accessible collection of virtual scrolling components for
Vue 3. It covers fixed and variable-height lists, window scrolling, chat,
window-scrolling grids, short-media feeds, and horizontal carousels.

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
  - [WindowGirdVirtualScroll](#windowgirdvirtualscroll)
  - [ChatVirtualScroll](#chatvirtualscroll)
  - [ShortMediaFeed](#shortmediafeed)
  - [VirtualCarousel](#virtualcarousel)
  - [SkeletonLoader](#skeletonloader)
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

| Dependency | Requirement |
| --- | --- |
| Vue | `^3.4.0` |
| Node.js | `>=18` |

## Quick start

| Registration | Usage |
| --- | --- |
| Local imports | `import { VirtualList, SkeletonLoader } from 'vue-virtual-flow'` |
| Global plugin | `createApp(App).use(VueVirtualScroll)` |
| Shared styles | `import 'vue-virtual-flow/style.css'` |

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
`WindowDynamicVirtualScroll`, `WindowGirdVirtualScroll`, `ChatVirtualScroll`,
`ShortMediaFeed`, `VirtualCarousel`, and `SkeletonLoader`.

## Choose a component

| Component | Use it when | Scroll viewport | Item size |
| --- | --- | --- | --- |
| `VirtualList` | You want the simplest general-purpose list. | Component container | Variable, measured automatically |
| `DynamicVirtualScroll` | Same behavior as `VirtualList`, with an explicit name. | Component container | Variable, measured automatically |
| `VirtualScroll` | Every row has the same known height. | Component container | Fixed |
| `WindowDynamicVirtualScroll` | The page itself should scroll instead of a nested container. | Browser window | Variable, measured automatically |
| `WindowGirdVirtualScroll` | A fixed-height card grid should use page scrolling. | Browser window | Fixed row height |
| `ChatVirtualScroll` | Messages are appended at the bottom and older history is prepended. | Component container | Variable, measured automatically |
| `ShortMediaFeed` | One full-height item should snap into view at a time. | Component container | One viewport per item |
| `VirtualCarousel` | Several horizontal slides should snap and virtualize. | Component container | Calculated from container width |
| `SkeletonLoader` | You need a placeholder while content loads. | None | Configurable width and height |

## Component guides

Events use Vue template listeners; action methods are called through a component
ref. The tables below use `list`, `chat`, `feed`, or `carousel` as the ref name.

| Task | Usage |
| --- | --- |
| Declare a typed ref | `const list = ref<VirtualScrollExpose>()` |
| Attach the ref to the component | `<VirtualScroll ref="list" ... />` |
| Call after mount in a script | `list.value?.scrollToIndex(10)` |
| Call from a template event | `@click="list?.scrollToIndex(10)"` |
| Select scroll behavior | Pass `{ behavior: 'smooth' }` to `scrollTo` / `scrollToIndex`, or `'smooth'` to `scrollToTop`, `scrollToBottom`, `next`, or `previous`. |
| Align a list item | `scrollToIndex(index, { align: 'start' })` / `'center'` / `'end'` |

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

| Event | Payload | When it fires | Usage |
| --- | --- | --- | --- |
| `scroll` | `{ scrollTop, startIndex, endIndex }` | On container scroll. `endIndex` is exclusive. | `@scroll="onScroll"` |
| `load-more` | none | Near the end when `hasMore` is true and `loading` is false. | `@load-more="loadMore"` |
| `refresh` | none | After pulling past the refresh threshold and releasing. | `@refresh="refreshFirstPage"` |

#### Exposed API

| Method / state | Description | Template example |
| --- | --- | --- |
| `scrollTo(position, options?)` | Scrolls to a pixel offset inside the list. | `list?.scrollTo(200, { behavior: 'smooth' })` |
| `scrollToIndex(index, options?)` | Scrolls to a zero-based index. `align` is `start`, `center`, or `end`. | `list?.scrollToIndex(10, { behavior: 'smooth' })` |
| `scrollToTop(behavior?)` | Scrolls to the start of the list. | `list?.scrollToTop()` |

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

#### Slots

| Slot | Scope | Description |
| --- | --- | --- |
| `default` | `{ item, index }` | Renders each mounted row. |
| `empty` | none | Rendered when `items` is empty and `loading` is false. |
| `loading` | none | Loading row; defaults to “Loading more…”. |
| `refresh` | `{ pullDistance, progress, refreshing }` | Pull-to-refresh indicator. `progress` is clamped from `0` to `1`. |

#### Events

| Event | Payload | When it fires | Usage |
| --- | --- | --- | --- |
| `scroll` | `{ scrollTop, startIndex, endIndex }` | On container scroll. `endIndex` is exclusive. | `@scroll="onScroll"` |
| `load-more` | none | Near the end when `hasMore` is true and `loading` is false. | `@load-more="loadMore"` |
| `refresh` | none | After pulling past the refresh threshold and releasing. | `@refresh="refreshFirstPage"` |

#### Exposed API

| Method / state | Description | Template example |
| --- | --- | --- |
| `scrollTo(position, options?)` | Scrolls to a pixel offset inside the list. | `list?.scrollTo(200, { behavior: 'smooth' })` |
| `scrollToIndex(index, options?)` | Scrolls to a zero-based item index. `align` is `start`, `center`, or `end`. | `list?.scrollToIndex(10, { behavior: 'smooth' })` |
| `scrollToTop(behavior?)` | Scrolls to the start of the list. | `list?.scrollToTop()` |

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

#### Slots

| Slot | Scope | Description |
| --- | --- | --- |
| `default` | `{ item, index }` | Renders each mounted row. |
| `empty` | none | Rendered when `items` is empty and `loading` is false. |
| `loading` | none | Loading row; defaults to “Loading more…”. |
| `refresh` | `{ pullDistance, progress, refreshing }` | Pull-to-refresh indicator. `progress` is clamped from `0` to `1`. |

#### Events

| Event | Payload | When it fires | Usage |
| --- | --- | --- | --- |
| `scroll` | `{ scrollTop, startIndex, endIndex }` | On window scroll. `scrollTop` is relative to the component start. `endIndex` is exclusive. | `@scroll="onScroll"` |
| `load-more` | none | Near the end when `hasMore` is true and `loading` is false. | `@load-more="loadMore"` |
| `refresh` | none | After pulling past the refresh threshold and releasing. | `@refresh="refreshFirstPage"` |

#### Exposed API

| Method / state | Description | Template example |
| --- | --- | --- |
| `scrollTo(position, options?)` | Scrolls the window to a pixel offset relative to the list start. | `list?.scrollTo(200, { behavior: 'smooth' })` |
| `scrollToIndex(index, options?)` | Scrolls the window to a zero-based item index. `align` is `start`, `center`, or `end`. | `list?.scrollToIndex(10, { behavior: 'smooth' })` |
| `scrollToTop(behavior?)` | Scrolls the window to the component start. | `list?.scrollToTop()` |

### WindowGirdVirtualScroll

Use `WindowGirdVirtualScroll` for a multi-column grid whose cards have a known,
fixed height and whose viewport is the browser window. Virtualization happens
by complete rows, so every visible column remains mounted together.

#### Example

```vue
<script setup lang="ts">
import { WindowGirdVirtualScroll } from 'vue-virtual-flow'

const products = Array.from({ length: 10_000 }, (_, id) => ({
  id,
  name: `Product ${id + 1}`,
}))
</script>

<template>
  <WindowGirdVirtualScroll
    :items="products"
    :item-size="240"
    :columns="4"
    :gap="16"
    item-key="id"
    aria-label="Product grid"
  >
    <template #default="{ item, rowIndex, columnIndex }">
      <ProductCard
        :product="item"
        :data-position="`${rowIndex}:${columnIndex}`"
      />
    </template>
  </WindowGirdVirtualScroll>
</template>
```

#### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | required | Data passed to the default slot. |
| `itemSize` | `number` | required | Fixed height of each grid row in pixels. Overflow is clipped. |
| `columns` | `number` | `2` | Number of columns in each row. |
| `gap` | `number` | `0` | Spacing between rows and columns in pixels. |
| `overscan` | `number` | `1` | Extra rows mounted before and after the visible range. |
| `itemKey` | `keyof T \| (item, index) => PropertyKey` | `id`, `key`, or index | Stable identity for each item. |
| `ariaLabel` | `string` | `"Window virtual grid"` | Accessible label for the grid. |
| `hasMore` | `boolean` | `false` | Indicates that another page can be loaded. |
| `loading` | `boolean` | `false` | Prevents duplicate requests and shows the loading row. |
| `loadingItemSize` | `number` | `itemSize` | Reserved loading-row height in pixels. |
| `loadMoreThreshold` | `number` | `200` | Distance from the window bottom to the grid end that triggers `load-more`, in pixels. |
| `pullToRefresh` | `boolean` | `false` | Enables refresh while the page is at `window.scrollY = 0`. |
| `refreshing` | `boolean` | `false` | Keeps the refresh indicator open during async work. |
| `pullRefreshThreshold` | `number` | `64` | Pull distance required to emit `refresh`, in pixels. |

#### Slots

| Slot | Scope | Description |
| --- | --- | --- |
| `default` | `{ item, index, rowIndex, columnIndex }` | Renders each mounted cell. |
| `empty` | none | Rendered when `items` is empty and `loading` is false. |
| `loading` | none | Loading row; defaults to “Loading more…”. |
| `refresh` | `{ pullDistance, progress, refreshing }` | Pull-to-refresh indicator. `progress` is clamped from `0` to `1`. |

#### Events

| Event | Payload | When it fires | Usage |
| --- | --- | --- | --- |
| `scroll` | `{ scrollTop, startIndex, endIndex }` | On window scroll. `scrollTop` is relative to the component start. `endIndex` is exclusive. | `@scroll="onScroll"` |
| `load-more` | none | Near the end when `hasMore` is true and `loading` is false. | `@load-more="loadMore"` |
| `refresh` | none | After pulling past the refresh threshold and releasing. | `@refresh="refreshFirstPage"` |

#### Exposed API

| Method / state | Description | Template example |
| --- | --- | --- |
| `scrollTo(position, options?)` | Scrolls the window to a pixel offset relative to the list start. | `list?.scrollTo(200, { behavior: 'smooth' })` |
| `scrollToIndex(index, options?)` | Scrolls the window to the row containing a zero-based item index. `align` is `start`, `center`, or `end`. | `list?.scrollToIndex(10, { behavior: 'smooth' })` |
| `scrollToTop(behavior?)` | Scrolls the window to the component start. | `list?.scrollToTop()` |

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

Prepend older data to the same keyed collection. The scroll container is anchored
at the bottom, so adding or measuring older messages above the reader does not
need a native scroll correction. Previously unseen messages are measured before
paint, and cached height updates use an incremental size index.

Use the exposed methods and the `scroll` event for positions measured from the
top. The internal DOM scroller uses negative `scrollTop` values (zero at the
bottom); code that directly reads or writes that DOM property must account for
this. Message DOM order remains oldest to newest.

For smooth media conversations, reserve image/video dimensions with `width`,
`height`, or `aspect-ratio`, use an estimate close to your message heights, and
avoid a `size` budget that removes most overscan. Set `loadOlderThreshold` high
enough to fetch the next page before the user reaches the oldest loaded message;
virtualization cannot hide network latency once that boundary is reached.

#### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | required | Messages ordered from oldest to newest. |
| `estimatedItemSize` | `number` | `48` | Initial average message height in pixels. |
| `height` | `number \| string` | `400` | Viewport height. A number is pixels; `"fill"` maps to `100%`. |
| `overscan` | `number` | `5` | Extra messages mounted before and after the visible range. |
| `size` | `number` | unset | Optional total render budget including overscan, e.g. `:size="12"` for mobile. Trims overscan first; always renders enough messages to fill the viewport, even if this exceeds `size`. Does not add messages beyond `overscan`. Positive values are floored (minimum 1); non-positive or non-finite values disable the budget. |
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

| Event | Payload | When it fires | Usage |
| --- | --- | --- | --- |
| `scroll` | `{ scrollTop, startIndex, endIndex }` | On container scroll. | `@scroll="onScroll"` |
| `load-older` | none | Near the top when `hasOlder` is true and `loadingOlder` is false. | `@load-older="loadOlder"` |
| `bottom-change` | `boolean` | When the viewport enters or leaves the bottom threshold. | `@bottom-change="onBottomChange"` |

#### Exposed API

| Method / state | Description | Template example |
| --- | --- | --- |
| `isAtBottom` | Readonly boolean indicating whether the user is near the bottom. | `chat?.isAtBottom` |
| `scrollTo(position, options?)` | Scrolls to a pixel offset. | `chat?.scrollTo(200, { behavior: 'smooth' })` |
| `scrollToIndex(index, options?)` | Scrolls to a zero-based message index. | `chat?.scrollToIndex(10, { behavior: 'smooth' })` |
| `scrollToTop(behavior?)` | Scrolls to the oldest loaded message. | `chat?.scrollToTop()` |
| `scrollToBottom(behavior?)` | Scrolls to the newest loaded message. | `chat?.scrollToBottom('smooth')` |

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

#### Slots

| Slot | Scope | Description |
| --- | --- | --- |
| `default` | `{ item, index, active }` | Renders a mounted item; `active` marks the snapped item. |
| `empty` | none | Rendered when `items` is empty. |

#### Events

| Event | Payload | When it fires | Usage |
| --- | --- | --- | --- |
| `update:activeIndex` | `number` | Supports `v-model:active-index`. | `v-model:active-index="activeIndex"` |
| `change` | `{ index, item }` | The active item changes. | `@change="onChange"` |
| `reach-start` | none | Navigation changes to the first item. | `@reach-start="onReachStart"` |
| `reach-end` | none | Navigation changes to the last item. | `@reach-end="onReachEnd"` |
| `load-more` | none | Remaining items reach `loadMoreThreshold`. | `@load-more="loadMore"` |

#### Exposed API

| Method / state | Description | Template example |
| --- | --- | --- |
| `scrollToIndex(index, options?)` | Scrolls to a zero-based item index using standard `ScrollToOptions`. | `feed?.scrollToIndex(10, { behavior: 'smooth' })` |

#### Keyboard controls

These keys work while the viewport is focused:

| Key | Action |
| --- | --- |
| `ArrowDown`, `PageDown` | Moves to the next item. |
| `ArrowUp`, `PageUp` | Moves to the previous item. |
| `Home` | Moves to the first position. |
| `End` | Moves to the last item. |

The viewport also converts mouse-wheel input into slide transitions. The wheel
handler in the component is enabled by default; nothing extra is required from
the parent. For touch input, native scroll-snap continues to handle swipes.

For an unbounded feed, page data with `load-more` and handle parents. Virtualization limits mounted DOM and media elements,
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
| `autoplay` | `boolean` | `false` | Enables automatic slide progression. |
| `autoplayDelay` | `number` | `3000` | Delay in milliseconds between automatic transitions; values below `1` are clamped and non-finite values use the default. |
| `autoplayLoop` | `boolean` | `true` | Returns to the first slide when reaching the end. |
| `pauseOnHover` | `boolean` | `true` | Pauses autoplay when the carousel is hovered. |
| `responsive` | `ResponsiveBreakpoint[]` | `undefined` | Overrides slide count, scroll step, and gap at container-width breakpoints. |

#### Responsive configuration

The largest `breakpoint` not exceeding the carousel container width is used.
If no breakpoint matches, the base props apply. Omitted fields fall back to
the base props, not to another breakpoint.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `breakpoint` | `number` | required | Minimum container width in pixels. |
| `slidesPerView` | `number` | `slidesPerView` | Slides visible at this breakpoint. |
| `slidesToScroll` | `number` | `slidesToScroll` | Slides moved by `next()` and `previous()`. |
| `gap` | `number` | `gap` | Space between slides in pixels. |

```vue
<VirtualCarousel
  :items="products"
  :slides-per-view="1"
  :responsive="[
    { breakpoint: 640, slidesPerView: 2, gap: 12 },
    { breakpoint: 1024, slidesPerView: 3, slidesToScroll: 2, gap: 16 },
  ]"
>
  <template #default="{ item }"><ProductCard :product="item" /></template>
</VirtualCarousel>
```

#### Slots

| Slot | Scope | Description |
| --- | --- | --- |
| `default` | `{ item, index, active, visible }` | Renders each mounted slide. |
| `empty` | none | Rendered when `items` is empty. |

#### Events

| Event | Payload | When it fires | Usage |
| --- | --- | --- | --- |
| `update:activeIndex` | `number` | Supports `v-model:active-index`. | `v-model:active-index="activeIndex"` |
| `change` | `{ index, item }` | The first visible slide changes. | `@change="onChange"` |
| `reach-start` | none | Navigation changes to the first position. | `@reach-start="onReachStart"` |
| `reach-end` | none | Navigation changes to the final valid position. | `@reach-end="onReachEnd"` |
| `load-more` | none | Remaining slides reach `loadMoreThreshold`. | `@load-more="loadMore"` |

#### Exposed API

| Method / state | Description | Template example |
| --- | --- | --- |
| `next(behavior?)` | Advances by `slidesToScroll`; defaults to smooth scrolling. | `carousel?.next()` |
| `previous(behavior?)` | Moves back by `slidesToScroll`. | `carousel?.previous()` |
| `scrollToIndex(index, options?)` | Makes the index the first visible slide. | `carousel?.scrollToIndex(10, { behavior: 'smooth' })` |
| `startAutoplay()` | Starts or restarts the timer when `autoplay` is true and items are available. | `carousel?.startAutoplay()` |
| `stopAutoplay()` | Clears the current timer; set `autoplay=false` to keep automatic progression disabled. | `carousel?.stopAutoplay()` |

#### Keyboard controls

These keys work while the viewport is focused:

| Key | Action |
| --- | --- |
| `ArrowRight`, `PageDown` | Advances by `slidesToScroll`, equivalent to `next()`. |
| `ArrowLeft`, `PageUp` | Moves back by `slidesToScroll`, equivalent to `previous()`. |
| `Home` | Moves to the first position. |
| `End` | Moves to the final valid first-slide position. |

A long-distance smooth jump becomes immediate so virtualized gaps are not
shown.

#### Autoplay example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { VirtualCarousel, type VirtualCarouselExpose } from 'vue-virtual-flow'

const carousel = ref<VirtualCarouselExpose>()
const products = ref(loadProducts())
</script>

<template>
  <VirtualCarousel
    ref="carousel"
    :items="products"
    :slides-per-view="3"
    :autoplay="true"
    :autoplay-delay="3000"
    :autoplay-loop="true"
    :pause-on-hover="true"
  >
    <template #default="{ item }">
      <ProductCard :product="item" />
    </template>
  </VirtualCarousel>

  <button @click="carousel?.stopAutoplay()">Pause</button>
  <button @click="carousel?.startAutoplay()">Resume</button>
</template>
```

| Action / condition | Result |
| --- | --- |
| `autoplay=true` | Starts automatically, including when an initially empty `items` collection receives data. |
| `stopAutoplay()` | Clears the current timer. Later navigation or pointer events may restart it when `autoplay` remains true. |
| `startAutoplay()` | Starts or restarts the timer when `autoplay` is true and items are available. |
| `autoplay=false` | Disables automatic progression until the prop is enabled again. |
| `autoplayLoop` | At the end, true returns to the start; false stops the timer. |
| `pauseOnHover` | When true, hovering pauses the timer; leaving resumes it if autoplay is enabled. |
| Change autoplay settings | `autoplayDelay`, `autoplayLoop`, and `pauseOnHover` take effect at runtime. |

### SkeletonLoader

`SkeletonLoader` renders a placeholder with a shimmer animation. Use it on its
own or inside a list's `loading` slot. It stays visible while mounted; control
standalone visibility with `v-if`, or let the list's `loading` prop control the
slot.

#### Example

Import the library stylesheet once, as shown below or in your application entry
point. Set `loading` to false when your data request finishes.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { SkeletonLoader } from 'vue-virtual-flow'
import 'vue-virtual-flow/style.css'

const loading = ref(true)
</script>

<template>
  <SkeletonLoader
    v-if="loading"
    width="100%"
    :height="120"
    aria-label="Loading content…"
  />
  <p v-else>Content is ready.</p>
</template>
```

#### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `width` | `number \| string` | `'100%'` | Width in pixels for numbers, or a CSS length such as `'60%'` or `'12rem'`. |
| `height` | `number \| string` | `16` | Height in pixels for numbers, or a CSS length. |
| `variant` | `'rectangle' \| 'rounded' \| 'circle'` | `'rounded'` | Placeholder shape. Use equal width and height for a circle. |
| `animated` | `boolean` | `true` | Enables the shimmer animation. |
| `ariaLabel` | `string` | `'Loading…'` | Accessible label for the placeholder's `role="status"`. |

```vue
<SkeletonLoader variant="circle" :width="48" :height="48" />
<SkeletonLoader variant="rectangle" :height="180" />
<SkeletonLoader width="60%" :height="20" :animated="false" />
```

The animation automatically stops when the user prefers reduced motion. When
composing several decorative skeletons under a shared loading message, pass
`aria-hidden="true"` to each skeleton to avoid repeated accessible labels.

#### Slots, events, and exposed API

| API | Support |
| --- | --- |
| Slots | None. The component renders a single placeholder. |
| Events | No custom events. |
| Exposed methods | None. Control the component with props and `v-if`. |

#### Actions

| Action | Usage |
| --- | --- |
| Show or hide | `<SkeletonLoader v-if="loading" />` |
| Use a circle | `<SkeletonLoader variant="circle" :width="48" :height="48" />` |
| Disable shimmer | `<SkeletonLoader :animated="false" />` |
| Set the accessible label | `aria-label="Loading…"` |
| Hide a decorative skeleton from screen readers | `aria-hidden="true"` |

#### Use in a loading slot

Import `SkeletonLoader` alongside `VirtualList`. With your existing `items` and
`loading` state, replace the loading message with a skeleton:

```vue
<VirtualList :items="items" :loading="loading" :loading-item-size="64">
  <template #default="{ item }"><FeedCard :item="item" /></template>
  <template #loading>
    <SkeletonLoader :height="40" aria-label="Loading the next page…" />
  </template>
</VirtualList>
```

| Setting | Usage |
| --- | --- |
| Components with a `loading` slot | `VirtualList`, `DynamicVirtualScroll`, `VirtualScroll`, `WindowDynamicVirtualScroll`, `WindowGirdVirtualScroll`. |
| List `loading` prop | Set to true to show the slot; false to hide it. |
| Skeleton `height` prop | Sets the placeholder height, for example `40` pixels. |
| List `loadingItemSize` prop | Reserve space for the skeleton plus the row's vertical padding. Example: `40px + 1.5rem = 64px` at a 16px root font size. |

#### Customize appearance

Set these CSS custom properties on the skeleton or a parent element:

| CSS custom property | Default | Description |
| --- | --- | --- |
| `--skeleton-background` | `#e2e8f0` | Base background color. |
| `--skeleton-highlight` | `rgb(255 255 255 / 60%)` | Shimmer highlight color. |
| `--skeleton-radius` | `8px` | Corner radius for the `rounded` variant. |

```vue
<SkeletonLoader
  :height="80"
  style="--skeleton-background: #334155; --skeleton-highlight: #475569; --skeleton-radius: 12px"
/>
```

## Shared recipes

### Viewport height

| Value / component | Behavior |
| --- | --- |
| `:height="400"` | Numeric values become pixels. |
| `height="60vh"` | CSS height strings are passed through. |
| `height="fill"` / `height="100%"` | Uses the parent height. The parent must have an explicit height; development builds warn if this resolves to `0px`. |
| `WindowDynamicVirtualScroll`, `WindowGirdVirtualScroll` | Use the browser window and do not accept a `height` prop. |

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

### Stable item keys

| Configuration / data | Key selection |
| --- | --- |
| `:item-key="(item, index) => …"` | Uses the function result. |
| `item-key="uuid"` | Uses a valid `item.uuid`; otherwise tries `id`, `key`, then the index. |
| Object without an explicit `itemKey` | Tries `item.id`, then `item.key`, then the index. |
| Primitive without a key function | Falls back to the index. |

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

| Component | `loadMoreThreshold` | Event |
| --- | --- | --- |
| `VirtualList`, `DynamicVirtualScroll`, `VirtualScroll`, `WindowDynamicVirtualScroll`, `WindowGirdVirtualScroll` | Distance to the end in pixels. | `load-more` |
| `ShortMediaFeed` | Number of items after the active item. | `load-more` |
| `VirtualCarousel` | Number of slides after the visible group. | `load-more` |

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

| Step / condition | Action / result |
| --- | --- |
| Receive `load-more` | Start the next request only when `loading` is false and `hasMore` is true. |
| Request in progress | Keep `loading=true` for the entire request. |
| Receive the next page | Append its items. The event normally fires once per current item count; increasing that count permits another request. |
| Request finished | Set `loading=false`; use `finally` when requests may fail. |
| Final page | Set `hasMore=false` to stop further requests. |

### Pull to refresh

| Component | Gesture starts at |
| --- | --- |
| `VirtualList`, `DynamicVirtualScroll`, `VirtualScroll` | The top of the component container. |
| `WindowDynamicVirtualScroll`, `WindowGirdVirtualScroll` | `window.scrollY = 0` |

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

| Step / state | Action / result |
| --- | --- |
| Enable the gesture | `pull-to-refresh` |
| Pull down with one finger at the top | Updates the `refresh` slot scope: `pullDistance`, `progress`, and `refreshing`. |
| Release after reaching `pullRefreshThreshold` | Emits `refresh` without a payload. |
| Handle `refresh` | Set `refreshing=true` while fetching fresh data to keep the indicator open. |
| Finish refreshing | Set `refreshing=false` to close the indicator. |

## TypeScript exports

| Type | Purpose |
| --- | --- |
| `ChatVirtualScrollExpose` | Chat ref API and `isAtBottom` state. |
| `ChatVirtualScrollProps<T>` | Chat component props. |
| `DynamicVirtualScrollProps<T>` | Variable-height list props. |
| `ItemKey<T>` | Property name or function used to identify an item. |
| `ResponsiveBreakpoint` | Carousel container breakpoint and optional layout overrides. |
| `ScrollAlignment` | `'start'`, `'center'`, or `'end'` for list index scrolling. |
| `ShortMediaFeedChangeEvent<T>` | Feed `change` payload: `{ index, item }`. |
| `ShortMediaFeedExpose` | Feed ref API. |
| `ShortMediaFeedProps<T>` | Feed props. |
| `SkeletonLoaderProps` | Skeleton size, shape, animation, and accessible label. |
| `VirtualCarouselChangeEvent<T>` | Carousel `change` payload: `{ index, item }`. |
| `VirtualCarouselExpose` | Carousel navigation and autoplay ref API. |
| `VirtualCarouselProps<T>` | Carousel props, including responsive settings. |
| `VirtualListExpose` | Alias of `VirtualScrollExpose`. |
| `VirtualListProps<T>` | Alias of `DynamicVirtualScrollProps<T>`. |
| `VirtualScrollEvent` | Scroll payload: `{ scrollTop, startIndex, endIndex }`; `endIndex` is exclusive. |
| `VirtualScrollExpose` | Shared ref API for fixed, dynamic, and window lists/grids. |
| `VirtualScrollProps<T>` | Fixed-height list props. |
| `WindowDynamicVirtualScrollProps<T>` | Window-based variable-height list props. |
| `WindowGirdVirtualScrollProps<T>` | Window-based fixed-row grid props. |

```ts
import type {
  ChatVirtualScrollExpose,
  ChatVirtualScrollProps,
  DynamicVirtualScrollProps,
  ItemKey,
  ResponsiveBreakpoint,
  ScrollAlignment,
  ShortMediaFeedChangeEvent,
  ShortMediaFeedExpose,
  ShortMediaFeedProps,
  SkeletonLoaderProps,
  VirtualCarouselChangeEvent,
  VirtualCarouselExpose,
  VirtualCarouselProps,
  VirtualListExpose,
  VirtualListProps,
  VirtualScrollEvent,
  VirtualScrollExpose,
  VirtualScrollProps,
  WindowDynamicVirtualScrollProps,
  WindowGirdVirtualScrollProps,
} from 'vue-virtual-flow'
```

## Development and release

| Command / lifecycle | Action |
| --- | --- |
| `bun install` | Install dependencies. |
| `bunx playwright install chromium firefox webkit` | Install browsers for smoke tests. |
| `bun run dev` | Start the playground. |
| `bun run typecheck` | Check TypeScript and Vue types. |
| `bun run test` | Run unit tests. |
| `bun run test:watch` | Run unit tests in watch mode. |
| `bun run build` | Typecheck and build the package with type declarations. |
| `bun run typecheck:package` | Check ESM and CommonJS consumer types after building. |
| `bun run lint:package` | Validate package exports and type packaging after building. |
| `bun run test:browser` | Run Playwright browser tests. |
| `bun run check` | Run all checks: unit tests, build, consumer types, package lint, and browser tests. |
| `npm pack --dry-run` | Inspect the files that will be published. |
| `prepublishOnly` | Automatically runs `bun run check` before publishing. |

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
