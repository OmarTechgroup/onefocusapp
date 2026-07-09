import { defineStore } from 'pinia';
import { api } from '../api';

const STORAGE_KEY = 'onefocus:focus-session';
const DEFAULT_MINUTES = 25;

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private mode, quota) — session just won't survive a refresh
  }
}

function clearPersisted() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const useFocusStore = defineStore('focus', {
  state: () => ({
    task: null,
    steps: [],
    session: null, // { id, task_id, started_at, planned_minutes }
    phase: 'idle', // idle | loading | running | paused | summary | error
    remainingSeconds: DEFAULT_MINUTES * 60,
    interruptions: 0,
    error: null,
    summary: null,
    doNotDisturb: false,
    // Set by FocusView right before reset() when a session completes a task;
    // TodayView reads and clears it on mount. Deliberately NOT cleared by
    // reset() below — it needs to outlive the session it was produced from.
    pendingSuggestion: null,
  }),

  getters: {
    activeStep(state) {
      return state.steps.find((s) => !s.done) || null;
    },
    doneStepsCount(state) {
      return state.steps.filter((s) => s.done).length;
    },
    plannedSeconds(state) {
      return (state.session?.planned_minutes || DEFAULT_MINUTES) * 60;
    },
    progressRatio(state) {
      const total = state.session?.planned_minutes ? state.session.planned_minutes * 60 : DEFAULT_MINUTES * 60;
      if (!total) return 0;
      return Math.min(1, Math.max(0, 1 - state.remainingSeconds / total));
    },
  },

  actions: {
    _persist() {
      if (!this.session) return;
      persist({
        session: this.session,
        task: this.task,
        remainingSeconds: this.remainingSeconds,
        interruptions: this.interruptions,
        startedAtMs: this._startedAtMs,
      });
    },

    // Resumes a session persisted before a refresh, or starts a fresh one for taskId.
    async init(taskId, plannedMinutes) {
      this.error = null;
      this.summary = null;
      const persisted = loadPersisted();

      if (persisted && persisted.session && (!taskId || persisted.session.task_id === taskId)) {
        this.session = persisted.session;
        this.task = persisted.task;
        this.interruptions = persisted.interruptions || 0;
        const elapsedSincePersist = Math.floor((Date.now() - (persisted.startedAtMs || Date.now())) / 1000);
        this._startedAtMs = persisted.startedAtMs || Date.now();
        const total = (this.session.planned_minutes || DEFAULT_MINUTES) * 60;
        const elapsedTotal = Math.floor((Date.now() - new Date(this.session.started_at).getTime()) / 1000);
        this.remainingSeconds = Math.max(0, total - elapsedTotal);
        await this._loadSteps();
        this.phase = this.remainingSeconds <= 0 ? 'finished' : 'running';
        return;
      }

      if (!taskId) {
        this.phase = 'error';
        this.error = 'Aucune tâche sélectionnée.';
        return;
      }

      this.phase = 'loading';
      try {
        const full = await api.get(`/tasks/${taskId}`);
        this.task = full;
        this.steps = full.steps || [];
        const minutes = plannedMinutes || full.estimated_minutes || DEFAULT_MINUTES;
        this.session = await api.post(`/tasks/${taskId}/focus/start`, { planned_minutes: minutes });
        this.interruptions = 0;
        this.remainingSeconds = minutes * 60;
        this._startedAtMs = Date.now();
        this.phase = 'running';
        this._persist();
      } catch (e) {
        this.phase = 'error';
        this.error = e.code === 'task_already_active'
          ? 'Une autre tâche est déjà active. Termine-la ou abandonne-la d\'abord.'
          : (e.message || 'Impossible de démarrer la session.');
      }
    },

    async _loadSteps() {
      if (!this.task) return;
      const full = await api.get(`/tasks/${this.task.id}`);
      this.steps = full.steps || [];
    },

    tick() {
      if (this.phase !== 'running') return;
      if (this.remainingSeconds > 0) {
        this.remainingSeconds -= 1;
        this._persist();
      }
      if (this.remainingSeconds <= 0) {
        this.phase = 'finished';
      }
    },

    registerInterruption() {
      if (this.phase !== 'running') return;
      this.interruptions += 1;
      this._persist();
    },

    async toggleDoNotDisturb() {
      if (!this.session) return;
      this.doNotDisturb = !this.doNotDisturb;
      await api.patch(`/tasks/focus/${this.session.id}/dnd`, { do_not_disturb: this.doNotDisturb });
    },

    async completeStep(stepId) {
      if (!this.task) return;
      try {
        const result = await api.post(`/tasks/${this.task.id}/steps/${stepId}/complete`, {});
        if (result.queued) {
          // Offline: mark it done locally now, server list will resync once the queue flushes.
          const step = this.steps.find((s) => s.id === stepId);
          if (step) step.done = true;
        } else {
          this.steps = result.steps;
        }
        this._persist();
      } catch (e) {
        this.error = e.message;
      }
    },

    async finish({ abandon = false } = {}) {
      if (!this.session) return;
      const plannedSeconds = (this.session.planned_minutes || DEFAULT_MINUTES) * 60;
      const actualMinutes = Math.max(1, Math.round((plannedSeconds - Math.max(0, this.remainingSeconds)) / 60));
      const completed = !abandon && this.remainingSeconds <= 0;
      try {
        await api.post(`/tasks/focus/${this.session.id}/end`, {
          completed,
          interruptions: this.interruptions,
          actualMinutes,
          abandon,
        });
      } finally {
        if (abandon) {
          this.reset();
        } else {
          this.summary = {
            stepsDone: this.doneStepsCount,
            stepsTotal: this.steps.length,
            actualMinutes,
            interruptions: this.interruptions,
            completed,
          };
          this.phase = 'summary';
          clearPersisted();
        }
      }
    },

    reset() {
      this.task = null;
      this.steps = [];
      this.session = null;
      this.phase = 'idle';
      this.remainingSeconds = DEFAULT_MINUTES * 60;
      this.interruptions = 0;
      this.error = null;
      this.summary = null;
      clearPersisted();
    },
  },
});
