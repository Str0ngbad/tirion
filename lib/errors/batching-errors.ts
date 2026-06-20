import { DomainError } from "@/lib/errors/base";

export class BatchNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly errorCode = "BATCH_NOT_FOUND";
  readonly details: Record<string, unknown>;

  constructor(batchId: number) {
    super(`Production batch not found: ${batchId}`);
    this.details = { batchId };
  }
}

export class BatchWOPartMismatchError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "BATCH_WO_PART_MISMATCH";
  readonly details: Record<string, unknown>;

  constructor(workOrderId: number, woPart: number, batchPart: number) {
    super(
      `Work order ${workOrderId} part ${woPart} does not match batch part ${batchPart}`
    );
    this.details = { workOrderId, woPart, batchPart };
  }
}

export class BatchConfirmEmptyError extends DomainError {
  readonly statusCode = 400;
  readonly errorCode = "BATCH_CONFIRM_EMPTY";
  readonly details = undefined;

  constructor() {
    super("Confirm Draft called with no assignments");
  }
}

export class WONotBatchCandidateError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "WO_NOT_BATCH_CANDIDATE";
  readonly details: Record<string, unknown>;

  constructor(workOrderId: number, reason: string) {
    super(
      `Work order ${workOrderId} is not a valid batching candidate: ${reason}`
    );
    this.details = { workOrderId, reason };
  }
}

export class BatchEligibilityError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "BATCH_ELIGIBILITY_ERROR";
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown>) {
    super(message);
    this.details = details;
  }
}

export class OpenRowHeadroomError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "OPEN_ROW_HEADROOM_EXCEEDED";
  readonly details: Record<string, unknown>;

  constructor(targetId: number, available: string, demanded: string) {
    super(
      `Insufficient headroom on target ${targetId}: available ${available} < demanded ${demanded}`
    );
    this.details = { targetId, available, demanded };
  }
}
