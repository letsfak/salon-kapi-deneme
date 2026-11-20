// Üye listesini Excel'den almak: Excel'de "Farklı Kaydet → CSV". Türkçe Excel noktalı virgül ve
// Windows-1254 kodlamasıyla kaydeder; ikisi de tanınır. Kullanıcıdan gelen veri: her alan doğrulanır.
import { gercekTarih } from './tarih.js';

const EN_FAZLA_SATIR = 2000;

export function metniCoz(bayt) {
  let b = bayt;
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) b = b.subarray(3);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    return new TextDecoder('windows-1254').decode(b);
  }
}

function ayracBul(ilkSatir) {
  const say = (c) => ilkSatir.split(c).length - 1;
  return [';', ',', '\t'].reduce((en, c) => (say(c) > say(en) ? c : en), ';');
}

/** RFC 4180 benzeri ayrıştırıcı: tırnaklı alan, "" kaçışı, alan içinde satır sonu. */
export function csvAyristir(metin, ayrac = ayracBul(String(metin).split(/\r?\n/)[0] || '')) {
  const satirlar = [];
  let satir = [];
  let alan = '';
  let tirnakta = false;
  const s = String(metin);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (tirnakta) {
      if (c === '"' && s[i + 1] === '"') { alan += '"'; i++; } else if (c === '"') { tirnakta = false; } else { alan += c; }
    } else if (c === '"') {
      tirnakta = true;
    } else if (c === ayrac) {
      satir.push(alan); alan = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      satir.push(alan); satirlar.push(satir); satir = []; alan = '';
    } else {
      alan += c;
    }
  }
  if (alan !== '' || satir.length) { satir.push(alan); satirlar.push(satir); }
  return satirlar.filter((r) => r.some((x) => x.trim() !== ''));
}

const iki = (n) => String(n).padStart(2, '0');

/** "20.11.2026", "5/1/2027" (gün önce), "2027-02-01" ya da Excel seri sayısı → YYYY-AA-GG. */
export function tarihCoz(deger) {
  const s = String(deger ?? '').trim();
  let iso = null;
  let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) iso = `${m[1]}-${iki(m[2])}-${iki(m[3])}`;
  else if ((m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s))) iso = `${m[3]}-${iki(m[2])}-${iki(m[1])}`;
  else if (/^\d{5}$/.test(s)) iso = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86_400_000).toISOString().slice(0, 10);
  return iso && gercekTarih(iso) ? iso : null;
}

const sade = (s) => String(s ?? '').toLocaleLowerCase('tr-TR')
  .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const BASLIK = {
  ad: ['ad soyad', 'adi soyadi', 'ad soyadi', 'isim soyisim', 'isim', 'ad', 'adi', 'uye', 'uye adi', 'musteri', 'adsoyad'],
  soyad: ['soyad', 'soyadi', 'soyisim'],
  tel: ['telefon', 'tel', 'cep', 'cep telefonu', 'gsm', 'telefon no', 'telefon numarasi', 'cep tel'],
  bitis: ['bitis', 'bitis tarihi', 'uyelik bitis', 'son gun', 'bitis tarih'],
  paket: ['paket', 'sure', 'uyelik suresi', 'uyelik', 'paket suresi'],
};

function sutunlariBul(baslik) {
  const sutunlar = {};
  baslik.forEach((h, i) => {
    const t = sade(h);
    for (const [ad, esler] of Object.entries(BASLIK)) {
      if (!(ad in sutunlar) && esler.includes(t)) { sutunlar[ad] = i; break; }
    }
  });
  return sutunlar;
}

function paketCoz(deger) {
  const t = sade(deger);
  if (!t) return null;
  if (/yil/.test(t)) return 12;
  const m = /(\d{1,2})/.exec(t);
  const n = m ? Number(m[1]) : null;
  return n && n >= 1 && n <= 24 ? n : null;
}

/** CSV metninden üye satırları. Hatalı satırlar ayrı raporlanır, sessizce atlanmaz. */
export function uyeSatirlari(metin) {
  const satirlar = csvAyristir(metin).slice(0, EN_FAZLA_SATIR + 1);
  const sutunlar = sutunlariBul(satirlar[0] || []);
  if (!('ad' in sutunlar)) {
    return { uyeler: [], hatalar: [], sutunlar, genelHata: 'Ad sütunu bulunamadı. İlk satırda "Ad Soyad" başlığı olmalı.' };
  }
  const al = (r, ad) => (ad in sutunlar ? String(r[sutunlar[ad]] ?? '').trim() : '');
  const uyeler = [];
  const hatalar = [];
  satirlar.slice(1).forEach((r, i) => {
    const satir = i + 2;
    const ad = [al(r, 'ad'), al(r, 'soyad')].filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, 60);
    if (!ad) { hatalar.push({ satir, sebep: 'Ad boş' }); return; }
    const bitisHam = al(r, 'bitis');
    const bitis = bitisHam ? tarihCoz(bitisHam) : null;
    if (bitisHam && !bitis) { hatalar.push({ satir, sebep: `Bitiş tarihi okunamadı: "${bitisHam.slice(0, 20)}"` }); return; }
    uyeler.push({ ad, tel: al(r, 'tel').slice(0, 20), bitis, paketAy: paketCoz(al(r, 'paket')) });
  });
  return { uyeler, hatalar, sutunlar };
}
