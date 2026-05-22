/**
 * Verification script for the Vendor REST route handlers.
 * Run with: npx tsx scripts/verify-vendor-routes.ts
 *
 * Requires the dev server to be running (npm run dev).
 * Cleans up all test data in finally{} so the database is left unchanged.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";

const BASE_URL = "http://localhost:3000";

async function main() {
  let vendorId: number | null = null;

  try {
    // a) GET /api/v1/vendors?active=true → 200, { data: [] }
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors?active=true`);
      const body = await res.json();
      console.log(`a) GET /api/v1/vendors?active=true → ${res.status} (expected 200)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    // b) POST /api/v1/vendors valid body → 201
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": "1" },
        body: JSON.stringify({ vendorName: "Route Test Vendor", leadTimeDays: 7 }),
      });
      const body = await res.json();
      console.log(`b) POST /api/v1/vendors (valid) → ${res.status} (expected 201)`);
      console.log(`   body: ${JSON.stringify(body)}`);
      if (res.status === 201) vendorId = (body as { vendorId: number }).vendorId;
    }

    // c) POST /api/v1/vendors missing vendorName → 400 VALIDATION_ERROR
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": "1" },
        body: JSON.stringify({ leadTimeDays: 7 }),
      });
      const body = await res.json();
      console.log(`c) POST /api/v1/vendors (missing vendorName) → ${res.status} (expected 400)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    // d) POST /api/v1/vendors without X-User-Id → 401 USER_REQUIRED
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorName: "No Auth Vendor" }),
      });
      const body = await res.json();
      console.log(`d) POST /api/v1/vendors (no X-User-Id) → ${res.status} (expected 401)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    // e) POST /api/v1/vendors X-User-Id: "99999" → 401 USER_NOT_FOUND
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": "99999" },
        body: JSON.stringify({ vendorName: "Bad User Vendor" }),
      });
      const body = await res.json();
      console.log(`e) POST /api/v1/vendors (X-User-Id: 99999) → ${res.status} (expected 401)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    // f) POST /api/v1/vendors duplicate vendorName → 409 VENDOR_NAME_COLLISION
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": "1" },
        body: JSON.stringify({ vendorName: "Route Test Vendor" }),
      });
      const body = await res.json();
      console.log(`f) POST /api/v1/vendors (duplicate name) → ${res.status} (expected 409)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    // g) GET /api/v1/vendors/{vendorId} → 200
    if (vendorId !== null) {
      const res = await fetch(`${BASE_URL}/api/v1/vendors/${vendorId}`);
      const body = await res.json();
      console.log(`g) GET /api/v1/vendors/${vendorId} → ${res.status} (expected 200)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    // h) GET /api/v1/vendors/99999 → 404 VENDOR_NOT_FOUND
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors/99999`);
      const body = await res.json();
      console.log(`h) GET /api/v1/vendors/99999 → ${res.status} (expected 404)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    // i) GET /api/v1/vendors/not-a-number → 400 VALIDATION_ERROR
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors/not-a-number`);
      const body = await res.json();
      console.log(`i) GET /api/v1/vendors/not-a-number → ${res.status} (expected 400)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    if (vendorId !== null) {
      // j) PATCH /api/v1/vendors/{vendorId} valid body → 200
      {
        const res = await fetch(`${BASE_URL}/api/v1/vendors/${vendorId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-User-Id": "1" },
          body: JSON.stringify({ leadTimeDays: 14, notes: "Updated via route test" }),
        });
        const body = await res.json();
        console.log(`j) PATCH /api/v1/vendors/${vendorId} (valid) → ${res.status} (expected 200)`);
        console.log(`   body: ${JSON.stringify(body)}`);
      }

      // k) PATCH /api/v1/vendors/{vendorId} empty body → 400 VALIDATION_ERROR
      {
        const res = await fetch(`${BASE_URL}/api/v1/vendors/${vendorId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-User-Id": "1" },
          body: JSON.stringify({}),
        });
        const body = await res.json();
        console.log(`k) PATCH /api/v1/vendors/${vendorId} (empty body) → ${res.status} (expected 400)`);
        console.log(`   body: ${JSON.stringify(body)}`);
      }

      // l) PATCH /api/v1/vendors/{vendorId} without X-User-Id → 401 USER_REQUIRED
      {
        const res = await fetch(`${BASE_URL}/api/v1/vendors/${vendorId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "No auth update" }),
        });
        const body = await res.json();
        console.log(`l) PATCH /api/v1/vendors/${vendorId} (no X-User-Id) → ${res.status} (expected 401)`);
        console.log(`   body: ${JSON.stringify(body)}`);
      }
    }

    // m) GET /api/v1/vendors?active=banana → 400 VALIDATION_ERROR
    {
      const res = await fetch(`${BASE_URL}/api/v1/vendors?active=banana`);
      const body = await res.json();
      console.log(`m) GET /api/v1/vendors?active=banana → ${res.status} (expected 400)`);
      console.log(`   body: ${JSON.stringify(body)}`);
    }

    console.log("\nAll verification steps completed.");
  } finally {
    console.log("\nCleaning up test data...");
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
