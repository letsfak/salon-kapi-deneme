// Üyeler: arama, durum süzgeci, ekleme, Excel'den aktarım, üye kartı.
import { uyeDurumu } from './kural.js';
import { borc } from './salon.js';
import { uyeKartiAc } from './uye-kart.js';
import { yeniUyeFormu } from './uye-form.js';
import { csvAktarPenceresi } from './csv-aktar.js';
import { k, tl, tarihTR, DURUM, kalanMetni, sonGelisMetni } from './ui.js';

const SUZGEC = [['tumu', 'Tümü'], ['aktif', 'Aktif'], ['bitiyor', 'Bitiyor'], ['bitti', 'Bitti'], ['donduruldu', 'Donuk'], ['borclu', 'Borçlu']];
const kucuk = (s) => String(s).toLocaleLowerCase('tr-TR');

export function ac(el, ctx) {
  ctx.durum.arama ??= '';
  ctx.durum.suzgec ??= 'tumu';
  const simdi = Date.now();
  const satirlar = ctx.uyeler.map((u) => ({ u, d: uyeDurumu(u, simdi), b: borc(u, ctx.odemeler) }));
  const say = (s) => satirlar.filter((r) => (s === 'borclu' ? r.b > 0 : s === 'tumu' || r.d.durum === s)).length;

  el.innerHTML = `
  <section class="kutu uyeler">
    <header class="kutu-ust">
      <h2>Üyeler <span class="sayac">(${ctx.uyeler.length})</span></h2>
      <input type="search" class="girdi ara" placeholder="Ad ya da telefon ara" data-ara aria-label="Üye ara">
      <button type="button" class="btn btn-kucuk" data-csv>Excel'den aktar</button>
      <button type="button" class="btn btn-ana btn-kucuk" data-ekle>+ Üye ekle</button>
    </header>
    <div class="suzgecler" role="group" aria-label="Durum süzgeci">${SUZGEC.map(([s, ad]) => `
      <button type="button" data-s="${s}" aria-pressed="${ctx.durum.suzgec === s}">${ad} <span>${say(s)}</span></button>`).join('')}</div>
    <div class="tablo-sarici"><table class="uye-tablo">
      <thead><tr><th scope="col">Üye</th><th scope="col">Bitiş</th><th scope="col">Durum</th><th scope="col">Borç</th><th scope="col">Son geliş</th></tr></thead>
      <tbody data-govde></tbody></table></div>
  </section>`;

  const govde = el.querySelector('[data-govde]');
  const ara = el.querySelector('[data-ara]');
  ara.value = ctx.durum.arama;

  function listele() {
    const t = kucuk(ctx.durum.arama.trim());
    const s = ctx.durum.suzgec;
    const liste = satirlar
      .filter((r) => (s === 'tumu' ? true : s === 'borclu' ? r.b > 0 : r.d.durum === s))
      .filter((r) => !t || kucuk(r.u.ad).includes(t) || String(r.u.tel || '').replace(/\D/g, '').includes(t.replace(/\D/g, '') || '#'));
    govde.innerHTML = liste.map(({ u, d, b }) => `
      <tr data-uye="${k(u.id)}" tabindex="0">
        <td data-baslik="Üye"><b>${k(u.ad)}</b>${u.eksik ? ' <span class="cip cip-uyari">Bitiş eksik</span>' : ''}<small>${k(u.tel || '')}</small></td>
        <td data-baslik="Bitiş">${k(tarihTR(u.bitis))}</td>
        <td data-baslik="Durum"><span class="cip ${DURUM[d.durum].sinif}">${DURUM[d.durum].etiket}</span><small>${k(kalanMetni(d.kalanGun))}</small></td>
        <td data-baslik="Borç" class="${b ? 'borc' : ''}">${b ? k(tl(b)) : '—'}</td>
        <td data-baslik="Son geliş">${k(sonGelisMetni(u.sonGelis, simdi))}</td>
      </tr>`).join('') || `<tr><td colspan="5" class="bos">${ctx.uyeler.length ? 'Eşleşen üye yok.' : 'Henüz üye yok. "+ Üye ekle" ya da "Excel\'den aktar" ile başlayın.'}</td></tr>`;
  }

  ara.addEventListener('input', () => { ctx.durum.arama = ara.value; listele(); });
  el.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
    ctx.durum.suzgec = b.dataset.s;
    el.querySelectorAll('[data-s]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    listele();
  }));
  govde.addEventListener('click', (e) => { const tr = e.target.closest('[data-uye]'); if (tr) uyeKartiAc(ctx, tr.dataset.uye); });
  govde.addEventListener('keydown', (e) => { const tr = e.target.closest('[data-uye]'); if (tr && e.key === 'Enter') uyeKartiAc(ctx, tr.dataset.uye); });
  el.querySelector('[data-ekle]').addEventListener('click', () => yeniUyeFormu(ctx));
  el.querySelector('[data-csv]').addEventListener('click', () => csvAktarPenceresi(ctx));
  listele();
  return () => {};
}
