export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    public details: Record<string, unknown> | undefined,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
