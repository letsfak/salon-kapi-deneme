// Üye kartı penceresi: durum, işlemler, geliş geçmişi, ödemeler.
import { uyeKaydet, uyeSil, uyeHareketleri, uyeGetir } from './depo.js';
import { dondur, dondurmayiBitir, telefonuYenile, borc } from './salon.js';
import { uyeDurumu } from './kural.js';
import { uzatFormu, odemeFormu, duzenleFormu, davetPenceresi } from './uye-form.js';
import { k, tl, tarihTR, kisaTarih, saatTR, DURUM, RED_ETIKET, kalanMetni, sonGelisMetni, pencereAc, bildir } from './ui.js';

export async function uyeKartiAc(ctx, uyeId) {
  const uye = ctx.uyeler.find((u) => u.id === uyeId);
  if (!uye) return;
  const d = uyeDurumu(uye);
  const kalanBorc = borc(uye, ctx.odemeler);
  const gecmis = await uyeHareketleri(uye.id, 12);
  const odemeler = ctx.odemeler.filter((o) => o.uyeId === uye.id).sort((a, b) => b.zaman - a.zaman).slice(0, 8);
  const yenidenAc = () => uyeKartiAc(ctx, uye.id);

  pencereAc(`
    <header class="kart-ust">
      <div><p class="etiket">${k(uye.id)}${uye.tel ? ` · ${k(uye.tel)}` : ''}</p><h2>${k(uye.ad)}</h2></div>
      <span class="cip ${DURUM[d.durum].sinif}">${DURUM[d.durum].etiket}</span>
    </header>
    ${uye.eksik ? '<p class="bant">Excel\'den gelirken bitiş tarihi yoktu. "Düzenle"den doğru tarihi girin.</p>' : ''}
    <dl class="ozet-izgara">
      <div><dt>Bitiş</dt><dd>${k(tarihTR(uye.bitis))}<small>${k(kalanMetni(d.kalanGun))}</small></dd></div>
      <div><dt>Borç (bu dönem)</dt><dd class="${kalanBorc ? 'borc' : ''}">${k(tl(kalanBorc))}</dd></div>
      <div><dt>Son geliş</dt><dd>${k(sonGelisMetni(uye.sonGelis))}</dd></div>
      <div><dt>Telefon kartı</dt><dd>${uye.surum > 1 ? `${uye.surum - 1} kez yenilendi` : 'İlk kart'}</dd></div>
    </dl>
    <div class="islem-izgara">
      <button type="button" class="btn btn-ana" data-i="davet">Kartı gönder</button>
      <button type="button" class="btn" data-i="uzat">Uzat</button>
      <button type="button" class="btn" data-i="odeme">Ödeme al</button>
      <button type="button" class="btn" data-i="dondur">${uye.donduruldu ? 'Dondurmayı bitir' : 'Dondur'}</button>
      <button type="button" class="btn" data-i="yenile">Telefonu yenile</button>
      <button type="button" class="btn" data-i="duzenle">Düzenle</button>
    </div>
    <div class="iki-sutun">
      <section><h3>Son gelişler</h3><ol class="mini-liste">${gecmis.length ? gecmis.map((h) => `
        <li class="${h.sonuc === 'red' ? 'red' : ''}"><span>${k(kisaTarih(h.zaman))} ${k(saatTR(h.zaman))}</span>
        <span>${h.sonuc === 'red' ? k(RED_ETIKET[h.sebep] || 'Red') : h.tip === 'cikis' ? 'Çıkış' : 'Giriş'}</span></li>`).join('') : '<li class="bos">Henüz kayıt yok</li>'}</ol></section>
      <section><h3>Ödemeler</h3><ol class="mini-liste">${odemeler.length ? odemeler.map((o) => `
        <li><span>${k(kisaTarih(o.zaman))}</span><span>${k(tl(o.tutar))} · ${k(o.yontem)}</span></li>`).join('') : '<li class="bos">Ödeme kaydı yok</li>'}</ol></section>
    </div>
    <div class="satir-islem ayri">
      <button type="button" class="btn btn-hayalet tehlike-yazi" data-i="sil">Üyeyi sil</button>
      <button type="button" class="btn btn-koyu" data-kapat>Kapat</button>
    </div>`, (pencere, kapat) => {
    const ISLEM = {
      davet: () => { kapat(); davetPenceresi(ctx, uye); },
      uzat: () => { kapat(); uzatFormu(ctx, uye, () => yenidenAc()); },
      odeme: () => { kapat(); odemeFormu(ctx, uye, () => yenidenAc()); },
      duzenle: () => { kapat(); duzenleFormu(ctx, uye, () => yenidenAc()); },
      dondur: async () => {
        const guncel = (await uyeGetir(uye.id)) || uye;
        const yeni = guncel.donduruldu ? dondurmayiBitir(guncel) : dondur(guncel);
        await uyeKaydet(yeni);
        bildir(guncel.donduruldu ? `Dondurma bitti. Yeni bitiş: ${tarihTR(yeni.bitis)}` : 'Üyelik donduruldu');
        kapat();
        await ctx.yenile();
        yenidenAc();
      },
      yenile: async () => {
        if (!window.confirm(`${uye.ad} için yeni kart oluşturulsun mu? Eski telefondaki kart artık kapıyı açmaz.`)) return;
        const yeni = telefonuYenile((await uyeGetir(uye.id)) || uye);
        await uyeKaydet(yeni);
        kapat();
        await ctx.yenile();
        davetPenceresi(ctx, yeni);
      },
      sil: async () => {
        const yazilan = window.prompt(`${uye.ad} ve tüm kayıtları silinecek. Onaylamak için adını aynen yazın:`);
        if (yazilan?.trim() !== uye.ad) { if (yazilan !== null) bildir('Ad aynı değil, silinmedi', { hata: true }); return; }
        await uyeSil(uye.id);
        kapat();
        bildir('Üye silindi');
        await ctx.yenile();
      },
    };
    pencere.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => ISLEM[b.dataset.i]?.()));
  });
}
