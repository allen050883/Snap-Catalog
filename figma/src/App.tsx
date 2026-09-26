import { useMemo, useRef, useState } from "react";

type IconName =
  | "archive"
  | "camera"
  | "check"
  | "chevron"
  | "close"
  | "image"
  | "logout"
  | "plus"
  | "search"
  | "settings"
  | "sparkles"
  | "trash"
  | "upload";

type Status = "owned" | "wished";
type Dialog = "add" | "detail" | "themes" | null;

type Item = {
  id: string;
  name: string;
  themes: string[];
  series: string;
  type: string;
  status: Status;
  size: string;
  color: string;
  tags: string[];
  image: string;
  quantity: number;
};

const items: Item[] = [
  {
    id: "01",
    name: "草莓蛋糕拉拉熊",
    themes: ["拉拉熊"],
    series: "草莓派對系列",
    type: "娃娃",
    status: "owned",
    size: "M・坐姿",
    color: "奶茶棕",
    tags: ["限定", "strawberry"],
    image:
      "https://images.unsplash.com/photo-1718804715033-8e045415f6f3?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=720&h=720",
    quantity: 1,
  },
  {
    id: "02",
    name: "森林動物小隊",
    themes: ["拉拉熊"],
    series: "森林散步系列",
    type: "盲盒",
    status: "owned",
    size: "盒玩",
    color: "米白色",
    tags: ["完整盒況"],
    image:
      "https://images.unsplash.com/photo-1769778674802-28bfd3d4b391?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=720&h=720",
    quantity: 1,
  },
  {
    id: "03",
    name: "午夜黑貓公仔",
    themes: ["三麗鷗"],
    series: "夜色收藏系列",
    type: "公仔",
    status: "owned",
    size: "12 cm",
    color: "黑色",
    tags: ["限定", "黑貓"],
    image:
      "https://images.unsplash.com/photo-1772121034472-de4d2977bdbb?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=720&h=720",
    quantity: 1,
  },
  {
    id: "04",
    name: "森林鈴鐺精靈",
    themes: ["吉伊卡哇"],
    series: "森林探險系列",
    type: "娃娃",
    status: "wished",
    size: "S・吊飾",
    color: "象牙白",
    tags: ["聖誕節"],
    image:
      "https://images.unsplash.com/photo-1763120432102-9a627393d407?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=720&h=720",
    quantity: 1,
  },
  {
    id: "05",
    name: "復古陶瓷小狗組",
    themes: ["寶可夢"],
    series: "復古生活系列",
    type: "餐具",
    status: "owned",
    size: "一組兩入",
    color: "棕色",
    tags: ["二手", "復古"],
    image:
      "https://images.unsplash.com/photo-1617341173592-1ba5fbaf3c92?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=720&h=720",
    quantity: 2,
  },
  {
    id: "06",
    name: "格鬥經典角色",
    themes: ["寶可夢"],
    series: "經典遊戲系列",
    type: "公仔",
    status: "wished",
    size: "15 cm",
    color: "紅色",
    tags: ["聯名"],
    image:
      "https://images.unsplash.com/photo-1566577134770-3d85bb3a9cc4?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=720&h=720",
    quantity: 1,
  },
];

const typeOptions = [
  "娃娃",
  "公仔",
  "盲盒",
  "文具",
  "鑰匙圈",
  "包袋",
  "行李箱",
  "服飾",
  "餐具",
  "配件",
  "其他",
];

function Icon({
  name,
  className = "size-5",
}: {
  name: IconName;
  className?: string;
}) {
  const paths: Record<IconName, React.ReactNode> = {
    archive: (
      <>
        <path d="M4 7h16M5 7l1 13h12l1-13M3 4h18v3H3z" />
        <path d="M9 11h6" />
      </>
    ),
    camera: (
      <>
        <path d="M4 7h3l1.5-2h7L17 7h3v12H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    image: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="m3 17 5-4 4 3 3-2 6 5" />
      </>
    ),
    logout: (
      <>
        <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a2 2 0 0 0 .4 2l-2.8 2.8a2 2 0 0 0-2-.4 2 2 0 0 0-1 1.6h-4a2 2 0 0 0-1-1.6 2 2 0 0 0-2 .4L4.2 17a2 2 0 0 0 .4-2A2 2 0 0 0 3 14v-4a2 2 0 0 0 1.6-1 2 2 0 0 0-.4-2L7 4.2a2 2 0 0 0 2 .4A2 2 0 0 0 10 3h4a2 2 0 0 0 1 1.6 2 2 0 0 0 2-.4L19.8 7a2 2 0 0 0-.4 2A2 2 0 0 0 21 10v4a2 2 0 0 0-1.6 1Z" />
      </>
    ),
    sparkles: (
      <>
        <path d="M12 3c.4 3.2 1.8 4.6 5 5-3.2.4-4.6 1.8-5 5-.4-3.2-1.8-4.6-5-5 3.2-.4 4.6-1.8 5-5Z" />
        <path d="M19 14c.2 2 1 2.8 3 3-2 .2-2.8 1-3 3-.2-2-1-2.8-3-3 2-.2 2.8-1 3-3Z" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4M7 9l5-5 5 5M5 15v5h14v-5" />
      </>
    ),
  };
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function Button({
  children,
  variant = "primary",
  className = "",
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const styles = {
    primary: "bg-accent text-ink hover:brightness-95",
    secondary: "bg-selected text-ink hover:brightness-95",
    ghost: "bg-transparent text-muted hover:bg-element hover:text-ink",
    danger: "bg-danger text-white hover:brightness-95",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Chip({
  children,
  selected,
  onClick,
  removable,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  removable?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
        selected
          ? "bg-accent text-ink"
          : "bg-element text-muted hover:bg-selected hover:text-ink"
      }`}
    >
      {selected && !removable && <Icon name="check" className="size-3.5" />}
      {children}
      {removable && <Icon name="close" className="size-3.5" />}
    </button>
  );
}

function Field({
  label,
  defaultValue,
  placeholder,
  type = "text",
  suffix,
}: {
  label: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  suffix?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium text-muted">{label}</span>
      <span className="relative">
        <input
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="w-full rounded-lg border border-transparent bg-element px-3 py-3 text-base font-medium text-ink outline-none transition placeholder:text-muted/60 focus:border-ink/20 focus:bg-white"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      <div className="grid gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_0_rgb(46_42_36_/_0.06)]">
        {children}
      </div>
    </section>
  );
}

function InlineBanner({
  tone = "info",
  title,
  children,
  action,
  onAction,
}: {
  tone?: "info" | "error" | "danger";
  title: string;
  children?: React.ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className={`rounded-lg border-l-4 p-3 ${
        tone === "info"
          ? "border-accent bg-element"
          : "border-danger bg-red-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">{title}</p>
          {children && (
            <div className="mt-1 text-sm leading-5 text-muted">{children}</div>
          )}
        </div>
        {action && (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 text-sm font-bold text-ink underline decoration-ink/30 underline-offset-4"
          >
            {action}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusToggle({
  value,
  onChange,
}: {
  value: Status;
  onChange: (value: Status) => void;
}) {
  return (
    <div className="grid grid-cols-2 rounded-lg bg-element p-1">
      {[
        ["owned", "已擁有"],
        ["wished", "想要"],
      ].map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key as Status)}
          className={`rounded-md px-4 py-2 text-sm font-bold transition ${
            value === key ? "bg-white text-ink shadow-sm" : "text-muted"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DuplicateCompare({
  onClose,
  onQuantity,
}: {
  onClose: () => void;
  onQuantity: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-accent bg-white">
      <div className="flex items-center justify-between bg-element px-4 py-3">
        <div>
          <p className="text-sm font-bold text-ink">這件收藏可能已經有了</p>
          <p className="mt-0.5 text-sm text-muted">主題、系列和類型完全相同</p>
        </div>
        <span className="rounded-full bg-accent px-2.5 py-1 text-sm font-bold text-ink">
          92% 相似
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4">
        {[
          ["這次辨識", items[0].image, "草莓派對 拉拉熊"],
          ["收藏庫已有", items[0].image, "草莓蛋糕拉拉熊"],
        ].map(([label, image, name]) => (
          <div key={label} className="min-w-0">
            <p className="mb-2 text-sm font-bold text-muted">{label}</p>
            <img
              src={image}
              alt={name}
              className="aspect-square w-full rounded-lg object-cover"
            />
            <p className="mt-2 truncate text-sm font-bold text-ink">{name}</p>
          </div>
        ))}
      </div>
      <div className="mx-4 border-t border-selected py-3">
        <div className="grid grid-cols-[5rem_1fr_1fr] gap-2 text-sm">
          <span className="font-bold text-muted">相同</span>
          <span className="col-span-2 text-ink">
            拉拉熊 · 草莓派對系列 · 娃娃
          </span>
          <span className="font-bold text-muted">不同</span>
          <span className="text-ink">尺寸 M</span>
          <span className="text-ink">尺寸 S</span>
        </div>
      </div>
      <div className="grid gap-2 border-t border-selected p-4 sm:grid-cols-3">
        <Button variant="ghost" onClick={onClose}>
          不一樣，繼續新增
        </Button>
        <Button variant="secondary" onClick={onClose}>
          確實重複，不儲存
        </Button>
        <Button onClick={onQuantity}>已有數量 +1</Button>
      </div>
    </div>
  );
}

function ItemForm({
  mode,
  item,
  onClose,
}: {
  mode: "add" | "detail";
  item?: Item;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState(item?.image ?? items[0].image);
  const [recognizing, setRecognizing] = useState(false);
  const [duplicate, setDuplicate] = useState(mode === "add");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [status, setStatus] = useState<Status>(item?.status ?? "owned");
  const [selectedThemes, setSelectedThemes] = useState(
    item?.themes ?? ["拉拉熊"],
  );
  const [selectedType, setSelectedType] = useState(item?.type ?? "娃娃");
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);

  const loadPhoto = (file?: File) => {
    if (file) setPhoto(URL.createObjectURL(file));
    setRecognizing(true);
    window.setTimeout(() => {
      setRecognizing(false);
      setDuplicate(true);
    }, 1200);
  };

  const toggleTheme = (theme: string) => {
    setSelectedThemes((current) =>
      current.includes(theme)
        ? current.filter((value) => value !== theme)
        : [...current, theme],
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "add" ? "新增收藏" : "收藏細節"}
    >
      <div className="max-h-[96vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-page shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-selected bg-page/95 px-4 py-3 backdrop-blur sm:px-6">
          <div>
            <h2 className="text-xl font-semibold text-ink">
              {mode === "add" ? "新增收藏" : "編輯收藏"}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {mode === "add"
                ? "先拍照辨識，再確認收藏資訊"
                : "建立於 2025 年 2 月 16 日"}
            </p>
          </div>
          <Button variant="ghost" className="!size-10 !p-0" onClick={onClose}>
            <Icon name="close" />
          </Button>
        </div>

        <div className="grid gap-6 p-4 sm:p-6">
          <Section title="照片" hint="圖片只會用於辨識與收藏記錄">
            <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-selected">
                {photo ? (
                  <img
                    src={photo}
                    alt="收藏品預覽"
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted">
                    <Icon name="image" className="size-8" />
                  </div>
                )}
                {recognizing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/50 text-white">
                    <span className="size-7 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => loadPhoto(event.target.files?.[0])}
                />
                <Button onClick={() => fileRef.current?.click()}>
                  <Icon name="camera" />
                  拍照
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => fileRef.current?.click()}
                >
                  <Icon name="upload" />
                  從相簿選擇
                </Button>
                <button
                  type="button"
                  onClick={() => loadPhoto()}
                  className="mt-1 text-sm font-bold text-ink underline decoration-ink/30 underline-offset-4"
                >
                  重新辨識這張照片
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-element px-3 py-2.5">
              <Icon name="sparkles" className="size-4 text-ink" />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3 text-sm font-bold text-ink">
                  <span>{recognizing ? "AI 正在辨識照片…" : "AI 辨識完成"}</span>
                  <span>今日剩餘 7 次</span>
                </div>
                {recognizing && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-selected">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-accent" />
                  </div>
                )}
              </div>
            </div>
          </Section>

          {duplicate && mode === "add" && (
            <DuplicateCompare
              onClose={() => setDuplicate(false)}
              onQuantity={() => {
                setQuantity((value) => value + 1);
                onClose();
              }}
            />
          )}

          <Section title="基本資料">
            <Field
              label="收藏品名稱"
              defaultValue={item?.name ?? "草莓派對 拉拉熊"}
            />
            <div className="grid gap-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted">
                  主題・可複選
                </span>
                <button
                  type="button"
                  className="text-sm font-bold text-ink underline decoration-ink/30 underline-offset-4"
                >
                  ＋ 建立新主題
                </button>
              </div>
              <div className="flex flex-wrap gap-2 rounded-lg bg-element p-2">
                {["拉拉熊", "三麗鷗", "吉伊卡哇", "寶可夢"].map((theme) => (
                  <Chip
                    key={theme}
                    selected={selectedThemes.includes(theme)}
                    onClick={() => toggleTheme(theme)}
                  >
                    {theme}
                  </Chip>
                ))}
              </div>
              <p className="text-sm text-muted">
                AI 已透過別名「Rilakkuma」對應到拉拉熊
              </p>
            </div>
            <label className="grid gap-1">
              <span className="text-sm font-medium text-muted">
                系列・依主題顯示
              </span>
              <select
                defaultValue={item?.series ?? "草莓派對系列"}
                className="w-full appearance-none rounded-lg border border-transparent bg-element px-3 py-3 text-base font-medium text-ink outline-none focus:border-ink/20"
              >
                <option>草莓派對系列</option>
                <option>森林散步系列</option>
                <option>牛奶熊系列</option>
              </select>
            </label>
          </Section>

          <Section title="分類">
            <div className="grid gap-1">
              <span className="text-sm font-medium text-muted">類型・單選</span>
              <div className="flex flex-wrap gap-2">
                {typeOptions.map((type) => (
                  <Chip
                    key={type}
                    selected={selectedType === type}
                    onClick={() =>
                      setSelectedType(selectedType === type ? "" : type)
                    }
                  >
                    {type}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="尺寸"
                defaultValue={item?.size ?? "M・坐姿"}
                placeholder="例：M、坐姿"
              />
              <label className="grid gap-1">
                <span className="text-sm font-medium text-muted">數量</span>
                <span className="flex overflow-hidden rounded-lg bg-element">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((value) => Math.max(1, value - 1))
                    }
                    className="size-12 text-xl text-ink"
                  >
                    −
                  </button>
                  <input
                    value={quantity}
                    readOnly
                    className="min-w-0 flex-1 bg-transparent text-center font-bold text-ink outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => value + 1)}
                    className="size-12 text-xl text-ink"
                  >
                    ＋
                  </button>
                </span>
              </label>
            </div>
            <Field
              label="顏色"
              defaultValue={item?.color ?? "奶茶棕、草莓粉"}
            />
            <div className="grid gap-1">
              <span className="text-sm font-medium text-muted">標籤</span>
              <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-lg bg-element p-2">
                {(item?.tags ?? ["限定", "strawberry", "聯名"]).map((tag) => (
                  <Chip key={tag} selected removable>
                    {tag}
                  </Chip>
                ))}
                <input
                  placeholder="新增標籤…"
                  className="min-w-28 flex-1 bg-transparent px-1 py-1 text-sm text-ink outline-none placeholder:text-muted/60"
                />
              </div>
            </div>
          </Section>

          <Section title="購買資訊">
            <div className="grid gap-1">
              <span className="text-sm font-medium text-muted">狀態</span>
              <StatusToggle value={status} onChange={setStatus} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="購入日期" type="date" defaultValue="2025-02-16" />
              <Field label="購入價格" type="number" defaultValue="680" suffix="NT$" />
            </div>
            <Field label="購入通路" defaultValue="信義誠品快閃店" />
          </Section>

          <Section title="備註">
            <label className="grid gap-1">
              <span className="sr-only">備註</span>
              <textarea
                defaultValue={
                  mode === "detail" ? "和朋友一起逛快閃店時買的。" : ""
                }
                placeholder="購入故事、盒況或其他想記住的事…"
                className="min-h-28 resize-none rounded-lg bg-element px-3 py-3 text-base font-medium text-ink outline-none placeholder:text-muted/60 focus:bg-white"
              />
            </label>
          </Section>

          {mode === "detail" && (
            <div className="grid gap-3">
              {deleteConfirm ? (
                <InlineBanner
                  tone="danger"
                  title="確定要刪除這筆收藏嗎？"
                >
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setDeleteConfirm(false)}
                    >
                      取消
                    </Button>
                    <Button variant="danger" onClick={onClose}>
                      確定刪除
                    </Button>
                  </div>
                </InlineBanner>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-danger hover:bg-red-50"
                >
                  <Icon name="trash" className="size-4" />
                  刪除這筆收藏
                </button>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-20 flex gap-2 border-t border-selected bg-page/95 p-4 backdrop-blur sm:px-6">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button className="flex-1" onClick={onClose}>
            {mode === "add" ? "儲存收藏" : "儲存變更"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ThemeManager({ onClose }: { onClose: () => void }) {
  const themes = [
    { name: "拉拉熊", aliases: "Rilakkuma、リラックマ", count: 42, image: items[0].image },
    { name: "三麗鷗", aliases: "Sanrio、サンリオ", count: 36, image: items[2].image },
    { name: "吉伊卡哇", aliases: "Chiikawa、ちいかわ", count: 28, image: items[3].image },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="主題管理"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-page shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-selected bg-page/95 px-4 py-4 backdrop-blur sm:px-6">
          <div>
            <h2 className="text-xl font-semibold text-ink">主題與系列</h2>
            <p className="mt-1 text-sm text-muted">
              別名能幫助 AI 將不同語言對應到同一個主題
            </p>
          </div>
          <Button variant="ghost" className="!size-10 !p-0" onClick={onClose}>
            <Icon name="close" />
          </Button>
        </div>
        <div className="grid gap-4 p-4 sm:p-6">
          <Button className="justify-self-start">
            <Icon name="plus" />
            新增主題
          </Button>
          {themes.map((theme, index) => (
            <article key={theme.name} className="rounded-2xl bg-white p-4">
              <div className="flex gap-3">
                <img
                  src={theme.image}
                  alt=""
                  className="size-16 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-ink">{theme.name}</h3>
                      <p className="mt-0.5 text-sm text-muted">
                        {theme.count} 件收藏
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" className="!min-h-0 !px-2 !py-1">
                        重新命名
                      </Button>
                      <Button
                        variant="ghost"
                        className="!min-h-0 !px-2 !py-1 text-danger"
                      >
                        <Icon name="trash" className="size-4" />
                        <span className="sr-only">刪除主題</span>
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-element p-3">
                    <p className="text-sm font-bold text-ink">AI 辨識別名</p>
                    <p className="mt-1 text-sm text-muted">{theme.aliases}</p>
                    <button className="mt-2 text-sm font-bold text-ink underline decoration-ink/30 underline-offset-4">
                      編輯別名
                    </button>
                  </div>
                </div>
              </div>
              {index === 0 && (
                <div className="mt-4 border-t border-selected pt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-ink">系列</p>
                    <button className="text-sm font-bold text-ink">
                      ＋ 新增系列
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {["草莓派對系列・2024", "森林散步系列・2023", "牛奶熊系列"].map(
                      (series) => (
                        <div
                          key={series}
                          className="flex items-center gap-3 rounded-lg bg-element px-3 py-2 text-sm text-ink"
                        >
                          <span className="cursor-grab text-muted">⠿</span>
                          <span className="flex-1">{series}</span>
                          <button className="font-bold">編輯</button>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [loading, setLoading] = useState(false);
  const login = () => {
    setLoading(true);
    window.setTimeout(onLogin, 800);
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-page p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-accent text-ink">
          <Icon name="archive" className="size-8" />
        </div>
        <h1 className="mt-6 text-title tracking-tight text-ink">
          Snap Catalog
        </h1>
        <p className="mx-auto mt-4 max-w-xs text-base leading-6 text-muted">
          在結帳前，快速確認這件收藏你是不是已經有了。
        </p>
        <Button className="mt-8 w-full py-3" onClick={login} disabled={loading}>
          {loading ? (
            <span className="size-5 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
          ) : (
            <span className="text-lg font-bold">G</span>
          )}
          {loading ? "正在登入…" : "使用 Google 登入"}
        </Button>
        <p className="mt-4 text-sm leading-5 text-muted">
          登入後，你的收藏會安全地同步到所有裝置。
        </p>
      </div>
    </main>
  );
}

function App() {
  const [signedIn, setSignedIn] = useState(true);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selectedItem, setSelectedItem] = useState<Item | undefined>();
  const [status, setStatus] = useState<Status>("owned");
  const [theme, setTheme] = useState("全部");
  const [type, setType] = useState("全部");
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !search ||
        [
          item.name,
          ...item.themes,
          item.series,
          item.color,
          ...item.tags,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);
      return (
        item.status === status &&
        (theme === "全部" || item.themes.includes(theme)) &&
        (type === "全部" || item.type === type) &&
        matchesSearch
      );
    });
  }, [query, status, theme, type]);

  if (!signedIn) return <Login onLogin={() => setSignedIn(true)} />;

  const closeDialog = () => {
    setDialog(null);
    setSelectedItem(undefined);
  };

  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="border-b border-selected bg-page/95">
        <div className="mx-auto flex max-w-catalog items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-accent">
              <Icon name="archive" className="size-5" />
            </div>
            <span className="hidden font-bold sm:inline">Snap Catalog</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="hidden text-sm text-muted sm:inline">
              hello@snapcatalog.tw
            </span>
            <Button
              variant="ghost"
              className="!px-3"
              onClick={() => setDialog("themes")}
            >
              <Icon name="settings" className="size-4" />
              <span className="hidden sm:inline">主題管理</span>
            </Button>
            <Button
              variant="ghost"
              className="!px-3"
              onClick={() => setSignedIn(false)}
            >
              <Icon name="logout" className="size-4" />
              登出
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-catalog px-4 pb-28 pt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-medium text-muted">
              買之前，先查一下
            </p>
            <h1 className="text-subtitle tracking-tight text-ink">
              我的收藏
            </h1>
          </div>
          <span className="rounded-full bg-element px-3 py-1.5 text-sm font-bold text-muted">
            {results.length} 件
          </span>
        </div>

        <label className="relative mt-6 block">
          <Icon
            name="search"
            className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋名稱、主題、系列、顏色或標籤"
            className="w-full rounded-2xl border border-transparent bg-element py-3.5 pl-12 pr-4 text-base font-medium text-ink outline-none transition placeholder:text-muted focus:border-ink/20 focus:bg-white"
          />
        </label>

        <div className="mt-4">
          <StatusToggle value={status} onChange={setStatus} />
        </div>

        <div className="mt-5 grid gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-sm font-bold text-muted">
              主題
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["全部", "拉拉熊", "三麗鷗", "吉伊卡哇", "寶可夢"].map(
                (value) => (
                  <Chip
                    key={value}
                    selected={theme === value}
                    onClick={() => setTheme(value)}
                  >
                    {value}
                  </Chip>
                ),
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-sm font-bold text-muted">
              類型
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["全部", "娃娃", "公仔", "盲盒", "餐具"].map((value) => (
                <Chip
                  key={value}
                  selected={type === value}
                  onClick={() => setType(value)}
                >
                  {value}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {results.length ? (
          <div className="mt-6 grid grid-cols-2 gap-3 min-[600px]:grid-cols-3 min-[600px]:gap-4 min-[900px]:grid-cols-4">
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedItem(item);
                  setDialog("detail");
                }}
                className="group overflow-hidden rounded-2xl bg-white text-left shadow-[0_1px_0_rgb(46_42_36_/_0.08)] transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative aspect-square overflow-hidden bg-selected">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-page/90 px-2.5 py-1 text-sm font-bold text-ink backdrop-blur">
                    {item.type}
                  </span>
                  {item.quantity > 1 && (
                    <span className="absolute bottom-2 right-2 rounded-full bg-ink px-2.5 py-1 text-sm font-bold text-white">
                      × {item.quantity}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h2 className="line-clamp-2 text-sm font-bold text-ink">
                    {item.name}
                  </h2>
                  <p className="mt-1 line-clamp-1 text-sm text-muted">
                    {item.themes.join(" × ")} · {item.series}
                  </p>
                  <p className="mt-2 text-sm font-medium text-muted">
                    {item.size}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-element text-muted">
              <Icon name={query ? "search" : "archive"} className="size-7" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-ink">
              {query ? "找不到符合的收藏" : "這個清單還是空的"}
            </h2>
            <p className="mt-1 max-w-xs text-sm leading-5 text-muted">
              {query
                ? "換個關鍵字，或調整上方的主題與類型篩選。"
                : "按右下角的 ＋，拍下你的第一件收藏。"}
            </p>
            {query && (
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => {
                  setQuery("");
                  setTheme("全部");
                  setType("全部");
                }}
              >
                清除搜尋條件
              </Button>
            )}
          </div>
        )}
      </main>

      <button
        type="button"
        onClick={() => setDialog("add")}
        aria-label="新增收藏"
        className="fixed bottom-6 right-6 z-30 flex size-14 items-center justify-center rounded-full bg-accent text-4xl font-semibold leading-none text-ink shadow-xl transition hover:scale-105 active:scale-95"
      >
        ＋
      </button>

      {dialog === "add" && <ItemForm mode="add" onClose={closeDialog} />}
      {dialog === "detail" && selectedItem && (
        <ItemForm mode="detail" item={selectedItem} onClose={closeDialog} />
      )}
      {dialog === "themes" && <ThemeManager onClose={closeDialog} />}
    </div>
  );
}

export default App;
