/**
 * How alike two names are, from 0 (nothing in common) to 1 (identical).
 *
 * Dice coefficient over character bigrams. Word-boundary approaches are useless
 * here: Chinese names have no spaces, so "拉拉熊繪畫系列行李箱" would be a single
 * token. Sliding pairs of characters catches the shared runs — 拉拉/拉熊/行李/李箱 —
 * regardless of what sits between them, and works the same on the romanized halves.
 */
export function nameSimilarity(a: string, b: string): number {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  // Nothing to slide over in a single character, so only exact equality counts.
  if (left.length < 2 || right.length < 2) return 0;

  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);

  // Counted rather than set-intersected so a repeated pair doesn't score twice.
  const remaining = new Map(rightGrams);
  let shared = 0;
  for (const [gram, count] of leftGrams) {
    const available = remaining.get(gram) ?? 0;
    if (available > 0) {
      shared += Math.min(count, available);
      remaining.set(gram, available - Math.min(count, available));
    }
  }

  const total = size(leftGrams) + size(rightGrams);
  return (2 * shared) / total;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

function bigrams(value: string): Map<string, number> {
  const grams = new Map<string, number>();
  for (let i = 0; i < value.length - 1; i += 1) {
    const gram = value.slice(i, i + 2);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
}

function size(grams: Map<string, number>): number {
  let total = 0;
  for (const count of grams.values()) total += count;
  return total;
}
