// Kasa: ay ay alınan ödemeler, yönteme göre toplam, muhasebeci için CSV.
import { k, tl, kisaTarih } from './ui.js';

const YONTEM = { nakit: 'Nakit', kart: 'Kart', iban: 'IBAN' };

function ayAraligi(kayma) {
  const d = new Date();
  const bas = new Date(d.getFullYear(), d.getMonth() + kayma, 1);
  const son = new Date(d.getFullYear(), d.getMonth() + kayma + 1, 1);
  return { bas: bas.getTime(), son: son.getTime(), ad: bas.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }) };
}

// Excel formül enjeksiyonuna karşı: = + - @ ile başlayan metin başına ' alır.
const csvHucre = (v) => {
  const s = typeof v === 'number' ? String(v) : String(v ?? '').replace(/^([=+\-@\t\r])/, "'$1");
  return `"${s.replace(/"/g, '""')}"`;
};

export function ac(el, ctx) {
  ctx.durum.kasaAy ??= 0;
  const { bas, son, ad } = ayAraligi(ctx.durum.kasaAy);
  const adlar = new Map(ctx.uyeler.map((u) => [u.id, u.ad]));
  const liste = ctx.odemeler.filter((o) => o.zaman >= bas && o.zaman < son).sort((a, b) => b.zaman - a.zaman);
  const toplam = liste.reduce((t, o) => t + o.tutar, 0);
  const yontemle = Object.keys(YONTEM).map((y) => [y, liste.filter((o) => o.yontem === y).reduce((t, o) => t + o.tutar, 0)]);

  el.innerHTML = `
  <section class="kutu">
    <header class="kutu-ust">
      <h2>Kasa · ${k(ad)}</h2>
      <button type="button" class="btn btn-kucuk" data-ay="-1">← Önceki ay</button>
      <button type="button" class="btn btn-kucuk" data-ay="1" ${ctx.durum.kasaAy >= 0 ? 'disabled' : ''}>Sonraki ay →</button>
      <button type="button" class="btn btn-kucuk" data-csv ${liste.length ? '' : 'disabled'}>CSV indir</button>
    </header>
    <div class="kpi kasa-kpi">
      <article class="kpi-kart kpi-iceride"><p class="etiket">Toplam</p><p class="sayi kpi-orta">${k(tl(toplam))}</p><p class="kpi-not">${liste.length} ödeme</p></article>
      ${yontemle.map(([y, t]) => `<article class="kpi-kart"><p class="etiket">${YONTEM[y]}</p><p class="sayi kpi-orta">${k(tl(t))}</p></article>`).join('')}
    </div>
    <div class="tablo-sarici"><table class="uye-tablo">
      <thead><tr><th scope="col">Tarih</th><th scope="col">Üye</th><th scope="col">Tutar</th><th scope="col">Yöntem</th><th scope="col">Not</th></tr></thead>
      <tbody>${liste.map((o) => `<tr><td data-baslik="Tarih">${k(kisaTarih(o.zaman))}</td><td data-baslik="Üye">${k(adlar.get(o.uyeId) || 'Silinmiş üye')}</td>
        <td data-baslik="Tutar"><b>${k(tl(o.tutar))}</b></td><td data-baslik="Yöntem">${YONTEM[o.yontem] || ''}</td><td data-baslik="Not">${k(o.not || '')}</td></tr>`).join('')
        || '<tr><td colspan="5" class="bos">Bu ay ödeme kaydı yok.</td></tr>'}</tbody></table></div>
  </section>`;

  el.querySelectorAll('[data-ay]').forEach((b) => b.addEventListener('click', () => { ctx.durum.kasaAy += Number(b.dataset.ay); ac(el, ctx); }));
  el.querySelector('[data-csv]').addEventListener('click', () => {
    const satirlar = [['Tarih', 'Üye', 'Tutar', 'Yöntem', 'Not'], ...liste.map((o) => [new Date(o.zaman).toLocaleDateString('tr-TR'), adlar.get(o.uyeId) || '', o.tutar, YONTEM[o.yontem] || '', o.not || ''])];
    const metin = `﻿${satirlar.map((r) => r.map(csvHucre).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([metin], { type: 'text/csv;charset=utf-8' }));
    Object.assign(document.createElement('a'), { href: url, download: `kasa-${ad.replace(/\s+/g, '-')}.csv` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  return () => {};
}
