// Oy toplama ucu. Depolama: Upstash Redis (Vercel > Storage > Upstash for Redis).
// Ortam degiskenleri Vercel entegrasyonu tarafindan otomatik eklenir.

const REST_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_URL;
const REST_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_TOKEN;

const KEY = "coffon:oylar";
const GECERLI = /^(0[1-9]|1[0-9]|20)$/;

async function redis(command) {
  const r = await fetch(REST_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + REST_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

async function oylariGetir() {
  const flat = (await redis(["HGETALL", KEY])) || [];
  const out = [];
  for (let i = 1; i < flat.length; i += 2) {
    try {
      out.push(JSON.parse(flat[i]));
    } catch (e) {}
  }
  out.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  return out;
}

function anahtar(ad) {
  return String(ad).trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!REST_URL || !REST_TOKEN) {
    return res.status(200).json({
      ok: false,
      code: "depolama-yok",
      mesaj:
        "Oy deposu bagli degil. Vercel projesinde Storage > Upstash for Redis olusturup projeye baglayin, sonra yeniden dagitin.",
      votes: [],
    });
  }

  try {
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, votes: await oylariGetir() });
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

      const kayit = { ad, picks, not, ts: Date.now() };
      await redis(["HSET", KEY, anahtar(ad), JSON.stringify(kayit)]);
      return res.status(200).json({ ok: true, votes: await oylariGetir() });
    }

    if (req.method === "DELETE") {
      // Yonetim: ?ad=... ile tek oyu sil, ?hepsi=1 ile oylamayi sifirla.
      const url = new URL(req.url, "http://x");
      if (url.searchParams.get("hepsi") === "1") await redis(["DEL", KEY]);
      else {
        const ad = url.searchParams.get("ad");
        if (!ad) return res.status(400).json({ ok: false, mesaj: "ad parametresi gerekli." });
        await redis(["HDEL", KEY, anahtar(ad)]);
      }
      return res.status(200).json({ ok: true, votes: await oylariGetir() });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ ok: false, mesaj: "Desteklenmeyen istek." });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, code: "sunucu", mesaj: "Oy kaydedilemedi: " + err.message, votes: [] });
  }
};
