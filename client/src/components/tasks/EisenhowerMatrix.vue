<script setup>
import { computed, ref } from 'vue';

const props = defineProps({ tasks: { type: Array, required: true } });
const emit = defineEmits(['quadrant-change']);

const QUADRANTS = [
  { value: 'urgent_important', label: 'Urgente + Importante', icon: '🔴', hint: 'À faire aujourd\'hui' },
  { value: 'important', label: 'Importante, non urgente', icon: '🟠', hint: 'À planifier' },
  { value: 'urgent', label: 'Urgente, non importante', icon: '🟡', hint: 'Voleur de temps potentiel' },
  { value: 'neither', label: 'Ni urgente ni importante', icon: '⚪', hint: 'Un jour peut-être' },
];

const dragTaskId = ref(null);
const dragOverQuadrant = ref(null);

function tasksIn(quadrant) {
  return props.tasks.filter((t) => t.quadrant === quadrant);
}

function onDragStart(task) {
  dragTaskId.value = task.id;
}

function onDrop(quadrant) {
  dragOverQuadrant.value = null;
  if (!dragTaskId.value) return;
  const task = props.tasks.find((t) => t.id === dragTaskId.value);
  if (task && task.quadrant !== quadrant) {
    emit('quadrant-change', { task, quadrant });
  }
  dragTaskId.value = null;
}
</script>

<template>
  <div class="matrix">
    <div
      v-for="q in QUADRANTS"
      :key="q.value"
      class="matrix__cell"
      :class="[`matrix__cell--${q.value}`, { 'matrix__cell--over': dragOverQuadrant === q.value }]"
      @dragover.prevent="dragOverQuadrant = q.value"
      @dragleave="dragOverQuadrant === q.value && (dragOverQuadrant = null)"
      @drop="onDrop(q.value)"
    >
      <div class="matrix__cell-header">
        <span>{{ q.icon }} {{ q.label }}</span>
        <span class="matrix__cell-hint">{{ q.hint }}</span>
      </div>
      <div class="matrix__cell-tasks">
        <div
          v-for="t in tasksIn(q.value)"
          :key="t.id"
          class="matrix__task"
          draggable="true"
          @dragstart="onDragStart(t)"
        >
          {{ t.title }}
        </div>
        <p v-if="!tasksIn(q.value).length" class="matrix__empty">Vide</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.matrix {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
.matrix__cell {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  min-height: 160px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  transition: border-color 0.15s ease, background 0.15s ease;
}
.matrix__cell--over { border-color: var(--color-accent); background: rgba(245,158,11,0.06); }
.matrix__cell--urgent_important { border-top: 3px solid var(--color-red); }
.matrix__cell--important { border-top: 3px solid var(--color-orange); }
.matrix__cell--urgent { border-top: 3px solid var(--color-yellow); }
.matrix__cell--neither { border-top: 3px solid var(--color-neutral); }

.matrix__cell-header { display: flex; flex-direction: column; gap: 2px; }
.matrix__cell-header span:first-child { font-size: 13px; font-weight: 600; }
.matrix__cell-hint { font-size: 11px; color: var(--color-text-faint); }

.matrix__cell-tasks { display: flex; flex-direction: column; gap: var(--space-2); flex: 1; }
.matrix__task {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-size: 13px;
  cursor: grab;
}
.matrix__task:active { cursor: grabbing; }
.matrix__empty { font-size: 12px; color: var(--color-text-faint); }

@media (max-width: 480px) {
  .matrix { grid-template-columns: 1fr; }
}
</style>
