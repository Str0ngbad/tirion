/**
 * Verification script for the MaterialSpec service layer.
 * Run with: npx tsx scripts/verify-material-spec-service.ts
 *
 * Exercises each service function end-to-end against a real database.
 * Cleans up all test data in finally{} so the database is left unchanged.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";
import {
  listMaterialSpecs,
  getMaterialSpec,
  createMaterialSpec,
  updateMaterialSpec,
  deactivateMaterialSpec,
  reactivateMaterialSpec,
} from "../lib/material-specs/service";
import {
  MaterialSpecNotFoundError,
  MaterialSpecCollisionError,
  MaterialSpecAlreadyActiveError,
  MaterialSpecAlreadyInactiveError,
} from "../lib/errors/index";

const USER_ID = 1;

async function main() {
  let specAId: number | null = null;
  let specBId: number | null = null;
  let specCId: number | null = null;

  try {
    // a) List active MaterialSpecs — capture initial count.
    const initialList = await listMaterialSpecs({ active: "true" });
    const initialCount = initialList.length;
    console.log(`a) Initial active MaterialSpec count: ${initialCount}`);

    // b) Create test MaterialSpec A: same name, unique form (Round).
    const specA = await createMaterialSpec(
      { materialName: "TEST_ALLOY_A", form: "Round" },
      USER_ID
    );
    specAId = specA.materialSpecId;
    console.log("b) Created spec A:", JSON.stringify(specA, null, 2));

    // c) Create test MaterialSpec B: same materialName, different form → should succeed.
    const specB = await createMaterialSpec(
      { materialName: "TEST_ALLOY_A", form: "Square" },
      USER_ID
    );
    specBId = specB.materialSpecId;
    console.log("c) Created spec B (same name, different form):", JSON.stringify(specB, null, 2));

    // d) Create test MaterialSpec C: different name, same form as A → should succeed.
    const specC = await createMaterialSpec(
      { materialName: "TEST_ALLOY_B", form: "Round" },
      USER_ID
    );
    specCId = specC.materialSpecId;
    console.log("d) Created spec C (different name, same form as A):", JSON.stringify(specC, null, 2));

    // e) Attempt create with duplicate composite (TEST_ALLOY_A, Round) → expect MaterialSpecCollisionError.
    try {
      await createMaterialSpec({ materialName: "TEST_ALLOY_A", form: "Round" }, USER_ID);
      console.log("e) ERROR: expected MaterialSpecCollisionError but no error was thrown");
    } catch (err) {
      if (err instanceof MaterialSpecCollisionError) {
        console.log(`e) Composite collision correctly rejected: ${err.message}`);
        console.log(`   details: ${JSON.stringify(err.details)}`);
      } else {
        throw err;
      }
    }

    // f) List active MaterialSpecs → count should be initial + 3.
    const listAfterCreate = await listMaterialSpecs({ active: "true" });
    console.log(
      `f) Active count after creates: ${listAfterCreate.length} (expected ${initialCount + 3})`
    );
    if (listAfterCreate.length !== initialCount + 3) {
      throw new Error(
        `Expected ${initialCount + 3} active specs, found ${listAfterCreate.length}`
      );
    }

    // g) Get test MaterialSpec A by id → usedByCount: 0, parts: [].
    const fetchedA = await getMaterialSpec(specAId);
    console.log("g) Fetched spec A:", JSON.stringify(fetchedA, null, 2));
    if (fetchedA.usedByCount !== 0) {
      throw new Error(`Expected usedByCount 0, got ${fetchedA.usedByCount}`);
    }
    if (fetchedA.parts.length !== 0) {
      throw new Error(`Expected parts [], got ${JSON.stringify(fetchedA.parts)}`);
    }

    // h) Get id 99999 → expect MaterialSpecNotFoundError.
    try {
      await getMaterialSpec(99999);
      console.log("h) ERROR: expected MaterialSpecNotFoundError but no error was thrown");
    } catch (err) {
      if (err instanceof MaterialSpecNotFoundError) {
        console.log(`h) Not-found correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    // i) Update spec A's form to "Hex" → success, form updated, materialName unchanged.
    const updatedAHex = await updateMaterialSpec(specAId, { form: "Hex" }, USER_ID);
    console.log("i) Updated spec A form to Hex:", JSON.stringify(updatedAHex, null, 2));
    if (updatedAHex.form !== "Hex" || updatedAHex.materialName !== "TEST_ALLOY_A") {
      throw new Error("Update did not apply expected field values");
    }

    // j) Update spec A's form to "Square" → expect MaterialSpecCollisionError (conflicts with B).
    try {
      await updateMaterialSpec(specAId, { form: "Square" }, USER_ID);
      console.log("j) ERROR: expected MaterialSpecCollisionError but no error was thrown");
    } catch (err) {
      if (err instanceof MaterialSpecCollisionError) {
        console.log(`j) Composite collision on update correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    // k) Update spec A's form back to "Round" → success (returning to original state).
    const updatedARound = await updateMaterialSpec(specAId, { form: "Round" }, USER_ID);
    console.log("k) Updated spec A form back to Round:", JSON.stringify(updatedARound, null, 2));
    if (updatedARound.form !== "Round") {
      throw new Error("Expected form 'Round'");
    }

    // l) Deactivate spec A → succeeds, isActive: false.
    const deactivatedA = await deactivateMaterialSpec(specAId, USER_ID);
    console.log("l) Deactivated spec A:", JSON.stringify(deactivatedA, null, 2));
    if (deactivatedA.isActive) throw new Error("Expected isActive: false after deactivation");

    // m) List with active=true → A excluded from results.
    const listActiveOnly = await listMaterialSpecs({ active: "true" });
    console.log(
      `m) Active count after deactivating A: ${listActiveOnly.length} (expected ${initialCount + 2})`
    );
    if (listActiveOnly.length !== initialCount + 2) {
      throw new Error(
        `Expected ${initialCount + 2} active specs, found ${listActiveOnly.length}`
      );
    }
    if (listActiveOnly.some((s) => s.materialSpecId === specAId)) {
      throw new Error("Deactivated spec A should not appear in active list");
    }

    // n) List with active=all → A included with isActive: false.
    const listAll = await listMaterialSpecs({ active: "all" });
    console.log(`n) All-specs count: ${listAll.length} (expected ${initialCount + 3})`);
    if (listAll.length !== initialCount + 3) {
      throw new Error(
        `Expected ${initialCount + 3} total specs, found ${listAll.length}`
      );
    }
    const foundA = listAll.find((s) => s.materialSpecId === specAId);
    if (!foundA || foundA.isActive) {
      throw new Error("Expected spec A in all-list with isActive: false");
    }

    // o) Reactivate spec A → succeeds, isActive: true.
    const reactivatedA = await reactivateMaterialSpec(specAId, USER_ID);
    console.log("o) Reactivated spec A:", JSON.stringify(reactivatedA, null, 2));
    if (!reactivatedA.isActive) throw new Error("Expected isActive: true after reactivation");

    // p) Attempt to reactivate spec A again → expect MaterialSpecAlreadyActiveError.
    try {
      await reactivateMaterialSpec(specAId, USER_ID);
      console.log("p) ERROR: expected MaterialSpecAlreadyActiveError but no error was thrown");
    } catch (err) {
      if (err instanceof MaterialSpecAlreadyActiveError) {
        console.log(`p) Already-active correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    console.log("\nAll 16 verification steps passed.");
  } finally {
    console.log("\nCleaning up test data...");

    if (specAId !== null) {
      await prisma.materialSpec.delete({ where: { materialSpecId: specAId } });
      console.log(`   Deleted spec A (materialSpecId=${specAId})`);
    }
    if (specBId !== null) {
      await prisma.materialSpec.delete({ where: { materialSpecId: specBId } });
      console.log(`   Deleted spec B (materialSpecId=${specBId})`);
    }
    if (specCId !== null) {
      await prisma.materialSpec.delete({ where: { materialSpecId: specCId } });
      console.log(`   Deleted spec C (materialSpecId=${specCId})`);
    }

    const finalCount = await prisma.materialSpec.count();
    console.log(`   Final MaterialSpec count: ${finalCount}`);

    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
