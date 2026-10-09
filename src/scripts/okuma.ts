// (parantez) — yazı sayfası. Sohbetten açılan, rahat okunan sayfa.
// JavaScript olmadan da eksiksiz okunur; bu dosya ilerleme çubuğu ve tepkileri ekler.
// Sayfa içi abonelik ortak.ts'de.
import { EMOJI, $, $$, toast, kimlik, okunduEkle, okunduIsaretle } from './ortak';

const sayfa = document.body.dataset.sayfa ?? '';
const slug = sayfa.replace(/^yazi-/, '');
const bar = $('.bar')!;
const yz = $('.yz')!;
const baslik = $('.yz__baslik');
const son = $('[data-son]');
const kalanEl = $('[data-kalan]');
const dk = Number(yz.dataset.dk) || 1;

// ---------------------------------------------------------------- üst bar
// Başlık ekrandan çıkınca bara geçer; altında ince bir okuma ilerlemesi akar.

let kare = 0;
let sonKalan = '';
function barGuncelle() {
  kare = 0;
  const barAlt = bar.getBoundingClientRect().bottom;
  if (baslik) bar.classList.toggle('kaydi', baslik.getBoundingClientRect().bottom < barAlt + 4);
  if (!son) return;
  const bitis = son.getBoundingClientRect().top + scrollY - innerHeight + 60;
  const p = bitis > 0 ? Math.min(1, Math.max(0, scrollY / bitis)) : 1;
  bar.style.setProperty('--ilerleme', p.toFixed(4));
  const kalan = p > 0.985 ? 'bitti' : p < 0.03 ? `${dk} dk okuma` : `${Math.max(1, Math.ceil(dk * (1 - p)))} dk kaldı`;
  if (kalanEl && kalan !== sonKalan) kalanEl.textContent = sonKalan = kalan;
}
const barIste = () => { if (!kare) kare = requestAnimationFrame(barGuncelle); };
addEventListener('scroll', barIste, { passive: true });
addEventListener('resize', barIste);
bar.classList.add('bar--ilerleme');
barGuncelle();

// ---------------------------------------------------------------- okundu

if (son && slug) {
  new IntersectionObserver((ent, obs) => {
    if (!ent.some((x) => x.isIntersecting)) return;
    okunduEkle(slug);
    son.classList.add('okundu');
    okunduIsaretle();
    obs.disconnect();
  }).observe(son);
}

// ---------------------------------------------------------------- tepki
// Yazının tamamına tek tepki. Sohbetteki hazır emojilerin aynısı.

const tepkiKutu = $('[data-yazi-tepki]');
const tepki = { sayilar: {} as Record<string, number>, benim: '' };

function tepkiCiz() {
  if (!tepkiKutu) return;
  for (const b of $$<HTMLButtonElement>('button[data-e]', tepkiKutu)) {
    const e = b.dataset.e!;
    const n = tepki.sayilar[e] ?? 0;
    $('span', b)!.textContent = n ? String(n) : '';
    b.classList.toggle('on', tepki.benim === e);
    b.setAttribute('aria-pressed', String(tepki.benim === e));
    b.setAttribute('aria-label', `${e} ile tepki ver${n ? ` (${n})` : ''}`);
  }
}

async function tepkiYukle() {
  if (!tepkiKutu || !slug) return;
  try {
    const r = await fetch(`/api/tepki?sayfa=${encodeURIComponent(sayfa)}&k=${kimlik()}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) return;
    const j = await r.json();
    tepki.sayilar = j.sayilar?.yazi ?? {};
    tepki.benim = j.benim?.yazi ?? '';
    tepkiCiz();
    tepkiKutu.hidden = false;
  } catch { /* tepkiler kapalı: sayfa yine çalışır */ }
}

async function tepkiVer(emoji: string) {
  const eski = { sayilar: { ...tepki.sayilar }, benim: tepki.benim };
  if (tepki.benim) tepki.sayilar[tepki.benim] = Math.max(0, (tepki.sayilar[tepki.benim] ?? 1) - 1);
  tepki.benim = tepki.benim === emoji ? '' : emoji;
  if (tepki.benim) tepki.sayilar[emoji] = (tepki.sayilar[emoji] ?? 0) + 1;
  tepkiCiz();
  try {
    const r = await fetch('/api/tepki', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sayfa, mesaj: 'yazi', emoji, k: kimlik() }),
    });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    tepki.sayilar = j.sayilar ?? {};
    tepki.benim = j.benim ?? '';
    tepkiCiz();
  } catch (err) {
    Object.assign(tepki, eski);
    tepkiCiz();
    toast(String(err).includes('429') ? 'biraz yavaş: çok hızlı tepki veriyorsun.' : 'tepki gönderilemedi. bağlantını kontrol eder misin?');
  }
}

tepkiKutu?.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>('button[data-e]');
  if (b && EMOJI.includes(b.dataset.e!)) tepkiVer(b.dataset.e!);
});
tepkiYukle();
