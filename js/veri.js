// Panel ve kapının ortak veri işleri: hepsini yükle, üyenin davet linkini üret.
import { ayarOku, uyeleriGetir, odemeleriGetir } from './depo.js';
import { b64u, uyeAnahtariTuret } from './kod.js';
import { davetLinki } from './davet.js';
import { tabanAdres } from './ui.js';

export async function veriYukle() {
  const [salon, uyeler, odemeler] = await Promise.all([ayarOku('salon'), uyeleriGetir(), odemeleriGetir()]);
  return { salon, uyeler: uyeler.sort((a, b) => a.ad.localeCompare(b.ad, 'tr')), odemeler };
}

export const anaAnahtar = (salon) => b64u.coz(salon.anaAnahtar);

export async function davetLinkiUret(salon, uye) {
  const anahtar = await uyeAnahtariTuret(anaAnahtar(salon), uye.id, uye.surum, uye.tuz);
  return davetLinki(tabanAdres(), { salon: salon.ad, uyeId: uye.id, ad: uye.ad, bitis: uye.bitis, anahtar, olusturma: Date.now() });
}
