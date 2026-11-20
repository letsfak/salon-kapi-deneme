// Panel kilidi. Art arda yanlış PIN'de bekleme süresi uzar (kaba kuvvet denemesine karşı).
// Sayaç tarayıcıda kalıcıdır: sayfayı yenilemek ya da yeni sekme açmak bekleme süresini sıfırlamaz.
import { pinDogrula, paneliAcikIsaretle } from './pin.js';

const SAYAC = 'salonkapi.pinDeneme';
const SERBEST_DENEME = 5;
const EN_UZUN_BEKLEME_SN = 15 * 60;

function sayacOku() {
  try {
    const s = JSON.parse(localStorage.getItem(SAYAC) || '{}');
    return { yanlis: Number(s.yanlis) || 0, bekleSonu: Number(s.bekleSonu) || 0 };
  } catch { return { yanlis: 0, bekleSonu: 0 }; }
}

function sayacYaz(s) {
  try { localStorage.setItem(SAYAC, JSON.stringify(s)); } catch { /* gizli sekme */ }
}

export function kilitAc(kok, salon) {
  kok.innerHTML = `
  <section class="kilit">
    <form class="kart kilit-kart" data-form>
      <p class="etiket"></p>
      <h1>Panel kilitli</h1>
      <div class="alan"><label for="pin">PIN</label>
        <input id="pin" name="pin" class="girdi pin-girdi" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password" autofocus></div>
      <p class="form-hata" data-hata role="alert"></p>
      <button class="btn btn-ana btn-buyuk" type="submit">Aç</button>
      <a class="btn btn-hayalet" href="#/kapi">Kapı ekranına git (PIN gerekmez)</a>
    </form>
  </section>`;
  kok.querySelector('.etiket').textContent = salon.ad;
  const form = kok.querySelector('[data-form]');
  const hata = kok.querySelector('[data-hata]');
  const girdi = kok.querySelector('#pin');
  girdi.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sayac = sayacOku();
    const kalan = Math.ceil((sayac.bekleSonu - Date.now()) / 1000);
    if (kalan > 0) { hata.textContent = `Çok fazla yanlış deneme. ${kalan} saniye bekleyin.`; return; }
    if (await pinDogrula(girdi.value, salon.pin)) {
      sayacYaz({ yanlis: 0, bekleSonu: 0 });
      paneliAcikIsaretle();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }
    const yanlis = sayac.yanlis + 1;
    const bekleSn = yanlis >= SERBEST_DENEME ? Math.min(EN_UZUN_BEKLEME_SN, 30 * 2 ** (yanlis - SERBEST_DENEME)) : 0;
    sayacYaz({ yanlis, bekleSonu: bekleSn ? Date.now() + bekleSn * 1000 : 0 });
    girdi.value = '';
    hata.textContent = bekleSn ? `Yanlış PIN. ${bekleSn} saniye bekleyin.` : 'Yanlış PIN.';
  });
  return () => {};
}
