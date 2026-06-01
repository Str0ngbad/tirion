import { DomainError } from "@/lib/errors/base";

export class ProcessTypeSubStatusNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly errorCode = "PROCESS_TYPE_SUB_STATUS_NOT_FOUND";
  readonly details: Record<string, unknown>;

  constructor(processTypeSubStatusId: number) {
    super(`ProcessTypeSubStatus not found: ${processTypeSubStatusId}`);
    this.details = { processTypeSubStatusId };
  }
}

export class ProcessTypeSubStatusAlreadyActiveError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PROCESS_TYPE_SUB_STATUS_ALREADY_ACTIVE";
  readonly details: Record<string, unknown>;

  constructor(processTypeSubStatusId: number) {
    super(`ProcessTypeSubStatus ${processTypeSubStatusId} is already active`);
    this.details = { processTypeSubStatusId };
  }
}

export class ProcessTypeSubStatusAlreadyInactiveError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PROCESS_TYPE_SUB_STATUS_ALREADY_INACTIVE";
  readonly details: Record<string, unknown>;

  constructor(processTypeSubStatusId: number) {
    super(`ProcessTypeSubStatus ${processTypeSubStatusId} is already inactive`);
    this.details = { processTypeSubStatusId };
  }
}

export class ProcessTypeSubStatusCollisionError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PROCESS_TYPE_SUB_STATUS_COLLISION";
  readonly details: Record<string, unknown>;

  constructor(processTypeId: number, subStatusName: string) {
    super(
      `A sub-status with name '${subStatusName}' already exists for ProcessType ${processTypeId}`
    );
    this.details = { processTypeId, subStatusName };
  }
}
