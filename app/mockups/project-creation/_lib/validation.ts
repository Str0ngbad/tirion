// Validation logic for the Project Creation mockup.
// Pure functions — no component imports.

import { MOCK_PARTS } from "@/app/mockups/parts/_data";
import { resolvePartTemplate, ValidationFailureReason } from "../_data";

export type ValidationResultPass = { status: "pass" };
export type ValidationResultFail = { status: "fail"; reason: ValidationFailureReason; templateName?: string };
export type ValidationResult = ValidationResultPass | ValidationResultFail;

export type NodeValidation = {
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
  effectiveQty: number;
  result: ValidationResult;
  path: string[]; // breadcrumb — e.g. ["10236.01", "22-06-1-00", "22-06-1-13"]
  depth: number;
};

// Validate a single part node.
export function validatePart(partId: number): ValidationResult {
  const part = MOCK_PARTS.find((p) => p.partId === partId);
  if (!part) return { status: "fail", reason: "no-template" };

  if (!part.isActive) return { status: "fail", reason: "part-inactive" };

  const tpl = resolvePartTemplate(partId);
  if (!tpl) return { status: "fail", reason: "no-template" };
  if (!tpl.isActive) return { status: "fail", reason: "template-inactive", templateName: tpl.templateName };

  return { status: "pass" };
}

// Walk BOM tree and collect NodeValidation for every node.
export function validateTree(
  partId: number,
  effectiveQty: number,
  path: string[],
  depth: number,
  visited: Set<number>
): NodeValidation[] {
  if (visited.has(partId)) {
    // Circular reference detected
    const part = MOCK_PARTS.find((p) => p.partId === partId);
    return [
      {
        partId,
        partNumber: part?.partNumber ?? String(partId),
        partName: part?.partName ?? "Unknown",
        partType: (part?.partType ?? "Part") as "Part" | "Assembly",
        effectiveQty,
        result: { status: "fail", reason: "circular" },
        path,
        depth,
      },
    ];
  }

  const part = MOCK_PARTS.find((p) => p.partId === partId);
  if (!part) return [];

  const visited2 = new Set(visited);
  visited2.add(partId);

  const result = validatePart(partId);
  const thisPath = [...path, part.partNumber];

  const node: NodeValidation = {
    partId,
    partNumber: part.partNumber,
    partName: part.partName,
    partType: part.partType as "Part" | "Assembly",
    effectiveQty,
    result,
    path: thisPath,
    depth,
  };

  const children: NodeValidation[] = [];
  if (part.childParts) {
    for (const child of part.childParts) {
      children.push(
        ...validateTree(
          child.childPartId,
          effectiveQty * child.quantity,
          thisPath,
          depth + 1,
          visited2
        )
      );
    }
  }

  return [node, ...children];
}

// Validate all top-level items for a project and return flattened results.
export function validateProject(
  topLevelItems: { partId: number; quantity: number; topLevelIndex: number; partNumber: string }[]
): NodeValidation[] {
  const all: NodeValidation[] = [];
  for (const tl of topLevelItems) {
    const pathPrefix = `.${String(tl.topLevelIndex).padStart(2, "0")}`;
    all.push(...validateTree(tl.partId, tl.quantity, [pathPrefix], 0, new Set()));
  }
  return all;
}

export function failCount(nodes: NodeValidation[]): number {
  return nodes.filter((n) => n.result.status === "fail").length;
}

export function allPass(nodes: NodeValidation[]): boolean {
  return nodes.length > 0 && nodes.every((n) => n.result.status === "pass");
}
