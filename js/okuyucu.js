// USB QR okuyucudan gelen karakterleri satıra çevirir. İki yoldan da beslenir:
// klavye gibi yazan (HID) okuyucunun tuşları ve sanal COM portundan (Web Serial) gelen parçalar.
// Okuyucu Enter göndermese de çalışır: tampon geçerli bir QR'a dönüşünce kısa bir sessizlikten sonra teslim edilir.

const EN_KISA = 6;

/**
 * @param {(metin: string) => void} teslim
 * @param {{ beklemeMs?: number, gecerliMi?: (metin: string) => boolean }} [secenek]
 * @returns {{ ekle: (parca: string) => number, sifirla: () => void }} ekle: bu çağrıda kaç satır teslim edildi
 */
export function satirToplayici(teslim, { beklemeMs = 150, gecerliMi = () => false } = {}) {
  let tampon = '';
  let zamanlayici = null;

  const bekleyeniIptal = () => {
    clearTimeout(zamanlayici);
    zamanlayici = null;
  };

  function bosalt() {
    const metin = tampon.trim();
    tampon = '';
    bekleyeniIptal();
    if (metin.length < EN_KISA) return 0;
    teslim(metin);
    return 1;
  }

  function ekle(parca) {
    let teslimSayisi = 0;
    for (const ch of String(parca ?? '')) {
      if (ch === '\r' || ch === '\n') {
        if (tampon) teslimSayisi += bosalt(); // CRLF: \r teslim eder, boş tamponla gelen \n yok sayılır
      } else {
        tampon += ch;
      }
    }
    bekleyeniIptal();
    if (tampon && gecerliMi(tampon.trim())) {
      zamanlayici = setTimeout(() => {
        if (gecerliMi(tampon.trim())) bosalt();
      }, beklemeMs);
    }
    return teslimSayisi;
  }

  function sifirla() {
    tampon = '';
    bekleyeniIptal();
  }

  return { ekle, sifirla };
}
