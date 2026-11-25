// Lig: takımların haftalık sırası. Puanın kanıtı kapı kaydıdır; bu sekme yalnız okur, hiçbir şey yazmaz.
import { hareketlerAralik } from './depo.js';
import { haftaAraligi, haftaTablosu, ligMesaji, ligdeMi, PUAN_GUN, TAKIM_EN_AZ, TAKIM_EN_FAZLA } from './lig.js';
import { k, bildir } from './ui.js';

const HAFTALAR = [[0, 'Bu hafta'], [-1, 'Geçen hafta']];
const gunAy = (ms) => new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
const aralikMetni = (t) => `${gunAy(t.bas)} - ${gunAy(t.son - 1)}`;

const BOS = `
  <section class="kutu">
    <header class="kutu-ust"><h2>Takım ligi</h2></header>
    <p class="aciklama">Üyeler ${TAKIM_EN_AZ} ile ${TAKIM_EN_FAZLA} kişilik takımlar kurar; salona QR'la gelinen her gün takıma ${PUAN_GUN} puan kazandırır ve takımlar haftalık sıralamada yarışır.</p>
    <p class="aciklama">Üyeyi eklemek için Üyeler sekmesinde üyeyi açın, Düzenle'ye basın, "Lige katıl"ı işaretleyip takma ad ve takım yazın.</p>
  </section>`;

const kabuk = (secili) => `
  <section class="kutu">
    <header class="kutu-ust">
      <h2>Takım ligi <span class="sayac" data-aralik></span></h2>
      <div class="suzgecler" role="group" aria-label="Hafta">${HAFTALAR.map(([kayma, ad]) => `
        <button type="button" data-hafta="${kayma}" aria-pressed="${secili === kayma}">${ad}</button>`).join('')}</div>
      <button type="button" class="btn btn-kucuk btn-koyu" data-kopyala disabled>Mesajı kopyala</button>
    </header>
    <p class="kucuk-not">Salona gelinen her gün ${PUAN_GUN} puan, günde bir kez. Takım puanı üye başına ortalamadır; o hafta hiç gelmeyen üye de sayılır. Üyenin lige katıldığı günden önceki gelişleri sayılmaz.
      Pazartesi geçen haftanın mesajını kopyalayıp WhatsApp grubuna yapıştırın: mesajda yalnız takım adları ve puanlar var.</p>
    <div class="lig-govde" data-lig-govde></div>
  </section>`;

function takimGovdesi(t) {
  const sira = t.sira ? `<span class="sayi lig-sira-no">${t.sira}</span>` : '<span class="cip cip-notr">Eksik</span>';
  return `<tbody${t.sira === 1 ? ' class="lig-lider"' : ''}>
    <tr class="lig-takim-satir">
      <td class="lig-sira">${sira}</td>
      <th scope="row">${k(t.ad)}</th>
      <td data-baslik="Üye">${t.uyeler.length}</td>
      <td data-baslik="Ortalama puan"><b class="sayi lig-puan">${Math.round(t.ortalama)}</b></td>
      <td data-baslik="Toplam gün">${t.toplamGun}</td>
    </tr>
    <tr class="lig-uye-satir"><td></td><td colspan="4"><ul class="lig-uyeler" aria-label="${k(t.ad)} üyeleri">${t.uyeler.map((u) => `
      <li>${k(u.takmaAd)} <span>${u.gun} gün</span></li>`).join('')}</ul></td></tr>
  </tbody>`;
}

const tabloHtml = (liste, baslik) => `<div class="tablo-sarici"><table class="uye-tablo lig-tablo">
  <caption class="sr">${k(baslik)}</caption>
  <thead><tr><th scope="col">Sıra</th><th scope="col">Takım</th><th scope="col">Üye</th><th scope="col">Ortalama puan</th><th scope="col">Toplam gün</th></tr></thead>
  ${liste.map(takimGovdesi).join('')}
</table></div>`;

function govdeHtml(tablo) {
  const aralik = aralikMetni(tablo);
  const siralama = tablo.siralama.length
    ? tabloHtml(tablo.siralama, `Takım sıralaması, ${aralik}`)
    : `<p class="bos">Sıraya giren takım yok. Takımın sıraya girmesi için en az ${TAKIM_EN_AZ} lig üyesi gerekir.</p>`;
  const eksik = tablo.eksikler.length ? `
    <section class="lig-eksik"><h3>Tamamlanmamış takımlar</h3>
      <p class="kucuk-not">En az ${TAKIM_EN_AZ} lig üyesi olunca sıraya girer.</p>
      ${tabloHtml(tablo.eksikler, `Tamamlanmamış takımlar, ${aralik}`)}</section>` : '';
  return siralama + eksik;
}

export function ac(el, ctx) {
  if (!ctx.uyeler.some(ligdeMi)) { el.innerHTML = BOS; return () => {}; }
  ctx.durum.ligHafta ??= 0;
  el.innerHTML = kabuk(ctx.durum.ligHafta);
  const kopyala = el.querySelector('[data-kopyala]');
  let tablo = null;
  let cizimNo = 0;
  let kapandi = false;

  async function ciz() {
    const benim = ++cizimNo;
    const { bas, son } = haftaAraligi(Date.now(), ctx.durum.ligHafta);
    const hareketler = await hareketlerAralik(bas, son - 1);
    if (kapandi || benim !== cizimNo) return;
    tablo = haftaTablosu(ctx.uyeler, hareketler, bas);
    el.querySelector('[data-aralik]').textContent = `· ${aralikMetni(tablo)}`;
    el.querySelector('[data-lig-govde]').innerHTML = govdeHtml(tablo);
    kopyala.disabled = tablo.siralama.length === 0;
  }
  const cizHatasi = (hata) => bildir(`Lig okunamadı: ${hata.message}`, { hata: true });

  el.querySelectorAll('[data-hafta]').forEach((b) => b.addEventListener('click', () => {
    ctx.durum.ligHafta = Number(b.dataset.hafta);
    el.querySelectorAll('[data-hafta]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    ciz().catch(cizHatasi);
  }));
  kopyala.addEventListener('click', async () => {
    if (!tablo) return;
    try {
      await navigator.clipboard.writeText(ligMesaji(tablo, ctx.salon.ad));
      bildir('Mesaj kopyalandı. WhatsApp grubuna yapıştırın.');
    } catch { bildir('Kopyalanamadı', { hata: true }); }
  });
  ciz().catch(cizHatasi);
  return () => { kapandi = true; };
}
