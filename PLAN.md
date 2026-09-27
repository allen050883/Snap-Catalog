# 待辦

> 對照 [SPEC.md](SPEC.md)（目標設計）與目前實作的差距。
> 已完成的部分見 git log；這裡只列還沒做的。

## 1. 下一步

### 1.1 用 jev model 做圖片比對 —— 暫緩，不開發

重複偵測目前只比對 metadata（主題 + 類型 + 系列，系列空白時退回名稱相似度）。抓不到「同一個東西但兩張照片不一樣」的情況 —— 而那正是主要場景：**店裡拍的那張 vs 家裡拍的那張**，光線、背景、角度全都不同。

**現況：因為要付費，決定先不做。比對維持現有的 metadata 做法。**

之後要動工時，執行前要先釐清的事：

- **jev model 的供應商與模型 id**，以及它是影像 embedding 模型還是視覺對話模型 —— 這兩者接法完全不同：
  - **embedding 模型**：存檔時算一次向量存起來，比對時用 cosine similarity，之後幾乎零成本，可以自動執行
  - **視覺對話模型**：兩張圖放進同一個 request 問「是不是同一件」，每次比對都要花呼叫額度，只能做成手動按鈕
- 向量要存哪裡（item 上還是獨立 collection）
- 門檻怎麼定 —— 一樣要拿真實照片跑出分佈再選，不能憑感覺。做法參考 `lib/similarity.ts` 的 0.65 是怎麼來的

### 1.2 ~~Groq 429 的錯誤處理~~ 已完成

畫面顯示「AI 額度不足，請洽詢管理員」。實測連續送 5 次，第 3 次就撞到 429。

> 429 涵蓋每分鐘（7000 input tokens，約 3 次）和每日兩種限制，實際上多半是每分鐘那個，等約 30 秒就恢復。目前文案對外部使用者是對的；若只有自己用，改成「辨識太頻繁，請稍候再試」會更準確。

### 1.3 ~~series 升格成 collection~~ 已完成

`users/{uid}/series`，item 改存 `seriesId`。重複偵測從字串比對變成 id 比對，錯字不再造成漏報。`series.year` 欄位已在資料層，但表單還沒有輸入的地方。

### 1.4 把 Groq 呼叫搬到伺服器端

`EXPO_PUBLIC_GROQ_API_KEY` 會明文內嵌進打包後的 JS。網站一公開，任何訪客都能取走那把 key。收藏資料不受影響（Firestore 規則綁 uid），但 Groq 額度會被白嫖。

同一件事也讓每日 5 次的額度形同虛設 —— 它存在瀏覽器 localStorage，使用者自己改得掉。額度要算在伺服器上才擋得住。

做法輪廓與 Cloudflare Workers 的免費額度見 [DNS.md](DNS.md) 最後一節。

**在網址對外公開之前應該先做完這項。**

## 2. SPEC 已定義但未實作

| 欄位 | 位置 | 用途 |
|---|---|---|
| `purchasedAt` / `price` / `store` | items | 購買資訊，目前全塞在 `notes` 自由文字裡。結構化之後才能問「今年花了多少」「這家店買過什麼」 |
| `coverItemId` | themes | 主題封面照，主題管理頁目前沒有縮圖 |
| `year` | series | 發售年份，同名系列跨年復刻時用來區分（需先完成 1.3） |

## 3. 已知問題

### 3.1 Android 的 Google 登入不能用

`src/hooks/use-google-sign-in.ts` 的 `ANDROID_CLIENT_ID` 還是空字串，Android build 上的登入必定失敗。步驟見 [README.md](README.md) 的「原生的 OAuth client ID」。

注意 Android 的 client ID 與 iOS 的**不會相同** —— 先前曾誤把 iOS 那組當成 Android 的。

### 3.2 Groq API key 需要撤換

目前 `.env` 裡那把 key 曾在對話紀錄中以明文出現。正式使用前到 [Groq console](https://console.groq.com/keys) 撤銷重發。

### 3.3 兩個既有的 lint 錯誤

```
src/hooks/use-color-scheme.web.ts:11  setState synchronously within an effect
src/hooks/use-google-sign-in.ts:41    setState synchronously within an effect
```

兩個都在這輪改動之前就存在。`use-google-sign-in.ts` 是原生版的登入 hook（web 版走 `use-google-sign-in.web.ts` 的 `signInWithPopup`，沒有這個問題），所以**只會在原生實機上跑到**，目前 Android 登入本來就不能用，修它之前先處理 3.1 比較有意義。

## 3.4 重複的 Firestore 讀取

清單頁每次獲得焦點就重抓 items、themes、series；新增頁和細節頁各自又抓一次。光是「首頁 → 新增 → 返回」就會打 Firestore 六次，而且 items 帶著所有縮圖。

**不影響首次載入速度**（那是開發模式 bundle 大小造成的，正式版 2.2MB vs 開發 6.7MB），只影響畫面間切換的流暢度。收藏量小的時候感覺不出來，量大了會開始明顯。

要修的話是加一層共用的資料快取，讓三個畫面共用同一份 themes / series / items，並且只在真的變動後才重抓。

## 4. 待決定

SPEC §8 列的開放問題，會影響畫面結構：

- **主題要不要有自己的瀏覽頁？** 目前是清單頁用 chip 篩選。收藏量大的話「主題封面牆 → 點進去看該主題」可能更好逛（需要先做 2. 的 `coverItemId`）
- **想要清單要不要獨立成分頁？** 現在是清單頁上的狀態切換。獨立分頁更好找，但多一層導覽
- **系列能不能跨主題？** 目前設計是單一主題，聯名系列可能需要放寬（會影響 1.3 的資料結構，最好一起決定）
- **要不要改成伺服器端查詢？** 目前是抓全部、前端篩選，幾百筆完全夠用且不必維護索引。真要改的話需要兩個複合索引：`items(status, createdAt desc)` 和 `items(themeIds array, status, createdAt desc)`

## 5. 暫停中

**獎勵廣告換取額外辨識次數。** 程式碼是註解掉而非刪除，在 `src/app/_layout.tsx`、`src/app/add.tsx` 和 `src/hooks/use-bonus-analysis-ad.ts` 裡，`lib/usage.ts` 的 `bonus` 欄位和 `grantBonusAnalysis()` 都還在。恢復步驟見 [README.md](README.md) 的「每日 AI 額度」一節。

## 6. 文件同步

這三份要一起維護，改資料結構時特別容易漏：

- [SPEC.md](SPEC.md) — 目標設計。標示 **（未實作）** 的項目與本檔第 1、2 節對應
- [ARCHITECTURE.md](ARCHITECTURE.md) — 架構、資料流、信任邊界
- [README.md](README.md) — 目前實作與環境設定
- [DNS.md](DNS.md) — 部署到 Cloudflare 與網域設定
- 本檔 — 差距清單
