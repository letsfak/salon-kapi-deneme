// Panel PIN'i: resepsiyonda bekleyen üyenin panele (borçlar, telefonlar) bakmasını engeller.
// PIN düz saklanmaz: PBKDF2-SHA256 ile türetilir. Kilit 15 dk hareketsizlikte ya da sekme kapanınca geri gelir.
import { b64u, rastgeleAnahtar } from './kod.js';

const TUR = 150_000;
const ACIK_ANAHTARI = 'salonkapi.panelAcik';
export const KILIT_MS = 15 * 60 * 1000;

export const pinGecerliMi = (pin) => /^\d{4,8}$/.test(String(pin));

export async function pinTuret(pin, tuzB64 = b64u.kodla(rastgeleAnahtar(16))) {
  const hamAnahtar = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bit = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64u.coz(tuzB64), iterations: TUR }, hamAnahtar, 256);
  return { tuz: tuzB64, ozet: b64u.kodla(new Uint8Array(bit)) };
}

export async function pinDogrula(pin, { tuz, ozet }) {
  if (!pinGecerliMi(pin)) return false;
  return (await pinTuret(pin, tuz)).ozet === ozet;
}

export function paneliAcikIsaretle() {
  try { sessionStorage.setItem(ACIK_ANAHTARI, String(Date.now())); } catch { /* gizli sekme */ }
}

export function panelAcikMi() {
  try {
    const t = Number(sessionStorage.getItem(ACIK_ANAHTARI));
    return t > 0 && Date.now() - t < KILIT_MS;
  } catch { return false; }
}

export function paneliKilitle() {
  try { sessionStorage.removeItem(ACIK_ANAHTARI); } catch { /* yok say */ }
}
