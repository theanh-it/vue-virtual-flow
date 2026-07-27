<script setup lang="ts">
import { computed, ref } from "vue";
import ChatVirtualScroll from "../../src/components/ChatVirtualScroll.vue";
import type { ChatVirtualScrollExpose } from "../../src/types";
import { feedItems } from "../data";

interface DemoMessage {
  id: string;
  author: string;
  text: string;
  own: boolean;
  type: "text" | "image" | "video";
  image?: string;
  video?: string;
  poster?: string;
}

const demoVideo =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const allMessages: DemoMessage[] = feedItems
  .slice(0, 200)
  .map((item, index) => {
    const type: DemoMessage["type"] =
      index % 9 === 2 ? "video" : index % 6 === 1 ? "image" : "text";

    return {
      id: item.id,
      author:
        index % 3 === 0 ? "You" : item.title.split(" ").slice(0, 2).join(" "),
      text: item.description,
      own: index % 3 === 0,
      type,
      image: type === "image" ? item.image : undefined,
      video: type === "video" ? demoVideo : undefined,
      poster: type === "video" ? item.image : undefined,
    };
  });
const firstMessage = ref(160);
const lastMessage = ref(180);
const loadingOlder = ref(false);
const chat = ref<ChatVirtualScrollExpose>();
const messages = computed(() =>
  allMessages.slice(firstMessage.value, lastMessage.value),
);
const hasOlder = computed(() => firstMessage.value > 0);

async function loadOlder() {
  if (loadingOlder.value || !hasOlder.value) return;

  loadingOlder.value = true;
  await new Promise((resolve) => window.setTimeout(resolve, 1_000));
  firstMessage.value = Math.max(0, firstMessage.value - 20);
  loadingOlder.value = false;
}

function appendMessage() {
  if (lastMessage.value < allMessages.length) {
    lastMessage.value += 1;
  }
}
</script>

<template>
  <section>
    <div class="heading">
      <div>
        <p class="eyebrow">Conversation viewport</p>
        <h1>Chat Virtual Scroll</h1>
        <p>
          Prepend history without jumping and follow new messages at bottom.
        </p>
      </div>

      <div class="chat-actions">
        <button type="button" @click="appendMessage">New message</button>
        <button
          class="secondary-button"
          type="button"
          @click="chat?.scrollToBottom('smooth')"
        >
          Latest
        </button>
      </div>
    </div>

    <ChatVirtualScroll
      ref="chat"
      :items="messages"
      :estimated-item-size="140"
      :height="560"
      :overscan="6"
      item-key="id"
      :has-older="hasOlder"
      :loading-older="loadingOlder"
      :load-older-threshold="100"
      aria-label="Community chat"
      @load-older="loadOlder"
    >
      <template #default="{ item }">
        <article
          class="chat-message"
          :class="{
            'chat-message--own': item.own,
            'chat-message--media': item.type !== 'text',
          }"
        >
          <div>
            <strong>{{ item.author }}</strong>

            <p v-if="item.type === 'text'">{{ item.text }}</p>

            <figure v-else-if="item.type === 'image'">
              <img
                :src="item.image"
                :alt="`Image shared by ${item.author}`"
                width="720"
                loading="lazy"
              />
              <figcaption>{{ item.text }}</figcaption>
            </figure>

            <figure v-else>
              <video
                controls
                playsinline
                preload="metadata"
                :poster="item.poster"
                :aria-label="`Video shared by ${item.author}`"
              >
                <source :src="item.video" type="video/mp4" />
                Your browser does not support HTML video.
              </video>
              <figcaption>{{ item.text }}</figcaption>
            </figure>
          </div>
        </article>
      </template>

      <template #loadingOlder>
        <div class="inline-loader">
          <span aria-hidden="true" />
          Loading older messages…
        </div>
      </template>
    </ChatVirtualScroll>
  </section>
</template>
