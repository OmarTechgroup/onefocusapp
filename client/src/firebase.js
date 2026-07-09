import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { api } from './api';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

async function registerServiceWorker() {
  // Config is passed as a query string because firebase-messaging-sw.js is a
  // static file in /public and can't read import.meta.env — see that file.
  const qs = new URLSearchParams(firebaseConfig).toString();
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${qs}`);
}

// Tries FCM push registration; returns { mode: 'fcm' | 'local' | 'unsupported' }.
// Per spec: always fall back to the local Notification API when FCM/VAPID/SW
// isn't available (notably: no Web Push on iOS unless installed to home screen).
export async function setupNotifications() {
  if (!('Notification' in window)) return { mode: 'unsupported' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { mode: 'denied' };

  if (!firebaseConfig.apiKey || !import.meta.env.VITE_FIREBASE_VAPID_KEY) {
    return { mode: 'local' };
  }

  try {
    const supported = await isSupported();
    if (!supported || !('serviceWorker' in navigator)) return { mode: 'local' };

    const app = initializeApp(firebaseConfig);
    const messaging = getMessaging(app);
    const registration = await registerServiceWorker();
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) return { mode: 'local' };

    await api.post('/fcm/register', {
      token,
      device_info: navigator.userAgent,
    });

    // Foreground messages don't trigger onBackgroundMessage in the SW — show them locally.
    onMessage(messaging, (payload) => {
      showLocalNotification(payload.notification?.title, payload.notification?.body, payload.data);
    });

    return { mode: 'fcm', token };
  } catch (e) {
    console.warn('[firebase] FCM setup failed, falling back to local notifications:', e.message);
    return { mode: 'local' };
  }
}

export function showLocalNotification(title, body, data = {}) {
  if (Notification.permission !== 'granted') return;
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(title || 'OneFocus', { body, data, icon: '/icons/icon-192.png' }));
  } else {
    new Notification(title || 'OneFocus', { body, data, icon: '/icons/icon-192.png' });
  }
}
