// WhatsApp tek tık linkleri (wa.me). Mesajı resepsiyondaki kişi kendi WhatsApp'ından gönderir; API yok, ücret yok.

/** Türkiye numarasını wa.me biçimine çevirir (905551234567); çevrilemezse null. */
export function telefonNormal(tel) {
  let d = String(tel ?? '').replace(/\D/g, '');
  if (d.startsWith('0090')) d = d.slice(2);
  if (d.length === 12 && d.startsWith('90')) return d;
  if (d.length === 11 && d.startsWith('0')) return `9${d}`;
  if (d.length === 10 && d.startsWith('5')) return `90${d}`;
  return null;
}

export const waLinki = (tel, metin) => `https://wa.me/${telefonNormal(tel) ?? ''}?text=${encodeURIComponent(metin)}`;

const ilkAd = (ad) => String(ad || '').split(' ')[0];

export const MESAJ = {
  davet: (uye, salon, link, aydinlatmaLinki) => `Merhaba ${ilkAd(uye.ad)}, ${salon} giriş kartın hazır:\n${link}\n\nLinke dokun, açılan sayfada "Ana ekrana ekle"yi seç. Salona gelince uygulamayı açıp QR'ı turnikedeki okuyucuya göster.${aydinlatmaLinki ? `\n\nKişisel verilerin nasıl işlendiği (KVKK aydınlatma metni): ${aydinlatmaLinki}` : ''}`,
  bitiyor: (uye, salon, tarihMetni, kalanGun) => (kalanGun < 0
    ? `Merhaba ${ilkAd(uye.ad)}, ${salon} üyeliğin ${tarihMetni} tarihinde bitti. Yenilemek istersen resepsiyona uğrayabilir ya da buraya yazabilirsin.`
    : `Merhaba ${ilkAd(uye.ad)}, ${salon} üyeliğin ${tarihMetni} tarihinde bitiyor. Yenilemek için resepsiyona uğrayabilir ya da buraya yazabilirsin.`),
  gelmeyen: (uye, salon, gun) => `Merhaba ${ilkAd(uye.ad)}, ${gun} gündür ${salon}'da göremedik, her şey yolunda mı? Seni bekliyoruz.`,
  borc: (uye, salon, tutar) => `Merhaba ${ilkAd(uye.ad)}, ${salon} üyeliğinden ${tutar} TL ödeme kaldı. Uygun olduğunda resepsiyonda ya da IBAN ile ödeyebilirsin.`,
};
