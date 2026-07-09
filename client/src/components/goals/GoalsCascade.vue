<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../../api';

const goals = ref([]);
const tasks = ref([]);
const newTitle = ref('');
const newLevel = ref('someday');
const newParentId = ref(null);
const newDeadline = ref('');

// Someday → Year → Month → Week is the cascade order; "day" is the ONE Thing
// itself (a task, not a goal row) so it isn't part of this table.
const LEVELS = [
  { value: 'someday', label: 'Someday' },
  { value: 'year', label: '1 an' },
  { value: 'month', label: 'Mois' },
  { value: 'week', label: 'Semaine' },
];
const PARENT_LEVEL = { year: 'someday', month: 'year', week: 'month' };

async function load() {
  const [g, t] = await Promise.all([api.get('/goals'), api.get('/tasks')]);
  goals.value = g;
  tasks.value = t;
}

function goalsAt(level) {
  return goals.value.filter((g) => g.level === level);
}

function childrenOf(goalId) {
  return goals.value.filter((g) => g.parent_goal_id === goalId);
}

function tasksFor(goalId) {
  return tasks.value.filter((t) => t.goal_id === goalId);
}

const orphanTasks = computed(() => tasks.value.filter((t) => !t.goal_id && t.status !== 'someday'));

const availableParents = computed(() => {
  const parentLevel = PARENT_LEVEL[newLevel.value];
  return parentLevel ? goalsAt(parentLevel) : [];
});

async function createGoal() {
  if (!newTitle.value.trim()) return;
  await api.post('/goals', {
    title: newTitle.value.trim(),
    level: newLevel.value,
    parent_goal_id: newParentId.value || null,
    deadline: newDeadline.value || null,
  });
  newTitle.value = '';
  newParentId.value = null;
  newDeadline.value = '';
  await load();
}

onMounted(load);
</script>

<template>
  <div class="cascade">
    <section class="card cascade-form">
      <h3>Nouvel objectif</h3>
      <div class="cascade-form__row">
        <select v-model="newLevel" class="cascade-form__select">
          <option v-for="l in LEVELS" :key="l.value" :value="l.value">{{ l.label }}</option>
        </select>
        <select v-if="availableParents.length" v-model="newParentId" class="cascade-form__select">
          <option :value="null">Sans parent</option>
          <option v-for="p in availableParents" :key="p.id" :value="p.id">{{ p.title }}</option>
        </select>
      </div>
      <input v-model="newTitle" class="cascade-form__input" placeholder="Titre de l'objectif" @keyup.enter="createGoal" />
      <input v-if="newLevel !== 'someday'" type="date" v-model="newDeadline" class="cascade-form__input" />
      <button class="cascade-form__submit" @click="createGoal">Ajouter</button>
    </section>

    <section v-for="level in LEVELS" :key="level.value" class="cascade-level">
      <h3 class="cascade-level__title">{{ level.label }}</h3>
      <p v-if="!goalsAt(level.value).length" class="cascade-empty">Aucun objectif.</p>
      <div v-for="g in goalsAt(level.value)" :key="g.id" class="card cascade-goal">
        <div class="cascade-goal__header">
          <span>{{ g.title }}</span>
          <span v-if="g.deadline" class="mono cascade-goal__deadline">{{ g.deadline }}</span>
        </div>
        <ul v-if="tasksFor(g.id).length" class="cascade-goal__tasks">
          <li v-for="t in tasksFor(g.id)" :key="t.id">{{ t.title }}</li>
        </ul>
      </div>
    </section>

    <section v-if="orphanTasks.length" class="cascade-level">
      <h3 class="cascade-level__title cascade-level__title--warn">Tâches hors objectif</h3>
      <div class="card cascade-goal">
        <ul class="cascade-goal__tasks">
          <li v-for="t in orphanTasks" :key="t.id">{{ t.title }}</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cascade { display: flex; flex-direction: column; gap: var(--space-5); }

.cascade-form { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
.cascade-form h3 { font-size: 14px; color: var(--color-text-dim); }
.cascade-form__row { display: flex; gap: var(--space-2); }
.cascade-form__row > * { flex: 1; }
.cascade-form__input, .cascade-form__select {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  color: var(--color-text);
  font-size: 14px;
}
.cascade-form__submit {
  align-self: flex-start;
  background: var(--color-accent);
  color: #100b04;
  font-weight: 600;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  font-size: 13px;
}

.cascade-level__title { font-size: 14px; color: var(--color-text-dim); margin-bottom: var(--space-2); }
.cascade-level__title--warn { color: var(--color-yellow); }
.cascade-empty { font-size: 13px; color: var(--color-text-faint); }
.cascade-goal { padding: var(--space-3) var(--space-4); margin-bottom: var(--space-2); }
.cascade-goal__header { display: flex; justify-content: space-between; font-size: 14px; }
.cascade-goal__deadline { color: var(--color-text-faint); font-size: 12px; }
.cascade-goal__tasks { list-style: none; padding: 0; margin: var(--space-2) 0 0; font-size: 13px; color: var(--color-text-dim); display: flex; flex-direction: column; gap: 2px; }
</style>
