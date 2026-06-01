import { DomainError } from "@/lib/errors/base";

export class ProcessTypeNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly errorCode = "PROCESS_TYPE_NOT_FOUND";
  readonly details: Record<string, unknown>;

  constructor(processTypeId: number) {
    super(`ProcessType not found: ${processTypeId}`);
    this.details = { processTypeId };
  }
}
