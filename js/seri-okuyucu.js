// Sanal COM portu (USB CDC) olarak görünen QR okuyucu için Web Serial bağlantısı (Chrome/Edge masaüstü).

export const seriDestekli = () => typeof navigator !== 'undefined' && 'serial' in navigator;

const HATA_METNI = {
  NotFoundError: 'Port seçilmedi.',
  InvalidStateError: 'Bu port zaten açık. Sayfayı yenileyip tekrar deneyin.',
  NetworkError: 'Port açılamadı: başka bir program kullanıyor olabilir.',
  SecurityError: 'Tarayıcı porta erişime izin vermedi. Sayfa https ile açılmalı.',
};

export const seriHataMetni = (hata) => HATA_METNI[hata?.name] || 'Port açılamadı. Hızı (baud) değiştirip yeniden deneyin.';

/**
 * Kullanıcıya port seçtirir, açar ve gelen metin parçalarını `parca`ya iletir.
 * @returns {Promise<() => Promise<void>>} bağlantıyı kapatan fonksiyon
 */
export async function seriOkuyucuAc({ baudRate = 9600, parca, koptu }) {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate });
  const cozucu = new TextDecoderStream();
  const akisBitti = port.readable.pipeTo(cozucu.writable).catch(() => {});
  const okuyucu = cozucu.readable.getReader();
  let acik = true;

  (async () => {
    try {
      for (;;) {
        const { value, done } = await okuyucu.read();
        if (done) break;
        if (value) parca(value);
      }
    } catch {
      if (acik) koptu?.();
    }
  })();

  return async function kapat() {
    if (!acik) return;
    acik = false;
    try { await okuyucu.cancel(); } catch { /* zaten kapalı */ }
    try { okuyucu.releaseLock(); } catch { /* kilit yok */ }
    await akisBitti;
    try { await port.close(); } catch { /* port gitmiş olabilir */ }
  };
}
