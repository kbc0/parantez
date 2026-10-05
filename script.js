// Görsel yüklenmezse gri kutu kalsın
document.querySelectorAll(".ph img").forEach(function (img) {
  function broken() { img.classList.add("is-broken"); }
  if (img.complete && img.naturalWidth === 0) broken();
  img.addEventListener("error", broken);
});

// İçindekiler menüsü
var menu = document.querySelector("[data-menu]");
document.querySelector("[data-open]").addEventListener("click", function () {
  menu.hidden = false;
});
document.querySelectorAll("[data-close]").forEach(function (el) {
  el.addEventListener("click", function () { menu.hidden = true; });
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") menu.hidden = true;
});

// Abonelik (konsept: veri gönderilmez)
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
