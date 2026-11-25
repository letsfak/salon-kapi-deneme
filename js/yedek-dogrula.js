// Yedek dosyasını doğrular ve temizler. Dosyadaki nesneler olduğu gibi depoya yazılmaz: her kayıt
// izin verilen alanlarla sıfırdan kurulur (fazla alan, yanlış tür, aşırı uzun metin içeri girmez).
import { gercekTarih } from './tarih.js';
import { b64u } from './kod.js';
import { takmaAdTemizle, takimAdTemizle, takimAnahtari } from './lig.js';

const nesne = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const metin = (x, n) => (typeof x === 'string' ? x.slice(0, n) : '');
const tamsayi = (x, min, max) => Number.isInteger(x) && x >= min && x <= max;
const zamanMi = (x) => Number.isFinite(x) && x > 0 && x < 4_102_444_800_000;
const ID_RE = /^U\d{2,6}$/;
const SEBEPLER = new Set(['ok', 'cikis', 'bicim', 'imza', 'eski', 'bilinmeyen', 'donduruldu', 'iceride', 'borc', 'bitti', 'kod', 'kodKilidi']);
const KAYNAKLAR = new Set(['kamera', 'okuyucu', 'yedek-kod', 'panel']);
const YONTEMLER = new Set(['nakit', 'kart', 'iban']);
const HATIRLATMA = ['bitiyor', 'gelmeyen', 'borc'];

function salonTemizle(s) {
  if (!nesne(s)) throw new Error('Yedekte salon bilgisi yok.');
  let ana = null;
  try { ana = b64u.coz(String(s.anaAnahtar)); } catch { ana = null; }
  if (!ana || ana.length !== 32) throw new Error('Yedekteki salon anahtarı bozuk.');
  if (!nesne(s.pin) || typeof s.pin.tuz !== 'string' || typeof s.pin.ozet !== 'string') throw new Error('Yedekteki PIN bilgisi bozuk.');
  const ad = metin(s.ad, 40).trim();
  if (!ad) throw new Error('Yedekte salon adı yok.');
  const paketler = (Array.isArray(s.paketler) ? s.paketler : [])
    .filter((p) => nesne(p) && tamsayi(p.ay, 1, 24))
    .map((p) => ({ ay: p.ay, ucret: tamsayi(p.ucret, 0, 10_000_000) ? p.ucret : 0 }));
  return {
    ad,
    anaAnahtar: b64u.kodla(ana),
    pin: { tuz: s.pin.tuz.slice(0, 64), ozet: s.pin.ozet.slice(0, 64) },
    paketler: paketler.length ? paketler : [1, 3, 6, 12].map((ay) => ({ ay, ucret: 0 })),
    borcluyuEngelle: s.borcluyuEngelle === true,
    kurulus: zamanMi(s.kurulus) ? s.kurulus : Date.now(),
  };
}

const TUZ_RE = /^[A-Za-z0-9_-]{8,24}$/;
const para = (x) => (tamsayi(x, 0, 10_000_000) ? x : 0);

/**
 * Takım ligi (açık rızayla): bozuksa yalnız lig atılır, üye kalır.
 * Rıza zamanı üyenin kaydından önce ya da yedekten sonra olamaz: düzenlenmiş dosya eski günleri lige saydıramaz.
 */
function ligTemizle(l, olusturma, yedekZamani) {
  if (!nesne(l) || !zamanMi(l.onay)) return null;
  if ((zamanMi(olusturma) && l.onay < olusturma) || l.onay > yedekZamani) return null;
  const bas = zamanMi(l.bas) && l.bas >= l.onay && l.bas <= yedekZamani ? l.bas : l.onay;
  const ad = takmaAdTemizle(l.ad);
  const takim = takimAdTemizle(l.takim);
  return ad && takimAnahtari(takim) ? { onay: l.onay, bas, ad, takim } : null;
}

function uyeTemizle(u, yedekZamani) {
  if (!nesne(u) || !ID_RE.test(u.id) || !metin(u.ad, 60).trim() || !gercekTarih(u.bitis) || !tamsayi(u.surum, 1, 1_000_000) || !TUZ_RE.test(u.tuz)) return null;
  const donem = nesne(u.donem) && gercekTarih(u.donem.baslangic)
    ? { baslangic: u.donem.baslangic, paketAy: tamsayi(u.donem.paketAy, 1, 24) ? u.donem.paketAy : null, ucret: para(u.donem.ucret), devreden: para(u.donem.devreden) }
    : { baslangic: u.bitis, paketAy: null, ucret: 0, devreden: 0 };
  const hat = nesne(u.hatirlatmalar) ? u.hatirlatmalar : {};
  return {
    id: u.id,
    ad: metin(u.ad, 60).trim(),
    tel: metin(u.tel, 20),
    tuz: u.tuz,
    bitis: u.bitis,
    donem,
    surum: u.surum,
    donduruldu: nesne(u.donduruldu) && gercekTarih(u.donduruldu.baslangic) ? { baslangic: u.donduruldu.baslangic } : null,
    dondurmalar: (Array.isArray(u.dondurmalar) ? u.dondurmalar : [])
      .filter((d) => nesne(d) && gercekTarih(d.baslangic) && gercekTarih(d.bitis) && tamsayi(d.gun, 0, 3650))
      .map((d) => ({ baslangic: d.baslangic, bitis: d.bitis, gun: d.gun })),
    sonGelis: zamanMi(u.sonGelis) ? u.sonGelis : null,
    ayGelis: nesne(u.ayGelis) && /^\d{4}-\d{2}$/.test(u.ayGelis.ay) && tamsayi(u.ayGelis.sayi, 1, 10_000) ? { ay: u.ayGelis.ay, sayi: u.ayGelis.sayi } : null,
    olusturma: zamanMi(u.olusturma) ? u.olusturma : null,
    eksik: u.eksik === true,
    hatirlatmalar: Object.fromEntries(HATIRLATMA.filter((t) => zamanMi(hat[t])).map((t) => [t, hat[t]])),
    aydinlatma: zamanMi(u.aydinlatma) ? u.aydinlatma : null,
    lig: ligTemizle(u.lig, u.olusturma, yedekZamani),
  };
}

function hareketTemizle(h) {
  if (!nesne(h) || !zamanMi(h.zaman) || !['giris', 'cikis'].includes(h.tip) || !['gecti', 'red'].includes(h.sonuc)) return null;
  return {
    ...(tamsayi(h.no, 1, 1e12) ? { no: h.no } : {}),
    uyeId: ID_RE.test(h.uyeId) ? h.uyeId : null,
    tip: h.tip,
    sonuc: h.sonuc,
    sebep: SEBEPLER.has(h.sebep) ? h.sebep : 'bicim',
    zaman: h.zaman,
    kaynak: KAYNAKLAR.has(h.kaynak) ? h.kaynak : 'okuyucu',
    uzunAra: tamsayi(h.uzunAra, 0, 100_000) ? h.uzunAra : null,
  };
}

function odemeTemizle(o) {
  if (!nesne(o) || !ID_RE.test(o.uyeId) || !gercekTarih(o.donem) || !tamsayi(o.tutar, 0, 10_000_000) || !zamanMi(o.zaman)) return null;
  return {
    ...(tamsayi(o.no, 1, 1e12) ? { no: o.no } : {}),
    uyeId: o.uyeId,
    donem: o.donem,
    tutar: o.tutar,
    yontem: YONTEMLER.has(o.yontem) ? o.yontem : 'nakit',
    not: metin(o.not, 120),
    zaman: o.zaman,
  };
}

/** Geçersiz yedekte açıklayıcı hata fırlatır; geçerliyse temizlenmiş kopyayı ve atlanan kayıt sayısını döndürür. */
export function yedekTemizle(veri) {
  if (!nesne(veri) || veri.tur !== 'salonkapi-yedek' || veri.surum !== 1) throw new Error('Bu dosya Salon Kapı yedeği değil.');
  if (![veri.ayar, veri.uyeler, veri.hareketler, veri.odemeler].every(Array.isArray)) throw new Error('Yedek dosyası eksik.');
  const salon = salonTemizle(veri.ayar.find((a) => nesne(a) && a.ad === 'salon')?.deger);
  const zaman = zamanMi(veri.zaman) ? veri.zaman : Date.now();
  const uyeler = veri.uyeler.map((u) => uyeTemizle(u, zaman));
  if (uyeler.some((u) => !u)) throw new Error('Yedekteki üye kayıtlarından biri bozuk.');
  if (new Set(uyeler.map((u) => u.id)).size !== uyeler.length) throw new Error('Yedekte aynı numaralı iki üye var.');
  const hareketler = veri.hareketler.map(hareketTemizle).filter(Boolean);
  const odemeler = veri.odemeler.map(odemeTemizle).filter(Boolean);
  return {
    tur: 'salonkapi-yedek',
    surum: 1,
    zaman,
    ayar: [{ ad: 'salon', deger: salon }],
    uyeler,
    hareketler,
    odemeler,
    atlanan: { hareket: veri.hareketler.length - hareketler.length, odeme: veri.odemeler.length - odemeler.length },
  };
}
