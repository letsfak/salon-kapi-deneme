// Çevrimdışı çalışma: laptop ve üyenin telefonu uygulamayı bir kere yükledikten sonra internetsiz de açar.
// Önce önbellekten verir, arkada günceller (yeni sürüm bir sonraki açılışta gelir). Sürüm değişince eski önbellek silinir.
const SURUM = 'salonkapi-v4';
const DOSYALAR = [
  './', 'index.html', 'uye.html', 'aydinlatma.html', 'marka/logo-daire.svg', 'marka/logo-isaret.svg', 'uye.webmanifest', 'ikon.svg', 'ikon-180.png', 'ikon-192.png', 'ikon-512.png',
  'css/fontlar.css', 'css/aydinlatma.css', 'css/tokens.css', 'css/temel.css', 'css/kapi.css', 'css/panel.css', 'css/uye.css', 'css/uygulama.css',
  'vendor/qrcode.js', 'vendor/jsQR.js',
  'fontlar/barlow-condensed-latin-500-normal.woff2', 'fontlar/barlow-condensed-latin-600-normal.woff2', 'fontlar/barlow-condensed-latin-700-normal.woff2', 'fontlar/barlow-condensed-latin-ext-500-normal.woff2', 'fontlar/barlow-condensed-latin-ext-600-normal.woff2', 'fontlar/barlow-condensed-latin-ext-700-normal.woff2', 'fontlar/barlow-latin-400-normal.woff2', 'fontlar/barlow-latin-500-normal.woff2', 'fontlar/barlow-latin-600-normal.woff2', 'fontlar/barlow-latin-ext-400-normal.woff2', 'fontlar/barlow-latin-ext-500-normal.woff2', 'fontlar/barlow-latin-ext-600-normal.woff2',
  'js/app.js', 'js/cevrimdisi.js', 'js/csv.js', 'js/csv-aktar.js', 'js/davet.js', 'js/depo.js', 'js/kapi.js', 'js/kapi-kamera.js',
  'js/kapi-role.js', 'js/kapi-seri.js', 'js/kilit.js', 'js/kod.js', 'js/kural.js', 'js/kurulum.js', 'js/marka.js', 'js/okuyucu.js',
  'js/panel.js', 'js/panel-ayar.js', 'js/panel-bugun.js', 'js/panel-hatirlat.js', 'js/panel-kasa.js', 'js/panel-uyeler.js',
  'js/pin.js', 'js/role.js', 'js/salon.js', 'js/seri-okuyucu.js', 'js/tarih.js', 'js/ui.js', 'js/uye-app.js',
  'js/uye-form.js', 'js/uye-kart.js', 'js/veri.js', 'js/whatsapp.js', 'js/yedek.js', 'js/yedek-dogrula.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SURUM).then((c) => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((adlar) => Promise.all(adlar.filter((a) => a.startsWith('salonkapi-') && a !== SURUM).map((a) => caches.delete(a))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const istek = e.request;
  if (istek.method !== 'GET') return;
  if (new URL(istek.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(SURUM).then(async (c) => {
    const onbellekte = await c.match(istek, { ignoreSearch: true });
    const ag = fetch(istek).then((yanit) => {
      if (yanit.ok) c.put(istek, yanit.clone());
      return yanit;
    }).catch(() => onbellekte);
    return onbellekte || ag;
  }));
});
