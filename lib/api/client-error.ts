export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    public details: Record<string, unknown> | undefined,
    message: string,
    public rawBody: unknown = undefined
  ) {
    super(message);
    this.name = "ApiError";
  }
}
