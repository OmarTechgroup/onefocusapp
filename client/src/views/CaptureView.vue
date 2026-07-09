<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../api';
import CheckinModal from '../components/checkin/CheckinModal.vue';

const content = ref('');
const saved = ref(false);
const showCheckin = ref(false);
const checkins = ref([]);
const settings = ref(null);
const loadingTimeline = ref(true);

async function capture() {
  if (!content.value.trim()) return;
  await api.post('/inbox', { content: content.value.trim() });
  content.value = '';
  saved.value = true;
  setTimeout(() => (saved.value = false), 1500);
}

async function loadTimeline() {
  loadingTimeline.value = true;
  const today = new Date().toISOString().slice(0, 10);
  const [rows, s] = await Promise.all([
    api.get(`/checkins?date=${today}`),
    api.get('/settings'),
  ]);
  checkins.value = rows;
  settings.value = s;
  loadingTimeline.value = false;
}

function onCheckinSaved() {
  loadTimeline();
}

// Builds the day's slot grid from the Challenge window/interval, and matches
// each slot to a check-in (or leaves it as a gray "hole") — this is the
// "trous = zones grises" timeline the spec asks for, plus the check-in rate.
const slots = computed(() => {
  if (!settings.value) return [];
  const { startHour, endHour, intervalMinutes } = settings.value.challenge || { startHour: 8, endHour: 19, intervalMinutes: 15 };
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const result = [];
  let cursor = new Date(`${today}T${String(startHour).padStart(2, '0')}:00:00`);
  const end = new Date(`${today}T${String(endHour).padStart(2, '0')}:00:00`);

  while (cursor < end) {
    const slotEnd = new Date(cursor.getTime() + intervalMinutes * 60000);
    const isPast = cursor <= now;
    const match = checkins.value.find((c) => {
      const t = new Date(c.timestamp);
      return t >= cursor && t < slotEnd;
    });
    result.push({
      start: cursor.toTimeString().slice(0, 5),
      filled: !!match,
      checkin: match || null,
      isPast,
    });
    cursor = slotEnd;
  }
  return result;
});

const pastSlots = computed(() => slots.value.filter((s) => s.isPast));
const checkinRate = computed(() => {
  if (!pastSlots.value.length) return null;
  const filled = pastSlots.value.filter((s) => s.filled).length;
  return Math.round((filled / pastSlots.value.length) * 100);
});

onMounted(loadTimeline);
</script>

<template>
  <div class="capture">
    <h2 style="margin-bottom: var(--space-5)">Capture</h2>

    <section class="card capture-checkin">
      <div class="capture-checkin__text">
        <h3>Check-in</h3>
        <p v-if="checkinRate !== null" class="capture-checkin__rate">
          {{ checkinRate }}% de check-ins répondus aujourd'hui
        </p>
      </div>
      <button class="capture-checkin__cta" @click="showCheckin = true">⏱️ Check-in maintenant</button>
    </section>

    <section v-if="!loadingTimeline && slots.length" class="capture-timeline">
      <h3 class="capture-timeline__title">Frise de la journée</h3>
      <div class="capture-timeline__grid">
        <div
          v-for="(slot, i) in slots"
          :key="i"
          class="capture-timeline__slot"
          :class="{ 'capture-timeline__slot--gap': slot.isPast && !slot.filled, 'capture-timeline__slot--future': !slot.isPast }"
          :style="slot.filled ? { background: slot.checkin.category_color || 'var(--color-accent)' } : {}"
          :title="slot.filled ? (slot.checkin.content || slot.checkin.category_name || 'Check-in') : (slot.isPast ? 'Non renseigné' : '')"
        ></div>
      </div>
    </section>

    <section class="card capture-inbox">
      <h3>Capture rapide</h3>
      <textarea
        v-model="content"
        placeholder="Note quelque chose vite, tu le classeras plus tard..."
        rows="4"
        class="capture-inbox__textarea"
      ></textarea>
      <button class="capture-inbox__cta" @click="capture">
        {{ saved ? 'Capturé ✓' : 'Capturer' }}
      </button>
    </section>

    <CheckinModal v-if="showCheckin" @close="showCheckin = false" @saved="onCheckinSaved" />
  </div>
</template>

<style scoped>
.capture { display: flex; flex-direction: column; gap: var(--space-5); }

.capture-checkin {
  padding: var(--space-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.capture-checkin__text h3 { font-size: 15px; }
.capture-checkin__rate { color: var(--color-text-faint); font-size: 13px; margin-top: var(--space-1); }
.capture-checkin__cta {
  background: var(--color-accent);
  color: #100b04;
  font-weight: 600;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.capture-timeline__title { font-size: 14px; color: var(--color-text-dim); margin-bottom: var(--space-2); }
.capture-timeline__grid { display: flex; gap: 3px; flex-wrap: wrap; }
.capture-timeline__slot {
  width: 10px;
  height: 28px;
  border-radius: 3px;
  background: rgba(255,255,255,0.06);
}
.capture-timeline__slot--gap {
  background: repeating-linear-gradient(45deg, rgba(239,68,68,0.25), rgba(239,68,68,0.25) 3px, transparent 3px, transparent 6px);
}
.capture-timeline__slot--future { opacity: 0.3; }

.capture-inbox { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); }
.capture-inbox h3 { font-size: 15px; }
.capture-inbox__textarea {
  width: 100%;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-family: inherit;
  font-size: 16px;
  padding: var(--space-3);
  resize: vertical;
}
.capture-inbox__cta {
  align-self: flex-start;
  background: rgba(255,255,255,0.06);
  color: var(--color-text);
  font-weight: 600;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-full);
}
</style>
