<script setup>
import { ref } from 'vue';

const props = defineProps({ quote: { type: Object, required: true } });
const emit = defineEmits(['close']);

const sharing = ref(false);

// Renders the quote onto an offscreen canvas and triggers a PNG download —
// "Partager en image" without needing a screenshot lib or server round-trip.
async function shareAsImage() {
  sharing.value = true;
  try {
    const canvas = document.createElement('canvas');
    const W = 1080;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, '#0a0806');
    gradient.addColorStop(1, '#2a1608');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#f59e0b';
    ctx.font = '160px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('“', W / 2, 260);

    ctx.fillStyle = '#f2ece2';
    ctx.textAlign = 'center';
    const fontSize = props.quote.text.length > 140 ? 40 : 52;
    ctx.font = `${fontSize}px Georgia, serif`;
    wrapText(ctx, props.quote.text, W / 2, 420, 860, fontSize * 1.4);

    if (props.quote.author) {
      ctx.fillStyle = '#a89c8c';
      ctx.font = '32px system-ui, sans-serif';
      ctx.fillText(`— ${props.quote.author}`, W / 2, H - 140);
    }

    ctx.fillStyle = '#6b6156';
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText('OneFocus', W / 2, H - 70);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'onefocus-citation.png';
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    sharing.value = false;
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}
</script>

<template>
  <div class="quote-full" @click="$emit('close')">
    <button class="quote-full__close" @click.stop="$emit('close')" aria-label="Fermer">✕</button>
    <div class="quote-full__content" @click.stop>
      <span class="quote-full__mark">“</span>
      <p class="quote-full__text">{{ quote.text }}</p>
      <p v-if="quote.author" class="quote-full__author">— {{ quote.author }}</p>
      <button class="quote-full__share" :disabled="sharing" @click="shareAsImage">
        {{ sharing ? 'Génération…' : '📤 Partager en image' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.quote-full {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: radial-gradient(ellipse at 50% 20%, #2a1608 0%, #0a0806 75%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}

.quote-full__close {
  position: absolute;
  top: calc(var(--space-4) + var(--safe-bottom, 0px));
  right: var(--space-4);
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  color: var(--color-text-dim);
  font-size: 18px;
}

.quote-full__content {
  max-width: 560px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
}
.quote-full__mark { font-family: var(--font-display); font-size: 80px; color: var(--color-accent); line-height: 1; }
.quote-full__text {
  font-family: var(--font-display);
  font-size: clamp(22px, 4.5vw, 34px);
  line-height: 1.4;
  color: var(--color-text);
}
.quote-full__author { color: var(--color-text-faint); font-size: 15px; }
.quote-full__share {
  margin-top: var(--space-4);
  background: var(--color-accent);
  color: #100b04;
  font-weight: 600;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-full);
}
.quote-full__share:disabled { opacity: 0.6; }
</style>
