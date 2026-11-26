// 每日施工工項看板：離線快取，24 小時後整批清除重抓
const CACHE = 'wp-board1-v1', TTL = 24 * 3600e3, STAMP = './__stamp';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(fresh().then(c => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())));
async function fresh() {
  await caches.delete(CACHE);
  const c = await caches.open(CACHE);
  await c.put(STAMP, new Response(String(Date.now())));
  return c;
}
async function cacheOk() {
  const c = await caches.open(CACHE), s = await c.match(STAMP);
  if (!s || Date.now() - Number(await s.text()) > TTL) return fresh();
  return c;
}
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (/\.csv$/i.test(url.pathname)) return;   // 每日資料：一律直接抓網路，不進快取
  const page = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
  e.respondWith(cacheOk().then(async c => {
    if (page) {   // 頁面：先抓網路 (有新版就換)，離線才用快取
      try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; } catch (err) { return (await c.match(req)) || (await c.match('index.html')) || Response.error(); }
    }
    const hit = await c.match(req);   // 平面圖等：24 小時內用快取
    if (hit) return hit;
    const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r;
  }));
});
