// İlk açılış: salonu kur ya da başka bir laptoptaki yedeği yükle.
import { ayarYaz } from './depo.js';
import { b64u, rastgeleAnahtar } from './kod.js';
import { pinGecerliMi, pinTuret, paneliAcikIsaretle } from './pin.js';
import { yedektenYukle } from './yedek.js';
import { bildir, k } from './ui.js';
import { MARKA } from './marka.js';

const PAKETLER = [1, 3, 6, 12];

export function kurulumAc(kok) {
  kok.innerHTML = `
  <section class="kurulum">
    <header class="kurulum-ust">
      <p class="etiket">Salon Kapı · ilk kurulum</p>
      <h1>Bu laptop salonun kapısı ve defteri olacak</h1>
      <p class="aciklama">Üye bilgileri yalnız bu bilgisayarda durur, internete gönderilmez. Kurulum bir kere yapılır.</p>
    </header>
    <form class="kart form-kart" data-form novalidate>
      <div class="alan"><label for="k-ad">Salonun adı</label>
        <input id="k-ad" name="ad" class="girdi" required maxlength="40" autocomplete="off" value="${k(MARKA.ad)}"></div>
      <div class="form-izgara">
        <div class="alan"><label for="k-pin">Panel PIN'i (4–8 rakam)</label>
          <input id="k-pin" name="pin" class="girdi" inputmode="numeric" type="password" maxlength="8" autocomplete="new-password" required></div>
        <div class="alan"><label for="k-pin2">PIN tekrar</label>
          <input id="k-pin2" name="pin2" class="girdi" inputmode="numeric" type="password" maxlength="8" autocomplete="new-password" required></div>
      </div>
      <fieldset class="alan-grup"><legend>Paket ücretleri (TL, isteğe bağlı; üye eklerken kendiliğinden gelir)</legend>
        <div class="form-izgara dortlu">${PAKETLER.map((ay) => `
          <div class="alan"><label for="k-p${ay}">${ay} ay</label><input id="k-p${ay}" name="p${ay}" class="girdi" inputmode="numeric" maxlength="7" value="${Number(MARKA.paketler.find((p) => p.ay === ay)?.ucret) || ''}"></div>`).join('')}
        </div>
      </fieldset>
      <label class="onay"><input type="checkbox" name="engel"> Borcu olan üye kapıdan geçemesin (işaretlenmezse geçer, ekranda "Resepsiyona uğra" yazar)</label>
      <p class="form-hata" data-hata role="alert"></p>
      <button class="btn btn-ana btn-buyuk" type="submit">Salonu kur</button>
    </form>
    <details class="kart form-kart">
      <summary>Laptop değişti mi? Yedekten geri yükle</summary>
      <p class="aciklama">Eski laptoptaki <b>salonkapi-yedek-….json</b> dosyasını seçin. Üyelerin telefonundaki kartlar aynen çalışmaya devam eder.</p>
      <input type="file" accept="application/json,.json" class="girdi" data-yedek>
    </details>
  </section>`;

  const form = kok.querySelector('[data-form]');
  const hata = kok.querySelector('[data-hata]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const ad = String(f.get('ad') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const pin = String(f.get('pin') || '');
    if (ad.length < 2) { hata.textContent = 'Salonun adını yazın.'; return; }
    if (!pinGecerliMi(pin)) { hata.textContent = 'PIN 4 ile 8 arasında rakam olmalı.'; return; }
    if (pin !== String(f.get('pin2') || '')) { hata.textContent = 'İki PIN aynı değil.'; return; }
    const paketler = PAKETLER.map((ay) => ({ ay, ucret: Math.max(0, Math.round(Number(String(f.get(`p${ay}`) || '').replace(/\D/g, '')) || 0)) }));
    form.querySelector('button').disabled = true;
    try {
      await ayarYaz('salon', {
        ad, anaAnahtar: b64u.kodla(rastgeleAnahtar()), pin: await pinTuret(pin), paketler,
        borcluyuEngelle: f.get('engel') === 'on', kurulus: Date.now(),
      });
      paneliAcikIsaretle();
      location.hash = '#/panel/uyeler';
    } catch (err) {
      hata.textContent = `Kaydedilemedi: ${err.message}`;
      form.querySelector('button').disabled = false;
    }
  });

  kok.querySelector('[data-yedek]').addEventListener('change', async (e) => {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    try {
      const r = await yedektenYukle(dosya);
      bildir(`Yedek yüklendi: ${r.uye} üye`);
      location.hash = '#/panel';
    } catch (err) {
      bildir(err.message, { hata: true });
    }
  });

  return () => {};
}
