// Firebase web config isn't secret (it's restricted by Firebase security rules, not
// by hiding these values) but this file is static and can't read import.meta.env,
// so the client passes it via the registration URL's query string instead —
// see registerServiceWorker() in src/firebase.js.
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search);
const firebaseConfig = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // App fully closed / tab not focused: this is the only handler that fires.
  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification || {};
    const data = payload.data || {};
    const actions = [];
    if (data.type === 'task_missed') {
      actions.push({ action: 'reschedule', title: 'Reporter' });
      actions.push({ action: 'focus_now', title: 'Faire maintenant' });
    }
    self.registration.showNotification(title || 'OneFocus', {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data,
      actions,
      tag: data.type || 'onefocus',
    });
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = data.click_action || '/';

  if (event.action === 'reschedule' && data.task_id) {
    url = `/missions?task=${data.task_id}&action=reschedule`;
  } else if (event.action === 'focus_now' && data.task_id) {
    url = `/focus/${data.task_id}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
