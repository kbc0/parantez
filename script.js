// Tarih
(function () {
  var el = document.getElementById("today");
  if (!el) return;
  try {
    el.textContent = new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
  } catch (e) {}
})();

// Okundu takibi
(function () {
  var stories = Array.prototype.slice.call(document.querySelectorAll(".story"));
  var count = document.querySelector("[data-count]");
  var bar = document.querySelector("[data-bar]");
  var done = document.querySelector("[data-done]");

  function update() {
    var n = stories.filter(function (s) { return s.classList.contains("is-read"); }).length;
    count.textContent = n;
    bar.style.width = (n / stories.length) * 100 + "%";
    done.hidden = n !== stories.length;
  }

  stories.forEach(function (story) {
    var btn = story.querySelector(".story__check");
    btn.addEventListener("click", function () {
      var on = story.classList.toggle("is-read");
      btn.setAttribute("aria-pressed", on);
      update();
    });
  });
})();

// Abonelik (konsept: gerçek gönderim yok)
document.querySelectorAll("[data-signup]").forEach(function (form) {
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var note = form.querySelector(".signup__note");
    if (note) note.remove();
    var ok = document.createElement("p");
    ok.className = "signup__ok";
    ok.textContent = "Tamamdır (yarın 07:30'da gelen kutundayız).";
    form.classList.add("is-done");
    form.appendChild(ok);
  });
});
