# vue-virtual-flow

[English](./README.md) | [Tiếng Việt](./README.vi.md)

Bộ component virtual scrolling nhỏ gọn, có type đầy đủ và hỗ trợ khả năng tiếp
cận cho Vue 3. Thư viện hỗ trợ danh sách chiều cao cố định hoặc động, cuộn theo
cửa sổ, giao diện chat, feed media ngắn và carousel ngang.

Chỉ các item cần thiết cho viewport hiện tại được mount, nhờ đó tập dữ liệu lớn
vẫn phản hồi nhanh mà component không áp đặt giao diện của từng item.

## Mục lục

- [Cài đặt](#cài-đặt)
- [Bắt đầu nhanh](#bắt-đầu-nhanh)
- [Chọn component](#chọn-component)
- [Hướng dẫn từng component](#hướng-dẫn-từng-component)
  - [VirtualList và DynamicVirtualScroll](#virtuallist-và-dynamicvirtualscroll)
  - [VirtualScroll](#virtualscroll)
  - [WindowDynamicVirtualScroll](#windowdynamicvirtualscroll)
  - [ChatVirtualScroll](#chatvirtualscroll)
  - [ShortMediaFeed](#shortmediafeed)
  - [VirtualCarousel](#virtualcarousel)
- [Cách dùng chung](#cách-dùng-chung)
  - [Chiều cao viewport](#chiều-cao-viewport)
  - [Key ổn định cho item](#key-ổn-định-cho-item)
  - [Tải thêm dữ liệu](#tải-thêm-dữ-liệu)
  - [Kéo để làm mới](#kéo-để-làm-mới)
- [Các type được export](#các-type-được-export)
- [Phát triển và phát hành](#phát-triển-và-phát-hành)
- [Đóng góp](#đóng-góp)
- [Giấy phép](#giấy-phép)

## Cài đặt

```bash
npm install vue-virtual-flow
```

Import stylesheet của thư viện một lần tại entry point của ứng dụng:

```ts
import 'vue-virtual-flow/style.css'
```

Package yêu cầu Vue `^3.4.0` và Node.js `>=18`.

## Bắt đầu nhanh

Import component cục bộ:

```vue
<script setup lang="ts">
import { VirtualList } from 'vue-virtual-flow'
import 'vue-virtual-flow/style.css'

const users = Array.from({ length: 10_000 }, (_, id) => ({
  id,
  name: `Người dùng ${id + 1}`,
}))
</script>

<template>
  <VirtualList :items="users" item-key="id">
    <template #default="{ item, index }">
      <div>{{ index + 1 }}. {{ item.name }}</div>
    </template>

    <template #empty>Không tìm thấy người dùng.</template>
  </VirtualList>
</template>
```

Hoặc đăng ký toàn bộ component ở cấp global:

```ts
import { createApp } from 'vue'
import VueVirtualScroll from 'vue-virtual-flow'
import 'vue-virtual-flow/style.css'
import App from './App.vue'

createApp(App).use(VueVirtualScroll).mount('#app')
```

Plugin đăng ký `VirtualList`, `DynamicVirtualScroll`, `VirtualScroll`,
`WindowDynamicVirtualScroll`, `ChatVirtualScroll`, `ShortMediaFeed` và
`VirtualCarousel`.

## Chọn component

| Component | Nên dùng khi | Viewport cuộn | Kích thước item |
| --- | --- | --- | --- |
| `VirtualList` | Cần danh sách đa dụng với cách dùng đơn giản nhất. | Container của component | Động, tự đo |
| `DynamicVirtualScroll` | Giống `VirtualList` nhưng tên gọi thể hiện rõ chiều cao động. | Container của component | Động, tự đo |
| `VirtualScroll` | Tất cả hàng có cùng chiều cao đã biết. | Container của component | Cố định |
| `WindowDynamicVirtualScroll` | Muốn trang cuộn thay vì tạo một container cuộn lồng bên trong. | Cửa sổ trình duyệt | Động, tự đo |
| `ChatVirtualScroll` | Tin nhắn mới được thêm ở cuối và lịch sử cũ được thêm ở đầu. | Container của component | Động, tự đo |
| `ShortMediaFeed` | Mỗi lần cần snap một item đầy viewport. | Container của component | Một viewport cho mỗi item |
| `VirtualCarousel` | Cần hiển thị và snap nhiều slide theo chiều ngang. | Container của component | Tính từ chiều rộng container |

## Hướng dẫn từng component

### VirtualList và DynamicVirtualScroll

`VirtualList` là alias của `DynamicVirtualScroll`. Hai tên này render cùng một
component và dùng chung API. Component phù hợp cho card, kết quả tìm kiếm,
activity feed hoặc danh sách có các hàng cao thấp khác nhau.

Ban đầu mỗi hàng dùng `estimatedItemSize`. Sau đó `ResizeObserver` thay giá trị
ước tính bằng chiều cao đã đo. Khi chiều cao của item phía trên viewport thay
đổi, component bù lại vị trí cuộn để tránh nội dung bị nhảy.

#### Ví dụ

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
  { id: 'p1', title: 'Bài viết ngắn', body: 'Chỉ có một dòng.' },
  {
    id: 'p2',
    title: 'Bài viết dài',
    body: 'Nội dung xuống nhiều dòng làm cho hàng này có chiều cao khác.',
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
    aria-label="Danh sách bài viết"
    @scroll="onScroll"
  >
    <template #default="{ item, index }">
      <article>
        <small>#{{ index + 1 }}</small>
        <h2>{{ item.title }}</h2>
        <p>{{ item.body }}</p>
      </article>
    </template>

    <template #empty>Chưa có bài viết.</template>
  </VirtualList>

  <button @click="list?.scrollToIndex(1, { align: 'center' })">
    Đi tới bài viết thứ hai
  </button>
</template>
```

Nên chọn giá trị ước tính gần với chiều cao trung bình sau khi render. Các hàng
không cần bằng đúng giá trị này; ước tính hợp lý chủ yếu giúp scrollbar ban đầu
và thao tác nhảy tới item chưa được đo chính xác hơn.

#### Props

| Prop | Kiểu | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | bắt buộc | Dữ liệu truyền vào default slot. |
| `estimatedItemSize` | `number` | `48` | Chiều cao trung bình ban đầu của hàng, tính bằng pixel. |
| `height` | `number \| string` | `400` | Chiều cao viewport. Số được hiểu là pixel; `"fill"` tương đương `100%`. |
| `overscan` | `number` | `3` | Số hàng mount thêm trước và sau vùng đang hiển thị. |
| `itemKey` | `keyof T \| (item, index) => PropertyKey` | `id`, `key` hoặc index | Định danh ổn định dùng cho key và kết quả đo. |
| `ariaLabel` | `string` | `"Dynamic virtual list"` | Nhãn hỗ trợ khả năng tiếp cận. |
| `hasMore` | `boolean` | `false` | Cho biết vẫn còn trang dữ liệu tiếp theo. |
| `loading` | `boolean` | `false` | Ngăn request trùng và hiển thị hàng loading. |
| `loadingItemSize` | `number` | `estimatedItemSize` | Chiều cao dành cho hàng loading, tính bằng pixel. |
| `loadMoreThreshold` | `number` | `200` | Khoảng cách tới cuối danh sách để emit `load-more`, tính bằng pixel. |
| `pullToRefresh` | `boolean` | `false` | Bật thao tác kéo xuống ở đầu danh sách trên thiết bị cảm ứng. |
| `refreshing` | `boolean` | `false` | Giữ indicator mở trong lúc refresh bất đồng bộ. |
| `pullRefreshThreshold` | `number` | `64` | Khoảng kéo cần thiết để emit `refresh`, tính bằng pixel. |

#### Slots

| Slot | Scope | Mô tả |
| --- | --- | --- |
| `default` | `{ item, index }` | Render từng hàng đang được mount. |
| `empty` | không có | Render khi `items` rỗng và `loading` là false. |
| `loading` | không có | Hàng loading; mặc định là “Loading more…”. |
| `refresh` | `{ pullDistance, progress, refreshing }` | Indicator kéo để làm mới. `progress` được giới hạn từ `0` tới `1`. |

#### Events

| Event | Payload | Thời điểm emit |
| --- | --- | --- |
| `scroll` | `{ scrollTop, startIndex, endIndex }` | Khi container cuộn. `endIndex` là mốc không bao gồm item tại index đó. |
| `load-more` | không có | Gần cuối danh sách khi `hasMore` là true và `loading` là false. |
| `refresh` | không có | Khi kéo qua ngưỡng refresh rồi thả tay. |

#### API qua ref

| Method | Mô tả |
| --- | --- |
| `scrollTo(position, options?)` | Cuộn tới offset pixel bên trong danh sách. |
| `scrollToIndex(index, { align?, behavior? })` | Cuộn tới index bắt đầu từ 0. `align` nhận `start`, `center` hoặc `end`. |
| `scrollToTop(behavior?)` | Cuộn về đầu danh sách. |

Smooth scroll ở khoảng cách xa tự chuyển thành nhảy tức thời vì các hàng chưa
đo có thể làm thay đổi offset đích trong lúc cuộn.

### VirtualScroll

Dùng `VirtualScroll` khi mọi hàng có cùng một chiều cao chính xác. Component
không cần đo từng hàng, nên rất phù hợp cho bảng, menu, log hoặc danh sách kết
quả dày đặc.

#### Ví dụ

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { VirtualScroll, type VirtualScrollExpose } from 'vue-virtual-flow'

const list = ref<VirtualScrollExpose>()
const rows = Array.from({ length: 50_000 }, (_, id) => ({
  id,
  label: `Hàng ${id + 1}`,
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
    aria-label="Kết quả"
  >
    <template #default="{ item }">
      <div class="result-row">{{ item.label }}</div>
    </template>
  </VirtualScroll>

  <button @click="list?.scrollToIndex(999, { align: 'center' })">
    Đi tới hàng 1.000
  </button>
</template>

<style scoped>
.result-row {
  height: 44px;
  box-sizing: border-box;
}
</style>
```

Hàng đã render phải giữ đúng `itemSize`. Nếu nội dung có thể xuống dòng hoặc
thay đổi kích thước, hãy dùng `VirtualList`.

#### Props

| Prop | Kiểu | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | bắt buộc | Dữ liệu truyền vào default slot. |
| `itemSize` | `number` | bắt buộc | Chiều cao chính xác của mọi hàng, tính bằng pixel. |
| `height` | `number \| string` | `400` | Chiều cao viewport. Số được hiểu là pixel; `"fill"` tương đương `100%`. |
| `overscan` | `number` | `3` | Số hàng mount thêm trước và sau vùng đang hiển thị. |
| `itemKey` | `keyof T \| (item, index) => PropertyKey` | `id`, `key` hoặc index | Định danh ổn định của mỗi hàng. |
| `ariaLabel` | `string` | `"Virtual list"` | Nhãn hỗ trợ khả năng tiếp cận. |
| `hasMore` | `boolean` | `false` | Cho biết vẫn còn trang dữ liệu tiếp theo. |
| `loading` | `boolean` | `false` | Ngăn request trùng và hiển thị hàng loading. |
| `loadingItemSize` | `number` | `itemSize` | Chiều cao dành cho hàng loading, tính bằng pixel. |
| `loadMoreThreshold` | `number` | `200` | Khoảng cách tới cuối danh sách để emit `load-more`, tính bằng pixel. |
| `pullToRefresh` | `boolean` | `false` | Bật thao tác kéo xuống ở đầu danh sách. |
| `refreshing` | `boolean` | `false` | Giữ indicator mở trong lúc refresh bất đồng bộ. |
| `pullRefreshThreshold` | `number` | `64` | Khoảng kéo cần thiết để emit `refresh`, tính bằng pixel. |

#### Slots, events và API qua ref

- Slots: `default({ item, index })`, `empty`, `loading` và
  `refresh({ pullDistance, progress, refreshing })`.
- Events: `scroll({ scrollTop, startIndex, endIndex })`, `load-more` và
  `refresh`.
- Methods: `scrollTo`, `scrollToIndex` và `scrollToTop`.

### WindowDynamicVirtualScroll

Dùng `WindowDynamicVirtualScroll` cho trang hoặc feed dài khi muốn cửa sổ
trình duyệt là viewport cuộn thay vì một phần tử bên trong. Component đo các
hàng có chiều cao động và theo dõi `window.scrollY` cùng
`window.innerHeight`. Component này không có prop `height`.

#### Ví dụ

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
  <header>Nội dung phía trước virtual list</header>

  <WindowDynamicVirtualScroll
    ref="list"
    :items="feed"
    :estimated-item-size="320"
    :overscan="3"
    item-key="id"
    aria-label="Feed bài viết"
  >
    <template #default="{ item, index }">
      <article>
        <small>{{ index + 1 }}</small>
        <h2>{{ item.title }}</h2>
        <p>{{ item.summary }}</p>
      </article>
    </template>
  </WindowDynamicVirtualScroll>

  <footer>Nội dung phía sau virtual list</footer>
</template>
```

#### Props

| Prop | Kiểu | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | bắt buộc | Dữ liệu truyền vào default slot. |
| `estimatedItemSize` | `number` | `48` | Chiều cao trung bình ban đầu của hàng, tính bằng pixel. |
| `overscan` | `number` | `3` | Số hàng mount thêm trước và sau vùng đang hiển thị. |
| `itemKey` | `keyof T \| (item, index) => PropertyKey` | `id`, `key` hoặc index | Định danh ổn định dùng cho key và kết quả đo. |
| `ariaLabel` | `string` | `"Window dynamic virtual list"` | Nhãn hỗ trợ khả năng tiếp cận. |
| `hasMore` | `boolean` | `false` | Cho biết vẫn còn trang dữ liệu tiếp theo. |
| `loading` | `boolean` | `false` | Ngăn request trùng và hiển thị hàng loading. |
| `loadingItemSize` | `number` | `estimatedItemSize` | Chiều cao dành cho hàng loading, tính bằng pixel. |
| `loadMoreThreshold` | `number` | `200` | Khoảng cách giữa đáy cửa sổ và cuối danh sách để emit `load-more`. |
| `pullToRefresh` | `boolean` | `false` | Bật refresh khi trang đang ở `window.scrollY = 0`. |
| `refreshing` | `boolean` | `false` | Giữ indicator mở trong lúc refresh bất đồng bộ. |
| `pullRefreshThreshold` | `number` | `64` | Khoảng kéo cần thiết để emit `refresh`, tính bằng pixel. |

#### Slots, events và API qua ref

- Slots: `default({ item, index })`, `empty`, `loading` và
  `refresh({ pullDistance, progress, refreshing })`.
- Events: `scroll({ scrollTop, startIndex, endIndex })`, `load-more` và
  `refresh`. `scrollTop` được tính tương đối từ đầu component.
- Methods: `scrollTo`, `scrollToIndex` và `scrollToTop`. Các method này cuộn
  cửa sổ trình duyệt; `scrollTo` nhận offset tương đối so với đầu danh sách.

### ChatVirtualScroll

`ChatVirtualScroll` dành cho hội thoại có tin nhắn cao thấp khác nhau. Mặc định
component mở tại tin nhắn mới nhất, chỉ bám theo tin nhắn mới khi người dùng
đang gần cuối và giữ nguyên nội dung đang xem khi lịch sử cũ được thêm vào đầu.

#### Ví dụ

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
    aria-label="Hội thoại hỗ trợ"
    @load-older="loadOlder"
  >
    <template #default="{ item }">
      <MessageBubble :message="item" />
    </template>

    <template #loadingOlder>Đang tải tin nhắn cũ…</template>
    <template #empty>Chưa có tin nhắn.</template>
  </ChatVirtualScroll>

  <button v-if="!chat?.isAtBottom" @click="chat?.scrollToBottom('smooth')">
    Xem tin nhắn mới nhất
  </button>
</template>
```

Hãy thêm dữ liệu cũ vào đầu cùng một collection có key ổn định. Component tính
chiều cao được thêm phía trên viewport và khôi phục vị trí của người đọc.

#### Props

| Prop | Kiểu | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | bắt buộc | Tin nhắn được sắp từ cũ nhất tới mới nhất. |
| `estimatedItemSize` | `number` | `48` | Chiều cao trung bình ban đầu của tin nhắn, tính bằng pixel. |
| `height` | `number \| string` | `400` | Chiều cao viewport. Số được hiểu là pixel; `"fill"` tương đương `100%`. |
| `overscan` | `number` | `5` | Số tin nhắn mount thêm trước và sau vùng đang hiển thị. |
| `itemKey` | `keyof T \| (item, index) => PropertyKey` | `id`, `key` hoặc index | Định danh ổn định, đặc biệt quan trọng khi thêm vào đầu. |
| `ariaLabel` | `string` | `"Chat messages"` | Nhãn hỗ trợ khả năng tiếp cận cho live log. |
| `stickToBottom` | `boolean` | `true` | Bám theo tin nhắn mới nếu hiện tại đang gần cuối. |
| `bottomThreshold` | `number` | `80` | Khoảng cách vẫn được xem là “ở cuối”, tính bằng pixel. |
| `initialScroll` | `"top" \| "bottom"` | `"bottom"` | Vị trí ban đầu sau khi mount. |
| `hasOlder` | `boolean` | `false` | Cho biết vẫn còn lịch sử cũ. |
| `loadingOlder` | `boolean` | `false` | Ngăn request trùng và hiển thị indicator phía trên. |
| `loadOlderThreshold` | `number` | `120` | Khoảng cách tới đầu để emit `load-older`, tính bằng pixel. |

#### Slots

| Slot | Scope | Mô tả |
| --- | --- | --- |
| `default` | `{ item, index }` | Render từng tin nhắn đang được mount. |
| `empty` | không có | Render khi chưa có tin nhắn. |
| `loadingOlder` | không có | Status sticky phía trên; mặc định “Loading older messages…”. |

#### Events

| Event | Payload | Thời điểm emit |
| --- | --- | --- |
| `scroll` | `{ scrollTop, startIndex, endIndex }` | Khi container cuộn. |
| `load-older` | không có | Gần đầu khi `hasOlder` là true và `loadingOlder` là false. |
| `bottom-change` | `boolean` | Khi viewport đi vào hoặc rời ngưỡng ở cuối. |

#### API qua ref

| Member | Mô tả |
| --- | --- |
| `isAtBottom` | Boolean readonly cho biết người dùng có đang gần cuối hay không. |
| `scrollTo(position, options?)` | Cuộn tới offset pixel. |
| `scrollToIndex(index, { align?, behavior? })` | Cuộn tới index tin nhắn bắt đầu từ 0. |
| `scrollToTop(behavior?)` | Cuộn tới tin nhắn cũ nhất đã tải. |
| `scrollToBottom(behavior?)` | Cuộn tới tin nhắn mới nhất đã tải. |

### ShortMediaFeed

`ShortMediaFeed` là viewport headless có scroll snap theo chiều dọc cho reels,
stories hoặc media ngắn. Mỗi item chiếm trọn một viewport. Component quản lý
việc mount và điều hướng; slot của bạn chịu trách nhiệm cho video, hình ảnh,
playback, âm thanh và các nút điều khiển.

#### Ví dụ

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
    aria-label="Feed video"
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

    <template #empty>Không có media.</template>
  </ShortMediaFeed>
</template>
```

Với `buffer="1"`, component chỉ mount tối đa item active, một item phía trước
và một item phía sau. State cục bộ trong slot bị mất khi item rời buffer, vì
vậy hãy lưu playback state cần duy trì ở component cha.

#### Props

| Prop | Kiểu | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | bắt buộc | Dữ liệu media truyền vào default slot. |
| `activeIndex` | `number` | `0` | Index active bắt đầu từ 0; hỗ trợ `v-model:active-index`. |
| `buffer` | `number` | `1` | Số item mount thêm trước và sau item active. |
| `height` | `number \| string` | `"100dvh"` | Chiều cao viewport của feed. |
| `itemKey` | `keyof T \| (item, index) => PropertyKey` | `id`, `key` hoặc index | Định danh ổn định cho mỗi item. |
| `ariaLabel` | `string` | `"Short media feed"` | Nhãn hỗ trợ khả năng tiếp cận. |
| `hasMore` | `boolean` | `false` | Cho biết vẫn còn trang dữ liệu tiếp theo. |
| `loading` | `boolean` | `false` | Ngăn request `load-more` bị lặp. |
| `loadMoreThreshold` | `number` | `2` | Số item còn lại để kích hoạt `load-more`. |

#### Slots và events

| Loại | Tên | Payload/scope | Mô tả |
| --- | --- | --- | --- |
| Slot | `default` | `{ item, index, active }` | Render item đang mount; `active` đánh dấu item đang snap. |
| Slot | `empty` | không có | Render khi `items` rỗng. |
| Event | `update:activeIndex` | `number` | Hỗ trợ `v-model:active-index`. |
| Event | `change` | `{ index, item }` | Khi item active thay đổi. |
| Event | `reach-start` | không có | Khi điều hướng chuyển tới item đầu. |
| Event | `reach-end` | không có | Khi điều hướng chuyển tới item cuối. |
| Event | `load-more` | không có | Khi số item còn lại đạt `loadMoreThreshold`. |

#### API qua ref và bàn phím

`scrollToIndex(index, options?)` cuộn tới item bằng `ScrollToOptions` tiêu
chuẩn. Viewport hỗ trợ Arrow Up/Down, Page Up/Down, Home và End.

Với feed không giới hạn, hãy tải theo trang bằng `load-more` và chỉ giữ một cửa
sổ dữ liệu hợp lý ở component cha. Virtualization giới hạn DOM và media element
đang mount, nhưng không xóa object khỏi `items`.

### VirtualCarousel

`VirtualCarousel` là carousel headless có scroll snap ngang và virtualize các
slide. `activeIndex` là index của slide đầu tiên trong vùng nhìn hiện tại.

#### Ví dụ

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
    aria-label="Sản phẩm nổi bật"
  >
    <template #default="{ item, index, active, visible }">
      <ProductCard
        :product="item"
        :position="index"
        :active="active"
        :visible="visible"
      />
    </template>

    <template #empty>Không có sản phẩm.</template>
  </VirtualCarousel>

  <button @click="carousel?.previous()">Trước</button>
  <button @click="carousel?.next()">Sau</button>
</template>
```

Chiều rộng slide được tính theo công thức:

```text
(chiều rộng viewport - (slidesPerView - 1) × gap) / slidesPerView
```

`active` chỉ là true với slide đầu tiên trong vùng nhìn. `visible` là true với
mọi slide thuộc vùng nhìn đó. Khi hiển thị ba slide và buffer bằng một, thông
thường tối đa năm slide được mount ở giữa collection.

#### Props

| Prop | Kiểu | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | bắt buộc | Dữ liệu slide truyền vào default slot. |
| `activeIndex` | `number` | `0` | Slide đầu tiên đang hiển thị; hỗ trợ `v-model:active-index`. |
| `slidesPerView` | `number` | `1` | Số slide hiển thị cùng lúc. |
| `slidesToScroll` | `number` | `1` | Số slide di chuyển bởi `next()` và `previous()`. |
| `gap` | `number` | `0` | Khoảng cách giữa các slide, tính bằng pixel. |
| `buffer` | `number` | `1` | Số slide mount thêm trước và sau nhóm đang hiển thị. |
| `height` | `number \| string` | `"auto"` | Chiều cao carousel. |
| `itemKey` | `keyof T \| (item, index) => PropertyKey` | `id`, `key` hoặc index | Định danh ổn định cho mỗi slide. |
| `ariaLabel` | `string` | `"Carousel"` | Nhãn hỗ trợ khả năng tiếp cận. |
| `hasMore` | `boolean` | `false` | Cho biết vẫn còn trang dữ liệu tiếp theo. |
| `loading` | `boolean` | `false` | Ngăn request `load-more` bị lặp. |
| `loadMoreThreshold` | `number` | `2` | Số slide còn lại sau vùng nhìn để kích hoạt `load-more`. |
| `autoplay` | `boolean` | `false` | Bật chế độ tự động chuyển slide. |
| `autoplayDelay` | `number` | `3000` | Thời gian chờ giữa các lần tự động chuyển, tính bằng mili giây; giá trị dưới `1` được giới hạn và giá trị không hữu hạn dùng mặc định. |
| `autoplayLoop` | `boolean` | `true` | Quay lại slide đầu tiên khi đến cuối. |
| `pauseOnHover` | `boolean` | `true` | Tạm dừng autoplay khi con trỏ nằm trên carousel. |

#### Slots và events

| Loại | Tên | Payload/scope | Mô tả |
| --- | --- | --- | --- |
| Slot | `default` | `{ item, index, active, visible }` | Render từng slide đang mount. |
| Slot | `empty` | không có | Render khi `items` rỗng. |
| Event | `update:activeIndex` | `number` | Hỗ trợ `v-model:active-index`. |
| Event | `change` | `{ index, item }` | Khi slide đầu tiên trong vùng nhìn thay đổi. |
| Event | `reach-start` | không có | Khi điều hướng chuyển tới vị trí đầu. |
| Event | `reach-end` | không có | Khi điều hướng chuyển tới vị trí đầu-slide hợp lệ cuối cùng. |
| Event | `load-more` | không có | Khi số slide còn lại đạt `loadMoreThreshold`. |

#### API qua ref và bàn phím

| Method | Mô tả |
| --- | --- |
| `next(behavior?)` | Tiến thêm `slidesToScroll` slide; mặc định cuộn mượt. |
| `previous(behavior?)` | Lùi lại `slidesToScroll` slide. |
| `scrollToIndex(index, options?)` | Đưa index thành slide đầu tiên trong vùng nhìn. |
| `startAutoplay()` | Bắt đầu hoặc khởi động lại quá trình tự động chuyển slide. |
| `stopAutoplay()` | Dừng quá trình tự động chuyển slide. |

Viewport hỗ trợ Arrow Left/Right, Page Up/Down, Home và End. Smooth scroll ở
khoảng cách xa tự chuyển thành tức thời để không lộ khoảng trống virtualized.

#### Ví dụ autoplay

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

  <button @click="carousel?.stopAutoplay()">Tạm dừng</button>
  <button @click="carousel?.startAutoplay()">Tiếp tục</button>
</template>
```

Autoplay cũng tự bắt đầu khi collection `items` ban đầu rỗng nhận được dữ liệu.
`stopAutoplay()` tạm dừng timer và `startAutoplay()` tiếp tục chạy khi prop
`autoplay` vẫn được bật. Các thay đổi của `autoplayDelay`, `autoplayLoop` và
`pauseOnHover` có hiệu lực ngay trong lúc component đang chạy.

## Cách dùng chung

### Chiều cao viewport

Các component dùng container nhận một số hoặc chuỗi chiều cao CSS. Giá trị số
được đổi thành pixel. `height="fill"` là cách viết ngắn của
`height="100%"`:

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

Chiều cao phần trăm chỉ hoạt động khi thẻ cha có chiều cao xác định. Bản
development cảnh báo nếu viewport được tính thành `0px`.
`WindowDynamicVirtualScroll` dùng cửa sổ trình duyệt nên không có prop
`height`.

### Key ổn định cho item

Với object, component tự thử `item.id` rồi tới `item.key`. Item nguyên thủy dùng
index làm fallback. Hãy truyền `itemKey` nếu định danh có tên khác:

```vue
<VirtualList :items="users" item-key="uuid" />

<VirtualList
  :items="rows"
  :item-key="(row) => `${row.accountId}:${row.sequence}`"
/>
```

Key duy nhất và ổn định rất quan trọng khi thêm, xóa, thêm vào đầu hoặc sắp xếp
lại dữ liệu. Key cũng gắn kết quả đo chiều cao với đúng item.

### Tải thêm dữ liệu

Các component dạng list dùng ngưỡng khoảng cách pixel. `ShortMediaFeed` và
`VirtualCarousel` dùng ngưỡng số item còn lại.

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
    <template #loading>Đang tải trang tiếp theo…</template>
  </VirtualList>
</template>
```

Event chỉ emit tối đa một lần với số lượng item hiện tại. Nối thêm item sẽ cho
phép request tiếp theo. Giữ `loading` là true trong toàn bộ request và đặt
`hasMore` thành false sau trang cuối.

### Kéo để làm mới

Pull-to-refresh có trên `VirtualList`, `DynamicVirtualScroll`, `VirtualScroll`
và `WindowDynamicVirtualScroll`:

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
    {{ busy ? 'Đang làm mới…' : progress >= 1 ? 'Thả để làm mới' : 'Kéo xuống' }}
  </template>
</VirtualList>
```

Thao tác một ngón chỉ bắt đầu khi đang ở đầu danh sách. Đặt `refreshing` thành
true trong lúc chạy refresh bất đồng bộ, sau đó trả về false để đóng indicator.

## Các type được export

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

## Phát triển và phát hành

```bash
bun install
bunx playwright install chromium firefox webkit
bun run dev
bun run check
```

Playground có các demo riêng cho chiều cao cố định, chiều cao động, cuộn theo
cửa sổ, chat, load-more, short-media và carousel. Trước khi publish, hãy chạy
thêm `npm pack --dry-run`. GitHub Release được publish qua
`.github/workflows/publish.yml`.

## Đóng góp

Mọi issue và pull request đều được chào đón. Vui lòng đọc
[CONTRIBUTING.md](./CONTRIBUTING.md) trước khi gửi thay đổi.

## Giấy phép

[MIT](./LICENSE)
