// (parantez) — sohbet ve okuma sayfalarının ortak parçaları.

export const EMOJI = ['❤️', '😂', '😮', '😢', '🔥'];
export const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const azHareket = matchMedia('(prefers-reduced-motion: reduce)').matches;

const depo = (s: () => Storage) => ({
  get(k: string) { try { return s().getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { s().setItem(k, v); } catch { /* gizli sekme vb. */ } },
});
export const ls = depo(() => localStorage);
export const ss = depo(() => sessionStorage);

export const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
export const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
export const bekle = (ms: number) => new Promise((r) => setTimeout(r, azHareket ? 0 : ms));

const toastEl = $('[data-toast]')!;
let toastZaman = 0;
export function toast(metin: string, ms = 2400) {
  toastEl.textContent = metin;
  toastEl.hidden = false;
  clearTimeout(toastZaman);
  toastZaman = window.setTimeout(() => (toastEl.hidden = true), ms);
}

// Tepkiler için tarayıcıya özel, kişisel bilgi içermeyen kimlik
export function kimlik() {
  let k = ls.get('p:k');
  if (!k) {
    k = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`).toLowerCase();
    ls.set('p:k', k);
  }
  return k;
}

// Okunan yazılar: link kartlarında ve yan listede ✓✓ olarak görünür
export function okunanlar(): string[] {
  try { return JSON.parse(ls.get('p:okunan') ?? '[]'); } catch { return []; }
}
export function okunduEkle(slug: string) {
  const o = new Set(okunanlar());
  o.add(slug);
  ls.set('p:okunan', JSON.stringify([...o].slice(-200)));
}
export function okunduIsaretle() {
  const o = new Set(okunanlar());
  for (const a of $$('[data-slug]')) a.classList.toggle('okundu', o.has(a.dataset.slug!));
}

async function kopyala() {
  try { await navigator.clipboard.writeText(location.href.split('#')[0]); toast('bağlantı kopyalandı'); }
  catch { toast(location.href.split('#')[0], 4000); }
}
for (const b of $$('[data-paylas]')) b.addEventListener('click', async () => {
  if (navigator.share) {
    try { await navigator.share({ title: document.title, url: location.href.split('#')[0] }); } catch { /* vazgeçildi */ }
  } else kopyala();
});

// Yüklenemeyen görsel boş gri kutu olarak kalsın
for (const img of $$<HTMLImageElement>('.lc__img img, .b--foto img, .yz__foto img, .sonraki img')) {
  const kirik = () => img.classList.add('kirik');
  if (img.complete && img.naturalWidth === 0) kirik();
  img.addEventListener('error', kirik);
}

okunduIsaretle();
