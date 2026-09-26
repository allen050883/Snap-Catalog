import type { ItemInput } from '@/lib/db';

// Sample catalog for filling the layout without spending AI quota. The photos are
// remote URLs rather than the base64 a real capture produces — `photoUri` is handed
// straight to <Image source={{ uri }}>, which takes either, and it keeps this file
// from being megabytes of encoded JPEG.
//
// They have no photo document either: `hasPhoto` stays false, so the detail screen
// shows the same remote image rather than looking for one that was never written.
//
// Deliberately spread across themes, types and both statuses so the filter rows and
// the owned/wished switch actually have something to do. The last entry is a
// collaboration, which is the case the multi-valued `themes` field exists for.
const PHOTO = {
  bear: 'https://images.unsplash.com/photo-1718804715033-8e045415f6f3?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=720&h=720',
  forest: 'https://images.unsplash.com/photo-1769778674802-28bfd3d4b391?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=720&h=720',
  cat: 'https://images.unsplash.com/photo-1772121034472-de4d2977bdbb?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=720&h=720',
  bell: 'https://images.unsplash.com/photo-1763120432102-9a627393d407?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=720&h=720',
  ceramic: 'https://images.unsplash.com/photo-1617341173592-1ba5fbaf3c92?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=720&h=720',
  retro: 'https://images.unsplash.com/photo-1566577134770-3d85bb3a9cc4?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=720&h=720',
} as const;

/** Themes the sample rows refer to, with the aliases the AI is likely to answer with. */
export const MOCK_THEMES: { name: string; aliases: string[] }[] = [
  { name: '拉拉熊', aliases: ['Rilakkuma', 'リラックマ'] },
  { name: '三麗鷗', aliases: ['Sanrio', 'サンリオ'] },
  { name: '吉伊卡哇', aliases: ['Chiikawa', 'ちいかわ'] },
  { name: '寶可夢', aliases: ['Pokemon', 'Pokémon', 'ポケモン'] },
];

/** `themeNames` are resolved to ids by the seeder — see seedMockItems in lib/db.ts. */
export type MockItem = {
  item: Omit<ItemInput, 'themeIds'>;
  themeNames: string[];
  tags: string[];
};

export const MOCK_ITEMS: MockItem[] = [
  {
    item: {
      name: '草莓蛋糕拉拉熊',
      series: '草莓派對系列',
      type: 'plush',
      status: 'owned',
      size: 'M・坐姿',
      quantity: 1,
      color: '奶茶棕',
      notes: null,
      thumbnail: PHOTO.bear,
    },
    themeNames: ['拉拉熊'],
    tags: ['拉拉熊', 'rilakkuma', '限定', '草莓', 'strawberry', '絨毛', 'plush'],
  },
  {
    item: {
      name: '森林動物小隊',
      series: '森林散步系列',
      type: 'blind-box',
      status: 'owned',
      size: '盒玩',
      quantity: 1,
      color: '米白色',
      notes: '整盒收的，沒有重複',
      thumbnail: PHOTO.forest,
    },
    themeNames: ['拉拉熊'],
    tags: ['拉拉熊', 'rilakkuma', '盲盒', 'blind box', '完整盒況', '森林'],
  },
  {
    item: {
      name: '午夜黑貓公仔',
      series: '夜色收藏系列',
      type: 'figure',
      status: 'owned',
      size: '12 公分',
      quantity: 1,
      color: '黑色',
      notes: null,
      thumbnail: PHOTO.cat,
    },
    themeNames: ['三麗鷗'],
    tags: ['三麗鷗', 'sanrio', '黑貓', 'black cat', '限定', '公仔', 'figure'],
  },
  {
    item: {
      name: '森林鈴鐺精靈',
      series: '森林探險系列',
      type: 'keychain',
      status: 'wished',
      size: 'S・吊飾',
      quantity: 1,
      color: '象牙白',
      notes: '聖誕節檔期想入手',
      thumbnail: PHOTO.bell,
    },
    themeNames: ['吉伊卡哇'],
    tags: ['吉伊卡哇', 'chiikawa', '聖誕節', 'christmas', '吊飾', 'keychain'],
  },
  {
    item: {
      name: '復古陶瓷小狗組',
      series: '復古生活系列',
      type: 'tableware',
      status: 'owned',
      size: '一組兩入',
      quantity: 2,
      color: '棕色',
      notes: '二手market收的',
      thumbnail: PHOTO.ceramic,
    },
    themeNames: ['寶可夢'],
    tags: ['寶可夢', 'pokemon', '二手', 'secondhand', '復古', 'retro', '餐具'],
  },
  {
    item: {
      name: '格鬥經典角色公仔',
      series: '經典遊戲系列',
      type: 'figure',
      status: 'wished',
      size: '15 公分',
      quantity: 1,
      color: '紅色',
      notes: null,
      thumbnail: PHOTO.retro,
    },
    themeNames: ['寶可夢'],
    tags: ['寶可夢', 'pokemon', '公仔', 'figure', '經典', 'classic'],
  },
  {
    item: {
      name: '拉拉熊 × 三麗鷗 聯名馬克杯',
      series: '週年聯名系列',
      type: 'tableware',
      status: 'owned',
      size: '350ml',
      quantity: 1,
      color: '粉紅色、奶油白',
      notes: '兩個主題都找得到這一筆',
      thumbnail: PHOTO.ceramic,
    },
    themeNames: ['拉拉熊', '三麗鷗'],
    tags: ['拉拉熊', 'rilakkuma', '三麗鷗', 'sanrio', '聯名', 'collab', '馬克杯', 'mug'],
  },
];
