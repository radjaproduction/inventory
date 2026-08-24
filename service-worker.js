// ============================================
// SERVICE WORKER - RADJA PRODUCTION PWA
// ============================================

// ==================== PUSH NOTIFICATION (FCM) — jalan walau app tertutup total ====================
// Digabung ke SW yang sudah ada ini (bukan file firebase-messaging-sw.js terpisah) supaya
// tidak bentrok scope dengan SW utama yang sudah mengurus cache & update-versi di bawah.
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAlHs68T1Z2G7VFouBmdXN1P4RR5S0v4ps",
    authDomain: "radja-production-push.firebaseapp.com",
    projectId: "radja-production-push",
    storageBucket: "radja-production-push.firebasestorage.app",
    messagingSenderId: "954081329577",
    appId: "1:954081329577:web:dc1f17f9a644f10f8804b8",
    measurementId: "G-0XFKYH2497"
});

const _fcmMessaging = firebase.messaging();

// Dipanggil otomatis oleh Firebase saat push masuk SEDANG app tertutup/di background.
// (Kalau app sedang terbuka/foreground, yang jalan malah messaging.onMessage() di index.html.)
// PENTING: payload dari server sekarang DATA-ONLY (lihat catatan di edge function
// send-push-pesanan) — field-nya ada di payload.data, BUKAN payload.notification.
// Ini yang mencegah notifikasi tampil dobel (sebelumnya FCM auto-display + showNotification
// manual di sini jalan berbarengan untuk 1 pesan yang sama).
_fcmMessaging.onBackgroundMessage((payload) => {
    const d = payload.data || {};
    const title = d.title || '📦 Pesanan Baru Masuk';
    const body = d.body || '';
    self.registration.showNotification(title, {
        body,
        icon: BASE + '/icon-192.png',
        badge: BASE + '/icon-192.png',
        tag: d.tag || 'pesanan-push',
        vibrate: [300, 150, 300, 150, 300, 150, 500],
        requireInteraction: true,
        data: { url: d.url || (BASE + '/index.html') },
    });
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

const CACHE_NAME = 'radja-production-v9';
const STATIC_CACHE = 'radja-static-v9';
const BASE = '/inventory';

const STATIC_ASSETS = [
    BASE + '/manifest.json',
    BASE + '/icon-192.png',
    BASE + '/icon-512.png'
];

// ===== INSTALL =====
self.addEventListener('install', event => {
    console.log('[SW] Installing v8.1.3...');
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
    console.log('[SW] Activating v8.1.3...');
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
