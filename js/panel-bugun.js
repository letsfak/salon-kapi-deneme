// Bugün: hocanın ilk baktığı yer. Kim içeride, bugün kim geldi, kimin süresi bitiyor, kim kayıp.
import { hareketlerAralik } from './depo.js';
import { iceridekiler, bitiyorlar, gelmeyenler, uyeDurumu } from './kural.js';
import { borc } from './salon.js';
import { uyeKartiAc } from './uye-kart.js';
import { k, saatTR, basHarfler, kalanMetni, RED_ETIKET } from './ui.js';
import { gunOzeti } from './ozet.js';
import { MESAJ, waLinki } from './whatsapp.js';
import { MARKA } from './marka.js';

function ozetLinki(ctx, bugun, simdi) {
  const ozet = gunOzeti({ uyeler: ctx.uyeler, odemeler: ctx.odemeler, bugunHareket: bugun, simdi });
  const tarih = new Date(simdi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
  return waLinki(MARKA.telefon, MESAJ.gunOzeti(ctx.salon.ad, tarih, ozet));
}

const gunBasi = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function ac(el, ctx) {
  let iptal = false;
  (async () => {
    const simdi = Date.now();
    const bugun = await hareketlerAralik(gunBasi(), simdi + 1);
    if (iptal) return;
    const uyeMap = new Map(ctx.uyeler.map((u) => [u.id, u]));
    const iceride = [...iceridekiler(bugun, simdi).keys()].map((id) => uyeMap.get(id)).filter(Boolean);
    const gecisler = bugun.filter((h) => h.tip === 'giris' && h.sonuc === 'gecti').reverse();
    const redler = bugun.filter((h) => h.sonuc === 'red').reverse();
    const biten = bitiyorlar(ctx.uyeler, simdi);
    const kayip = gelmeyenler(ctx.uyeler, simdi);

    el.innerHTML = `
    <div class="kpi">
      <article class="kpi-kart kpi-iceride">
        <p class="etiket">İçeride şimdi</p><p class="sayi kpi-buyuk">${iceride.length}</p>
        <ul class="avatarlar">${iceride.slice(0, 14).map((u) => `<li title="${k(u.ad)}">${k(basHarfler(u.ad))}</li>`).join('')}</ul>
        <p class="kpi-not">Çıkış okutulmazsa 2 saat sonra çıkmış sayılır.</p>
      </article>
      <a class="kpi-kart kpi-link" href="#/panel/hatirlat"><p class="etiket">7 gün içinde biten / bitmiş</p><p class="sayi kpi-orta">${biten.length}</p><p class="kpi-not">Tek tıkla WhatsApp hatırlatması →</p></a>
      <article class="kpi-kart"><p class="etiket">Bugün gelen</p><p class="sayi kpi-orta">${new Set(gecisler.map((h) => h.uyeId)).size}</p></article>
      <a class="kpi-kart kpi-link" href="#/panel/hatirlat"><p class="etiket">10+ gündür gelmeyen</p><p class="sayi kpi-orta">${kayip.length}</p><p class="kpi-not">Kaybetmeden yaz →</p></a>
    </div>
    <div class="satir-islem ayri ozet-satir">
      <p class="kucuk-not">Kapanışta: günün sayıları ${k(MARKA.sahip)} için WhatsApp'ta hazır. Mesajda isim yok, yalnız sayılar.</p>
      <a class="btn btn-kucuk btn-koyu" href="${k(ozetLinki(ctx, bugun, simdi))}" target="_blank" rel="noopener">Günün özetini gönder</a>
    </div>
    <div class="panel-izgara">
      <section class="kutu"><header class="kutu-ust"><h2>Bugün gelenler</h2><span class="canli">Canlı</span></header>
        <ol class="hareket-liste">${gecisler.length ? gecisler.map((h) => {
          const u = uyeMap.get(h.uyeId);
          if (!u) return '';
          const d = uyeDurumu(u, simdi);
          const etiketler = [
            Number(h.uzunAra) > 0 ? `<span class="cip cip-uyari">${Number(h.uzunAra)} gün sonra geldi</span>` : '',
            d.durum === 'bitiyor' ? `<span class="cip cip-uyari">${k(kalanMetni(d.kalanGun))}</span>` : '',
            borc(u, ctx.odemeler) > 0 ? '<span class="cip cip-red">Borç</span>' : '',
          ].join('');
          return `<li><span class="sayi">${saatTR(h.zaman)}</span><button type="button" class="satir-ad" data-uye="${k(u.id)}">${k(u.ad)}</button><span class="etiketler">${etiketler}</span></li>`;
        }).join('') : '<li class="bos">Bugün henüz giriş yok. Kapı ekranı açık mı?</li>'}</ol>
      </section>
      <section class="kutu"><header class="kutu-ust"><h2>Kapıda engellenen</h2></header>
        <ol class="hareket-liste">${redler.length ? redler.map((h) => `
          <li class="red"><span class="sayi">${saatTR(h.zaman)}</span><button type="button" class="satir-ad" data-uye="${k(h.uyeId || '')}">${k(uyeMap.get(h.uyeId)?.ad || 'Bilinmeyen')}</button>
          <span class="cip cip-red">${k(RED_ETIKET[h.sebep] || 'Red')}</span></li>`).join('') : '<li class="bos">Bugün engellenen yok.</li>'}</ol>
      </section>
    </div>`;
    el.querySelectorAll('[data-uye]').forEach((b) => b.addEventListener('click', () => b.dataset.uye && uyeKartiAc(ctx, b.dataset.uye)));
  })();
  return () => { iptal = true; };
}
