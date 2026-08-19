// Oy toplama ucu.
//
// Depolama iki yoldan biriyle calisir, hangisi ayarliysa o kullanilir:
//   1) GitHub  - GH_TOKEN ortam degiskeni. Oylar bu deponun "veri" dalindaki
//                oylar.json dosyasinda tutulur. Ucretsiz, ek hesap gerekmez.
//   2) Redis   - KV_REST_API_URL + KV_REST_API_TOKEN (Upstash / Vercel KV).
//
// Ikisi de yoksa sayfa acilir ama oy kaydedilmez ve bunu ekranda yazar.

const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const GH_REPO = process.env.GH_REPO || "Odiway/forms";
const GH_BRANCH = process.env.GH_BRANCH || "veri";
const GH_PATH = process.env.GH_PATH || "oylar.json";

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY = "coffon:oylar";

const GECERLI = /^(0[1-9]|1[0-9]|20)$/;

function anahtar(ad) {
  return String(ad).trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
}
function sirala(list) {
  return list.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
}

/* ---------------- GitHub deposu ---------------- */

async function gh(path, init) {
  const r = await fetch("https://api.github.com" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + GH_TOKEN,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "coffon-forms",
      ...(init && init.headers),
    },
    cache: "no-store",
  });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) {}
  if (!r.ok) {
    const err = new Error((body && body.message) || "GitHub " + r.status);
    err.status = r.status;
    throw err;
  }
  return body;
}

async function ghOku() {
  try {
    const f = await gh(
      `/repos/${GH_REPO}/contents/${GH_PATH}?ref=${GH_BRANCH}&t=${Date.now()}`
    );
    const json = Buffer.from(f.content || "", "base64").toString("utf8");
    const list = JSON.parse(json || "[]");
    return { list: Array.isArray(list) ? list : [], sha: f.sha };
  } catch (e) {
    if (e.status === 404) return { list: [], sha: null };
    throw e;
  }
}

async function ghYaz(list, sha) {
  await gh(`/repos/${GH_REPO}/contents/${GH_PATH}`, {
    method: "PUT",
    body: JSON.stringify({
      message: "oy: " + list.length + " kayit",
      content: Buffer.from(JSON.stringify(list, null, 1), "utf8").toString("base64"),
      branch: GH_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
}

// Ayni anda iki oy gelirse sha catisir; birkac kez yeniden dener.
async function ghGuncelle(degistir) {
  let son;
  for (let deneme = 0; deneme < 4; deneme++) {
    const { list, sha } = await ghOku();
    const yeni = degistir(list);
    try {
      await ghYaz(yeni, sha);
      return yeni;
    } catch (e) {
      son = e;
      if (e.status !== 409 && e.status !== 422) throw e;
      await new Promise((z) => setTimeout(z, 200 + deneme * 300));
    }
  }
  throw son;
}

/* ---------------- Redis deposu ---------------- */

async function redis(command) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
async function redisOku() {
  const flat = (await redis(["HGETALL", REDIS_KEY])) || [];
  const out = [];
  for (let i = 1; i < flat.length; i += 2) {
    try { out.push(JSON.parse(flat[i])); } catch (e) {}
  }
  return out;
}

/* ---------------- ortak katman ---------------- */

const MOD = GH_TOKEN ? "github" : REDIS_URL && REDIS_TOKEN ? "redis" : null;

async function oylariGetir() {
  if (MOD === "github") return sirala((await ghOku()).list);
  return sirala(await redisOku());
}

async function oyKaydet(kayit) {
  if (MOD === "github") {
    return sirala(
      await ghGuncelle((list) =>
        list.filter((v) => anahtar(v.ad) !== anahtar(kayit.ad)).concat([kayit])
      )
    );
  }
  await redis(["HSET", REDIS_KEY, anahtar(kayit.ad), JSON.stringify(kayit)]);
  return sirala(await redisOku());
}

async function oySil(ad, hepsi) {
  if (MOD === "github") {
    return sirala(
      await ghGuncelle((list) =>
        hepsi ? [] : list.filter((v) => anahtar(v.ad) !== anahtar(ad))
      )
    );
  }
  if (hepsi) await redis(["DEL", REDIS_KEY]);
  else await redis(["HDEL", REDIS_KEY, anahtar(ad)]);
  return sirala(await redisOku());
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!MOD) {
    return res.status(200).json({
      ok: false,
      code: "depolama-yok",
      mesaj:
        "Oy deposu bagli degil. Vercel projesine GH_TOKEN ortam degiskenini ekleyip yeniden dagitin.",
      votes: [],
    });
  }

  try {
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, mod: MOD, votes: await oylariGetir() });
    }

    if (req.method === "POST") {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const ad = String(body.ad || "").trim().slice(0, 40);
      const picks = Array.isArray(body.picks) ? body.picks.map(String) : [];
      const not = String(body.not || "").trim().slice(0, 240);

      if (!ad) return res.status(400).json({ ok: false, mesaj: "Ad bos olamaz." });
      if (picks.length !== 3 || new Set(picks).size !== 3 || !picks.every((p) => GECERLI.test(p)))
        return res.status(400).json({ ok: false, mesaj: "Farkli uc tasarim secilmeli." });

      const votes = await oyKaydet({ ad, picks, not, ts: Date.now() });
      return res.status(200).json({ ok: true, mod: MOD, votes });
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url, "http://x");
      const hepsi = url.searchParams.get("hepsi") === "1";
      const ad = url.searchParams.get("ad");
      if (!hepsi && !ad)
        return res.status(400).json({ ok: false, mesaj: "ad veya hepsi=1 gerekli." });
      return res.status(200).json({ ok: true, mod: MOD, votes: await oySil(ad, hepsi) });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ ok: false, mesaj: "Desteklenmeyen istek." });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "sunucu",
      mesaj: "Oy kaydedilemedi: " + err.message,
      votes: [],
    });
  }
};
