// The type and status are stored as English slugs rather than as their Chinese
// labels: the label is presentation and may get reworded, while the stored value is
// what the list screen's filters match on and what the AI is asked to return.

export const ITEM_TYPES = [
  { slug: 'plush', label: '娃娃' },
  { slug: 'figure', label: '公仔' },
  { slug: 'blind-box', label: '盲盒' },
  { slug: 'stationery', label: '文具' },
  { slug: 'keychain', label: '鑰匙圈' },
  { slug: 'bag', label: '包袋' },
  { slug: 'luggage', label: '行李箱' },
  { slug: 'apparel', label: '服飾' },
  { slug: 'tableware', label: '餐具' },
  { slug: 'accessory', label: '配件' },
  { slug: 'other', label: '其他' },
] as const;

export type ItemTypeSlug = (typeof ITEM_TYPES)[number]['slug'];

export const ITEM_TYPE_SLUGS = ITEM_TYPES.map((t) => t.slug);

// Hand-edited items can hold anything at all, so fall back to showing the raw
// value rather than dropping it.
export function typeLabel(slug: string | null): string | null {
  if (!slug) return null;
  return ITEM_TYPES.find((t) => t.slug === slug)?.label ?? slug;
}

// Only owned/wished get their own tab — the other two are outcomes you record once
// and rarely browse by, so they live in the item's own status field.
export const STATUSES = [
  { slug: 'owned', label: '已擁有' },
  { slug: 'wished', label: '想要' },
  { slug: 'gifted', label: '已送出' },
  { slug: 'sold', label: '已售出' },
] as const;

export type StatusSlug = (typeof STATUSES)[number]['slug'];

/** The two the list screen switches between. */
export const BROWSABLE_STATUSES = ['owned', 'wished'] as const satisfies readonly StatusSlug[];

export function statusLabel(slug: string | null): string | null {
  if (!slug) return null;
  return STATUSES.find((s) => s.slug === slug)?.label ?? slug;
}
