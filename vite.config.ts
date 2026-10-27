import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const base = '/kids-color-by-number/'

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: 'offline-app-shell',
      apply: 'build',
      enforce: 'post',
      generateBundle: {
        order: 'post',
        handler(_options, bundle) {
          const files = [
            'index.html',
            'icon.svg',
            'manifest.webmanifest',
            ...Object.keys(bundle).filter(
              (file) => file !== 'index.html' && !file.endsWith('.map'),
            ),
          ]
          const hash = createHash('sha256').update(files.join('|'))
          for (const file of Object.values(bundle))
            hash.update(file.type === 'asset' ? file.source : file.code)
          for (const file of ['icon.svg', 'manifest.webmanifest'])
            hash.update(
              readFileSync(new URL(`./public/${file}`, import.meta.url)),
            )
          const version = hash.digest('hex').slice(0, 16)
          this.emitFile({
            type: 'asset',
            fileName: 'sw.js',
            source: `
const PREFIX = 'kids-color-by-number-';
const CACHE = PREFIX + '${version}';
const BASE = '${base}';
const FILES = ${JSON.stringify(files.map((file) => base + file))};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(url => new Request(url, { cache: 'reload' })))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(BASE + 'index.html').then(response => response || Response.error())));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then(response => response || fetch(event.request)));
  }
});
`,
          })
        },
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          id.includes('/src/data/police-car-robot/')
            ? 'police-car-robot'
            : id.includes('/src/data/new-drawings/')
              ? id.split('/').pop()!.replace('.json', '')
              : undefined,
      },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
})
