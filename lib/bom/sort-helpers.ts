import type { BomNode } from "./types";

export function sortBomChildren(children: BomNode[]): BomNode[] {
  return [...children].sort((a, b) => {
    if (a.partType !== b.partType) {
      return a.partType === "Part" ? -1 : 1;
    }
    return a.partNumber.localeCompare(b.partNumber);
  });
}
