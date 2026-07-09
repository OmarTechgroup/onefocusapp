// Lazy Firebase Admin init: either FIREBASE_SERVICE_ACCOUNT_JSON (one-line JSON,
// handy for hosts without file uploads like o2switch) or fcm/serviceAccountKey.json.
const fs = require('fs');
const path = require('path');

let app = null;
let initTried = false;

function getApp() {
  if (app) return app;
  if (initTried) return null;
  initTried = true;

  const admin = require('firebase-admin');
  let credentialJson = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      credentialJson = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      console.error('[fcm] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON:', e.message);
    }
  } else {
    const keyPath = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      credentialJson = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    }
  }

  if (!credentialJson) {
    console.warn('[fcm] No Firebase service account configured — push notifications are disabled. See .env.example.');
    return null;
  }

  app = admin.initializeApp({ credential: admin.credential.cert(credentialJson) });
  return app;
}

module.exports = { getApp };
