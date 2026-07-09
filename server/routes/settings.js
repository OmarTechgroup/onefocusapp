const express = require('express');
const db = require('../db');

const router = express.Router();

function getUser() {
  return db.get('SELECT * FROM users LIMIT 1');
}

router.get('/', (req, res) => {
  const user = getUser();
  if (!user) return res.status(404).json({ error: 'no_user' });
  res.json({ id: user.id, name: user.name, ...JSON.parse(user.settings_json) });
});

router.patch('/', (req, res) => {
  const user = getUser();
  if (!user) return res.status(404).json({ error: 'no_user' });
  const current = JSON.parse(user.settings_json);
  const merged = { ...current, ...req.body };
  db.run('UPDATE users SET settings_json = @settings WHERE id = @id', { id: user.id, settings: JSON.stringify(merged) });
  res.json(merged);
});

module.exports = router;
