# Salon Kapı

Spor salonu için QR'lı giriş, üye defteri ve hatırlatma. Sunucusuz çalışır.

- **Resepsiyon laptopu** (`index.html`): ilk açılışta kurulum, PIN'li panel (Bugün · Üyeler · Hatırlat · Kasa · Ayarlar) ve kapı ekranı (`#/kapi`). Veriler yalnız o laptopun tarayıcısında (IndexedDB) durur; her gün seçilen klasöre yedek alınır.
- **Üyenin telefonu** (`uye.html`): WhatsApp'tan gelen kişisel linkle açılır, ana ekrana eklenir. 30 saniyede bir değişen imzalı QR ve 6 haneli yedek kod gösterir. Link içeriği adresin `#` kısmındadır, hiçbir sunucuya gitmez.
- **Kapı**: USB QR okuyucu (klavye ya da sanal COM), laptop kamerası; turnike USB röleyle (Web Serial) açılır. İnternet gerekmez.

- **Panel ↔ kapı köprüsü**: klavye gibi yazan okuyucu öndeki pencereye yazar. Panel ya da PIN ekranı öndeyken okutulan QR yakalanıp kapı ekranına iletilir; kapı ekranı kapalıysa panel uyarır. Kapı ekranı tek pencerede çalışır (Web Locks); ikinci pencere "zaten açık" der, okuyucu ve röle bölünmez.
- **Günün özeti**: Bugün sekmesinden salon sahibine WhatsApp mesajı. Yalnız sayılar, isim yok.

## Laptop hazırlama (salonda bir kez)

Panel → Ayarlar → **Bu laptop** → "Hazırlama dosyasını indir". Dosya panelin açık olduğu tarayıcı ve adres için üretilir; yönetici izni istemez, `/deneme` ile hiçbir şeyi değiştirmeden çalışır. Yaptığı: açılışta kapı ekranı, masaüstüne Kapı ve Panel kısayolu, prizdeyken uyku ve kapak kapanınca uyuma kapalı. Elle yapılacaklar aynı bölümdeki listede (Windows Update etkin saatler, röle, okuyucu modu, USB yedek).

## Yayın

Kod önce deneme adresine (ayrı origin, deneme verisi salona karışmaz), orada denendikten sonra salona gider. Salona yalnız deneme adresinde yayınlanmış, testleri geçmiş commit gönderilir; `sw.js` önbellek listesi tüm `js/` ve `css/` dosyalarını içermelidir.

Gizli anahtarlar kodda yoktur: salonun ana anahtarı kurulumda laptopta üretilir.
Üçüncü taraf: `vendor/LISANSLAR.md`, yazı tipleri `fontlar/OFL.txt`.
