import { DomainError } from "@/lib/errors/base";

export class ProcurementCategoryNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly errorCode = "PROCUREMENT_CATEGORY_NOT_FOUND";
  readonly details: Record<string, unknown>;

  constructor(procurementCategoryId: number) {
    super(`ProcurementCategory not found: ${procurementCategoryId}`);
    this.details = { procurementCategoryId };
  }
}

export class ProcurementCategoryAlreadyActiveError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PROCUREMENT_CATEGORY_ALREADY_ACTIVE";
  readonly details: Record<string, unknown>;

  constructor(procurementCategoryId: number) {
    super(`ProcurementCategory ${procurementCategoryId} is already active`);
    this.details = { procurementCategoryId };
  }
}

export class ProcurementCategoryAlreadyInactiveError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PROCUREMENT_CATEGORY_ALREADY_INACTIVE";
  readonly details: Record<string, unknown>;

  constructor(procurementCategoryId: number) {
    super(`ProcurementCategory ${procurementCategoryId} is already inactive`);
    this.details = { procurementCategoryId };
  }
}

export class ProcurementCategoryCodeCollisionError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PROCUREMENT_CATEGORY_CODE_COLLISION";
  readonly details: Record<string, unknown>;

  constructor(categoryCode: string) {
    super(`A ProcurementCategory with code '${categoryCode}' already exists`);
    this.details = { categoryCode };
  }
}

export class ProcurementCategoryNameCollisionError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PROCUREMENT_CATEGORY_NAME_COLLISION";
  readonly details: Record<string, unknown>;

  constructor(categoryName: string) {
    super(`A ProcurementCategory with name '${categoryName}' already exists`);
    this.details = { categoryName };
  }
}
