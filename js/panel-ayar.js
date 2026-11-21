// Ayarlar: salon, paket ücretleri, borç kuralı, PIN, yedek, röle komutları.
import { ayarOku, ayarYaz, uyeSil } from './depo.js';
import { silinecekUyeler } from './kural.js';
import { MARKA } from './marka.js';
import { pinGecerliMi, pinDogrula, pinTuret } from './pin.js';
import {
  klasorDestekli, yedekKlasoruSec, yedekDurumu, gunlukYedekAl, yedekIndir, yedektenYukle, yedekIzniVer, usbYedekAl, usbYedekSon,
} from './yedek.js';
import { VARSAYILAN_ROLE, hexBayt } from './role.js';
import { csvAktarPenceresi } from './csv-aktar.js';
import { laptopBetigi, tarayiciTuru, betikIndir } from './laptop.js';
import { k, tarihTR, bildir, tabanAdres } from './ui.js';

const LAPTOP_LISTESI = `
  <ol class="adimlar">
    <li>Kurulum ve her gün kullanım <b>hep bu tarayıcıda ve aynı profilde</b> olsun. Başka tarayıcıda açılan sayfa boş kurulum ekranı gösterir.</li>
    <li>"Hazırlama dosyasını indir"e basın, inen dosyayı çalıştırın. Uyarı çıkarsa <b>Ek bilgi → Yine de çalıştır</b>.</li>
    <li>Windows Ayarlar → Windows Update → Gelişmiş seçenekler → <b>Etkin saatler</b>: salonun açık olduğu saatler. Güncelleme yeniden başlatması gece olur.</li>
    <li>Kapı ekranında bir kez <b>Röleyi bağla</b>. Okuyucu COM modundaysa <b>Okuyucuyu bağla</b>. Sonra tarayıcı hatırlar.</li>
    <li>Okuyucu klavye gibi yazar: kapı ekranı ya da panel öndeyken sorun yok, panel okutulanı kapıya iletir. <b>Başka programda</b> (WhatsApp, Excel) yazı yazılırken okutulan QR o programa gider. Okuyucunun kılavuzunda "USB COM / Virtual COM" ayar barkodu varsa okutun; o zaman hangi pencere önde olursa olsun kapı okur.</li>
    <li>Yedek: klasör seçin, haftada bir USB belleğe yedek alın. Bellek kilitli bir yerde dursun (yedekte salonun gizli anahtarı var).</li>
    <li>Deneme: laptopu yeniden başlatın, kapı ekranı kendiliğinden açılmalı; bir üye QR okutsun.</li>
    <li>İlk haftalarda eski kart okuyucu çalışır kalsın.</li>
  </ol>`;

const sayi = (v) => Math.max(0, Math.round(Number(String(v ?? '').replace(/[^\d]/g, '')) || 0));

export function ac(el, ctx) {
  const s = ctx.salon;
  let iptal = false;
  el.innerHTML = `
  <div class="ayar-izgara">
    <form class="kutu form-yigin" data-salon>
      <h2>Salon</h2>
      <div class="alan"><label>Salonun adı</label><input name="ad" class="girdi" maxlength="40" required></div>
      <fieldset class="alan-grup"><legend>Paket ücretleri (TL)</legend><div class="form-izgara dortlu">
        ${s.paketler.map((p) => ({ ay: sayi(p.ay), ucret: sayi(p.ucret) })).map((p) => `<div class="alan"><label>${p.ay} ay</label><input name="p${p.ay}" class="girdi" inputmode="numeric" maxlength="7" value="${p.ucret || ''}"></div>`).join('')}
      </div></fieldset>
      <label class="onay"><input type="checkbox" name="engel" ${s.borcluyuEngelle ? 'checked' : ''}> Borcu olan üye kapıdan geçemesin</label>
      <button class="btn btn-ana" type="submit">Kaydet</button>
    </form>

    <section class="kutu form-yigin">
      <h2>Yedek</h2>
      <p class="aciklama" data-yedek-durum>…</p>
      <div class="satir-islem">
        ${klasorDestekli() ? '<button type="button" class="btn" data-klasor>Yedek klasörü seç</button>' : ''}
        <button type="button" class="btn" data-simdi>Şimdi yedekle</button>
        <button type="button" class="btn" data-indir>Yedeği indir</button>
      </div>
      <div class="satir-islem ayri"><p class="aciklama" data-usb-durum></p>
        <button type="button" class="btn btn-koyu" data-usb>USB belleğe yedek al</button></div>
      <details><summary>Yedekten geri yükle</summary>
        <p class="aciklama">Bu bilgisayardaki tüm veri, seçtiğiniz yedekteki haliyle değişir.</p>
        <input type="file" accept="application/json,.json" class="girdi" data-yukle></details>
      <p class="kucuk-not">Yedek dosyası salonun gizli anahtarını içerir. Laptopta ya da USB bellekte durmalı, kimseyle paylaşılmamalı.</p>
    </section>

    <section class="kutu form-yigin">
      <h2>Bu laptop</h2>
      <p class="aciklama">Laptop açılınca kapı ekranı kendiliğinden gelsin, laptop uyumasın. Salonda bir kez yapılır.</p>
      <div class="satir-islem"><button type="button" class="btn btn-ana" data-laptop>Hazırlama dosyasını indir</button></div>
      <p class="kucuk-not" data-laptop-not></p>
      <details><summary>Salonda yapılacaklar (sırayla)</summary>${LAPTOP_LISTESI}</details>
    </section>

    <section class="kutu form-yigin">
      <h2>Kişisel veriler (KVKK)</h2>
      <p class="aciklama">Üyelere giden kart linkinde aydınlatma metni de vardır. Resepsiyona basılı bir kopyasını asın.</p>
      <div class="satir-islem"><a class="btn" href="${k(MARKA.aydinlatma)}" target="_blank" rel="noopener">Aydınlatma metnini aç / yazdır</a></div>
      <p class="aciklama" data-saklama></p>
      <button type="button" class="btn" data-saklama-sil hidden>Saklama süresi dolanları sil</button>
      <p class="kucuk-not">Kapı kayıtları 12 ay sonra kendiliğinden silinir. Üyeliği bittikten 2 yıl sonra üyenin kaydı silinmelidir.</p>
    </section>

    <section class="kutu form-yigin">
      <h2>Üye listesi</h2>
      <p class="aciklama">Defter ya da Excel'deki üyeleri tek seferde almak için.</p>
      <button type="button" class="btn" data-csv>Excel'den aktar</button>
    </section>

    <form class="kutu form-yigin" data-pin>
      <h2>PIN değiştir</h2>
      <div class="form-izgara">
        <div class="alan"><label>Şimdiki PIN</label><input name="eski" type="password" inputmode="numeric" maxlength="8" class="girdi" autocomplete="current-password"></div>
        <div class="alan"><label>Yeni PIN</label><input name="yeni" type="password" inputmode="numeric" maxlength="8" class="girdi" autocomplete="new-password"></div>
        <div class="alan"><label>Yeni PIN tekrar</label><input name="yeni2" type="password" inputmode="numeric" maxlength="8" class="girdi" autocomplete="new-password"></div>
      </div>
      <button class="btn" type="submit">PIN'i değiştir</button>
    </form>

    <details class="kutu form-yigin">
      <summary><b>Röle ayarları (gelişmiş)</b></summary>
      <form class="form-yigin" data-role>
        <p class="aciklama">USB röle farklı komut isterse buradan değiştirilir. Bilmiyorsanız dokunmayın.</p>
        <div class="form-izgara">
          <div class="alan"><label>Hız (baud)</label><input name="baudRate" class="girdi" inputmode="numeric"></div>
          <div class="alan"><label>Açık kalma (ms)</label><input name="sureMs" class="girdi" inputmode="numeric"></div>
          <div class="alan"><label>Aç komutu (hex)</label><input name="ac" class="girdi"></div>
          <div class="alan"><label>Kapat komutu (hex)</label><input name="kapat" class="girdi"></div>
        </div>
        <button class="btn" type="submit">Kaydet</button>
      </form>
    </details>
  </div>`;

  const salonForm = el.querySelector('[data-salon]');
  salonForm.ad.value = s.ad;
  salonForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(salonForm);
    const ad = String(f.get('ad') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (ad.length < 2) return;
    await ayarYaz('salon', { ...s, ad, borcluyuEngelle: f.get('engel') === 'on', paketler: s.paketler.map((p) => ({ ...p, ucret: sayi(f.get(`p${p.ay}`)) })) });
    bildir('Kaydedildi');
    ctx.yenile();
  });

  async function yedekYaz() {
    const d = await yedekDurumu();
    if (iptal) return;
    const yer = el.querySelector('[data-yedek-durum]');
    yer.innerHTML = d.durum === 'yok'
      ? '<b>Otomatik yedek kurulmadı.</b> Bir klasör seçin (örn. Belgeler\\SalonKapı); panel her gün açıldığında oraya yedek alır, son 30 günü saklar.'
      : `Klasör: <b>${k(d.klasor)}</b> · Son yedek: <b>${d.son ? k(tarihTR(d.son)) : 'henüz yok'}</b>${d.durum === 'izin-gerek' ? ' · <b>izin gerekiyor</b> ("Şimdi yedekle"ye basın)' : ''}`;
  }

  el.querySelector('[data-klasor]')?.addEventListener('click', async () => {
    try { const ad = await yedekKlasoruSec(); await gunlukYedekAl({ zorla: true }); bildir(`Yedek klasörü: ${ad}`); yedekYaz(); } catch (h) { if (h.name !== 'AbortError') bildir(h.message, { hata: true }); }
  });
  el.querySelector('[data-simdi]').addEventListener('click', async () => {
    try {
      if ((await yedekDurumu()).durum === 'yok') { await yedekIndir(); return; }
      if (!(await yedekIzniVer())) { bildir('Klasör izni verilmedi', { hata: true }); return; }
      bildir(`Yedek alındı: ${await gunlukYedekAl({ zorla: true })}`);
      yedekYaz();
    } catch (h) { bildir(h.message, { hata: true }); }
  });
  el.querySelector('[data-indir]').addEventListener('click', () => yedekIndir().catch((h) => bildir(h.message, { hata: true })));

  const usbYaz = () => {
    const son = usbYedekSon();
    el.querySelector('[data-usb-durum]').innerHTML = son
      ? `Son USB yedeği: <b>${k(new Date(son).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }))}</b>. Haftada bir alın.`
      : '<b>USB belleğe hiç yedek alınmadı.</b> Laptop çalınır ya da bozulursa üyeler buradan geri gelir.';
  };
  el.querySelector('[data-usb]').addEventListener('click', async () => {
    try {
      const sonuc = await usbYedekAl();
      if (sonuc === 'yazildi') bildir('USB yedeği alındı. Belleği çıkarıp kilitli bir yerde saklayın.');
      if (sonuc === 'indirildi') bildir('Yedek İndirilenler klasörüne indi. Oradan USB belleğe kopyalayın.');
      usbYaz();
    } catch (h) { bildir(`USB yedeği alınamadı: ${h.message}`, { hata: true }); }
  });
  usbYaz();

  const tarayici = tarayiciTuru();
  const laptopDugmesi = el.querySelector('[data-laptop]');
  el.querySelector('[data-laptop-not]').textContent = tarayici
    ? `Dosya bu tarayıcı (${tarayici === 'edge' ? 'Edge' : 'Chrome'}) ve bu adres için üretilir. Yönetici izni istemez.`
    : 'Bu tarayıcı desteklenmiyor. Paneli Chrome ya da Edge ile açın.';
  laptopDugmesi.disabled = !tarayici;
  laptopDugmesi.addEventListener('click', () => {
    try {
      const ad = betikIndir(laptopBetigi({ taban: tabanAdres(), tarayici, salonAd: s.ad }), s.ad);
      bildir(`${ad} indirildi. İndirilenler'den çalıştırın.`);
    } catch (h) { bildir(h.message, { hata: true }); }
  });
  el.querySelector('[data-yukle]').addEventListener('change', async (e) => {
    const dosya = e.target.files?.[0];
    if (!dosya || !window.confirm('Bu bilgisayardaki tüm veri yedekteki haliyle değişecek. Devam edilsin mi?')) return;
    try { const r = await yedektenYukle(dosya); bildir(`Yedek yüklendi: ${r.uye} üye`); ctx.yenile(); } catch (h) { bildir(h.message, { hata: true }); }
  });
  el.querySelector('[data-csv]').addEventListener('click', () => csvAktarPenceresi(ctx));

  const silinecek = silinecekUyeler(ctx.uyeler);
  el.querySelector('[data-saklama]').textContent = silinecek.length
    ? `Üyeliği 2 yıldan uzun süre önce bitmiş ${silinecek.length} kişinin kaydı silinmeli.`
    : 'Saklama süresi dolan üye kaydı yok.';
  const silDugmesi = el.querySelector('[data-saklama-sil]');
  silDugmesi.hidden = silinecek.length === 0;
  silDugmesi.addEventListener('click', async () => {
    if (!window.confirm(`${silinecek.length} eski üyenin kaydı, ödemeleri ve kapı kayıtları silinecek. Devam edilsin mi?`)) return;
    silDugmesi.disabled = true;
    for (const u of silinecek) await uyeSil(u.id);
    bildir(`${silinecek.length} eski kayıt silindi`);
    ctx.yenile();
  });

  const pinForm = el.querySelector('[data-pin]');
  pinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(pinForm);
    if (!(await pinDogrula(f.get('eski'), s.pin))) { bildir('Şimdiki PIN yanlış', { hata: true }); return; }
    if (!pinGecerliMi(f.get('yeni')) || f.get('yeni') !== f.get('yeni2')) { bildir('Yeni PIN 4–8 rakam olmalı ve iki kez aynı yazılmalı', { hata: true }); return; }
    await ayarYaz('salon', { ...s, pin: await pinTuret(f.get('yeni')) });
    pinForm.reset();
    bildir('PIN değişti');
    ctx.yenile();
  });

  (async () => {
    const r = { ...VARSAYILAN_ROLE, ...((await ayarOku('role')) || {}) };
    if (iptal) return;
    const rf = el.querySelector('[data-role]');
    ['baudRate', 'sureMs', 'ac', 'kapat'].forEach((a) => { rf[a].value = r[a]; });
    rf.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        hexBayt(rf.ac.value); hexBayt(rf.kapat.value);
        const yeni = { ...r, baudRate: sayi(rf.baudRate.value) || 9600, sureMs: Math.min(3000, sayi(rf.sureMs.value) || 300), ac: rf.ac.value.trim(), kapat: rf.kapat.value.trim() };
        await ayarYaz('role', yeni);
        bildir('Röle ayarı kaydedildi. Kapı ekranını yenileyin.');
      } catch (h) { bildir(h.message, { hata: true }); }
    });
  })();
  yedekYaz();
  return () => { iptal = true; };
}
