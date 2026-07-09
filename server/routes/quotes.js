const express = require('express');
const { randomUUID: uuid } = require('crypto');
const db = require('../db');
const quoteService = require('../services/quoteService');

const router = express.Router();

// Specific routes before '/:id' so they don't get swallowed by the param route.
router.get('/today', (req, res) => {
  res.json(quoteService.getTodayQuote());
});

router.get('/random', (req, res) => {
  res.json(quoteService.getRandomQuote());
});

router.get('/', (req, res) => {
  res.json(db.all('SELECT * FROM quotes ORDER BY is_favorite DESC, created_at DESC'));
});

router.post('/', (req, res) => {
  const { text, author, category } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text_required' });
  const id = uuid();
  db.run(
    `INSERT INTO quotes (id, text, author, category, is_custom) VALUES (@id,@text,@author,@category,1)`,
    { id, text: text.trim(), author: author?.trim() || null, category: category || null }
  );
  res.status(201).json(db.get('SELECT * FROM quotes WHERE id = @id', { id }));
});

router.patch('/:id', (req, res) => {
  const allowed = ['text', 'author', 'category', 'is_active', 'is_favorite'];
  const fields = Object.keys(req.body).filter((k) => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'no_valid_fields' });
  const setClause = fields.map((f) => `"${f}" = @${f}`).join(', ');
  db.run(`UPDATE quotes SET ${setClause} WHERE id = @id`, { ...req.body, id: req.params.id });
  res.json(db.get('SELECT * FROM quotes WHERE id = @id', { id: req.params.id }));
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM quotes WHERE id = @id', { id: req.params.id });
  res.status(204).end();
});

module.exports = router;
