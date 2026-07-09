// Minimal for now (Phase 1). Real FCM send/receive wired up in the
// "FCM + scheduler" phase — this just persists tokens so the client can
// register them as soon as the PWA shell asks for notification permission.
const express = require('express');
const { randomUUID: uuid } = require('crypto');
const db = require('../db');

const router = express.Router();

router.post('/register', (req, res) => {
  const { token, device_info } = req.body;
  if (!token) return res.status(400).json({ error: 'token_required' });
  const user = db.get('SELECT * FROM users LIMIT 1');
  const existing = db.get('SELECT * FROM fcm_tokens WHERE token = @token', { token });
  if (existing) {
    db.run('UPDATE fcm_tokens SET updated_at = @now, device_info = @device_info WHERE token = @token', {
      token, now: new Date().toISOString(), device_info: device_info || null,
    });
    return res.json(db.get('SELECT * FROM fcm_tokens WHERE token = @token', { token }));
  }
  const id = uuid();
  db.run('INSERT INTO fcm_tokens (id, user_id, token, device_info) VALUES (@id,@user_id,@token,@device_info)', {
    id, user_id: user.id, token, device_info: device_info || null,
  });
  res.status(201).json(db.get('SELECT * FROM fcm_tokens WHERE id = @id', { id }));
});

router.delete('/unregister', (req, res) => {
  db.run('DELETE FROM fcm_tokens WHERE token = @token', { token: req.body.token });
  res.status(204).end();
});

module.exports = router;
