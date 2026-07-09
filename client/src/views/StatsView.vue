<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '../api';
import Heatmap from '../components/stats/Heatmap.vue';

const tab = ref('day'); // 'day' | 'week' | 'month' | 'year'
const selectedDate = ref(new Date().toISOString().slice(0, 10));
const report = ref(null);
const weekReport = ref(null);
const monthReport = ref(null);
const yearReport = ref(null);
const streaks = ref([]);
const loading = ref(true);
const animatedScore = ref(0);

const monthKey = computed(() => selectedDate.value.slice(0, 7));
const yearKey = computed(() => selectedDate.value.slice(0, 4));

function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function animateScore(target) {
  const start = animatedScore.value;
  const duration = 700;
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    animatedScore.value = Math.round(start + (target - start) * (1 - Math.pow(1 - progress, 3)));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

async function loadDay() {
  loading.value = true;
  report.value = await api.get(`/reports/day/${selectedDate.value}`);
  animateScore(report.value.score);
  loading.value = false;
}

async function loadWeek() {
  loading.value = true;
  weekReport.value = await api.get(`/reports/week/${mondayOf(selectedDate.value)}`);
  loading.value = false;
}

async function loadMonth() {
  loading.value = true;
  monthReport.value = await api.get(`/reports/month/${monthKey.value}`);
  loading.value = false;
}

async function loadYear() {
  loading.value = true;
  yearReport.value = await api.get(`/reports/year/${yearKey.value}`);
  loading.value = false;
}

const loaders = { day: loadDay, week: loadWeek, month: loadMonth, year: loadYear };

function shiftDay(delta) {
  const d = new Date(`${selectedDate.value}T00:00:00`);
  d.setDate(d.getDate() + delta);
  selectedDate.value = d.toISOString().slice(0, 10);
}

function shiftMonth(delta) {
  const d = new Date(`${selectedDate.value}T00:00:00`);
  d.setMonth(d.getMonth() + delta);
  selectedDate.value = d.toISOString().slice(0, 10);
}

function shiftYear(delta) {
  const d = new Date(`${selectedDate.value}T00:00:00`);
  d.setFullYear(d.getFullYear() + delta);
  selectedDate.value = d.toISOString().slice(0, 10);
}

watch(tab, (t) => loaders[t]());
watch(selectedDate, () => loaders[tab.value]());

const donutStyle = computed(() => {
  const c = report.value?.data_json.checkins;
  if (!c) return {};
  const total = c.expectedSlots > 0 ? c.expectedSlots * (report.value.data_json.intervalMinutes || 15) : c.focusMinutes + c.distractionMinutes;
  if (!total) return { background: 'var(--color-border)' };
  const focusPct = (c.focusMinutes / total) * 100;
  const distractionPct = (c.distractionMinutes / total) * 100;
  return {
    background: `conic-gradient(var(--color-accent) 0% ${focusPct}%, var(--color-red) ${focusPct}% ${focusPct + distractionPct}%, var(--color-border) ${focusPct + distractionPct}% 100%)`,
  };
});

const scoreDelta = computed(() => {
  const cmp = report.value?.data_json.comparison;
  if (!cmp) return null;
  return report.value.score - cmp.yesterdayScore;
});

function fmtTime(iso) {
  return new Date(iso).toISOString().slice(11, 16);
}

onMounted(async () => {
  loadDay();
  streaks.value = await api.get('/streaks?days=66');
});
</script>

<template>
  <div class="stats">
    <header class="stats__header">
      <h2>Bilans</h2>
      <div class="stats__tabs">
        <button :class="{ active: tab === 'day' }" @click="tab = 'day'">Jour</button>
        <button :class="{ active: tab === 'week' }" @click="tab = 'week'">Semaine</button>
        <button :class="{ active: tab === 'month' }" @click="tab = 'month'">Mois</button>
        <button :class="{ active: tab === 'year' }" @click="tab = 'year'">Année</button>
      </div>
    </header>

    <div v-if="tab === 'day'" class="stats__nav">
      <button @click="shiftDay(-1)">←</button>
      <span class="mono">{{ selectedDate }}</span>
      <button @click="shiftDay(1)">→</button>
    </div>
    <div v-else-if="tab === 'month'" class="stats__nav">
      <button @click="shiftMonth(-1)">←</button>
      <span class="mono">{{ monthKey }}</span>
      <button @click="shiftMonth(1)">→</button>
    </div>
    <div v-else-if="tab === 'year'" class="stats__nav">
      <button @click="shiftYear(-1)">←</button>
      <span class="mono">{{ yearKey }}</span>
      <button @click="shiftYear(1)">→</button>
    </div>

    <section v-if="streaks.length" class="card heatmap-card">
      <h3 class="heatmap-card__title">Habitude 66 jours</h3>
      <Heatmap :streaks="streaks" />
    </section>

    <div v-if="loading" class="skeleton card" style="height: 240px"></div>

    <template v-else-if="tab === 'day' && report">
      <section class="card score-hero">
        <span class="score-hero__value mono">{{ animatedScore }}</span>
        <span class="score-hero__max">/100</span>
        <p v-if="scoreDelta !== null" class="score-hero__delta" :class="{ up: scoreDelta > 0, down: scoreDelta < 0 }">
          {{ scoreDelta > 0 ? '▲' : scoreDelta < 0 ? '▼' : '—' }} {{ Math.abs(scoreDelta) }} vs hier
          <span v-if="report.data_json.comparison.avg7Days !== null"> · moyenne 7j : {{ report.data_json.comparison.avg7Days }}</span>
        </p>
      </section>

      <section class="card one-thing-card">
        <template v-if="report.data_json.oneThing">
          <span>🎯 ONE Thing : <strong>{{ report.data_json.oneThing.title }}</strong></span>
          <span :class="report.data_json.oneThing.done ? 'ok' : 'ko'">{{ report.data_json.oneThing.done ? '✓ Faite' : '✕ Non faite' }}</span>
        </template>
        <span v-else class="stats__muted">Pas de ONE Thing définie ce jour-là.</span>
      </section>

      <section class="stats__grid">
        <div class="card stat-block">
          <h3>Répartition du temps</h3>
          <div class="donut" :style="donutStyle"></div>
          <div class="donut-legend">
            <span><i style="background: var(--color-accent)"></i> Focus ({{ report.data_json.checkins.focusMinutes }}min)</span>
            <span><i style="background: var(--color-red)"></i> Distraction ({{ report.data_json.checkins.distractionMinutes }}min)</span>
          </div>
          <p class="stats__muted" v-if="report.data_json.checkins.untracked">Certains créneaux n'ont pas été renseignés — temps non tracé.</p>
        </div>

        <div class="card stat-block">
          <h3>Chiffres</h3>
          <ul class="stat-list">
            <li>Tâches faites <span class="mono">{{ report.data_json.tasks.done }}</span></li>
            <li>Tâches ratées <span class="mono">{{ report.data_json.tasks.missed }}</span></li>
            <li>Sessions focus <span class="mono">{{ report.data_json.focus.sessions }}</span></li>
            <li>Temps focalisé <span class="mono">{{ report.data_json.focus.actualMinutes }}min</span></li>
            <li>Interruptions <span class="mono">{{ report.data_json.focus.interruptions }}</span></li>
            <li>Taux de check-ins <span class="mono">{{ report.data_json.checkins.rate }}%</span></li>
          </ul>
        </div>
      </section>

      <section class="card timeline-card">
        <h3>Frise de la journée</h3>
        <div v-if="report.data_json.timeline.length" class="timeline-strip">
          <div
            v-for="entry in report.data_json.timeline"
            :key="entry.id"
            class="timeline-strip__item"
            :style="{ background: entry.category_color || 'var(--color-border)' }"
            :title="`${fmtTime(entry.timestamp)} — ${entry.content || entry.category_name || ''}`"
          ></div>
        </div>
        <p v-else class="stats__muted">Aucun check-in ce jour-là — temps non tracé.</p>
      </section>

      <p v-if="report.data_json.quote" class="stats__quote">💬 {{ report.data_json.quote.text }}<span v-if="report.data_json.quote.author"> — {{ report.data_json.quote.author }}</span></p>
    </template>

    <template v-else-if="tab === 'week' && weekReport">
      <section class="card score-hero">
        <span class="score-hero__value mono">{{ weekReport.data_json.avgScore }}</span>
        <span class="score-hero__max">/100 en moyenne</span>
      </section>

      <section class="card stat-block">
        <h3>Score par jour</h3>
        <div class="week-bars">
          <div v-for="d in weekReport.data_json.days" :key="d.date" class="week-bar">
            <div class="week-bar__fill" :style="{ height: d.score + '%' }"></div>
            <span class="week-bar__label">{{ d.date.slice(8, 10) }}</span>
          </div>
        </div>
      </section>

      <section class="card stat-block">
        <ul class="stat-list">
          <li>Catégorie dominante <span>{{ weekReport.data_json.dominantCategory || '—' }}</span></li>
          <li>Meilleur jour <span class="mono">{{ weekReport.data_json.bestDay.date }} ({{ weekReport.data_json.bestDay.score }})</span></li>
          <li>Pire jour <span class="mono">{{ weekReport.data_json.worstDay.date }} ({{ weekReport.data_json.worstDay.score }})</span></li>
          <li>ONE Thing accomplie <span class="mono">{{ weekReport.data_json.oneThingStreak }}/7</span></li>
        </ul>
      </section>
    </template>

    <template v-else-if="tab === 'month' && monthReport">
      <section class="card score-hero">
        <span class="score-hero__value mono">{{ monthReport.data_json.avgScore ?? '—' }}</span>
        <span class="score-hero__max">/100 en moyenne</span>
      </section>

      <section v-if="monthReport.data_json.days.length" class="card stat-block">
        <h3>Heatmap du mois</h3>
        <div class="month-grid">
          <div
            v-for="d in monthReport.data_json.days"
            :key="d.date"
            class="month-grid__cell"
            :style="{ background: `color-mix(in srgb, var(--color-accent) ${d.score}%, var(--color-border))` }"
            :title="`${d.date} — ${d.score}/100`"
          ></div>
        </div>
      </section>

      <section v-if="monthReport.data_json.records" class="card stat-block">
        <h3>Records</h3>
        <ul class="stat-list">
          <li>Meilleur score <span class="mono">{{ monthReport.data_json.records.bestScoreDay.date }} ({{ monthReport.data_json.records.bestScoreDay.score }})</span></li>
          <li>Jour le plus focalisé <span class="mono">{{ monthReport.data_json.records.mostFocusedDay.date }} ({{ monthReport.data_json.records.mostFocusedDay.minutes }}min)</span></li>
          <li>ONE Thing accomplie <span class="mono">{{ monthReport.data_json.oneThingDoneCount }}/{{ monthReport.data_json.daysTracked }}</span></li>
        </ul>
      </section>

      <section v-if="monthReport.data_json.goalsProgress.length" class="card stat-block">
        <h3>Objectifs du mois</h3>
        <ul class="stat-list">
          <li v-for="g in monthReport.data_json.goalsProgress" :key="g.id">
            {{ g.title }}
            <span class="mono">{{ g.done }}/{{ g.total }}</span>
          </li>
        </ul>
      </section>

      <p v-if="!monthReport.data_json.days.length" class="stats__muted">Ce mois n'a pas encore commencé.</p>
    </template>

    <template v-else-if="tab === 'year' && yearReport">
      <section class="card score-hero">
        <span class="score-hero__value mono">{{ yearReport.score }}</span>
        <span class="score-hero__max">/100 en moyenne · Year in Review</span>
      </section>

      <section class="card stat-block">
        <ul class="stat-list">
          <li>Heures focalisées <span class="mono">{{ yearReport.data_json.totalFocusedHours }}h</span></li>
          <li>Missions accomplies <span class="mono">{{ yearReport.data_json.missionsCompleted }}</span></li>
          <li>Jours suivis <span class="mono">{{ yearReport.data_json.daysTracked }}</span></li>
        </ul>
      </section>

      <section v-if="yearReport.data_json.monthly.length" class="card stat-block">
        <h3>Évolution mois par mois</h3>
        <div class="week-bars">
          <div v-for="m in yearReport.data_json.monthly" :key="m.month" class="week-bar">
            <div class="week-bar__fill" :style="{ height: m.avgScore + '%' }"></div>
            <span class="week-bar__label">{{ m.month.slice(5, 7) }}</span>
          </div>
        </div>
      </section>

      <section v-if="yearReport.data_json.highlights.length" class="card stat-block">
        <h3>Moments forts</h3>
        <ul class="stat-list">
          <li v-for="h in yearReport.data_json.highlights" :key="h.date">
            {{ h.date }}<span v-if="h.oneThing"> — {{ h.oneThing }}</span>
            <span class="mono">{{ h.score }}</span>
          </li>
        </ul>
      </section>

      <p v-if="!yearReport.data_json.daysTracked" class="stats__muted">Pas encore de données pour cette année.</p>
    </template>
  </div>
</template>

<style scoped>
.stats { display: flex; flex-direction: column; gap: var(--space-5); }
.stats__header { display: flex; align-items: center; justify-content: space-between; }
.stats__tabs { display: flex; gap: var(--space-2); }
.stats__tabs button { padding: var(--space-2) var(--space-4); border-radius: var(--radius-full); background: rgba(255,255,255,0.05); color: var(--color-text-dim); font-size: 13px; }
.stats__tabs button.active { background: var(--color-accent); color: #100b04; font-weight: 600; }

.stats__nav { display: flex; align-items: center; gap: var(--space-4); color: var(--color-text-dim); }
.stats__nav button { width: 32px; height: 32px; border-radius: 999px; background: rgba(255,255,255,0.05); }

.stats__muted { color: var(--color-text-faint); font-size: 13px; }
.stats__quote { font-family: var(--font-display); font-size: 14px; color: var(--color-text-faint); text-align: center; padding: 0 var(--space-4); }

.heatmap-card { padding: var(--space-4); }
.heatmap-card__title { font-size: 14px; color: var(--color-text-dim); margin-bottom: var(--space-3); }

.score-hero { padding: var(--space-6); text-align: center; }
.score-hero__value { font-size: 64px; color: var(--color-accent); font-family: var(--font-display); }
.score-hero__max { color: var(--color-text-faint); font-size: 16px; margin-left: var(--space-2); }
.score-hero__delta { margin-top: var(--space-2); font-size: 13px; color: var(--color-text-dim); }
.score-hero__delta.up { color: var(--color-green); }
.score-hero__delta.down { color: var(--color-red); }

.one-thing-card { padding: var(--space-4); display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; font-size: 14px; }
.one-thing-card .ok { color: var(--color-green); }
.one-thing-card .ko { color: var(--color-red); }

.stats__grid { display: grid; grid-template-columns: 1fr; gap: var(--space-4); }
@media (min-width: 640px) { .stats__grid { grid-template-columns: 1fr 1fr; } }

.stat-block { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); align-items: center; }
.stat-block h3 { align-self: flex-start; font-size: 14px; color: var(--color-text-dim); }

.donut { width: 140px; height: 140px; border-radius: 999px; }
.donut-legend { display: flex; flex-direction: column; gap: var(--space-1); font-size: 12px; color: var(--color-text-dim); align-self: flex-start; }
.donut-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: var(--space-2); }

.stat-list { list-style: none; padding: 0; margin: 0; width: 100%; display: flex; flex-direction: column; gap: var(--space-2); font-size: 14px; }
.stat-list li { display: flex; justify-content: space-between; color: var(--color-text-dim); }
.stat-list li span { color: var(--color-text); }

.timeline-card { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); }
.timeline-card h3 { font-size: 14px; color: var(--color-text-dim); }
.timeline-strip { display: flex; gap: 2px; flex-wrap: wrap; }
.timeline-strip__item { width: 8px; height: 24px; border-radius: 2px; }

.week-bars { display: flex; align-items: flex-end; gap: var(--space-3); height: 120px; width: 100%; }
.week-bar { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: var(--space-2); }
.week-bar__fill { width: 100%; background: var(--color-accent); border-radius: 4px 4px 0 0; min-height: 4px; transition: height 0.4s ease; }
.week-bar__label { font-size: 11px; color: var(--color-text-faint); }

.month-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; width: 100%; }
.month-grid__cell { aspect-ratio: 1; border-radius: 4px; }

.skeleton { animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.9; } }
</style>
