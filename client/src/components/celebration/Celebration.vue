<script setup>
import { onMounted } from 'vue';

const props = defineProps({
  message: { type: String, default: 'Bien joué !' },
});
const emit = defineEmits(['done']);

// Sober confetti: a handful of falling accent-colored bars, not a screen-filling
// burst — the spec calls for "confetti discret", and prefers-reduced-motion
// already disables all animation globally (see styles/tokens.css).
const pieces = Array.from({ length: 18 }, (_, i) => ({
  left: Math.round(Math.random() * 100),
  delay: (Math.random() * 0.4).toFixed(2),
  hue: i % 3,
}));

onMounted(() => {
  const timer = setTimeout(() => emit('done'), 2200);
  return () => clearTimeout(timer);
});
</script>

<template>
  <div class="celebration" @click="$emit('done')">
    <div class="celebration__confetti">
      <span
        v-for="(p, i) in pieces"
        :key="i"
        class="celebration__piece"
        :class="`celebration__piece--${p.hue}`"
        :style="{ left: p.left + '%', animationDelay: p.delay + 's' }"
      ></span>
    </div>
    <div class="celebration__content">
      <span class="celebration__icon">🎯</span>
      <h2 class="celebration__message">{{ message }}</h2>
    </div>
  </div>
</template>

<style scoped>
.celebration {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(10, 8, 6, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.celebration__confetti { position: absolute; inset: 0; pointer-events: none; }
.celebration__piece {
  position: absolute;
  top: -20px;
  width: 6px;
  height: 14px;
  border-radius: 2px;
  animation: fall 1.8s ease-in forwards;
}
.celebration__piece--0 { background: var(--color-accent); }
.celebration__piece--1 { background: var(--color-cyan); }
.celebration__piece--2 { background: var(--color-violet); }
@keyframes fall {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(90vh) rotate(240deg); opacity: 0; }
}

.celebration__content {
  text-align: center;
  animation: pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes pop {
  0% { transform: scale(0.7); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.celebration__icon { font-size: 56px; display: block; margin-bottom: var(--space-3); }
.celebration__message { font-family: var(--font-display); font-size: 26px; color: var(--color-text); max-width: 28ch; }
</style>
