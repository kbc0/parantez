# (parantez)

Genç okurlar için günlük bülten girişimi — konsept web sitesi.

Canlı: https://kbc0.github.io/parantez/

Saf HTML/CSS/JS, build adımı yok.

- `index.html` — bugünün gündemi (sadece o günün haberleri)
- `haber.html?h=<slug>` — haber sayfası
- `arsiv.html` — önceki sayılar
- `data.js` — tüm içerik burada; yeni haber eklemek için `today` / `archive` listelerine ekle
- `app.js` — sayfaları `data.js`'ten üretir, içindekiler menüsü, abonelik formu (konsept, veri göndermez)
- `styles.css` — editoryal grid, açık tema

İçerikler ve görseller (picsum.photos) placeholder'dır.
