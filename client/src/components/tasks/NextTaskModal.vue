<script setup>
import { useRouter } from 'vue-router';

const props = defineProps({ task: { type: Object, required: true } });
const emit = defineEmits(['close']);
const router = useRouter();

const quadrantMeta = {
  urgent_important: { label: 'Urgente + Importante', color: 'var(--color-red)', icon: '🔴' },
  important: { label: 'Importante', color: 'var(--color-orange)', icon: '🟠' },
  urgent: { label: 'Urgente', color: 'var(--color-yellow)', icon: '🟡' },
  neither: { label: 'Un jour peut-être', color: 'var(--color-neutral)', icon: '⚪' },
};

function startFocus() {
  router.push(`/focus/${props.task.id}`);
  emit('close');
}
</script>

<template>
  <div class="next-task-backdrop" @click.self="$emit('close')">
    <div class="next-task">
      <span class="next-task__eyebrow">✓ Bien joué. Et maintenant ?</span>
      <div class="next-task__suggestion">
        <span class="next-task__quadrant" :style="{ color: quadrantMeta[task.quadrant]?.color }">
          {{ quadrantMeta[task.quadrant]?.icon }}
        </span>
        <div>
          <p class="next-task__title">{{ task.title }}</p>
          <p class="next-task__hint">{{ quadrantMeta[task.quadrant]?.label }}</p>
        </div>
      </div>
      <div class="next-task__actions">
        <button class="next-task__later" @click="$emit('close')">Plus tard</button>
        <button class="next-task__cta" @click="startFocus">Démarrer le focus</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.next-task-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 55;
}
@media (min-width: 768px) { .next-task-backdrop { align-items: center; } }

.next-task {
  width: 100%;
  max-width: 400px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--space-5) var(--space-5) calc(var(--space-6) + var(--safe-bottom));
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@media (min-width: 768px) { .next-task { border-radius: var(--radius-lg); } }
@keyframes pop { 0% { transform: translateY(12px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }

.next-task__eyebrow { color: var(--color-accent); font-weight: 600; font-size: 13px; }

.next-task__suggestion {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: rgba(255,255,255,0.04);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}
.next-task__quadrant { font-size: 22px; }
.next-task__title { font-family: var(--font-display); font-size: 17px; }
.next-task__hint { font-size: 12px; color: var(--color-text-faint); margin-top: 2px; }

.next-task__actions { display: flex; gap: var(--space-2); }
.next-task__later {
  flex: 1;
  padding: var(--space-3);
  border-radius: var(--radius-full);
  background: rgba(255,255,255,0.05);
  color: var(--color-text-dim);
}
.next-task__cta {
  flex: 2;
  padding: var(--space-3);
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: #100b04;
  font-weight: 600;
}
</style>
