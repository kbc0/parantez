// (parantez) — haftalık e-posta. Sayının sohbet hâlinin e-postadaki karşılığı:
// editörün selamı ve haftanın cümlesi, özet, beş yazı, kısa kısa, parantez dışı.
// İçerik GitHub'dan okunur (gizli sayı da önizlenebilsin diye); şablon burada.
// Sohbetin düzeni (src/components/IssueChat.astro) değişirse burası da gözden geçirilmeli.
//
// E-posta istemcileri için: tablo düzeni, satır içi stiller, en fazla 600 px.
// {{CIK}} her alıcının kendi "abonelikten çık" adresiyle değiştirilir.

import { Marked } from 'marked';
import { github } from './github.js';
import { h, KIMDEN } from './eposta.js';
import { siteAdresi } from './abonelik.js';
import { sayiOku, yaziOku } from '../src/scripts/panel-icerik.ts';
import { KONULAR, KONU_RENK } from '../src/lib/konular.ts';

export const CIK = '{{CIK}}';

const YAZI = "'Hanken Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const AYK = ['OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const FIIL = { dinle: 'Dinle', izle: 'İzle', oku: 'Oku' };
const PARANTEZ = { ad: '(parantez)', kisa: '(p)', renk: '#111111', rol: '' };

const pad = (n) => String(n).padStart(2, '0');
const gun = (iso) => new Date(`${iso}T12:00:00Z`);
const tarihUzun = (iso) => { const d = gun(iso); return `${d.getUTCDate()} ${AYLAR[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const gunAdi = (iso) => GUNLER[gun(iso).getUTCDay()];
const buyuk = (s) => s.toLocaleUpperCase('tr');
const konuAdi = (k) => KONULAR[k] ?? k;
const konuRenk = (k) => KONU_RENK[k] ?? '#8b8b86';

// Sayının yayın günü, Türkiye saatiyle 07:30 (UTC+3)
export const gonderimZamani = (yayin) => Date.parse(`${yayin}T04:30:00Z`);

// Ham HTML yazılmaz; yalnızca kalın, italik ve bağlantı
const md = new Marked({ renderer: { html: () => '' } });
const satirIci = (s) => md.parseInline(s, { async: false })
  .replace(/<a href=/g, '<a style="color:inherit;text-decoration:underline" href=');
const duzMetin = (s) => s.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, '$1 ($2)').replace(/\*\*?|__?|`/g, '');
const paragraflar = (govde) => govde.replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

function okumaSuresi(y) {
  const metin = [y.veri.spot, y.govde, y.veri.neden, ...y.veri.kisaca].join(' ');
  return Math.max(1, Math.ceil(metin.replace(/[#>*_`]/g, ' ').split(/\s+/).filter(Boolean).length / 180));
}

// ------------------------------------------------------------------ içerik

// Ön bilginin "sayi:" satırı bu sayıysa. Bütün arşivi YAML olarak okumamak için (Worker'ın işlemci sınırı).
export const buSayinin = (no) => (d) => new RegExp(`^sayi:\\s*["']?0*${no}["']?\\s*$`, 'm').test(d.metin.split(/\n---/)[0]);

// Sayı, yayındaki (gizli olmayan) yazıları ve ekip. Sayı yoksa null.
export async function bultenVerisi(env, no) {
  const ic = await github(env).icerik();
  const sayi = ic.sayilar.filter(buSayinin(no)).map(sayiOku).find((s) => s.veri.sayi === no);
  if (!sayi) return null;
  const yazilar = ic.yazilar.filter(buSayinin(no)).map(yaziOku)
    .filter((y) => y.veri.sayi === no && !y.veri.taslak)
    .sort((a, b) => a.veri.sira - b.veri.sira);
  let ekip = [];
  try { ekip = JSON.parse(ic.ekip?.metin || '[]'); } catch { /* bozuk liste */ }
  return { sayi, yazilar, ekip };
}

// Göndermeden önce bakılacaklar (panelde gösterilir)
export function bultenUyarilari({ sayi, yazilar }) {
  const u = [];
  if (!yazilar.length) u.push('Bu sayıda yayına çıkacak yazı yok.');
  else if (yazilar.length !== 5) u.push(`Bu sayıda ${yazilar.length} yazı var.`);
  if (!sayi.govde.trim()) u.push('Haftanın özeti boş.');
  if (!sayi.veri.baslik) u.push('Haftanın cümlesi boş; e-postanın konusu olacak.');
  return u;
}

// ------------------------------------------------------------------ şablon

function avatar(k) {
  const boyut = k.kisa === '(p)' ? 11 : 12;
  return `<div style="width:36px;height:36px;border-radius:50%;background:${h(k.renk || '#8b8b86')};color:#ffffff;font-size:${boyut}px;font-weight:800;line-height:36px;text-align:center;letter-spacing:-0.04em">${h(k.kisa)}</div>`;
}

const ARA = '<div style="height:4px;line-height:4px;font-size:4px">&nbsp;</div>';
const balon = (ic, ek = '') => `<div style="display:inline-block;max-width:520px;padding:10px 14px;border-radius:20px;background:#f1f1ed;color:#111111;font-size:17px;line-height:1.5;${ek}">${ic}</div>`;

function grup(k, parcalar, isim = true) {
  const rol = k.kisa !== '(p)' && k.rol ? ` · ${h(k.rol)}` : '';
  return `<tr><td style="padding:16px 0 0">
${isim ? `<div style="margin:0 0 4px 44px;font-size:12px;font-weight:600;color:#84847f">${h(k.ad)}${rol}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="44" valign="top" style="width:44px">${avatar(k)}</td>
<td valign="top">${parcalar.join(ARA)}</td>
</tr></table></td></tr>`;
}

const okur = (metin) => `<tr><td align="right" style="padding:16px 0 0"><div style="display:inline-block;max-width:84%;padding:10px 14px;border-radius:20px 20px 6px 20px;background:#2a35ff;color:#ffffff;font-size:17px;line-height:1.5;text-align:left">${h(metin)}</div></td></tr>`;

const kart = (ic, ust = '') => `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:460px;border:1px solid #e7e7e2;border-radius:18px;border-collapse:separate;background:#ffffff">${ust}<tr><td style="padding:12px 14px 13px">${ic}</td></tr></table>`;

function yaziKarti(y, site) {
  const v = y.veri;
  const adres = `${site}/yazi/${y.yol.split('/').pop().replace(/\.md$/, '')}/`;
  return kart(`
<div style="font-size:12px;font-weight:700;color:#84847f">${pad(v.sira)} · ${h(konuAdi(v.konu))} · ${okumaSuresi(y)} dk</div>
<a href="${h(adres)}" style="display:block;margin-top:4px;font-size:17px;font-weight:800;line-height:1.22;letter-spacing:-0.01em;color:#111111;text-decoration:none">${h(v.baslik)}</a>
<div style="margin-top:4px;font-size:14px;line-height:1.4;color:#55554f">${h(v.spot)}</div>`,
  `<tr><td style="height:5px;line-height:5px;font-size:5px;background:${h(konuRenk(v.konu))};border-radius:17px 17px 0 0">&nbsp;</td></tr>`);
}

function oneriKarti(k, o) {
  return kart(`
<div style="font-size:12px;font-weight:800;letter-spacing:.04em;color:#ff4a24">${h(buyuk(`${FIIL[k]} · ${o.tur}`))}</div>
<div style="margin-top:4px;font-size:21px;font-weight:800;line-height:1.12;letter-spacing:-0.02em">${h(o.baslik)}</div>
<div style="margin-top:2px;font-size:14px;color:#84847f">${h(o.kimden)}</div>
<div style="margin-top:8px;font-size:16px;line-height:1.45">${h(o.not)}</div>
${o.link ? `<a href="${h(o.link)}" style="display:inline-block;margin-top:8px;font-size:14px;font-weight:700;color:#2a35ff">${h(o.linkMetni || `${FIIL[k]} →`)}</a>` : ''}`);
}

function etkinlikSatiri(e) {
  const d = gun(e.tarih);
  const ucretsiz = /ücretsiz|bedava/i.test(e.ucret);
  const ad = e.link ? `<a href="${h(e.link)}" style="color:#111111">${h(e.ad)}</a>` : h(e.ad);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:460px;border:1px solid #e7e7e2;border-radius:20px;border-collapse:separate;background:#ffffff"><tr>
<td width="66" valign="middle" style="width:66px;padding:10px 0 10px 12px"><div style="width:54px;padding:9px 0;border-radius:14px;background:#111111;color:#ffffff;text-align:center;line-height:1"><div style="font-size:22px;font-weight:800">${d.getUTCDate()}</div><div style="margin-top:3px;font-size:10px;font-weight:700;letter-spacing:.06em">${AYK[d.getUTCMonth()]}</div></div></td>
<td valign="middle" style="padding:10px 12px">
<div style="font-size:12px;font-weight:700;color:#84847f">${h(e.tur)} · ${gunAdi(e.tarih)}${e.saat ? ` ${h(e.saat)}` : ''}</div>
<div style="margin-top:2px;font-size:16px;font-weight:800;line-height:1.25">${ad}</div>
<div style="margin-top:2px;font-size:13.5px;color:#55554f">${h(e.yer)} · ${h(e.sehir)}</div>
<div style="margin-top:6px"><span style="display:inline-block;padding:3px 8px;border-radius:99px;background:${ucretsiz ? '#d2ff2e' : '#f1f1ed'};font-size:11px;font-weight:800">${h(buyuk(e.ucret))}</span></div>
</td></tr></table>`;
}

// { konu, html, text, onYazi } — html ve text içinde {{CIK}} yer tutucusu vardır
export function bultenHtml(env, { sayi, yazilar, ekip }) {
  const site = siteAdresi(env);
  const v = sayi.veri;
  const sayiAdresi = `${site}/sayi/${v.sayi}/`;
  const editorAdi = v.imza.split(',')[0].trim();
  const editor = ekip.find((k) => k.ad === editorAdi)
    ?? { ad: editorAdi || '(parantez)', kisa: editorAdi.split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toLocaleUpperCase('tr'), renk: '#8b8b86', rol: v.imza.split(',').slice(1).join(',').trim() };
  const ozet = paragraflar(sayi.govde);
  const toplam = yazilar.reduce((t, y) => t + okumaSuresi(y), 0);
  const oneriler = Object.keys(FIIL).filter((k) => v.oneriler?.[k]).map((k) => [k, v.oneriler[k]]);
  const etkinlikler = [...(v.etkinlikler ?? [])].sort((a, b) => a.tarih.localeCompare(b.tarih));
  const konu = v.baslik || `(parantez) · Sayı ${pad(v.sayi)}`;
  const onYazi = duzMetin(ozet[0] ?? '').split(/(?<=[.!?…])\s/)[0].slice(0, 140);

  const satirlar = [
    `<tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:22px;font-weight:800;letter-spacing:-0.02em"><a href="${h(site)}/" style="color:#111111;text-decoration:none">(parantez)</a></td>
<td align="right" style="font-size:13px;font-weight:600;color:#84847f">Sayı ${pad(v.sayi)}</td></tr></table></td></tr>`,
    `<tr><td align="center" style="padding:22px 0 0;font-size:12px;font-weight:700;letter-spacing:.05em;color:#84847f">${h(buyuk(`Sayı ${pad(v.sayi)} · ${gunAdi(v.yayin)}, ${tarihUzun(v.yayin)} · 07:30`))}</td></tr>`,
    grup(editor, [
      balon('günaydın. bu hafta tek cümle:'),
      balon(h(v.baslik), 'font-size:27px;font-weight:800;line-height:1.08;letter-spacing:-0.03em;padding:13px 16px'),
      ...ozet.map((p) => balon(satirIci(p))),
    ]),
  ];

  if (yazilar.length) {
    satirlar.push(okur('yazıları göster'));
    satirlar.push(grup(PARANTEZ, [
      balon(`bu sayıda ${yazilar.length} yazı, toplam ${toplam} dakika. birine dokun, okumaya başla:`),
      ...yazilar.map((y) => yaziKarti(y, site)),
    ]));
  }
  if (v.kisaKisa.length) {
    satirlar.push(okur('bu hafta ne oldu?'));
    satirlar.push(grup(PARANTEZ, [
      balon(`kısaca ${v.kisaKisa.length} şey:`),
      ...v.kisaKisa.map((k) => balon(`<span style="margin-right:6px;font-size:11px;font-weight:800;letter-spacing:.05em;color:#ff4a24">${h(buyuk(konuAdi(k.konu)))}</span>${h(k.metin)}`)),
    ]));
  }
  if (oneriler.length || etkinlikler.length) {
    satirlar.push(okur('bu hafta ne yapsam?'));
    satirlar.push(grup(PARANTEZ, [
      ...(oneriler.length ? [balon('gündemin dışında kalanlar. dinle, izle, oku:'), ...oneriler.map(([k, o]) => oneriKarti(k, o))] : []),
      ...(etkinlikler.length ? [balon('bir de bu hafta gidilecek yerler:'), ...etkinlikler.map(etkinlikSatiri)] : []),
    ]));
  }
  satirlar.push(`<tr><td style="padding:22px 0 0 44px"><a href="${h(sayiAdresi)}" style="display:inline-block;padding:11px 18px;border:1.5px solid #2a35ff;border-radius:999px;color:#2a35ff;font-size:15px;font-weight:700;text-decoration:none">sohbette aç →</a></td></tr>`);
  satirlar.push(`<tr><td style="padding:36px 0 0"><div style="border-top:1px solid #e7e7e2;padding-top:16px;font-size:13px;line-height:1.6;color:#84847f">
(parantez) · her pazartesi 07:30’da haftanın özeti ve beş yazı.<br>
bu e-postayı <a href="${h(site)}/" style="color:#84847f">parantezbulten.com</a>’a abone olduğun için aldın.
<a href="${CIK}" style="color:#84847f">abonelikten çık</a> · <a href="${h(sayiAdresi)}" style="color:#84847f">tarayıcıda aç</a></div></td></tr>`);

  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<title>${h(konu)}</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700;800&amp;display=swap" rel="stylesheet">
<style>body{margin:0;padding:0;background:#ffffff}@media (max-width:480px){.kap{padding:20px 12px 36px !important}}</style>
</head><body style="margin:0;padding:0;background:#ffffff">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#ffffff">${h(onYazi)}${'&#8199;&#847;'.repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td class="kap" align="center" style="padding:28px 16px 44px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:${YAZI};color:#111111;text-align:left">
${satirlar.join('\n')}
</table></td></tr></table></body></html>`;

  const t = [];
  t.push(buyuk(`Sayı ${pad(v.sayi)} · ${tarihUzun(v.yayin)}`), '');
  t.push('günaydın. bu hafta tek cümle:', v.baslik, '', ...ozet.map((p) => `${duzMetin(p)}\n`), `— ${v.imza}`, '');
  if (yazilar.length) {
    t.push('BU SAYININ YAZILARI', '');
    for (const y of yazilar) t.push(`${pad(y.veri.sira)} · ${konuAdi(y.veri.konu)} · ${okumaSuresi(y)} dk`, y.veri.baslik, y.veri.spot, `${site}/yazi/${y.yol.split('/').pop().replace(/\.md$/, '')}/`, '');
  }
  if (v.kisaKisa.length) {
    t.push('BU HAFTA NE OLDU?', '');
    for (const k of v.kisaKisa) t.push(`- ${konuAdi(k.konu)}: ${k.metin}`);
    t.push('');
  }
  if (oneriler.length) {
    t.push('PARANTEZ DIŞI', '');
    for (const [k, o] of oneriler) t.push(`${FIIL[k]} · ${o.tur}: ${o.baslik} — ${o.kimden}`, o.not, ...(o.link ? [o.link] : []), '');
  }
  if (etkinlikler.length) {
    t.push('GİDİLECEK YERLER', '');
    for (const e of etkinlikler) t.push(`${tarihUzun(e.tarih)} ${gunAdi(e.tarih)}${e.saat ? ` ${e.saat}` : ''} · ${e.ad} · ${e.yer}, ${e.sehir} · ${e.ucret}`);
    t.push('');
  }
  t.push(`sohbette aç: ${sayiAdresi}`, '', `abonelikten çık: ${CIK}`);

  return { konu, html, text: t.join('\n'), onYazi };
}

// Bir parti için Resend'e gidecek JSON, hazır parçalardan birleştirilerek. Her alıcı için e-postayı
// yeniden kaçışlamak bir Worker çalışmasının işlemci sınırını aşıyordu; böylece alıcı başına yalnızca
// çıkış bağlantısı eklenir. Sonuç, her öğesi kisisel() + gönderen olan bir dizinin JSON'ıyla aynıdır.
export function partiGovdesi({ konu, html, text }, alicilar, { kimden, yanit }) {
  const j = (s) => JSON.stringify(s).slice(1, -1);
  const ust = JSON.stringify({ from: kimden, ...(yanit ? { reply_to: yanit } : {}), subject: konu }).slice(0, -1);
  const hp = j(html).split(CIK);
  const tp = j(text).split(CIK);
  return `[${alicilar.map(({ adres, cikis }) => `${ust},"to":${JSON.stringify(adres)},"html":"${hp.join(j(h(cikis)))}","text":"${tp.join(j(cikis))}","headers":${JSON.stringify(cikisBasliklari(cikis))}}`).join(',')}]`;
}

const cikisBasliklari = (cikis) => ({ 'List-Unsubscribe': `<${cikis}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });

// Bir alıcıya özel e-posta: çıkış bağlantısı ve tek tıkla çıkış başlıkları
export function kisisel({ konu, html, text }, adres, cikis) {
  return {
    to: adres,
    subject: konu,
    html: html.replaceAll(CIK, h(cikis)),
    text: text.replaceAll(CIK, cikis),
    headers: cikisBasliklari(cikis),
  };
}

export { KIMDEN };
