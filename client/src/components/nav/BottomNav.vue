<script setup>
import { NAV_ITEMS } from './navItems';

const left = NAV_ITEMS.slice(0, 2);
const right = NAV_ITEMS.slice(2);
</script>

<template>
  <nav class="bottom-nav">
    <router-link v-for="item in left" :key="item.to" :to="item.to" class="bottom-nav__item" active-class="is-active">
      <span class="bottom-nav__icon">{{ item.icon }}</span>
      <span class="bottom-nav__label">{{ item.label }}</span>
    </router-link>
    <span class="bottom-nav__spacer" aria-hidden="true"></span>
    <router-link v-for="item in right" :key="item.to" :to="item.to" class="bottom-nav__item" active-class="is-active">
      <span class="bottom-nav__icon">{{ item.icon }}</span>
      <span class="bottom-nav__label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  height: calc(var(--nav-height) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: var(--color-bg-elevated);
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: stretch;
  z-index: 40;
  backdrop-filter: blur(12px);
}
.bottom-nav__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--color-text-faint);
  font-size: 11px;
  transition: color 0.15s ease, transform 0.15s ease;
}
.bottom-nav__item.is-active {
  color: var(--color-accent);
}
.bottom-nav__item:active { transform: scale(0.92); }
.bottom-nav__icon { font-size: 20px; }
.bottom-nav__spacer { width: 56px; }
</style>
