// Üyenin telefonundaki kart. Bilgi WhatsApp'tan gelen linkin # kısmından okunur ve telefonda saklanır;
// hiçbir sunucuya gitmez. Adres # ile birlikte kalır: iPhone ana ekran uygulaması kartı adresten bulur.
import { davetCoz } from './davet.js';
import { qrMetni, yedekKod, pencereKalanMs, PENCERE_MS, b64u } from './kod.js';
import { uyeDurumu } from './kural.js';
import { k, qrSvg, tarihTR, kalanMetni, DURUM, azHareket } from './ui.js';
import { cevrimdisiKur } from './cevrimdisi.js';
import { MARKA } from './marka.js';

const ANAHTAR = 'salonkapi.kart';
const KVKK_ANAHTARI = 'salonkapi.kvkkOkundu';

const kvkkOkunduMu = () => { try { return Boolean(localStorage.getItem(KVKK_ANAHTARI)); } catch { return false; } };

// Bilgilendirme, onay değil: kart okunmasa da çalışır (açık rıza üyelik şartı yapılamaz).
function kvkkKutusu() {
  if (kvkkOkunduMu()) return '';
  return `<div class="kvkk-kutu" data-kvkk>
    <p><b>Kişisel verileriniz.</b> ${k(MARKA.ad)} bilgilerinizi yalnız üyeliğiniz ve salona giriş için işler. Bu karttaki bilgiler sadece telefonunuzda durur, bir sunucuya gönderilmez.</p>
    <div class="satir-islem"><a class="btn btn-kucuk" href="${k(MARKA.aydinlatma)}">Aydınlatma metnini oku</a>
      <button type="button" class="btn btn-kucuk btn-koyu" data-kvkk-tamam>Okudum, bilgilendim</button></div>
  </div>`;
}
const kok = document.getElementById('uygulama');

function kayitliKart() {
  try {
    const h = JSON.parse(localStorage.getItem(ANAHTAR) || 'null');
    if (!h || typeof h.anahtar !== 'string') return null;
    return davetCoz(`#${h.kod}`);
  } catch { return null; }
}

/** Adresteki kart daha yeniyse onu kaydet; değilse telefondakini kullan. */
function kartYukle() {
  const adres = davetCoz(location.hash);
  const kayitli = kayitliKart();
  if (adres && (!kayitli || adres.olusturma >= kayitli.olusturma)) {
    try { localStorage.setItem(ANAHTAR, JSON.stringify({ kod: location.hash.slice(1), anahtar: b64u.kodla(adres.anahtar) })); } catch { /* gizli sekme */ }
    return adres;
  }
  return kayitli;
}

const uygulamaIcindeMi = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const iphoneMu = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

function ekleYardimi() {
  if (uygulamaIcindeMi()) return '';
  if (iphoneMu()) {
    return `<div class="ekle-ipucu"><p class="etiket">Bir kere yapın</p>
      <p>Alttaki <b>Paylaş</b> düğmesine (kare ve ok) dokunun, sonra <b>Ana Ekrana Ekle</b>. Kart telefonunuzda uygulama gibi durur.</p>
      <p class="kucuk-not">Safari'de açın. WhatsApp içinde açıldıysa sağ üstten "Safari'de aç" deyin.</p></div>`;
  }
  return `<div class="ekle-ipucu"><p class="etiket">Bir kere yapın</p>
    <p>Kartı ana ekranınıza ekleyin, salona gelince tek dokunuşla açın.</p>
    <button type="button" class="btn btn-ana" data-ekle hidden>Ana ekrana ekle</button>
    <p class="kucuk-not" data-ekle-not>Tarayıcı menüsünden (⋮) <b>Ana ekrana ekle</b>yi seçin.</p></div>`;
}

function kartYok() {
  kok.innerHTML = `<section class="uye kart-yok"><div class="uye-marka"><img src="${k(MARKA.logo)}" alt="" width="44" height="44"><p class="etiket">${k(MARKA.ad)}</p></div><h1>Kartınız bu telefonda yok</h1>
    <p class="uye-aciklama">Salonun WhatsApp'tan gönderdiği linke dokunun ya da resepsiyonda ekrandaki QR'ı telefonunuzun kamerasıyla okutun.</p></section>`;
}

function kartCiz(kart) {
  const d = uyeDurumu({ bitis: kart.bitis, donduruldu: null });
  const uyari = d.durum === 'bitti' ? 'Üyeliğiniz bitti. Kapı açılmaz; yenilemek için resepsiyona uğrayın.' : '';
  document.title = `${kart.salon} · Salon Kart`;
  kok.innerHTML = `
  <section class="uye">
    <header class="uye-ust"><div class="uye-marka"><img src="${k(MARKA.logo)}" alt="" width="44" height="44"><p class="etiket"></p></div></header>
    <div class="uye-kimlik"><h1></h1>
      <p class="uye-durum"><span class="cip ${DURUM[d.durum].sinif}">${DURUM[d.durum].etiket}</span><span>${k(kalanMetni(d.kalanGun))} · bitiş ${k(tarihTR(kart.bitis))}</span></p></div>
    ${uyari ? `<p class="uye-uyari">${k(uyari)}</p>` : ''}
    <div class="qr-kart">
      <div class="qr-alan" data-qr aria-label="Giriş QR kodu"></div>
      <div class="geri-sayim" aria-hidden="true"><span data-bar></span></div>
      <p class="qr-not"><b data-sn>30</b> sn sonra yeni kod · ekran görüntüsü çalışmaz</p>
    </div>
    <div class="yedek-kutu"><span class="etiket">QR okunmazsa yedek kod</span><span class="sayi yedek-sayi" data-yedek>······</span></div>
    <p class="uye-aciklama kucuk">Ekran parlaklığını açın, QR'ı turnikedeki okuyucuya 5–10 cm'den gösterin.</p>
    ${kvkkKutusu()}
    ${ekleYardimi()}
    <p class="kucuk-not">Bitiş tarihi değiştiyse ya da telefonu değiştirdiyseniz resepsiyondan yeni link isteyin. Bu kart size özeldir, başkasıyla paylaşmayın.</p>
    <p class="kucuk-not"><a href="${k(MARKA.aydinlatma)}">KVKK aydınlatma metni</a> · ${k(MARKA.adres)}</p>
  </section>`;
  kok.querySelector('[data-kvkk-tamam]')?.addEventListener('click', () => {
    try { localStorage.setItem(KVKK_ANAHTARI, String(Date.now())); } catch { /* gizli sekme */ }
    kok.querySelector('[data-kvkk]')?.remove();
  });
  kok.querySelector('.uye-ust .etiket').textContent = kart.salon;
  kok.querySelector('.uye-kimlik h1').textContent = kart.ad;
}

function qrDongusu(kart) {
  const qrYeri = kok.querySelector('[data-qr]');
  const yedekYeri = kok.querySelector('[data-yedek]');
  const bar = kok.querySelector('[data-bar]');
  const sn = kok.querySelector('[data-sn]');
  let sonraki = null;

  async function yenile() {
    clearTimeout(sonraki);
    const simdi = Date.now();
    try {
      const [metin, kod] = await Promise.all([qrMetni(kart.anahtar, kart.uyeId, simdi), yedekKod(kart.anahtar, simdi)]);
      qrYeri.innerHTML = qrSvg(metin, { ecc: 'M', baslik: 'Giriş QR kodu' });
      yedekYeri.textContent = `${kod.slice(0, 3)} ${kod.slice(3)}`;
    } catch (hata) {
      qrYeri.innerHTML = `<p class="uye-uyari">${k(hata.message)}</p>`;
    }
    const kalan = pencereKalanMs(simdi);
    bar.style.transition = 'none';
    bar.style.transform = `scaleX(${kalan / PENCERE_MS})`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bar.style.transition = azHareket() ? 'none' : `transform ${kalan}ms linear`;
      bar.style.transform = 'scaleX(0)';
    }));
    sonraki = setTimeout(yenile, kalan + 50);
  }

  const saniye = () => { sn.textContent = String(Math.ceil(pencereKalanMs(Date.now()) / 1000)); };
  setInterval(saniye, 500);
  saniye();
  yenile();
  let kilit = null;
  const uyanik = async () => {
    if (document.visibilityState !== 'visible') return;
    yenile();
    try { kilit = await navigator.wakeLock?.request('screen'); } catch { kilit = null; }
  };
  document.addEventListener('visibilitychange', uyanik);
  uyanik();
  return () => kilit?.release?.();
}

function androidEkle() {
  const dugme = kok.querySelector('[data-ekle]');
  if (!dugme) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    dugme.hidden = false;
    kok.querySelector('[data-ekle-not]').hidden = true;
    dugme.addEventListener('click', () => e.prompt(), { once: true });
  });
}

const kart = kartYukle();
if (!kart) kartYok(); else { kartCiz(kart); qrDongusu(kart); androidEkle(); }
cevrimdisiKur();
