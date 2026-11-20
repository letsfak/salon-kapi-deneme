// Salon Kapı — üyeye özel anahtar, 30 saniyede bir değişen imzalı QR ve 6 haneli yedek kod.
// Ana anahtar yalnız salonun laptopunda üretilir ve orada durur; koda yazılmaz.
// Üyenin anahtarı ana anahtardan (üye + sürüm) türetilir; sürüm artınca eski telefon geçersiz olur.

export const PENCERE_MS = 30_000;
export const TOLERANS = 1; // ±1 pencere: telefonla laptop arasındaki saat farkı için

// Biçim: SK1 + üye (U01) + T + pencere + S + 12 hex imza. Ayırıcı yok: USB okuyucu
// klavye gibi yazar ve ABD klavyesi varsayar; Türkçe Q klavyede ":" → "Ş" olur.
const QR_RE = /^SK1(U\d{2,6})T(\d{1,12})S([0-9a-f]{12})$/;
const enc = new TextEncoder();
const anahtarNesneleri = new Map();

function subtle() {
  const c = globalThis.crypto;
  if (!c || !c.subtle) throw new Error('Bu tarayıcı güvenli şifrelemeyi desteklemiyor. Sayfayı https ile açın.');
  return c.subtle;
}

export const b64u = {
  kodla(bayt) {
    let s = '';
    for (const b of bayt) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  coz(metin) {
    if (!/^[A-Za-z0-9_-]*$/.test(metin)) throw new Error('Geçersiz karakter');
    const p = metin.replace(/-/g, '+').replace(/_/g, '/');
    const s = atob(p + '==='.slice((p.length + 3) % 4));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  },
};

export function rastgeleAnahtar(bayt = 32) {
  const a = new Uint8Array(bayt);
  globalThis.crypto.getRandomValues(a);
  return a;
}

async function hmacNesnesi(ham) {
  const anahtar = b64u.kodla(ham);
  if (!anahtarNesneleri.has(anahtar)) {
    anahtarNesneleri.set(anahtar, subtle().importKey('raw', ham, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']));
  }
  return anahtarNesneleri.get(anahtar);
}

async function hmac(ham, metin) {
  return new Uint8Array(await subtle().sign('HMAC', await hmacNesnesi(ham), enc.encode(metin)));
}

/**
 * Salonun ana anahtarından üyenin telefon anahtarını türetir (32 bayt).
 * tuz: üyeye kayıtta verilen rastgele değer. Silinen üyenin numarası yeni üyeye verilse bile eski link çalışmaz.
 */
export const uyeAnahtariTuret = (anaHam, uyeId, surum, tuz = '') => hmac(anaHam, `uye:${uyeId}:${tuz}:${surum}`);

export const pencere = (ms) => Math.floor(ms / PENCERE_MS);
export const pencereKalanMs = (ms) => PENCERE_MS - (ms % PENCERE_MS);
const hex = (bayt) => Array.from(bayt, (b) => b.toString(16).padStart(2, '0')).join('');
const imza = async (ham, uyeId, w) => hex((await hmac(ham, `${uyeId}:${w}`)).subarray(0, 6));

function sabitZamanliEsit(a, b) {
  if (a.length !== b.length) return false;
  let fark = 0;
  for (let i = 0; i < a.length; i++) fark |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return fark === 0;
}

/** Üyenin telefonunda gösterilen QR metni. */
export async function qrMetni(uyeHam, uyeId, ms = Date.now()) {
  const w = pencere(ms);
  return `SK1${uyeId}T${w}S${await imza(uyeHam, uyeId, w)}`;
}

export function qrCoz(metin) {
  const m = QR_RE.exec(String(metin ?? '').trim());
  return m ? { uyeId: m[1], w: Number(m[2]), imza: m[3] } : null;
}

/**
 * Kapıda doğrulama. anahtarBul(uyeId) → üyenin güncel anahtarı ya da null.
 * Sıra önemli: önce imza (sahte ya da eski telefon mu), sonra süre (ekran görüntüsü mü).
 */
export async function qrDogrula(metin, anahtarBul, ms = Date.now()) {
  const c = qrCoz(metin);
  if (!c) return { gecerli: false, sebep: 'bicim' };
  const ham = await anahtarBul(c.uyeId);
  if (!ham) return { gecerli: false, sebep: 'bilinmeyen', uyeId: c.uyeId };
  if (!sabitZamanliEsit(await imza(ham, c.uyeId, c.w), c.imza)) return { gecerli: false, sebep: 'imza', uyeId: c.uyeId };
  if (Math.abs(pencere(ms) - c.w) > TOLERANS) return { gecerli: false, sebep: 'eski', uyeId: c.uyeId };
  return { gecerli: true, uyeId: c.uyeId };
}

async function kodUret(ham, w) {
  const b = await hmac(ham, `kod:${w}`);
  const o = b[b.length - 1] & 0x0f;
  const sayi = (((b[o] & 0x7f) << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) % 1_000_000;
  return String(sayi).padStart(6, '0');
}

/** Telefonun QR'ı okunmazsa resepsiyonda elle girilen 6 haneli kod. */
export const yedekKod = (uyeHam, ms = Date.now()) => kodUret(uyeHam, pencere(ms));

/** adaylar: [{ id, anahtar }] — elle girilen kodun sahibini bulur, yoksa null. */
export async function yedekKodBul(kod, adaylar, ms = Date.now()) {
  if (!/^\d{6}$/.test(String(kod))) return null;
  const w0 = pencere(ms);
  for (const { id, anahtar } of adaylar) {
    for (let d = -TOLERANS; d <= TOLERANS; d++) {
      if ((await kodUret(anahtar, w0 + d)) === kod) return id;
    }
  }
  return null;
}
