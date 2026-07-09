const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// isolated db file per test run
const tmpDb = path.join(__dirname, 'tmp-test.db');
for (const ext of ['', '-wal', '-shm']) { try { fs.unlinkSync(tmpDb + ext); } catch {} }
process.env.DB_PATH = tmpDb;

const db = require('../db');
db.migrate();
const taskService = require('../services/taskService');

function makeTask(quadrant = 'urgent_important') {
  return taskService.createTask({ title: 'Test task', quadrant });
}

test('quadrant is required to create a task', () => {
  assert.throws(() => taskService.createTask({ title: 'No quadrant' }), /quadrant/);
});

test('steps must be completed in order', () => {
  const task = makeTask();
  const { randomUUID } = require('crypto');
  const s1 = randomUUID(); const s2 = randomUUID();
  db.run('INSERT INTO steps (id, task_id, title, "order") VALUES (@id,@task,@title,0)', { id: s1, task: task.id, title: 'Step 1' });
  db.run('INSERT INTO steps (id, task_id, title, "order") VALUES (@id,@task,@title,1)', { id: s2, task: task.id, title: 'Step 2' });

  assert.throws(() => taskService.completeStep(task.id, s2), /ordre/);
  taskService.completeStep(task.id, s1);
  const { steps } = taskService.completeStep(task.id, s2) && taskService.nextLockedStep(task.id);
  assert.equal(steps.every((s) => s.done), true);
});

test('cannot have two active tasks at once', () => {
  const t1 = makeTask();
  const t2 = makeTask();
  taskService.startFocusSession(t1.id, 25);
  assert.throws(() => taskService.startFocusSession(t2.id, 25), /active/);
});

test('overdue tasks become missed', () => {
  const task = makeTask();
  db.run('UPDATE tasks SET due_date = @d WHERE id = @id', { id: task.id, d: '2000-01-01' });
  const missed = taskService.markOverdueTasksMissed();
  assert.ok(missed.includes(task.id));
  const updated = db.get('SELECT * FROM tasks WHERE id = @id', { id: task.id });
  assert.equal(updated.status, 'missed');
});

test.after(() => {
  for (const ext of ['', '-wal', '-shm']) { try { fs.unlinkSync(tmpDb + ext); } catch {} }
});
