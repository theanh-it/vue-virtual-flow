# vue-virtual-flow

[English](./README.md) | [Tiếng Việt](./README.vi.md)

Bộ component virtual scrolling nhỏ gọn, có type đầy đủ và hỗ trợ khả năng tiếp
cận cho Vue 3. Thư viện hỗ trợ danh sách chiều cao cố định hoặc động, cuộn theo
cửa sổ, grid cuộn theo cửa sổ, giao diện chat, feed media ngắn và carousel ngang.

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
  - [WindowGirdVirtualScroll](#windowgirdvirtualscroll)
  - [ChatVirtualScroll](#chatvirtualscroll)
  - [ShortMediaFeed](#shortmediafeed)
  - [VirtualCarousel](#virtualcarousel)
  - [SkeletonLoader](#skeletonloader)
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

| Dependency | Yêu cầu |
| --- | --- |
| Vue | `^3.4.0` |
| Node.js | `>=18` |

## Bắt đầu nhanh

| Cách đăng ký | Cách dùng |
| --- | --- |
| Import cục bộ | `import { VirtualList, SkeletonLoader } from 'vue-virtual-flow'` |
| Plugin global | `createApp(App).use(VueVirtualScroll)` |
| Style dùng chung | `import 'vue-virtual-flow/style.css'` |

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
`WindowDynamicVirtualScroll`, `WindowGirdVirtualScroll`, `ChatVirtualScroll`,
`ShortMediaFeed`, `VirtualCarousel` và `SkeletonLoader`.

## Chọn component

| Component | Nên dùng khi | Viewport cuộn | Kích thước item |
| --- | --- | --- | --- |
| `VirtualList` | Cần danh sách đa dụng với cách dùng đơn giản nhất. | Container của component | Động, tự đo |
| `DynamicVirtualScroll` | Giống `VirtualList` nhưng tên gọi thể hiện rõ chiều cao động. | Container của component | Động, tự đo |
| `VirtualScroll` | Tất cả hàng có cùng chiều cao đã biết. | Container của component | Cố định |
| `WindowDynamicVirtualScroll` | Muốn trang cuộn thay vì tạo một container cuộn lồng bên trong. | Cửa sổ trình duyệt | Động, tự đo |
| `WindowGirdVirtualScroll` | Grid card có chiều cao cố định và dùng trang để cuộn. | Cửa sổ trình duyệt | Chiều cao hàng cố định |
| `ChatVirtualScroll` | Tin nhắn mới được thêm ở cuối và lịch sử cũ được thêm ở đầu. | Container của component | Động, tự đo |
| `ShortMediaFeed` | Mỗi lần cần snap một item đầy viewport. | Container của component | Một viewport cho mỗi item |
| `VirtualCarousel` | Cần hiển thị và snap nhiều slide theo chiều ngang. | Container của component | Tính từ chiều rộng container |
| `SkeletonLoader` | Cần hiển thị khối giữ chỗ khi đang tải nội dung. | Không có | Tùy chỉnh chiều rộng và chiều cao |

## Hướng dẫn từng component

Event được lắng nghe bằng cú pháp template của Vue; các method được gọi qua
ref của component. Các bảng bên dưới dùng tên ref là `list`, `chat`, `feed`
hoặc `carousel`.

| Thao tác | Cách dùng |
| --- | --- |
| Khai báo ref có type | `const list = ref<VirtualScrollExpose>()` |
| Gắn ref vào component | `<VirtualScroll ref="list" ... />` |
| Gọi sau khi mount trong script | `list.value?.scrollToIndex(10)` |
| Gọi từ event trong template | `@click="list?.scrollToIndex(10)"` |
| Chọn cách cuộn | Truyền `{ behavior: 'smooth' }` cho `scrollTo` / `scrollToIndex`, hoặc `'smooth'` cho `scrollToTop`, `scrollToBottom`, `next`, `previous`. |
| Căn vị trí item trong danh sách | `scrollToIndex(index, { align: 'start' })` / `'center'` / `'end'` |

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

| Event | Payload | Thời điểm emit | Cách dùng |
| --- | --- | --- | --- |
| `scroll` | `{ scrollTop, startIndex, endIndex }` | Khi container cuộn. `endIndex` là mốc không bao gồm item tại index đó. | `@scroll="onScroll"` |
| `load-more` | không có | Gần cuối danh sách khi `hasMore` là true và `loading` là false. | `@load-more="loadMore"` |
| `refresh` | không có | Khi kéo qua ngưỡng refresh rồi thả tay. | `@refresh="refreshFirstPage"` |

#### API qua ref

| Method / trạng thái | Mô tả | Ví dụ trong template |
| --- | --- | --- |
| `scrollTo(position, options?)` | Cuộn tới offset pixel bên trong danh sách. | `list?.scrollTo(200, { behavior: 'smooth' })` |
| `scrollToIndex(index, options?)` | Cuộn tới index bắt đầu từ 0. `align` nhận `start`, `center` hoặc `end`. | `list?.scrollToIndex(10, { behavior: 'smooth' })` |
| `scrollToTop(behavior?)` | Cuộn về đầu danh sách. | `list?.scrollToTop()` |

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

#### Slots

| Slot | Scope | Mô tả |
| --- | --- | --- |
| `default` | `{ item, index }` | Render từng hàng đang được mount. |
| `empty` | không có | Render khi `items` rỗng và `loading` là false. |
| `loading` | không có | Hàng loading; mặc định là “Loading more…”. |
| `refresh` | `{ pullDistance, progress, refreshing }` | Indicator kéo để làm mới. `progress` được giới hạn từ `0` tới `1`. |

#### Events

| Event | Payload | Thời điểm emit | Cách dùng |
| --- | --- | --- | --- |
| `scroll` | `{ scrollTop, startIndex, endIndex }` | Khi container cuộn. `endIndex` là mốc không bao gồm item tại index đó. | `@scroll="onScroll"` |
| `load-more` | không có | Gần cuối danh sách khi `hasMore` là true và `loading` là false. | `@load-more="loadMore"` |
| `refresh` | không có | Khi kéo qua ngưỡng refresh rồi thả tay. | `@refresh="refreshFirstPage"` |

#### API qua ref

| Method / trạng thái | Mô tả | Ví dụ trong template |
| --- | --- | --- |
| `scrollTo(position, options?)` | Cuộn tới offset pixel bên trong danh sách. | `list?.scrollTo(200, { behavior: 'smooth' })` |
| `scrollToIndex(index, options?)` | Cuộn tới item có index bắt đầu từ 0. `align` nhận `start`, `center` hoặc `end`. | `list?.scrollToIndex(10, { behavior: 'smooth' })` |
| `scrollToTop(behavior?)` | Cuộn về đầu danh sách. | `list?.scrollToTop()` |

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

#### Slots

| Slot | Scope | Mô tả |
| --- | --- | --- |
| `default` | `{ item, index }` | Render từng hàng đang được mount. |
| `empty` | không có | Render khi `items` rỗng và `loading` là false. |
| `loading` | không có | Hàng loading; mặc định là “Loading more…”. |
| `refresh` | `{ pullDistance, progress, refreshing }` | Indicator kéo để làm mới. `progress` được giới hạn từ `0` tới `1`. |

#### Events

| Event | Payload | Thời điểm emit | Cách dùng |
| --- | --- | --- | --- |
| `scroll` | `{ scrollTop, startIndex, endIndex }` | Khi cửa sổ cuộn. `scrollTop` tính tương đối từ đầu component. `endIndex` là mốc không bao gồm item tại index đó. | `@scroll="onScroll"` |
| `load-more` | không có | Gần cuối danh sách khi `hasMore` là true và `loading` là false. | `@load-more="loadMore"` |
| `refresh` | không có | Khi kéo qua ngưỡng refresh rồi thả tay. | `@refresh="refreshFirstPage"` |

#### API qua ref

| Method / trạng thái | Mô tả | Ví dụ trong template |
| --- | --- | --- |
| `scrollTo(position, options?)` | Cuộn cửa sổ tới offset pixel tương đối so với đầu danh sách. | `list?.scrollTo(200, { behavior: 'smooth' })` |
| `scrollToIndex(index, options?)` | Cuộn cửa sổ tới item có index bắt đầu từ 0. `align` nhận `start`, `center` hoặc `end`. | `list?.scrollToIndex(10, { behavior: 'smooth' })` |
| `scrollToTop(behavior?)` | Cuộn cửa sổ về đầu component. | `list?.scrollToTop()` |

### WindowGirdVirtualScroll

Dùng `WindowGirdVirtualScroll` cho grid nhiều cột có card với chiều cao cố định
đã biết và dùng cửa sổ trình duyệt làm viewport. Component virtualize theo cả
hàng để các cột đang hiển thị luôn được mount cùng nhau.

#### Ví dụ

```vue
<script setup lang="ts">
import { WindowGirdVirtualScroll } from 'vue-virtual-flow'

const products = Array.from({ length: 10_000 }, (_, id) => ({
  id,
  name: `Sản phẩm ${id + 1}`,
}))
</script>

<template>
  <WindowGirdVirtualScroll
    :items="products"
    :item-size="240"
    :columns="4"
    :gap="16"
    item-key="id"
    aria-label="Grid sản phẩm"
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

| Prop | Kiểu | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | bắt buộc | Dữ liệu truyền vào default slot. |
| `itemSize` | `number` | bắt buộc | Chiều cao cố định của mỗi hàng grid, tính bằng pixel. Nội dung vượt quá bị ẩn. |
| `columns` | `number` | `2` | Số cột trên mỗi hàng. |
| `gap` | `number` | `0` | Khoảng cách giữa các hàng và cột, tính bằng pixel. |
| `overscan` | `number` | `1` | Số hàng mount thêm trước và sau vùng đang hiển thị. |
| `itemKey` | `keyof T \| (item, index) => PropertyKey` | `id`, `key` hoặc index | Định danh ổn định cho mỗi item. |
| `ariaLabel` | `string` | `"Window virtual grid"` | Nhãn hỗ trợ khả năng tiếp cận cho grid. |
| `hasMore` | `boolean` | `false` | Cho biết vẫn còn trang dữ liệu tiếp theo. |
| `loading` | `boolean` | `false` | Ngăn request trùng và hiển thị hàng loading. |
| `loadingItemSize` | `number` | `itemSize` | Chiều cao dành cho hàng loading, tính bằng pixel. |
| `loadMoreThreshold` | `number` | `200` | Khoảng cách từ đáy cửa sổ tới cuối grid để emit `load-more`, tính bằng pixel. |
| `pullToRefresh` | `boolean` | `false` | Bật refresh khi trang đang ở `window.scrollY = 0`. |
| `refreshing` | `boolean` | `false` | Giữ indicator mở trong lúc refresh bất đồng bộ. |
| `pullRefreshThreshold` | `number` | `64` | Khoảng kéo cần thiết để emit `refresh`, tính bằng pixel. |

#### Slots

| Slot | Scope | Mô tả |
| --- | --- | --- |
| `default` | `{ item, index, rowIndex, columnIndex }` | Render từng ô đang được mount. |
| `empty` | không có | Render khi `items` rỗng và `loading` là false. |
| `loading` | không có | Hàng loading; mặc định là “Loading more…”. |
| `refresh` | `{ pullDistance, progress, refreshing }` | Indicator kéo để làm mới. `progress` được giới hạn từ `0` tới `1`. |

#### Events

| Event | Payload | Thời điểm emit | Cách dùng |
| --- | --- | --- | --- |
| `scroll` | `{ scrollTop, startIndex, endIndex }` | Khi cửa sổ cuộn. `scrollTop` tính tương đối từ đầu component. `endIndex` là mốc không bao gồm item tại index đó. | `@scroll="onScroll"` |
| `load-more` | không có | Gần cuối danh sách khi `hasMore` là true và `loading` là false. | `@load-more="loadMore"` |
| `refresh` | không có | Khi kéo qua ngưỡng refresh rồi thả tay. | `@refresh="refreshFirstPage"` |

#### API qua ref

| Method / trạng thái | Mô tả | Ví dụ trong template |
| --- | --- | --- |
| `scrollTo(position, options?)` | Cuộn cửa sổ tới offset pixel tương đối so với đầu danh sách. | `list?.scrollTo(200, { behavior: 'smooth' })` |
| `scrollToIndex(index, options?)` | Cuộn cửa sổ tới hàng chứa item có index bắt đầu từ 0. `align` nhận `start`, `center` hoặc `end`. | `list?.scrollToIndex(10, { behavior: 'smooth' })` |
| `scrollToTop(behavior?)` | Cuộn cửa sổ về đầu component. | `list?.scrollToTop()` |

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

Hãy thêm dữ liệu cũ vào đầu cùng một collection có key ổn định. Vùng cuộn lấy
đáy làm mốc nên việc thêm hoặc đo tin nhắn phía trên người đọc không cần sửa vị
trí cuộn native. Tin nhắn xuất hiện lần đầu được đo trước khi vẽ; các thay đổi chiều cao
được cập nhật riêng trong bảng chỉ mục.

Dùng các method qua ref và sự kiện `scroll` để thao tác với vị trí tính từ đầu
danh sách. Phần tử cuộn DOM bên trong dùng `scrollTop` âm (bằng 0 ở đáy); code
đọc hoặc ghi trực tiếp thuộc tính DOM này cần tính đến khác biệt đó. Thứ tự DOM
của tin nhắn vẫn từ cũ đến mới.

Để chat có ảnh/video cuộn mượt, hãy dành sẵn kích thước bằng `width`, `height`
hoặc `aspect-ratio`, đặt chiều cao ước lượng gần thực tế và tránh giới hạn `size`
quá thấp khiến mất phần lớn overscan. Đặt `loadOlderThreshold` đủ lớn để tải trang
kế tiếp trước khi người dùng chạm tin cũ nhất đã có; virtualization không thể che
độ trễ mạng sau khi đã chạm mốc này.

#### Props

| Prop | Kiểu | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | bắt buộc | Tin nhắn được sắp từ cũ nhất tới mới nhất. |
| `estimatedItemSize` | `number` | `48` | Chiều cao trung bình ban đầu của tin nhắn, tính bằng pixel. |
| `height` | `number \| string` | `400` | Chiều cao viewport. Số được hiểu là pixel; `"fill"` tương đương `100%`. |
| `overscan` | `number` | `5` | Số tin nhắn mount thêm trước và sau vùng đang hiển thị. |
| `size` | `number` | không đặt | Giới hạn tổng số tin nhắn render, bao gồm overscan, ví dụ `:size="12"` cho mobile. Giảm overscan trước; luôn render đủ vùng nhìn dù phải vượt `size`. Không tăng số tin nhắn vượt phạm vi `overscan`. Số dương được làm tròn xuống (tối thiểu 1); số không dương hoặc không hữu hạn sẽ tắt giới hạn. |
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

| Event | Payload | Thời điểm emit | Cách dùng |
| --- | --- | --- | --- |
| `scroll` | `{ scrollTop, startIndex, endIndex }` | Khi container cuộn. | `@scroll="onScroll"` |
| `load-older` | không có | Gần đầu khi `hasOlder` là true và `loadingOlder` là false. | `@load-older="loadOlder"` |
| `bottom-change` | `boolean` | Khi viewport đi vào hoặc rời ngưỡng ở cuối. | `@bottom-change="onBottomChange"` |

#### API qua ref

| Method / trạng thái | Mô tả | Ví dụ trong template |
| --- | --- | --- |
| `isAtBottom` | Boolean readonly cho biết người dùng có đang gần cuối hay không. | `chat?.isAtBottom` |
| `scrollTo(position, options?)` | Cuộn tới offset pixel. | `chat?.scrollTo(200, { behavior: 'smooth' })` |
| `scrollToIndex(index, options?)` | Cuộn tới index tin nhắn bắt đầu từ 0. | `chat?.scrollToIndex(10, { behavior: 'smooth' })` |
| `scrollToTop(behavior?)` | Cuộn tới tin nhắn cũ nhất đã tải. | `chat?.scrollToTop()` |
| `scrollToBottom(behavior?)` | Cuộn tới tin nhắn mới nhất đã tải. | `chat?.scrollToBottom('smooth')` |

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

#### Slots

| Slot | Scope | Mô tả |
| --- | --- | --- |
| `default` | `{ item, index, active }` | Render item đang mount; `active` đánh dấu item đang snap. |
| `empty` | không có | Render khi `items` rỗng. |

#### Events

| Event | Payload | Thời điểm emit | Cách dùng |
| --- | --- | --- | --- |
| `update:activeIndex` | `number` | Hỗ trợ `v-model:active-index`. | `v-model:active-index="activeIndex"` |
| `change` | `{ index, item }` | Khi item active thay đổi. | `@change="onChange"` |
| `reach-start` | không có | Khi điều hướng chuyển tới item đầu. | `@reach-start="onReachStart"` |
| `reach-end` | không có | Khi điều hướng chuyển tới item cuối. | `@reach-end="onReachEnd"` |
| `load-more` | không có | Khi số item còn lại đạt `loadMoreThreshold`. | `@load-more="loadMore"` |

#### API qua ref

| Method / trạng thái | Mô tả | Ví dụ trong template |
| --- | --- | --- |
| `scrollToIndex(index, options?)` | Cuộn tới item có index bắt đầu từ 0, nhận `ScrollToOptions` chuẩn. | `feed?.scrollToIndex(10, { behavior: 'smooth' })` |

#### Điều khiển bàn phím

Các phím sau hoạt động khi viewport có focus:

| Phím | Thao tác |
| --- | --- |
| `ArrowDown`, `PageDown` | Chuyển tới item tiếp theo. |
| `ArrowUp`, `PageUp` | Chuyển tới item trước. |
| `Home` | Chuyển tới vị trí đầu. |
| `End` | Chuyển tới item cuối. |

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
| `responsive` | `ResponsiveBreakpoint[]` | `undefined` | Ghi đè số slide hiển thị, bước cuộn và khoảng cách theo breakpoint chiều rộng container. |

#### Cấu hình responsive

Component chọn `breakpoint` lớn nhất không vượt quá chiều rộng container của
carousel. Nếu không có breakpoint phù hợp, component dùng các prop gốc.
Trường bị bỏ qua dùng prop gốc, không kế thừa từ breakpoint khác.

| Trường | Kiểu | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `breakpoint` | `number` | bắt buộc | Chiều rộng tối thiểu của container, tính bằng pixel. |
| `slidesPerView` | `number` | `slidesPerView` | Số slide hiển thị tại breakpoint này. |
| `slidesToScroll` | `number` | `slidesToScroll` | Số slide di chuyển bởi `next()` và `previous()`. |
| `gap` | `number` | `gap` | Khoảng cách giữa các slide, tính bằng pixel. |

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

| Slot | Scope | Mô tả |
| --- | --- | --- |
| `default` | `{ item, index, active, visible }` | Render từng slide đang mount. |
| `empty` | không có | Render khi `items` rỗng. |

#### Events

| Event | Payload | Thời điểm emit | Cách dùng |
| --- | --- | --- | --- |
| `update:activeIndex` | `number` | Hỗ trợ `v-model:active-index`. | `v-model:active-index="activeIndex"` |
| `change` | `{ index, item }` | Khi slide đầu tiên trong vùng nhìn thay đổi. | `@change="onChange"` |
| `reach-start` | không có | Khi điều hướng chuyển tới vị trí đầu. | `@reach-start="onReachStart"` |
| `reach-end` | không có | Khi điều hướng chuyển tới vị trí đầu-slide hợp lệ cuối cùng. | `@reach-end="onReachEnd"` |
| `load-more` | không có | Khi số slide còn lại đạt `loadMoreThreshold`. | `@load-more="loadMore"` |

#### API qua ref

| Method / trạng thái | Mô tả | Ví dụ trong template |
| --- | --- | --- |
| `next(behavior?)` | Tiến thêm `slidesToScroll` slide; mặc định cuộn mượt. | `carousel?.next()` |
| `previous(behavior?)` | Lùi lại `slidesToScroll` slide. | `carousel?.previous()` |
| `scrollToIndex(index, options?)` | Đưa index thành slide đầu tiên trong vùng nhìn. | `carousel?.scrollToIndex(10, { behavior: 'smooth' })` |
| `startAutoplay()` | Bắt đầu hoặc khởi động lại timer khi `autoplay` là true và có item. | `carousel?.startAutoplay()` |
| `stopAutoplay()` | Xóa timer hiện tại; đặt `autoplay=false` nếu muốn giữ chế độ tự động ở trạng thái tắt. | `carousel?.stopAutoplay()` |

#### Điều khiển bàn phím

Các phím sau hoạt động khi viewport có focus:

| Phím | Thao tác |
| --- | --- |
| `ArrowRight`, `PageDown` | Tiến thêm `slidesToScroll` slide, tương đương `next()`. |
| `ArrowLeft`, `PageUp` | Lùi lại `slidesToScroll` slide, tương đương `previous()`. |
| `Home` | Chuyển tới vị trí đầu. |
| `End` | Chuyển tới vị trí đầu-slide hợp lệ cuối cùng. |

Smooth scroll ở khoảng cách xa tự chuyển thành tức thời để không lộ khoảng
trống virtualized.

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

| Thao tác / điều kiện | Kết quả |
| --- | --- |
| `autoplay=true` | Tự chạy, kể cả khi collection `items` ban đầu rỗng nhận được dữ liệu. |
| `stopAutoplay()` | Xóa timer hiện tại. Điều hướng hoặc sự kiện con trỏ sau đó có thể khởi động lại nếu `autoplay` vẫn là true. |
| `startAutoplay()` | Bắt đầu hoặc khởi động lại timer khi `autoplay` là true và có item. |
| `autoplay=false` | Tắt tự động chuyển slide cho tới khi prop được bật lại. |
| `autoplayLoop` | Khi tới cuối, true quay về đầu; false dừng timer. |
| `pauseOnHover` | Khi là true, rê chuột vào sẽ tạm dừng; rời chuột sẽ chạy tiếp nếu autoplay đang bật. |
| Đổi cấu hình autoplay | `autoplayDelay`, `autoplayLoop` và `pauseOnHover` có hiệu lực ngay khi component đang chạy. |

### SkeletonLoader

`SkeletonLoader` hiển thị khối giữ chỗ với hiệu ứng shimmer. Có thể dùng độc lập
hoặc trong slot `loading` của danh sách. Component luôn hiển thị khi được mount;
dùng `v-if` để điều khiển khi dùng độc lập, hoặc để prop `loading` của danh sách
điều khiển slot.

#### Ví dụ

Import stylesheet của thư viện một lần như bên dưới hoặc tại entry point của
ứng dụng. Đặt `loading` thành false khi request dữ liệu hoàn tất.

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
    aria-label="Đang tải nội dung…"
  />
  <p v-else>Nội dung đã sẵn sàng.</p>
</template>
```

#### Props

| Prop | Kiểu | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `width` | `number \| string` | `'100%'` | Chiều rộng: số tính bằng pixel, chuỗi nhận độ dài CSS như `'60%'` hoặc `'12rem'`. |
| `height` | `number \| string` | `16` | Chiều cao: số tính bằng pixel, chuỗi nhận độ dài CSS. |
| `variant` | `'rectangle' \| 'rounded' \| 'circle'` | `'rounded'` | Hình dạng khối giữ chỗ. Đặt chiều rộng bằng chiều cao để tạo hình tròn. |
| `animated` | `boolean` | `true` | Bật hiệu ứng shimmer. |
| `ariaLabel` | `string` | `'Loading…'` | Nhãn cho trình đọc màn hình của khối có `role="status"`. |

```vue
<SkeletonLoader variant="circle" :width="48" :height="48" />
<SkeletonLoader variant="rectangle" :height="180" />
<SkeletonLoader width="60%" :height="20" :animated="false" />
```

Hiệu ứng tự dừng khi người dùng bật tùy chọn giảm chuyển động. Khi ghép nhiều
skeleton trang trí cùng một thông báo loading chung, truyền `aria-hidden="true"`
cho từng skeleton để tránh lặp nhãn với trình đọc màn hình.

#### Slots, events và API qua ref

| API | Hỗ trợ |
| --- | --- |
| Slots | Không có. Component render một khối giữ chỗ. |
| Events | Không có event tùy chỉnh. |
| Method qua ref | Không có. Điều khiển component bằng props và `v-if`. |

#### Thao tác

| Thao tác | Cách dùng |
| --- | --- |
| Hiện hoặc ẩn | `<SkeletonLoader v-if="loading" />` |
| Dùng hình tròn | `<SkeletonLoader variant="circle" :width="48" :height="48" />` |
| Tắt shimmer | `<SkeletonLoader :animated="false" />` |
| Đặt nhãn cho trình đọc màn hình | `aria-label="Đang tải…"` |
| Ẩn skeleton trang trí khỏi trình đọc màn hình | `aria-hidden="true"` |

#### Dùng trong slot loading

Import `SkeletonLoader` cùng với `VirtualList`. Với state `items` và `loading`
hiện có, thay thông báo loading bằng skeleton:

```vue
<VirtualList :items="items" :loading="loading" :loading-item-size="64">
  <template #default="{ item }"><FeedCard :item="item" /></template>
  <template #loading>
    <SkeletonLoader :height="40" aria-label="Đang tải trang tiếp theo…" />
  </template>
</VirtualList>
```

| Cấu hình | Cách dùng |
| --- | --- |
| Component hỗ trợ slot `loading` | `VirtualList`, `DynamicVirtualScroll`, `VirtualScroll`, `WindowDynamicVirtualScroll`, `WindowGirdVirtualScroll`. |
| `loading` trên danh sách | Đặt thành true để hiển thị slot; false để ẩn. |
| `height` trên skeleton | Đặt chiều cao khối giữ chỗ, ví dụ `40` pixel. |
| `loadingItemSize` trên danh sách | Dành đủ chỗ cho skeleton và padding dọc của hàng. Ví dụ: `40px + 1.5rem = 64px` với cỡ chữ gốc 16px. |

#### Tùy chỉnh giao diện

Đặt các biến CSS sau trên skeleton hoặc phần tử cha:

| Biến CSS | Mặc định | Mô tả |
| --- | --- | --- |
| `--skeleton-background` | `#e2e8f0` | Màu nền. |
| `--skeleton-highlight` | `rgb(255 255 255 / 60%)` | Màu vệt sáng của hiệu ứng shimmer. |
| `--skeleton-radius` | `8px` | Bán kính bo góc cho variant `rounded`. |

```vue
<SkeletonLoader
  :height="80"
  style="--skeleton-background: #334155; --skeleton-highlight: #475569; --skeleton-radius: 12px"
/>
```

## Cách dùng chung

### Chiều cao viewport

| Giá trị / component | Cách hoạt động |
| --- | --- |
| `:height="400"` | Giá trị số được đổi thành pixel. |
| `height="60vh"` | Chuỗi chiều cao CSS được giữ nguyên. |
| `height="fill"` / `height="100%"` | Dùng chiều cao phần tử cha. Thẻ cha cần có chiều cao xác định; bản development cảnh báo nếu viewport tính thành `0px`. |
| `WindowDynamicVirtualScroll`, `WindowGirdVirtualScroll` | Dùng cửa sổ trình duyệt và không nhận prop `height`. |

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

### Key ổn định cho item

| Cấu hình / dữ liệu | Cách chọn key |
| --- | --- |
| `:item-key="(item, index) => …"` | Dùng giá trị hàm trả về. |
| `item-key="uuid"` | Dùng `item.uuid` hợp lệ; nếu không có, thử `id`, `key`, rồi index. |
| Object không truyền `itemKey` | Thử `item.id`, sau đó `item.key`, rồi index. |
| Giá trị nguyên thủy không có hàm key | Dùng index làm fallback. |

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

| Component | `loadMoreThreshold` | Event |
| --- | --- | --- |
| `VirtualList`, `DynamicVirtualScroll`, `VirtualScroll`, `WindowDynamicVirtualScroll`, `WindowGirdVirtualScroll` | Khoảng cách tới cuối danh sách, tính bằng pixel. | `load-more` |
| `ShortMediaFeed` | Số item phía sau item active. | `load-more` |
| `VirtualCarousel` | Số slide phía sau nhóm đang hiển thị. | `load-more` |

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

| Bước / điều kiện | Thao tác / kết quả |
| --- | --- |
| Nhận `load-more` | Chỉ bắt đầu request tiếp theo khi `loading` là false và `hasMore` là true. |
| Request đang chạy | Giữ `loading=true` trong toàn bộ request. |
| Nhận trang tiếp theo | Nối thêm item. Event thông thường chỉ emit một lần với số lượng item hiện tại; tăng số lượng cho phép request tiếp theo. |
| Request hoàn tất | Đặt `loading=false`; dùng `finally` khi request có thể thất bại. |
| Trang cuối | Đặt `hasMore=false` để ngừng request tiếp theo. |

### Kéo để làm mới

| Component | Vị trí bắt đầu thao tác |
| --- | --- |
| `VirtualList`, `DynamicVirtualScroll`, `VirtualScroll` | Đầu container của component. |
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
    {{ busy ? 'Đang làm mới…' : progress >= 1 ? 'Thả để làm mới' : 'Kéo xuống' }}
  </template>
</VirtualList>
```

| Bước / trạng thái | Thao tác / kết quả |
| --- | --- |
| Bật thao tác | `pull-to-refresh` |
| Kéo xuống bằng một ngón khi đang ở đầu | Cập nhật scope của slot `refresh`: `pullDistance`, `progress` và `refreshing`. |
| Thả sau khi đạt `pullRefreshThreshold` | Emit `refresh` không có payload. |
| Xử lý `refresh` | Đặt `refreshing=true` trong lúc tải lại dữ liệu để giữ indicator mở. |
| Hoàn tất làm mới | Đặt `refreshing=false` để đóng indicator. |

## Các type được export

| Type | Mục đích |
| --- | --- |
| `ChatVirtualScrollExpose` | API ref và trạng thái `isAtBottom` của chat. |
| `ChatVirtualScrollProps<T>` | Props của component chat. |
| `DynamicVirtualScrollProps<T>` | Props của danh sách chiều cao động. |
| `ItemKey<T>` | Tên thuộc tính hoặc hàm xác định key của item. |
| `ResponsiveBreakpoint` | Breakpoint container và cấu hình ghi đè của carousel. |
| `ScrollAlignment` | `'start'`, `'center'` hoặc `'end'` khi cuộn tới index trong danh sách. |
| `ShortMediaFeedChangeEvent<T>` | Payload event `change` của feed: `{ index, item }`. |
| `ShortMediaFeedExpose` | API ref của feed. |
| `ShortMediaFeedProps<T>` | Props của feed. |
| `SkeletonLoaderProps` | Kích thước, hình dạng, hiệu ứng và nhãn hỗ trợ tiếp cận của skeleton. |
| `VirtualCarouselChangeEvent<T>` | Payload event `change` của carousel: `{ index, item }`. |
| `VirtualCarouselExpose` | API ref điều hướng và autoplay của carousel. |
| `VirtualCarouselProps<T>` | Props của carousel, gồm cấu hình responsive. |
| `VirtualListExpose` | Alias của `VirtualScrollExpose`. |
| `VirtualListProps<T>` | Alias của `DynamicVirtualScrollProps<T>`. |
| `VirtualScrollEvent` | Payload scroll: `{ scrollTop, startIndex, endIndex }`; `endIndex` không bao gồm item tại index đó. |
| `VirtualScrollExpose` | API ref chung cho danh sách cố định, động và danh sách/grid cuộn theo cửa sổ. |
| `VirtualScrollProps<T>` | Props của danh sách chiều cao cố định. |
| `WindowDynamicVirtualScrollProps<T>` | Props của danh sách chiều cao động cuộn theo cửa sổ. |
| `WindowGirdVirtualScrollProps<T>` | Props của grid hàng cố định cuộn theo cửa sổ. |

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

## Phát triển và phát hành

| Lệnh / lifecycle | Thao tác |
| --- | --- |
| `bun install` | Cài đặt dependency. |
| `bunx playwright install chromium firefox webkit` | Cài trình duyệt cho smoke test. |
| `bun run dev` | Chạy playground. |
| `bun run typecheck` | Kiểm tra type TypeScript và Vue. |
| `bun run test` | Chạy unit test. |
| `bun run test:watch` | Chạy unit test ở chế độ theo dõi thay đổi. |
| `bun run build` | Kiểm tra type và build package kèm khai báo type. |
| `bun run typecheck:package` | Kiểm tra type phía dùng package ESM và CommonJS sau khi build. |
| `bun run lint:package` | Kiểm tra exports và cách đóng gói type sau khi build. |
| `bun run test:browser` | Chạy test trình duyệt bằng Playwright. |
| `bun run check` | Chạy toàn bộ: unit test, build, type phía dùng package, lint package và test trình duyệt. |
| `npm pack --dry-run` | Kiểm tra các file sẽ được publish. |
| `prepublishOnly` | Tự chạy `bun run check` trước khi publish. |

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
