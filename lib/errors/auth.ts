import { DomainError } from "@/lib/errors/base";

export class UserRequiredError extends DomainError {
  readonly statusCode = 401;
  readonly errorCode = "USER_REQUIRED";
  readonly details = undefined;

  constructor() {
    super("X-User-Id header is required for this operation");
  }
}

export class UserNotFoundError extends DomainError {
  readonly statusCode = 401;
  readonly errorCode = "USER_NOT_FOUND";
  readonly details: Record<string, unknown>;

  constructor(userId: number) {
    super(`User not found or inactive: ${userId}`);
    this.details = { userId };
  }
}
