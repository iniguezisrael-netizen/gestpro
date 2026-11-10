// ============================================================
// Service Worker — Campers La Cuesta
// Estrategia:
//   - index.html: Network first → fallback a caché (siempre sirve la versión más reciente)
//   - Librerías CDN: Cache first → fallback a red (rápido y funciona offline)
//   - APIs Firebase / Storage: no interceptar (Firebase SDK lo maneja internamente)
// ============================================================

const CACHE_VERSION = 'campers-v324';

// Recursos que se pre-cachean al instalar el SW
const PRE_CACHE = [
  '/index.html',
  '/logo.png',
  // Firebase SDK
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-storage-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-functions-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-app-check-compat.js',
  // Librerías (se cargan lazy en la app)
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js',
  // Fuentes para PDF
  'https://cdn.jsdelivr.net/gh/google/fonts/ofl/poppins/Poppins-Bold.ttf',
  'https://cdn.jsdelivr.net/gh/google/fonts/ofl/poppins/Poppins-Black.ttf',
];

// Dominios que NO interceptamos
// - Firebase: su SDK maneja offline nativamente
// - R2/Cloudflare: las imágenes <img> no necesitan CORS, pero fetch() sí — al interceptarlas
//   el SW convierte la petición en CORS lo que R2 rechaza. Se deja pasar directamente.
const SKIP_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebasestorage.googleapis.com',
  'cloudfunctions.net',
  'firebase.googleapis.com',
  'r2.dev',                    // imágenes Cloudflare R2 (público)
  'cloudflare.com',            // workers de Cloudflare
];

// ── INSTALL: pre-cachear recursos críticos ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => {
        // Intentamos cachear cada recurso individualmente para que
        // un fallo aislado no rompa toda la instalación.
        return Promise.allSettled(
          PRE_CACHE.map(url =>
            cache.add(url).catch(err =>
              console.warn('[SW] No se pudo pre-cachear:', url, err)
            )
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: eliminar cachés viejas ───────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k.startsWith('campers-') && k !== CACHE_VERSION)
            .map(k => {
              console.log('[SW] Eliminando caché vieja:', k);
              return caches.delete(k);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── FETCH: interceptar peticiones ──────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return; // solo GET

  let url;
  try { url = new URL(req.url); } catch { return; }

  // No interceptar APIs de Firebase/Google
  if (SKIP_HOSTS.some(h => url.hostname.includes(h))) return;

  // No interceptar chrome-extension u otros esquemas
  if (!['http:', 'https:'].includes(url.protocol)) return;

  const isAppShell = url.hostname === self.location.hostname; // el propio dominio
  const isCDN = !isAppShell; // cualquier host externo (gstatic, cdnjs, jsdelivr…)

  if (isAppShell) {
    // ── STALE WHILE REVALIDATE (app) ──
    // Sirve desde caché de inmediato (carga instantánea).
    // En background actualiza la caché para la próxima visita.
    // Si no hay caché aún (primera visita), espera la red.
    event.respondWith(
      caches.open(CACHE_VERSION).then(cache =>
        cache.match(req).then(cached => {
          const networkFetch = fetch(req).then(response => {
            if (response && response.ok) {
              cache.put(req, response.clone());
            }
            return response;
          }).catch(() => null);

          // Si hay versión en caché, sirve inmediato y actualiza en background
          if (cached) {
            event.waitUntil(networkFetch);
            return cached;
          }
          // Primera visita: esperar red
          return networkFetch.then(r => r || caches.match('/index.html'));
        })
      )
    );
  } else {
    // ── CACHE FIRST (CDN / librerías) ──
    // Sirve desde caché si existe; si no, busca en red y guarda para la próxima.
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(c => c.put(req, clone));
          }
          return response;
        }).catch(() => {
          // Sin caché y sin red: no hay nada que hacer
          return new Response('', { status: 503, statusText: 'Sin conexión y sin caché' });
        });
      })
    );
  }
});
