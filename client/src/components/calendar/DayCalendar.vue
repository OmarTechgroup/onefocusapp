<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '../../api';

const props = defineProps({
  date: { type: String, required: true },
  // Bump this from the parent (e.g. after marking a task done elsewhere on
  // the page) to force a reload — this component owns its own data and has
  // no other way to know about changes made outside it.
  refreshToken: { type: [Number, String], default: 0 },
});

const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_PX = 56;
const SNAP_MIN = 15;

const allBlocks = ref([]);
const allTasks = ref([]); // every status, so we can drop blocks whose task is done
const gridEl = ref(null);
const dragging = ref(null); // { startY, currentY }
const pendingBlock = ref(null); // { start_time, end_time } awaiting task pick
const reschedulingBlock = ref(null); // { block, start_time, end_time } — a missed task's block awaiting reschedule/skip

async function load() {
  const [b, t] = await Promise.all([api.get('/time-blocks'), api.get('/tasks')]);
  allBlocks.value = b;
  allTasks.value = t;
}

// A task completed (or otherwise no longer active) shouldn't keep cluttering
// the calendar — its blocks disappear once the task is done.
const blocks = computed(() =>
  allBlocks.value.filter((b) => {
    if (b.date !== props.date) return false;
    const task = allTasks.value.find((t) => t.id === b.task_id);
    return !task || (task.status !== 'done' && task.status !== 'abandoned');
  })
);

// Only unfinished tasks can receive a new block.
const tasks = computed(() => allTasks.value.filter((t) => t.status === 'todo' || t.status === 'active'));

function minutesFromDayStart(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return (h - START_HOUR) * 60 + m;
}

function blockStyle(block) {
  const top = (minutesFromDayStart(block.start_time) / 60) * HOUR_PX;
  const height = ((minutesFromDayStart(block.end_time) - minutesFromDayStart(block.start_time)) / 60) * HOUR_PX;
  return { top: `${top}px`, height: `${Math.max(height, 20)}px` };
}

function taskTitle(taskId) {
  return allTasks.value.find((t) => t.id === taskId)?.title || '…';
}

function taskStatus(taskId) {
  return allTasks.value.find((t) => t.id === taskId)?.status;
}

function snap(minutes) {
  return Math.round(minutes / SNAP_MIN) * SNAP_MIN;
}

function yToTime(y) {
  const totalMinutes = snap((y / HOUR_PX) * 60);
  const clamped = Math.max(0, Math.min((END_HOUR - START_HOUR) * 60, totalMinutes));
  const h = START_HOUR + Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function onPointerDown(e) {
  if (e.target !== gridEl.value) return; // ignore clicks starting on an existing block
  const rect = gridEl.value.getBoundingClientRect();
  const y = e.clientY - rect.top;
  dragging.value = { startY: y, currentY: y };
  gridEl.value.setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
  if (!dragging.value) return;
  const rect = gridEl.value.getBoundingClientRect();
  dragging.value.currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
}

async function onPointerUp() {
  if (!dragging.value) return;
  const { startY, currentY } = dragging.value;
  const top = Math.min(startY, currentY);
  const bottom = Math.max(startY, currentY);
  dragging.value = null;
  if (bottom - top < 10) return; // treat as a stray click, not a drag

  const start_time = yToTime(top);
  const end_time = yToTime(bottom);
  if (start_time === end_time) return;

  // Refetch here rather than relying on the mount-time list — a task created
  // after the calendar loaded (the common case: user adds a task, then
  // immediately drags a block for it) would otherwise be missing from the select.
  allTasks.value = await api.get('/tasks');
  pendingBlock.value = { start_time, end_time, task_id: tasks.value[0]?.id || null };
}

const dragPreviewStyle = computed(() => {
  if (!dragging.value) return null;
  const top = Math.min(dragging.value.startY, dragging.value.currentY);
  const height = Math.abs(dragging.value.currentY - dragging.value.startY);
  return { top: `${top}px`, height: `${height}px` };
});

async function confirmPendingBlock() {
  if (!pendingBlock.value?.task_id) return;
  await api.post('/time-blocks', { ...pendingBlock.value, date: props.date });
  pendingBlock.value = null;
  await load();
}

function cancelPendingBlock() {
  pendingBlock.value = null;
}

async function deleteBlock(block) {
  await api.delete(`/time-blocks/${block.id}`);
  await load();
}

function onBlockClick(block) {
  // A missed task's block can't just be deleted with a stray click — the spec
  // requires it be explicitly rescheduled or abandoned, no silent gray zone.
  if (taskStatus(block.task_id) === 'missed') {
    reschedulingBlock.value = { block, start_time: block.start_time, end_time: block.end_time };
  } else {
    deleteBlock(block);
  }
}

async function confirmReschedule() {
  const { block, start_time, end_time } = reschedulingBlock.value;
  if (start_time === end_time) return;
  await api.patch(`/time-blocks/${block.id}`, { start_time, end_time, notified: 0 });
  await api.patch(`/tasks/${block.task_id}`, { status: 'todo' });
  reschedulingBlock.value = null;
  await load();
}

async function skipMissedTask() {
  const { block } = reschedulingBlock.value;
  await api.patch(`/tasks/${block.task_id}`, { status: 'abandoned' });
  await api.delete(`/time-blocks/${block.id}`);
  reschedulingBlock.value = null;
  await load();
}

function cancelReschedule() {
  reschedulingBlock.value = null;
}

const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

watch(() => [props.date, props.refreshToken], load);
onMounted(load);
</script>

<template>
  <div class="calendar">
    <p class="calendar__hint">Glisse sur la grille pour créer un bloc — place ta ONE Thing le matin.</p>
    <div class="calendar__body">
      <div class="calendar__hours">
        <div v-for="h in hours" :key="h" class="calendar__hour-label" :style="{ height: HOUR_PX + 'px' }">
          {{ String(h).padStart(2, '0') }}:00
        </div>
      </div>
      <div
        ref="gridEl"
        class="calendar__grid"
        :style="{ height: (END_HOUR - START_HOUR) * HOUR_PX + 'px' }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
      >
        <div v-for="h in hours" :key="h" class="calendar__gridline" :style="{ top: (h - START_HOUR) * HOUR_PX + 'px' }"></div>

        <div
          v-for="b in blocks"
          :key="b.id"
          class="calendar__block"
          :class="{ 'calendar__block--missed': taskStatus(b.task_id) === 'missed' }"
          :style="blockStyle(b)"
          @pointerdown.stop
          @click="onBlockClick(b)"
          :title="taskStatus(b.task_id) === 'missed'
            ? `${taskTitle(b.task_id)} — ratée, clic pour reprogrammer ou abandonner`
            : `${taskTitle(b.task_id)} (${b.start_time}–${b.end_time}) — clic pour supprimer`"
        >
          <span class="calendar__block-title">
            <span v-if="taskStatus(b.task_id) === 'missed'">⚠️ </span>{{ taskTitle(b.task_id) }}
          </span>
          <span class="calendar__block-time mono">{{ b.start_time }}–{{ b.end_time }}</span>
        </div>

        <div v-if="dragPreviewStyle" class="calendar__preview" :style="dragPreviewStyle"></div>
      </div>
    </div>

    <div v-if="pendingBlock" class="calendar__popover-backdrop" @click.self="cancelPendingBlock">
      <div class="calendar__popover">
        <p>Bloc de {{ pendingBlock.start_time }} à {{ pendingBlock.end_time }}</p>
        <p v-if="!tasks.length" class="calendar__popover-empty">
          Aucune tâche "à faire" — crée-en une d'abord (bouton + Tâche dans Missions).
        </p>
        <select v-else v-model="pendingBlock.task_id" class="calendar__popover-select">
          <option v-for="t in tasks" :key="t.id" :value="t.id">{{ t.title }}</option>
        </select>
        <div class="calendar__popover-actions">
          <button @click="cancelPendingBlock">Annuler</button>
          <button v-if="tasks.length" class="calendar__popover-confirm" @click="confirmPendingBlock">Créer</button>
        </div>
      </div>
    </div>

    <div v-if="reschedulingBlock" class="calendar__popover-backdrop" @click.self="cancelReschedule">
      <div class="calendar__popover">
        <p>⚠️ {{ taskTitle(reschedulingBlock.block.task_id) }} — tâche ratée</p>
        <p class="calendar__popover-empty">Reprogramme-la à une autre heure, ou abandonne-la explicitement.</p>
        <div class="calendar__popover-times">
          <input type="time" v-model="reschedulingBlock.start_time" class="calendar__popover-select" />
          <input type="time" v-model="reschedulingBlock.end_time" class="calendar__popover-select" />
        </div>
        <div class="calendar__popover-actions">
          <button @click="skipMissedTask" class="calendar__popover-skip">Abandonner</button>
          <button @click="cancelReschedule">Annuler</button>
          <button class="calendar__popover-confirm" @click="confirmReschedule">Reprogrammer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar { display: flex; flex-direction: column; gap: var(--space-2); }
.calendar__hint { font-size: 12px; color: var(--color-text-faint); }
.calendar__body { display: flex; }
.calendar__hours { display: flex; flex-direction: column; padding-right: var(--space-2); }
.calendar__hour-label { font-size: 11px; color: var(--color-text-faint); text-align: right; width: 44px; }

.calendar__grid {
  position: relative;
  flex: 1;
  background: rgba(255,255,255,0.02);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  touch-action: none;
  cursor: crosshair;
}
.calendar__gridline { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--color-border); }

.calendar__block {
  position: absolute;
  left: 4px;
  right: 4px;
  background: color-mix(in srgb, var(--color-accent) 30%, var(--color-bg-card));
  border: 1px solid var(--color-accent-dim);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 12px;
  cursor: pointer;
}
.calendar__block-title { font-weight: 600; }
.calendar__block-time { color: var(--color-text-faint); font-size: 10px; }
.calendar__block--missed {
  background: color-mix(in srgb, var(--color-red) 22%, var(--color-bg-card));
  border-color: var(--color-red);
}

.calendar__preview {
  position: absolute;
  left: 4px;
  right: 4px;
  background: rgba(245,158,11,0.2);
  border: 1px dashed var(--color-accent);
  border-radius: var(--radius-sm);
  pointer-events: none;
}

.calendar__popover-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.calendar__popover {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 260px;
}
.calendar__popover-empty { font-size: 13px; color: var(--color-text-faint); max-width: 240px; }
.calendar__popover-select {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  color: var(--color-text);
}
.calendar__popover-times { display: flex; gap: var(--space-2); }
.calendar__popover-actions { display: flex; justify-content: flex-end; gap: var(--space-2); flex-wrap: wrap; }
.calendar__popover-confirm { background: var(--color-accent); color: #100b04; font-weight: 600; padding: var(--space-2) var(--space-4); border-radius: var(--radius-full); }
.calendar__popover-skip { color: var(--color-red); padding: var(--space-2) var(--space-3); }
</style>
