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
2. Oyların kalıcı olması için projede **Storage → Create Database → Upstash for Redis**
   seç ve projeye bağla. Vercel `KV_REST_API_URL` ve `KV_REST_API_TOKEN`
   değişkenlerini otomatik ekler.
3. Depolamayı bağladıktan sonra **Redeploy** et. Sayfadaki "Oylar kaydedilmiyor"
   uyarısı kaybolduğunda hazırdır.

Depolama bağlanmadan sayfa yine açılır ve tasarımlar görünür, sadece oy kaydedilmez —
sayfa bunu üstte açıkça yazar.

## API

| İstek | Ne yapar |
| --- | --- |
| `GET /api/oy` | Tüm oyları döner |
| `POST /api/oy` | `{ "ad": "Elif", "picks": ["07","12","03"], "not": "..." }` kaydeder |
| `DELETE /api/oy?ad=Elif` | Tek bir oyu siler |
| `DELETE /api/oy?hepsi=1` | Oylamayı sıfırlar |

Oylar Redis'te `coffon:oylar` anahtarında, oy verenin adına göre tutulur; aynı isimle
ikinci kez oy verilirse önceki kayıt güncellenir.

## Yerelde çalıştırma

```bash
npx vercel dev
```

Depolama değişkenleri yoksa sayfa "kaydedilmiyor" modunda açılır.
