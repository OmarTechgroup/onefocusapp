import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', name: 'today', component: () => import('../views/TodayView.vue'), meta: { tab: 'today' } },
  { path: '/missions', name: 'missions', component: () => import('../views/MissionsView.vue'), meta: { tab: 'missions' } },
  { path: '/capture', name: 'capture', component: () => import('../views/CaptureView.vue'), meta: { tab: 'capture' } },
  { path: '/stats', name: 'stats', component: () => import('../views/StatsView.vue'), meta: { tab: 'stats' } },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { tab: 'settings' } },
  { path: '/focus/:taskId?', name: 'focus', component: () => import('../views/FocusView.vue'), meta: { hideNav: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
