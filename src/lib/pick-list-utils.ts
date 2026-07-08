import type { PickListOption } from "@/types/pick-list";

function compareGradeLabels(a: string, b: string): number {
  const aNum = Number(a);
  const bNum = Number(b);
  const aIsNum = !Number.isNaN(aNum);
  const bIsNum = !Number.isNaN(bNum);

  if (aIsNum && bIsNum) {
    return aNum - bNum;
  }
  if (aIsNum && !bIsNum) return -1;
  if (!aIsNum && bIsNum) return 1;
  return a.localeCompare(b);
}

export function sortPickListLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => a.localeCompare(b));
}

export function sortGradeLabels(labels: string[]): string[] {
  return [...labels].sort(compareGradeLabels);
}

export function sortPickListOptions(options: PickListOption[]): PickListOption[] {
  return [...options].sort((a, b) => a.label.localeCompare(b.label));
}

export function sortGradePickListOptions(
  options: PickListOption[]
): PickListOption[] {
  return [...options].sort((a, b) => compareGradeLabels(a.label, b.label));
}

export function mergePickListOption(
  activeOptions: string[],
  currentValue?: string | null
): string[] {
  const trimmed = currentValue?.trim();
  if (!trimmed || activeOptions.includes(trimmed)) {
    return sortPickListLabels(activeOptions);
  }
  return sortPickListLabels([trimmed, ...activeOptions]);
}

export function mergeGradeOption(
  activeOptions: string[],
  currentValue?: string | null
): string[] {
  const trimmed = currentValue?.trim();
  if (!trimmed || activeOptions.includes(trimmed)) {
    return sortGradeLabels(activeOptions);
  }
  return sortGradeLabels([trimmed, ...activeOptions]);
}
