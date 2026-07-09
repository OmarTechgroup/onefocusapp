<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api';
import { setupNotifications } from '../firebase';
import { getTheme, toggleTheme } from '../theme';
import QuotesManager from '../components/quotes/QuotesManager.vue';

const settings = ref(null);
const notifStatus = ref(null); // null | 'fcm' | 'local' | 'denied' | 'unsupported'
const saving = ref(false);
const theme = ref(getTheme());

function switchTheme() {
  theme.value = toggleTheme();
}

onMounted(async () => {
  settings.value = await api.get('/settings');
});

async function save() {
  saving.value = true;
  try {
    settings.value = await api.patch('/settings', settings.value);
  } finally {
    saving.value = false;
  }
}

async function enableNotifications() {
  const result = await setupNotifications();
  notifStatus.value = result.mode;
}

const notifLabel = {
  fcm: '✅ Notifications push activées',
  local: '🔔 Notifications locales activées (FCM indisponible)',
  denied: '🚫 Permission refusée — active-la dans les réglages du navigateur',
  unsupported: 'Notifications non supportées sur cet appareil',
};
</script>

<template>
  <div>
    <h2 style="margin-bottom: var(--space-5)">Réglages</h2>

    <div v-if="settings" class="settings-form">
      <section class="card settings-section">
        <h3>Apparence</h3>
        <label class="settings-field settings-field--row">
          Thème clair
          <input type="checkbox" :checked="theme === 'light'" @change="switchTheme" />
        </label>
      </section>

      <section class="card settings-section">
        <h3>Notifications</h3>
        <button class="settings-btn" @click="enableNotifications">Activer les notifications</button>
        <p v-if="notifStatus" class="settings-hint">{{ notifLabel[notifStatus] }}</p>
      </section>

      <section class="card settings-section">
        <h3>Pomodoro</h3>
        <label class="settings-field">
          Focus (min)
          <input type="number" v-model.number="settings.pomodoro.focusMinutes" min="1" />
        </label>
        <label class="settings-field">
          Pause (min)
          <input type="number" v-model.number="settings.pomodoro.breakMinutes" min="1" />
        </label>
      </section>

      <section class="card settings-section">
        <h3>Mode Challenge (check-in)</h3>
        <label class="settings-field settings-field--row">
          Activé
          <input type="checkbox" v-model="settings.challenge.enabled" />
        </label>
        <label class="settings-field">
          Intervalle (min)
          <input type="number" v-model.number="settings.challenge.intervalMinutes" min="5" />
        </label>
        <label class="settings-field">
          Heure de début
          <input type="number" v-model.number="settings.challenge.startHour" min="0" max="23" />
        </label>
        <label class="settings-field">
          Heure de fin
          <input type="number" v-model.number="settings.challenge.endHour" min="0" max="23" />
        </label>
      </section>

      <section class="card settings-section">
        <h3>Rappels</h3>
        <label class="settings-field">
          Rappel matin
          <input type="time" v-model="settings.morningReminderTime" />
        </label>
        <label class="settings-field">
          Bilan soir
          <input type="time" v-model="settings.eveningReminderTime" />
        </label>
        <label class="settings-field">
          Rappel avant échéance (min)
          <input type="number" v-model.number="settings.remindBeforeMinutes" min="5" />
        </label>
      </section>

      <button class="settings-save" :disabled="saving" @click="save">
        {{ saving ? 'Sauvegarde…' : 'Enregistrer' }}
      </button>

      <QuotesManager />
    </div>
  </div>
</template>

<style scoped>
.settings-form { display: flex; flex-direction: column; gap: var(--space-4); max-width: 480px; }
.settings-section { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); }
.settings-section h3 { font-size: 15px; color: var(--color-text-dim); }
.settings-field { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); font-size: 14px; }
.settings-field--row { flex-direction: row; }
.settings-field input[type="number"],
.settings-field input[type="time"] {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  color: var(--color-text);
  width: 110px;
}
.settings-btn {
  align-self: flex-start;
  background: var(--color-accent);
  color: #100b04;
  font-weight: 600;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  font-size: 14px;
}
.settings-hint { font-size: 13px; color: var(--color-text-faint); }
.settings-save {
  background: var(--color-accent);
  color: #100b04;
  font-weight: 600;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-full);
  align-self: flex-start;
}
.settings-save:disabled { opacity: 0.6; }
</style>
