// Her yayındaki sayının e-postası, site derlenirken hazırlanır: /bulten/<no>.json → { konu, html, text }.
// Zamanlayıcı (worker/gonderim.js) gönderimi bu dosyadan yapar; böylece hem sitenin o sayıyla
// güncellendiğini anlar hem de gönderim sırasında içerik işlemek zorunda kalmaz.
// Şablon worker/bulten.js'te; panelin önizlemesi de aynısını kullanır. {{CIK}} her alıcıya özel doldurulur.
import type { APIRoute } from 'astro';
import ekip from '../../data/ekip.json';
import { sayilar, sayininYazilari, type Sayi } from '../../lib/site';
import { bultenHtml } from '../../../worker/bulten.js';

export async function getStaticPaths() {
  return (await sayilar()).map((s) => ({ params: { sayi: String(s.data.sayi) }, props: { s } }));
}

const gun = (d: Date) => d.toISOString().slice(0, 10);

export const GET: APIRoute = async ({ props, site }) => {
  const s = (props as { s: Sayi }).s;
  const d = s.data;
  const yazilar = await sayininYazilari(d.sayi);
  const b = bultenHtml({ SITE_ADRESI: site?.href }, {
    sayi: {
      yol: `src/content/sayilar/${s.id}.md`,
      govde: s.body ?? '',
      veri: {
        ...d, yayin: gun(d.yayin), baslangic: gun(d.baslangic), bitis: gun(d.bitis), oneriler: d.oneriler ?? {},
        etkinlikler: (d.etkinlikler ?? []).map((e) => ({ ...e, tarih: gun(e.tarih) })),
      },
    },
    yazilar: yazilar.map((y) => ({ yol: `src/content/yazilar/${y.id}.md`, veri: y.data, govde: y.body ?? '' })),
    ekip,
  });
  return new Response(JSON.stringify({ sayi: d.sayi, konu: b.konu, html: b.html, text: b.text }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
