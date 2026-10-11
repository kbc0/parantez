// (parantez) araştırma: yayın listesini konu ve türe göre süzme, atıfı kopyalama.
// JavaScript olmadan liste eksiksiz görünür ve atıf metni elle seçilebilir.
import { $, $$, toast } from './ortak';

// ---------------------------------------------------------------- süzme
const suz = $('[data-suz]');
if (suz) {
  const secim = { konu: '', tur: '' };
  const sayi = $('[data-suz-sayi]');
  const bos = $('[data-suz-bos]');

  const uygula = () => {
    let gorunen = 0;
    for (const li of $$<HTMLElement>('.ar-oge[data-konu]')) {
      const uyar = (!secim.konu || li.dataset.konu === secim.konu) && (!secim.tur || li.dataset.tur === secim.tur);
      li.hidden = !uyar;
      if (uyar) gorunen++;
    }
    for (const y of $$<HTMLElement>('[data-yil]')) y.hidden = !$$('.ar-oge:not([hidden])', y).length;
    if (sayi) sayi.textContent = `${gorunen} yayın`;
    if (bos) bos.hidden = gorunen > 0;
  };

  suz.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!b) return;
    const alan = 'suzKonu' in b.dataset ? 'konu' : 'tur';
    secim[alan] = (alan === 'konu' ? b.dataset.suzKonu : b.dataset.suzTur) ?? '';
    for (const x of $$<HTMLButtonElement>(`[data-suz-${alan}]`, suz)) x.setAttribute('aria-pressed', String(x === b));
    uygula();
  });
}

// ---------------------------------------------------------------- atıf
$('[data-atif-kopyala]')?.addEventListener('click', async () => {
  const metin = $('[data-atif-metin]')?.textContent?.trim() ?? '';
  try {
    await navigator.clipboard.writeText(metin);
    toast('Atıf kopyalandı.');
  } catch {
    const s = getSelection();
    const p = $('[data-atif-metin]');
    if (s && p) { s.selectAllChildren(p); toast('Seçildi; kopyalayabilirsiniz.'); }
  }
});
