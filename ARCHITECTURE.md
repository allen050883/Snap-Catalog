# 架構

SnapLocker 的完整結構、資料流與各個決定的理由。

- 分類模型與畫面規格 → [SPEC.md](SPEC.md)
- 環境設定與開發 → [README.md](README.md)
- 部署 → [DNS.md](DNS.md)
- 待辦 → [PLAN.md](PLAN.md)

## 目錄

1. [全貌](#1-全貌)
2. [三個執行環境](#2-三個執行環境)
3. [資料存在哪裡](#3-資料存在哪裡)
4. [登入流程](#4-登入流程)
5. [AI 辨識流程](#5-ai-辨識流程)
6. [重複偵測流程](#6-重複偵測流程)
7. [照片的兩段式儲存](#7-照片的兩段式儲存)
8. [平台差異](#8-平台差異)
9. [信任邊界](#9-信任邊界)
10. [模組地圖](#10-模組地圖)

---

## 1. 全貌

```mermaid
graph TB
    subgraph client["使用者的裝置"]
        app["SnapLocker App<br/>Expo · React Native<br/>web / iOS / Android 同一份程式碼"]
    end

    subgraph cf["Cloudflare"]
        pages["Pages<br/>靜態網站 2.4MB"]
        worker["Worker<br/>snaplocker-api"]
        kv[("KV<br/>每日額度")]
    end

    subgraph google["Google"]
        auth["Firebase Auth<br/>Google 登入"]
        fs[("Cloud Firestore<br/>收藏資料")]
        jwks["公開金鑰<br/>JWKS"]
    end

    groq["Groq API<br/>qwen/qwen3.8-27b"]

    app -->|"下載網站"| pages
    app -->|"登入"| auth
    app <-->|"讀寫收藏<br/>規則綁 uid"| fs
    app -->|"POST /analyze<br/>帶 ID token"| worker
    worker -->|"驗證 token"| jwks
    worker <-->|"查/記額度"| kv
    worker -->|"呼叫，用自己的 key"| groq

    classDef danger fill:#B3453A,color:#fff,stroke:#B3453A
    classDef safe fill:#D98E7A,color:#2E2A24,stroke:#D98E7A
    class worker safe
    class groq danger
```

**最重要的一條線**：App **不會**直接呼叫 Groq。Groq 的 key 只存在 Worker 的環境變數裡。

原因見[第 9 節](#9-信任邊界) —— 簡單講，任何 `EXPO_PUBLIC_*` 都會明文躺在打包後的 JS 裡。

---

## 2. 三個執行環境

同一份 `src/` 產出三個目標，差異靠檔名慣例處理（`foo.web.ts` 在 web 上會蓋掉 `foo.ts`）。

| | Web | iOS | Android |
|---|---|---|---|
| 狀態 | ✅ 開發中主要平台 | ⚠️ 從未建置過 | ❌ 登入不能用 |
| 建置 | `expo export --platform web` | `eas build` 或 `expo run:ios` | 同左 |
| Google 登入 | `signInWithPopup`<br/>`use-google-sign-in.web.ts` | `expo-auth-session`<br/>`use-google-sign-in.ts` | 同 iOS，但缺 client ID |
| Auth 持久化 | 瀏覽器儲存 | AsyncStorage | AsyncStorage |
| 阻塞項 | — | 需要 Xcode 或付費 Apple 帳號 | `ANDROID_CLIENT_ID` 是空的 |

> Android 的 OAuth client ID 見 [PLAN.md](PLAN.md) §3.1，iOS 的測試路徑見 [PLAN.md](PLAN.md)。

---

## 3. 資料存在哪裡

```mermaid
graph LR
    subgraph fs["Cloud Firestore"]
        direction TB
        u["users/{uid}"]
        t["themes/{themeId}<br/>name, aliases, matchKeys"]
        s["series/{seriesId}<br/>themeId, name, year"]
        i["items/{itemId}<br/>收藏本體 + 縮圖"]
        p["photos/{itemId}<br/>原圖 base64"]
        u --> t
        u --> s
        u --> i
        u --> p
    end

    subgraph kv["Cloudflare KV"]
        q["usage:{uid}:{date}<br/>今日已用次數"]
    end

    i -.->|"themeIds[]"| t
    i -.->|"seriesId"| s
    i -.->|"同一個 id"| p
```

### 為什麼收藏用 id 參照主題與系列

早期版本把主題名稱字串直接存在 item 上。問題是 AI 回「拉拉熊 Rilakkuma」，而使用者建的叫「拉拉熊」，就會產生第二筆近乎重複的主題，篩選列同時列出兩個。

改成 id 參照之後：**改名或新增別名只要改一個地方，所有收藏同步生效**。

### 四個集合的安全規則

```
match /users/{userId}/{collection}/{docId} {
  allow read, write: if request.auth != null
                     && request.auth.uid == userId
                     && collection in ['themes', 'series', 'items', 'photos'];
}
```

用白名單而非萬用比對 —— 之後不小心寫到別的路徑會被擋下，而不是默默放行。

---

## 4. 登入流程

Web 和原生走的是**兩條完全不同的路**。

```mermaid
sequenceDiagram
    participant U as 使用者
    participant A as App (web)
    participant F as Firebase Auth
    participant G as Google

    U->>A: 按「使用 Google 登入」
    A->>F: signInWithPopup()
    F->>G: 彈出視窗，導向<br/>*.firebaseapp.com/__/auth/handler
    G-->>U: 選擇帳號
    G->>F: 授權碼
    F->>A: postMessage 回傳憑證
    Note over F,A: Firebase 檢查發起的 origin<br/>在不在「授權網域」清單裡
    A->>A: onAuthStateChanged 觸發
```

### 為什麼 web 不用 expo-auth-session

`expo-auth-session` 在 web 上會把 redirect URI 指回**當下服務的 origin**。開發時是 `http://localhost:8081`，而 Firebase 自動建立的 OAuth client 沒有註冊這個位址，Google 會以 `400: redirect_uri_mismatch` 擋下。

更麻煩的是這表示**每換一個 port、每部署一個網域，都要回 Google Cloud Console 手動加一條**。

`signInWithPopup` 導向的是 Firebase 託管網域上的 handler，那個位址在建立 OAuth client 時就註冊好了。改由 **Firebase Console 的「授權網域」**控管，設定簡單得多。

> **代價**：每個新網域都要記得加進授權網域，否則 `auth/unauthorized-domain`。部署到 Cloudflare 時特別容易忘 —— Firebase 自己的網域預設就在清單裡，換別家就不是了。見 [DNS.md](DNS.md) 第 6 節。

---

## 5. AI 辨識流程

```mermaid
sequenceDiagram
    participant U as 使用者
    participant A as App
    participant W as Worker
    participant J as Google JWKS
    participant K as KV
    participant Q as Groq

    U->>A: 拍照 / 選圖
    A->>A: 壓成 1000px 原圖 + 320px 縮圖
    A->>W: POST /analyze<br/>Bearer <ID token><br/>{ image: 原圖 dataURI }

    rect rgba(217,142,122,0.15)
        Note over W,J: 1 · 你是誰
        W->>J: 取得公鑰（快取 1 小時）
        J-->>W: JWKS
        W->>W: 驗簽章 + 檢查 aud/iss/exp/iat
        Note right of W: 失敗 → 401
    end

    rect rgba(217,142,122,0.15)
        Note over W,K: 2 · 還有額度嗎
        W->>K: GET usage:{uid}:{今天}
        K-->>W: 已用次數
        Note right of W: 超過 → 429
    end

    rect rgba(217,142,122,0.15)
        Note over W,Q: 3 · 呼叫 Groq
        W->>Q: 用 Worker 自己的 key<br/>+ 伺服器端的 prompt
        Q-->>W: JSON
        Note right of W: Groq 的錯誤只寫 log<br/>不回傳給前端
    end

    W->>K: 成功才計次
    W-->>A: { suggestion, usage }

    A->>A: 主題比對別名 → 選上或詢問
    A->>A: 系列比對 → 選上或詢問
    A->>A: 重複偵測
    A-->>U: 填好的表單
```

### 三個刻意的決定

**prompt 放在 Worker，不在前端。** 它決定模型被問什麼，那不該是呼叫端可以改寫的東西。Worker 直接 `import` 了 `src/constants/item-types.ts`（那個檔案沒有任何依賴），所以**類型清單只有一份**，前後端不會走鐘。

**Groq 的錯誤內容不回傳。** 它的 429 訊息會帶上你的組織 id 和 token 預算。那些只寫進 Worker 的 log，前端看到的一律是「AI 額度不足，請洽詢管理員」。

**成功才計次。** 模型回傳無法解析、或 Groq 掛掉，都不扣使用者的額度。

### 辨識後的比對

AI 回傳的主題名稱**不會直接寫入**。

```mermaid
graph TD
    r["AI 回「拉拉熊 Rilakkuma」"] --> n["正規化：轉小寫、去空白"]
    n --> q["查 themes.matchKeys<br/>array-contains"]
    q -->|"命中"| sel["自動選上既有主題"]
    q -->|"整串沒中"| w["拆詞再查<br/>拉拉熊 / rilakkuma"]
    w -->|"命中"| sel
    w -->|"還是沒中"| ask["顯示提示條<br/>「要建立新主題嗎？」"]
    ask -->|"使用者按下"| create["才建立"]
    ask -->|"使用者忽略"| skip["不建立"]

    classDef warn fill:#B3453A,color:#fff,stroke:#B3453A
    class ask warn
```

**為什麼不自動建立**：模型看到任何有角色形狀的東西一定會給名字。測試時它把一隻隨手畫的粉紅兔子說成「Peppa Pig」（那是豬）。自動建立會讓這種幻覺直接長進主題清單。

**為什麼要拆詞**：Firestore 沒有不分大小寫的比對，也沒有子字串查詢。所以每個主題把它答應的所有拼法**預先正規化**存成 `matchKeys` 陣列。空白是直接去除而非壓縮，而且每個別名除了自己，還會把裡面的每個詞各自拆出來當一個 key —— 這樣 AI 回的合併形式才對得上使用者建的單一名稱。

---

## 6. 重複偵測流程

整個分類模型存在的理由。

```mermaid
graph TD
    start["主題 / 系列 / 類型<br/>任一欄位變動"] --> gate{"有主題<br/>且有類型？"}
    gate -->|"否"| none["不檢查"]
    gate -->|"是"| f1{"類型相同？"}
    f1 -->|"否"| skip["不是重複"]
    f1 -->|"是"| f2{"共享至少<br/>一個主題？"}
    f2 -->|"否"| skip
    f2 -->|"是"| f3{"seriesId 相同？"}
    f3 -->|"否"| skip
    f3 -->|"是"| f4{"兩邊都<br/>沒選系列？"}
    f4 -->|"否"| hit["可能重複"]
    f4 -->|"是"| sim{"名稱相似度<br/>≥ 0.65？"}
    sim -->|"否"| skip
    sim -->|"是"| hit

    hit --> ui["表單最上方並列比對"]

    classDef ok fill:#D98E7A,color:#2E2A24,stroke:#D98E7A
    class hit,ui ok
```

### 前置條件為什麼存在

沒有主題或沒有類型就完全不檢查。資訊太少，而**每一筆沒填分類的收藏都跳警告的話，使用者很快就學會無視它** —— 那這個功能就廢了。

### 名稱相似度那道關卡

「系列相同」在兩邊都沒選系列時會退化成「兩個 `null` 相等」，於是任兩筆同主題同類型的收藏都會互相誤報。所以那種情況改由名稱決定。

演算法是**字元 bigram 的 Dice 係數**（`src/lib/similarity.ts`）。中文沒有空格可以斷詞，「拉拉熊繪畫系列行李箱」整串會被當成一個詞；滑動取兩字一組才抓得到共同片段。

門檻 0.65 是拿真實案例跑出分佈決定的，不是憑感覺：

| | 分數 |
|---|---|
| 應該命中，最低的 | **0.667**　同一個行李箱的「繪畫系列」vs「繪畫主題」 |
| **門檻** | **0.65** |
| 不該命中，最高的 | **0.600**　「行李箱」vs「旅行箱」、「馬克杯」vs「水壺」 |

### 刻意不比對的欄位

尺寸、顏色、標籤、數量。**它們恰恰是兩個候選最可能不同的欄位**，而「同系列不同尺寸」是不同的東西、不是重複。所以改成顯示在比對畫面上讓使用者判斷。

### 已知限制

這全部都是 metadata 比對，**抓不到「同一個東西但兩張照片不一樣」** —— 而那正是主要場景（店裡拍 vs 家裡拍，光線背景角度全不同）。影像比對因為要付費暫緩，見 [PLAN.md](PLAN.md) §1.1。

---

## 7. 照片的兩段式儲存

```mermaid
graph LR
    cam["拍照 / 選圖"] --> c["compress-photo.ts"]
    c --> full["原圖<br/>1000px · q0.6"]
    c --> thumb["縮圖<br/>320px · q0.5"]

    thumb --> item["items/{id}<br/>.thumbnail"]
    full --> photo["photos/{id}<br/>.base64"]
    full -.->|"只送這份給 AI"| ai["Worker → Groq"]

    item --> grid["清單網格<br/>讀每一筆"]
    photo --> detail["細節頁<br/>只讀一筆"]
```

### 為什麼要拆

清單頁會讀取它顯示的**每一筆**。原圖留在 item 上的話，每次回到清單就會把整個收藏庫的照片重新下載一遍：

| 收藏數 | 原圖在 item 上 | 拆開後 |
|---|---|---|
| 20 件 | 約 4 MB | 約 400 KB |
| 100 件 | 約 20 MB | 約 2 MB |

### 實作細節

- `photos` 的文件 id **刻意與 item 相同**，取原圖不用查詢，直接讀一筆文件
- 寫入用 `writeBatch`，item 和照片不會脫鉤
- 刪除時**無條件刪兩邊** —— 刪不存在的文件在 Firestore 是 no-op，這樣就算 `hasPhoto` 旗標過期也不會留下孤兒圖
- 細節頁**漸進載入**：先畫縮圖，原圖抓到再換上，不讓整頁卡在一張圖上
- 送給 AI 的是**原圖**，縮圖太小看不清角色的臉

---

## 8. 平台差異

用 `foo.web.ts` 蓋掉 `foo.ts` 的慣例處理，共三處。

| 檔案 | Web | 原生 | 為什麼 |
|---|---|---|---|
| `lib/firebase` | `getAuth()` | `initializeAuth` + AsyncStorage | RN 沒有瀏覽器儲存；而 `getReactNativePersistence` 在瀏覽器版的 firebase 裡根本沒有匯出 |
| `hooks/use-google-sign-in` | `signInWithPopup` | `expo-auth-session` | 見[第 4 節](#4-登入流程) |

> **新增 `*.web.ts` 之後，Metro 不會自動重新解析模組。** 必須 `npx expo start --clear` 重啟，否則會繼續拿到舊的原生版本。徵兆是 bundle 大小完全沒變。

### 兩個 web 專屬的坑

**`Alert.alert()` 在 `react-native-web` 裡是空函式。**

```js
class Alert { static alert() {} }
```

所以 web 上所有錯誤訊息都不會出現，刪除確認框也不會跳 —— 刪除功能等於完全失效。現在全部改用 `components/inline-banner.tsx` 在畫面內呈現。**之後新增程式碼時不要用 `Alert`。**

**`expo-sqlite` 會讓整個 web bundle 編譯失敗**（`Worker chunk not found for: expo-sqlite/web/worker.ts`）。這個專案已經不用 SQLite 了（額度移到伺服器），但如果之後又引入，要記得它在 web 上編不過。

---

## 9. 信任邊界

```mermaid
graph TB
    subgraph untrusted["不可信：使用者能看到與修改的一切"]
        js["打包後的 JS<br/>所有 EXPO_PUBLIC_* 明文可見"]
        ls["瀏覽器儲存"]
        req["送出的任何請求"]
    end

    subgraph trusted["可信：使用者碰不到"]
        wk["Worker 環境變數<br/>GROQ_API_KEY"]
        kvq["KV 的額度計數"]
        rules["Firestore 安全規則"]
    end

    js -.->|"帶 ID token"| wk
    req -.->|"規則驗證 uid"| rules

    classDef bad fill:#B3453A,color:#fff,stroke:#B3453A
    classDef good fill:#D98E7A,color:#2E2A24,stroke:#D98E7A
    class js,ls,req bad
    class wk,kvq,rules good
```

### 什麼東西保護什麼

| 資產 | 靠什麼保護 | 夠嗎 |
|---|---|---|
| 收藏資料 | Firestore 規則綁 `request.auth.uid` | ✅ 別人讀不到你的東西 |
| Groq API key | 只存在 Worker 環境變數 | ✅ 從不送到瀏覽器 |
| 每日額度 | KV 計數，以驗證過的 uid 為 key | ✅ 前端改不到 |
| Worker 端點 | Firebase ID token + CORS 白名單 | ✅ 要先登入你的 App |
| Firebase web config | 不需要保護 | ✅ 設計上就是公開的 |

### 為什麼不能只做轉發

一個沒有驗證的 endpoint，只是把「別人偷你的 key」變成「別人直接用你的 endpoint」—— 額度照樣被吃光，而且更方便，連 F12 都不用開。

所以 Worker 做三件事，缺一不可：

1. **驗證 Firebase ID token** —— 不做的話，端點跟外洩的 key 一樣開放
2. **CORS 只回應白名單 origin** —— 用 `*` 的話，網路上任何頁面都能拿著在別處釣到的 token 來消耗額度
3. **額度記在伺服器** —— 以前記在 localStorage，使用者自己改得掉，等於沒有

### 額度重置的時區

伺服器用**固定時區（Asia/Taipei）**計算「今天」，不是裝置本地時間。以前依裝置午夜，改手機時鐘就能重置額度。

---

## 10. 模組地圖

```
src/
  app/                          expo-router 畫面
    _layout.tsx                 登入狀態分流 + navigation 主題
    +html.tsx                   web 的 HTML 外殼（標題、lang、底色）
    index.tsx                   清單 / 搜尋 / 篩選
    add.tsx                     拍照 → 辨識 → 重複偵測 → 建立
    item/[id].tsx               檢視 / 編輯 / 刪除
    themes.tsx                  主題管理（名稱、別名、系列）

  components/                   全部是展示層，不直接碰 Firestore
    app-header.tsx              品牌、主題管理入口、登出
    item-card.tsx               網格卡片
    duplicate-compare.tsx       重複比對並列檢視
    theme-selector.tsx          主題多選 + 可新建
    series-selector.tsx         系列單選，連動於所選主題
    type-picker.tsx             類型單選
    status-toggle.tsx           已擁有 / 想要
    chip.tsx / filter-row.tsx   篩選
    form-field.tsx / section.tsx
    inline-banner.tsx           取代在 web 無效的 Alert
    empty-state.tsx
    icon.tsx                    Feather 圖示的具名集合
    screen-container.tsx        套用 MaxContentWidth
    tag-editor.tsx / tag-chip.tsx
    themed-text.tsx / themed-view.tsx

  lib/                          所有 I/O 都在這裡
    firebase.ts / .web.ts       初始化（持久化方式不同）
    db.ts                       items / photos CRUD、重複偵測
    themes.ts                   themes CRUD、別名比對
    series.ts                   series CRUD
    similarity.ts               名稱相似度（bigram Dice）
    compress-photo.ts           產出原圖 + 縮圖
    groq.ts                     呼叫 Worker（不是 Groq）
    mock-data.ts                範例資料，僅開發模式

  constants/
    theme.ts                    配色、間距、字級
    item-types.ts               類型與狀態 slug ↔ 中文　※ Worker 也引用這個

  hooks/
    use-auth-user.ts            onAuthStateChanged 包裝
    use-google-sign-in.ts/.web  平台分流
    use-theme.ts

worker/                         Cloudflare Worker
  src/index.ts                  路由、CORS、Groq 呼叫、prompt
  src/firebase-auth.ts          手寫的 JWT 驗證（WebCrypto）
  src/usage.ts                  KV 的每日額度
  wrangler.toml                 設定（GROQ_API_KEY 刻意不在這裡）

public/
  _redirects                    Cloudflare Pages 路由，會被 expo export 複製

figma/                          設計原型，參考用，不執行
```

### 一條貫穿的原則

**畫面不直接碰 Firestore。** 所有 I/O 集中在 `lib/`，畫面只呼叫函式。所以像「照片拆成兩份存」這種改動只動了 `db.ts` 和 `compress-photo.ts`，六個畫面沒有一個需要知道細節。

### Worker 與 App 共用的東西

只有一個檔案：`src/constants/item-types.ts`。它沒有任何 import，所以 Worker 可以直接引用。這讓**類型清單只有一份** —— prompt 裡允許的值和 App 顯示的選項不可能不一致。
