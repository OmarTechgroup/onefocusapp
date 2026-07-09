const express = require('express');
const db = require('../db');
const taskService = require('../services/taskService');

const router = express.Router();

router.get('/', (req, res) => {
  const { status, quadrant, mission_id } = req.query;
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params = {};
  if (status) { sql += ' AND status = @status'; params.status = status; }
  if (quadrant) { sql += ' AND quadrant = @quadrant'; params.quadrant = quadrant; }
  if (mission_id) { sql += ' AND mission_id = @mission_id'; params.mission_id = mission_id; }
  sql += ' ORDER BY quadrant, due_date, "order"';
  res.json(db.all(sql, params));
});

router.get('/active', (req, res) => {
  res.json(taskService.getActiveTask() || null);
});

router.get('/:id', (req, res) => {
  const task = db.get('SELECT * FROM tasks WHERE id = @id', { id: req.params.id });
  if (!task) return res.status(404).json({ error: 'not_found' });
  const steps = db.all('SELECT * FROM steps WHERE task_id = @id ORDER BY "order"', { id: req.params.id });
  res.json({ ...task, steps });
});

router.post('/', (req, res) => {
  try {
    const task = taskService.createTask(req.body);
    res.status(201).json(task);
  } catch (e) {
    handleDomainError(e, res);
  }
});

router.patch('/:id', (req, res) => {
  const allowed = ['title', 'description', 'due_date', 'quadrant', 'estimated_minutes', 'mission_id', 'goal_id', 'status', 'order'];
  const fields = Object.keys(req.body).filter((k) => allowed.includes(k));
  if (fields.length === 0) return res.status(400).json({ error: 'no_valid_fields' });
  if (fields.includes('quadrant')) taskService.assertQuadrant(req.body.quadrant);

  const values = { ...req.body, id: req.params.id };
  // Marking a task done outside a focus session (quick-complete) still needs
  // completed_at set, so it counts toward the day's report/score like any other.
  if (req.body.status === 'done') {
    fields.push('completed_at');
    values.completed_at = new Date().toISOString();
  }

  const setClause = fields.map((f) => `"${f}" = @${f}`).join(', ');
  db.run(`UPDATE tasks SET ${setClause} WHERE id = @id`, values);
  res.json(db.get('SELECT * FROM tasks WHERE id = @id', { id: req.params.id }));
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM tasks WHERE id = @id', { id: req.params.id });
  res.status(204).end();
});

router.post('/:id/one-thing', (req, res) => {
  const date = req.body.date || new Date().toISOString().slice(0, 10);
  res.json(taskService.setOneThing(req.params.id, date));
});

router.post('/:id/steps', (req, res) => {
  const { randomUUID } = require('crypto');
  const id = randomUUID();
  const order = db.get('SELECT COALESCE(MAX("order"), -1) + 1 as next FROM steps WHERE task_id = @id', { id: req.params.id }).next;
  db.run('INSERT INTO steps (id, task_id, title, "order") VALUES (@id,@task_id,@title,@order)', {
    id, task_id: req.params.id, title: req.body.title, order,
  });
  res.status(201).json(db.get('SELECT * FROM steps WHERE id = @id', { id }));
});

router.post('/:id/steps/:stepId/complete', (req, res) => {
  try {
    res.json(taskService.completeStep(req.params.id, req.params.stepId));
  } catch (e) {
    handleDomainError(e, res);
  }
});

router.post('/:id/focus/start', (req, res) => {
  try {
    res.status(201).json(taskService.startFocusSession(req.params.id, req.body.planned_minutes));
  } catch (e) {
    handleDomainError(e, res);
  }
});

router.patch('/focus/:sessionId/dnd', (req, res) => {
  db.run('UPDATE focus_sessions SET do_not_disturb = @dnd WHERE id = @id', {
    id: req.params.sessionId,
    dnd: req.body.do_not_disturb ? 1 : 0,
  });
  res.json(db.get('SELECT * FROM focus_sessions WHERE id = @id', { id: req.params.sessionId }));
});

router.post('/focus/:sessionId/end', (req, res) => {
  try {
    res.json(taskService.endFocusSession(req.params.sessionId, req.body));
  } catch (e) {
    handleDomainError(e, res);
  }
});

function handleDomainError(e, res) {
  if (e.code) return res.status(400).json({ error: e.code, message: e.message });
  console.error(e);
  res.status(500).json({ error: 'internal_error' });
}

module.exports = router;
