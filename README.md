# COFFON Ambalaj Oylaması

COFFON'un 20 kahve ambalajı tasarımı için sıralamalı oylama sayfası. Oy veren kişi
en beğendiği üç tasarımı sırayla seçer; 1. seçim 3, 2. seçim 2, 3. seçim 1 puan alır.
Sonuçlar puana göre sıralanır, önde olan tasarım işaretlenir.

## Yapı

```
index.html    oylama sayfası
app.css       tasarım
app.js        arayüz ve oy gönderimi
api/oy.js     oy toplama ucu (Vercel Serverless Function)
img/          20 ambalaj görseli (1100 px JPEG)
```

## Vercel'e kurulum

1. Bu repoyu Vercel'de **Add New → Project** ile içe aktar. Framework: **Other**,
   build komutu yok, output dizini kök. Deploy et.
2. Oyların kalıcı olması için bir GitHub token'ı ver:
   - GitHub → **Settings → Developer settings → Personal access tokens →
     Fine-grained tokens → Generate new token**
   - Repository access: sadece **Odiway/forms**
   - Permissions → Repository permissions → **Contents: Read and write**
   - Oluşan token'ı Vercel'de **Settings → Environment Variables** altına
     `GH_TOKEN` adıyla ekle (Production + Preview).
3. **Redeploy** et. Sayfadaki "Oylar kaydedilmiyor" uyarısı kaybolduğunda hazırdır.

Depolama bağlanmadan sayfa yine açılır ve tasarımlar görünür, sadece oy kaydedilmez —
sayfa bunu üstte açıkça yazar.

## Oylar nerede duruyor

Bu deponun **`veri`** dalındaki `oylar.json` dosyasında. Her oy bu dosyaya bir commit
olarak düşer; geçmişi GitHub'dan görebilir, dosyayı indirip Excel'e taşıyabilirsin.
`vercel.json` bu dal için dağıtımı kapatır, böylece her oy siteyi yeniden kurmaz.

Ücretli bir servise gerek yok. İstersen Upstash Redis de kullanabilirsin: projeye
`KV_REST_API_URL` ve `KV_REST_API_TOKEN` eklenirse kod otomatik olarak onu tercih eder
(`GH_TOKEN` yoksa).

## API

| İstek | Ne yapar |
| --- | --- |
| `GET /api/oy` | Tüm oyları döner |
| `POST /api/oy` | `{ "ad": "Elif", "picks": ["07","12","03"], "not": "..." }` kaydeder |
| `DELETE /api/oy?ad=Elif` | Tek bir oyu siler |
| `DELETE /api/oy?hepsi=1` | Oylamayı sıfırlar |

Oylar oy verenin adına göre tutulur; aynı isimle ikinci kez oy verilirse önceki kayıt
güncellenir. Aynı anda gelen oylarda çakışma olursa istek birkaç kez yeniden denenir.

## Yerelde çalıştırma

```bash
npx vercel dev
```

`GH_TOKEN` yoksa sayfa "kaydedilmiyor" modunda açılır.
