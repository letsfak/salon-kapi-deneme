// Panel ↔ kapı köprüsü. Klavye gibi yazan USB okuyucu, o an önde hangi pencere varsa oraya yazar.
// Resepsiyon paneldeyken (ya da PIN ekranındayken) okutulan QR panele düşer: panel onu yakalar,
// yazıldığı kutudan siler, kapı ekranına iletir. Kapı "aldım" demezse panel uyarır (kapı ekranı kapalı demektir).
import { qrCoz } from './kod.js';

export const KOPRU_KANALI = 'salonkapi-okut';
export const KAPI_KILIDI = 'salonkapi-kapi';
const TUS_ARASI_MS = 300; // okuyucu tuşları art arda gelir; arada bundan uzun boşluk varsa insan yazıyordur
const CEVAP_BEKLEME_MS = 1500;
const GEC_ENTER_MS = 400; // yavaş okuyucu Enter'ı iletimden sonra gönderebilir: o da yutulur, form gönderilmez
const EN_UZUN_TAMPON = 64;
const EN_KISA_PARCA = 4;

const kanalAc = () => { try { return new BroadcastChannel(KOPRU_KANALI); } catch { return null; } };
const qrMu = (t) => qrCoz(t) !== null;

/** Kutuya yazılmış QR'ı (ya da maxlength yüzünden kesilmiş başını) metnin sonundan siler. */
export function yazilaniTemizle(deger, metin) {
  const d = String(deger ?? '');
  if (d.includes(metin)) return d.replace(metin, '');
  for (let n = Math.min(d.length, metin.length); n >= EN_KISA_PARCA; n -= 1) {
    if (d.endsWith(metin.slice(0, n))) return d.slice(0, d.length - n);
  }
  return d;
}

function odaktakiKutuyuTemizle(metin) {
  if (typeof document === 'undefined') return;
  const el = document.activeElement;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  const yeni = yazilaniTemizle(el.value, metin);
  if (yeni === el.value) return;
  el.value = yeni;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Kapı tarafı: panelden gelen QR'ı işler ve sonucu bildirir.
 * @param {(metin: string) => true|string} isle kabul ederse true, etmezse sebep ('mesgul', 'tekrar'…)
 * @returns {() => void} dinlemeyi bırakır
 */
export function kopruDinle(isle, verilenKanal = null) {
  const kanal = verilenKanal || kanalAc();
  if (!kanal) return () => {};
  const f = (e) => {
    const m = e.data;
    if (!m || m.tip !== 'okut' || typeof m.metin !== 'string' || !qrMu(m.metin)) return;
    let sonuc;
    try { sonuc = isle(m.metin); } catch { sonuc = 'hata'; }
    kanal.postMessage({ tip: 'alindi', no: m.no, sonuc: sonuc === true ? 'islendi' : String(sonuc) });
  };
  kanal.addEventListener('message', f);
  return () => {
    kanal.removeEventListener('message', f);
    if (!verilenKanal) kanal.close();
  };
}

/**
 * Panel tarafı: klavye olaylarından okuyucu QR'ını ayırır ve kapıya iletir. İnsan yazısına dokunmaz:
 * yalnız baştan sona geçerli QR biçimindeki hızlı tuş dizisi iletilir; Enter yalnız o zaman (ya da hemen ardından) yutulur.
 * @param {{ kapiYok: (metin: string) => void, kapiMesgul?: (metin: string) => void, iletildi?: (metin: string) => void,
 *   okundu?: () => void, kanal?: BroadcastChannel|null, zaman?: () => number, beklemeMs?: number, cevapMs?: number,
 *   temizle?: (metin: string) => void }} secenek  okundu: QR tanındığı an (panel bunu kullanıcı hareketi saymaz)
 */
export function panelYakalayici({
  kapiYok, kapiMesgul = () => {}, iletildi = () => {}, okundu = () => {}, kanal = kanalAc(), zaman = () => performance.now(),
  beklemeMs = 150, cevapMs = CEVAP_BEKLEME_MS, temizle = odaktakiKutuyuTemizle,
}) {
  let tampon = '';
  let sonTus = -Infinity;
  let sonIletim = -Infinity;
  let zamanlayici = null;
  const bekleyen = new Map(); // no → { zamanlayici, metin }

  const cevap = (e) => {
    const no = e.data?.tip === 'alindi' ? e.data.no : null;
    const b = bekleyen.get(no);
    if (!b) return;
    clearTimeout(b.zamanlayici);
    bekleyen.delete(no);
    if (e.data.sonuc === 'islendi') iletildi(b.metin);
    else if (e.data.sonuc !== 'tekrar') kapiMesgul(b.metin); // 'tekrar': aynı okutma zaten işlendi, uyarı gereksiz
  };
  kanal?.addEventListener('message', cevap);

  function ilet() {
    clearTimeout(zamanlayici);
    zamanlayici = null;
    const metin = tampon.trim();
    tampon = '';
    if (!qrMu(metin)) return false;
    sonIletim = zaman();
    okundu();
    temizle(metin);
    if (!kanal) { kapiYok(metin); return true; }
    const no = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    bekleyen.set(no, { metin, zamanlayici: setTimeout(() => { bekleyen.delete(no); kapiYok(metin); }, cevapMs) });
    kanal.postMessage({ tip: 'okut', metin, no });
    return true;
  }

  function tus(e) {
    if (typeof e.key !== 'string') return; // otomatik doldurma tuşsuz olay gönderir
    const t = zaman();
    if (t - sonTus > TUS_ARASI_MS) tampon = '';
    sonTus = t;
    if (e.key === 'Enter') {
      const yut = (qrMu(tampon.trim()) && ilet()) || t - sonIletim < GEC_ENTER_MS;
      if (yut) { e.preventDefault(); e.stopPropagation(); }
      tampon = '';
      return;
    }
    if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;
    tampon = (tampon + e.key).slice(-EN_UZUN_TAMPON);
    clearTimeout(zamanlayici);
    zamanlayici = qrMu(tampon.trim()) ? setTimeout(ilet, beklemeMs) : null;
  }

  function kapat() {
    clearTimeout(zamanlayici);
    bekleyen.forEach((b) => clearTimeout(b.zamanlayici));
    bekleyen.clear();
    kanal?.removeEventListener('message', cevap);
  }

  return { tus, kapat };
}
