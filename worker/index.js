// (parantez) — Cloudflare Worker
// Statik sayfaları `dist/` klasöründen Cloudflare servis eder; bu dosya yalnızca
// statik dosyası olmayan istekleri (şimdilik sadece /api/abone) karşılar.

const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/abone' || url.pathname === '/api/abone/') {
      return abone(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

async function abone(request, env) {
  const json = (request.headers.get('accept') || '').includes('application/json');
  const yanit = (status, mesaj) =>
    json
      ? Response.json({ ok: status < 300, mesaj }, { status })
      : status < 300
        ? Response.redirect(new URL('/abone/tamam/', request.url), 303)
        : new Response(mesaj, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  if (request.method !== 'POST') {
    return new Response('Yalnızca POST', { status: 405, headers: { allow: 'POST' } });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return yanit(400, 'Form okunamadı.');
  }

  // Bot tuzağı: insanlar bu alanı görmez, doldurmaz.
  if (form.get('web')) return yanit(200, 'Tamamdır.');

  const eposta = String(form.get('eposta') || '').trim().toLowerCase();
  if (!EPOSTA.test(eposta) || eposta.length > 254) {
    return yanit(400, 'Geçerli bir e-posta adresi yaz.');
  }

  if (!env.ABONELER) {
    return yanit(503, 'Abonelik şu an kapalı. Birazdan tekrar dene.');
  }

  const varMi = await env.ABONELER.get(eposta);
  if (varMi) return yanit(200, 'Zaten abonesin. Bülten her pazartesi gelen kutunda.');

  await env.ABONELER.put(
    eposta,
    JSON.stringify({
      tarih: new Date().toISOString(),
      kaynak: String(form.get('kaynak') || 'site').slice(0, 40),
      ulke: request.cf?.country ?? null,
    }),
  );

  return yanit(201, 'Tamamdır. Pazartesi 07:30’da gelen kutundayız.');
}
