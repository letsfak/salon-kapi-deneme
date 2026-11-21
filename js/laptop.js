// Resepsiyon laptopunu hazırlayan Windows dosyası (.bat): açılışta kapı ekranı, masaüstüne Kapı ve Panel kısayolu,
// prizdeyken uyku ve kapak kapanınca uyuma kapalı. Yönetici izni istemez. "/deneme" ile hiçbir şeyi değiştirmeden çalışır.
// Dosya, panelin açık olduğu tarayıcıya göre üretilir: veri o tarayıcıda durduğu için kısayol da onu açmalı.

const GUVENLI_ADRES = /^https?:\/\/[A-Za-z0-9.-]+(:\d{2,5})?\/[A-Za-z0-9._~/-]*$/;
const HARF = { ı: 'i', İ: 'I', ş: 's', Ş: 'S', ğ: 'g', Ğ: 'G', ü: 'u', Ü: 'U', ö: 'o', Ö: 'O', ç: 'c', Ç: 'C' };

/** Kısayol adı için: Türkçe harfler sadeleşir, dosya adında sorun çıkaracak her şey atılır. */
export function asciiAd(ad) {
  return String(ad ?? '').replace(/[ıİşŞğĞüÜöÖçÇ]/g, (h) => HARF[h])
    .replace(/[^A-Za-z0-9 -]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30).trim();
}

/** 'chrome' | 'edge' | null (desteklenmeyen tarayıcı) */
export function tarayiciTuru(nav = globalThis.navigator) {
  const ua = String(nav?.userAgent || '');
  const markalar = (nav?.userAgentData?.brands || []).map((b) => b.brand);
  if (markalar.some((b) => /Edge/i.test(b)) || /Edg\//.test(ua)) return 'edge';
  if (markalar.some((b) => /Google Chrome/i.test(b)) || (/Chrome\//.test(ua) && !/OPR\/|SamsungBrowser/.test(ua))) return 'chrome';
  return null;
}

const CHROME_YOLLARI = [
  '%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe',
  '%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe',
  '%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe',
];
const EDGE_YOLLARI = [
  '%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe',
  '%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe',
];

// Kısayolları PowerShell kurar; adres ve yollar ortam değişkeninden okunur (tırnak/kaçış sorunu olmasın).
const KISAYOL_PS = [
  "$w=New-Object -ComObject WScript.Shell",
  "function K($yol,$arg){$s=$w.CreateShortcut($yol);$s.TargetPath=$env:SK_EXE;$s.Arguments=$arg;$s.Save()}",
  "$bas=[Environment]::GetFolderPath('Startup');$mas=[Environment]::GetFolderPath('Desktop')",
  "K (Join-Path $bas ($env:SK_AD+' Kapi.lnk')) ('--new-window --start-maximized --hide-crash-restore-bubble '+$env:SK_ADRES+'#/kapi')",
  "K (Join-Path $mas ($env:SK_AD+' Kapi.lnk')) ('--new-window --start-maximized '+$env:SK_ADRES+'#/kapi')",
  "K (Join-Path $mas ($env:SK_AD+' Panel.lnk')) ('--new-window '+$env:SK_ADRES+'#/panel')",
].join(';');

/**
 * @param {{ taban: string, tarayici: 'chrome'|'edge', salonAd: string }} p taban: uygulama adresi, sonu /
 * @returns {string} CRLF satır sonlu .bat içeriği
 */
export function laptopBetigi({ taban, tarayici, salonAd }) {
  if (!GUVENLI_ADRES.test(String(taban))) throw new Error('Uygulama adresi beklenmedik biçimde; dosya üretilmedi.');
  if (tarayici !== 'chrome' && tarayici !== 'edge') throw new Error('Yalnız Chrome ya da Edge için dosya üretilir.');
  const ad = asciiAd(salonAd) || 'Salon';
  const tarayiciAdi = tarayici === 'edge' ? 'Edge' : 'Chrome';
  const yollar = tarayici === 'edge' ? EDGE_YOLLARI : CHROME_YOLLARI;
  const satirlar = [
    '@echo off',
    'setlocal EnableExtensions',
    'chcp 65001 >nul',
    `title ${ad} laptop hazırlama`,
    `set "SK_ADRES=${taban}"`,
    `set "SK_AD=${ad}"`,
    'set "SK_EXE="',
    'set "DENEME="',
    'if /i "%~1"=="/deneme" set "DENEME=1"',
    'echo.',
    `echo  ${ad} · resepsiyon laptopu hazırlanıyor`,
    'if defined DENEME echo  DENEME KİPİ: hiçbir ayar değiştirilmeyecek.',
    'echo.',
    ...yollar.map((y) => `call :bul "${y}"`),
    'if not defined SK_EXE goto tarayici_yok',
    `echo  ${tarayiciAdi}: %SK_EXE%`,
    'echo  Adres: %SK_ADRES%',
    'echo.',
    'echo  [1/2] Açılışta kapı ekranı + masaüstüne Kapı ve Panel kısayolu',
    'if defined DENEME goto kisayol_atla',
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "${KISAYOL_PS}"`,
    'if errorlevel 1 (echo        HATA: kısayollar kurulamadı) else (echo        Tamam)',
    ':kisayol_atla',
    'echo  [2/2] Prizdeyken uyku yok, prizdeyken kapak kapanınca uyumaz (pilde kapak kapanırsa uyur)',
    'if defined DENEME goto guc_atla',
    'set "GUC_HATA="',
    'powercfg /change standby-timeout-ac 0 || set "GUC_HATA=1"',
    'powercfg /change hibernate-timeout-ac 0 || set "GUC_HATA=1"',
    'powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0 || set "GUC_HATA=1"',
    'powercfg /setactive SCHEME_CURRENT || set "GUC_HATA=1"',
    'if defined GUC_HATA (echo        HATA: güç ayarlarının bir kısmı değişmedi, Denetim Masası - Güç Seçenekleri) else (echo        Tamam)',
    ':guc_atla',
    'echo.',
    'echo  Elle yapılacak: Ayarlar - Windows Update - Gelişmiş seçenekler - Etkin saatler',
    'echo  salonun açık olduğu saatlere ayarlanmalı, güncelleme yeniden başlatması gece olsun.',
    'echo.',
    `echo  Geri almak için: Win+R - shell:startup - "${ad} Kapi" kısayolunu silin.`,
    'echo  Deneme: laptopu yeniden başlatın, kapı ekranı kendiliğinden açılmalı.',
    'echo.',
    'pause',
    'exit /b 0',
    ':tarayici_yok',
    `echo  ${tarayiciAdi} bulunamadı. Panel hangi tarayıcıda açıksa dosyayı oradan indirin.`,
    'pause',
    'exit /b 1',
    ':bul',
    'if not defined SK_EXE if exist "%~1" set "SK_EXE=%~1"',
    'exit /b 0',
  ];
  return `${satirlar.join('\r\n')}\r\n`;
}

/** Tarayıcıda: dosyayı indirir. Dönüş: indirilen dosyanın adı. */
export function betikIndir(metin, salonAd) {
  const ad = `${(asciiAd(salonAd) || 'salon').replace(/ /g, '-').toLowerCase()}-laptop-hazirla.bat`;
  const url = URL.createObjectURL(new Blob([metin], { type: 'application/octet-stream' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: ad });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return ad;
}
