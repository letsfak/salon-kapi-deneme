// Salon tarafı yönlendirici: #/kurulum, #/kilit, #/kapi, #/panel/<sekme>.
import { ayarOku, dbAc, kaliciDepoIste } from './depo.js';
import { panelAcikMi } from './pin.js';
import { kurulumAc } from './kurulum.js';
import { kilitAc } from './kilit.js';
import { kapiAc } from './kapi.js';
import { panelAc } from './panel.js';
import { cevrimdisiKur } from './cevrimdisi.js';

const kok = document.getElementById('uygulama');
let kapat = null;

function hataGoster(hata) {
  kok.innerHTML = `<div class="hata-kutu kart"><h2>Bir şey ters gitti</h2>
    <p>Sayfayı yenileyin. Sorun sürerse Chrome ya da Edge kullanın.</p><p class="kucuk-not"></p></div>`;
  kok.querySelector('.kucuk-not').textContent = String(hata?.message || hata);
}

async function git() {
  const [ad, alt] = location.hash.replace(/^#\/?/, '').split('/');
  if (typeof kapat === 'function') { try { kapat(); } catch { /* önceki ekran zaten gitti */ } }
  kapat = null;
  kok.replaceChildren();
  try {
    const salon = await ayarOku('salon');
    let sayfa = ad || 'panel';
    if (!salon) sayfa = 'kurulum';
    else if (sayfa === 'kurulum') sayfa = 'panel';
    if (sayfa === 'panel' && !panelAcikMi()) sayfa = 'kilit';

    document.body.className = `sayfa-${sayfa}`;
    if (sayfa === 'kurulum') { document.title = 'Kurulum · Salon Kapı'; kapat = kurulumAc(kok); }
    else if (sayfa === 'kilit') { document.title = 'Panel kilitli · Salon Kapı'; kapat = kilitAc(kok, salon); }
    else if (sayfa === 'kapi') { document.title = `Kapı · ${salon.ad}`; kapat = kapiAc(kok, salon); }
    else { document.title = `Panel · ${salon.ad}`; kapat = panelAc(kok, salon, alt); }
  } catch (hata) {
    kapat = null;
    hataGoster(hata);
  }
}

(async () => {
  try { await dbAc(); } catch (hata) { hataGoster(hata); return; }
  kaliciDepoIste();
  cevrimdisiKur();
  window.addEventListener('hashchange', git);
  git();
})();
