<script setup>
import { computed } from 'vue';

const props = defineProps({ streaks: { type: Array, required: true } });

// Current streak = consecutive days (most recent first) with the ONE Thing done.
const currentStreak = computed(() => {
  let count = 0;
  for (let i = props.streaks.length - 1; i >= 0; i--) {
    if (props.streaks[i].one_thing_done) count += 1;
    else break;
  }
  return count;
});

const milestones = [7, 21, 66];
const nextMilestone = computed(() => milestones.find((m) => m > currentStreak.value) || null);

function cellStyle(entry) {
  if (!entry) return { background: 'transparent' };
  if (entry.one_thing_done) return { background: 'var(--color-accent)' };
  if (entry.checkin_rate > 0) return { background: 'color-mix(in srgb, var(--color-accent) ' + Math.round(entry.checkin_rate * 40) + '%, var(--color-border))' };
  return { background: 'var(--color-border)' };
}
</script>

<template>
  <div class="heatmap">
    <div class="heatmap__header">
      <span class="heatmap__streak mono">{{ currentStreak }} jours</span>
      <span v-if="nextMilestone" class="heatmap__next">prochain palier : {{ nextMilestone }}j</span>
      <span v-else class="heatmap__next">🏆 66 jours atteints !</span>
    </div>
    <div class="heatmap__grid">
      <div
        v-for="(entry, i) in streaks"
        :key="entry.date || i"
        class="heatmap__cell"
        :style="cellStyle(entry)"
        :title="entry.date + (entry.one_thing_done ? ' — ONE Thing faite' : '')"
      ></div>
    </div>
    <div class="heatmap__badges">
      <span v-for="m in milestones" :key="m" class="badge" :class="{ 'badge--unlocked': currentStreak >= m }">
        {{ currentStreak >= m ? '🏅' : '⚪' }} {{ m }}j
      </span>
    </div>
  </div>
</template>

<style scoped>
.heatmap { display: flex; flex-direction: column; gap: var(--space-3); }
.heatmap__header { display: flex; align-items: baseline; gap: var(--space-3); }
.heatmap__streak { font-size: 20px; color: var(--color-accent); }
.heatmap__next { font-size: 12px; color: var(--color-text-faint); }
.heatmap__grid { display: grid; grid-template-columns: repeat(22, 1fr); gap: 3px; }
.heatmap__cell { aspect-ratio: 1; border-radius: 2px; min-width: 8px; }
.heatmap__badges { display: flex; gap: var(--space-3); }
.badge { font-size: 12px; color: var(--color-text-faint); }
.badge--unlocked { color: var(--color-accent); }
</style>
