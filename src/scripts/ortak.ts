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

// Geri düğmesi: okur sitenin içinden geldiyse geldiği yere döner (ana sayfadan
// açılan yazı ana sayfaya, sohbetten açılan sohbete). Bağlantıyla doğrudan
// gelindiyse bağlantının gösterdiği yere gider.
$<HTMLAnchorElement>('.bar__geri')?.addEventListener('click', (e) => {
  let once: URL | null = null;
  try { once = document.referrer ? new URL(document.referrer) : null; } catch { /* geçersiz */ }
  if (once && once.origin === location.origin && once.pathname !== location.pathname && history.length > 1) {
    e.preventDefault();
    history.back();
  }
});

// Masaüstü ana sayfadaki arşiv çekmecesi her açılışta baştan başlasın
$('#liste')?.addEventListener('toggle', (e) => {
  if ((e as ToggleEvent).newState === 'open') (e.currentTarget as HTMLElement).scrollTop = 0;
});

// ---------------------------------------------------------------- sayfa içi abonelik
// Sohbetteki mesaj kutusunun aynısı: e-posta yazılır, (parantez) cevap verir.
// [data-abone-kutu] içinde bir form; [data-abone-ac] varsa kutu ona basınca açılır.
// JavaScript yoksa form /api/abone'ye gider, düğmeler /abone/ sayfasına.

export const AV_P = '<span class="av av--o" style="--av:#111111" aria-hidden="true">(p)</span>';

function balon(sinif: string, metin: string, av = '') {
  const d = document.createElement('div');
  d.className = sinif;
  d.innerHTML = `${av}<div class="not__b"><p></p></div>`;
  $('p', d)!.textContent = metin;
  return d;
}

const aboneyim = () => ls.get('p:abone') === '1';
if (aboneyim()) for (const el of $$('[data-abone-gizle]')) el.hidden = true;

for (const kutu of $$('[data-abone-kutu]')) {
  const form = $<HTMLFormElement>('form', kutu)!;
  const girdi = $<HTMLInputElement>('input[name=eposta]', form)!;
  const uyari = $('[data-uyari]', kutu)!;
  const ac = kutu.id ? $$<HTMLElement>(`[data-abone-ac="${kutu.id}"]`) : [];
  const kapali = ac.length ? $$<HTMLElement>(`[data-abone-yerine="${kutu.id}"]`) : [];
  form.noValidate = true; // uyarıyı tarayıcının balonu yerine sohbet diliyle verelim

  const goster = (acik: boolean) => {
    kutu.hidden = !acik;
    kapali.forEach((el) => (el.hidden = acik));
    if (acik) girdi.focus();
  };
  for (const a of ac) a.addEventListener('click', (e) => {
    // Kutu bu ekranda görünmüyorsa (ör. mobilde kapak yok) bağlantı normal çalışsın
    if (!kutu.parentElement?.getClientRects().length) return;
    e.preventDefault();
    a.closest<HTMLElement>('[popover]')?.hidePopover();
    goster(true);
  });
  $('[data-kapat]', kutu)?.addEventListener('click', () => { uyari.hidden = true; goster(false); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const eposta = girdi.value.trim();
    if (($<HTMLInputElement>('input[name=web]', form)?.value ?? '') !== '') return; // bot tuzağı
    if (!EPOSTA.test(eposta)) {
      uyari.textContent = 'bu bir e-posta adresine benzemiyor. ornek@site.com gibi yazar mısın?';
      uyari.hidden = false;
      girdi.focus();
      return;
    }
    uyari.hidden = true;
    const gonder = $<HTMLButtonElement>('button[type=submit]', form)!;
    gonder.disabled = true;
    let ok = false;
    let mesaj = 'bağlantı kurulamadı. birazdan tekrar dener misin?';
    try {
      const r = await fetch('/api/abone', { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
      const j = await r.json().catch(() => ({}));
      ok = r.ok;
      if (j.mesaj) mesaj = j.mesaj;
      else if (!r.ok) mesaj = 'bir şeyler ters gitti. birazdan tekrar dener misin?';
    } catch { /* çevrim dışı */ }
    gonder.disabled = false;
    if (!ok) {
      uyari.textContent = mesaj;
      uyari.hidden = false;
      return;
    }
    ls.set('p:abone', '1');
    $('[data-kapat]', kutu)?.remove();
    form.replaceWith(balon('yz-me', eposta), balon('not not--cevap', mesaj, AV_P));
  });
}

// Yüklenemeyen görsel boş gri kutu olarak kalsın
for (const img of $$<HTMLImageElement>('.lc__img img, .b--foto img, .yz__foto img, .sonraki img')) {
  const kirik = () => img.classList.add('kirik');
  if (img.complete && img.naturalWidth === 0) kirik();
  img.addEventListener('error', kirik);
}

okunduIsaretle();
