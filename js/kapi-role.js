// Kapı ekranındaki röle bölümü: durum, bağlama, test. Daha önce izin verilen röleye sayfa açılınca kendiliğinden bağlanır.
import { roleDestekli, roleSec, roleOtomatikBaglan, roleTetikle, roleKapat, roleBagliMi, roleDurumDinle } from './role.js';
import { sesiAc } from './ui.js';

export const ROLE_SABLONU = `
      <div class="yedek role" data-role>
        <p class="etiket">Turnike rölesi <span class="cip" data-role-cip>bağlı değil</span></p>
        <p class="seri-not" data-role-not>USB röle takılıysa bir kere "Röleyi bağla"ya basın; sonra kendiliğinden bağlanır.</p>
        <div class="yedek-satir">
          <button type="button" class="btn btn-ana" data-role-bagla>Röleyi bağla</button>
          <button type="button" class="btn" data-role-test disabled>Test: turnikeyi aç</button>
        </div>
      </div>`;

export function roleBolumuKur(kok) {
  const bolum = kok.querySelector('[data-role]');
  if (!roleDestekli()) {
    bolum.querySelector('[data-role-not]').textContent = 'Bu tarayıcı USB röleyi desteklemiyor. Chrome ya da Edge kullanın.';
    bolum.querySelector('[data-role-bagla]').disabled = true;
    return () => {};
  }
  const cip = bolum.querySelector('[data-role-cip]');
  const test = bolum.querySelector('[data-role-test]');
  const not = bolum.querySelector('[data-role-not]');
  const goster = (bagli) => {
    cip.textContent = bagli ? 'bağlı' : 'bağlı değil';
    cip.className = `cip ${bagli ? 'cip-ok' : 'cip-uyari'}`;
    test.disabled = !bagli;
  };
  roleDurumDinle(goster);
  goster(roleBagliMi());
  roleOtomatikBaglan().then(goster);

  bolum.querySelector('[data-role-bagla]').addEventListener('click', async () => {
    try {
      await roleSec();
      not.textContent = 'Röle bağlandı. "Test" ile turnikenin bir tur açıldığını kontrol edin.';
    } catch (hata) {
      if (hata.name !== 'NotFoundError') not.textContent = `Röle açılamadı: ${hata.message}`;
    }
  });
  test.addEventListener('click', async () => {
    sesiAc();
    not.textContent = (await roleTetikle()) ? 'Komut gönderildi. Kol bir tur serbest kaldı mı?' : 'Komut gönderilemedi. Kabloyu kontrol edip yeniden bağlayın.';
  });
  return () => { roleDurumDinle(() => {}); roleKapat(); };
}
