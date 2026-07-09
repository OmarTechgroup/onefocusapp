<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../../api';

const emit = defineEmits(['close', 'created']);
const props = defineProps({
  defaultQuadrant: { type: String, default: null },
});

const missions = ref([]);
const goals = ref([]);
const title = ref('');
const description = ref('');
const missionId = ref(null);
const goalId = ref(null);
const dueDate = ref('');
const estimatedMinutes = ref(null);
const quadrant = ref(props.defaultQuadrant);
const tagsInput = ref('');
const saving = ref(false);
const error = ref(null);

const QUADRANTS = [
  { value: 'urgent_important', label: 'Urgente + Importante', icon: '🔴' },
  { value: 'important', label: 'Importante', icon: '🟠' },
  { value: 'urgent', label: 'Urgente', icon: '🟡' },
  { value: 'neither', label: 'Un jour peut-être', icon: '⚪' },
];

async function load() {
  const [m, g] = await Promise.all([api.get('/missions'), api.get('/goals')]);
  missions.value = m;
  goals.value = g;
}

async function submit() {
  error.value = null;
  if (!title.value.trim()) { error.value = 'Le titre est requis.'; return; }
  if (!quadrant.value) { error.value = 'Choisis un quadrant Eisenhower — obligatoire.'; return; }

  saving.value = true;
  try {
    const task = await api.post('/tasks', {
      title: title.value.trim(),
      description: description.value.trim() || null,
      mission_id: missionId.value || null,
      goal_id: goalId.value || null,
      due_date: dueDate.value || null,
      estimated_minutes: estimatedMinutes.value || null,
      quadrant: quadrant.value,
      tags: tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean),
    });
    emit('created', task);
    emit('close');
  } catch (e) {
    error.value = e.message || 'Erreur lors de la création.';
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="task-form-backdrop" @click.self="$emit('close')">
    <div class="task-form">
      <div class="task-form__header">
        <h3>Nouvelle tâche</h3>
        <button class="task-form__close" @click="$emit('close')" aria-label="Fermer">✕</button>
      </div>

      <input v-model="title" class="task-form__input" placeholder="Titre de la tâche" />
      <textarea v-model="description" class="task-form__textarea" rows="2" placeholder="Description (optionnel)"></textarea>

      <div class="task-form__row">
        <select v-model="missionId" class="task-form__select">
          <option :value="null">Aucune mission</option>
          <option v-for="m in missions" :key="m.id" :value="m.id">{{ m.title }}</option>
        </select>
        <select v-model="goalId" class="task-form__select">
          <option :value="null">Aucun objectif</option>
          <option v-for="g in goals" :key="g.id" :value="g.id">{{ g.title }}</option>
        </select>
      </div>

      <div class="task-form__row">
        <input type="date" v-model="dueDate" class="task-form__input" />
        <input type="number" v-model.number="estimatedMinutes" class="task-form__input" placeholder="Durée (min)" min="1" />
      </div>

      <input v-model="tagsInput" class="task-form__input" placeholder="Tags séparés par des virgules" />

      <div class="task-form__quadrants">
        <button
          v-for="q in QUADRANTS"
          :key="q.value"
          class="task-form__quadrant"
          :class="{ selected: quadrant === q.value }"
          @click="quadrant = q.value"
        >
          {{ q.icon }} {{ q.label }}
        </button>
      </div>

      <p v-if="error" class="task-form__error">{{ error }}</p>

      <button class="task-form__submit" :disabled="saving" @click="submit">
        {{ saving ? 'Création…' : 'Créer la tâche' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.task-form-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 50;
}
@media (min-width: 768px) { .task-form-backdrop { align-items: center; } }

.task-form {
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--space-5) var(--space-5) calc(var(--space-6) + var(--safe-bottom));
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
@media (min-width: 768px) { .task-form { border-radius: var(--radius-lg); } }

.task-form__header { display: flex; align-items: center; justify-content: space-between; }
.task-form__close { width: 32px; height: 32px; border-radius: 999px; background: rgba(255,255,255,0.06); color: var(--color-text-dim); }

.task-form__input, .task-form__textarea, .task-form__select {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  color: var(--color-text);
  font-family: inherit;
  font-size: 15px;
  width: 100%;
}
.task-form__row { display: flex; gap: var(--space-2); }
.task-form__row > * { flex: 1; min-width: 0; }

.task-form__quadrants { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
.task-form__quadrant {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--color-border);
  font-size: 13px;
  text-align: left;
  color: var(--color-text-dim);
}
.task-form__quadrant.selected { border-color: var(--color-accent); background: rgba(245,158,11,0.12); color: var(--color-text); }

.task-form__error { color: var(--color-red); font-size: 13px; }

.task-form__submit {
  background: var(--color-accent);
  color: #100b04;
  font-weight: 600;
  padding: var(--space-3);
  border-radius: var(--radius-full);
}
.task-form__submit:disabled { opacity: 0.6; }
</style>
