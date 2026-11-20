# Salon Kapı

Spor salonu için QR'lı giriş, üye defteri ve hatırlatma. Sunucusuz çalışır.

- **Resepsiyon laptopu** (`index.html`): ilk açılışta kurulum, PIN'li panel (Bugün · Üyeler · Hatırlat · Kasa · Ayarlar) ve kapı ekranı (`#/kapi`). Veriler yalnız o laptopun tarayıcısında (IndexedDB) durur; her gün seçilen klasöre yedek alınır.
- **Üyenin telefonu** (`uye.html`): WhatsApp'tan gelen kişisel linkle açılır, ana ekrana eklenir. 30 saniyede bir değişen imzalı QR ve 6 haneli yedek kod gösterir. Link içeriği adresin `#` kısmındadır, hiçbir sunucuya gitmez.
- **Kapı**: USB QR okuyucu (klavye ya da sanal COM), laptop kamerası; turnike USB röleyle (Web Serial) açılır. İnternet gerekmez.

Gizli anahtarlar kodda yoktur: salonun ana anahtarı kurulumda laptopta üretilir.
Üçüncü taraf: `vendor/LISANSLAR.md`, yazı tipleri `fontlar/OFL.txt`.
