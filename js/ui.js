// Ortak arayüz yardımcıları: güvenli metin, biçimler, QR çizimi, ses, bildirim, pencere.

const KACIS = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Kullanıcıdan, dosyadan ya da adresten gelen her metin HTML'e bununla girer. */
export const k = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => KACIS[c]);

export const saatTR = (ms) => new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
export const tarihTR = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
export const kisaTarih = (ms) => new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
export const tl = (n) => `${Math.round(Number(n) || 0).toLocaleString('tr-TR')} TL`;
export const basHarfler = (ad) => String(ad || '?').split(' ').map((p) => p[0] || '').join('').slice(0, 2).toLocaleUpperCase('tr-TR');

export const DURUM = {
  aktif: { etiket: 'Aktif', sinif: 'cip-ok' },
  bitiyor: { etiket: 'Bitiyor', sinif: 'cip-uyari' },
  bitti: { etiket: 'Bitti', sinif: 'cip-red' },
  donduruldu: { etiket: 'Donduruldu', sinif: 'cip-donuk' },
};

export const RED_ETIKET = {
  bitti: 'Süresi bitmiş', eski: 'Eski QR (ekran görüntüsü)', imza: 'Geçersiz QR / eski telefon', bicim: 'Tanınmayan kod',
  bilinmeyen: 'Bilinmeyen üye', donduruldu: 'Dondurulmuş', iceride: 'Zaten içeride (paylaşım?)', borc: 'Borç nedeniyle',
  kod: 'Yanlış yedek kod', kodKilidi: 'Yedek kod kilidi (çok deneme)',
};

export function kalanMetni(kalanGun) {
  if (kalanGun < 0) return `${-kalanGun} gün önce bitti`;
  if (kalanGun === 0) return 'Bugün bitiyor';
  return `${kalanGun} gün kaldı`;
}

export function sonGelisMetni(sonGelis, simdi = Date.now()) {
  if (!sonGelis) return 'Hiç gelmedi';
  const gun = Math.floor((simdi - sonGelis) / 86_400_000);
  return gun === 0 ? 'Bugün' : gun === 1 ? 'Dün' : `${gun} gün önce`;
}

/** QR'ı SVG olarak üretir (vendor/qrcode.js). */
export function qrSvg(metin, { ecc = 'M', hucre = 10, baslik = '' } = {}) {
  const q = globalThis.qrcode(0, ecc);
  q.addData(metin);
  q.make();
  return q.createSvgTag({ cellSize: hucre, margin: hucre * 2, scalable: true, title: baslik || undefined });
}

/** Uygulamanın yayın klasörü (GitHub Pages alt klasöründe de doğru), sonu / ile biter. */
export const tabanAdres = () => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;

export function bildir(metin, { hata = false } = {}) {
  const b = document.createElement('div');
  b.className = `bildirim${hata ? ' bildirim-hata' : ''}`;
  b.setAttribute('role', hata ? 'alert' : 'status');
  b.textContent = metin;
  document.body.append(b);
  setTimeout(() => b.remove(), hata ? 5000 : 2600);
}

/** Basit modal pencere. icerik: HTML (kaçışlı). kur(kutu, kapat) olayları bağlar. */
export function pencereAc(icerik, kur = () => {}) {
  const d = document.createElement('dialog');
  d.className = 'diyalog diyalog-genis';
  d.innerHTML = `<div class="diyalog-ic">${icerik}</div>`;
  document.body.append(d);
  const kapat = () => { d.close(); d.remove(); };
  d.addEventListener('cancel', (e) => { e.preventDefault(); kapat(); });
  d.querySelectorAll('[data-kapat]').forEach((b) => b.addEventListener('click', kapat));
  kur(d, kapat);
  d.showModal();
  return kapat;
}

let sesBaglami = null;
export function sesiAc() {
  try {
    sesBaglami = sesBaglami || new (window.AudioContext || window.webkitAudioContext)();
    if (sesBaglami.state === 'suspended') sesBaglami.resume();
  } catch { sesBaglami = null; }
}

function ton(frekans, baslangic, sure, tur = 'sine') {
  const o = sesBaglami.createOscillator();
  const g = sesBaglami.createGain();
  o.type = tur;
  o.frequency.value = frekans;
  g.gain.setValueAtTime(0.0001, baslangic);
  g.gain.exponentialRampToValueAtTime(0.25, baslangic + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, baslangic + sure);
  o.connect(g).connect(sesBaglami.destination);
  o.start(baslangic);
  o.stop(baslangic + sure + 0.02);
}

export function bip(gecti) {
  if (!sesBaglami) return;
  const t = sesBaglami.currentTime;
  if (gecti) { ton(988, t, 0.09); ton(1319, t + 0.1, 0.14); } else { ton(196, t, 0.42, 'square'); }
}

export const azHareket = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
