import { DomainError } from "@/lib/errors/base";

export class RoutingTemplateNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly errorCode = "ROUTING_TEMPLATE_NOT_FOUND";
  readonly details: Record<string, unknown>;

  constructor(routingTemplateDefinitionId: number) {
    super(`Routing template not found: ${routingTemplateDefinitionId}`);
    this.details = { routingTemplateDefinitionId };
  }
}

export class RoutingTemplateNameCollisionError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "ROUTING_TEMPLATE_NAME_COLLISION";
  readonly details: Record<string, unknown>;

  constructor(templateName: string) {
    super(`A routing template with name '${templateName}' already exists`);
    this.details = { templateName };
  }
}

export class RoutingTemplateAlreadyActiveError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "ROUTING_TEMPLATE_ALREADY_ACTIVE";
  readonly details: Record<string, unknown>;

  constructor(routingTemplateDefinitionId: number) {
    super(`Routing template ${routingTemplateDefinitionId} is already active`);
    this.details = { routingTemplateDefinitionId };
  }
}

export class RoutingTemplateAlreadyInactiveError extends DomainError {
  readonly statusCode = 409;
  readonly errorCode = "ROUTING_TEMPLATE_ALREADY_INACTIVE";
  readonly details: Record<string, unknown>;

  constructor(routingTemplateDefinitionId: number) {
    super(`Routing template ${routingTemplateDefinitionId} is already inactive`);
    this.details = { routingTemplateDefinitionId };
  }
}

export class RoutingTemplateStepCountError extends DomainError {
  readonly statusCode = 422;
  readonly errorCode = "ROUTING_TEMPLATE_STEP_COUNT";
  readonly details: Record<string, unknown>;

  constructor(stepCount: number, max: number) {
    super(`Step count ${stepCount} is invalid; must be between 1 and ${max}`);
    this.details = { stepCount, max };
  }
}

export class RoutingTemplateStepIndexError extends DomainError {
  readonly statusCode = 422;
  readonly errorCode = "ROUTING_TEMPLATE_STEP_INDEX";
  readonly details: Record<string, unknown>;

  constructor(providedIndices: number[]) {
    super(`Step indices must be contiguous 1-based (e.g. [1,2,3]); got [${providedIndices.join(",")}]`);
    this.details = { providedIndices };
  }
}

export class RoutingTemplateInvalidProcessTypeError extends DomainError {
  readonly statusCode = 422;
  readonly errorCode = "ROUTING_TEMPLATE_INVALID_PROCESS_TYPE";
  readonly details: Record<string, unknown>;

  constructor(
    processTypeId: number,
    reason: "process_type_not_found" | "process_type_inactive" | "purchase_receive_on_assembly"
  ) {
    super(`Invalid process type ${processTypeId}: ${reason}`);
    this.details = { processTypeId, reason };
  }
}
