// Kalıcı depo: resepsiyondaki laptopun tarayıcısında IndexedDB. Sunucu yok.
// Sekmeler (kapı ↔ panel) değişikliği BroadcastChannel ile birbirine haber verir.

const DB_AD = 'salonkapi';
const DB_SURUM = 1;
const KANAL = 'salonkapi-depo';

let dbSozu = null;
let kanal = null;
try { kanal = new BroadcastChannel(KANAL); } catch { kanal = null; }

function istek(r) {
  return new Promise((coz, reddet) => { r.onsuccess = () => coz(r.result); r.onerror = () => reddet(r.error); });
}

function islemBitti(tx) {
  return new Promise((coz, reddet) => { tx.oncomplete = () => coz(); tx.onerror = () => reddet(tx.error); tx.onabort = () => reddet(tx.error); });
}

export function dbAc() {
  if (dbSozu) return dbSozu;
  dbSozu = new Promise((coz, reddet) => {
    const r = indexedDB.open(DB_AD, DB_SURUM);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore('ayar', { keyPath: 'ad' });
      db.createObjectStore('uyeler', { keyPath: 'id' });
      const h = db.createObjectStore('hareketler', { keyPath: 'no', autoIncrement: true });
      h.createIndex('zaman', 'zaman');
      h.createIndex('uyeId', 'uyeId');
      const o = db.createObjectStore('odemeler', { keyPath: 'no', autoIncrement: true });
      o.createIndex('zaman', 'zaman');
      o.createIndex('uyeId', 'uyeId');
    };
    r.onsuccess = () => coz(r.result);
    r.onerror = () => reddet(r.error);
    r.onblocked = () => reddet(new Error('Veritabanı başka bir sekmede eski sürümle açık. Diğer sekmeleri kapatın.'));
  });
  return dbSozu;
}

async function depo(ad, mod = 'readonly') {
  return (await dbAc()).transaction(ad, mod).objectStore(ad);
}

const haberVer = () => kanal?.postMessage('degisti');

export async function ayarOku(ad) {
  const kayit = await istek((await depo('ayar')).get(ad));
  return kayit ? kayit.deger : null;
}

export async function ayarYaz(ad, deger) {
  await istek((await depo('ayar', 'readwrite')).put({ ad, deger }));
  haberVer();
}

export const uyeleriGetir = async () => istek((await depo('uyeler')).getAll());

export async function uyeKaydet(uye) {
  await istek((await depo('uyeler', 'readwrite')).put(uye));
  haberVer();
}

/** KVKK silme hakkı: üye ve ona ait tüm ödeme ve kapı kayıtları silinir. */
export async function uyeSil(id) {
  const db = await dbAc();
  const tx = db.transaction(['uyeler', 'odemeler', 'hareketler'], 'readwrite');
  tx.objectStore('uyeler').delete(id);
  for (const ad of ['odemeler', 'hareketler']) {
    const depo = tx.objectStore(ad);
    const anahtarlar = await istek(depo.index('uyeId').getAllKeys(id));
    anahtarlar.forEach((no) => depo.delete(no));
  }
  await islemBitti(tx);
  haberVer();
}

export async function uyelerKaydet(uyeler) {
  const tx = (await dbAc()).transaction('uyeler', 'readwrite');
  uyeler.forEach((u) => tx.objectStore('uyeler').put(u));
  await islemBitti(tx);
  haberVer();
}

export const uyeGetir = async (id) => (await istek((await depo('uyeler')).get(id))) || null;

/**
 * Geçiş: hareket yazılır; donustur verilirse üye aynı işlemde veritabanından TAZE okunup güncellenir
 * (panelde az önce yapılan değişiklik ezilmez, panelde silinen üye geri gelmez). Güncel üyeyi döndürür.
 */
export async function gecisKaydet(hareket, donustur = null) {
  const tx = (await dbAc()).transaction(['hareketler', 'uyeler'], 'readwrite');
  tx.objectStore('hareketler').add(hareket);
  let guncel = null;
  if (donustur && hareket.uyeId) {
    const uyeDeposu = tx.objectStore('uyeler');
    const taze = await istek(uyeDeposu.get(hareket.uyeId));
    if (taze) { guncel = donustur(taze); uyeDeposu.put(guncel); }
  }
  await islemBitti(tx);
  haberVer();
  return guncel;
}

export async function hareketlerAralik(bas, son = Date.now() + 1) {
  return istek((await depo('hareketler')).index('zaman').getAll(IDBKeyRange.bound(bas, son)));
}

export async function uyeHareketleri(uyeId, enFazla = 20) {
  const hepsi = await istek((await depo('hareketler')).index('uyeId').getAll(uyeId));
  return hepsi.sort((a, b) => b.zaman - a.zaman).slice(0, enFazla);
}

/** Saklama süresi dolan kapı kayıtlarını siler (aydınlatma metnindeki 12 ay sözü). Silinen sayıyı döndürür. */
export async function eskiHareketleriSil(sinirZaman) {
  const tx = (await dbAc()).transaction('hareketler', 'readwrite');
  const indeks = tx.objectStore('hareketler').index('zaman');
  const anahtarlar = await istek(indeks.getAllKeys(IDBKeyRange.upperBound(sinirZaman, true)));
  anahtarlar.forEach((no) => tx.objectStore('hareketler').delete(no));
  await islemBitti(tx);
  if (anahtarlar.length) haberVer();
  return anahtarlar.length;
}

export async function odemeKaydet(odeme) {
  await istek((await depo('odemeler', 'readwrite')).add(odeme));
  haberVer();
}

export const odemeleriGetir = async () => istek((await depo('odemeler')).getAll());

export async function odemelerAralik(bas, son = Date.now() + 1) {
  return istek((await depo('odemeler')).index('zaman').getAll(IDBKeyRange.bound(bas, son)));
}

const DEPOLAR = ['ayar', 'uyeler', 'hareketler', 'odemeler'];

/** Yedek: ayar (ana anahtar dahil), üyeler, hareketler, ödemeler. Klasör izni gibi taşınamayan ayarlar hariç. */
export async function tumunuDisaAktar() {
  const db = await dbAc();
  const tx = db.transaction(DEPOLAR, 'readonly');
  const [ayar, uyeler, hareketler, odemeler] = await Promise.all(DEPOLAR.map((d) => istek(tx.objectStore(d).getAll())));
  return {
    tur: 'salonkapi-yedek',
    surum: 1,
    zaman: Date.now(),
    ayar: ayar.filter((a) => a.ad === 'salon'),
    uyeler,
    hareketler,
    odemeler,
  };
}

/** Yedekten geri yükleme: mevcut veri silinir, yedekteki yazılır (tek işlem; yarıda kalırsa hiçbir şey değişmez). */
export async function iceAktar(yedek) {
  const tx = (await dbAc()).transaction(DEPOLAR, 'readwrite');
  try {
    ['uyeler', 'hareketler', 'odemeler'].forEach((d) => tx.objectStore(d).clear());
    tx.objectStore('ayar').delete('salon');
    yedek.ayar.forEach((a) => tx.objectStore('ayar').put(a));
    yedek.uyeler.forEach((u) => tx.objectStore('uyeler').put(u));
    yedek.hareketler.forEach((h) => tx.objectStore('hareketler').put(h));
    yedek.odemeler.forEach((o) => tx.objectStore('odemeler').put(o));
  } catch (hata) {
    tx.abort(); // silme dahil hiçbir şey kalıcı olmaz
    throw hata;
  }
  await islemBitti(tx);
  haberVer();
}

/** Başka sekmede değişiklik olunca çağrılır; dinlemeyi bırakan fonksiyonu döndürür. */
export function degisiklikDinle(cb) {
  const f = () => cb();
  kanal?.addEventListener('message', f);
  return () => kanal?.removeEventListener('message', f);
}

/** Tarayıcıdan "bu veriyi temizlik sırasında silme" ister (Chrome çoğu zaman sessizce verir). */
export async function kaliciDepoIste() {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
