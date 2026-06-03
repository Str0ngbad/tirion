import { DomainError } from "@/lib/errors/base";

export class BomEdgeNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly errorCode = "BOM_EDGE_NOT_FOUND";
  readonly details: Record<string, unknown>;

  constructor(bomId: number) {
    super(`BOM edge not found: ${bomId}`);
    this.details = { bomId };
  }
}

export class BomParentInvalidError extends DomainError {
  readonly statusCode = 422;
  readonly errorCode = "BOM_PARENT_INVALID";
  readonly details: Record<string, unknown>;

  constructor(
    parentPartId: number,
    reason: "part_not_found" | "part_inactive" | "parent_not_assembly"
  ) {
    super(`Invalid BOM parent ${parentPartId}: ${reason}`);
    this.details = { parentPartId, reason };
  }
}

export class BomChildInvalidError extends DomainError {
  readonly statusCode = 422;
  readonly errorCode = "BOM_CHILD_INVALID";
  readonly details: Record<string, unknown>;

  constructor(
    childPartId: number,
    reason: "part_not_found" | "part_inactive"
  ) {
    super(`Invalid BOM child ${childPartId}: ${reason}`);
    this.details = { childPartId, reason };
  }
}

export class BomSelfReferenceError extends DomainError {
  readonly statusCode = 422;
  readonly errorCode = "BOM_SELF_REFERENCE";
  readonly details: Record<string, unknown>;

  constructor(partId: number) {
    super(`A part cannot reference itself in a BOM edge: ${partId}`);
    this.details = { partId };
  }
}

export class BomDuplicateChildError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "BOM_DUPLICATE_CHILD";
  readonly details: Record<string, unknown>;

  constructor(parentPartId: number, childPartId: number) {
    super(
      `BOM edge already exists: parent ${parentPartId} → child ${childPartId}`
    );
    this.details = { parentPartId, childPartId };
  }
}

export class BomCycleError extends DomainError {
  readonly statusCode = 422;
  readonly errorCode = "BOM_CYCLE";
  readonly details: Record<string, unknown>;

  constructor(
    parentPartId: number,
    childPartId: number,
    cycleChain: number[]
  ) {
    super(
      `Adding edge ${parentPartId} → ${childPartId} would create a cycle`
    );
    this.details = { parentPartId, childPartId, cycleChain };
  }
}

export class BomDepthExceededError extends DomainError {
  readonly statusCode = 422;
  readonly errorCode = "BOM_DEPTH_EXCEEDED";
  readonly details: Record<string, unknown>;

  constructor(
    computedDepth: number,
    hardLimit: number,
    parentPartId: number,
    childPartId: number
  ) {
    super(
      `Adding edge ${parentPartId} → ${childPartId} would produce depth ${computedDepth}, exceeding the hard limit of ${hardLimit}`
    );
    this.details = { computedDepth, hardLimit, parentPartId, childPartId };
  }
}

export class BomBulkDeleteInvalidError extends DomainError {
  readonly statusCode = 422;
  readonly errorCode = "BOM_BULK_DELETE_INVALID";
  readonly details: Record<string, unknown>;

  constructor(opts: {
    missingEdgeIds?: number[];
    edgeIdsFromDifferentParents?: number[];
  }) {
    const parts: string[] = [];
    if (opts.missingEdgeIds?.length)
      parts.push(`missing edge IDs: [${opts.missingEdgeIds.join(", ")}]`);
    if (opts.edgeIdsFromDifferentParents?.length)
      parts.push(
        `edges from different parents: [${opts.edgeIdsFromDifferentParents.join(", ")}]`
      );
    super(`Bulk delete validation failed: ${parts.join("; ")}`);
    this.details = {
      missingEdgeIds: opts.missingEdgeIds ?? [],
      edgeIdsFromDifferentParents: opts.edgeIdsFromDifferentParents ?? [],
    };
  }
}
