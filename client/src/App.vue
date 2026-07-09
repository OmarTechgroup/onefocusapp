<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import BottomNav from './components/nav/BottomNav.vue';
import Sidebar from './components/nav/Sidebar.vue';
import CaptureButton from './components/nav/CaptureButton.vue';

const route = useRoute();
const showNav = computed(() => !route.meta.hideNav);
</script>

<template>
  <div class="shell">
    <Sidebar v-if="showNav" class="shell__sidebar" />
    <main class="shell__main" :class="{ 'shell__main--with-bottom-nav': showNav }">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <BottomNav v-if="showNav" class="shell__bottom-nav" />
    <CaptureButton v-if="showNav" class="shell__capture" />
  </div>
</template>

<style>
.shell {
  min-height: 100vh;
  min-height: 100dvh;
}
.shell__main {
  padding: var(--space-4);
  padding-top: calc(var(--safe-top) + var(--space-5));
  max-width: 1100px;
  margin: 0 auto;
}
.shell__main--with-bottom-nav {
  padding-bottom: calc(var(--nav-height) + var(--safe-bottom) + var(--space-5));
}
.shell__bottom-nav { display: none; }
.shell__sidebar { display: none; }
.shell__capture { display: none; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.fade-enter-from { opacity: 0; transform: translateY(6px); }
.fade-leave-to { opacity: 0; transform: translateY(-6px); }

@media (max-width: 767px) {
  .shell__bottom-nav { display: flex; }
  .shell__capture { display: flex; }
}

@media (min-width: 768px) {
  .shell {
    display: grid;
    grid-template-columns: 260px 1fr;
  }
  .shell__sidebar { display: flex; }
  .shell__main {
    padding: var(--space-6) var(--space-7);
    padding-top: calc(var(--safe-top) + var(--space-6));
    max-width: 1400px;
  }
  .shell__main--with-bottom-nav { padding-bottom: var(--space-6); }
}
</style>
