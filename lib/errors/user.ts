import { DomainError } from "@/lib/errors/base";

export class UserNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly errorCode = "USER_NOT_FOUND";
  readonly details: Record<string, unknown>;

  constructor(userId: number) {
    super(`User not found: ${userId}`);
    this.details = { userId };
  }
}

export class UserAlreadyActiveError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "USER_ALREADY_ACTIVE";
  readonly details: Record<string, unknown>;

  constructor(userId: number) {
    super(`User ${userId} is already active`);
    this.details = { userId };
  }
}

export class UserAlreadyInactiveError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "USER_ALREADY_INACTIVE";
  readonly details: Record<string, unknown>;

  constructor(userId: number) {
    super(`User ${userId} is already inactive`);
    this.details = { userId };
  }
}

export class UserNameCollisionError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "USER_NAME_COLLISION";
  readonly details: Record<string, unknown>;

  constructor(userName: string) {
    super(`A User with userName '${userName}' already exists`);
    this.details = { userName };
  }
}

export class UserLockoutError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "USER_LOCKOUT";
  readonly details: Record<string, unknown>;

  constructor(userId: number, attemptedAction: "deactivate" | "roleChange") {
    const message =
      attemptedAction === "deactivate"
        ? "Cannot deactivate the only active Admin"
        : "Cannot change role of the only active Admin away from Admin";
    super(message);
    this.details = { userId, attemptedAction };
  }
}
