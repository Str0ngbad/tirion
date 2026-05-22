import { DomainError } from "@/lib/errors/base";

export class VendorNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly errorCode = "VENDOR_NOT_FOUND";
  readonly details: Record<string, unknown>;

  constructor(vendorId: number) {
    super(`Vendor not found: ${vendorId}`);
    this.details = { vendorId };
  }
}

export class VendorAlreadyActiveError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "VENDOR_ALREADY_ACTIVE";
  readonly details: Record<string, unknown>;

  constructor(vendorId: number) {
    super(`Vendor ${vendorId} is already active`);
    this.details = { vendorId };
  }
}

export class VendorAlreadyInactiveError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "VENDOR_ALREADY_INACTIVE";
  readonly details: Record<string, unknown>;

  constructor(vendorId: number) {
    super(`Vendor ${vendorId} is already inactive`);
    this.details = { vendorId };
  }
}

export class VendorNameCollisionError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "VENDOR_NAME_COLLISION";
  readonly details: Record<string, unknown>;

  constructor(vendorName: string) {
    super(`A vendor with name '${vendorName}' already exists`);
    this.details = { vendorName };
  }
}

export class VendorDeactivationBlockedError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "VENDOR_DEACTIVATION_BLOCKED";
  readonly details: Record<string, unknown>;

  constructor(blockingParts: Array<{ partId: number; partNumber: string }>) {
    super("Cannot deactivate vendor with active Part references");
    this.details = { blockingParts };
  }
}
