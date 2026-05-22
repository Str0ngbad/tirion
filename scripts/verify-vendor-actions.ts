/**
 * Verification script for the Vendor action endpoints (deactivate/reactivate).
 * Run with: npx tsx scripts/verify-vendor-actions.ts
 *
 * Requires the dev server to be running (npm run dev).
 * Cleans up all test data in finally{} so the database is left unchanged.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";

const BASE_URL = "http://localhost:3000";

async function main() {
  let vendorId: number | null = null;
  let testPartId: number | null = null;

  try {
    // a) Create a test vendor via POST /api/v1/vendors
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": "1" },
        body: JSON.stringify({ vendorName: "Action Test Vendor" }),
      });
      const body = await res.json();
      console.log(`a) POST /api/v1/vendors → ${res.status} (expected 201)`);
      console.log(`   body: ${JSON.stringify(body)}`);
      if (res.status === 201) vendorId = (body as { vendorId: number }).vendorId;
    }

    if (vendorId === null) {
      throw new Error("Setup failed: could not create test vendor");
    }

    // b) POST /deactivate → 200 with isActive: false
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors/${vendorId}/deactivate`, {
        method: "POST",
        headers: { "X-User-Id": "1" },
      });
      const body = await res.json();
      console.log(`b) POST /api/v1/vendors/${vendorId}/deactivate → ${res.status} (expected 200)`);
      console.log(`   isActive: ${(body as { isActive: boolean }).isActive} (expected false)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    // c) POST /deactivate again → 409 VENDOR_ALREADY_INACTIVE
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors/${vendorId}/deactivate`, {
        method: "POST",
        headers: { "X-User-Id": "1" },
      });
      const body = await res.json();
      console.log(`c) POST /api/v1/vendors/${vendorId}/deactivate (again) → ${res.status} (expected 409)`);
      console.log(`   code: ${(body as { error: { code: string } }).error.code} (expected VENDOR_ALREADY_INACTIVE)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    // d) POST /reactivate → 200 with isActive: true
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors/${vendorId}/reactivate`, {
        method: "POST",
        headers: { "X-User-Id": "1" },
      });
      const body = await res.json();
      console.log(`d) POST /api/v1/vendors/${vendorId}/reactivate → ${res.status} (expected 200)`);
      console.log(`   isActive: ${(body as { isActive: boolean }).isActive} (expected true)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    // e) POST /reactivate again → 409 VENDOR_ALREADY_ACTIVE
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors/${vendorId}/reactivate`, {
        method: "POST",
        headers: { "X-User-Id": "1" },
      });
      const body = await res.json();
      console.log(`e) POST /api/v1/vendors/${vendorId}/reactivate (again) → ${res.status} (expected 409)`);
      console.log(`   code: ${(body as { error: { code: string } }).error.code} (expected VENDOR_ALREADY_ACTIVE)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    // f) POST /deactivate without X-User-Id → 401 USER_REQUIRED
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors/${vendorId}/deactivate`, {
        method: "POST",
      });
      const body = await res.json();
      console.log(`f) POST /api/v1/vendors/${vendorId}/deactivate (no X-User-Id) → ${res.status} (expected 401)`);
      console.log(`   code: ${(body as { error: { code: string } }).error.code} (expected USER_REQUIRED)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    // g) POST /api/v1/vendors/99999/deactivate → 404 VENDOR_NOT_FOUND
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors/99999/deactivate`, {
        method: "POST",
        headers: { "X-User-Id": "1" },
      });
      const body = await res.json();
      console.log(`g) POST /api/v1/vendors/99999/deactivate → ${res.status} (expected 404)`);
      console.log(`   code: ${(body as { error: { code: string } }).error.code} (expected VENDOR_NOT_FOUND)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    // h) POST /api/v1/vendors/not-a-number/deactivate → 400 VALIDATION_ERROR
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors/not-a-number/deactivate`, {
        method: "POST",
        headers: { "X-User-Id": "1" },
      });
      const body = await res.json();
      console.log(`h) POST /api/v1/vendors/not-a-number/deactivate → ${res.status} (expected 400)`);
      console.log(`   code: ${(body as { error: { code: string } }).error.code} (expected VALIDATION_ERROR)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    // i) Blocker test: create a Part referencing the vendor, then attempt deactivate
    const testPart = await prisma.part.create({
      data: {
        partNumber: "VERIFY-ACTION-PART-001",
        partName: "Verification Test Part (vendor actions)",
        partType: "Part",
        procurementType: "Buy",
        defaultVendorId: vendorId,
        isActive: true,
      },
    });
    testPartId = testPart.partId;
    console.log(`\ni) Created test part (partId=${testPartId}) referencing vendor ${vendorId}`);

    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors/${vendorId}/deactivate`, {
        method: "POST",
        headers: { "X-User-Id": "1" },
      });
      const body = await res.json();
      console.log(`   POST /api/v1/vendors/${vendorId}/deactivate (with blocking part) → ${res.status} (expected 409)`);
      console.log(`   code: ${(body as { error: { code: string } }).error.code} (expected VENDOR_DEACTIVATION_BLOCKED)`);
      console.log(`   error.details: ${JSON.stringify((body as { error: { details: unknown } }).error.details, null, 2)}`);
    }

    console.log("\nAll verification steps completed.");
  } finally {
    console.log("\nCleaning up test data...");

    if (testPartId !== null) {
      await prisma.part.delete({ where: { partId: testPartId } });
      console.log(`   Deleted test part (partId=${testPartId})`);
    }
    if (vendorId !== null) {
      await prisma.vendor.delete({ where: { vendorId } });
      console.log(`   Deleted test vendor (vendorId=${vendorId})`);
    }

    const finalCount = await prisma.vendor.count();
    console.log(`   Final vendor count: ${finalCount} (expected 0 if DB had none before)`);

    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
