import { DomainError } from "@/lib/errors/base";

export type ValidationFailure = {
  partId: number;
  partNumber: string;
  partName: string;
  bomPath: string[]; // first element: Top-Level Reference (e.g. '20137.01'); rest: partNumbers down to failing node
  failureType: "no-template" | "template-inactive" | "part-inactive";
  templateId?: number;
  templateName?: string;
};

export class ProjectNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly errorCode = "PROJECT_NOT_FOUND";
  readonly details: Record<string, unknown>;

  constructor(projectId: number) {
    super(`Project not found: ${projectId}`);
    this.details = { projectId };
  }
}

export class ProjectNumberConflictError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PROJECT_NUMBER_CONFLICT";
  readonly details: Record<string, unknown>;

  constructor(projectNumber: string) {
    super(`A project with number '${projectNumber}' already exists`);
    this.details = { projectNumber };
  }
}

export class ProjectNotDraftError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "PROJECT_NOT_DRAFT";
  readonly details: Record<string, unknown>;

  constructor(projectId: number, status: string) {
    super(`Project ${projectId} is not in Draft status (current: ${status})`);
    this.details = { projectId, status };
  }
}

export class TopLevelItemNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly errorCode = "TOP_LEVEL_ITEM_NOT_FOUND";
  readonly details: Record<string, unknown>;

  constructor(topLevelItemId: number) {
    super(`Top-level item not found: ${topLevelItemId}`);
    this.details = { topLevelItemId };
  }
}

export class TopLevelItemPartInactiveError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "TOP_LEVEL_ITEM_PART_INACTIVE";
  readonly details: Record<string, unknown>;

  constructor(partId: number, partNumber: string) {
    super(`Part ${partNumber} is inactive and cannot be added as a top-level item`);
    this.details = { partId, partNumber };
  }
}

export class ProjectCompilationError extends DomainError {
  readonly statusCode = 422;
  readonly errorCode = "PROJECT_COMPILATION_FAILED";
  readonly details: Record<string, unknown>;

  constructor(public readonly failures: ValidationFailure[]) {
    super(`Project compilation failed with ${failures.length} validation issue(s)`);
    this.details = { failures };
  }
}
