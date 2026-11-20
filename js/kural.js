// Kapı ve liste kuralları. Saf fonksiyonlar, yan etki yok.
import { bugunISO, gunFarki, ayAnahtari, GUN_MS } from './tarih.js';

export const BITIYOR_GUN = 7;
export const UZUN_ARA_GUN = 10;
export const GECMIS_BITEN_GUN = 30;
export const GIRIS_KILIDI_MS = 2 * 60 * 60 * 1000; // çıkış okutulmazsa 2 saat sonra çıkmış sayılır
// Aydınlatma metnindeki saklama sözleri: kapı kayıtları 12 ay, üyelik bilgileri üyelik bitince 2 yıl.
export const KAPI_KAYIT_SAKLAMA_GUN = 365;
export const UYE_SAKLAMA_GUN = 730;

/** Üyeliği bitmiş ve bitişinden bu yana 2 yıldan uzun geçmiş (dondurulmamış) üyeler: silinmeleri gerekir. */
export function silinecekUyeler(uyeler, simdi = Date.now()) {
  const bugun = bugunISO(simdi);
  return uyeler.filter((u) => !u.donduruldu && gunFarki(u.bitis, bugun) > UYE_SAKLAMA_GUN);
}

export function uyeDurumu(uye, simdi = Date.now()) {
  const kalanGun = gunFarki(bugunISO(simdi), uye.bitis);
  if (uye.donduruldu) return { durum: 'donduruldu', kalanGun };
  if (kalanGun < 0) return { durum: 'bitti', kalanGun };
  if (kalanGun <= BITIYOR_GUN) return { durum: 'bitiyor', kalanGun };
  return { durum: 'aktif', kalanGun };
}

export const aktifMi = (uye, simdi) => ['aktif', 'bitiyor'].includes(uyeDurumu(uye, simdi).durum);

export const gelmedigiGun = (uye, simdi = Date.now()) =>
  (uye.sonGelis ? Math.floor((simdi - uye.sonGelis) / GUN_MS) : null);

/** Süresi yakında bitecek ya da son 30 günde bitmiş, dondurulmamış üyeler; en acil önce. */
export function bitiyorlar(uyeler, simdi = Date.now(), gun = BITIYOR_GUN) {
  return uyeler
    .filter((u) => !u.donduruldu)
    .map((u) => ({ u, k: uyeDurumu(u, simdi).kalanGun }))
    .filter(({ k }) => k <= gun && k >= -GECMIS_BITEN_GUN)
    .sort((a, b) => a.k - b.k)
    .map(({ u }) => u);
}

/** Üyeliği süren ama `gun` gündür gelmeyen üyeler; hiç gelmeyen ve en uzun süredir gelmeyen önce. */
export function gelmeyenler(uyeler, simdi = Date.now(), gun = UZUN_ARA_GUN) {
  return uyeler
    .filter((u) => aktifMi(u, simdi))
    .map((u) => ({ u, ref: u.sonGelis ?? u.olusturma ?? 0 }))
    .filter(({ ref }) => simdi - ref >= gun * GUN_MS)
    .sort((a, b) => a.ref - b.ref)
    .map(({ u }) => u);
}

/** uyeId → giriş zamanı: son geçişi giriş olan ve kilidi dolmamış üyeler. */
export function iceridekiler(hareketler, simdi = Date.now()) {
  const son = new Map();
  for (const h of hareketler) {
    if (h.sonuc !== 'gecti') continue;
    const once = son.get(h.uyeId);
    if (!once || h.zaman >= once.zaman) son.set(h.uyeId, h);
  }
  const sonuc = new Map();
  for (const [id, h] of son) {
    if (h.tip === 'giris' && simdi - h.zaman < GIRIS_KILIDI_MS) sonuc.set(id, h.zaman);
  }
  return sonuc;
}

const ilkAd = (ad) => String(ad || '').split(' ')[0];

const RED = {
  bicim: ['Bu kod tanınmadı', 'Salon uygulamasındaki QR\'ı okutun.'],
  kod: ['Yedek kod yanlış', 'Kod 30 saniyede bir değişir. Uygulamadaki güncel kodu girin.'],
  kodKilidi: ['Çok fazla yanlış kod', 'Yedek kod girişi 1 dakika kapalı. Resepsiyona uğrayın.'],
  imza: ['Bu QR geçersiz', 'Telefon değiştiyse resepsiyondan yeni link isteyin.'],
  eski: ['Bu QR\'ın süresi geçmiş', 'Ekran görüntüsü çalışmaz. Uygulamadaki canlı QR\'ı okutun.'],
  bilinmeyen: ['Üye bulunamadı', 'Resepsiyona uğrayın.'],
  donduruldu: ['Üyelik donduruldu', 'Açtırmak için resepsiyona uğrayın.'],
  iceride: ['Bu üye zaten içeride', 'Aynı QR çıkış yapılmadan ikinci kez kullanılamaz. Paylaşılmış olabilir.'],
  borc: ['Resepsiyona uğrayın', 'Üyeliğinizle ilgili bir konu var.'],
};

const red = (sebep, uye, baslik = RED[sebep][0], alt = RED[sebep][1]) =>
  ({ gecti: false, sebep, baslik, alt, not: null, uzunAra: null, uyeId: uye?.id ?? null });

function kalanMetni(durum, kalanGun) {
  if (kalanGun === 0) return 'üyeliğin bugün bitiyor';
  if (durum === 'bitiyor') return `üyeliğin ${kalanGun} gün sonra bitiyor`;
  return `${kalanGun} gün kaldı`;
}

/**
 * Kapı kararı. Borç tutarı ekrana yazılmaz (sıradakiler görür); yalnız "resepsiyona uğra" denir.
 * @param {{ uye: object|null, dogrulama: object, mod: 'giris'|'cikis', icerideMi: boolean, simdi: number,
 *           borcVar: boolean, borcluyuEngelle: boolean }} g
 */
export function kapiKarari({ uye, dogrulama, mod, icerideMi, simdi, borcVar, borcluyuEngelle }) {
  if (!dogrulama.gecerli) return red(dogrulama.sebep in RED ? dogrulama.sebep : 'bicim', uye);
  if (!uye) return red('bilinmeyen', null);
  if (mod === 'cikis') {
    return { gecti: true, sebep: 'cikis', baslik: `Güle güle, ${ilkAd(uye.ad)}`, alt: 'Çıkışın kaydedildi.', not: null, uzunAra: null, uyeId: uye.id };
  }

  const { durum, kalanGun } = uyeDurumu(uye, simdi);
  if (durum === 'donduruldu') return red('donduruldu', uye);
  if (durum === 'bitti') return red('bitti', uye, `Üyelik ${-kalanGun} gün önce bitti`, 'Yenilemek için resepsiyona uğrayın.');
  if (icerideMi) return red('iceride', uye);
  if (borcVar && borcluyuEngelle) return red('borc', uye);

  const buAy = (uye.ayGelis?.ay === ayAnahtari(simdi) ? uye.ayGelis.sayi : 0) + 1;
  const ara = gelmedigiGun(uye, simdi);
  const uzunAra = ara !== null && ara >= UZUN_ARA_GUN ? ara : null;
  return {
    gecti: true,
    sebep: 'ok',
    baslik: uzunAra ? `${uzunAra} gün sonra hoş geldin, ${ilkAd(uye.ad)}` : `Hoş geldin, ${ilkAd(uye.ad)}`,
    alt: `Bu ay ${buAy}. gelişin · ${kalanMetni(durum, kalanGun)}`,
    not: borcVar ? 'Resepsiyona uğra' : null,
    uzunAra,
    uyeId: uye.id,
  };
}
