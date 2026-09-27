# 上線到 Cloudflare

把 SnapLocker 的網頁版部署到 Cloudflare Pages，並掛上自己的網域。

> **先讀這一段再決定要不要做。**
>
> Groq 的 API key 會**明文出現在打包後的 JS 裡**。這不是設定錯誤，是 `EXPO_PUBLIC_*` 的運作方式 —— 編譯時直接內嵌。網站一公開，任何人按 F12 就能複製那把 key 拿去用你的額度，而每日 5 次的限制存在瀏覽器的 localStorage，改一行就繞過。
>
> 自己驗證：建置後搜尋產出的 JS
> ```bash
> npx expo export --platform web --output-dir dist
> grep -o 'gsk_[A-Za-z0-9]*' dist/_expo/static/js/web/*.js | head -1
> ```
>
> **收藏資料是安全的** —— Firestore 規則綁 `request.auth.uid`，別人拿到 key 也讀不到你的東西。純粹是 Groq 額度會被白嫖。
>
> 三個選擇：照樣上線但不對外宣傳網址（被盜用就換 key）、先把 Groq 呼叫搬到 Cloudflare Worker（key 留在伺服器）、或上線但暫時拿掉 AI 辨識。見[最後一節](#之後把-groq-key-搬到伺服器)。

## 目錄

1. [為什麼是 Cloudflare](#1-為什麼是-cloudflare)
2. [取得網域](#2-取得網域)
3. [把網域接上 Cloudflare](#3-把網域接上-cloudflare)
4. [部署到 Cloudflare Pages](#4-部署到-cloudflare-pages)
5. [掛上自訂網域](#5-掛上自訂網域)
6. [讓 Google 登入在新網域可用](#6-讓-google-登入在新網域可用)
7. [驗證清單](#7-驗證清單)
8. [之後更新網站](#8-之後更新網站)
9. [之後把 Groq key 搬到伺服器](#之後把-groq-key-搬到伺服器)

---

## 1. 為什麼是 Cloudflare

| | Cloudflare Pages | Firebase Hosting |
|---|---|---|
| 頻寬 | 不限 | 免費方案 **每天 360MB** |
| 以這個專案 2.4MB 的大小換算 | 不限 | 約 150 次載入/天 |
| 自訂網域 + SSL | 免費 | 免費 |
| Google 登入要額外設定嗎 | **要**（見第 6 節） | 預設網域不用 |

Firebase Hosting 的預設網域本來就在 Firebase Auth 的授權清單裡，所以不用設定；Cloudflare 的網域要自己加。**這一步漏掉，登入就會失敗**，所以第 6 節不能跳過。

---

## 2. 取得網域

已經有網域的話跳到第 3 節。

**Cloudflare Registrar** 是最省事的選擇（[dash.cloudflare.com](https://dash.cloudflare.com) → Domain Registration → Register Domains），它用批發價賣、不加價、不玩第一年便宜第二年跳漲那套，而且註冊完 DNS 自動就在 Cloudflare 上，第 3 節可以整段跳過。

缺點是它不支援所有的頂級網域（`.tw` 就不行）。要 `.tw` 的話得去 Gandi、Namecheap、或台灣的中華電信 / Gandi 之類，再照第 3 節把 DNS 轉過來。

---

## 3. 把網域接上 Cloudflare

> 網域是在 Cloudflare Registrar 買的就跳過這節。

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a site** → 輸入你的網域
2. 選 **Free** 方案
3. Cloudflare 會掃描現有的 DNS 記錄，確認一下有沒有漏掉的（尤其是 email 的 MX 記錄 —— **漏掉的話信會收不到**）
4. Cloudflare 給你兩個 nameserver，像 `aida.ns.cloudflare.com`
5. 回到你買網域的地方，把 nameserver 換成那兩個
6. 等生效。通常幾分鐘到幾小時，Cloudflare 會寄信通知

確認是否生效：

```bash
dig +short NS 你的網域.com
```

回傳 `*.ns.cloudflare.com` 就是好了。

---

## 4. 部署到 Cloudflare Pages

### 建置

```bash
npx expo export --platform web --output-dir dist
```

產出約 2.4MB，包含：

```
index.html          首頁
add.html            新增收藏
themes.html         主題管理
item/[id].html      收藏細節（檔名就是這樣，見下方說明）
+not-found.html
_expo/              JS 與 CSS
_redirects          路由設定，從 public/ 複製過來
```

> **`_redirects` 是必要的。** expo-router 把動態路由輸出成一個字面叫 `item/[id].html` 的檔案，所以 `/item/abc123` 這種網址在磁碟上找不到對應檔案，直接連過去會 404。`public/_redirects` 用 `200` 改寫解決這件事（`301` 會把方括號帶到網址列）。這個檔案在版控裡，`expo export` 會自動複製，不用每次手動處理。

### 上傳

```bash
npx wrangler pages deploy dist --project-name=snaplocker
```

第一次執行會開瀏覽器要你登入 Cloudflare，並問你要不要建立專案，選 **Create a new project**。

完成後會給你一個 `https://snaplocker.pages.dev` 的網址。**先用這個網址測**，確認沒問題再掛自訂網域。

> 這時候 Google 登入還不會動 —— `pages.dev` 也不在 Firebase 的授權清單裡。要測登入的話，先照第 6 節把 `snaplocker.pages.dev` 也加進去。

---

## 5. 掛上自訂網域

1. Cloudflare Dashboard → **Workers & Pages** → 你的專案 → **Custom domains** → **Set up a custom domain**
2. 輸入網域（`snaplocker.com` 或 `app.snaplocker.com` 都可以）
3. 網域的 DNS 已經在 Cloudflare 上的話，記錄會自動建立，不用手動加
4. SSL 憑證自動簽發，通常幾分鐘

DNS 不在 Cloudflare 上的話，它會告訴你要加什麼記錄，通常是：

| 類型 | 名稱 | 值 |
|---|---|---|
| CNAME | `@` 或 `app` | `snaplocker.pages.dev` |

---

## 6. 讓 Google 登入在新網域可用

**這一步漏掉，登入一定失敗**，錯誤訊息是 `auth/unauthorized-domain`。

1. [Firebase Console → Authentication → Settings → 授權網域](https://console.firebase.google.com/project/snap-catalog-a0c41/authentication/settings)
2. **新增網域**，把這兩個都加進去：
   - `snaplocker.pages.dev`（Cloudflare 給的預設網址）
   - 你的自訂網域

### 為什麼只要設這裡就好

網頁版的登入走的是 Firebase 的 `signInWithPopup`（`src/hooks/use-google-sign-in.web.ts`），它導向 Firebase 託管網域上的 auth handler —— 那個網址在 Firebase 建立 OAuth client 時就註冊好了，所以**不用碰 Google Cloud Console**。

這是刻意的設計。`expo-auth-session` 那套會把 redirect 指回「你當下服務的 origin」，那表示每換一個網域、每換一個 port 都要回 Google Cloud Console 手動加一條。詳見 [README.md](../README.md) 的「Web 的 Google 登入」。

---

## 7. 驗證清單

部署完照這個順序確認：

| 檢查 | 預期 | 失敗時 |
|---|---|---|
| 開啟網址 | 看到登入畫面，米白底 | 白畫面就看瀏覽器 console |
| 瀏覽器分頁標題 | `SnapLocker 藏寶盒` | — |
| 按「使用 Google 登入」 | 彈出帳號選擇 | `auth/unauthorized-domain` → 第 6 節沒做完 |
| 登入後看到收藏清單 | 資料正確載入 | `Missing or insufficient permissions` → Firestore 規則 |
| 點一筆收藏進細節頁 | 正常顯示 | — |
| **直接在網址列輸入** `/item/某個id` | 正常顯示，**不是 404** | `_redirects` 沒生效 |
| 重新整理細節頁 | 正常顯示 | 同上 |
| 新增一筆並按 AI 辨識 | 欄位自動填入 | `Missing EXPO_PUBLIC_GROQ_API_KEY` → 建置時 `.env` 沒被讀到 |

最後兩項最容易出錯，務必測。

---

## 8. 之後更新網站

```bash
npx expo export --platform web --output-dir dist
npx wrangler pages deploy dist --project-name=snaplocker
```

`.env` 在本機、`expo export` 直接讀得到，所以 Groq key 會正確打包進去。

> **不要改用 Cloudflare 的 Git 自動部署**，除非你先處理好 key。那種模式在 Cloudflare 的機器上建置，而 `.env` 是 git-ignored、不會被上傳，建出來的網站 AI 辨識必定壞掉。真要用的話得把 key 設成 Cloudflare Pages 的環境變數。

---

## 之後把 Groq key 搬到伺服器

要讓 key 不再外洩，唯一的辦法是讓瀏覽器不要拿到它 —— 改由伺服器代為呼叫 Groq。Cloudflare Workers 免費方案每天 10 萬次請求，綽綽有餘。

大致的輪廓：

1. 寫一個 Worker，接收 base64 圖片，用**存在 Worker 環境變數裡**的 key 去呼叫 Groq，把結果回傳
2. `src/lib/groq.ts` 改成呼叫你的 Worker，不再直接打 Groq
3. 從 `.env` 拿掉 `EXPO_PUBLIC_GROQ_API_KEY`
4. Worker 上加來源限制（只接受你的網域）和速率限制 —— 不然只是把「偷 key」變成「直接用你的 endpoint」

順帶一提，這樣也才能做**真正的**每日額度。現在的 5 次限制存在瀏覽器 localStorage，使用者自己改得掉；額度算在伺服器上才擋得住。

這件事列在 [PLAN.md](PLAN.md)，還沒排進度。
