import { DomainError } from "@/lib/errors/base";

export class ViewNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly errorCode = "VIEW_NOT_FOUND";
  readonly details: Record<string, unknown>;

  constructor(viewId: number) {
    super(`View not found: ${viewId}`);
    this.details = { viewId };
  }
}

export class ViewNameCollisionError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "VIEW_NAME_COLLISION";
  readonly details: Record<string, unknown>;

  constructor(name: string) {
    super(`A view with name '${name}' already exists`);
    this.details = { name };
  }
}

export class ViewLockedError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "VIEW_LOCKED";
  readonly details: Record<string, unknown>;

  constructor(viewId: number, operation: string) {
    super(`View ${viewId} is locked and cannot be ${operation}`);
    this.details = { viewId, operation };
  }
}

export class ViewMasterImmutableError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "VIEW_MASTER_IMMUTABLE";
  readonly details: Record<string, unknown>;

  constructor(field: string) {
    super(`The Master View cannot be modified (field: ${field})`);
    this.details = { field };
  }
}
