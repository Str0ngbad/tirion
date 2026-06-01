import { DomainError } from "@/lib/errors/base";

export class MaterialSpecNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly errorCode = "MATERIAL_SPEC_NOT_FOUND";
  readonly details: Record<string, unknown>;

  constructor(materialSpecId: number) {
    super(`MaterialSpec not found: ${materialSpecId}`);
    this.details = { materialSpecId };
  }
}

export class MaterialSpecAlreadyActiveError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "MATERIAL_SPEC_ALREADY_ACTIVE";
  readonly details: Record<string, unknown>;

  constructor(materialSpecId: number) {
    super(`MaterialSpec ${materialSpecId} is already active`);
    this.details = { materialSpecId };
  }
}

export class MaterialSpecAlreadyInactiveError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "MATERIAL_SPEC_ALREADY_INACTIVE";
  readonly details: Record<string, unknown>;

  constructor(materialSpecId: number) {
    super(`MaterialSpec ${materialSpecId} is already inactive`);
    this.details = { materialSpecId };
  }
}

export class MaterialSpecCollisionError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "MATERIAL_SPEC_COLLISION";
  readonly details: Record<string, unknown>;

  constructor(materialName: string, form: string) {
    super(
      `A MaterialSpec with materialName '${materialName}' and form '${form}' already exists`
    );
    this.details = { materialName, form };
  }
}
