// Service worker for Vinskap som installert webapp.
// - Siden (index.html): nettet først, lagret kopi hvis du er offline. Nye versjoner kommer med en gang.
// - Byggefiler med hash i navnet (/_expo/static, /assets): hentes én gang og lagres (de endres aldri).
// - Ikoner og strekkode-dekoderen: lagret kopi med oppdatering i bakgrunnen.
// - Alt annet (Supabase, Vinmonopolet-bilder): rett til nettet, aldri mellomlagret her.
const CACHE = 'vinskap-v2';

// Lagre siden og JavaScript-filene den peker til med en gang, så appen også åpner uten nett
// første gang etter at den er lagt til på hjem-skjermen.
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    try {
      const res = await fetch('/', { cache: 'no-store' });
      const html = await res.clone().text();
      await c.put('/', res);
      const files = [...html.matchAll(/(?:src|href)="(\/(?:_expo\/static|assets|icons)\/[^"]+)"/g)].map((m) => m[1]);
      await c.addAll([...new Set([...files, '/manifest.webmanifest'])]);
    } catch {
      // Uten nett ved installasjon: lagres ved første vanlige besøk i stedet.
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('/', res.clone());
        return res;
      } catch {
        return (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
    return;
  }

  if (url.pathname.startsWith('/icons/') || url.pathname === '/zxing_reader.wasm' || url.pathname === '/manifest.webmanifest') {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      const fresh = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || fresh;
    })());
  }
});
