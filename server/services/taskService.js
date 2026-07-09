// Central place for the rules the spec calls "comportements clés à ne pas rater":
// - never two active tasks at once
// - steps are strictly sequential (step N+1 locked until N is done)
// - every task needs an Eisenhower quadrant before being saved (inbox items exempt)
const { randomUUID: uuid } = require('crypto');
const db = require('../db');

class DomainError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code || 'domain_error';
  }
}

const QUADRANTS = ['urgent_important', 'important', 'urgent', 'neither'];

function assertQuadrant(quadrant) {
  if (!QUADRANTS.includes(quadrant)) {
    throw new DomainError('Une tâche doit avoir un quadrant Eisenhower valide.', 'quadrant_required');
  }
}

function getActiveTask() {
  return db.get(`SELECT * FROM tasks WHERE status = 'active' LIMIT 1`);
}

function createTask(input) {
  assertQuadrant(input.quadrant);
  const id = uuid();
  db.run(
    `INSERT INTO tasks (id, mission_id, goal_id, title, description, due_date, quadrant, status, estimated_minutes, is_one_thing, tags_json)
     VALUES (@id,@mission_id,@goal_id,@title,@description,@due_date,@quadrant,'todo',@estimated_minutes,0,@tags_json)`,
    {
      id,
      mission_id: input.mission_id || null,
      goal_id: input.goal_id || null,
      title: input.title,
      description: input.description || null,
      due_date: input.due_date || null,
      quadrant: input.quadrant,
      estimated_minutes: input.estimated_minutes || null,
      tags_json: JSON.stringify(input.tags || []),
    }
  );
  return db.get(`SELECT * FROM tasks WHERE id = @id`, { id });
}

function setOneThing(taskId, dateStr) {
  const tx = db.transaction(() => {
    db.run(`UPDATE tasks SET is_one_thing = 0 WHERE one_thing_date = @date`, { date: dateStr });
    db.run(`UPDATE tasks SET is_one_thing = 1, one_thing_date = @date WHERE id = @id`, { id: taskId, date: dateStr });
  });
  tx();
  return db.get(`SELECT * FROM tasks WHERE id = @id`, { id: taskId });
}

function nextLockedStep(taskId) {
  const steps = db.all(`SELECT * FROM steps WHERE task_id = @taskId ORDER BY "order" ASC`, { taskId });
  const idx = steps.findIndex((s) => !s.done);
  return { steps, activeIndex: idx };
}

function completeStep(taskId, stepId) {
  const { steps, activeIndex } = nextLockedStep(taskId);
  const target = steps.find((s) => s.id === stepId);
  if (!target) throw new DomainError('Étape introuvable.', 'not_found');
  const targetIndex = steps.findIndex((s) => s.id === stepId);
  if (targetIndex !== activeIndex) {
    throw new DomainError('Les étapes doivent être complétées dans l\'ordre.', 'step_locked');
  }
  db.run(`UPDATE steps SET done = 1, done_at = @now WHERE id = @id`, { id: stepId, now: new Date().toISOString() });
  return nextLockedStep(taskId);
}

function startFocusSession(taskId, plannedMinutes) {
  const active = getActiveTask();
  if (active && active.id !== taskId) {
    throw new DomainError('Une autre tâche est déjà active. Termine ou abandonne la session en cours.', 'task_already_active');
  }
  const task = db.get(`SELECT * FROM tasks WHERE id = @id`, { id: taskId });
  if (!task) throw new DomainError('Tâche introuvable.', 'not_found');

  const tx = db.transaction(() => {
    db.run(`UPDATE tasks SET status = 'active' WHERE id = @id`, { id: taskId });
    const sessionId = uuid();
    db.run(
      `INSERT INTO focus_sessions (id, task_id, started_at, planned_minutes) VALUES (@id,@task_id,@started_at,@planned_minutes)`,
      { id: sessionId, task_id: taskId, started_at: new Date().toISOString(), planned_minutes: plannedMinutes || 25 }
    );
    return sessionId;
  });
  const sessionId = tx();
  return db.get(`SELECT * FROM focus_sessions WHERE id = @id`, { id: sessionId });
}

function endFocusSession(sessionId, { completed, interruptions, actualMinutes, abandon }) {
  const session = db.get(`SELECT * FROM focus_sessions WHERE id = @id`, { id: sessionId });
  if (!session) throw new DomainError('Session introuvable.', 'not_found');
  const tx = db.transaction(() => {
    db.run(
      `UPDATE focus_sessions SET ended_at = @ended_at, actual_minutes = @actual_minutes, interruptions = @interruptions, completed = @completed WHERE id = @id`,
      {
        id: sessionId,
        ended_at: new Date().toISOString(),
        actual_minutes: actualMinutes || 0,
        interruptions: interruptions || 0,
        completed: completed ? 1 : 0,
      }
    );
    const newStatus = abandon ? 'todo' : completed ? 'done' : 'todo';
    db.run(`UPDATE tasks SET status = @status, completed_at = @completedAt WHERE id = @id`, {
      id: session.task_id,
      status: newStatus,
      completedAt: newStatus === 'done' ? new Date().toISOString() : null,
    });
  });
  tx();
  return db.get(`SELECT * FROM focus_sessions WHERE id = @id`, { id: sessionId });
}

// Used by the scheduler: any task past its due_date/time_block end that is
// still not done becomes "missed" — no gray zone as the spec requires.
function markOverdueTasksMissed() {
  const nowIso = new Date().toISOString();
  const overdueByDueDate = db.all(
    `SELECT id FROM tasks WHERE status IN ('todo','active') AND due_date IS NOT NULL AND due_date < @today`,
    { today: nowIso.slice(0, 10) }
  );
  const overdueByBlock = db.all(
    `SELECT t.id FROM tasks t
     JOIN time_blocks tb ON tb.task_id = t.id
     WHERE t.status IN ('todo','active') AND (tb.date || 'T' || tb.end_time) < @now`,
    { now: nowIso.slice(0, 16) }
  );
  const ids = new Set([...overdueByDueDate.map((r) => r.id), ...overdueByBlock.map((r) => r.id)]);
  const tx = db.transaction(() => {
    for (const id of ids) {
      db.run(`UPDATE tasks SET status = 'missed' WHERE id = @id`, { id });
    }
  });
  tx();
  return [...ids];
}

module.exports = {
  DomainError,
  QUADRANTS,
  assertQuadrant,
  getActiveTask,
  createTask,
  setOneThing,
  nextLockedStep,
  completeStep,
  startFocusSession,
  endFocusSession,
  markOverdueTasksMissed,
};
