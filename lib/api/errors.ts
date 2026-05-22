import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/lib/errors";

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof DomainError) {
    return NextResponse.json(
      { error: { code: err.errorCode, message: err.message, details: err.details } },
      { status: err.statusCode }
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: { issues: err.issues },
        },
      },
      { status: 400 }
    );
  }

  console.error("Unexpected error:", err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
    { status: 500 }
  );
}
