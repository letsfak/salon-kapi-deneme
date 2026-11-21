// Sahip/hoca paneli kabuğu: sekmeler, canlı yenileme, hareketsizlikte kilit, günlük otomatik yedek.
import { degisiklikDinle, eskiHareketleriSil } from './depo.js';
import { KAPI_KAYIT_SAKLAMA_GUN, usbYedekGerekliMi } from './kural.js';
import { KILIT_MS, paneliAcikIsaretle, paneliKilitle } from './pin.js';
import { gunlukYedekAl, yedekDurumu, yedekIzniVer, usbYedekAl, usbYedekSon } from './yedek.js';
import { veriYukle } from './veri.js';
import { saatTR, bildir } from './ui.js';
import * as bugun from './panel-bugun.js';
import * as uyeler from './panel-uyeler.js';
import * as hatirlat from './panel-hatirlat.js';
import * as kasa from './panel-kasa.js';
import * as ayarlar from './panel-ayar.js';

const OKUTMA_PAYI_MS = 400;

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
      bantCiz().catch(() => {});
    } catch (hata) {
      bildir(`Veri okunamadı: ${hata.message}`, { hata: true });
    }
  }
  ctx.yenile = ciz;

  // Yedek uyarıları birbirinden bağımsız: klasör yedeği kurulu olmasa da USB hatırlatması görünür.
  async function bantCiz() {
    const { durum } = await yedekDurumu();
    if (!ctx.aktif) return;
    const satirlar = [];
    if (durum === 'yok') satirlar.push('Otomatik yedek kurulmadı. Bilgisayar bozulursa üye listesi gider. <a href="#/panel/ayarlar">Ayarlar → Yedek</a>');
    if (durum === 'izin-gerek') satirlar.push('Günlük yedek için izin gerekiyor. <button type="button" class="btn btn-kucuk" data-izin>İzin ver ve yedekle</button>');
    if (ctx.uyeler?.length > 0 && usbYedekGerekliMi(usbYedekSon())) {
      satirlar.push('Bu hafta USB belleğe yedek alınmadı. Laptop çalınır ya da bozulursa üyeler buradan geri gelir. <button type="button" class="btn btn-kucuk" data-usb>USB belleğe yedek al</button>');
    }
    bant.hidden = satirlar.length === 0;
    bant.innerHTML = satirlar.map((s) => `<p>${s}</p>`).join('');
    bant.querySelector('[data-izin]')?.addEventListener('click', async () => {
      if (await yedekIzniVer()) { await gunlukYedekAl({ zorla: true }); bildir('Yedek alındı'); bantCiz(); }
    });
    bant.querySelector('[data-usb]')?.addEventListener('click', async () => {
      try {
        const sonuc = await usbYedekAl();
        if (sonuc === 'yazildi') bildir('USB yedeği alındı. Belleği çıkarıp kilitli bir yerde saklayın.');
        if (sonuc === 'indirildi') bildir('Yedek İndirilenler klasörüne indi. Oradan USB belleğe kopyalayın.');
        bantCiz();
      } catch (hata) { bildir(`USB yedeği alınamadı: ${hata.message}`, { hata: true }); }
    });
  }

  async function yedekBandi() {
    try {
      const ad = await gunlukYedekAl();
      if (ad) bildir(`Günlük yedek alındı: ${ad}`);
      await bantCiz();
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
  // Tuşlar biraz gecikmeyle hareket sayılır: bu arada okuyucu QR'ı tanınırsa (salonkapi:okutma) sayılmaz.
  let bekleyenTus = null;
  const tusHareketi = () => { clearTimeout(bekleyenTus); bekleyenTus = setTimeout(hareket, OKUTMA_PAYI_MS); };
  const okutmaOldu = () => clearTimeout(bekleyenTus);
  const kilitle = () => { paneliKilitle(); window.dispatchEvent(new HashChangeEvent('hashchange')); };
  document.addEventListener('pointerdown', hareket);
  document.addEventListener('keydown', tusHareketi);
  window.addEventListener('salonkapi:okutma', okutmaOldu);
  kok.querySelector('[data-kilitle]').addEventListener('click', kilitle);

  const dinlemeyiBirak = degisiklikDinle(arkaPlanYenile);
  zamanlar.push(setInterval(() => {
    saatYaz();
    if (Date.now() - sonHareket > KILIT_MS) kilitle();
  }, 15_000));
  zamanlar.push(setInterval(arkaPlanYenile, 120_000));
  saatYaz();
  ciz().then(() => { if (ctx.aktif) yedekBandi(); });
  zamanlar.push(setInterval(() => bantCiz().catch(() => {}), 120_000));
  // Aydınlatma metnindeki söz: kapı kayıtları 12 ay sonra silinir.
  eskiHareketleriSil(Date.now() - KAPI_KAYIT_SAKLAMA_GUN * 86_400_000).catch(() => {});

  return () => {
    ctx.aktif = false;
    dinlemeyiBirak();
    clearTimeout(bekleyen);
    clearTimeout(bekleyenTus);
    zamanlar.forEach(clearInterval);
    document.removeEventListener('pointerdown', hareket);
    document.removeEventListener('keydown', tusHareketi);
    window.removeEventListener('salonkapi:okutma', okutmaOldu);
    if (typeof sekmeKapat === 'function') sekmeKapat();
    document.querySelectorAll('dialog.diyalog').forEach((d) => d.remove());
  };
}

