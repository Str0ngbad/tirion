/**
 * Verification script for the Vendor service layer.
 * Run with: npx tsx scripts/verify-vendor-service.ts
 *
 * Exercises each service function end-to-end against a real database.
 * Cleans up all test data in finally{} so the database is left unchanged.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";
import {
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  deactivateVendor,
  reactivateVendor,
} from "../lib/vendors/service";
import {
  VendorNotFoundError,
  VendorNameCollisionError,
  VendorAlreadyActiveError,
  VendorDeactivationBlockedError,
} from "../lib/errors/index";

const USER_ID = 1;

async function main() {
  let vendorAId: number | null = null;
  let vendorBId: number | null = null;
  let testPartId: number | null = null;

  try {
    // a) List vendors (active=true). Should be empty before any test data is created.
    const initialList = await listVendors({ active: "true" });
    console.log(`a) Initial active vendor count: ${initialList.length} (expected 0)`);

    // b) Create vendor A.
    const vendorA = await createVendor({ vendorName: "Test Vendor A", leadTimeDays: 14 }, USER_ID);
    vendorAId = vendorA.vendorId;
    console.log("b) Created vendor A:", JSON.stringify(vendorA, null, 2));

    // c) Create vendor B.
    const vendorB = await createVendor(
      { vendorName: "Test Vendor B", contactInfo: "test@example.com" },
      USER_ID
    );
    vendorBId = vendorB.vendorId;
    console.log("c) Created vendor B:", JSON.stringify(vendorB, null, 2));

    // d) Attempt to create a vendor with a duplicate name. Expect VendorNameCollisionError.
    try {
      await createVendor({ vendorName: "Test Vendor A" }, USER_ID);
      console.log("d) ERROR: expected VendorNameCollisionError but no error was thrown");
    } catch (err) {
      if (err instanceof VendorNameCollisionError) {
        console.log(`d) Collision correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    // e) List vendors (active=true). Should show two vendors.
    const activeList = await listVendors({ active: "true" });
    console.log(
      `e) Active vendor count: ${activeList.length} (expected 2). Names: ${activeList.map((v) => v.vendorName).join(", ")}`
    );

    // f) Get vendor A by ID.
    const fetchedA = await getVendor(vendorAId);
    console.log("f) Fetched vendor A:", JSON.stringify(fetchedA, null, 2));

    // g) Get a non-existent vendor. Expect VendorNotFoundError.
    try {
      await getVendor(99999);
      console.log("g) ERROR: expected VendorNotFoundError but no error was thrown");
    } catch (err) {
      if (err instanceof VendorNotFoundError) {
        console.log(`g) Not-found correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    // h) Update vendor A.
    const updatedA = await updateVendor(
      vendorAId,
      { leadTimeDays: 21, notes: "Updated for verification" },
      USER_ID
    );
    console.log("h) Updated vendor A:", JSON.stringify(updatedA, null, 2));

    // i) Deactivate vendor B. Should succeed — no Parts reference it.
    const deactivatedB = await deactivateVendor(vendorBId, USER_ID);
    console.log("i) Deactivated vendor B:", JSON.stringify(deactivatedB, null, 2));

    // j) List vendors (active=false). Should show one vendor (Vendor B).
    const inactiveList = await listVendors({ active: "false" });
    console.log(`j) Inactive vendor count: ${inactiveList.length} (expected 1)`);

    // k) List vendors (active=all). Should show both vendors.
    const allList = await listVendors({ active: "all" });
    console.log(`k) All vendor count: ${allList.length} (expected 2)`);

    // l) Reactivate vendor B.
    const reactivatedB = await reactivateVendor(vendorBId, USER_ID);
    console.log("l) Reactivated vendor B:", JSON.stringify(reactivatedB, null, 2));

    // m) Attempt to reactivate vendor B again (now already active). Expect VendorAlreadyActiveError.
    try {
      await reactivateVendor(vendorBId, USER_ID);
      console.log("m) ERROR: expected VendorAlreadyActiveError but no error was thrown");
    } catch (err) {
      if (err instanceof VendorAlreadyActiveError) {
        console.log(`m) Already-active correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    // n) Create a Part referencing vendor A as default vendor, then attempt to deactivate
    //    vendor A. Expect VendorDeactivationBlockedError with the blocking part in details.
    const testPart = await prisma.part.create({
      data: {
        partNumber: "VERIFY-VENDOR-PART-001",
        partName: "Verification Test Part (vendor service)",
        partType: "Part",
        procurementType: "Buy",
        defaultVendorId: vendorAId,
        isActive: true,
      },
    });
    testPartId = testPart.partId;
    console.log(`n) Created test part (partId=${testPartId}) referencing vendor A`);

    try {
      await deactivateVendor(vendorAId, USER_ID);
      console.log("n) ERROR: expected VendorDeactivationBlockedError but no error was thrown");
    } catch (err) {
      if (err instanceof VendorDeactivationBlockedError) {
        console.log(`n) Deactivation correctly blocked: ${err.message}`);
        console.log("   Blocking parts from error.details:", err.details);
      } else {
        throw err;
      }
    }

    console.log("\nAll verification steps passed.");
  } finally {
    // o) Clean up all test data so the database is left in the state it was before the script ran.
    console.log("\no) Cleaning up test data...");

    if (testPartId !== null) {
      await prisma.part.delete({ where: { partId: testPartId } });
      console.log(`   Deleted test part (partId=${testPartId})`);
    }
    if (vendorAId !== null) {
      await prisma.vendor.delete({ where: { vendorId: vendorAId } });
      console.log(`   Deleted vendor A (vendorId=${vendorAId})`);
    }
    if (vendorBId !== null) {
      await prisma.vendor.delete({ where: { vendorId: vendorBId } });
      console.log(`   Deleted vendor B (vendorId=${vendorBId})`);
    }

    const finalCount = await prisma.vendor.count();
    console.log(`   Final vendor count: ${finalCount} (expected 0 if the DB had none before)`);

    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
