<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../../api';
import { useSpeechRecognition } from '../../composables/useSpeechRecognition';

const emit = defineEmits(['close', 'saved']);

const categories = ref([]);
const activeTask = ref(null);
const selectedCategoryId = ref(null);
const text = ref('');
const saving = ref(false);

const { supported: speechSupported, listening, transcript, error: speechError, start: startListening, stop: stopListening } = useSpeechRecognition();

const displayText = computed({
  get: () => (listening.value ? transcript.value : text.value),
  set: (v) => { text.value = v; },
});

async function load() {
  const [cats, active] = await Promise.all([
    api.get('/categories'),
    api.get('/tasks/active').catch(() => null),
  ]);
  categories.value = cats;
  activeTask.value = active;
}

function toggleMic() {
  if (listening.value) {
    stopListening();
    text.value = transcript.value;
  } else {
    startListening();
  }
}

function selectCategory(cat) {
  selectedCategoryId.value = selectedCategoryId.value === cat.id ? null : cat.id;
  if (navigator.vibrate) navigator.vibrate(15);
}

async function save() {
  if (listening.value) {
    stopListening();
    text.value = transcript.value;
  }
  saving.value = true;
  try {
    await api.post('/checkins', {
      content: text.value.trim() || null,
      input_mode: listening.value || transcript.value ? 'voice' : 'text',
      category_id: selectedCategoryId.value,
      task_id: activeTask.value?.id || null,
    });
    emit('saved');
    emit('close');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="checkin-backdrop" @click.self="$emit('close')">
    <div class="checkin">
      <div class="checkin__header">
        <span class="checkin__eyebrow">⏱️ Check-in</span>
        <button class="checkin__close" @click="$emit('close')" aria-label="Fermer">✕</button>
      </div>

      <p class="checkin__question">Qu'as-tu fait ces dernières minutes ?</p>

      <div v-if="activeTask" class="checkin__prefill">
        🎯 Session focus en cours : <strong>{{ activeTask.title }}</strong>
      </div>

      <div class="checkin__input">
        <button
          v-if="speechSupported"
          class="checkin__mic"
          :class="{ 'checkin__mic--active': listening }"
          @click="toggleMic"
          aria-label="Dicter"
        >
          <span class="checkin__mic-icon">🎙️</span>
          <span v-if="listening" class="checkin__mic-wave"></span>
        </button>

        <textarea
          v-model="displayText"
          class="checkin__textarea"
          rows="3"
          placeholder="Ex: Écrit la doc de l'API, réunion client..."
        ></textarea>
      </div>
      <p v-if="speechError" class="checkin__hint">Micro indisponible ({{ speechError }}) — utilise le texte.</p>
      <p v-else-if="!speechSupported" class="checkin__hint">Saisie vocale non disponible sur cet appareil — utilise le texte.</p>

      <div class="checkin__chips">
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="chip"
          :class="{ 'chip--selected': selectedCategoryId === cat.id }"
          :style="{ '--chip-color': cat.color }"
          @click="selectCategory(cat)"
        >
          {{ cat.name }}
        </button>
      </div>

      <button class="checkin__save" :disabled="saving" @click="save">
        {{ saving ? 'Enregistrement…' : 'Valider' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.checkin-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 50;
}
@media (min-width: 768px) {
  .checkin-backdrop { align-items: center; }
}

.checkin {
  width: 100%;
  max-width: 480px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--space-5) var(--space-5) calc(var(--space-6) + var(--safe-bottom));
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
@media (min-width: 768px) {
  .checkin { border-radius: var(--radius-lg); padding: var(--space-6); }
}

.checkin__header { display: flex; align-items: center; justify-content: space-between; }
.checkin__eyebrow { color: var(--color-accent); font-weight: 600; font-size: 13px; }
.checkin__close { width: 36px; height: 36px; border-radius: 999px; background: rgba(255,255,255,0.06); color: var(--color-text-dim); }

.checkin__question { font-family: var(--font-display); font-size: 20px; }

.checkin__prefill {
  background: rgba(245,158,11,0.1);
  border: 1px solid var(--color-accent-dim);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  font-size: 13px;
  color: var(--color-text-dim);
}

.checkin__input { display: flex; align-items: flex-start; gap: var(--space-3); }
.checkin__mic {
  position: relative;
  width: 56px;
  height: 56px;
  min-width: 56px;
  border-radius: 999px;
  background: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}
.checkin__mic--active { animation: mic-pulse 1.2s ease-in-out infinite; }
.checkin__mic-wave {
  position: absolute;
  inset: -8px;
  border-radius: 999px;
  border: 2px solid var(--color-accent);
  animation: wave 1.2s ease-out infinite;
}
@keyframes mic-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
@keyframes wave { 0% { opacity: 0.6; transform: scale(1); } 100% { opacity: 0; transform: scale(1.6); } }

.checkin__textarea {
  flex: 1;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  color: var(--color-text);
  font-family: inherit;
  font-size: 15px;
  resize: vertical;
  min-height: 56px;
}

.checkin__hint { font-size: 12px; color: var(--color-text-faint); margin-top: calc(var(--space-3) * -1); }

.checkin__chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.chip {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--color-border);
  font-size: 13px;
  color: var(--color-text-dim);
  transition: transform 0.12s ease, background 0.15s ease, border-color 0.15s ease;
}
.chip:active { transform: scale(0.94); }
.chip--selected {
  background: color-mix(in srgb, var(--chip-color) 25%, transparent);
  border-color: var(--chip-color);
  color: var(--color-text);
}

.checkin__save {
  background: var(--color-accent);
  color: #100b04;
  font-weight: 600;
  padding: var(--space-3);
  border-radius: var(--radius-full);
  font-size: 15px;
}
.checkin__save:disabled { opacity: 0.6; }
</style>
