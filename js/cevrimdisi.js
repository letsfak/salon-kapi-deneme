// Service worker kaydı: uygulama internetsiz de açılsın. Kayıt başarısız olursa uygulama yine çalışır.
export function cevrimdisiKur() {
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  navigator.serviceWorker.register('sw.js').catch(() => { /* çevrimiçi çalışmaya devam eder */ });
}
