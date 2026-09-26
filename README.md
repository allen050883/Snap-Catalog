# Snap Catalog

收藏品編目 App（拉拉熊、三麗鷗、盲盒公仔，或任何你在收集的東西），用來在買之前確認自己是不是已經有了。拍張照，讓 AI 幫你填好欄位，改一改存起來，之後用搜尋查。用 Google 帳號登入，收藏會跟著帳號跨裝置同步。

介面是繁體中文的，AI 辨識出來的內容也是。

## 技術組成

- **Expo（React Native + TypeScript）**，用 `expo-router` 做檔案式路由
- **Firebase Authentication**（Google 登入）+ **Cloud Firestore** — 收藏以 Google 帳號為範圍，你登入過的每台裝置都會同步
- **expo-image-picker** + **expo-image-manipulator** — 相機 / 相簿，上傳前先縮圖壓縮
- **Groq API**（視覺模型）— 從照片推測名稱 / 角色 / 系列 / 類別 / 顏色 / 標籤

## 安裝

```bash
npm install
cp .env.example .env   # 然後把 Groq API key 貼進 .env
```

接著二選一：`npx expo start --web`（現在就能跑，不需要任何原生 OAuth 設定），或用下面的 dev client 流程在實機上測。

## 使用流程

1. 用 Google 登入
2. 按右下角 **+** 新增
3. 拍照或從相簿選一張
4. App 把照片送給 Groq 的視覺模型，回傳名稱、角色、系列、類別、顏色和搜尋標籤，自動填進表單 — 會用掉今天的一次 AI 辨識額度（見下方）
5. 改任何欄位和標籤，然後儲存。所有東西（包括那張縮圖壓縮後以 base64 存的照片）都存在 Firestore 你的帳號底下
6. 在首頁用搜尋列以名稱、角色、系列、顏色或標籤查詢，確認是不是買過了。在另一台裝置用同一個 Google 帳號登入，收藏就在那裡

## 平台支援

### Web

這個 App 一度也以 `react-native-web` 輸出靜態網站為目標，那個目標現在暫緩，不過 `npx expo start --web` 和 `expo export --platform web` 都還能正常運作（Firebase / 驗證的部分本來就跨平台）。Web 也是最快的測試途徑，因為 Web 的 OAuth client ID 已經填好了，不需要碰任何原生 OAuth 設定。

Web 上有三個跟原生不同、需要各自處理的地方：

**1. `expo-sqlite` 會讓整個 web bundle 編譯失敗。** 它的瀏覽器版透過一個 worker chunk 載入 SQLite 引擎，而 Metro 的 web serializer 產不出那個 chunk，整包 bundle 會掛在 `Worker chunk not found for: expo-sqlite/web/worker.ts`。用到 SQLite 的只有每日額度，所以 `src/lib/usage.web.ts` 改用 `localStorage` 實作同一套 API，讓 `expo-sqlite` 完全不進 web bundle（跟 `firebase.ts` / `firebase.web.ts` 同樣的平台分檔手法）。原生端維持走 `usage.ts` 的 SQLite。

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

- **Firestore** 資料庫已建立，並發布了這組規則（每個使用者只能讀寫自己的 `users/{uid}/items/*`）：
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{userId}/items/{itemId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
  ```
- **Authentication → Sign-in method → Google** 已啟用
- **刻意不用 Cloud Storage** — Firebase 現在要求升級到付費的 Blaze 方案才能使用 Storage（低用量仍免費，但必須綁信用卡）。照片改為縮圖壓縮後（見 `lib/compress-photo.ts`）以 base64 字串直接存在 Firestore 的 item document 上，控制在 Firestore 單篇 1 MiB 的上限內。

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

### Groq API key

到 https://console.groq.com/keys 拿一組免費的 key，放進 `.env` 的 `EXPO_PUBLIC_GROQ_API_KEY`。`.env` 已經被 git 忽略 — 絕對不要 commit。

**安全性提醒：** `EXPO_PUBLIC_*` 開頭的變數會被打包進 client app。自己建置、自己使用的個人 App 沒問題，但如果你哪天把這個 App 上架給別人安裝，任何人都能從 App binary 裡把 key 挖出來。要做成公開 App 的話，請把 Groq 呼叫搬到你自己的小型後端後面。

### 用哪個模型？

預設是 `qwen/qwen3.8-27b` — Groq 目前提供的多模態模型，辨識收藏品的角色 / 系列 / 顏色已經夠準。

Groq 已經**下架了這個 App 原本預設的 `meta-llama/llama-4-scout` / `llama-4-maverick` 視覺模型**，現在請求它們會直接失敗。Groq 目前陣容裡的其他模型（`openai/gpt-oss-*`）全是純文字模型，收到圖片會回 `messages[0].content must be a string`。所以 `EXPO_PUBLIC_GROQ_VISION_MODEL` 只有在 Groq 之後新增別的視覺模型時才值得設定。確認你的 key 實際能用哪些：

```bash
curl -s https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $EXPO_PUBLIC_GROQ_API_KEY" | python3 -m json.tool
```

## AI 回傳的內容

Prompt（`src/lib/groq.ts`）要求模型用**繁體中文**回答，專有名詞後面接原文：

```json
{
  "name": "拉拉熊 草莓系列 坐姿玩偶",
  "character": "拉拉熊 Rilakkuma",
  "series": "草莓系列",
  "category": "plush",
  "color": "棕色、粉紅色",
  "tags": ["拉拉熊", "rilakkuma", "絨毛", "plush", "粉紅色", "pink", "草莓"]
}
```

兩個刻意的設計：

- **標籤中英文並存。** 這樣之後不管你打「拉拉熊」還是 `rilakkuma` 都搜得到，不會因為當下想到哪個語言而漏搜。
- **`category` 是唯一不翻譯的欄位**，存的是英文 slug。清單頁的類別快篩要靠這個值做比對，而中文標籤屬於呈現層、隨時可能改措辭 — 分開之後改文案不會讓舊資料對不上。slug 和中文標籤的對照表在 `src/constants/categories.ts`，`groq.ts` 的 prompt 也是從同一份清單產生允許值，不會兩邊走鐘。

## 每日 AI 額度

AI 辨識（也就是 Groq 呼叫）有次數限制，讓 API 用量可以預期：**每個日曆日 5 次免費**（依裝置本地時間，午夜重置）。用完之後你仍然可以手動填寫所有欄位並儲存 — 被擋住的只有 AI 呼叫本身。

追蹤在 `src/lib/usage.ts`（原生：SQLite）/ `usage.web.ts`（web：`localStorage`），每天一筆 `{ used, bonus }`。這份資料**刻意保持本機、各裝置獨立**，因為它管的是你自己的 Groq 用量上限，不是收藏資料。

> Web 上想重置額度來測試：在瀏覽器 DevTools console 執行 `localStorage.removeItem('snap-catalog:ai-usage')`。

**目前暫停：看廣告換取額外次數。** 這個功能曾經可以運作 — 看完一支獎勵廣告就多得到當天一次額度 — 用 `react-native-google-mobile-ads` 實作。程式碼是註解掉而非刪除，在 `src/app/_layout.tsx` 和 `src/app/add.tsx` 裡，`usage.ts` 的 `bonus` 欄位和 `grantBonusAnalysis()` 也都還在，隨時可以接回去。橫幅廣告（常駐在畫面上的廣告條）討論過但從未實作。

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
    index.tsx                      #   清單 / 搜尋 / 類別快篩
    add.tsx                        #   拍照 + AI 辨識 + 建立
    item/[id].tsx                  #   檢視 / 編輯 / 刪除
    _layout.tsx                    #   驗證狀態分流 + navigation 主題
  components/
    login-screen.tsx               # 未登入時顯示
    screen-container.tsx           # 套用 MaxContentWidth，內容置中
    section.tsx                    # 表單分組
    form-field.tsx                 # 有標籤的文字輸入框
    category-picker.tsx            # 類別單選（存 slug，顯示中文）
    item-card.tsx                  # 清單網格卡片
    tag-editor.tsx / tag-chip.tsx  # 標籤編輯
    inline-banner.tsx              # 畫面內錯誤 / 確認提示（取代在 web 無效的 Alert）
    themed-text.tsx / themed-view.tsx
  constants/
    theme.ts                       # 配色、間距、字級
    categories.ts                  # 類別 slug ↔ 中文標籤對照
  hooks/
    use-auth-user.ts               # onAuthStateChanged 包裝
    use-google-sign-in.ts          # 原生：expo-auth-session → Firebase 憑證
    use-google-sign-in.web.ts      # web：Firebase signInWithPopup
    use-theme.ts                   # 回傳固定調色盤
    use-bonus-analysis-ad.ts       # 獎勵廣告 hook（目前未使用，見上方）
  lib/
    firebase.ts / firebase.web.ts  # Firebase app/auth/Firestore 初始化（原生與 web 的持久化方式不同）
    db.ts                          # items 的 Firestore CRUD（users/{uid}/items/{itemId}）
    compress-photo.ts              # 縮圖壓縮，符合 Firestore 單篇 1 MiB 上限
    usage.ts / usage.web.ts        # 每日 AI 額度（本機、各裝置獨立）：原生 SQLite、web localStorage
    groq.ts                        # Groq 視覺 API 呼叫與 prompt
  types/firebase-auth-rn.d.ts      # firebase/auth 型別缺口的型別補丁（見檔案內註解）
eas.json                           # EAS Build 設定檔（`eas build --profile development` 需要）
```

## 開發時的檢查

```bash
npx tsc --noEmit                  # 型別檢查
npx expo lint                     # ESLint
npx expo export --platform web    # 完整建置，比 dev server 更嚴格
```

`expo export` 值得偶爾跑一次：dev server 用的是 lazy chunk，有些打包問題（例如上面那個 `expo-sqlite` 的 worker chunk）只有在完整建置時才會浮現。
