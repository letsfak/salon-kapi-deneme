// Sahip/hoca paneli kabuğu: sekmeler, canlı yenileme, hareketsizlikte kilit, günlük otomatik yedek.
import { degisiklikDinle } from './depo.js';
import { KILIT_MS, paneliAcikIsaretle, paneliKilitle } from './pin.js';
import { gunlukYedekAl, yedekDurumu, yedekIzniVer } from './yedek.js';
import { veriYukle } from './veri.js';
import { saatTR, bildir } from './ui.js';
import * as bugun from './panel-bugun.js';
import * as uyeler from './panel-uyeler.js';
import * as hatirlat from './panel-hatirlat.js';
import * as kasa from './panel-kasa.js';
import * as ayarlar from './panel-ayar.js';

const SEKMELER = [
  ['bugun', 'Bugün', bugun], ['uyeler', 'Üyeler', uyeler], ['hatirlat', 'Hatırlat', hatirlat],
  ['kasa', 'Kasa', kasa], ['ayarlar', 'Ayarlar', ayarlar],
];

export function panelAc(kok, salonIlk, sekmeAd) {
  const sekme = SEKMELER.find(([ad]) => ad === sekmeAd) || SEKMELER[0];
  kok.innerHTML = `
  <section class="panel">
    <header class="panel-ust">
      <div class="panel-baslik"><p class="etiket">Salon Kapı · panel</p><h1 data-salon></h1></div>
      <div class="panel-ust-sag">
        <p class="sayi panel-saat" data-saat></p>
        <a class="btn btn-kucuk btn-koyu" href="#/kapi" target="_blank" rel="noopener">Kapı ekranı ↗</a>
        <button type="button" class="btn btn-kucuk btn-hayalet" data-kilitle>Kilitle</button>
      </div>
    </header>
    <div class="bant" data-bant hidden></div>
    <nav class="ust-sekmeler" aria-label="Panel bölümleri">
      ${SEKMELER.map(([ad, etiket]) => `<a href="#/panel/${ad}" ${ad === sekme[0] ? 'aria-current="page"' : ''}>${etiket}</a>`).join('')}
    </nav>
    <div data-icerik></div>
  </section>`;
  kok.querySelector('[data-salon]').textContent = salonIlk.ad;
  const icerik = kok.querySelector('[data-icerik]');
  const bant = kok.querySelector('[data-bant]');
  const ctx = { durum: {}, aktif: true };
  let sekmeKapat = null;
  let bekleyen = null;
  let sonHareket = Date.now();
  let sonIsaret = Date.now();
  const zamanlar = [];

  // Biri bir alana yazıyorsa ya da Ayarlar açıksa arka plan yenilemesi formu silmesin; sonra yapılır.
  const yaziyorMu = () => sekme[0] === 'ayarlar'
    || (icerik.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName))
    || Boolean(document.querySelector('dialog.diyalog[open]'));

  function arkaPlanYenile() {
    clearTimeout(bekleyen);
    bekleyen = setTimeout(() => { if (yaziyorMu()) arkaPlanYenile(); else ciz(); }, yaziyorMu() ? 5000 : 250);
  }

  async function ciz() {
    if (!ctx.aktif) return;
    try {
      const veri = await veriYukle();
      if (!ctx.aktif) return;
      Object.assign(ctx, veri);
      kok.querySelector('[data-salon]').textContent = veri.salon.ad;
      if (typeof sekmeKapat === 'function') sekmeKapat();
      sekmeKapat = sekme[2].ac(icerik, ctx);
    } catch (hata) {
      bildir(`Veri okunamadı: ${hata.message}`, { hata: true });
    }
  }
  ctx.yenile = ciz;

  async function yedekBandi() {
    try {
      const ad = await gunlukYedekAl();
      if (ad) bildir(`Günlük yedek alındı: ${ad}`);
      const { durum } = await yedekDurumu();
      if (durum === 'hazir') { bant.hidden = true; return; }
      bant.hidden = false;
      bant.innerHTML = durum === 'yok'
        ? 'Otomatik yedek kurulmadı. Bilgisayar bozulursa üye listesi gider. <a href="#/panel/ayarlar">Ayarlar → Yedek</a>'
        : 'Günlük yedek için izin gerekiyor. <button type="button" class="btn btn-kucuk" data-izin>İzin ver ve yedekle</button>';
      bant.querySelector('[data-izin]')?.addEventListener('click', async () => {
        if (await yedekIzniVer()) { await gunlukYedekAl({ zorla: true }); bildir('Yedek alındı'); yedekBandi(); }
      });
    } catch (hata) {
      bant.hidden = false;
      bant.textContent = `Yedek alınamadı: ${hata.message}`;
    }
  }

  const saatYaz = () => { kok.querySelector('[data-saat]').textContent = saatTR(Date.now()); };
  // Kilit süresi son işaretten sayılır: aktif kullanıcı en geç 30 sn'de bir işaretlenir.
  const hareket = () => {
    sonHareket = Date.now();
    if (sonHareket - sonIsaret > 30_000) { paneliAcikIsaretle(); sonIsaret = sonHareket; }
  };
  const kilitle = () => { paneliKilitle(); window.dispatchEvent(new HashChangeEvent('hashchange')); };
  ['pointerdown', 'keydown'].forEach((t) => document.addEventListener(t, hareket));
  kok.querySelector('[data-kilitle]').addEventListener('click', kilitle);

  const dinlemeyiBirak = degisiklikDinle(arkaPlanYenile);
  zamanlar.push(setInterval(() => {
    saatYaz();
    if (Date.now() - sonHareket > KILIT_MS) kilitle();
  }, 15_000));
  zamanlar.push(setInterval(arkaPlanYenile, 120_000));
  saatYaz();
  ciz();
  yedekBandi();

  return () => {
    ctx.aktif = false;
    dinlemeyiBirak();
    clearTimeout(bekleyen);
    zamanlar.forEach(clearInterval);
    ['pointerdown', 'keydown'].forEach((t) => document.removeEventListener(t, hareket));
    if (typeof sekmeKapat === 'function') sekmeKapat();
    document.querySelectorAll('dialog.diyalog').forEach((d) => d.remove());
  };
}

