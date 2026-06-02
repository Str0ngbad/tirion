import { BomNode } from "./bom-utils";

// Sort an Assembly's children: Parts first (alpha by partNumber), then Assemblies (alpha by partNumber).
// Applied at render time; source data order is not mutated.
export function sortBomChildren(nodes: BomNode[]): BomNode[] {
  const parts = nodes
    .filter((n) => n.part.partType !== "Assembly")
    .sort((a, b) => a.part.partNumber.localeCompare(b.part.partNumber));
  const assemblies = nodes
    .filter((n) => n.part.partType === "Assembly")
    .sort((a, b) => a.part.partNumber.localeCompare(b.part.partNumber));
  return [...parts, ...assemblies];
}
