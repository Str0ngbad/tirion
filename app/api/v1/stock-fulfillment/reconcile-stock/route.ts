import { type NextRequest, NextResponse } from "next/server";
import { reconcileStock } from "@/lib/stock-fulfillment/service";
import { ReconcileStockSchema } from "@/lib/stock-fulfillment/schemas";
import { ReconcileStockError } from "@/lib/errors/stock-fulfillment-errors";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const body = ReconcileStockSchema.parse(await request.json());
    const result = await reconcileStock(body.partId, body.newStockCount, body.reason, userId);
    return NextResponse.json({
      partId: result.partId,
      partNumber: result.partNumber,
      partName: result.partName,
      stockCount: result.stockCount,
    });
  } catch (err) {
    if (err instanceof ReconcileStockError) {
      return NextResponse.json(
        { error: { code: err.errorCode, message: err.message, details: err.details } },
        { status: err.statusCode }
      );
    }
    return handleApiError(err);
  }
}
