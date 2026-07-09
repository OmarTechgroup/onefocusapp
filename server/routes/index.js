const express = require('express');
const { crudRouter } = require('./crud');
const db = require('../db');
const { randomUUID: uuid } = require('crypto');

const router = express.Router();

router.use('/tasks', require('./tasks'));

router.use('/missions', crudRouter('missions', {
  fields: ['title', 'description', 'goal_id', 'color', 'status'],
  defaults: { color: '#F59E0B', status: 'active' },
}));

router.use('/goals', crudRouter('goals', {
  fields: ['level', 'title', 'parent_goal_id', 'deadline'],
  orderBy: "CASE level WHEN 'someday' THEN 0 WHEN 'year' THEN 1 WHEN 'month' THEN 2 WHEN 'week' THEN 3 END",
}));

router.use('/categories', crudRouter('categories', {
  fields: ['name', 'color', 'icon', 'is_productive'],
  defaults: { is_productive: 1 },
  orderBy: 'name',
}));

router.use('/steps', crudRouter('steps', {
  fields: ['title', 'order', 'done', 'done_at'],
  orderBy: '"order"',
}));

router.use('/time-blocks', crudRouter('time_blocks', {
  fields: ['task_id', 'date', 'start_time', 'end_time', 'notified'],
  orderBy: 'date, start_time',
}));

// Inbox: capture without classification; must be processed into a real
// task (with quadrant) within 24h per the spec.
router.get('/inbox', (req, res) => {
  res.json(db.all('SELECT * FROM inbox_items WHERE processed = 0 ORDER BY created_at'));
});
router.post('/inbox', (req, res) => {
  const id = uuid();
  db.run('INSERT INTO inbox_items (id, content) VALUES (@id, @content)', { id, content: req.body.content });
  res.status(201).json(db.get('SELECT * FROM inbox_items WHERE id = @id', { id }));
});
router.post('/inbox/:id/process', (req, res) => {
  db.run('UPDATE inbox_items SET processed = 1 WHERE id = @id', { id: req.params.id });
  res.status(204).end();
});
router.delete('/inbox/:id', (req, res) => {
  db.run('DELETE FROM inbox_items WHERE id = @id', { id: req.params.id });
  res.status(204).end();
});

// Check-ins
const CHECKIN_SELECT = `
  SELECT c.*, cat.name as category_name, cat.color as category_color, cat.icon as category_icon
  FROM checkins c LEFT JOIN categories cat ON cat.id = c.category_id
`;

router.get('/checkins', (req, res) => {
  const { date } = req.query;
  if (date) {
    return res.json(db.all(
      `${CHECKIN_SELECT} WHERE substr(c.timestamp,1,10) = @date ORDER BY c.timestamp`,
      { date }
    ));
  }
  res.json(db.all(`${CHECKIN_SELECT} ORDER BY c.timestamp DESC LIMIT 200`));
});
router.post('/checkins', (req, res) => {
  const id = uuid();
  db.run(
    `INSERT INTO checkins (id, timestamp, content, input_mode, category_id, task_id, missed)
     VALUES (@id,@timestamp,@content,@input_mode,@category_id,@task_id,0)`,
    {
      id,
      timestamp: req.body.timestamp || new Date().toISOString(),
      content: req.body.content || null,
      input_mode: req.body.input_mode || 'text',
      category_id: req.body.category_id || null,
      task_id: req.body.task_id || null,
    }
  );
  res.status(201).json(db.get('SELECT * FROM checkins WHERE id = @id', { id }));
});

// 66-day habit heatmap
router.get('/streaks', (req, res) => {
  const days = Math.min(400, Number(req.query.days) || 90);
  const rows = db.all('SELECT * FROM streaks ORDER BY date DESC LIMIT @days', { days });
  res.json(rows.reverse());
});

router.use('/quotes', require('./quotes'));

router.use('/reports', require('./reports'));
router.use('/fcm', require('./fcm'));
router.use('/settings', require('./settings'));

module.exports = router;
