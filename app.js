(function () {
  "use strict";

  var DESIGNS = [
    { id: "01", ad: "Gece Nehri", f: "01_Gece_Nehri.jpg" },
    { id: "02", ad: "Bakır Tutulma", f: "02_Bakir_Tutulma.jpg" },
    { id: "03", ad: "Kahve Katedrali", f: "03_Kahve_Katedrali.jpg" },
    { id: "04", ad: "İpek Rota", f: "04_Ipek_Rota.jpg" },
    { id: "05", ad: "Kahve Simyası", f: "05_Kahve_Simyasi.jpg" },
    { id: "06", ad: "Kavrum Spektrumu", f: "06_Kavrum_Spektrumu.jpg" },
    { id: "07", ad: "Gece Bahçesi", f: "07_Gece_Bahcesi.jpg" },
    { id: "08", ad: "Porselen Kırığı", f: "08_Porselen_Kirigi.jpg" },
    { id: "09", ad: "İlk Çatlak", f: "09_Ilk_Catlak.jpg" },
    { id: "10", ad: "Kadife Perde", f: "10_Kadife_Perde.jpg" },
    { id: "11", ad: "Mürekkep Patlaması", f: "11_Murekkep_Patlamasi.jpg" },
    { id: "12", ad: "Gece Lake", f: "12_Gece_Lake.jpg" },
    { id: "13", ad: "Katman", f: "13_Katman.jpg" },
    { id: "14", ad: "Lot Arşivi", f: "14_Lot_Arsivi.jpg" },
    { id: "15", ad: "Koz Yağmuru", f: "15_Koz_Yagmuru.jpg" },
    { id: "16", ad: "Prizma", f: "16_Prizma.jpg" },
    { id: "17", ad: "Modüler Ritim", f: "17_Moduler_Ritim.jpg" },
    { id: "18", ad: "Tek Fırça", f: "18_Tek_Firca.jpg" },
    { id: "19", ad: "Veri Çiçeği", f: "19_Veri_Cicegi.jpg" },
    { id: "20", ad: "İmza", f: "20_Imza.jpg" }
  ];
  DESIGNS.forEach(function (d) { d.src = "img/" + d.f; });

  var PTS = [3, 2, 1];
  var root = document.getElementById("root");

  var votes = [];
  var storeMsg = null;      // depolama bağlı değilse uyarı
  var tab = "oy";
  var picks = [];
  var voter = "";
  var note = "";
  var msg = null;
  var sending = false;
  var loading = true;
  var lbIndex = -1;

  try { voter = localStorage.getItem("coffon_ad") || ""; } catch (e) {}

  // ---------- yardımcılar ----------
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function byId(id) { for (var i = 0; i < DESIGNS.length; i++) if (DESIGNS[i].id === id) return DESIGNS[i]; return null; }
  function adOf(id) { var d = byId(id); return d ? d.id + " · " + d.ad : id; }
  function key(n) { return String(n || "").trim().toLocaleLowerCase("tr").replace(/\s+/g, " "); }

  function scores() {
    var map = {};
    DESIGNS.forEach(function (d) { map[d.id] = { d: d, p: 0, c: [0, 0, 0] }; });
    votes.forEach(function (v) {
      (v.picks || []).slice(0, 3).forEach(function (id, i) {
        if (map[id]) { map[id].p += PTS[i]; map[id].c[i]++; }
      });
    });
    var arr = Object.keys(map).map(function (k) { return map[k]; });
    arr.sort(function (a, b) {
      return b.p - a.p || b.c[0] - a.c[0] || b.c[1] - a.c[1] || (a.d.id < b.d.id ? -1 : 1);
    });
    return arr;
  }

  // ---------- sunucu ----------
  async function api(method, body) {
    var opt = { method: method, headers: { "Content-Type": "application/json" } };
    if (body) opt.body = JSON.stringify(body);
    var r = await fetch("/api/oy", opt);
    var j = await r.json().catch(function () { return { ok: false, mesaj: "Sunucu yanıtı okunamadı." }; });
    if (j.code === "depolama-yok") storeMsg = j.mesaj; else if (j.ok) storeMsg = null;
    if (Array.isArray(j.votes)) votes = j.votes;
    return j;
  }

  async function yukle(sessiz) {
    try { await api("GET"); } catch (e) { if (!sessiz) storeMsg = "Sunucuya ulaşılamadı. Sayfayı yenileyin."; }
    loading = false;
    render();
  }

  // ---------- görünüm ----------
  function render() {
    var s = scores();
    root.innerHTML =
      '<header><div class="wrap">'
      + '<div class="brand"><span class="mark">Coffon</span><span class="sub">20 ambalaj tasarımı</span></div>'
      + "<h1>Hangi ambalaj <em>rafta kazanır?</em></h1>"
      + '<p class="lede">Yirmi tasarımın hepsine bak, en beğendiğin üçünü sırala. İlk seçimin 3, ikincisi 2, üçüncüsü 1 puan kazanır. Sonuçlar herkesin oyuyla anında güncellenir.</p>'
      + '<ul class="rules"><li><b>3</b> seçim</li><li>Puan <b>3 · 2 · 1</b></li><li>Aynı isimle tekrar oy verirsen <b>öncekinin yerini alır</b></li></ul>'
      + '<nav class="tabs">'
      + '<button data-tab="oy" aria-selected="' + (tab === "oy") + '">Oylama</button>'
      + '<button data-tab="son" aria-selected="' + (tab === "son") + '">Sonuçlar <span class="count">' + votes.length + "</span></button>"
      + "</nav></div></header>"
      + '<main class="wrap">' + (storeMsg ? uyariHTML() : "") + (tab === "oy" ? gridHTML() : resultsHTML(s)) + "</main>"
      + (tab === "oy" ? ballotHTML() : "")
      + '<div class="lb" role="dialog" aria-modal="true"></div>';
    var inp = root.querySelector("#adInput"); if (inp) inp.value = voter;
    var nt = root.querySelector("#notInput"); if (nt) nt.value = note;
    if (lbIndex >= 0) paintLB();
  }

  function uyariHTML() {
    return '<div class="warn"><b>Oylar kaydedilmiyor.</b> ' + esc(storeMsg) + "</div>";
  }

  function gridHTML() {
    return '<div class="grid">' + DESIGNS.map(function (d) {
      var r = picks.indexOf(d.id);
      var rank = r >= 0 ? r + 1 : 0;
      return '<article class="card"' + (rank ? ' data-rank="' + rank + '"' : "") + ' data-id="' + d.id + '">'
        + '<button class="shot" data-open="' + d.id + '" aria-label="' + esc(d.ad) + ' — büyüt">'
        + '<img loading="lazy" src="' + d.src + '" width="1100" height="598" alt="' + esc(d.ad) + ' ambalaj tasarımı">'
        + (rank ? '<span class="badge r' + rank + '">' + rank + "</span>" : "")
        + '<span class="zoom">Büyüt</span></button>'
        + '<div class="meta"><span class="no">' + d.id + '</span><span class="ad">' + esc(d.ad) + "</span>"
        + '<button class="pick" data-pick="' + d.id + '"' + (rank ? ' data-on="' + rank + '"' : "") + ">"
        + (rank ? rank + ". sıra" : "Seç") + "</button></div></article>";
    }).join("") + "</div>";
  }

  function ballotHTML() {
    var slots = [0, 1, 2].map(function (i) {
      var id = picks[i];
      return '<div class="slot"' + (id ? " data-filled" : "") + '><div class="lab">' + (i + 1) + ". sıra · " + PTS[i] + ' puan</div>'
        + '<div class="val">' + (id ? esc(adOf(id)) : "—") + "</div></div>";
    }).join("");
    var mine = votes.filter(function (v) { return key(v.ad) === key(voter); })[0];
    var hint = msg
      ? '<p class="hint ' + msg.kind + '">' + esc(msg.text) + "</p>"
      : mine
        ? '<p class="hint">Bu isimle kayıtlı oyun var: ' + esc((mine.picks || []).map(adOf).join("  →  ")) + ". Yeniden gönderirsen güncellenir.</p>"
        : '<p class="hint">Kartlardaki <b>Seç</b> düğmesine sırayla bas; tekrar basınca seçim kalkar.</p>';
    return '<div class="ballot"><div class="wrap">'
      + '<div class="slots">' + slots + "</div>"
      + '<div class="fields">'
      + '<label class="f"><span>Adın</span><input type="text" id="adInput" placeholder="Örn. Elif" autocomplete="name"></label>'
      + '<label class="f"><span>Not (isteğe bağlı)</span><input type="text" id="notInput" placeholder="Neden bu?"></label>'
      + '<button class="send" id="sendBtn"' + (picks.length === 3 && voter.trim() && !sending ? "" : " disabled") + ">"
      + (sending ? "Gönderiliyor…" : "Oyu gönder") + "</button></div>"
      + hint + "</div></div>";
  }

  function resultsHTML(s) {
    if (loading) return '<div class="results"><p class="empty">Oylar yükleniyor…</p></div>';
    if (!votes.length) {
      return '<div class="results"><p class="empty">Henüz oy yok. Bağlantıyı paylaş, sonuçlar buraya düşsün.</p></div>';
    }
    var max = s[0].p || 1;
    var lead = s[0].p;
    var rows = s.map(function (x, i) {
      var win = x.p === lead && x.p > 0;
      var det = [];
      if (x.c[0]) det.push(x.c[0] + "× birinci");
      if (x.c[1]) det.push(x.c[1] + "× ikinci");
      if (x.c[2]) det.push(x.c[2] + "× üçüncü");
      return '<div class="row' + (win ? " win" : "") + '">'
        + '<div class="rank">' + (i + 1) + "</div>"
        + '<img class="thumb" loading="lazy" src="' + x.d.src + '" alt="" data-open="' + x.d.id + '">'
        + '<div class="nm">' + x.d.id + " · " + esc(x.d.ad)
        + "<small>" + (det.length ? det.join(" · ") : "oy yok") + "</small>"
        + '<div class="bar"><i style="width:' + Math.round((x.p / max) * 100) + '%"></i></div></div>'
        + '<div class="pts">' + x.p + "<small>puan</small></div></div>";
    }).join("");
    var w = s[0];
    return '<div class="results">'
      + '<div class="tally"><span class="big">' + votes.length + '</span><span class="cap">oy</span>'
      + '<span class="cap" style="margin-left:auto">Önde: ' + esc(w.d.id + " · " + w.d.ad) + " — " + w.p + " puan</span></div>"
      + rows
      + '<div class="voters"><h2>Oy verenler</h2><div class="vlist">'
      + votes.slice().reverse().map(function (v) {
        return '<div class="v"><b>' + esc(v.ad) + "</b>"
          + '<div class="picks">' + esc((v.picks || []).map(adOf).join("   →   ")) + "</div>"
          + (v.not ? '<div class="note">“' + esc(v.not) + "”</div>" : "") + "</div>";
      }).join("")
      + "</div></div></div>";
  }

  // ---------- büyük görsel ----------
  function paintLB() {
    var lb = root.querySelector(".lb");
    if (!lb) return;
    if (lbIndex < 0) { lb.removeAttribute("data-open"); lb.innerHTML = ""; return; }
    var d = DESIGNS[lbIndex];
    var r = picks.indexOf(d.id);
    lb.setAttribute("data-open", "");
    lb.innerHTML = '<div class="lb-top"><div class="t"><span>' + d.id + "</span>" + esc(d.ad) + "</div>"
      + '<button class="ghost" data-lb="prev">‹ Önceki</button>'
      + '<button class="ghost" data-lb="next">Sonraki ›</button>'
      + '<button class="ghost" data-lb="close">Kapat ✕</button></div>'
      + '<img src="' + d.src + '" alt="' + esc(d.ad) + '">'
      + '<div class="lb-bot"><button class="pick" data-pick="' + d.id + '"' + (r >= 0 ? ' data-on="' + (r + 1) + '"' : "") + ">"
      + (r >= 0 ? (r + 1) + ". sıra — kaldır" : "Bunu seç") + "</button></div>";
  }
  function openLB(id) { lbIndex = DESIGNS.findIndex(function (d) { return d.id === id; }); paintLB(); document.body.style.overflow = "hidden"; }
  function closeLB() { lbIndex = -1; paintLB(); document.body.style.overflow = ""; }

  // ---------- etkileşim ----------
  function togglePick(id) {
    var i = picks.indexOf(id);
    if (i >= 0) picks.splice(i, 1);
    else if (picks.length < 3) picks.push(id);
    else msg = { kind: "err", text: "Üç seçim doldu. Değiştirmek için birine tekrar bas." };
    render();
  }

  root.addEventListener("click", function (e) {
    var t = e.target.closest("[data-tab],[data-pick],[data-open],[data-lb],#sendBtn");
    if (!t) return;
    if (t.dataset.tab) {
      tab = t.dataset.tab; msg = null; render(); window.scrollTo(0, 0);
      if (tab === "son") yukle(true);
      return;
    }
    if (t.dataset.pick) { msg = null; togglePick(t.dataset.pick); return; }
    if (t.dataset.open) { openLB(t.dataset.open); return; }
    if (t.dataset.lb) {
      if (t.dataset.lb === "close") closeLB();
      else { lbIndex = (lbIndex + (t.dataset.lb === "next" ? 1 : DESIGNS.length - 1)) % DESIGNS.length; paintLB(); }
      return;
    }
    if (t.id === "sendBtn") submit();
  });

  root.addEventListener("input", function (e) {
    if (e.target.id === "adInput") {
      voter = e.target.value;
      try { localStorage.setItem("coffon_ad", voter); } catch (err) {}
      var b = root.querySelector("#sendBtn");
      if (b) b.disabled = !(picks.length === 3 && voter.trim() && !sending);
    }
    if (e.target.id === "notInput") note = e.target.value;
  });

  document.addEventListener("keydown", function (e) {
    if (lbIndex < 0) return;
    if (e.key === "Escape") closeLB();
    if (e.key === "ArrowRight") { lbIndex = (lbIndex + 1) % DESIGNS.length; paintLB(); }
    if (e.key === "ArrowLeft") { lbIndex = (lbIndex + DESIGNS.length - 1) % DESIGNS.length; paintLB(); }
  });

  async function submit() {
    if (picks.length !== 3 || !voter.trim() || sending) return;
    sending = true; msg = null; render();
    try {
      var j = await api("POST", { ad: voter.trim(), picks: picks.slice(), not: note.trim() });
      sending = false;
      if (j.ok) {
        picks = []; note = "";
        msg = { kind: "ok", text: "Oyun kaydedildi, teşekkürler. Sonuçlar sekmesinden takip edebilirsin." };
      } else {
        msg = { kind: "err", text: j.mesaj || "Oy gönderilemedi." };
      }
    } catch (e) {
      sending = false;
      msg = { kind: "err", text: "Bağlantı kurulamadı. Tekrar dene." };
    }
    render();
  }

  render();
  yukle(false);
  setInterval(function () { if (tab === "son" && !sending) yukle(true); }, 20000);
})();
