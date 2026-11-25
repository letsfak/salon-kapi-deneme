// Takım ligi kuralları. Saf fonksiyonlar: DOM ve veritabanı yok, girdiyi değiştirmez.
// Kanıt kapı kaydının kendisidir: puan yalnız başarılı giriş kayıtlarından hesaplanır.
import { bugunISO } from './tarih.js';

export const PUAN_GUN = 100;
export const TAKIM_EN_AZ = 2;
export const TAKIM_EN_FAZLA = 5;
export const TAKMA_AD_UZUNLUK = 20;
export const TAKIM_AD_UZUNLUK = 24;
// Seviye N için gereken en az geliş günü: Seviye 1 = 0 gün, Seviye 2 = 5 gün, … Seviye 7 = 100 gün.
export const SEVIYE_ESIKLERI = [0, 5, 12, 25, 45, 70, 100];

// Kontrol, biçim (yön değiştirme dahil), özel kullanım, atanmamış ve yarım vekil karakterler ile "harf" sayıldığı
// hâlde boş görünen dolgu karakterleri. Bunlar aynı görünen ikinci bir takım adı kurmak için kullanılabilir.
const GORUNMEZ = /[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Cs}ᅟᅠ⠀ㅤﾠ]/gu;
const HAM_EN_FAZLA = 200; // temizlemeden önce: aşırı uzun girdi boşuna işlenmesin

/** Kırpar, boşlukları teke indirir, görünmez karakterleri atar, üst üste binen işaretleri ikiyle sınırlar. */
function metinTemizle(s, enFazla) {
  if (typeof s !== 'string') return '';
  const tek = s.slice(0, HAM_EN_FAZLA).normalize('NFC').replace(/\s/g, ' ').replace(GORUNMEZ, '')
    .replace(/(\p{M}{2})\p{M}+/gu, '$1').replace(/ +/g, ' ').trim();
  return Array.from(tek).slice(0, enFazla).join('').trim();
}

export const takmaAdTemizle = (s) => metinTemizle(s, TAKMA_AD_UZUNLUK);
export const takimAdTemizle = (s) => metinTemizle(s, TAKIM_AD_UZUNLUK);

/** Karşılaştırma anahtarı: "KARTALLAR", "kartallar" ve "Kartallar" aynı; "Şimşek" ile "simsek" de aynı. */
export const takimAnahtari = (ad) => takimAdTemizle(ad).toLocaleLowerCase('tr-TR').replace(/ı/g, 'i')
  .normalize('NFD').replace(/\p{M}/gu, '');

/** Lige katılmış mı: lig.onay (açık rıza zamanı) ve takım olmalı. */
export const ligdeMi = (uye) => Boolean(uye?.lig) && Number.isFinite(uye.lig.onay) && uye.lig.onay > 0
  && Boolean(takimAnahtari(uye.lig.takim));

/** Yerel saatle pazartesi 00:00 ile sonraki pazartesi 00:00 arası (son hariç). kayma: -1 = geçen hafta. */
export function haftaAraligi(zaman, kayma = 0) {
  const d = new Date(zaman);
  const bas = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7) + kayma * 7);
  const son = new Date(bas.getFullYear(), bas.getMonth(), bas.getDate() + 7);
  return { bas: bas.getTime(), son: son.getTime() };
}

const gecerliGiris = (h) => h?.tip === 'giris' && h.sonuc === 'gecti' && Boolean(h.uyeId);

/** Üyenin şimdiki takımına girdiği an. lig.bas yoksa (ilk takımı) rıza zamanıdır. */
const takimaGiris = (uye) => (Number.isFinite(uye.lig.bas) ? uye.lig.bas : uye.lig.onay);

/**
 * Lig sayımının başladığı an: üyenin şimdiki takımına girdiği günün başı (yerel).
 * Rızadan önceki günler sayılmaz; takım değiştiren üyenin eski günleri yeni takıma taşınmaz.
 */
export function ligBaslangici(uye) {
  const d = new Date(takimaGiris(uye));
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * uyeId → başarılı giriş yapılan yerel günler. Aynı gün kaç kez girilirse girilsin tek gün.
 * baslangiclar (uyeId → zaman) verilirse yalnız oradaki üyelerin o andan sonraki girişleri sayılır.
 */
function gunHaritasi(hareketler, bas = -Infinity, son = Infinity, baslangiclar = null) {
  const harita = new Map(); // yerel biriktirici: girdi değişmez
  for (const h of hareketler) {
    if (!gecerliGiris(h) || !(h.zaman >= bas && h.zaman < son)) continue;
    if (baslangiclar && !(h.zaman >= baslangiclar.get(h.uyeId))) continue;
    if (!harita.has(h.uyeId)) harita.set(h.uyeId, new Set());
    harita.get(h.uyeId).add(bugunISO(h.zaman));
  }
  return harita;
}

/** Verilen kayıtlar içinde üyenin başarılı giriş günü sayısı. */
export const toplamGun = (hareketler, uyeId) => gunHaritasi(hareketler).get(uyeId)?.size ?? 0;

/** Üyenin bu hafta kaçıncı gelişi (o hafta giriş yaptığı gün sayısı). */
export function haftaGelisi(hareketler, uyeId, zaman) {
  const { bas, son } = haftaAraligi(zaman);
  return gunHaritasi(hareketler, bas, son).get(uyeId)?.size ?? 0;
}

export const seviye = (gun) => Math.max(1, SEVIYE_ESIKLERI.filter((esik) => gun >= esik).length);

/** Lig üyelerini takımlara ayırır. Takımın görünen adı ilk katılan üyenin yazdığı addır. */
export function takimlar(uyeler) {
  const gruplar = new Map();
  for (const u of uyeler.filter(ligdeMi)) {
    const anahtar = takimAnahtari(u.lig.takim);
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar).push(u);
  }
  return [...gruplar].map(([anahtar, liste]) => {
    const kurucu = liste.reduce((a, b) => (b.lig.onay < a.lig.onay ? b : a));
    return { anahtar, ad: takimAdTemizle(kurucu.lig.takim), uyeler: liste };
  }).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
}

// Ortalama kesirli olabilir: çapraz çarpımla tam sayı karşılaştırılır. Eşitlikte toplam gün, o da eşitse ad.
const siraKarsilastir = (a, b) => (b.toplamGun * a.uyeler.length - a.toplamGun * b.uyeler.length)
  || (b.toplamGun - a.toplamGun) || a.ad.localeCompare(b.ad, 'tr');

/**
 * Haftanın takım tablosu. siralama: 2+ lig üyeli takımlar, sira 1'den. eksikler: tek kişilik takımlar, sira null.
 * Takım puanı = üyelerin puan toplamı / lig üyesi sayısı (o hafta hiç gelmeyen de paydaya girer).
 * Kadro: hafta bitmeden şimdiki takımına girmiş üyeler (geçmiş haftaya sonradan katılan ya da geçen girmez).
 * Üyenin takımına girdiği günden önceki girişleri sayılmaz.
 */
export function haftaTablosu(uyeler, hareketler, zaman) {
  const { bas, son } = haftaAraligi(zaman);
  const kadro = uyeler.filter((u) => ligdeMi(u) && takimaGiris(u) < son);
  const gunler = gunHaritasi(hareketler, bas, son, new Map(kadro.map((u) => [u.id, ligBaslangici(u)])));
  const hepsi = takimlar(kadro).map(({ anahtar, ad, uyeler: liste }) => {
    const satirlar = liste.map((u) => ({ id: u.id, takmaAd: takmaAdTemizle(u.lig.ad), gun: gunler.get(u.id)?.size ?? 0 }))
      .sort((a, b) => (b.gun - a.gun) || a.takmaAd.localeCompare(b.takmaAd, 'tr'));
    const gun = satirlar.reduce((t, s) => t + s.gun, 0);
    return { anahtar, ad, uyeler: satirlar, toplamGun: gun, ortalama: (gun * PUAN_GUN) / satirlar.length, eksik: satirlar.length < TAKIM_EN_AZ };
  });
  return {
    bas,
    son,
    siralama: hepsi.filter((t) => !t.eksik).sort(siraKarsilastir).map((t, i) => ({ ...t, sira: i + 1 })),
    eksikler: hepsi.filter((t) => t.eksik).map((t) => ({ ...t, sira: null })),
  };
}

/**
 * Kapıdaki tek satır: "Bu hafta 3. gelişin · Kartallar 2. sırada · Seviye 4". Ligde değilse null.
 * haftaHareket: bu haftanın kayıtları; uyeHareket: üyenin tüm kayıtları. İkisi de o anki geçişi içermeli.
 * Seviye, lige katılınan günden beri gelinen gün sayısından hesaplanır.
 */
export function kapiLigSatiri({ uye, uyeler, haftaHareket, uyeHareket, simdi }) {
  if (!ligdeMi(uye)) return null;
  const tablo = haftaTablosu([...uyeler.filter((u) => u.id !== uye.id), uye], haftaHareket, simdi);
  const takim = [...tablo.siralama, ...tablo.eksikler].find((t) => t.uyeler.some((u) => u.id === uye.id));
  const gun = takim.uyeler.find((u) => u.id === uye.id).gun;
  const sira = takim.eksik ? 'takımın tamamlanmadı' : `${takim.ad} ${takim.sira}. sırada`;
  const ligGunu = toplamGun(uyeHareket.filter((h) => h.zaman >= ligBaslangici(uye)), uye.id);
  return `Bu hafta ${gun}. gelişin · ${sira} · Seviye ${seviye(ligGunu)}`;
}

const gunAy = (ms) => new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

/** Pazartesi mesajı (düz metin). Bilerek yalnız takım adı, sıra ve puan: üyenin adı ve takma adı yazılmaz. */
export function ligMesaji(tablo, salonAd) {
  const satirlar = tablo.siralama.map((t) => `${t.sira}. ${t.ad} · ${Math.round(t.ortalama)} puan`);
  return [
    `${salonAd} · Takım ligi · ${gunAy(tablo.bas)} - ${gunAy(tablo.son - 1)}`,
    '',
    ...(satirlar.length ? satirlar : ['Bu hafta sıralamaya giren takım yok.']),
    '',
    `Puan: salona gelinen her gün ${PUAN_GUN}, takımda üye başına ortalama.`,
  ].join('\n');
}

/**
 * Üye formundaki lig seçimini doğrular. Dönüş: { lig } (lig: null = ligden çık) ya da { hata }.
 * Zaten onaylıysa ilk onay zamanı korunur. Aynı adlı takım varsa onun yazımı kullanılır.
 * Takım değişirse lig.bas o an olur: eski günler yeni takıma taşınmaz, seviye de baştan başlar.
 */
export function ligSecimi({ katil, ad, takim }, uye, uyeler, simdi = Date.now()) {
  if (!katil) return { lig: null };
  const takmaAd = takmaAdTemizle(ad);
  const takimAdi = takimAdTemizle(takim);
  if (!takmaAd) return { hata: `Takma ad yazın (en çok ${TAKMA_AD_UZUNLUK} karakter).` };
  const anahtar = takimAnahtari(takimAdi);
  if (!anahtar) return { hata: `Takım adı yazın (en çok ${TAKIM_AD_UZUNLUK} karakter).` };
  const mevcut = takimlar(uyeler.filter((u) => u.id !== uye.id)).find((t) => t.anahtar === anahtar);
  // Zaten bu takımdaki üye (yedekten 5'i aşmış takım dahil) kendi kaydını düzenleyebilmeli.
  const zatenIcinde = ligdeMi(uye) && takimAnahtari(uye.lig.takim) === anahtar;
  if (mevcut && !zatenIcinde && mevcut.uyeler.length >= TAKIM_EN_FAZLA) {
    return { hata: `${mevcut.ad} takımı dolu (${TAKIM_EN_FAZLA} kişi). Başka bir takım seçin ya da yeni takım adı yazın.` };
  }
  const onay = ligdeMi(uye) ? uye.lig.onay : simdi;
  const bas = zatenIcinde ? takimaGiris(uye) : simdi;
  return { lig: { onay, bas, ad: takmaAd, takim: mevcut ? mevcut.ad : takimAdi } };
}

/** Üyenin yeni kopyası: lig verilirse yazılır, null ise lig alanı tamamen silinir. */
export function ligUygula(uye, lig) {
  const { lig: _eski, ...geri } = uye;
  return lig ? { ...geri, lig } : geri;
}
