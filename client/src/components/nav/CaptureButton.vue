<script setup>
import { useRouter } from 'vue-router';
const router = useRouter();
</script>

<template>
  <button class="capture-btn" aria-label="Capture rapide" @click="router.push('/capture')">
    <span class="capture-btn__plus">+</span>
  </button>
</template>

<style scoped>
.capture-btn {
  position: fixed;
  left: 50%;
  bottom: calc(var(--nav-height) + var(--safe-bottom) - 28px);
  transform: translateX(-50%);
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: #100b04;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px var(--color-accent-glow);
  z-index: 41;
  transition: transform 0.15s ease;
}
.capture-btn:active { transform: translateX(-50%) scale(0.9); }
.capture-btn__plus { font-size: 28px; line-height: 1; font-weight: 600; }
</style>
