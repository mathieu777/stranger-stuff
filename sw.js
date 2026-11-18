/* Service worker : un petit programme que le navigateur garde en arrière-plan.
   Il enregistre les fichiers du jeu sur l'appareil pour qu'il marche sans réseau.

   Quand tu modifies un fichier du jeu, change le numéro de version ci-dessous :
   c'est ce qui indique aux téléphones de télécharger la nouvelle version. */
const CACHE = 'stranger-stuff-v2';

const FILES = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

// 1. Installation : on met tous les fichiers en cache.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

// 2. Activation : on supprime les caches des anciennes versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 3. Chaque requête : on sert le cache d'abord, le réseau en secours.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        // Hors ligne sur une page inconnue : on renvoie l'accueil du jeu.
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
