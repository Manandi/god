self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() || '' }; }
  event.waitUntil(self.registration.showNotification(payload.title || 'The Hollow Roots', {
    body: payload.body || 'Your Weekly Quest is waiting.',
    tag: payload.tag || 'hollow-roots-weekly-quest',
    data: { url: payload.url || self.registration.scope }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const scope = new URL(self.registration.scope);
    const existing = windows.find(client => {
      const url = new URL(client.url);
      return url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
    });
    if (existing) return existing.focus();
    return self.clients.openWindow(event.notification.data?.url || self.registration.scope);
  })());
});
