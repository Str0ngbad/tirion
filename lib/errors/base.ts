export abstract class DomainError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;
  abstract readonly details: Record<string, unknown> | undefined;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Restore prototype chain — required when extending built-in classes targeting ES2017.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
