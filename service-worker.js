// ============================================
// SERVICE WORKER - RADJA PRODUCTION PWA
// ============================================

const CACHE_NAME = 'radja-production-v11.2';
const STATIC_CACHE = 'radja-static-v11.2';
const BASE = '/inventory';

const STATIC_ASSETS = [
    BASE + '/manifest.json',
    BASE + '/icon-192.png',
    BASE + '/icon-512.png'
];

// ==================== PUSH NOTIFICATION (FCM) — jalan walau app tertutup total ====================
// PENTING — PERUBAHAN BESAR dari versi sebelumnya:
// Sebelumnya SW ini import firebase-messaging-compat.js dan pakai
// `firebase.messaging().onBackgroundMessage(...)` buat nangkep push & nampilin notifikasi.
// Itu sumber 2 bug yang dialami:
//   1) SW versi "notification payload" -> notif keluar 2x. Ini karena kalau payload dari
//      server masih ada field `notification` (bukan cuma `data`), Firebase SDK otomatis
//      nampilin notifikasi sendiri di background TANPA manggil onBackgroundMessage — itu
//      jalan BARENGAN sama showNotification() manual di kode kita -> dobel.
//   2) SW versi "data-only" -> notif kadang tidak keluar SAMA SEKALI. Karena
//      firebase-messaging-compat "mencegat" event push duluan lewat listener internalnya
//      sendiri, lalu baru meneruskan ke onBackgroundMessage lewat rantai Promise tambahan.
//      Di WebView/PWA iOS & sebagian Android, kalau showNotification() tidak dipanggil
//      SECARA SINKRON & LANGSUNG di dalam event 'push' asli, browser bisa diam-diam
//      membuang notifikasinya (dianggap "tidak show apa-apa" = melanggar aturan push API,
//      jadi lebih baik dibuang daripada error).
//
// FIX: tidak pakai firebase-messaging-compat.js sama sekali di SW ini. Kita dengar event
// 'push' bawaan browser langsung, dan panggil showNotification() satu kali, sinkron.
// Token FCM tetap didapat dari index.html pakai Firebase SDK di sana (client-side) — itu
// tidak butuh SW ini punya kode firebase juga, cukup service worker registration-nya saja.
self.addEventListener('push', (event) => {
    let d = {};
    try {
        d = event.data ? event.data.json() : {};
    } catch (e) {
        d = {};
    }
    // Server (edge function send-push-pesanan) DIHARUSKAN kirim data-only payload
    // (field-nya ada di payload.data, bukan payload.notification), supaya browser TIDAK
    // auto-display sendiri. Tapi tetap fallback baca .notification juga buat jaga-jaga
    // kalau suatu saat payload-nya masih campuran.
    const data = d.data || d.notification || d || {};
    const title = data.title || '📦 Pesanan Baru Masuk';
    const body = data.body || '';
    const tag = data.tag || 'pesanan-push';
    const url = data.url || (BASE + '/index.html');

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: BASE + '/icon-192.png',
            badge: BASE + '/icon-192.png',
            tag,
            vibrate: [300, 150, 300, 150, 300, 150, 500],
            requireInteraction: true,
            data: { url },
        })
    );
});

// Klik notifikasi -> fokus tab app yang sudah ada, atau buka baru kalau belum ada.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || (BASE + '/index.html');
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const c of clientList) {
                if (c.url.includes(BASE) && 'focus' in c) return c.focus();
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});
// ==================== AKHIR TAMBAHAN PUSH NOTIFICATION ====================

// ===== INSTALL =====
self.addEventListener('install', event => {
    console.log('[SW] Installing v11.2...');
    event.waitUntil(
        caches.open(STATIC_CACHE).then(cache => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
        // CATATAN: self.skipWaiting() SENGAJA TIDAK dipanggil otomatis di sini lagi.
        // Sebelumnya SW versi baru langsung aktif sendiri begitu ter-install, yang artinya
        // app bisa reload sendiri tiba-tiba pas user lagi ngisi form (misal transaksi/qty).
        // Sekarang SW baru akan "menunggu" (waiting) dulu sampai user klik tombol UPDATE
        // di banner pada app.html — baru dia aktif lewat pesan 'SKIP_WAITING' di bawah.
    );
});

// ===== PESAN DARI HALAMAN (dipicu tombol "UPDATE" di banner notifikasi versi baru) =====
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ===== ACTIVATE =====
self.addEventListener('activate', event => {
    console.log('[SW] Activating v11.2...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME && name !== STATIC_CACHE)
                    .map(name => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// ===== FETCH =====
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // index.html — SELALU dari network, jangan pernah cache.
    // PENTING: fetch(request) biasa TETAP boleh dijawab dari HTTP cache bawaan
    // browser/WKWebView (terutama di PWA iOS yang di-install ke homescreen, itu
    // sangat agresif nge-cache). Pakai cache:'reload' supaya request ini benar-benar
    // memaksa revalidasi ke server dan mengabaikan HTTP cache sepenuhnya.
    if (url.pathname === BASE + '/' || url.pathname === BASE + '/index.html' || url.pathname === BASE) {
        event.respondWith(
            fetch(request, { cache: 'no-store' }).catch(() => caches.match(request))
        );
        return;
    }

    // Supabase API — selalu dari network
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(
            fetch(request).catch(() => {
                return new Response(
                    JSON.stringify({ error: 'Offline - tidak dapat terhubung ke database' }),
                    { headers: { 'Content-Type': 'application/json' } }
                );
            })
        );
        return;
    }

    // CDN assets — cache first
    if (url.hostname.includes('cdn.') || url.hostname.includes('cdnjs.') || url.hostname.includes('jsdelivr.') || url.hostname.includes('fonts.')) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;
                return fetch(request).then(response => {
                    const clone = response.clone();
                    caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // File lain — network first
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});
