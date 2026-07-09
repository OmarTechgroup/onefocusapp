<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../../api';
import QuoteFullScreen from './QuoteFullScreen.vue';

const quote = ref(null);
const showFullScreen = ref(false);

async function load() {
  quote.value = await api.get('/quotes/today');
}

onMounted(load);
</script>

<template>
  <section v-if="quote" class="quote-card" @click="showFullScreen = true">
    <span class="quote-card__mark">“</span>
    <p class="quote-card__text">{{ quote.text }}</p>
    <p v-if="quote.author" class="quote-card__author">— {{ quote.author }}</p>

    <QuoteFullScreen v-if="showFullScreen" :quote="quote" @close="showFullScreen = false" />
  </section>
</template>

<style scoped>
.quote-card {
  padding: var(--space-5);
  background: linear-gradient(155deg, var(--color-bg-card), var(--color-bg-elevated));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.quote-card:hover { border-color: var(--color-accent-dim); }
.quote-card__mark { font-family: var(--font-display); font-size: 34px; color: var(--color-accent); line-height: 0.6; display: block; }
.quote-card__text {
  font-family: var(--font-display);
  font-size: 17px;
  line-height: 1.45;
  color: var(--color-text);
  margin-top: var(--space-2);
}
.quote-card__author { color: var(--color-text-faint); font-size: 13px; margin-top: var(--space-2); }
</style>
