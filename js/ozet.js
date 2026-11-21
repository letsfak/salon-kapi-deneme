// Günün özeti: salon sahibine akşam WhatsApp'tan giden sayılar. Bilerek isim yok:
// toplam sayılar kişisel veri değildir, her gün WhatsApp (yurt dışı sunucu) üzerinden geçmesi KVKK sorunu doğurmaz.
// İsimleri görmek isteyen resepsiyondaki panele bakar.
import { iceridekiler, bitiyorlar, gelmeyenler, aktifMi } from './kural.js';

const gunBasi = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const ayBasi = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
const toplam = (liste) => liste.reduce((t, o) => t + (Number(o.tutar) || 0), 0);

/**
 * @param {{ uyeler: object[], odemeler: object[], bugunHareket: object[], simdi?: number }} veri
 *   bugunHareket: bugünün kapı kayıtları (gün başından şimdiye)
 */
export function gunOzeti({ uyeler, odemeler, bugunHareket, simdi = Date.now() }) {
  const bas = gunBasi(simdi);
  const bugun = bugunHareket.filter((h) => h.zaman >= bas && h.zaman <= simdi);
  const gecisler = bugun.filter((h) => h.tip === 'giris' && h.sonuc === 'gecti');
  const bugunOdeme = odemeler.filter((o) => o.zaman >= bas && o.zaman <= simdi);
  return {
    gelen: new Set(gecisler.map((h) => h.uyeId)).size,
    iceride: iceridekiler(bugun, simdi).size,
    engellenen: bugun.filter((h) => h.sonuc === 'red').length,
    bugunTahsilat: toplam(bugunOdeme),
    bugunOdemeSayisi: bugunOdeme.length,
    ayTahsilat: toplam(odemeler.filter((o) => o.zaman >= ayBasi(simdi) && o.zaman <= simdi)),
    biten: bitiyorlar(uyeler, simdi).length,
    gelmeyen: gelmeyenler(uyeler, simdi).length,
    aktif: uyeler.filter((u) => aktifMi(u, simdi)).length,
  };
}
