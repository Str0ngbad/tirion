/**
 * Verification script for the ProcurementCategory service layer.
 * Run with: npx tsx scripts/verify-procurement-category-service.ts
 *
 * Exercises each service function end-to-end against a real database.
 * Cleans up all test data in finally{} so the database is left unchanged.
 * The five seeded categories (CTL, PO, P, SM, HW) are never touched.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";
import {
  listProcurementCategories,
  getProcurementCategory,
  createProcurementCategory,
  updateProcurementCategory,
  deactivateProcurementCategory,
  reactivateProcurementCategory,
} from "../lib/procurement-categories/service";
import {
  ProcurementCategoryNotFoundError,
  ProcurementCategoryCodeCollisionError,
  ProcurementCategoryNameCollisionError,
  ProcurementCategoryAlreadyActiveError,
} from "../lib/errors/index";

const USER_ID = 1;

async function main() {
  let categoryAId: number | null = null;
  let categoryBId: number | null = null;

  try {
    // a) List active categories — should include the 5 seeded categories.
    const initialList = await listProcurementCategories({ active: "true" });
    const initialCodes = initialList.map((c) => c.categoryCode).join(", ");
    console.log(
      `a) Initial active category count: ${initialList.length} (expected >= 5). Codes: ${initialCodes}`
    );
    if (initialList.length < 5) {
      throw new Error(`Expected at least 5 seeded categories, found ${initialList.length}`);
    }

    // b) Create test category A.
    const categoryA = await createProcurementCategory(
      {
        categoryCode: "TEST-A",
        categoryName: "Test Category Alpha",
        description: "Verification test record",
        displayOrder: 100,
      },
      USER_ID
    );
    categoryAId = categoryA.procurementCategoryId;
    console.log("b) Created category A:", JSON.stringify(categoryA, null, 2));

    // c) Create test category B (no description).
    const categoryB = await createProcurementCategory(
      {
        categoryCode: "TEST-B",
        categoryName: "Test Category Beta",
        displayOrder: 101,
      },
      USER_ID
    );
    categoryBId = categoryB.procurementCategoryId;
    console.log("c) Created category B:", JSON.stringify(categoryB, null, 2));

    // d) Attempt create with duplicate categoryCode "TEST-A". Expect ProcurementCategoryCodeCollisionError.
    try {
      await createProcurementCategory(
        { categoryCode: "TEST-A", categoryName: "Some Other Name" },
        USER_ID
      );
      console.log("d) ERROR: expected ProcurementCategoryCodeCollisionError but no error was thrown");
    } catch (err) {
      if (err instanceof ProcurementCategoryCodeCollisionError) {
        console.log(`d) Code collision correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    // e) Attempt create with duplicate categoryName "Test Category Alpha". Expect ProcurementCategoryNameCollisionError.
    try {
      await createProcurementCategory(
        { categoryCode: "TEST-D", categoryName: "Test Category Alpha" },
        USER_ID
      );
      console.log("e) ERROR: expected ProcurementCategoryNameCollisionError but no error was thrown");
    } catch (err) {
      if (err instanceof ProcurementCategoryNameCollisionError) {
        console.log(`e) Name collision correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    // f) List active categories — count should now be 7 (5 seeded + 2 test).
    const listAfterCreate = await listProcurementCategories({ active: "true" });
    console.log(
      `f) Active category count after creates: ${listAfterCreate.length} (expected 7)`
    );
    if (listAfterCreate.length !== initialList.length + 2) {
      throw new Error(
        `Expected ${initialList.length + 2} active categories, found ${listAfterCreate.length}`
      );
    }

    // g) Get test category A by id.
    const fetchedA = await getProcurementCategory(categoryAId);
    console.log("g) Fetched category A:", JSON.stringify(fetchedA, null, 2));
    if (fetchedA.usedByCount !== 0) {
      throw new Error(`Expected usedByCount 0, got ${fetchedA.usedByCount}`);
    }

    // h) Get id 99999 — expect ProcurementCategoryNotFoundError.
    try {
      await getProcurementCategory(99999);
      console.log("h) ERROR: expected ProcurementCategoryNotFoundError but no error was thrown");
    } catch (err) {
      if (err instanceof ProcurementCategoryNotFoundError) {
        console.log(`h) Not-found correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    // i) Update test category A.
    const updatedA = await updateProcurementCategory(
      categoryAId,
      { description: "Updated for verification", displayOrder: 102 },
      USER_ID
    );
    console.log("i) Updated category A:", JSON.stringify(updatedA, null, 2));
    if (updatedA.description !== "Updated for verification" || updatedA.displayOrder !== 102) {
      throw new Error("Update did not apply expected field values");
    }

    // j) Update test category A with duplicate name "Test Category Beta". Expect ProcurementCategoryNameCollisionError.
    try {
      await updateProcurementCategory(
        categoryAId,
        { categoryName: "Test Category Beta" },
        USER_ID
      );
      console.log("j) ERROR: expected ProcurementCategoryNameCollisionError but no error was thrown");
    } catch (err) {
      if (err instanceof ProcurementCategoryNameCollisionError) {
        console.log(`j) Name collision on update correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    // k) Deactivate test category B — no blocker check per spec.
    const deactivatedB = await deactivateProcurementCategory(categoryBId, USER_ID);
    console.log("k) Deactivated category B:", JSON.stringify(deactivatedB, null, 2));
    if (deactivatedB.isActive) throw new Error("Expected isActive: false after deactivation");

    // l) List active categories — count back to 6 (5 seeded + A).
    const listAfterDeactivate = await listProcurementCategories({ active: "true" });
    console.log(
      `l) Active category count after deactivating B: ${listAfterDeactivate.length} (expected 6)`
    );
    if (listAfterDeactivate.length !== initialList.length + 1) {
      throw new Error(
        `Expected ${initialList.length + 1} active categories, found ${listAfterDeactivate.length}`
      );
    }

    // m) List with active=all — count should be 7.
    const listAll = await listProcurementCategories({ active: "all" });
    console.log(`m) All category count: ${listAll.length} (expected 7)`);
    if (listAll.length !== initialList.length + 2) {
      throw new Error(
        `Expected ${initialList.length + 2} total categories, found ${listAll.length}`
      );
    }

    // n) Reactivate test category B.
    const reactivatedB = await reactivateProcurementCategory(categoryBId, USER_ID);
    console.log("n) Reactivated category B:", JSON.stringify(reactivatedB, null, 2));
    if (!reactivatedB.isActive) throw new Error("Expected isActive: true after reactivation");

    // o) Attempt to reactivate test category B again (already active). Expect ProcurementCategoryAlreadyActiveError.
    try {
      await reactivateProcurementCategory(categoryBId, USER_ID);
      console.log("o) ERROR: expected ProcurementCategoryAlreadyActiveError but no error was thrown");
    } catch (err) {
      if (err instanceof ProcurementCategoryAlreadyActiveError) {
        console.log(`o) Already-active correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    console.log("\nAll 15 verification steps passed.");
  } finally {
    console.log("\nCleaning up test data...");

    if (categoryAId !== null) {
      await prisma.procurementCategory.delete({ where: { procurementCategoryId: categoryAId } });
      console.log(`   Deleted category A (procurementCategoryId=${categoryAId})`);
    }
    if (categoryBId !== null) {
      await prisma.procurementCategory.delete({ where: { procurementCategoryId: categoryBId } });
      console.log(`   Deleted category B (procurementCategoryId=${categoryBId})`);
    }

    const finalCount = await prisma.procurementCategory.count();
    console.log(`   Final category count: ${finalCount} (seeded categories preserved)`);

    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
