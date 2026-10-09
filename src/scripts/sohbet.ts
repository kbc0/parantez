// (parantez) — sohbet davranışları.
// Sayfalar JavaScript olmadan da okunur; bu dosya üstüne sohbet hissini ekler.
import { EMOJI, EPOSTA, azHareket, ls, ss, $, $$, bekle, toast, kimlik } from './ortak';

const sayfa = document.body.dataset.sayfa ?? '';
const msgs = $('.msgs')!;
const sohbet = $('[data-sohbet]');
const akis = sohbet ?? msgs;
const form = $<HTMLFormElement>('[data-composer]');
const girdi = form ? $<HTMLInputElement>('#mesaj', form) : null;
const chipler = form ? $('[data-chips]', form) : null;
const picker = $('[data-picker]')!;

function goster(el: Element, blok: ScrollLogicalPosition = 'start') {
  el.scrollIntoView({ behavior: azHareket ? 'auto' : 'smooth', block: blok });
}

// Yeni bir konu açılınca okurun mesajını ekranın üstüne taşıyabilmek için
// sohbetin altında geçici bir boşluk bırakılır (mesajlaşma uygulamalarındaki gibi).
let sonBas: Element | null = null;
const bosluk = document.createElement('div');
bosluk.className = 'bosluk';
bosluk.setAttribute('aria-hidden', 'true');
function bosAlan() {
  const bar = $('.bar')?.offsetHeight ?? 60;
  return Math.max(0, innerHeight - bar - (form?.offsetHeight ?? 0) - 24);
}
function yerAc(bas: Element) {
  akis.append(bosluk);
  bosluk.style.height = `${bosAlan()}px`;
  requestAnimationFrame(() => goster(bas));
}
function yerDaralt(bas: Element) {
  if (!bosluk.isConnected) return;
  const onceki = bosluk.previousElementSibling;
  const kullanilan = onceki ? onceki.getBoundingClientRect().bottom - bas.getBoundingClientRect().top : 0;
  bosluk.style.height = `${Math.max(0, bosAlan() - kullanilan)}px`;
}

// ---------------------------------------------------------------- mesajlar

const AV_P = '<span class="av av--o" style="--av:#111111" aria-hidden="true">(p)</span>';

function kademeli(kap: Element) {
  [...kap.children].forEach((c, i) => (c as HTMLElement).style.setProperty('--i', String(i)));
  kap.classList.remove('yeni');
  void (kap as HTMLElement).offsetWidth;
  kap.classList.add('yeni');
}

function ekle(el: Element) {
  if (bosluk.isConnected) bosluk.before(el); else akis.append(el);
}

function botKutusu(): HTMLElement {
  const son = bosluk.isConnected ? bosluk.previousElementSibling : akis.lastElementChild;
  if (son?.classList.contains('grp--bot')) return $('.bs', son)!;
  const g = document.createElement('div');
  g.className = 'grp grp--bot';
  g.dataset.kim = '(p)';
  g.innerHTML = `<div class="grp__av">${AV_P}</div><div class="bs"></div>`;
  ekle(g);
  return $('.bs', g)!;
}

function yaziyor(av = AV_P) {
  const g = document.createElement('div');
  g.className = 'grp grp--yaziyor';
  g.innerHTML = `<div class="grp__av">${av}</div><div class="bs"><p class="b typing" aria-label="yazıyor"><i></i><i></i><i></i></p></div>`;
  ekle(g);
  return g;
}

async function botSoyle(satirlar: string[], gecikme = 650) {
  const t = yaziyor();
  await bekle(gecikme);
  t.remove();
  const bs = botKutusu();
  const ilk = bs.children.length;
  for (const s of satirlar) {
    const p = document.createElement('p');
    p.className = 'b yeni';
    p.innerHTML = s;
    bs.append(p);
  }
  if (bosluk.isConnected) yerDaralt(sonBas ?? bs);
  else bs.children[ilk]?.scrollIntoView({ behavior: azHareket ? 'auto' : 'smooth', block: 'nearest' });
}

function benSoyle(metin: string) {
  const d = document.createElement('div');
  d.className = 'me yeni';
  const p = document.createElement('p');
  p.className = 'b';
  p.textContent = metin;
  d.append(p);
  ekle(d);
  sonBas = d;
  yerAc(d);
  return d;
}

// ---------------------------------------------------------------- abonelik

function aboneModu(ac: boolean, odak = true) {
  if (!form || !girdi) return;
  form.dataset.mod = ac ? 'abone' : 'mesaj';
  document.body.classList.toggle('kutu-acik', ac);
  girdi.type = ac ? 'email' : 'text';
  girdi.inputMode = ac ? 'email' : 'text';
  girdi.placeholder = ac ? 'e-posta adresin' : 'e-postanı yaz, her pazartesi sana da gelsin';
  if (ac && odak) girdi.focus({ preventScroll: true });
  if (!ac) girdi.blur();
  chipGuncelle();
}

let aboneOldu = false;

async function aboneOl(eposta: string) {
  const t = yaziyor();
  const fd = new FormData();
  fd.set('eposta', eposta);
  fd.set('kaynak', (form && $<HTMLInputElement>('input[name=kaynak]', form)?.value) || 'site');
  let ok = false;
  let mesaj = 'bağlantı kurulamadı. birazdan tekrar dener misin?';
  try {
    const r = await fetch('/api/abone', { method: 'POST', headers: { Accept: 'application/json' }, body: fd });
    const j = await r.json().catch(() => ({}));
    ok = r.ok;
    if (j.mesaj) mesaj = j.mesaj;
    else if (!r.ok) mesaj = 'bir şeyler ters gitti. birazdan tekrar dener misin?';
  } catch { /* çevrim dışı */ }
  await bekle(400);
  t.remove();
  if (ok) {
    ls.set('p:abone', '1');
    aboneOldu = true;
    document.body.classList.add('abone-oldu');
    aboneModu(false);
    await botSoyle([mesaj], 0);
    if (sohbet && !acik('yazilar')) await botSoyle(['bu arada bu haftanın yazılarına göz atmak ister misin?'], 500);
  } else {
    await botSoyle([mesaj], 0);
  }
}

if (form && girdi) form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const metin = girdi.value.trim();
  if (!metin) { girdi.focus(); return; }
  if (($<HTMLInputElement>('input[name=web]', form)?.value ?? '') !== '') return; // bot tuzağı
  girdi.value = '';
  benSoyle(metin);
  if (EPOSTA.test(metin)) return aboneOl(metin);
  if (form.dataset.mod === 'abone') return botSoyle(['bu bir e-posta adresine benzemiyor. <b>ornek@site.com</b> gibi yazar mısın?']);
  return botSoyle([
    'şimdilik sadece aşağıdaki seçeneklerle konuşabiliyorum.',
    'ama e-posta adresini yazarsan bülteni her pazartesi sana da gönderirim.',
  ]);
});

if (form) $('[data-kapat]', form)?.addEventListener('click', () => aboneModu(false));

// Sohbetin içindeki "e-posta adresimi yazayım" düğmesi kutuyu yeniden açar
document.addEventListener('click', (e) => {
  if ((e.target as Element).closest('[data-kutu]')) aboneModu(true);
});

// ---------------------------------------------------------------- sohbet dalları

type Durum = { intro: boolean; acik: string[] };
const durumKey = `p:durum:${sayfa}`;
const durum: Durum = (() => {
  try { return { intro: false, acik: [], ...JSON.parse(ss.get(durumKey) ?? '{}') }; } catch { return { intro: false, acik: [] }; }
})();
const kaydet = () => ss.set(durumKey, JSON.stringify(durum));
const dal = (ad: string) => sohbet ? $(`[data-dal="${ad}"]`, sohbet) : null;
const acik = (ad: string) => !!dal(ad)?.classList.contains('acik');
const tumDallar = () => (sohbet ? $$('[data-dal]', sohbet).map((d) => d.dataset.dal!) : []);
// "Hepsini göster" yalnızca içerik dallarını açar; abonelik bir eylem, içerik değil.
const icerikDallari = () => tumDallar().filter((d) => d !== 'abone');

function chipGuncelle() {
  if (!chipler) return;
  const abone = aboneOldu || form?.dataset.mod === 'abone';
  for (const c of $$<HTMLButtonElement>('button.chip', chipler)) {
    const ac = c.dataset.ac!;
    let gizle = false;
    if (ac === 'abone') gizle = abone;
    else if (ac === 'hepsi') gizle = !sohbet || icerikDallari().every(acik);
    else gizle = acik(ac);
    c.hidden = gizle;
  }
}

async function dalAc(ad: string, animasyon: boolean) {
  const sec = dal(ad);
  if (!sec || sec.classList.contains('acik')) return;
  if (bosluk.isConnected) bosluk.before(sec); else akis.append(sec); // sohbetin sonuna: seçilen sırayla akar
  sec.classList.add('acik');
  if (ad !== 'abone' && !durum.acik.includes(ad)) { durum.acik.push(ad); kaydet(); }
  chipGuncelle();
  const [ben, ...gruplar] = [...sec.children] as HTMLElement[];
  if (animasyon) {
    gruplar.forEach((g) => (g.hidden = true));
    ben.classList.add('yeni');
    sonBas = ben;
    yerAc(ben);
    for (const g of gruplar) {
      const av = $('.grp__av', g)?.innerHTML;
      const t = yaziyor(av);
      sec.append(t);
      await bekle(700);
      t.remove();
      g.hidden = false;
      kademeli($('.bs', g)!);
    }
    yerDaralt(ben);
  }
  if (ad === 'abone' && animasyon) aboneModu(true);
}

// Sohbete dönen okur kaldığı yerden devam eder (sekme açık kaldığı sürece)
const konumKey = `p:konum:${sayfa}`;
if (sohbet) {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  let zaman = 0;
  const konumKaydet = () => ss.set(konumKey, String(Math.round(scrollY)));
  addEventListener('scroll', () => { clearTimeout(zaman); zaman = window.setTimeout(konumKaydet, 150); }, { passive: true });
  addEventListener('pagehide', konumKaydet);
}

function konumaDon(y: number) {
  // Son açılan konunun altındaki boşluk yeniden kurulmadıysa sayfa kısa kalabilir
  const enFazla = document.documentElement.scrollHeight - innerHeight;
  if (y > enFazla) {
    akis.append(bosluk);
    bosluk.style.height = `${y - enFazla}px`;
  }
  scrollTo(0, y);
}

async function giris() {
  if (!sohbet) return;
  const konum = Number(ss.get(konumKey)) || 0;
  const hedef = location.hash.slice(1);
  const hashDal: Record<string, string> = { 'ne-oldu': 'ne-oldu', yazilar: 'yazilar', 'parantez-disi': 'disari', abone: 'abone' };
  const adimlar = $$('[data-adim]', sohbet);

  const introKey = `p:intro:${sayfa}`;
  const gorulmus = ls.get(introKey) === '1' || sohbet.hasAttribute('data-arsiv');
  if (!durum.intro && !gorulmus && !azHareket && !hashDal[hedef]) {
    chipler?.classList.add('bekliyor');
    adimlar.forEach((a) => (a.hidden = true));
    await bekle(250);
    for (const a of adimlar) {
      const t = yaziyor($('.grp__av', a)?.innerHTML);
      a.before(t);
      await bekle(a.matches('.grp--devam') ? 900 : 650);
      t.remove();
      a.hidden = false;
      kademeli($('.bs', a)!);
    }
    durum.intro = true;
    kaydet();
    ls.set(introKey, '1');
    chipler?.classList.remove('bekliyor');
    chipler?.classList.add('yeni');
    ipucu();
  } else {
    durum.intro = true;
    kaydet();
  }

  for (const ad of durum.acik.filter((a) => a !== 'abone')) await dalAc(ad, false);
  if (hashDal[hedef]) {
    await dalAc(hashDal[hedef], false);
    if (hashDal[hedef] === 'abone') aboneModu(true, false);
    const sec = dal(hashDal[hedef]);
    const geriGeldi = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'back_forward';
    if (geriGeldi && konum > 0) konumaDon(konum);
    else if (sec) requestAnimationFrame(() => goster(sec));
  } else if (konum > 0) {
    konumaDon(konum);
  }
  chipGuncelle();
}

chipler?.addEventListener('click', async (e) => {
  const c = (e.target as Element).closest<HTMLButtonElement>('button.chip');
  if (!c) return;
  const ac = c.dataset.ac!;
  if (ac === 'hepsi') {
    bosluk.remove();
    const kapali = icerikDallari().filter((d) => !acik(d));
    for (const d of kapali) await dalAc(d, false);
    const ilk = kapali[0] && dal(kapali[0]);
    if (ilk) goster(ilk);
    return;
  }
  if (dal(ac)) {
    if (!acik(ac)) return dalAc(ac, true);
    if (ac === 'abone') aboneModu(true); // konuşma zaten açık: sadece kutuyu aç
    return;
  }
  if (ac === 'abone') {
    benSoyle(c.dataset.soz ?? 'abone olmak istiyorum');
    aboneModu(true);
    await botSoyle([
      'çok iyi. her pazartesi 07:30’da tek bir e-posta: haftanın özeti ve beş yazı. ücretsiz, tek tıkla çıkış.',
      'e-posta adresini aşağıya yazar mısın?',
    ]);
  }
});

// ---------------------------------------------------------------- tepkiler

type Sayilar = Record<string, Record<string, number>>;
const tepki = { sayilar: {} as Sayilar, benim: {} as Record<string, string>, acik: false };

// Markdown'dan gelen paragraflara sırayla kimlik ver (p1, p2…)
for (const f of $$('.flow')) {
  const on = f.dataset.flow || 'p';
  let i = 0;
  for (const el of [...f.children] as HTMLElement[]) {
    if (el.matches('p, ul, ol, blockquote') && !el.dataset.tepki) el.dataset.tepki = `${on}${++i}`;
  }
}

function ciz(id: string) {
  const el = $(`[data-tepki="${CSS.escape(id)}"]`);
  if (!el) return;
  const sayilar = Object.entries(tepki.sayilar[id] ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  let kutu = $(':scope > .tk', el);
  if (!sayilar.length) { kutu?.remove(); el.classList.remove('has-tk'); return; }
  if (!kutu) { kutu = document.createElement('span'); kutu.className = 'tk'; el.append(kutu); }
  el.classList.add('has-tk');
  kutu.innerHTML = sayilar.map(([e, n]) =>
    `<button type="button" class="tkb${tepki.benim[id] === e ? ' on' : ''}" data-e="${e}" aria-label="${e} ${n}">${e}<span>${n}</span></button>`).join('');
}

async function tepkiYukle() {
  if (!sayfa) return;
  try {
    const r = await fetch(`/api/tepki?sayfa=${encodeURIComponent(sayfa)}&k=${kimlik()}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) return;
    const j = await r.json();
    tepki.sayilar = j.sayilar ?? {};
    tepki.benim = j.benim ?? {};
    tepki.acik = true;
    document.body.classList.add('tepkili');
    Object.keys(tepki.sayilar).forEach(ciz);
  } catch { /* tepkiler kapalı: sayfa yine çalışır */ }
}

async function tepkiVer(id: string, emoji: string) {
  const once = tepki.benim[id];
  const eski = { ...(tepki.sayilar[id] ?? {}) };
  const yeni = { ...eski };
  if (once) yeni[once] = Math.max(0, (yeni[once] ?? 1) - 1);
  const secim = once === emoji ? '' : emoji;
  if (secim) yeni[secim] = (yeni[secim] ?? 0) + 1;
  tepki.sayilar[id] = yeni;
  if (secim) tepki.benim[id] = secim; else delete tepki.benim[id];
  ciz(id);
  try {
    const r = await fetch('/api/tepki', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sayfa, mesaj: id, emoji, k: kimlik() }),
    });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    tepki.sayilar[id] = j.sayilar ?? {};
    if (j.benim) tepki.benim[id] = j.benim; else delete tepki.benim[id];
    ciz(id);
  } catch (err) {
    tepki.sayilar[id] = eski;
    if (once) tepki.benim[id] = once; else delete tepki.benim[id];
    ciz(id);
    toast(String(err).includes('429') ? 'biraz yavaş: çok hızlı tepki veriyorsun.' : 'tepki gönderilemedi. bağlantını kontrol eder misin?');
  }
}

let secili: HTMLElement | null = null;
function pickerKapat() {
  picker.hidden = true;
  secili?.classList.remove('secili');
  secili = null;
}
function pickerAc(el: HTMLElement) {
  if (secili === el) return pickerKapat();
  pickerKapat();
  secili = el;
  el.classList.add('secili');
  const id = el.dataset.tepki!;
  picker.dataset.id = id;
  picker.innerHTML = EMOJI.map((e) => `<button type="button" data-e="${e}" class="${tepki.benim[id] === e ? 'on' : ''}" aria-label="${e} ile tepki ver">${e}</button>`).join('');
  picker.hidden = false;
  const r = el.getBoundingClientRect();
  const w = picker.offsetWidth;
  const h = picker.offsetHeight;
  const ust = ($('.bar')?.getBoundingClientRect().bottom ?? 0) + 8;
  const sag = el.closest('.me');
  let left = sag ? r.right - w : r.left;
  left = Math.max(8, Math.min(left, innerWidth - w - 8));
  let top = r.top - h - 8;
  if (top < ust) top = Math.min(r.bottom + 8, innerHeight - h - 8);
  picker.style.left = `${left}px`;
  picker.style.top = `${top}px`;
  $<HTMLButtonElement>('button', picker)?.focus({ preventScroll: true });
}

document.addEventListener('click', (e) => {
  const t = e.target as Element;
  const pb = t.closest<HTMLButtonElement>('[data-picker] button');
  if (pb) { tepkiVer(picker.dataset.id!, pb.dataset.e!); pickerKapat(); return; }
  const tkb = t.closest<HTMLButtonElement>('.tkb');
  if (tkb) { const el = tkb.closest<HTMLElement>('[data-tepki]'); if (el) tepkiVer(el.dataset.tepki!, tkb.dataset.e!); return; }
  if (!tepki.acik) return;
  const bub = t.closest<HTMLElement>('[data-tepki]');
  const etkilesim = t.closest('a, button, input, select, textarea, summary, label');
  if (bub && !etkilesim && !getSelection()?.toString()) { pickerAc(bub); return; }
  if (!picker.hidden && !t.closest('[data-picker]')) pickerKapat();
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !picker.hidden) pickerKapat(); });
addEventListener('scroll', () => { if (!picker.hidden) pickerKapat(); }, { passive: true });
addEventListener('resize', () => { if (!picker.hidden) pickerKapat(); });

function ipucu() {
  if (!tepki.acik || ls.get('p:ipucu')) return;
  ls.set('p:ipucu', '1');
  toast(matchMedia('(pointer: coarse)').matches ? 'ipucu: mesaja dokun, tepki bırak' : 'ipucu: mesaja tıkla, tepki bırak', 3200);
}

// ---------------------------------------------------------------- başlat

if (form?.dataset.mod === 'abone') aboneModu(true, false);
chipGuncelle();
tepkiYukle().then(() => { if (!sohbet) ipucu(); });
giris();
