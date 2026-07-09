<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { useFocusStore } from '../stores/focus';
import CheckinModal from '../components/checkin/CheckinModal.vue';
import Celebration from '../components/celebration/Celebration.vue';
import { getNextTask } from '../composables/useNextTask';
import { api } from '../api';

const route = useRoute();
const router = useRouter();
const store = useFocusStore();

const showAbandonConfirm = ref(false);
const showRecapCheckin = ref(false);
const showCelebration = ref(false);
const summaryQuote = ref(null);
let intervalId = null;

const minutes = computed(() => String(Math.floor(store.remainingSeconds / 60)).padStart(2, '0'));
const seconds = computed(() => String(store.remainingSeconds % 60).padStart(2, '0'));

// SVG circle: circumference-based stroke-dashoffset drives the "breathing" progress ring.
const RADIUS = 120;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const dashOffset = computed(() => CIRCUMFERENCE * (1 - store.progressRatio));

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch {
    // Web Audio unavailable — silent fallback is fine, the summary screen still shows.
  }
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

async function completeStep(step) {
  await store.completeStep(step.id);
  vibrate(20);
}

function requestAbandon() {
  showAbandonConfirm.value = true;
}

async function confirmAbandon() {
  showAbandonConfirm.value = false;
  await store.finish({ abandon: true });
  router.push('/');
}

function cancelAbandon() {
  showAbandonConfirm.value = false;
}

async function finishNow() {
  const wasDnd = store.doNotDisturb;
  const isOneThing = !!store.task?.is_one_thing;
  await store.finish({ abandon: false });
  if (isOneThing && store.summary?.completed) showCelebration.value = true;
  if (wasDnd) showRecapCheckin.value = true;
  summaryQuote.value = await api.get('/quotes/random').catch(() => null);
}

async function backToToday() {
  // Task just completed: hand the suggestion to Today via the store (it outlives
  // this component) rather than showing the modal here — navigating away from
  // /focus/:taskId doesn't force-remount this view for a different :taskId, so
  // we can't just push a new focus route and keep this modal instance around.
  if (store.summary?.completed && store.task) {
    store.pendingSuggestion = await getNextTask(store.task.id);
  }
  store.reset();
  router.push('/');
}

function onVisibilityChange() {
  if (document.hidden) store.registerInterruption();
}

onMounted(async () => {
  await store.init(route.params.taskId);
  intervalId = setInterval(() => {
    const was = store.remainingSeconds;
    store.tick();
    if (was > 0 && store.remainingSeconds <= 0) {
      playChime();
      vibrate([80, 40, 80]);
      finishNow();
    }
  }, 1000);
  document.addEventListener('visibilitychange', onVisibilityChange);
});

onBeforeUnmount(() => {
  clearInterval(intervalId);
  document.removeEventListener('visibilitychange', onVisibilityChange);
});

// Leaving the route directly (back button, etc.) is treated the same as the explicit
// "abandon" action so the server-side task status never gets stuck as "active".
onBeforeRouteLeave((to, from, next) => {
  if (store.phase === 'running' && !showAbandonConfirm.value) {
    requestAbandon();
    next(false);
  } else {
    next();
  }
});
</script>

<template>
  <div class="focus">
    <div v-if="store.phase === 'loading'" class="focus__center">
      <div class="skeleton" style="width: 260px; height: 260px; border-radius: 999px"></div>
    </div>

    <div v-else-if="store.phase === 'error'" class="focus__center">
      <p class="focus__error">{{ store.error }}</p>
      <router-link to="/" class="focus__link">← Retour</router-link>
    </div>

    <template v-else-if="store.phase === 'summary'">
      <section class="focus__summary">
        <h2 class="focus__summary-title">
          {{ store.summary.completed ? 'Session terminée 🎉' : 'Session enregistrée' }}
        </h2>
        <p class="focus__summary-task">{{ store.task?.title }}</p>
        <div class="focus__summary-stats">
          <div class="stat">
            <span class="stat__value mono">{{ store.summary.actualMinutes }}</span>
            <span class="stat__label">minutes réelles</span>
          </div>
          <div class="stat">
            <span class="stat__value mono">{{ store.summary.stepsDone }}/{{ store.summary.stepsTotal }}</span>
            <span class="stat__label">étapes faites</span>
          </div>
          <div class="stat">
            <span class="stat__value mono">{{ store.summary.interruptions }}</span>
            <span class="stat__label">interruptions</span>
          </div>
        </div>
        <p v-if="summaryQuote" class="focus__summary-quote">💬 {{ summaryQuote.text }}</p>
        <button class="focus__cta" @click="backToToday">Retour à Aujourd'hui</button>
      </section>
    </template>

    <template v-else>
      <button class="focus__abandon" @click="requestAbandon" aria-label="Abandonner la session">✕</button>
      <button
        class="focus__dnd"
        :class="{ 'focus__dnd--active': store.doNotDisturb }"
        @click="store.toggleDoNotDisturb()"
      >
        {{ store.doNotDisturb ? '🔕 Focus protégé' : '🔔 Ne pas déranger' }}
      </button>

      <div class="focus__ring-wrap">
        <svg class="focus__ring" viewBox="0 0 264 264">
          <circle class="focus__ring-track" cx="132" cy="132" r="120" />
          <circle
            class="focus__ring-progress"
            cx="132" cy="132" r="120"
            :style="{ strokeDasharray: 2 * Math.PI * 120, strokeDashoffset: dashOffset }"
          />
        </svg>
        <div class="focus__timer mono">{{ minutes }}:{{ seconds }}</div>
      </div>

      <h1 class="focus__task-title">{{ store.task?.title }}</h1>

      <ol v-if="store.steps.length" class="focus__steps">
        <li
          v-for="step in store.steps"
          :key="step.id"
          class="focus__step"
          :class="{ 'focus__step--done': step.done, 'focus__step--locked': !step.done && step.id !== store.activeStep?.id }"
        >
          <button
            class="focus__step-check"
            :disabled="step.done || step.id !== store.activeStep?.id"
            @click="completeStep(step)"
          >
            <span v-if="step.done">✓</span>
            <span v-else-if="step.id === store.activeStep?.id"></span>
            <span v-else>🔒</span>
          </button>
          <span class="focus__step-title">{{ step.title }}</span>
        </li>
      </ol>

      <button class="focus__finish" @click="finishNow">Terminer maintenant</button>
    </template>

    <div v-if="showAbandonConfirm" class="focus__modal-backdrop">
      <div class="focus__modal">
        <p>Abandonner la session ?</p>
        <p class="focus__modal-sub">La tâche redeviendra "à faire" et la progression du temps sera perdue.</p>
        <div class="focus__modal-actions">
          <button class="focus__modal-cancel" @click="cancelAbandon">Continuer le focus</button>
          <button class="focus__modal-confirm" @click="confirmAbandon">Abandonner</button>
        </div>
      </div>
    </div>

    <CheckinModal v-if="showRecapCheckin" @close="showRecapCheckin = false" @saved="showRecapCheckin = false" />
    <Celebration v-if="showCelebration" :message="`ONE Thing accomplie : ${store.task?.title}`" @done="showCelebration = false" />
  </div>
</template>

<style scoped>
.focus {
  min-height: 100dvh;
  background: radial-gradient(ellipse at 50% 0%, #1a1006 0%, #050403 70%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  padding: var(--space-6) var(--space-4);
  position: relative;
}

.focus__center { display: flex; flex-direction: column; align-items: center; gap: var(--space-4); }
.focus__error { color: var(--color-text-dim); }
.focus__link { color: var(--color-accent); }

.focus__abandon {
  position: absolute;
  top: calc(var(--space-4) + var(--safe-top, 0px));
  right: var(--space-4);
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  color: var(--color-text-dim);
  font-size: 18px;
}

.focus__dnd {
  position: absolute;
  top: calc(var(--space-4) + var(--safe-top, 0px));
  left: var(--space-4);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  background: rgba(255,255,255,0.06);
  color: var(--color-text-dim);
  font-size: 12px;
}
.focus__dnd--active {
  background: color-mix(in srgb, var(--color-accent) 25%, transparent);
  color: var(--color-accent);
}

.focus__ring-wrap { position: relative; width: 264px; height: 264px; }
.focus__ring { width: 100%; height: 100%; transform: rotate(-90deg); }
.focus__ring-track {
  fill: none;
  stroke: rgba(255,255,255,0.06);
  stroke-width: 8;
}
.focus__ring-progress {
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 8;
  stroke-linecap: round;
  filter: drop-shadow(0 0 10px var(--color-accent-glow));
  transition: stroke-dashoffset 1s linear;
  animation: breathe 4s ease-in-out infinite;
}
@keyframes breathe {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}
.focus__timer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44px;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.focus__task-title {
  font-family: var(--font-display);
  font-size: clamp(20px, 4vw, 28px);
  text-align: center;
  max-width: 32ch;
  color: var(--color-text);
}

.focus__steps {
  list-style: none;
  padding: 0;
  margin: 0;
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.focus__step {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: rgba(255,255,255,0.03);
  border-radius: var(--radius-md);
  transition: opacity 0.2s ease;
}
.focus__step--locked { opacity: 0.4; }
.focus__step--done { animation: dominoFall 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97); transform-origin: left center; }
.focus__step--done .focus__step-title { text-decoration: line-through; color: var(--color-text-faint); }
@keyframes dominoFall {
  0% { transform: rotate(0deg) translateX(0); }
  40% { transform: rotate(12deg) translateX(2px); }
  100% { transform: rotate(0deg) translateX(0); }
}
.focus__step-check {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
}
.focus__step-check:not(:disabled):hover { border-color: var(--color-accent); }

.focus__finish {
  color: var(--color-text-dim);
  font-size: 14px;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
}
.focus__finish:hover { color: var(--color-text); }

.focus__summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
}
.focus__summary-title { font-family: var(--font-display); font-size: 28px; }
.focus__summary-task { color: var(--color-text-dim); }
.focus__summary-quote { font-family: var(--font-display); font-size: 14px; color: var(--color-text-faint); max-width: 34ch; }
.focus__summary-stats { display: flex; gap: var(--space-6); margin: var(--space-4) 0; }
.stat { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); }
.stat__value { font-size: 28px; color: var(--color-accent); }
.stat__label { font-size: 12px; color: var(--color-text-faint); }
.focus__cta {
  background: var(--color-accent);
  color: #100b04;
  font-weight: 600;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-full);
}

.focus__modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
  z-index: 10;
}
.focus__modal {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  max-width: 360px;
  text-align: center;
}
.focus__modal-sub { color: var(--color-text-faint); font-size: 13px; margin-top: var(--space-2); }
.focus__modal-actions { display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-5); }
.focus__modal-cancel {
  background: var(--color-accent);
  color: #100b04;
  font-weight: 600;
  padding: var(--space-3);
  border-radius: var(--radius-full);
}
.focus__modal-confirm {
  color: var(--color-red);
  padding: var(--space-3);
}

.skeleton { animation: pulse 1.4s ease-in-out infinite; background: rgba(255,255,255,0.05); }
@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.9; } }
</style>
