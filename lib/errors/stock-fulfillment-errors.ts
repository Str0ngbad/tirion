import { DomainError } from "@/lib/errors/base";

export class WONotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly errorCode = "WO_NOT_FOUND";
  readonly details: Record<string, unknown>;

  constructor(workOrderId: number) {
    super(`Work order not found: ${workOrderId}`);
    this.details = { workOrderId };
  }
}

export class WONotUnreleasedError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "WO_NOT_UNRELEASED";
  readonly details: Record<string, unknown>;

  constructor(workOrderId: number, status: string) {
    super(`Work order ${workOrderId} is not in Unreleased state (current: ${status})`);
    this.details = { workOrderId, status };
  }
}

export class WONotCandidateError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "WO_NOT_CANDIDATE";
  readonly details: Record<string, unknown>;

  constructor(workOrderId: number, reason: string) {
    super(`Work order ${workOrderId} does not meet candidacy criteria: ${reason}`);
    this.details = { workOrderId, reason };
  }
}

export class InsufficientStockError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "INSUFFICIENT_STOCK";
  readonly details: Record<string, unknown>;

  constructor(partId: number, stockCount: string, demand: string) {
    super(`Insufficient stock for part ${partId}: stock ${stockCount} < demand ${demand}`);
    this.details = { partId, stockCount, demand };
  }
}

export class WOAlreadyReviewedError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "WO_ALREADY_REVIEWED";
  readonly details: Record<string, unknown>;

  constructor(workOrderId: number) {
    super(`Work order ${workOrderId} has already been reviewed in Stock Fulfillment`);
    this.details = { workOrderId };
  }
}

export class DescendantCompleteError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "DESCENDANT_COMPLETE";
  readonly details: Record<string, unknown>;

  constructor(workOrderId: number, descendantWoId: number) {
    super(
      `Cannot fulfill work order ${workOrderId} — descendant work order ${descendantWoId} is already Complete. Sub-components must be fulfilled before the parent assembly.`
    );
    this.details = { workOrderId, descendantWoId };
  }
}

export class ReconcileStockError extends DomainError {
  readonly statusCode = 400;
  readonly errorCode = "RECONCILE_STOCK_INVALID";
  readonly details: Record<string, unknown>;

  constructor(partId: number, newStockCount: number) {
    super(`Invalid new stock count ${newStockCount} for part ${partId}: must be >= 0`);
    this.details = { partId, newStockCount };
  }
}
