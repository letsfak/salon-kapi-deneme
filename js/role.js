// USB röle (LCUS-1 / CH340 tipi, sanal COM portu) ile turnikeyi açma. Chrome/Edge masaüstü Web Serial.
// Komutlar ayardan değiştirilebilir: gelen röle farklı komut isterse kod değişmeden ayarlanır.
// [Muhtemel] LCUS-1: 9600 baud, aç A0 01 01 A2, kapat A0 01 00 A1. Röle gelince test düğmesiyle doğrulanır.
import { ayarOku, ayarYaz } from './depo.js';

export const VARSAYILAN_ROLE = { baudRate: 9600, ac: 'A0 01 01 A2', kapat: 'A0 01 00 A1', sureMs: 300 };

export const roleDestekli = () => typeof navigator !== 'undefined' && 'serial' in navigator;

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

export function hexBayt(metin) {
  const temiz = String(metin).replace(/[^0-9a-fA-F]/g, '');
  if (!temiz || temiz.length % 2) throw new Error('Röle komutu onaltılık (hex) olmalı, örn. A0 01 01 A2');
  return Uint8Array.from(temiz.match(/../g), (h) => parseInt(h, 16));
}

let port = null;
let durumDinleyici = () => {};

export const roleBagliMi = () => Boolean(port?.writable);
export function roleDurumDinle(f) { durumDinleyici = f; }

async function ayar() {
  return { ...VARSAYILAN_ROLE, ...((await ayarOku('role')) || {}) };
}

async function ac(p) {
  const { baudRate } = await ayar();
  await p.open({ baudRate });
  port = p;
  durumDinleyici(true);
}

/** Kullanıcı tıklamasıyla: port seçtirir ve hatırlar. */
export async function roleSec() {
  const p = await navigator.serial.requestPort();
  if (port) await roleKapat();
  await ac(p);
  const bilgi = p.getInfo();
  await ayarYaz('role', { ...(await ayarOku('role')), usbVendorId: bilgi.usbVendorId ?? null, usbProductId: bilgi.usbProductId ?? null });
}

/** Sayfa açılınca: daha önce izin verilmiş röle portunu kendiliğinden açar (laptop yeniden başlasa da). */
export async function roleOtomatikBaglan() {
  if (!roleDestekli() || port) return roleBagliMi();
  const kayit = await ayarOku('role');
  if (!kayit?.usbVendorId) return false;
  const portlar = await navigator.serial.getPorts();
  const p = portlar.find((x) => {
    const b = x.getInfo();
    return b.usbVendorId === kayit.usbVendorId && b.usbProductId === kayit.usbProductId;
  });
  if (!p) return false;
  try { await ac(p); return true; } catch { return false; }
}

async function yaz(bayt) {
  const w = port.writable.getWriter();
  try { await w.write(bayt); } finally { w.releaseLock(); }
}

let mesgul = false;

/**
 * Kontağı kısa süre kapatır: turnike bir tur açılır. Röle yoksa false döner (kapı yine de kaydı tutar).
 * "Kapat" komutu her durumda gönderilir (bir kez yeniden denenir): röle açık kalırsa turnike serbest kalır.
 */
export async function roleTetikle() {
  if (!roleBagliMi() || mesgul) return false;
  mesgul = true;
  const a = await ayar();
  let basarili = false;
  try {
    await yaz(hexBayt(a.ac));
    await bekle(a.sureMs);
    basarili = true;
  } catch {
    basarili = false;
  } finally {
    let kapandi = false;
    for (let deneme = 0; deneme < 2 && !kapandi && port; deneme++) {
      try { await yaz(hexBayt(a.kapat)); kapandi = true; } catch { await bekle(100); }
    }
    if (!kapandi) { basarili = false; await roleKapat(); } // sonraki geçişte yeniden bağlanabilsin
    mesgul = false;
  }
  return basarili;
}

export async function roleKapat() {
  const p = port;
  port = null;
  durumDinleyici(false);
  try { await p?.close(); } catch { /* port gitmiş olabilir */ }
}

/** Bağlantı koptuysa (kablo çıktı) bir sonraki geçişten önce yeniden bağlanmayı dener. */
export async function roleHazirla() {
  return roleBagliMi() || roleOtomatikBaglan();
}
