// Metin içindeki basit çubuk grafikler. Yazan, Markdown'a şöyle bir blok koyar:
//
//   ```grafik
//   Gençlerin kiraya ayırdığı pay
//   birim: %
//   Gelirin yarısından fazlası: 41 *
//   Üçte biri ile yarısı arası: 33
//   Üçte birinden azı: 26
//   kaynak: (parantez) araştırma anketi, Eylül 2026
//   ```
//
// İlk satır başlık, "etiket: sayı" satırları çubuk. Sonuna * konan satır vurgulanır,
// diğerleri griye döner. Sayılar Türkçe yazılır (1.240 · 12,5).
// Çıktı bir tablo: JavaScript'siz çalışır, ekran okuyucu tabloyu okur.
// Site (astro.config.mjs'teki Markdown eklentisi) ve panelin önizlemesi aynı işlevi kullanır.

const kacis = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** "1.240" → 1240, "12,5" → 12.5 */
function sayi(yazi) {
  const n = Number(yazi.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** @param {string} kaynak */
export function grafikOku(kaynak) {
  const g = { baslik: '', birim: '', kaynak: '', satirlar: /** @type {{ etiket: string, deger: number, yazi: string, vurgu: boolean }[]} */ ([]) };
  for (const ham of String(kaynak).split('\n')) {
    const satir = ham.trim();
    if (!satir) continue;
    const m = satir.match(/^(.+?):\s*(.*)$/);
    const anahtar = m?.[1].trim().toLocaleLowerCase('tr');
    if (m && (anahtar === 'birim')) { g.birim = m[2].trim(); continue; }
    if (m && (anahtar === 'kaynak')) { g.kaynak = m[2].trim(); continue; }
    if (m && (anahtar === 'başlık' || anahtar === 'baslik')) { g.baslik = m[2].trim(); continue; }
    const d = m?.[2].match(/^(-?[\d.,\s]+?)\s*(\*)?$/);
    if (m && d && Number.isFinite(sayi(d[1]))) {
      g.satirlar.push({ etiket: m[1].trim(), deger: Math.max(0, sayi(d[1])), yazi: d[1].trim(), vurgu: !!d[2] });
      continue;
    }
    if (!g.baslik && !g.satirlar.length) g.baslik = satir;
  }
  g.satirlar = g.satirlar.slice(0, 12);
  return g;
}

/** @param {string} kaynak */
export function grafikHtml(kaynak) {
  const g = grafikOku(kaynak);
  if (!g.satirlar.length) return '';
  const enBuyuk = Math.max(...g.satirlar.map((s) => s.deger)) || 1;
  const vurguVar = g.satirlar.some((s) => s.vurgu);
  // Yüzde işareti Türkçede sayının önüne gelir (%62); diğer birimler arkaya (62 TL)
  const deger = (y) => (g.birim === '%' ? `%${y}` : g.birim ? `${y} ${g.birim}` : y);
  const satirlar = g.satirlar.map((s) => `
    <tr${vurguVar && !s.vurgu ? ' class="grafik__soluk"' : ''}>
      <th scope="row">${kacis(s.etiket)}</th>
      <td><span class="grafik__cubuk" style="--o:${(s.deger / enBuyuk).toFixed(4)}"></span><span class="grafik__deger">${kacis(deger(s.yazi))}</span></td>
    </tr>`).join('');
  return `<figure class="grafik">
  ${g.baslik ? `<figcaption>${kacis(g.baslik)}</figcaption>` : ''}
  <table><tbody>${satirlar}
  </tbody></table>
  ${g.kaynak ? `<p class="grafik__kaynak">Kaynak: ${kacis(g.kaynak.replace(/^kaynak:\s*/i, ''))}</p>` : ''}
</figure>`;
}
