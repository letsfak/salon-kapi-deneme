// Üyeye WhatsApp'tan giden davet linki. Bilgi linkin # kısmında taşınır:
// tarayıcı # sonrasını hiçbir sunucuya göndermez, veri yalnız üyenin telefonunda kalır.
import { b64u } from './kod.js';
import { gercekTarih } from './tarih.js';

const SURUM = 1;
const ID_RE = /^U\d{2,6}$/;
const EN_ESKI_DAVET = Date.UTC(2025, 0, 1);
const GELECEK_PAYI_MS = 7 * 86_400_000; // telefon ile laptop saati farklı olabilir
// Gelecek tarihli bir davet, sonraki gerçek davetlerin kartı güncellemesini engellemesin.
const tarihMakul = (o) => Number.isFinite(o) && o >= EN_ESKI_DAVET && o <= Date.now() + GELECEK_PAYI_MS;
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

export function davetKodla({ salon, uyeId, ad, bitis, anahtar, olusturma }) {
  const govde = { v: SURUM, s: salon, i: uyeId, a: ad, b: bitis, k: b64u.kodla(anahtar), o: olusturma };
  return `d=${b64u.kodla(enc.encode(JSON.stringify(govde)))}`;
}

const metin = (x, enCok) => (typeof x === 'string' && x.trim() && x.trim().length <= enCok ? x.trim() : null);

/** Adresteki # kısmını çözer. Eksik, bozuk ya da kurcalanmış veride null döner. */
export function davetCoz(hash) {
  try {
    const m = /^#?d=([A-Za-z0-9_-]+)$/.exec(String(hash ?? ''));
    if (!m) return null;
    const o = JSON.parse(dec.decode(b64u.coz(m[1])));
    if (!o || o.v !== SURUM) return null;
    const salon = metin(o.s, 40);
    const ad = metin(o.a, 60);
    if (!salon || !ad || !ID_RE.test(o.i) || !gercekTarih(o.b) || !tarihMakul(o.o)) return null;
    const anahtar = b64u.coz(String(o.k));
    if (anahtar.length !== 32) return null;
    return { salon, uyeId: o.i, ad, bitis: o.b, anahtar, olusturma: o.o };
  } catch {
    return null;
  }
}

/** taban: uygulamanın yayın adresi, sonu / ile biter. */
export const davetLinki = (taban, davet) => `${taban}uye.html#${davetKodla(davet)}`;
