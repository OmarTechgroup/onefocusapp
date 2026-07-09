const db = require('../db');
const { getApp } = require('./admin');

// Sends a notification+data payload to every token registered for the (single) user.
// Invalid/unregistered tokens are pruned from the DB so they stop being retried.
// Returns { sent, failed } — never throws, so a missing Firebase config never breaks
// the scheduler or a route that just wants to fire a reminder best-effort.
async function sendToUser({ title, body, data = {}, clickAction } = {}) {
  const app = getApp();
  const tokens = db.all('SELECT * FROM fcm_tokens');
  if (!tokens.length) return { sent: 0, failed: 0, reason: 'no_tokens' };
  if (!app) return { sent: 0, failed: 0, reason: 'fcm_not_configured' };

  const admin = require('firebase-admin');
  const stringData = Object.fromEntries(
    Object.entries({ ...data, click_action: clickAction || '/' }).map(([k, v]) => [k, String(v)])
  );

  const message = {
    tokens: tokens.map((t) => t.token),
    notification: { title, body },
    data: stringData,
    webpush: {
      fcmOptions: { link: clickAction || '/' },
      notification: { icon: '/icons/icon-192.png' },
    },
  };

  let response;
  try {
    response = await admin.messaging().sendEachForMulticast(message);
  } catch (e) {
    console.error('[fcm] send failed:', e.message);
    return { sent: 0, failed: tokens.length, reason: 'send_error' };
  }

  const staleTokens = [];
  response.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        staleTokens.push(tokens[i].token);
      }
    }
  });
  if (staleTokens.length) {
    const tx = db.transaction(() => {
      for (const token of staleTokens) db.run('DELETE FROM fcm_tokens WHERE token = @token', { token });
    });
    tx();
  }

  return { sent: response.successCount, failed: response.failureCount };
}

module.exports = { sendToUser };
