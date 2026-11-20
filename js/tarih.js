// Tarih yardımcıları. Günler YYYY-AA-GG metni olarak tutulur; "bugün" yerel saate göredir.

const GUN_MS = 86_400_000;
const TARIH_RE = /^\d{4}-\d{2}-\d{2}$/;
const iki = (n) => String(n).padStart(2, '0');

export function bugunISO(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
}

/** Yerel saate göre "2026-11" biçiminde ay anahtarı. */
export function ayAnahtari(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${iki(d.getMonth() + 1)}`;
}

const utc = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export const gunEkle = (iso, n) => new Date(utc(iso) + n * GUN_MS).toISOString().slice(0, 10);
export const gunFarki = (aIso, bIso) => Math.round((utc(bIso) - utc(aIso)) / GUN_MS);

/** 2026-13-45 gibi biçimi tutan ama takvimde olmayan günleri de eler. */
export function gercekTarih(s) {
  if (typeof s !== 'string' || !TARIH_RE.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export { GUN_MS };
