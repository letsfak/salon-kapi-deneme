// Yedekleme: elle indirme, seçilen klasöre günlük otomatik yedek, yedekten geri yükleme.
// Yedek dosyası salonun ana anahtarını içerir: başkasının eline geçmemeli (laptopta ya da USB bellekte durur).
import { tumunuDisaAktar, iceAktar, ayarOku, ayarYaz } from './depo.js';
import { bugunISO } from './tarih.js';
import { yedekTemizle } from './yedek-dogrula.js';

const EN_BUYUK_YEDEK = 30 * 1024 * 1024;
const SAKLANAN_YEDEK = 30;
const dosyaAdi = (ms = Date.now()) => `salonkapi-yedek-${bugunISO(ms)}.json`;
// Laptopun dışına (USB belleğe) yedek: laptop çalınır ya da bozulursa üyeler buradan geri gelir. Sıklık: kural.js.
const USB_ANAHTARI = 'salonkapi.usbYedek';

export async function yedekIndir() {
  const veri = await tumunuDisaAktar();
  const url = URL.createObjectURL(new Blob([JSON.stringify(veri)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: dosyaAdi() });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Son USB yedeğinin zamanı (ms) ya da null. Laptopa özgüdür, yedek dosyasına girmez. */
export function usbYedekSon() {
  try {
    const v = Number(localStorage.getItem(USB_ANAHTARI));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch { return null; }
}

/**
 * Bir tıklamanın içinden çağrılmalı. Kayıt penceresi açılır, USB bellek seçilir.
 * Tarayıcı kayıt penceresini desteklemiyorsa dosya İndirilenler'e iner ('indirildi'), oradan kopyalanır.
 * @returns {Promise<'yazildi'|'indirildi'|'vazgecildi'>}
 */
export async function usbYedekAl() {
  const kaydet = () => { try { localStorage.setItem(USB_ANAHTARI, String(Date.now())); } catch { /* gizli pencere */ } };
  if (typeof window.showSaveFilePicker !== 'function') {
    await yedekIndir();
    kaydet(); // kopyalama kullanıcıda; hatırlatma bir hafta susar
    return 'indirildi';
  }
  let dosya;
  try {
    dosya = await window.showSaveFilePicker({
      id: 'salonkapi-usb', suggestedName: dosyaAdi(), startIn: 'desktop',
      types: [{ description: 'Salon yedeği', accept: { 'application/json': ['.json'] } }],
    });
  } catch (hata) {
    if (hata.name === 'AbortError') return 'vazgecildi';
    throw hata;
  }
  const yazici = await dosya.createWritable();
  await yazici.write(JSON.stringify(await tumunuDisaAktar()));
  await yazici.close();
  kaydet();
  return 'yazildi';
}

export const klasorDestekli = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function yedekKlasoruSec() {
  const klasor = await window.showDirectoryPicker({ id: 'salonkapi-yedek', mode: 'readwrite' });
  await ayarYaz('yedekKlasoru', klasor);
  await ayarYaz('sonYedek', null);
  return klasor.name;
}

/** 'yok' | 'izin-gerek' | 'hazir' */
export async function yedekDurumu() {
  const klasor = await ayarOku('yedekKlasoru');
  if (!klasor) return { durum: 'yok' };
  const izin = await klasor.queryPermission({ mode: 'readwrite' });
  return { durum: izin === 'granted' ? 'hazir' : 'izin-gerek', klasor: klasor.name, son: await ayarOku('sonYedek') };
}

/** Bir tıklamanın içinden çağrılmalı (tarayıcı izni yalnız kullanıcı hareketiyle sorar). */
export async function yedekIzniVer() {
  const klasor = await ayarOku('yedekKlasoru');
  return klasor ? (await klasor.requestPermission({ mode: 'readwrite' })) === 'granted' : false;
}

async function eskileriSil(klasor) {
  const adlar = [];
  for await (const [ad] of klasor.entries()) {
    if (/^salonkapi-yedek-\d{4}-\d{2}-\d{2}\.json$/.test(ad)) adlar.push(ad);
  }
  adlar.sort().reverse().slice(SAKLANAN_YEDEK).forEach((ad) => klasor.removeEntry(ad).catch(() => {}));
}

/** Bugün yedek alınmadıysa klasöre yazar. Dönüş: yazılan dosya adı ya da null. */
export async function gunlukYedekAl({ zorla = false } = {}) {
  const { durum, son } = await yedekDurumu();
  if (durum !== 'hazir') return null;
  if (!zorla && son === bugunISO()) return null;
  const klasor = await ayarOku('yedekKlasoru');
  const ad = dosyaAdi();
  const dosya = await klasor.getFileHandle(ad, { create: true });
  const yazici = await dosya.createWritable();
  await yazici.write(JSON.stringify(await tumunuDisaAktar()));
  await yazici.close();
  await ayarYaz('sonYedek', bugunISO());
  await eskileriSil(klasor);
  return ad;
}

/** Dosya önce baştan sona doğrulanıp temizlenir; ancak ondan sonra mevcut veri değiştirilir. */
export async function yedektenYukle(dosya) {
  if (!dosya || dosya.size > EN_BUYUK_YEDEK) throw new Error('Dosya çok büyük ya da seçilmedi.');
  let veri;
  try { veri = JSON.parse(await dosya.text()); } catch { throw new Error('Dosya okunamadı (JSON değil).'); }
  const temiz = yedekTemizle(veri);
  await iceAktar(temiz);
  return { uye: temiz.uyeler.length, hareket: temiz.hareketler.length, atlanan: temiz.atlanan.hareket + temiz.atlanan.odeme };
}
