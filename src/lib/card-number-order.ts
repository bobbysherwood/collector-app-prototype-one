export function compareCardNumbers(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function sortByCardNumber<T extends { cardNumber: string; player?: string }>(
  items: T[]
): T[] {
  return [...items].sort((left, right) => {
    const byNumber = compareCardNumbers(left.cardNumber, right.cardNumber);
    if (byNumber !== 0) return byNumber;
    return (left.player ?? "").localeCompare(right.player ?? "", undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}
