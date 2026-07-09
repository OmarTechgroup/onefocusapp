<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import DayCalendar from '../components/calendar/DayCalendar.vue';
import NextTaskModal from '../components/tasks/NextTaskModal.vue';
import QuoteCard from '../components/quotes/QuoteCard.vue';
import { getNextTask } from '../composables/useNextTask';
import { useFocusStore } from '../stores/focus';

const focusStore = useFocusStore();

const router = useRouter();
const today = new Date().toISOString().slice(0, 10);
const tasks = ref([]);
const loading = ref(true);
const error = ref(null);
const nextTask = ref(null);
const calendarRefreshToken = ref(0);

const oneThing = computed(() => tasks.value.find((t) => t.is_one_thing));
const others = computed(() => tasks.value.filter((t) => !t.is_one_thing && t.status === 'todo'));

const quadrantMeta = {
  urgent_important: { label: 'Urgente + Importante', color: 'var(--color-red)', icon: '🔴' },
  important: { label: 'Importante', color: 'var(--color-orange)', icon: '🟠' },
  urgent: { label: 'Urgente', color: 'var(--color-yellow)', icon: '🟡' },
  neither: { label: 'Un jour peut-être', color: 'var(--color-neutral)', icon: '⚪' },
};

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    tasks.value = await api.get('/tasks?status=todo');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function startFocus(task) {
  router.push(`/focus/${task.id}`);
}

async function markDone(task) {
  tasks.value = tasks.value.filter((t) => t.id !== task.id); // optimistic
  await api.patch(`/tasks/${task.id}`, { status: 'done' });
  calendarRefreshToken.value += 1; // drop this task's time block(s) from the calendar
  nextTask.value = await getNextTask(task.id);
}

onMounted(() => {
  load();
  if (focusStore.pendingSuggestion) {
    nextTask.value = focusStore.pendingSuggestion;
    focusStore.pendingSuggestion = null;
  }
});
</script>

<template>
  <div class="today">
    <header class="today__greeting">
      <h2> {{ greeting }}  S.Omar Niang <span class="today__wave">☀️ </span></h2>
      <p class="today__sub">Prêt pour ta ONE Thing ?</p>
    </header>

    <QuoteCard />

    <div v-if="loading" class="skeleton card" style="height: 180px"></div>

    <template v-else>
      <section v-if="oneThing" class="one-thing card">
        <span class="one-thing__eyebrow">🎯 Ta ONE Thing aujourd'hui</span>
        <h1 class="one-thing__title">{{ oneThing.title }}</h1>
        <div class="one-thing__meta">
          <span v-if="oneThing.estimated_minutes">{{ oneThing.estimated_minutes }} min estimées</span>
        </div>
        <button class="one-thing__cta" @click="startFocus(oneThing)">Démarrer le focus</button>
      </section>

      <section v-else class="card no-one-thing">
        <p class="no-one-thing__question">
          Quelle est la SEULE chose que tu peux faire aujourd'hui, telle qu'en la faisant,
          tout le reste deviendra plus facile ou inutile ?
        </p>
        <router-link to="/missions" class="no-one-thing__cta">Choisir ma ONE Thing</router-link>
      </section>

      <section class="task-list">
        <h3 class="task-list__title">Autres tâches</h3>
        <p v-if="!others.length" class="task-list__empty">Rien d'autre pour l'instant.</p>
        <ul v-else class="task-list__items">
          <li v-for="t in others" :key="t.id" class="card task-item">
            <span class="task-item__quadrant" :style="{ color: quadrantMeta[t.quadrant]?.color }">
              {{ quadrantMeta[t.quadrant]?.icon }}
            </span>
            <span class="task-item__title">{{ t.title }}</span>
            <span v-if="t.due_date" class="task-item__due mono">{{ t.due_date }}</span>
            <button class="task-item__done" @click="markDone(t)" aria-label="Marquer comme faite">✓</button>
            <button class="task-item__focus" @click="startFocus(t)">Focus</button>
          </li>
        </ul>
      </section>

      <section class="card time-blocking">
        <h3 class="task-list__title">Time blocking</h3>
        <DayCalendar :date="today" :refresh-token="calendarRefreshToken" />
      </section>
    </template>

    <NextTaskModal v-if="nextTask" :task="nextTask" @close="nextTask = null" />
  </div>
</template>

<style scoped>
.today { display: flex; flex-direction: column; gap: var(--space-6); }
.today__greeting h2 { font-size: 26px; }
.today__sub { color: var(--color-text-dim); margin: var(--space-1) 0 0; }

.skeleton {
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.9; } }

.one-thing {
  padding: var(--space-6);
  background: linear-gradient(155deg, var(--color-bg-card), var(--color-bg-elevated));
  border-color: var(--color-accent-dim);
  position: relative;
  overflow: hidden;
}
.one-thing__eyebrow {
  color: var(--color-accent);
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.02em;
}
.one-thing__title {
  font-size: clamp(28px, 5vw, 42px);
  margin: var(--space-3) 0;
}
.one-thing__meta { color: var(--color-text-dim); font-size: 14px; }
.one-thing__cta {
  margin-top: var(--space-5);
  background: var(--color-accent);
  color: #100b04;
  font-weight: 600;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-full);
}

.no-one-thing { padding: var(--space-6); text-align: center; }
.no-one-thing__question {
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1.4;
  color: var(--color-text);
  max-width: 46ch;
  margin: 0 auto var(--space-5);
}
.no-one-thing__cta {
  display: inline-block;
  background: var(--color-accent);
  color: #100b04;
  font-weight: 600;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-full);
}

.task-list__title { font-size: 16px; color: var(--color-text-dim); margin-bottom: var(--space-3); }
.task-list__empty { color: var(--color-text-faint); }
.task-list__items { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.task-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
}
.task-item__title { flex: 1; }
.task-item__due { color: var(--color-text-faint); font-size: 12px; }
.task-item__focus {
  font-size: 12px;
  color: var(--color-accent);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  background: rgba(245,158,11,0.1);
  white-space: nowrap;
}
.task-item__done {
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  border-radius: 999px;
  color: var(--color-green);
  background: rgba(34,197,94,0.1);
  font-size: 13px;
}

.time-blocking { padding: var(--space-4); }
</style>
