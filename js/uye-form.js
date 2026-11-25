// Üye formları (pencere): yeni üye, uzat, ödeme, düzenle (takım ligi dahil), davet linki.
import { uyeKaydet, odemeKaydet, uyeGetir, uyeleriGetir } from './depo.js';
import { yeniUye, uzat, odemeEkle, bilgiGuncelle, borc } from './salon.js';
import { ligdeMi, ligSecimi, ligUygula, takimlar, TAKIM_EN_FAZLA, TAKMA_AD_UZUNLUK, TAKIM_AD_UZUNLUK } from './lig.js';
import { bugunISO, gercekTarih } from './tarih.js';
import { davetLinkiUret } from './veri.js';
import { waLinki, MESAJ } from './whatsapp.js';
import { k, tl, tarihTR, qrSvg, pencereAc, bildir, tabanAdres } from './ui.js';
import { MARKA } from './marka.js';

const sayi = (v) => Math.max(0, Math.round(Number(String(v ?? '').replace(/[^\d]/g, '')) || 0));
const paketSecenekleri = (salon, secili = 1) => salon.paketler
  .map((p) => ({ ay: sayi(p.ay), ucret: sayi(p.ucret) }))
  .map((p) => `<option value="${p.ay}" data-ucret="${p.ucret}" ${p.ay === secili ? 'selected' : ''}>${p.ay} ay${p.ucret ? ` · ${k(tl(p.ucret))}` : ''}</option>`).join('');

/** Gönderimi bir kez çalıştırır: çift tıklama ya da çift Enter ikinci kaydı yazmasın. Hata olursa düğme geri açılır. */
function tekGonderim(form, isle) {
  let calisiyor = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (calisiyor) return;
    calisiyor = true;
    const dugme = form.querySelector('[type="submit"]');
    if (dugme) dugme.disabled = true;
    const ac = () => { calisiyor = false; if (dugme) dugme.disabled = false; };
    try {
      if ((await isle(new FormData(form))) === false) ac();
    } catch (hata) {
      ac();
      bildir(`Kaydedilemedi: ${hata.message}`, { hata: true });
    }
  });
}

/** Form açıkken kapıdan geçiş olmuş olabilir: işlemi her zaman veritabanındaki güncel kayıt üzerinde yap. */
const taze = async (uye) => (await uyeGetir(uye.id)) || null;

const ODEME_ALANI = `
  <fieldset class="alan-grup"><legend>Şimdi alınan ödeme (yoksa boş bırakın)</legend>
    <div class="form-izgara">
      <div class="alan"><label>Tutar (TL)</label><input name="odenen" class="girdi" inputmode="numeric" maxlength="7"></div>
      <div class="alan"><label>Yöntem</label><select name="yontem" class="girdi"><option value="nakit">Nakit</option><option value="kart">Kart</option><option value="iban">IBAN</option></select></div>
    </div>
  </fieldset>`;

function paketUcretiBagla(d) {
  const sec = d.querySelector('[name="paket"]');
  const ucret = d.querySelector('[name="ucret"]');
  const doldur = () => { const u = sec.selectedOptions[0]?.dataset.ucret; if (u && u !== '0') ucret.value = u; };
  sec.addEventListener('change', doldur);
  doldur();
}

async function odemeVarsaKaydet(f, uye) {
  const tutar = sayi(f.get('odenen'));
  if (tutar > 0) await odemeKaydet(odemeEkle(uye, { tutar, yontem: f.get('yontem') }));
}

export function yeniUyeFormu(ctx) {
  pencereAc(`
    <div><p class="etiket">Yeni üye</p><h2>Üye ekle</h2></div>
    <form class="form-yigin" data-form novalidate>
      <div class="alan"><label for="u-ad">Ad soyad</label><input id="u-ad" name="ad" class="girdi" required maxlength="60" autocomplete="off"></div>
      <div class="alan"><label for="u-tel">Cep telefonu (davet WhatsApp'tan buna gider)</label><input id="u-tel" name="tel" class="girdi" inputmode="tel" maxlength="20" autocomplete="off" placeholder="05xx xxx xx xx"></div>
      <div class="form-izgara">
        <div class="alan"><label>Paket</label><select name="paket" class="girdi">${paketSecenekleri(ctx.salon, 1)}</select></div>
        <div class="alan"><label>Başlangıç</label><input name="baslangic" type="date" class="girdi" value="${bugunISO()}"></div>
        <div class="alan"><label>Paket ücreti (TL)</label><input name="ucret" class="girdi" inputmode="numeric" maxlength="7"></div>
      </div>
      ${ODEME_ALANI}
      <p class="form-hata" data-hata role="alert"></p>
      <div class="satir-islem"><button class="btn btn-ana" type="submit">Kaydet ve kartı gönder</button><button class="btn" type="button" data-kapat>Vazgeç</button></div>
    </form>`, (d, kapat) => {
    paketUcretiBagla(d);
    d.querySelector('#u-ad').focus();
    tekGonderim(d.querySelector('[data-form]'), async (f) => {
      const ad = String(f.get('ad') || '').trim();
      const baslangic = String(f.get('baslangic') || '');
      if (ad.length < 2) { d.querySelector('[data-hata]').textContent = 'Ad soyad yazın.'; return false; }
      if (!gercekTarih(baslangic)) { d.querySelector('[data-hata]').textContent = 'Başlangıç tarihi geçersiz.'; return false; }
      const uye = yeniUye({ ad, tel: f.get('tel'), paketAy: Number(f.get('paket')) || 1, baslangic, ucret: sayi(f.get('ucret')) }, ctx.uyeler);
      await uyeKaydet(uye);
      await odemeVarsaKaydet(f, uye);
      kapat();
      await ctx.yenile();
      davetPenceresi(ctx, uye);
      return true;
    });
  });
}

export function uzatFormu(ctx, uye, sonra) {
  pencereAc(`
    <div><p class="etiket">${k(uye.ad)}</p><h2>Üyeliği uzat</h2><p class="aciklama">Şu anki bitiş: ${k(tarihTR(uye.bitis))}. Süre bitmediyse yeni dönem bitişten, bittiyse bugünden başlar.</p></div>
    <form class="form-yigin" data-form>
      <div class="form-izgara">
        <div class="alan"><label>Paket</label><select name="paket" class="girdi">${paketSecenekleri(ctx.salon, uye.donem?.paketAy || 1)}</select></div>
        <div class="alan"><label>Paket ücreti (TL)</label><input name="ucret" class="girdi" inputmode="numeric" maxlength="7"></div>
      </div>
      ${ODEME_ALANI}
      <div class="satir-islem"><button class="btn btn-ana" type="submit">Uzat</button><button class="btn" type="button" data-kapat>Vazgeç</button></div>
    </form>`, (d, kapat) => {
    paketUcretiBagla(d);
    tekGonderim(d.querySelector('[data-form]'), async (f) => {
      const guncel = await taze(uye);
      if (!guncel) { kapat(); bildir('Üye artık kayıtlı değil', { hata: true }); return true; }
      const yeni = uzat(guncel, { paketAy: Number(f.get('paket')) || 1, ucret: sayi(f.get('ucret')), devreden: borc(guncel, ctx.odemeler) });
      await uyeKaydet(yeni);
      await odemeVarsaKaydet(f, yeni);
      kapat();
      bildir(`Yeni bitiş: ${tarihTR(yeni.bitis)}${yeni.donem.devreden ? ` · önceki dönemden ${tl(yeni.donem.devreden)} borç devretti` : ''}`);
      await ctx.yenile();
      sonra?.(yeni);
      return true;
    });
  });
}

export function odemeFormu(ctx, uye, sonra) {
  const kalan = borc(uye, ctx.odemeler);
  pencereAc(`
    <div><p class="etiket">${k(uye.ad)}</p><h2>Ödeme al</h2><p class="aciklama">Bu dönemin kalan borcu: <b>${k(tl(kalan))}</b></p></div>
    <form class="form-yigin" data-form>
      <div class="form-izgara">
        <div class="alan"><label>Tutar (TL)</label><input name="odenen" class="girdi" inputmode="numeric" maxlength="7" value="${kalan || ''}" required></div>
        <div class="alan"><label>Yöntem</label><select name="yontem" class="girdi"><option value="nakit">Nakit</option><option value="kart">Kart</option><option value="iban">IBAN</option></select></div>
      </div>
      <div class="alan"><label>Not (isteğe bağlı)</label><input name="not" class="girdi" maxlength="120"></div>
      <div class="satir-islem"><button class="btn btn-ana" type="submit">Ödemeyi kaydet</button><button class="btn" type="button" data-kapat>Vazgeç</button></div>
    </form>`, (d, kapat) => {
    tekGonderim(d.querySelector('[data-form]'), async (f) => {
      const tutar = sayi(f.get('odenen'));
      if (!tutar) return false;
      const guncel = await taze(uye);
      if (!guncel) { kapat(); bildir('Üye artık kayıtlı değil', { hata: true }); return true; }
      await odemeKaydet(odemeEkle(guncel, { tutar, yontem: f.get('yontem'), not: f.get('not') }));
      kapat();
      bildir(`${tl(tutar)} kaydedildi`);
      await ctx.yenile();
      sonra?.();
      return true;
    });
  });
}

/** Takım ligi alanı: isteğe bağlı, yalnız üye isterse işaretlenir. Takım yazılır ya da mevcutlardan seçilir. */
const ligAlani = (uyeler) => `
  <fieldset class="alan-grup"><legend>Takım ligi (isteğe bağlı)</legend>
    <label class="onay"><input type="checkbox" name="ligKatil"> Lige katıl</label>
    <p class="kucuk-not">Yalnız üye isterse işaretleyin. Takma ad, takım ve geliş günleri ligde kullanılır; işaret kaldırılınca lig bilgisi silinir.</p>
    <div class="form-izgara" data-lig-alanlar>
      <div class="alan"><label for="l-ad">Takma ad</label><input id="l-ad" name="ligAd" class="girdi" maxlength="${TAKMA_AD_UZUNLUK}" autocomplete="off"></div>
      <div class="alan"><label for="l-takim">Takım (yazın ya da seçin)</label><input id="l-takim" name="ligTakim" class="girdi" maxlength="${TAKIM_AD_UZUNLUK}" list="l-takimlar" autocomplete="off">
        <datalist id="l-takimlar">${takimlar(uyeler).map((t) => `<option value="${k(t.ad)}">${t.uyeler.length}/${TAKIM_EN_FAZLA} kişi</option>`).join('')}</datalist></div>
    </div>
  </fieldset>`;

function ligAlaniBagla(form, uye) {
  form.ligKatil.checked = ligdeMi(uye);
  form.ligAd.value = uye.lig?.ad || '';
  form.ligTakim.value = uye.lig?.takim || '';
  const alanlar = form.querySelector('[data-lig-alanlar]');
  const goster = () => { alanlar.hidden = !form.ligKatil.checked; };
  form.ligKatil.addEventListener('change', goster);
  goster();
}

export function duzenleFormu(ctx, uye, sonra) {
  pencereAc(`
    <div><p class="etiket">${k(uye.id)}</p><h2>Bilgileri düzenle</h2></div>
    <form class="form-yigin" data-form>
      <div class="alan"><label>Ad soyad</label><input name="ad" class="girdi" maxlength="60" required></div>
      <div class="alan"><label>Cep telefonu</label><input name="tel" class="girdi" inputmode="tel" maxlength="20"></div>
      <div class="alan"><label>Bitiş tarihi (düzeltme için)</label><input name="bitis" type="date" class="girdi"></div>
      ${ligAlani(ctx.uyeler)}
      <p class="form-hata" data-hata role="alert"></p>
      <div class="satir-islem"><button class="btn btn-ana" type="submit">Kaydet</button><button class="btn" type="button" data-kapat>Vazgeç</button></div>
    </form>`, (d, kapat) => {
    const form = d.querySelector('[data-form]');
    form.ad.value = uye.ad;
    form.tel.value = uye.tel || '';
    form.bitis.value = uye.bitis;
    ligAlaniBagla(form, uye);
    tekGonderim(form, async () => {
      const guncel = await taze(uye);
      if (!guncel) { kapat(); bildir('Üye artık kayıtlı değil', { hata: true }); return true; }
      // Takım doluluğu formun açıldığı andaki listeyle değil, veritabanının güncel hâliyle denetlenir.
      const secim = ligSecimi({ katil: form.ligKatil.checked, ad: form.ligAd.value, takim: form.ligTakim.value }, guncel, await uyeleriGetir());
      if (secim.hata) { d.querySelector('[data-hata]').textContent = secim.hata; return false; }
      const bitis = gercekTarih(form.bitis.value) ? form.bitis.value : guncel.bitis;
      const yeni = ligUygula({ ...bilgiGuncelle(guncel, { ad: form.ad.value, tel: form.tel.value }), bitis, eksik: false }, secim.lig);
      await uyeKaydet(yeni);
      kapat();
      await ctx.yenile();
      sonra?.(yeni);
      return true;
    });
  });
}

/** Üyenin kartı: ekranda QR (resepsiyonda telefonla okutulur) ve WhatsApp'tan gönderme. */
export async function davetPenceresi(ctx, uye) {
  const link = await davetLinkiUret(ctx.salon, uye);
  const wa = waLinki(uye.tel, MESAJ.davet(uye, ctx.salon.ad, link, `${tabanAdres()}${MARKA.aydinlatma}`));
  // KVKK kanıtı: kart (içinde aydınlatma metni bağlantısı olan) bu tarihte üyeye verildi.
  const guncel = await uyeGetir(uye.id);
  if (guncel) await uyeKaydet({ ...guncel, aydinlatma: Date.now() });
  pencereAc(`
    <div><p class="etiket">Üyenin giriş kartı</p><h2>${k(uye.ad)}</h2></div>
    <div class="davet-izgara">
      <div class="diyalog-qr">${qrSvg(link, { ecc: 'L', hucre: 4, baslik: 'Üye kartı bağlantısı' })}</div>
      <ol class="adimlar">
        <li><b>Burada:</b> üye telefonunun kamerasıyla bu QR'ı okutsun.</li>
        <li><b>Ya da:</b> WhatsApp'tan gönderin${uye.tel ? '' : ' (telefon numarası kayıtlı değil, kişiyi siz seçersiniz)'}.</li>
        <li>Açılan sayfada <b>Ana ekrana ekle</b>. Sonraki gelişlerde uygulamayı açıp QR'ı gösterir.</li>
      </ol>
    </div>
    <p class="kucuk-not">Bu link üyenin kişisel kartıdır; başkasına iletilmemeli. Telefon değişirse üye kartından "Telefonu yenile" yapın.</p>
    <div class="satir-islem">
      <a class="btn btn-ana" href="${k(wa)}" target="_blank" rel="noopener">WhatsApp'tan gönder</a>
      <button type="button" class="btn" data-kopyala>Linki kopyala</button>
      <button type="button" class="btn btn-koyu" data-kapat>Kapat</button>
    </div>`, (d) => {
    d.querySelector('[data-kopyala]').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); bildir('Link kopyalandı'); } catch { bildir('Kopyalanamadı', { hata: true }); }
    });
  });
}
