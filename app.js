(function () {
  var D = window.PARANTEZ;
  var main = document.querySelector("[data-main]");
  var page = document.body.dataset.page;

  function img(seed, w, h) { return "https://picsum.photos/seed/" + seed + "/" + w + "/" + h; }
  function link(a) { return "haber.html?h=" + a.slug; }

  function badges(a) {
    return (a.podcast ? '<span class="badge" title="Podcast\'te de var">P</span>' : "") +
      '<span class="badge">G</span><span class="cat">' + a.cat + "</span>";
  }

  function card(a) {
    return '<article class="card">' +
      '<h3><a href="' + link(a) + '">' + a.title + "</a></h3>" +
      '<div class="meta">' + badges(a) + "<time>" + a.date + "</time></div>" +
      '<a href="' + link(a) + '" class="ph" tabindex="-1" aria-hidden="true"><img src="' + img(a.img, 800, 540) + '" alt="" loading="lazy"></a>' +
      "</article>";
  }

  function rows(cells) {
    var out = "";
    for (var i = 0; i < cells.length; i += 3) out += '<div class="row">' + cells.slice(i, i + 3).join("") + "</div>";
    return out;
  }

  function sec(letter, title, aside) {
    return '<h2 class="sec"><span class="badge badge--lg">' + letter + "</span><span class=\"sec__t\">" + title + "</span>" +
      (aside ? '<span class="sec__aside">' + aside + "</span>" : "") + "</h2>";
  }

  var subForm =
    '<form class="sub" id="abone" data-signup>' +
    '<p class="sub__title">Her sabah 07:30. Beş dakika. Ücretsiz.</p>' +
    '<label for="email" class="sr">E-posta</label>' +
    '<input id="email" type="email" required placeholder="E-posta adresin" autocomplete="email">' +
    '<button type="submit">Abone ol</button></form>';

  // ---------- pages ----------
  if (page === "home") {
    main.innerHTML =
      "<section>" + sec("G", "Gündem", "Sayı " + D.issue.no + " · " + D.issue.long) +
      rows(D.today.map(card).concat(subForm)) + "</section>" +
      '<a class="more" href="arsiv.html"><span>Önceki sayılar</span><span>Arşiv →</span></a>';
  }

  if (page === "archive") {
    main.innerHTML =
      '<section class="archive">' + sec("G", "Gündem arşivi") + rows(D.archive.map(card)) + "</section>" +
      '<a class="more" href="index.html"><span>Bugünün gündemi</span><span>← Sayı ' + D.issue.no + "</span></a>";
  }

  if (page === "article") {
    var slug = new URLSearchParams(location.search).get("h");
    var list = D.today, a = null;
    [D.today, D.archive].forEach(function (l) {
      l.forEach(function (x) { if (x.slug === slug) { a = x; list = l; } });
    });

    if (!a) {
      main.innerHTML = sec("?", "Bulunamadı") +
        '<p class="art__lede" style="margin-top:28px">Bu haber yok ya da kaldırılmış.</p>' +
        '<a class="more" href="index.html"><span>Bugünün gündemi</span><span>→</span></a>';
    } else {
      document.title = a.title + " — (parantez)";
      var i = list.indexOf(a);
      var prev = list[i - 1], next = list[i + 1];

      var body = a.body.map(function (b) {
        return typeof b === "string" ? "<p>" + b + "</p>" : "<h2>" + b.h + "</h2>";
      }).join("");

      var others = D.today.filter(function (x) { return x !== a; }).slice(0, 3);

      main.innerHTML =
        '<article class="art">' +
          '<div class="meta art__meta">' + badges(a) + "<time>" + a.date + "</time></div>" +
          '<h1 class="art__title">' + a.title + "</h1>" +
          '<div class="art__grid">' +
            '<aside class="art__side">' +
              '<dl class="facts">' +
                "<div><dt>Yazan</dt><dd>" + a.author + "</dd></div>" +
                "<div><dt>Okuma</dt><dd>" + a.read + "</dd></div>" +
                "<div><dt>Bölüm</dt><dd>Gündem / " + a.cat + "</dd></div>" +
                (a.podcast ? "<div><dt>Dinle</dt><dd><a href=\"#\">Parantez Arası →</a></dd></div>" : "") +
              "</dl>" +
              '<div class="points"><h4>Kısaca</h4><ol>' +
                a.points.map(function (p) { return "<li>" + p + "</li>"; }).join("") +
              "</ol></div>" +
            "</aside>" +
            '<div class="art__body">' +
              '<p class="art__lede">' + a.lede + "</p>" +
              '<figure class="ph ph--wide"><img src="' + img(a.img, 1600, 900) + '" alt=""></figure>' +
              body +
              '<div class="why"><h4>Neden önemli?</h4><p>' + a.why + "</p></div>" +
              '<p class="art__note">Bu bir konsept çalışmasıdır; içerik ve rakamlar örnek amaçlıdır.</p>' +
            "</div>" +
          "</div>" +
          '<nav class="row art__nav">' +
            (prev ? '<a href="' + link(prev) + '"><small>← Önceki</small>' + prev.title + "</a>" : "<span></span>") +
            (next ? '<a href="' + link(next) + '"><small>Sonraki →</small>' + next.title + "</a>" : '<a href="index.html"><small>Bitti →</small>Bugünün gündemine dön</a>') +
          "</nav>" +
        "</article>" +
        '<section class="more-sec">' + sec("G", "Bugünün gündeminden") + rows(others.map(card)) + "</section>";
    }
  }

  // ---------- içindekiler (dropdown) ----------
  var btn = document.querySelector("[data-toc-btn]");
  var toc = document.querySelector("[data-toc]");
  toc.innerHTML =
    '<p class="dropdown__head">Sayı ' + D.issue.no + " · " + D.issue.long + "</p>" +
    "<ol>" + D.today.map(function (a, n) {
      return '<li><a href="' + link(a) + '"><span class="dropdown__no">' + String(n + 1).padStart(2, "0") + "</span>" + a.title + "</a></li>";
    }).join("") + "</ol>" +
    '<div class="dropdown__foot"><a href="arsiv.html">Arşiv →</a><a href="index.html#abone">Abone ol →</a></div>';

  function setToc(open) {
    toc.hidden = !open;
    btn.setAttribute("aria-expanded", open);
  }
  btn.addEventListener("click", function (e) { e.stopPropagation(); setToc(toc.hidden); });
  document.addEventListener("click", function (e) { if (!toc.hidden && !toc.contains(e.target)) setToc(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setToc(false); });

  // ---------- görsel yüklenmezse gri kutu ----------
  document.querySelectorAll(".ph img").forEach(function (im) {
    function broken() { im.classList.add("is-broken"); }
    if (im.complete && im.naturalWidth === 0) broken();
    im.addEventListener("error", broken);
  });

  // ---------- abonelik (konsept: veri gönderilmez) ----------
  document.querySelectorAll("[data-signup]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = document.createElement("p");
      ok.className = "sub__ok";
      ok.textContent = "Tamamdır. Yarın 07:30'da gelen kutundayız.";
      form.classList.add("is-done");
      form.appendChild(ok);
    });
  });
})();
