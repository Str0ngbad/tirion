import { DomainError } from "@/lib/errors/base";

export class PartNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly errorCode = "PART_NOT_FOUND";
  readonly details: Record<string, unknown>;

  constructor(partId: number) {
    super(`Part not found: ${partId}`);
    this.details = { partId };
  }
}

export class PartNumberCollisionError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PART_NUMBER_COLLISION";
  readonly details: Record<string, unknown>;

  constructor(partNumber: string) {
    super(`A Part with partNumber '${partNumber}' already exists`);
    this.details = { partNumber };
  }
}

// Retained for future warning-on-collision response work (TESTS_BACKLOG.md).
// The throw path in service.ts is unreachable since the @unique constraint was removed.
export class PartInventoryLocationCollisionError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PART_INVENTORY_LOCATION_COLLISION";
  readonly details: Record<string, unknown>;

  constructor(inventoryLocation: string) {
    super(`A Part with inventoryLocation '${inventoryLocation}' already exists`);
    this.details = { inventoryLocation };
  }
}

export class PartAlreadyActiveError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PART_ALREADY_ACTIVE";
  readonly details: Record<string, unknown>;

  constructor(partId: number) {
    super(`Part ${partId} is already active`);
    this.details = { partId };
  }
}

export class PartAlreadyInactiveError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PART_ALREADY_INACTIVE";
  readonly details: Record<string, unknown>;

  constructor(partId: number) {
    super(`Part ${partId} is already inactive`);
    this.details = { partId };
  }
}

export class PartVendorInvalidError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PART_VENDOR_INVALID";
  readonly details: Record<string, unknown>;

  constructor(defaultVendorId: number) {
    super(`Vendor ${defaultVendorId} does not exist or is inactive`);
    this.details = { defaultVendorId };
  }
}

export class PartMaterialSpecInvalidError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PART_MATERIAL_SPEC_INVALID";
  readonly details: Record<string, unknown>;

  constructor(materialSpecId: number) {
    super(`MaterialSpec ${materialSpecId} does not exist or is inactive`);
    this.details = { materialSpecId };
  }
}

export class PartProcurementCategoryInvalidError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PART_PROCUREMENT_CATEGORY_INVALID";
  readonly details: Record<string, unknown>;

  constructor(procurementCategoryId: number) {
    super(`ProcurementCategory ${procurementCategoryId} does not exist or is inactive`);
    this.details = { procurementCategoryId };
  }
}

export class PartRoutingTemplateInvalidError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PART_ROUTING_TEMPLATE_INVALID";
  readonly details: Record<string, unknown>;

  constructor(routingTemplateDefinitionId: number) {
    super(`RoutingTemplateDefinition ${routingTemplateDefinitionId} does not exist or is inactive`);
    this.details = { routingTemplateDefinitionId };
  }
}
