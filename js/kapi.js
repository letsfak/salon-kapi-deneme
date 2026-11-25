// Kapı ekranı: USB okuyucu (klavye ya da COM) ya da kamera QR'ı okur; anahtarı doğrular, kuralı uygular,
// kaydeder, röleyle turnikeyi açar. Ana anahtar yalnız bu laptopta durur; internet gerekmez.
import { qrDogrula, qrCoz, yedekKodBul, uyeAnahtariTuret } from './kod.js';
import { kapiKarari, iceridekiler, GIRIS_KILIDI_MS } from './kural.js';
import { girisIsle, borc } from './salon.js';
import { gecisKaydet, hareketlerAralik, uyeHareketleri, degisiklikDinle } from './depo.js';
import { ligdeMi, haftaAraligi, kapiLigSatiri } from './lig.js';
import { veriYukle, anaAnahtar } from './veri.js';
import { roleTetikle, roleHazirla } from './role.js';
import { satirToplayici } from './okuyucu.js';
import { kopruDinle, KAPI_KILIDI } from './okut-kopru.js';
import { SERI_SABLONU, seriBolumuKur } from './kapi-seri.js';
import { KAMERA_SABLONU, kameraKur } from './kapi-kamera.js';
import { ROLE_SABLONU, roleBolumuKur } from './kapi-role.js';
import { k, saatTR, sesiAc, bip, RED_ETIKET } from './ui.js';
import { MARKA } from './marka.js';

const SONUC_SURESI_MS = 2800;
const AYNI_KOD_BEKLEME_MS = 8000;
const UYE_SESSIZ_MS = 10_000; // geçen üyenin QR'ı kamerada bekletilirse "zaten içeride" kırmızısı çıkmasın
// Kamerada bekletilen QR aynı kırmızıyı tekrar tekrar yakmasın. "eski" ve "imza" hariç: hemen ardından canlı QR gelebilir.
const TEKRAR_EDEN_RED = new Set(['bitti', 'donduruldu', 'iceride', 'borc']);
const CIKIS_MODU_MS = 30_000; // çıkış modunda unutulan kapı 30 sn hareketsizlikte girişe döner
const OKUYUCU_TUS_ARASI_MS = 300;
// Yedek kod tahminine karşı: 1 dakikada 5 yanlış koddan sonra 60 sn kilit (6 hane × üye sayısı tahmin edilebilir kalmasın).
const KOD_DENEME_SINIRI = 5;
const KOD_DENEME_PENCERE_MS = 60_000;
const KOD_KILIT_MS = 60_000;

const SABLON = `
<section class="kapi">
  <header class="kapi-ust">
    <div class="kapi-marka-satir"><img class="kapi-marka-logo" src="${MARKA.isaret}" alt=""><div class="kapi-marka"><span class="etiket">Kapı · Turnike 1</span><strong data-salon></strong></div></div>
    <div class="mod-secici" role="group" aria-label="Okutma yönü">
      <button type="button" data-mod="giris" aria-pressed="true">Giriş</button>
      <button type="button" data-mod="cikis" aria-pressed="false">Çıkış</button>
    </div>
    <p class="kapi-saat sayi" data-saat aria-label="Saat"></p>
    <a class="btn btn-kucuk kapi-link" href="#/panel" target="_blank" rel="noopener">Panel ↗</a>
  </header>
  <div class="kapi-govde">${KAMERA_SABLONU}
    <aside class="kapi-yan">
      <div class="bekleme">
        <p class="etiket" data-mod-etiket>Giriş · hazır</p>
        <h1>QR'ınızı okutun</h1>
        <p class="kapi-alt">Uygulamayı açın, telefonun parlaklığını artırın, QR'ı okuyucuya 5–10 cm'den gösterin.</p>
      </div>
      <form class="yedek" data-yedek>
        <label for="yedek-kod" class="etiket">QR okunmazsa · 6 haneli yedek kod</label>
        <div class="yedek-satir"><input id="yedek-kod" class="girdi" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="000000">
          <button class="btn btn-ana" type="submit">Onayla</button></div>
      </form>${ROLE_SABLONU}${SERI_SABLONU}
      <div class="son-gecisler"><p class="etiket">Son okutmalar</p><ol data-son></ol></div>
    </aside>
  </div>
  <div class="sonuc" data-sonuc aria-hidden="true"><div class="sonuc-ic">
    <div class="sonuc-ikon" aria-hidden="true"></div>
    <p class="sonuc-baslik" data-sonuc-baslik></p><p class="sonuc-alt" data-sonuc-alt></p>
    <p class="sonuc-lig" data-sonuc-lig hidden></p>
    <p class="sonuc-not" data-sonuc-not hidden></p><p class="sonuc-turnike" data-sonuc-turnike></p>
  </div></div>
  <div class="kapi-ikinci" data-ikinci hidden><div class="kapi-ikinci-ic kart">
    <p class="etiket">Kapı ekranı zaten açık</p>
    <h2>Bu pencereyi kapatın</h2>
    <p>Kapı ekranı başka bir pencerede çalışıyor. Okuyucu ve röle orada; iki pencere olursa üyenin okuttuğu yanlış pencereye gidebilir. Diğer pencere kapanırsa bu pencere kendiliğinden devralır.</p>
  </div></div>
  <p class="sr" role="status" aria-live="assertive" data-duyuru></p>
</section>`;

export function kapiAc(kok, salonIlk) {
  kok.innerHTML = SABLON;
  const $ = (s) => kok.querySelector(s);
  const s = {
    mod: 'giris', mesgul: false, sonMetin: '', sonZaman: 0, tusSon: 0, kilit: null, zamanlar: [], sessiz: new Map(), kapandi: false,
    yanlisKodlar: [], kodKilidiSonu: 0, lider: false, donanimKapat: [], sonucNo: 0,
  };
  const d = { salon: salonIlk, uyeler: new Map(), odemeler: [], ana: anaAnahtar(salonIlk), anahtarlar: new Map() };

  async function yukle() {
    const v = await veriYukle();
    d.salon = v.salon;
    d.ana = anaAnahtar(v.salon);
    d.uyeler = new Map(v.uyeler.map((u) => [u.id, u]));
    d.odemeler = v.odemeler;
    $('[data-salon]').textContent = v.salon.ad;
    sonListesi();
  }

  async function anahtarBul(id) {
    const u = d.uyeler.get(id);
    if (!u) return null;
    const kim = `${id}:${u.surum}:${u.tuz}`;
    if (!d.anahtarlar.has(kim)) d.anahtarlar.set(kim, await uyeAnahtariTuret(d.ana, id, u.surum, u.tuz));
    return d.anahtarlar.get(kim);
  }

  async function sonListesi() {
    const son = (await hareketlerAralik(Date.now() - 12 * 3600_000)).slice(-6).reverse();
    if (s.kapandi) return;
    $('[data-son]').innerHTML = son.length
      ? son.map((h) => `<li class="${h.sonuc === 'gecti' ? 'iyi' : 'kotu'}"><span class="sayi">${saatTR(h.zaman)}</span>
          <span>${k(d.uyeler.get(h.uyeId)?.ad || 'Bilinmeyen')}</span>
          <span>${h.sonuc === 'gecti' ? (h.tip === 'cikis' ? 'Çıkış' : 'Geçti') : k(RED_ETIKET[h.sebep] || 'Red')}</span></li>`).join('')
      : '<li class="bos">Henüz okutma yok.</li>';
  }

  function sonucGoster(karar, turnikeAcildi) {
    const kutu = $('[data-sonuc]');
    kutu.className = `sonuc ${karar.gecti ? 'sonuc-ok' : 'sonuc-red'} acik`;
    kutu.setAttribute('aria-hidden', 'false');
    $('[data-sonuc-baslik]').textContent = karar.baslik;
    $('[data-sonuc-alt]').textContent = karar.alt;
    const not = $('[data-sonuc-not]');
    not.hidden = !karar.not;
    not.textContent = karar.not || '';
    s.sonucNo += 1; // geç gelen lig satırı yalnız kendi geçişinin ekranına yazılsın
    $('[data-sonuc-lig]').hidden = true;
    $('[data-sonuc-lig]').textContent = '';
    $('[data-sonuc-turnike]').textContent = !karar.gecti ? 'Turnike kilitli' : turnikeAcildi ? 'Turnike açıldı · 1 tur' : 'Geçiş onaylandı';
    $('[data-duyuru]').textContent = `${karar.baslik}. ${karar.alt}`;
    bip(karar.gecti);
    sonListesi();
    s.zamanlar.push(setTimeout(() => { kutu.classList.remove('acik'); kutu.setAttribute('aria-hidden', 'true'); s.mesgul = false; }, SONUC_SURESI_MS));
  }

  /** Lig satırı, geçiş kaydedilip sonuç ekrana çıktıktan sonra hesaplanır: turnikeyi ve karşılamayı bekletmez. */
  function ligSatiriYaz(uye, simdi) {
    const no = s.sonucNo;
    Promise.resolve().then(() => ligSatiriHesapla(uye, [...d.uyeler.values()], simdi)).then((satir) => {
      if (!satir || no !== s.sonucNo || s.kapandi || !$('[data-sonuc]').classList.contains('acik')) return;
      const el = $('[data-sonuc-lig]');
      el.textContent = satir;
      el.hidden = false;
      $('[data-duyuru]').textContent += `. ${satir}`;
    }).catch((hata) => {
      // Bilerek yutulan tek hata: lig satırı yalnız bilgidir. Geçiş zaten kaydedildi ve onaylandı; okuma ya da
      // hesap bozulursa satır çıkmaz, kapı akışı sürer. Sebep konsolda kalır.
      console.error('Lig satırı hesaplanamadı:', hata);
    });
  }

  async function dogrula(metin, simdi) {
    if (!/^\d{6}$/.test(metin)) return qrDogrula(metin, anahtarBul, simdi);
    if (simdi < s.kodKilidiSonu) return { gecerli: false, sebep: 'kodKilidi' };
    const adaylar = await Promise.all([...d.uyeler.keys()].map(async (id) => ({ id, anahtar: await anahtarBul(id) })));
    const id = await yedekKodBul(metin, adaylar, simdi);
    if (id) return { gecerli: true, uyeId: id };
    s.yanlisKodlar = [...s.yanlisKodlar.filter((t) => simdi - t < KOD_DENEME_PENCERE_MS), simdi];
    if (s.yanlisKodlar.length >= KOD_DENEME_SINIRI) {
      s.kodKilidiSonu = simdi + KOD_KILIT_MS;
      s.yanlisKodlar = [];
      return { gecerli: false, sebep: 'kodKilidi' };
    }
    return { gecerli: false, sebep: 'kod' };
  }

  /**
   * Okutmayı kabul ederse true döner ve arkada işler. Kabul etmezse sebebini döner:
   * 'bos' | 'lider-degil' | 'tekrar' (aynı kod az önce okundu) | 'mesgul' (önceki sonuç ekranda). Panel köprüsü buna göre uyarır.
   */
  function isle(ham, kaynak) {
    const metin = String(ham).trim();
    const simdi = Date.now();
    if (!metin) return 'bos';
    if (!s.lider) return 'lider-degil';
    if (metin === s.sonMetin && simdi - s.sonZaman < AYNI_KOD_BEKLEME_MS) return 'tekrar';
    if (s.mesgul) return 'mesgul';
    s.sonMetin = metin;
    s.sonZaman = simdi;
    s.mesgul = true;
    islemYap(metin, kaynak, simdi);
    return true;
  }

  async function islemYap(metin, kaynak, simdi) {
    try {
      const dogrulama = await dogrula(metin, simdi);
      if (kaynak === 'kamera' && dogrulama.uyeId && (s.sessiz.get(dogrulama.uyeId) || 0) > simdi) { s.mesgul = false; return; }
      const uye = d.uyeler.get(dogrulama.uyeId) || null;
      const yakin = await hareketlerAralik(simdi - GIRIS_KILIDI_MS, simdi + 1);
      const karar = kapiKarari({
        uye, dogrulama, mod: s.mod, simdi,
        icerideMi: Boolean(uye) && iceridekiler(yakin, simdi).has(uye.id),
        borcVar: Boolean(uye) && borc(uye, d.odemeler) > 0,
        borcluyuEngelle: Boolean(d.salon.borcluyuEngelle),
      });
      const girisMi = karar.gecti && s.mod === 'giris' && Boolean(uye);
      if (!(kaynak === 'kamera' && karar.sebep === 'bicim')) {
        const guncel = await gecisKaydet({
          uyeId: karar.uyeId ?? dogrulama.uyeId ?? null, tip: s.mod, sonuc: karar.gecti ? 'gecti' : 'red',
          sebep: karar.sebep, zaman: simdi, kaynak, uzunAra: karar.uzunAra ?? null,
        }, girisMi ? (taze) => girisIsle(taze, simdi) : null);
        if (guncel) d.uyeler.set(guncel.id, guncel);
      }
      if (dogrulama.uyeId && (karar.gecti || TEKRAR_EDEN_RED.has(karar.sebep))) s.sessiz.set(dogrulama.uyeId, simdi + UYE_SESSIZ_MS);
      // Röle giriş yönünü açar; çıkışta tetiklenmez (çıkış serbest ya da ayrı yönde).
      const acildi = girisMi && (await roleHazirla()) ? await roleTetikle() : false;
      if (s.mod === 'cikis') cikisZamanlayici();
      sonucGoster(karar, acildi);
      if (girisMi && ligdeMi(uye)) ligSatiriYaz(d.uyeler.get(uye.id) || uye, simdi);
    } catch (hata) {
      sonucGoster({ gecti: false, baslik: 'Doğrulama yapılamadı', alt: hata.message, not: null }, false);
    }
  }

  const ekranAcikTut = async () => {
    if (s.kapandi) return;
    try {
      const kilit = await navigator.wakeLock?.request('screen');
      if (s.kapandi) kilit?.release?.(); else s.kilit = kilit;
    } catch { s.kilit = null; }
  };
  const gecerliMi = (t) => qrCoz(t) !== null;
  const okuyucudan = (metin) => isle(metin, 'okuyucu');
  const klavye = satirToplayici(okuyucudan, { gecerliMi });

  function tus(e) {
    if (e.target instanceof Element && e.target.closest('input, select, textarea')) return;
    if (typeof e.key !== 'string') return; // tarayıcının otomatik doldurması tuşsuz olay gönderir
    const simdi = performance.now();
    if (simdi - s.tusSon > OKUYUCU_TUS_ARASI_MS) klavye.sifirla();
    s.tusSon = simdi;
    if (e.key === 'Enter') { if (klavye.ekle('\n') > 0) e.preventDefault(); } else if (e.key.length === 1) klavye.ekle(e.key);
  }

  function cikisZamanlayici() {
    clearTimeout(s.cikisZ);
    if (s.mod === 'cikis') s.cikisZ = setTimeout(() => modSec('giris'), CIKIS_MODU_MS);
  }

  function modSec(mod) {
    s.mod = mod;
    s.sessiz.clear();
    s.sonMetin = '';
    kok.querySelectorAll('[data-mod]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mod === mod)));
    $('[data-mod-etiket]').textContent = mod === 'giris' ? 'Giriş · hazır' : 'Çıkış · 30 sn sonra girişe döner';
    $('.kapi').classList.toggle('mod-cikis', mod === 'cikis');
    cikisZamanlayici();
  }

  const saatYaz = () => { $('[data-saat]').textContent = saatTR(Date.now()); };
  saatYaz();
  s.zamanlar.push(setInterval(saatYaz, 10_000));
  kok.querySelectorAll('[data-mod]').forEach((b) => b.addEventListener('click', () => modSec(b.dataset.mod)));
  $('[data-yedek]').addEventListener('submit', (e) => {
    e.preventDefault();
    sesiAc();
    const g = $('#yedek-kod');
    isle(g.value.replace(/\D/g, ''), 'yedek-kod');
    g.value = '';
    g.blur(); // odak kutuda kalırsa USB okuyucunun yazdıkları kutuya gider, kapı okumaz
  });
  document.addEventListener('pointerdown', sesiAc, { once: true });

  // Okuyucu, kamera, röle ve panel köprüsü yalnız kapıyı tutan pencerede çalışır.
  function baslat() {
    if (s.kapandi || s.lider) return;
    s.lider = true;
    $('[data-ikinci]').hidden = true;
    document.addEventListener('keydown', tus);
    const kamera = kameraKur(kok, { teslim: (m) => isle(m, 'kamera'), mesgulMu: () => s.mesgul, ekranAcikTut });
    s.donanimKapat.push(
      () => document.removeEventListener('keydown', tus),
      () => klavye.sifirla(),
      () => kamera.kapat(),
      seriBolumuKur(kok, { teslim: okuyucudan, gecerliMi }),
      roleBolumuKur(kok),
      kopruDinle(okuyucudan),
    );
  }
  const kapiyiBirak = tekPencere(baslat, () => { $('[data-ikinci]').hidden = false; }, () => s.kapandi);

  const dinlemeyiBirak = degisiklikDinle(() => { d.anahtarlar.clear(); yukle(); });
  const gorunurluk = () => { if (document.visibilityState === 'visible') ekranAcikTut(); };
  document.addEventListener('visibilitychange', gorunurluk);
  ekranAcikTut();
  yukle();

  return () => {
    s.kapandi = true;
    clearTimeout(s.cikisZ);
    s.donanimKapat.forEach((f) => { try { f(); } catch { /* kapanırken hata önemsiz */ } });
    kapiyiBirak();
    dinlemeyiBirak();
    s.zamanlar.forEach((z) => { clearInterval(z); clearTimeout(z); });
    s.kilit?.release?.();
    document.removeEventListener('visibilitychange', gorunurluk);
  };
}

/** Lig satırı için okuma ve hesap. O anki geçiş kaydedildikten sonra çağrılır, bu yüzden sayıma girer. */
async function ligSatiriHesapla(uye, uyeler, simdi) {
  const [haftaHareket, uyeHareket] = await Promise.all([
    hareketlerAralik(haftaAraligi(simdi).bas, simdi + 1),
    uyeHareketleri(uye.id, Infinity),
  ]);
  return kapiLigSatiri({ uye, uyeler, haftaHareket, uyeHareket, simdi });
}

/**
 * Kapı ekranını tek pencereye kilitler (Web Locks). Kilit boştaysa hemen baslat; değilse bekle() çağrılır
 * ve diğer pencere kapanınca kilit devralınıp baslat çalışır. Dönüş: kilidi bırakan fonksiyon.
 */
function tekPencere(baslat, bekle, kapandiMi) {
  const kilitler = typeof navigator !== 'undefined' ? navigator.locks : null;
  if (!kilitler) { baslat(); return () => {}; }
  const iptal = new AbortController();
  let birak = () => {};
  const tut = () => {
    if (kapandiMi()) return undefined;
    return new Promise((coz) => { birak = coz; baslat(); });
  };
  kilitler.request(KAPI_KILIDI, { ifAvailable: true }, (kilit) => {
    if (kilit) return tut();
    if (kapandiMi()) return undefined;
    bekle();
    return kilitler.request(KAPI_KILIDI, { signal: iptal.signal }, tut).catch(() => {});
  }).catch(() => {});
  return () => { iptal.abort(); birak(); };
}
