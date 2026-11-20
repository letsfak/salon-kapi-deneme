// Excel'den üye aktarımı (CSV). Önce önizleme: kaç üye gelecek, hangi satırlar hatalı; sonra onayla aktar.
import { uyelerKaydet } from './depo.js';
import { metniCoz, uyeSatirlari } from './csv.js';
import { yeniUye, ayEkle } from './salon.js';
import { bugunISO } from './tarih.js';
import { k, tarihTR, pencereAc, bildir } from './ui.js';

const EN_BUYUK_DOSYA = 2 * 1024 * 1024;
const anahtar = (ad, tel) => `${String(ad).toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim()}|${String(tel || '').replace(/\D/g, '').slice(-10)}`;

export function csvAktarPenceresi(ctx) {
  pencereAc(`
    <div><p class="etiket">Üye listesini aktar</p><h2>Excel'den aktar</h2>
      <p class="aciklama">Excel'de <b>Dosya → Farklı Kaydet → CSV (virgülle ayrılmış)</b> seçin. İlk satırda başlıklar olsun: <b>Ad Soyad</b>, <b>Telefon</b>, <b>Bitiş Tarihi</b> (ya da <b>Paket</b>).</p></div>
    <input type="file" accept=".csv,text/csv" class="girdi" data-dosya>
    <div data-onizleme></div>
    <div class="satir-islem"><button type="button" class="btn btn-ana" data-aktar disabled>Aktar</button><button type="button" class="btn" data-kapat>Vazgeç</button></div>`, (d, kapat) => {
    let hazir = [];
    const onizleme = d.querySelector('[data-onizleme]');
    const aktar = d.querySelector('[data-aktar]');

    d.querySelector('[data-dosya]').addEventListener('change', async (e) => {
      const dosya = e.target.files?.[0];
      hazir = [];
      aktar.disabled = true;
      if (!dosya) return;
      if (dosya.size > EN_BUYUK_DOSYA) { onizleme.innerHTML = '<p class="form-hata">Dosya çok büyük (en fazla 2 MB).</p>'; return; }
      const r = uyeSatirlari(metniCoz(new Uint8Array(await dosya.arrayBuffer())));
      if (r.genelHata) { onizleme.innerHTML = `<p class="form-hata">${k(r.genelHata)}</p>`; return; }
      const mevcut = new Set(ctx.uyeler.map((u) => anahtar(u.ad, u.tel)));
      const tekrar = r.uyeler.filter((u) => mevcut.has(anahtar(u.ad, u.tel)));
      hazir = r.uyeler.filter((u) => !mevcut.has(anahtar(u.ad, u.tel)));
      const eksik = hazir.filter((u) => !u.bitis && !u.paketAy).length;
      onizleme.innerHTML = `
        <p class="aciklama"><b>${hazir.length}</b> üye aktarılacak.${tekrar.length ? ` ${tekrar.length} üye zaten kayıtlı, atlanacak.` : ''}${eksik ? ` <b>${eksik}</b> üyenin bitiş tarihi yok: bugün bitmiş sayılır, sonra düzeltin.` : ''}</p>
        ${r.hatalar.length ? `<details open><summary>${r.hatalar.length} satır okunamadı</summary><ul class="mini-liste">${r.hatalar.slice(0, 20).map((h) => `<li><span>Satır ${h.satir}</span><span>${k(h.sebep)}</span></li>`).join('')}</ul></details>` : ''}
        <div class="tablo-sarici"><table class="uye-tablo"><thead><tr><th>Ad</th><th>Telefon</th><th>Bitiş</th></tr></thead><tbody>
        ${hazir.slice(0, 8).map((u) => `<tr><td>${k(u.ad)}</td><td>${k(u.tel)}</td><td>${u.bitis ? k(tarihTR(u.bitis)) : u.paketAy ? `${u.paketAy} ay (bugünden)` : '<span class="cip cip-uyari">yok</span>'}</td></tr>`).join('')}
        </tbody></table></div>${hazir.length > 8 ? `<p class="kucuk-not">… ve ${hazir.length - 8} üye daha.</p>` : ''}`;
      aktar.disabled = hazir.length === 0;
    });

    aktar.addEventListener('click', async () => {
      aktar.disabled = true;
      const bugun = bugunISO();
      const eklenen = hazir.reduce((liste, satir) => {
        const bitis = satir.bitis || (satir.paketAy ? ayEkle(bugun, satir.paketAy) : bugun);
        const uye = yeniUye({ ad: satir.ad, tel: satir.tel, paketAy: satir.paketAy, baslangic: bugun, ucret: 0, bitis }, [...ctx.uyeler, ...liste]);
        return [...liste, { ...uye, eksik: !satir.bitis && !satir.paketAy }];
      }, []);
      try {
        await uyelerKaydet(eklenen);
        kapat();
        bildir(`${eklenen.length} üye aktarıldı`);
        await ctx.yenile();
      } catch (hata) {
        aktar.disabled = false;
        bildir(`Aktarılamadı: ${hata.message}`, { hata: true });
      }
    });
  });
}
