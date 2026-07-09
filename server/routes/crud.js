// Small generic CRUD factory for the simpler resources (missions, goals,
// categories, inbox_items, checkins) to avoid repeating boilerplate.
const express = require('express');
const { randomUUID: uuid } = require('crypto');
const db = require('../db');

function crudRouter(table, { fields, defaults = {}, orderBy = 'created_at DESC' }) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(db.all(`SELECT * FROM ${table} ORDER BY ${orderBy}`));
  });

  router.get('/:id', (req, res) => {
    const row = db.get(`SELECT * FROM ${table} WHERE id = @id`, { id: req.params.id });
    if (!row) return res.status(404).json({ error: 'not_found' });
    res.json(row);
  });

  router.post('/', (req, res) => {
    const id = uuid();
    const values = { id, ...defaults, ...req.body };
    const cols = ['id', ...fields.filter((f) => f in values)];
    const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`;
    db.run(sql, values);
    res.status(201).json(db.get(`SELECT * FROM ${table} WHERE id = @id`, { id }));
  });

  router.patch('/:id', (req, res) => {
    const updatable = fields.filter((f) => f in req.body);
    if (updatable.length === 0) return res.status(400).json({ error: 'no_valid_fields' });
    const setClause = updatable.map((f) => `"${f}" = @${f}`).join(', ');
    db.run(`UPDATE ${table} SET ${setClause} WHERE id = @id`, { ...req.body, id: req.params.id });
    res.json(db.get(`SELECT * FROM ${table} WHERE id = @id`, { id: req.params.id }));
  });

  router.delete('/:id', (req, res) => {
    db.run(`DELETE FROM ${table} WHERE id = @id`, { id: req.params.id });
    res.status(204).end();
  });

  return router;
}

module.exports = { crudRouter };
