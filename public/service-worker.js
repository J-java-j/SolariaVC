// solariavc.com no longer uses a service worker. An older version of the site installed one at
// this address, and browsers that still have it can be answered from its saved copies of pages,
// so they miss updates. When such a browser next checks this address for an update, it gets this
// file instead: it deletes those saved copies, removes itself, and reloads the open pages from the
// website. It answers no requests itself. No page registers it, so new visitors never load it.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const saved = await caches.keys();
      await Promise.all(saved.map((name) => caches.delete(name)));
    } catch {}
    try {
      await self.registration.unregister();
    } catch {}
    try {
      const pages = await self.clients.matchAll({ type: 'window' });
      await Promise.all(pages.map((page) => page.navigate(page.url).catch(() => {})));
    } catch {}
  })());
});
