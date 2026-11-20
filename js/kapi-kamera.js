// Kapı ekranında laptop kamerasıyla QR okuma (jsQR). USB okuyucu yoksa ya da yedek olarak.
import { k, sesiAc } from './ui.js';

const TARAMA_ARALIGI_MS = 120;
const TARAMA_GENISLIGI = 720;

export const KAMERA_SABLONU = `
    <div class="kamera">
      <video playsinline muted aria-label="Kamera görüntüsü"></video>
      <div class="kamera-cerceve" aria-hidden="true"><i></i><i></i><i></i><i></i><b class="tarama-cizgi"></b></div>
      <div class="kamera-baslat" data-baslat>
        <p class="etiket">USB okuyucu yoksa</p>
        <h2>Laptop kamerasıyla okut</h2>
        <button type="button" class="btn btn-ana" data-kamera>Kamerayı başlat</button>
        <p class="ipucu" data-kamera-hata></p>
        <p class="ipucu">USB QR okuyucu takılıysa kameraya gerek yok: QR'ı okuyucuya gösterin.</p>
      </div>
      <select class="kamera-sec girdi" data-kamera-sec hidden aria-label="Kamera seç"></select>
    </div>`;

/** Kamerayı bağlar. teslim(metin) bulunan QR'ı iletir; mesgulMu() true iken tarama bekler. */
export function kameraKur(kok, { teslim, mesgulMu, ekranAcikTut }) {
  const $ = (s) => kok.querySelector(s);
  const video = $('video');
  const tuval = document.createElement('canvas');
  const ctx = tuval.getContext('2d', { willReadFrequently: true });
  let akis = null;
  let tarama = null;
  let kapandi = false;

  function tara() {
    if (!akis) return;
    if (!mesgulMu() && video.readyState >= 2 && video.videoWidth) {
      const olcek = Math.min(1, TARAMA_GENISLIGI / video.videoWidth);
      const w = Math.round(video.videoWidth * olcek);
      const h = Math.round(video.videoHeight * olcek);
      if (tuval.width !== w) { tuval.width = w; tuval.height = h; }
      ctx.drawImage(video, 0, 0, w, h);
      const kare = ctx.getImageData(0, 0, w, h);
      const bulunan = globalThis.jsQR(kare.data, w, h, { inversionAttempts: 'dontInvert' });
      if (bulunan?.data) teslim(bulunan.data);
    }
    tarama = setTimeout(tara, TARAMA_ARALIGI_MS);
  }

  function durdur() {
    clearTimeout(tarama);
    akis?.getTracks().forEach((t) => t.stop());
    akis = null;
  }

  async function listele(seciliId) {
    const secim = $('[data-kamera-sec]');
    const cihazlar = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    secim.hidden = cihazlar.length < 2;
    secim.innerHTML = cihazlar.map((d, i) => `<option value="${k(d.deviceId)}" ${d.deviceId === seciliId ? 'selected' : ''}>${k(d.label || `Kamera ${i + 1}`)}</option>`).join('');
  }

  async function baslat(cihazId) {
    sesiAc();
    const hataYeri = $('[data-kamera-hata]');
    if (!navigator.mediaDevices?.getUserMedia) { hataYeri.textContent = 'Bu tarayıcı kameraya erişemiyor. Chrome ya da Edge kullanın.'; return; }
    try {
      durdur();
      const kisit = cihazId ? { deviceId: { exact: cihazId } } : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } };
      const yeni = await navigator.mediaDevices.getUserMedia({ video: kisit, audio: false });
      if (kapandi) { yeni.getTracks().forEach((t) => t.stop()); return; }
      akis = yeni;
      video.srcObject = akis;
      await video.play();
      $('[data-baslat]').hidden = true;
      kok.querySelector('.kamera').classList.add('acik');
      await listele(akis.getVideoTracks()[0]?.getSettings().deviceId);
      ekranAcikTut();
      tara();
    } catch (hata) {
      hataYeri.textContent = hata.name === 'NotAllowedError'
        ? 'Kamera izni verilmedi. Adres çubuğundaki kamera simgesinden izin verip tekrar deneyin.'
        : 'Kamera açılamadı. Başka bir uygulama kullanıyor olabilir.';
    }
  }

  $('[data-kamera]').addEventListener('click', () => baslat());
  $('[data-kamera-sec]').addEventListener('change', (e) => baslat(e.target.value));
  return { acikMi: () => Boolean(akis), kapat: () => { kapandi = true; durdur(); } };
}
