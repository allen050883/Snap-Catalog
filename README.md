# Snap Catalog

收藏品編目 App（拉拉熊、三麗鷗、盲盒公仔，或任何你在收集的東西），用來在買之前確認自己是不是已經有了。拍張照，讓 AI 幫你填好欄位，改一改存起來，之後用搜尋查。用 Google 帳號登入，收藏會跟著帳號跨裝置同步。

介面是繁體中文的，AI 辨識出來的內容也是。

架構與資料流見 [ARCHITECTURE.md](ARCHITECTURE.md)，設計規格見 [SPEC.md](SPEC.md)，還沒做的事見 [PLAN.md](PLAN.md)，上線部署見 [DNS.md](DNS.md)。

## 技術組成

- **Expo（React Native + TypeScript）**，用 `expo-router` 做檔案式路由
- **Firebase Authentication**（Google 登入）+ **Cloud Firestore** — 收藏以 Google 帳號為範圍，你登入過的每台裝置都會同步
- **expo-image-picker** + **expo-image-manipulator** — 相機 / 相簿，上傳前先縮圖壓縮
- **Groq API**（視覺模型）— 從照片推測名稱 / 角色 / 系列 / 類別 / 顏色 / 標籤

## 安裝

```bash
npm install
cp .env.example .env   # 填入 Worker 的網址，見下方「AI 辨識的後端」
```

接著二選一：`npx expo start --web`（現在就能跑，不需要任何原生 OAuth 設定），或用下面的 dev client 流程在實機上測。

## 使用流程

1. 用 Google 登入
2. 按右下角 **+** 新增
3. 拍照或從相簿選一張
4. App 把照片送給 Groq 的視覺模型，回傳名稱、角色、系列、類別、顏色和搜尋標籤，自動填進表單 — 會用掉今天的一次 AI 辨識額度（見下方）
5. 改任何欄位和標籤，然後儲存。所有東西（包括那張縮圖壓縮後以 base64 存的照片）都存在 Firestore 你的帳號底下
6. 若比對到可能重複的收藏，表單最上方會顯示並列比對，可以選擇不儲存、把既有那筆數量 +1，或（該筆在想要清單時）改成已擁有
7. 在首頁用搜尋列以名稱、主題、系列、顏色或標籤查詢，或用主題 / 類型兩排 chip 篩選。在另一台裝置用同一個 Google 帳號登入，收藏就在那裡

### 重複偵測

主要功能，規則與理由見 [SPEC.md §5](SPEC.md#5-主要流程新增與重複偵測)。摘要：共享至少一個主題、類型相同、系列相同；兩邊系列都空白時額外要求名稱相似度 ≥ 0.65（字元 bigram 的 Dice 係數，門檻由真實案例分佈決定）。

尺寸和顏色刻意不列入比對 —— 它們是兩個候選最可能不同的欄位，而同系列不同尺寸是不同的東西，所以改成顯示在比對畫面上讓你自己判斷。

**已知限制**：這是 metadata 比對，抓不到「同一個東西但兩張照片不一樣」，而那正是主要場景。影像比對因為要付費，目前暫緩，見 [PLAN.md](PLAN.md) §1.1。

### AI 額度用完時

Groq 免費層的限制有兩種，都以 HTTP 429 回應：每分鐘 7000 input tokens（每張照片約 1850，所以**約 3 次就會撞到**）和每日上限。兩者對使用者來說沒有區別，畫面一律顯示「AI 額度不足，請洽詢管理員」。

Groq 原本的錯誤訊息是一整段英文、還帶上組織 id 和 token 預算 —— 正確但不適合放在使用者眼前。`lib/groq.ts` 用 `GroqQuotaError` 這個型別讓畫面直接顯示中文訊息，而不是把它包進「AI 辨識失敗：」裡面。

## 平台支援

### Web

這個 App 一度也以 `react-native-web` 輸出靜態網站為目標，那個目標現在暫緩，不過 `npx expo start --web` 和 `expo export --platform web` 都還能正常運作（Firebase / 驗證的部分本來就跨平台）。Web 也是最快的測試途徑，因為 Web 的 OAuth client ID 已經填好了，不需要碰任何原生 OAuth 設定。

Web 上有三個跟原生不同、需要各自處理的地方：

**1. `expo-sqlite` 會讓整個 web bundle 編譯失敗**（`Worker chunk not found for: expo-sqlite/web/worker.ts`）。這個專案已經不用 SQLite 了 —— 唯一用到它的每日額度已搬到 Worker —— 但如果之後又引入，要記得它在 web 上編不過。

**2. `Alert.alert()` 在 `react-native-web` 裡是空函式**（實作就是 `static alert() {}`）。所以 web 上所有錯誤訊息都不會出現，刪除確認框也不會跳，等於刪除功能完全失效。現在全部改用 `src/components/inline-banner.tsx` 在畫面內呈現，每個平台都有效。**之後新增程式碼時不要用 `Alert`。**

**3. Google 登入走的是 Firebase 的 `signInWithPopup`，不是 `expo-auth-session`**（見 `src/hooks/use-google-sign-in.web.ts`）。原因在下方「Web 的 Google 登入」。

> **新增 `*.web.ts` 平台分檔之後，Metro 不會自動重新解析模組。** 必須 `npx expo start --clear` 重啟，否則你會繼續拿到舊的原生版本。徵兆是 bundle 大小完全沒變。

### 實機測試：要用 dev client，不能用 Expo Go

有兩個東西是 Expo Go 沒有內建的原生模組：`@react-native-async-storage/async-storage`（Firebase Auth 的 session 持久化）以及原生 Google 登入對 redirect URI 的要求（見下方）。建一次 dev client 就好，Expo 的建置服務是免費的：

```bash
npx eas build --profile development --platform android   # 或 ios
```

第一次跑 `eas build` 會要你登入（`eas login`，免費 Expo 帳號）並連結專案（`eas init`）。把產出的 build 裝到手機上，之後日常開發用：

```bash
npx expo start --dev-client
```

一樣有 fast refresh / 熱重載，只有在原生依賴變動時才需要重建 dev client。

## Firebase 設定

Firebase 專案（`snap-catalog-a0c41`）和它的 web config 已經寫在 `src/lib/firebase.ts` / `firebase.web.ts` 裡了 — 那份 config 本來就是設計成公開的，安全性由 Firestore 規則把關，不是靠把它藏起來。以下都已完成，列出來備查：

- **Firestore** 資料庫已建立，並發布了這組規則（每個使用者只能讀寫自己底下的資料）：
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{userId}/{collection}/{docId} {
        allow read, write: if request.auth != null
                           && request.auth.uid == userId
                           && collection in ['themes', 'series', 'items', 'photos'];
      }
    }
  }
  ```
  用 `collection in [...]` 白名單而不是萬用比對，這樣之後不小心寫到別的路徑會被擋下來，而不是默默放行。**四個集合缺一不可** —— 少了 `photos` 存檔會失敗，少了 `themes` 主題管理會全壞。
- **Authentication → Sign-in method → Google** 已啟用
- **刻意不用 Cloud Storage** — Firebase 現在要求升級到付費的 Blaze 方案才能使用 Storage（低用量仍免費，但必須綁信用卡）。照片改為壓縮後以 base64 存在 Firestore document 上，控制在單篇 1 MiB 的上限內。

### 資料結構

```
users/{uid}/
  themes/{themeId}    主題（拉拉熊、三麗鷗），含別名與比對鍵
  items/{itemId}      收藏，以 themeIds 參照主題
  photos/{itemId}     原圖，文件 id 與 item 相同
  series/{seriesId}   系列，附屬於單一主題
```

**照片分兩份存**：item 上只放 320px 縮圖，1000px 原圖放在 `photos/{itemId}`。清單頁會讀取它顯示的每一筆，原圖留在 item 上的話，每次回到清單都會把整個收藏庫的照片重新下載一遍 —— 一百筆大約 20MB，拆開後約 2MB。原圖只在開啟細節頁時抓，而且是縮圖先畫、原圖後換。

`photos` 的文件 id 刻意與 item 相同，取原圖不用查詢，直接讀一筆文件。寫入用 `writeBatch`，item 和照片不會脫鉤；刪除時無條件刪兩邊（刪不存在的文件在 Firestore 是 no-op，這樣就算 `hasPhoto` 旗標過期也不會留下孤兒圖）。

### 主題與 AI 的別名比對

主題是 `users/{uid}/themes` 裡的文件，item 用 id 參照，所以改名或加別名一次就全部生效。

Firestore 沒有不分大小寫的比對，也沒有子字串查詢，所以每個主題把它答應的所有拼法**預先正規化**存在 `matchKeys` 陣列裡，用 `array-contains` 查。空白是直接去除而非壓縮，而且每個別名除了自己，還會把裡面的每個詞各自拆出來當一個 key —— 這樣 AI 回的合併形式「拉拉熊 Rilakkuma」才對得上使用者建的「拉拉熊」。

辨識完成後，比中的主題自動選上；**比不到的只會提示，絕不自動建立**。模型看到角色形狀一定會給名字，測試時把一隻普通的粉紅兔說成 Peppa Pig —— 自動建立會讓那種幻覺長進主題清單。

### Web 的 Google 登入

Web 端用 Firebase 自己的 `signInWithPopup`（`src/hooks/use-google-sign-in.web.ts`），不走 `expo-auth-session`。

原因是 `expo-auth-session` 在 web 上會把 redirect URI 指回目前服務的 origin — 開發時是 `http://localhost:8081`，而 Firebase 自動建立的 Web OAuth client 沒有註冊這個 URI，Google 會以 `400: redirect_uri_mismatch` 擋下來。更麻煩的是這表示**每換一個 port、每部署一個網域都要回 Google Cloud Console 手動加一條**。

`signInWithPopup` 則是導向 Firebase 託管網域上的 auth handler，那個 URI 在 Firebase 建立 Web client 時就註冊好了，改由 **Firebase Console → Authentication → Settings → Authorized domains** 控管，而 `localhost` 預設就在允許清單裡。等於完全不用碰 Google Cloud Console。

如果登入失敗並顯示 `auth/unauthorized-domain`，就是去那份 Authorized domains 清單補上你的網域。

### 原生的 OAuth client ID

`src/hooks/use-google-sign-in.ts`（原生版）已經填好 **Web** 和 **iOS** 的 OAuth client ID。**Android 的還沒填** — 在補上之前，Android build 上的 Google 登入一定會失敗：

1. 用 `eas credentials` 取得 dev client build 的 SHA-1 指紋（選 Android，它會顯示或幫你產生 keystore）
2. 到 [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=snap-catalog-a0c41)（確認上方專案選單顯示的是 `snap-catalog-a0c41`，很容易不小心停在別的預設專案）→ 建立憑證 → OAuth 用戶端 ID → **Android** → 套件名稱填 `com.allen050883.snapcatalog`，加上剛才那組 SHA-1
3. 把產生的 client ID 貼進 `src/hooks/use-google-sign-in.ts` 的 `ANDROID_CLIENT_ID`

> Android 的 client ID 跟 iOS 的**不會相同**。如果你複製到的值跟檔案裡的 `IOS_CLIENT_ID` 一模一樣，那是複製錯筆了，回清單確認「類型」欄位是不是 Android。

兩組原生 client ID 還需要一個 redirect URI 的修正：`expo-auth-session` 的 Google provider 預設把原生 redirect 設成 `${bundleId}:/oauthredirect`，但這個 App 並沒有註冊那個 URL scheme — 只有 `app.json` 頂層的 `scheme`（`snapcatalog`）有註冊。`useGoogleSignIn` 因此傳了一個明確的 `{ native: 'snapcatalog:/oauthredirect' }` 覆寫。如果補上 client ID 之後 Android 登入仍然無法跳回 App，先檢查這裡。

### AI 辨識的後端

**Groq 的 key 不在 App 裡。** 它在 `worker/` 這個 Cloudflare Worker 上，App 呼叫 Worker，Worker 才去呼叫 Groq。

原因是 `EXPO_PUBLIC_*` 開頭的變數會被**明文內嵌進打包後的 JavaScript**。網站一公開，任何人按 F12 就能複製那把 key。收藏資料不受影響（Firestore 規則綁 `request.auth.uid`），但 Groq 額度會被白嫖。

Worker 做三件事，缺一不可：驗證 Firebase ID token（不做的話端點跟外洩的 key 一樣開放）、CORS 只回應白名單 origin、每日額度記在 KV（以前記在 localStorage，使用者自己改得掉）。詳見 [ARCHITECTURE.md](ARCHITECTURE.md) 第 9 節。

#### 設定

```bash
cd worker
npm install
npx wrangler kv namespace create USAGE     # 把印出的 id 填進 wrangler.toml
npx wrangler secret put GROQ_API_KEY       # 貼上 Groq 的 key
npx wrangler deploy
```

然後把部署後的網址填進專案根目錄 `.env` 的 `EXPO_PUBLIC_API_URL`。

本機開發時在 `worker/` 跑 `npx wrangler dev`，`.env` 填 `http://127.0.0.1:8787`。

`wrangler.toml` 的 `ALLOWED_ORIGINS` 要包含所有會呼叫它的來源 —— 漏掉的話請求會被擋下並回 403。

#### 用哪個模型

`wrangler.toml` 的 `GROQ_MODEL`，預設 `qwen/qwen3.8-27b`。

Groq 已經**下架了這個 App 原本用的 `meta-llama/llama-4-scout` / `llama-4-maverick`**，現在請求它們會直接失敗。其他模型（`openai/gpt-oss-*`）全是純文字，收到圖片會回 `messages[0].content must be a string`。

## AI 回傳的內容

Prompt 在 `worker/src/index.ts`（放伺服器端，呼叫端改不了它），要求模型用**繁體中文**回答，專有名詞後面接原文：

```json
{
  "name": "拉拉熊 草莓系列 坐姿玩偶",
  "themes": ["拉拉熊 Rilakkuma"],
  "series": "草莓系列",
  "type": "plush",
  "size": "M・坐姿",
  "color": "棕色、粉紅色",
  "tags": ["拉拉熊", "rilakkuma", "絨毛", "plush", "粉紅色", "pink", "草莓"]
}
```

四個刻意的設計：

- **標籤中英文並存。** 這樣之後不管你打「拉拉熊」還是 `rilakkuma` 都搜得到，不會因為當下想到哪個語言而漏搜。
- **`type` 是唯一不翻譯的欄位**，存的是英文 slug。清單頁的類型篩選要靠這個值做比對，而中文標籤屬於呈現層、隨時可能改措辭 — 分開之後改文案不會讓舊資料對不上。對照表在 `src/constants/item-types.ts`，Worker 的 prompt 也是直接 import 那個檔案產生允許值，不會兩邊走鐘。
- **`themes` 是陣列，但通常只有一個。** prompt 明確要求只有在畫面上看得出是兩個 IP 聯名時才給兩個，否則一律單一 — 不然模型會把周邊角色也算進去。回傳值不會直接寫入，要先比對既有主題的別名（見上方）。
- **判斷不出尺寸就回 `null`。** prompt 明講不准從沒有比例參照的照片猜尺寸，寧可留空讓使用者自己填。

## 每日 AI 額度

**每個使用者每天 5 次**，由 Worker 計數（`worker/src/usage.ts`），存在 Cloudflare KV，key 是 `usage:{uid}:{日期}`。用完之後仍可手動填寫所有欄位並儲存 — 被擋住的只有 AI 呼叫本身。次數在 `wrangler.toml` 的 `DAILY_LIMIT` 調整。

重置採**固定時區（Asia/Taipei）**而非裝置本地時間 —— 後者改手機時鐘就能重置。

> 這份資料以前存在裝置上（原生 SQLite、web localStorage），使用者自己改得掉，等於沒有把關。搬到伺服器之後 `src/lib/usage.ts` 與 `usage.web.ts` 已刪除。

**目前暫停：看廣告換取額外次數。** 這個功能曾經可以運作 — 看完一支獎勵廣告就多得到當天一次額度 — 用 `react-native-google-mobile-ads` 實作。程式碼是註解掉而非刪除，在 `src/app/_layout.tsx` 和 `src/app/add.tsx` 裡，但額度已經搬到伺服器，所以恢復時要在 Worker 上加一個發放 bonus 的端點 —— 在前端發放不會有任何效果。橫幅廣告（常駐在畫面上的廣告條）討論過但從未實作。

之後要恢復廣告換額度的流程：

1. `npm install react-native-google-mobile-ads@^17.2.0`（版本號請對照你當下 Expo SDK 版本的現行版 — `expo-dev-client` 因為上面的 Google 登入工作已經裝好了）
2. 把 `react-native-google-mobile-ads` 的 plugin 設定加回 `app.json` 的 `plugins`（Google 的測試 App ID：`androidAppId: "ca-app-pub-3940256099942544~3347511713"`、`iosAppId: "ca-app-pub-3940256099942544~1458002511"`）
3. 取消 `_layout.tsx` 和 `add.tsx` 裡的註解，並還原 `src/hooks/use-bonus-analysis-ad.ts` 的函式內容（目前整個被註解掉）

在把廣告功能推給真實使用者之前：要先註冊 AdMob 帳號、登記這個 App、建立真正的獎勵廣告版位，然後把測試 ID 換成正式 ID（`app.json` 和 `use-bonus-analysis-ad.ts` 的 `BONUS_AD_UNIT_ID` 兩邊都要換）。

## 設計

### 配色

`src/constants/theme.ts` 是**單一固定的暖色調調色盤，刻意不跟隨系統的深色模式**。收藏品目錄的畫面主體是照片，米白底襯照片就像畫廊的牆；原本的純黑深色主題既跟照片互搶，也讓版面看起來沒做完。

| 用途 | 色值 | 對背景的對比度 |
|---|---|---|
| `background` 背景 | `#FDFBF7` | — |
| `backgroundElement` 卡片 / 輸入框 | `#F5F0E8` | — |
| `backgroundSelected` 次要按鈕 | `#E9E1D3` | — |
| `text` 文字 | `#2E2A24` | 13.8:1 |
| `textSecondary` 次要文字 | `#7A7064` | 4.7:1 |
| `accent` 主色（**只當填色**） | `#D98E7A` | 搭 `onAccent` 為 5.5:1 |
| `onAccent` 主色上的文字 | `#2E2A24` | — |
| `danger` 危險 | `#B3453A` | 5.3:1 |

所有文字色都達到 WCAG AA 的 4.5:1。`accent` 只用於填色（FAB、主要按鈕、選中的 chip），它本身當文字顏色對比不足 — 需要在主色上放文字時請用 `onAccent`。

要換配色的話，改這一個檔案的這幾個值就好，整個 App 都會跟著變。[Material Theme Builder](https://m3.material.io/theme-builder) 可以從一個主色產生整套色票；專案原本的灰階則是取自 [Radix Colors](https://www.radix-ui.com/colors)。

### 版面

`MaxContentWidth`（800px）透過 `src/components/screen-container.tsx` 套用在每個畫面上。沒有它的話，單欄表單在桌面瀏覽器裡會被拉到整個螢幕寬。

清單頁依視窗寬度顯示 2 / 3 / 4 欄的網格（`FlatList` 無法在不重新掛載的情況下改變 `numColumns`，所以那裡用了 `key` 強制重建）。

## 專案結構

```
src/
  app/                             # expo-router 畫面
    index.tsx                      #   清單 / 搜尋 / 篩選
    add.tsx                        #   拍照 + AI 辨識 + 重複偵測 + 建立
    item/[id].tsx                  #   檢視 / 編輯 / 刪除
    themes.tsx                     #   主題管理（新增、改名、別名、刪除）
    _layout.tsx                    #   驗證狀態分流 + navigation 主題
  components/
    login-screen.tsx               # 未登入時顯示
    app-header.tsx                 # 頂部列，窄螢幕收起字樣與 email
    screen-container.tsx           # 套用 MaxContentWidth，內容置中
    section.tsx                    # 表單分組（白底卡片）
    form-field.tsx                 # 有標籤的文字輸入框
    chip.tsx / filter-row.tsx      # 篩選 chip 與分類軸橫列
    type-picker.tsx                # 類型單選（存 slug，顯示中文）
    theme-selector.tsx             # 主題多選 ＋ 可新建
    status-toggle.tsx              # 已擁有 / 想要
    item-card.tsx                  # 清單網格卡片
    duplicate-compare.tsx          # 重複比對並列檢視
    empty-state.tsx                # 空狀態
    inline-banner.tsx              # 畫面內錯誤 / 確認提示（取代在 web 無效的 Alert）
    tag-editor.tsx / tag-chip.tsx  # 標籤編輯
    icon.tsx                       # Feather 圖示的具名集合
    themed-text.tsx / themed-view.tsx
  constants/
    theme.ts                       # 配色、間距、字級
    item-types.ts                  # 類型與狀態的 slug ↔ 中文對照
  hooks/
    use-auth-user.ts               # onAuthStateChanged 包裝
    use-google-sign-in.ts          # 原生：expo-auth-session → Firebase 憑證
    use-google-sign-in.web.ts      # web：Firebase signInWithPopup
    use-theme.ts                   # 回傳固定調色盤
    use-bonus-analysis-ad.ts       # 獎勵廣告 hook（目前未使用，見上方）
  lib/
    firebase.ts / firebase.web.ts  # Firebase 初始化（原生與 web 的持久化方式不同）
    db.ts                          # items / photos 的 CRUD、重複偵測
    themes.ts                      # themes 的 CRUD 與別名比對
    similarity.ts                  # 名稱相似度（字元 bigram 的 Dice 係數）
    compress-photo.ts              # 產出 1000px 原圖與 320px 縮圖
    similarity.ts                  # 名稱相似度（字元 bigram 的 Dice 係數）
    groq.ts                        # 呼叫 worker/（不是直接呼叫 Groq）
    mock-data.ts                   # 範例資料（僅開發模式，不進正式打包）
  types/firebase-auth-rn.d.ts      # firebase/auth 型別缺口的補丁
eas.json                           # EAS Build 設定檔
worker/                            # Cloudflare Worker：AI 辨識的後端
public/_redirects                  # Cloudflare Pages 路由，expo export 會複製
figma/                             # Figma Make 產出的設計原型（參考用，不執行）
```

> `figma/` 是獨立的 Vite 專案，有自己的 tsconfig 和依賴，已在根目錄 `tsconfig.json` 的 `exclude` 裡排除。

## 開發時的檢查

```bash
npx tsc --noEmit                  # 型別檢查
npx expo lint                     # ESLint
npx expo export --platform web    # 完整建置，比 dev server 更嚴格
```

開發模式下，清單頁空狀態有「載入範例資料」按鈕，有資料後網格下方有「清除全部」。兩者都由 `__DEV__` 隔離，正式打包裡完全不存在。

> **`__DEV__` 判斷要放在模組層，不要放在函式裡。** `lib/db.ts` 的 `seedMockItems` 原本寫成 `if (!__DEV__) return;`，正式打包仍然產出了一個 3.7KB 的範例資料 chunk —— Metro 建立模組圖的時機早於消除死程式碼，`import()` 只要出現在原始碼裡 chunk 就先生出來了。

`expo export` 值得偶爾跑一次：dev server 用的是 lazy chunk，有些打包問題（例如上面那個 `expo-sqlite` 的 worker chunk）只有在完整建置時才會浮現。
