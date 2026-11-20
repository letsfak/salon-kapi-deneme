// Kapı ekranındaki "sanal COM portu olarak görünen okuyucu" bölümü. Yalnız Web Serial olan tarayıcıda görünür.
import { satirToplayici } from './okuyucu.js';
import { seriDestekli, seriOkuyucuAc, seriHataMetni } from './seri-okuyucu.js';

export const SERI_SABLONU = `
      <div class="yedek seri" data-seri hidden>
        <p class="etiket">USB QR okuyucu</p>
        <p class="seri-not">Okuyucu klavye gibi yazıyorsa bir şey yapmanıza gerek yok. Sanal COM portu olarak görünüyorsa:</p>
        <div class="yedek-satir">
          <select class="girdi" data-baud aria-label="Okuyucu hızı (baud)">
            <option value="9600" selected>9600 baud</option>
            <option value="115200">115200 baud</option>
          </select>
          <button type="button" class="btn btn-ana" data-seri-bagla>Okuyucuyu bağla</button>
        </div>
        <p class="seri-durum" data-seri-durum role="status"></p>
      </div>`;

/** Bölümü bağlar; sayfadan çıkarken çağrılacak temizlik fonksiyonunu döndürür. */
export function seriBolumuKur(kok, { teslim, gecerliMi }) {
  if (!seriDestekli()) return () => {};
  kok.querySelector('[data-seri]').hidden = false;
  const durum = kok.querySelector('[data-seri-durum]');
  const toplayici = satirToplayici(teslim, { gecerliMi });
  let kapat = null;
  let kapandi = false;

  async function baglan() {
    const baudRate = Number(kok.querySelector('[data-baud]').value) || 9600;
    try {
      if (kapat) { await kapat(); kapat = null; }
      toplayici.sifirla();
      durum.textContent = 'Açılan listeden okuyucunun portunu seçin.';
      const yeniKapat = await seriOkuyucuAc({
        baudRate,
        parca: (p) => toplayici.ekle(p),
        koptu: () => { kapat = null; durum.textContent = 'Okuyucu bağlantısı koptu. Kabloyu kontrol edip yeniden bağlayın.'; },
      });
      if (kapandi) { await yeniKapat(); return; }
      kapat = yeniKapat;
      durum.textContent = `Bağlandı (${baudRate} baud). QR'ı okutun. Bir şey olmazsa hızı değiştirip yeniden bağlayın.`;
    } catch (hata) {
      if (!kapandi) durum.textContent = seriHataMetni(hata);
    }
  }

  kok.querySelector('[data-seri-bagla]').addEventListener('click', baglan);
  return () => {
    kapandi = true;
    toplayici.sifirla();
    kapat?.();
  };
}
