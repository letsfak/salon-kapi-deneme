// Üyelik işlemleri. Hepsi saf: girdiyi değiştirmez, yeni nesne döndürür.
import { bugunISO, gunEkle, gunFarki, ayAnahtari } from './tarih.js';
import { b64u, rastgeleAnahtar } from './kod.js';

const AD_UZUNLUK = 60;
const temizAd = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').slice(0, AD_UZUNLUK);
const temizTel = (s) => String(s ?? '').trim().slice(0, 20);

/** Ay ekler; hedef ayda o gün yoksa ayın son günü (31 Ocak + 1 ay = 28 Şubat). */
export function ayEkle(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const hedef = m - 1 + n;
  const yil = y + Math.floor(hedef / 12);
  const ay = ((hedef % 12) + 12) % 12;
  const sonGun = new Date(Date.UTC(yil, ay + 1, 0)).getUTCDate();
  return new Date(Date.UTC(yil, ay, Math.min(d, sonGun))).toISOString().slice(0, 10);
}

export function siradakiId(uyeler) {
  const enBuyuk = uyeler.reduce((m, u) => Math.max(m, Number(String(u.id).slice(1)) || 0), 0);
  return `U${String(enBuyuk + 1).padStart(2, '0')}`;
}

/** bitis verilirse (Excel'den aktarım) paket hesabı yapılmaz. */
export function yeniUye({ ad, tel, paketAy, baslangic, ucret, bitis }, uyeler, simdi = Date.now()) {
  const bas = baslangic || bugunISO(simdi);
  const ay = Number(paketAy) || null;
  return {
    id: siradakiId(uyeler),
    ad: temizAd(ad),
    tel: temizTel(tel),
    tuz: b64u.kodla(rastgeleAnahtar(9)),
    bitis: bitis || ayEkle(bas, ay || 1),
    donem: { baslangic: bas, paketAy: ay, ucret: Math.max(0, Number(ucret) || 0), devreden: 0 },
    surum: 1,
    donduruldu: null,
    dondurmalar: [],
    sonGelis: null,
    ayGelis: null,
    olusturma: simdi,
  };
}

export const bilgiGuncelle = (uye, { ad, tel }) => ({ ...uye, ad: temizAd(ad) || uye.ad, tel: temizTel(tel) });

/**
 * Yeni dönem: süre bitmemişse bitişten, bitmişse bugünden başlar.
 * devreden: önceki dönemden ödenmemiş borç (çağıran borc() ile hesaplar); yeni döneme eklenir, kaybolmaz.
 */
export function uzat(uye, { paketAy, ucret, devreden = 0 }, simdi = Date.now()) {
  const bugun = bugunISO(simdi);
  const baslangic = uye.bitis >= bugun ? uye.bitis : bugun;
  return {
    ...uye,
    bitis: ayEkle(baslangic, Number(paketAy) || 1),
    donem: { baslangic, paketAy: Number(paketAy) || 1, ucret: Math.max(0, Number(ucret) || 0), devreden: Math.max(0, Math.round(Number(devreden) || 0)) },
  };
}

export const dondur = (uye, simdi = Date.now()) => ({ ...uye, donduruldu: { baslangic: bugunISO(simdi) } });

/** Dondurma bitince donuk kalınan gün kadar bitiş uzar. */
export function dondurmayiBitir(uye, simdi = Date.now()) {
  if (!uye.donduruldu) return uye;
  const bugun = bugunISO(simdi);
  const gun = Math.max(0, gunFarki(uye.donduruldu.baslangic, bugun));
  return {
    ...uye,
    bitis: gunEkle(uye.bitis, gun),
    donduruldu: null,
    dondurmalar: [...(uye.dondurmalar || []), { baslangic: uye.donduruldu.baslangic, bitis: bugun, gun }],
  };
}

/** Telefon değişti ya da QR paylaşıldı: eski telefonun anahtarı geçersiz olur. */
export const telefonuYenile = (uye) => ({ ...uye, surum: (uye.surum || 1) + 1 });

export const odemeEkle = (uye, { tutar, yontem, not = '' }, simdi = Date.now()) => ({
  uyeId: uye.id,
  donem: uye.donem.baslangic,
  tutar: Math.max(0, Math.round(Number(tutar) || 0)),
  yontem: ['nakit', 'kart', 'iban'].includes(yontem) ? yontem : 'nakit',
  not: String(not).slice(0, 120),
  zaman: simdi,
});

/** Kalan borç: bu dönemin ücreti + önceki dönemden devreden − bu döneme yapılan ödemeler (fazla ödeme borç sayılmaz). */
export function borc(uye, odemeler) {
  const odenen = odemeler
    .filter((o) => o.uyeId === uye.id && o.donem === uye.donem.baslangic)
    .reduce((t, o) => t + o.tutar, 0);
  return Math.max(0, (uye.donem.ucret || 0) + (uye.donem.devreden || 0) - odenen);
}

/** Geçişte son geliş ve bu ayki geliş sayısı güncellenir. */
export function girisIsle(uye, simdi = Date.now()) {
  const ay = ayAnahtari(simdi);
  const sayi = uye.ayGelis?.ay === ay ? uye.ayGelis.sayi + 1 : 1;
  return { ...uye, sonGelis: simdi, ayGelis: { ay, sayi } };
}
