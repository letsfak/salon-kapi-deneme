// Hatırlat: parayı kapı değil bu liste kurtarır. Süresi biten, gelmeyen, borçlu; her satırda tek tık WhatsApp.
// Mesajı resepsiyondaki kişi gönderir (otomatik gönderim sunucu ve ücretli API ister). Gönderilince işaretlenir.
import { uyeKaydet } from './depo.js';
import { bitiyorlar, gelmeyenler, uyeDurumu, gelmedigiGun } from './kural.js';
import { borc } from './salon.js';
import { waLinki, MESAJ } from './whatsapp.js';
import { uyeKartiAc } from './uye-kart.js';
import { k, tl, tarihTR, kalanMetni, sonGelisMetni, DURUM } from './ui.js';

const YAKIN_YAZILDI_GUN = 3;

function yazildiMetni(uye, tur, simdi) {
  const h = uye.hatirlatmalar?.[tur];
  if (!h) return '';
  const gun = Math.floor((simdi - h) / 86_400_000);
  return `<span class="cip ${gun < YAKIN_YAZILDI_GUN ? 'cip-ok' : 'cip-notr'}">Yazıldı · ${gun === 0 ? 'bugün' : `${gun} gün önce`}</span>`;
}

function satir(ctx, uye, tur, bilgi, mesaj, simdi) {
  return `<li>
    <div class="hatirlat-ust"><button type="button" class="satir-ad" data-uye="${k(uye.id)}">${k(uye.ad)}</button>${bilgi}</div>
    <div class="satir-islem">
      <a class="btn btn-kucuk ${uye.tel ? 'btn-ana' : ''}" href="${k(waLinki(uye.tel, mesaj))}" target="_blank" rel="noopener" data-yaz="${k(uye.id)}" data-tur="${tur}">WhatsApp${uye.tel ? '' : ' (numara yok)'}</a>
      ${yazildiMetni(uye, tur, simdi)}
    </div></li>`;
}

export function ac(el, ctx) {
  const simdi = Date.now();
  const salon = ctx.salon.ad;
  const biten = bitiyorlar(ctx.uyeler, simdi);
  const kayip = gelmeyenler(ctx.uyeler, simdi);
  const borclu = ctx.uyeler.map((u) => ({ u, b: borc(u, ctx.odemeler) })).filter((x) => x.b > 0).sort((a, b) => b.b - a.b);

  el.innerHTML = `
  <div class="hatirlat-izgara">
    <section class="kutu"><header class="kutu-ust"><h2>Süresi biten / bitmek üzere</h2><span class="sayac">${biten.length}</span></header>
      <p class="kucuk-not">Önümüzdeki 7 gün ve son 30 gün. Yenileme burada kazanılır.</p>
      <ul class="hatirlat-liste">${biten.map((u) => {
        const d = uyeDurumu(u, simdi);
        return satir(ctx, u, 'bitiyor', `<span class="cip ${DURUM[d.durum].sinif}">${k(kalanMetni(d.kalanGun))}</span>`, MESAJ.bitiyor(u, salon, tarihTR(u.bitis), d.kalanGun), simdi);
      }).join('') || '<li class="bos">Yakında biten üye yok.</li>'}</ul></section>
    <section class="kutu"><header class="kutu-ust"><h2>Gelmeyenler (10+ gün)</h2><span class="sayac">${kayip.length}</span></header>
      <p class="kucuk-not">Üyeliği sürüyor ama gelmiyor. Bırakmadan önce bir mesaj çoğu zaman geri getirir.</p>
      <ul class="hatirlat-liste">${kayip.map((u) => satir(ctx, u, 'gelmeyen', `<span class="cip cip-notr">${k(sonGelisMetni(u.sonGelis, simdi))}</span>`,
        MESAJ.gelmeyen(u, salon, gelmedigiGun(u, simdi) ?? Math.floor((simdi - (u.olusturma || simdi)) / 86_400_000)), simdi)).join('') || '<li class="bos">Herkes geliyor.</li>'}</ul></section>
    <section class="kutu"><header class="kutu-ust"><h2>Borçlular</h2><span class="sayac">${borclu.length}</span></header>
      <ul class="hatirlat-liste">${borclu.map(({ u, b }) => satir(ctx, u, 'borc', `<span class="cip cip-red">${k(tl(b))}</span>`, MESAJ.borc(u, salon, b.toLocaleString('tr-TR')), simdi)).join('') || '<li class="bos">Borçlu üye yok.</li>'}</ul></section>
  </div>`;

  el.querySelectorAll('[data-uye]').forEach((b) => b.addEventListener('click', () => uyeKartiAc(ctx, b.dataset.uye)));
  el.querySelectorAll('[data-yaz]').forEach((a) => a.addEventListener('click', async () => {
    const uye = ctx.uyeler.find((u) => u.id === a.dataset.yaz);
    if (!uye) return;
    await uyeKaydet({ ...uye, hatirlatmalar: { ...(uye.hatirlatmalar || {}), [a.dataset.tur]: Date.now() } });
    setTimeout(() => ctx.yenile(), 400);
  }));
  return () => {};
}
