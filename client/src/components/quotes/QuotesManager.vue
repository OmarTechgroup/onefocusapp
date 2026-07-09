<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../../api';

const quotes = ref([]);
const showForm = ref(false);
const newText = ref('');
const newAuthor = ref('');
const newCategory = ref('focus');
const preferFavorites = ref(false);

const CATEGORIES = ['focus', 'discipline', 'action', 'priorités', 'habitudes', 'vision', 'échec/persévérance'];

async function load() {
  quotes.value = await api.get('/quotes');
}

async function loadPreference() {
  const settings = await api.get('/settings');
  preferFavorites.value = !!settings.quotesPreferFavorites;
}

async function togglePreferFavorites() {
  preferFavorites.value = !preferFavorites.value;
  await api.patch('/settings', { quotesPreferFavorites: preferFavorites.value });
}

async function addQuote() {
  if (!newText.value.trim()) return;
  await api.post('/quotes', { text: newText.value.trim(), author: newAuthor.value.trim() || null, category: newCategory.value });
  newText.value = '';
  newAuthor.value = '';
  showForm.value = false;
  await load();
}

async function toggleActive(q) {
  q.is_active = q.is_active ? 0 : 1; // optimistic
  await api.patch(`/quotes/${q.id}`, { is_active: q.is_active });
}

async function toggleFavorite(q) {
  q.is_favorite = q.is_favorite ? 0 : 1; // optimistic
  await api.patch(`/quotes/${q.id}`, { is_favorite: q.is_favorite });
}

async function removeQuote(q) {
  quotes.value = quotes.value.filter((x) => x.id !== q.id); // optimistic
  await api.delete(`/quotes/${q.id}`);
}

onMounted(() => {
  load();
  loadPreference();
});
</script>

<template>
  <section class="card quotes-manager">
    <div class="quotes-manager__header">
      <h3>Mes citations</h3>
      <button class="quotes-manager__add-btn" @click="showForm = !showForm">{{ showForm ? 'Annuler' : '+ Ajouter' }}</button>
    </div>

    <label class="quotes-manager__pref">
      Afficher plus souvent mes favoris
      <input type="checkbox" :checked="preferFavorites" @change="togglePreferFavorites" />
    </label>

    <div v-if="showForm" class="quotes-manager__form">
      <textarea v-model="newText" class="quotes-manager__input" rows="2" placeholder="Texte de la citation"></textarea>
      <input v-model="newAuthor" class="quotes-manager__input" placeholder="Auteur / source (optionnel)" />
      <select v-model="newCategory" class="quotes-manager__input">
        <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
      </select>
      <button class="quotes-manager__submit" @click="addQuote">Ajouter la citation</button>
    </div>

    <ul class="quotes-manager__list">
      <li v-for="q in quotes" :key="q.id" class="quotes-manager__item" :class="{ 'quotes-manager__item--inactive': !q.is_active }">
        <div class="quotes-manager__item-text">
          <p>{{ q.text }}</p>
          <span class="quotes-manager__item-meta">{{ q.author || 'Anonyme' }} · {{ q.category || '—' }}{{ q.is_custom ? ' · perso' : '' }}</span>
        </div>
        <div class="quotes-manager__item-actions">
          <button @click="toggleFavorite(q)" :class="{ active: q.is_favorite }" aria-label="Favori">{{ q.is_favorite ? '❤️' : '🤍' }}</button>
          <button @click="toggleActive(q)" aria-label="Activer/désactiver">{{ q.is_active ? '👁️' : '🚫' }}</button>
          <button @click="removeQuote(q)" aria-label="Supprimer" class="quotes-manager__delete">🗑️</button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.quotes-manager { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); }
.quotes-manager__header { display: flex; align-items: center; justify-content: space-between; }
.quotes-manager__header h3 { font-size: 15px; color: var(--color-text-dim); }
.quotes-manager__add-btn { font-size: 13px; color: var(--color-accent); }
.quotes-manager__pref { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--color-text-dim); }

.quotes-manager__form { display: flex; flex-direction: column; gap: var(--space-2); }
.quotes-manager__input {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  color: var(--color-text);
  font-family: inherit;
  font-size: 14px;
}
.quotes-manager__submit {
  align-self: flex-start;
  background: var(--color-accent);
  color: #100b04;
  font-weight: 600;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  font-size: 13px;
}

.quotes-manager__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); max-height: 360px; overflow-y: auto; }
.quotes-manager__item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-top: 1px solid var(--color-border);
}
.quotes-manager__item--inactive { opacity: 0.45; }
.quotes-manager__item-text p { font-size: 13px; margin: 0; }
.quotes-manager__item-meta { font-size: 11px; color: var(--color-text-faint); }
.quotes-manager__item-actions { display: flex; gap: 2px; }
.quotes-manager__item-actions button { font-size: 14px; width: 32px; height: 32px; min-width: 32px; }
.quotes-manager__delete { color: var(--color-red); }
</style>
