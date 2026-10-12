// Resend ile e-posta gönderimi (https://resend.com/docs/api-reference).
//
// Gerekenler (Cloudflare → Worker → Ayarlar → Değişkenler):
//   RESEND_API_KEY — Resend'deki API anahtarı (gizli)
//   BULTEN_KIMDEN  — gönderen, ör. "(parantez) <bulten@parantezbulten.com>" (wrangler.jsonc'de)
//   BULTEN_YANIT   — cevapların gideceği adres (isteğe bağlı)
//   RESEND_API     — yalnızca yerel denemelerde sahte sunucu için

export class EpostaHatasi extends Error {
  constructor(status, mesaj, ad = '') {
    super(mesaj);
    this.status = status;
    this.ad = ad; // Resend'in hata adı: daily_quota_exceeded, rate_limit_exceeded, validation_error…
  }
}

export const KIMDEN = '(parantez) <bulten@parantezbulten.com>';

export function eposta(env, f = fetch) {
  const api = (env.RESEND_API || 'https://api.resend.com').replace(/\/$/, '');
  const kimden = env.BULTEN_KIMDEN || KIMDEN;
  const yanit = env.BULTEN_YANIT || undefined;

  async function istek(yol, govde, anahtar) {
    const r = await f(api + yol, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'parantez-bulten',
        ...(anahtar ? { 'Idempotency-Key': anahtar } : {}),
      },
      body: typeof govde === 'string' ? govde : JSON.stringify(govde),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new EpostaHatasi(r.status, `Resend ${r.status}: ${j.message || j.name || 'bilinmeyen hata'}`, j.name || '');
    return j;
  }

  const mektup = (m) => ({ from: kimden, ...(yanit ? { reply_to: yanit } : {}), ...m });

  return {
    kimden,
    yanit,
    // Tek e-posta: { to, subject, html, text, headers? }
    gonder: (m, anahtar) => istek('/emails', mektup(m), anahtar),
    // En fazla 100 e-posta tek istekte. Aynı anahtarla tekrar gönderilen istek (24 saat) yeniden gitmez.
    // Liste yerine hazır JSON metni de verilebilir (bkz. bulten.js partiGovdesi).
    toplu: (liste, anahtar) => istek('/emails/batch', typeof liste === 'string' ? liste : liste.map(mektup), anahtar),
  };
}

// Panelde ve günlükte gösterilecek kısa açıklama
export function epostaHataMetni(e) {
  if (e.ad === 'daily_quota_exceeded') return 'Resend\'in günlük gönderim sınırı doldu (ücretsiz planda günde 100 e-posta).';
  if (e.ad === 'monthly_quota_exceeded') return 'Resend\'in aylık gönderim sınırı doldu.';
  if (e.ad === 'rate_limit_exceeded') return 'Resend hız sınırına takıldı; biraz sonra devam edecek.';
  if (e.status === 401 || e.ad === 'missing_api_key' || e.ad === 'invalid_api_key') return 'Resend anahtarı geçersiz. Cloudflare\'deki RESEND_API_KEY\'i kontrol edin.';
  if (e.status === 403) return `Resend gönderimi reddetti; alan adı doğrulanmamış olabilir. (${e.message})`;
  return e.message;
}

// E-postalardaki metinler için HTML kaçışı
export const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
