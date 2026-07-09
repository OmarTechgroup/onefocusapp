<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import TaskFormModal from '../components/tasks/TaskFormModal.vue';
import EisenhowerMatrix from '../components/tasks/EisenhowerMatrix.vue';
import GoalsCascade from '../components/goals/GoalsCascade.vue';
import NextTaskModal from '../components/tasks/NextTaskModal.vue';
import { getNextTask } from '../composables/useNextTask';

const router = useRouter();
const tab = ref('list'); // 'list' | 'matrix' | 'goals'
const missions = ref([]);
const tasks = ref([]);
const loading = ref(true);
const showTaskForm = ref(false);
const expandedMissionId = ref(null);
const nextTask = ref(null);

const quadrantMeta = {
  urgent_important: { label: 'Urgente + Importante', color: 'var(--color-red)', icon: '🔴' },
  important: { label: 'Importante', color: 'var(--color-orange)', icon: '🟠' },
  urgent: { label: 'Urgente', color: 'var(--color-yellow)', icon: '🟡' },
  neither: { label: 'Un jour peut-être', color: 'var(--color-neutral)', icon: '⚪' },
};

async function load() {
  loading.value = true;
  const [m, t] = await Promise.all([api.get('/missions'), api.get('/tasks')]);
  missions.value = m;
  tasks.value = t;
  loading.value = false;
}

function tasksForMission(missionId) {
  return tasks.value.filter((t) => t.mission_id === missionId);
}

const unassignedTasks = computed(() => tasks.value.filter((t) => !t.mission_id));
const matrixTasks = computed(() => tasks.value.filter((t) => t.status === 'todo' || t.status === 'active'));

function toggleMission(id) {
  expandedMissionId.value = expandedMissionId.value === id ? null : id;
}

async function onTaskCreated() {
  await load();
}

async function onQuadrantChange({ task, quadrant }) {
  task.quadrant = quadrant; // optimistic
  await api.patch(`/tasks/${task.id}`, { quadrant });
}

function startFocus(task) {
  router.push(`/focus/${task.id}`);
}

async function markDone(task) {
  task.status = 'done'; // optimistic
  await api.patch(`/tasks/${task.id}`, { status: 'done' });
  nextTask.value = await getNextTask(task.id);
}

onMounted(load);
</script>

<template>
  <div class="missions">
    <header class="missions__header">
      <h2>Missions</h2>
      <button class="missions__add" @click="showTaskForm = true">+ Tâche</button>
    </header>

    <div class="missions__tabs">
      <button :class="{ active: tab === 'list' }" @click="tab = 'list'">Liste</button>
      <button :class="{ active: tab === 'matrix' }" @click="tab = 'matrix'">Matrice</button>
      <button :class="{ active: tab === 'goals' }" @click="tab = 'goals'">Objectifs (411)</button>
    </div>

    <div v-if="loading" class="skeleton card" style="height: 200px"></div>

    <template v-else-if="tab === 'list'">
      <section v-for="m in missions" :key="m.id" class="card mission-card">
        <button class="mission-card__header" @click="toggleMission(m.id)">
          <span class="mission-card__dot" :style="{ background: m.color }"></span>
          <span class="mission-card__title">{{ m.title }}</span>
          <span class="mission-card__count">{{ tasksForMission(m.id).length }}</span>
        </button>
        <ul v-if="expandedMissionId === m.id" class="mission-card__tasks">
          <li v-for="t in tasksForMission(m.id)" :key="t.id" class="mission-task">
            <span :style="{ color: quadrantMeta[t.quadrant]?.color }">{{ quadrantMeta[t.quadrant]?.icon }}</span>
            <span class="mission-task__title" :class="{ 'mission-task__title--done': t.status === 'done' }">{{ t.title }}</span>
            <template v-if="t.status === 'todo'">
              <button class="mission-task__done" @click="markDone(t)" aria-label="Marquer comme faite">✓</button>
              <button class="mission-task__focus" @click="startFocus(t)">Focus</button>
            </template>
          </li>
          <li v-if="!tasksForMission(m.id).length" class="mission-task mission-task--empty">Aucune tâche.</li>
        </ul>
      </section>

      <section v-if="unassignedTasks.length" class="card mission-card">
        <div class="mission-card__header" style="cursor:default">
          <span class="mission-card__title">Sans mission</span>
          <span class="mission-card__count">{{ unassignedTasks.length }}</span>
        </div>
        <ul class="mission-card__tasks">
          <li v-for="t in unassignedTasks" :key="t.id" class="mission-task">
            <span :style="{ color: quadrantMeta[t.quadrant]?.color }">{{ quadrantMeta[t.quadrant]?.icon }}</span>
            <span class="mission-task__title">{{ t.title }}</span>
          </li>
        </ul>
      </section>

      <p v-if="!missions.length && !unassignedTasks.length" class="missions__empty">Aucune mission ni tâche pour l'instant.</p>
    </template>

    <template v-else-if="tab === 'matrix'">
      <EisenhowerMatrix :tasks="matrixTasks" @quadrant-change="onQuadrantChange" />
    </template>

    <template v-else-if="tab === 'goals'">
      <GoalsCascade />
    </template>

    <TaskFormModal v-if="showTaskForm" @close="showTaskForm = false" @created="onTaskCreated" />
    <NextTaskModal v-if="nextTask" :task="nextTask" @close="nextTask = null" />
  </div>
</template>

<style scoped>
.missions { display: flex; flex-direction: column; gap: var(--space-5); }
.missions__header { display: flex; align-items: center; justify-content: space-between; }
.missions__add {
  background: var(--color-accent);
  color: #100b04;
  font-weight: 600;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  font-size: 13px;
}
.missions__tabs { display: flex; gap: var(--space-2); }
.missions__tabs button { padding: var(--space-2) var(--space-4); border-radius: var(--radius-full); background: rgba(255,255,255,0.05); color: var(--color-text-dim); font-size: 13px; }
.missions__tabs button.active { background: var(--color-accent); color: #100b04; font-weight: 600; }
.missions__empty { color: var(--color-text-faint); }

.mission-card { padding: 0; overflow: hidden; }
.mission-card__header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  text-align: left;
}
.mission-card__dot { width: 10px; height: 10px; border-radius: 999px; }
.mission-card__title { flex: 1; font-weight: 600; }
.mission-card__count { color: var(--color-text-faint); font-size: 12px; }

.mission-card__tasks { list-style: none; margin: 0; padding: 0 var(--space-4) var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
.mission-task { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-top: 1px solid var(--color-border); }
.mission-task__title { flex: 1; font-size: 14px; }
.mission-task__title--done { text-decoration: line-through; color: var(--color-text-faint); }
.mission-task--empty { color: var(--color-text-faint); font-size: 13px; border-top: none; }
.mission-task__focus { font-size: 12px; color: var(--color-accent); padding: var(--space-1) var(--space-3); border-radius: var(--radius-full); background: rgba(245,158,11,0.1); }
.mission-task__done {
  width: 26px;
  height: 26px;
  min-width: 26px;
  min-height: 26px;
  border-radius: 999px;
  color: var(--color-green);
  background: rgba(34,197,94,0.1);
  font-size: 12px;
}

.skeleton { animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.9; } }
</style>
