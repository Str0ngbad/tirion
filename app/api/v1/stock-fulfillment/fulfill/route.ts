import { type NextRequest, NextResponse } from "next/server";
import { fulfillFromStock } from "@/lib/stock-fulfillment/service";
import { FulfillFromStockSchema } from "@/lib/stock-fulfillment/schemas";
import {
  WONotFoundError,
  WONotUnreleasedError,
  WOAlreadyReviewedError,
  InsufficientStockError,
  DescendantCompleteError,
} from "@/lib/errors/stock-fulfillment-errors";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const body = FulfillFromStockSchema.parse(await request.json());
    const result = await fulfillFromStock(body.workOrderId, userId);
    return NextResponse.json(result);
  } catch (err) {
    if (
      err instanceof WONotFoundError ||
      err instanceof WONotUnreleasedError ||
      err instanceof WOAlreadyReviewedError ||
      err instanceof InsufficientStockError ||
      err instanceof DescendantCompleteError
    ) {
      return NextResponse.json(
        { error: { code: err.errorCode, message: err.message, details: err.details } },
        { status: err.statusCode }
      );
    }
    return handleApiError(err);
  }
}
