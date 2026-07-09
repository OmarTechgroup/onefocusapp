<script setup>
import { useRouter } from 'vue-router';
import { NAV_ITEMS } from './navItems';
const router = useRouter();
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__brand">
      <span class="sidebar__dot"></span>
      <span class="sidebar__title">OneFocus</span>
    </div>
    <nav class="sidebar__nav">
      <router-link v-for="item in NAV_ITEMS" :key="item.to" :to="item.to" class="sidebar__item" active-class="is-active">
        <span class="sidebar__icon">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </router-link>
    </nav>
    <button class="sidebar__capture" @click="router.push('/capture')">
      <span>+</span> Capture rapide
    </button>
  </aside>
</template>

<style scoped>
.sidebar {
  border-right: 1px solid var(--color-border);
  padding: var(--space-6) var(--space-5);
  flex-direction: column;
  gap: var(--space-6);
  position: sticky;
  top: 0;
  height: 100vh;
}
.sidebar__brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.sidebar__dot {
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 12px var(--color-accent-glow);
}
.sidebar__title {
  font-family: var(--font-display);
  font-size: 20px;
}
.sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.sidebar__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--color-text-dim);
  font-weight: 500;
  transition: background 0.15s ease, color 0.15s ease;
}
.sidebar__item:hover { background: var(--color-bg-card); color: var(--color-text); }
.sidebar__item.is-active { background: var(--color-bg-card); color: var(--color-accent); }
.sidebar__icon { font-size: 18px; }
.sidebar__capture {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: var(--color-accent);
  color: #100b04;
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  font-weight: 600;
}
</style>
