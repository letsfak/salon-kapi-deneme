// Bu kurulumun salon bilgileri. Başka bir salona kurulurken yalnız bu dosya, marka/ klasörü
// ve aydinlatma.html değişir; uygulamanın geri kalanı aynı kalır.
export const MARKA = Object.freeze({
  ad: 'SSFitness',
  sahip: 'Samet Şen',
  adres: 'Fatih Mah., Ocak Sok., No: 1A, Ortahisar / Trabzon',
  telefon: '+90 507 687 48 90',
  logo: 'marka/logo-daire.svg',
  isaret: 'marka/logo-isaret.svg',
  aydinlatma: 'aydinlatma.html',
  // Kurulum ekranına önceden dolar; salon ayarlardan değiştirebilir. 12 ay paketi yok (0 = fiyat girilmedi).
  paketler: Object.freeze([
    Object.freeze({ ay: 1, ucret: 2000 }), Object.freeze({ ay: 3, ucret: 5500 }),
    Object.freeze({ ay: 6, ucret: 10000 }), Object.freeze({ ay: 12, ucret: 0 }),
  ]),
});
